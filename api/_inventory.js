import { serviceClient, serviceHeaders } from "./_auth.js";
import { evaluateDuplicateSellerLead, notifySameVehicleBuyerLeads } from "./_lead-signals.js";

export function normalizeListingStatus(value) {
  const status = String(value || "draft").trim().toLowerCase();
  return ["draft", "review", "published", "sold", "archived"].includes(status) ? status : "draft";
}

export async function listPublishedInventory() {
  const client = serviceClient();
  if (!client.ok) return { ok: true, storage: "not_configured", inventory: [] };

  const result = await fetchSupabaseJson(
    `${client.url}/rest/v1/vehicle_listings?select=*&status=eq.published&order=published_at.desc.nullslast,created_at.desc&limit=100`,
    client.key
  );
  if (!result.ok) return { ...result, inventory: [] };
  const inventory = Array.isArray(result.data) ? result.data.map(publicInventoryRow) : [];
  return { ok: true, storage: "supabase", inventory: await attachListingPhotos(inventory, true, client) };
}

export async function listAdminInventory() {
  const client = serviceClient();
  if (!client.ok) return { ok: true, storage: "not_configured", inventory: [] };

  const result = await fetchSupabaseJson(
    `${client.url}/rest/v1/vehicle_listings?select=*&order=created_at.desc&limit=200`,
    client.key
  );
  if (!result.ok) return { ...result, inventory: [] };
  const inventory = Array.isArray(result.data) ? result.data.map(publicInventoryRow) : [];
  const withListingPhotos = await attachListingPhotos(inventory, false, client);
  const withLeadSummary = await attachInventoryLeadSummary(withListingPhotos, client);
  return { ok: true, storage: "supabase", inventory: await attachAvailableLeadPhotos(withLeadSummary, client) };
}

export async function updateInventoryListing(body, user) {
  const client = serviceClient();
  if (!client.ok) return client;
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, status: 400, error: "Listing id is required" };
  const currentListing = await fetchListingById(client, id);
  if (!currentListing) return { ok: false, status: 404, error: "Inventory listing not found" };
  const nextStatus = normalizeListingStatus(body.status || currentListing.status);
  const hasAssignedTo = Object.prototype.hasOwnProperty.call(body || {}, "assignedTo");
  let sourceLead = null;
  if (nextStatus === "published" && currentListing.source_lead_id) {
    sourceLead = await fetchLeadById(client, currentListing.source_lead_id);
    const duplicateWarning = await evaluateDuplicateSellerLead(client, sourceLead);
    if (duplicateWarning && !duplicateWarning.reviewed) {
      return {
        ok: false,
        status: 409,
        error: "Duplicate seller vehicle must be reviewed by owner before publishing this Warehouse listing.",
        duplicate_warning: duplicateWarning
      };
    }
  }

  const status = normalizeListingStatus(body.status);
  const patch = {
    status,
    title: String(body.title || "").trim(),
    asking_price: numberOrNull(body.askingPrice),
    monthly_payment_estimate: numberOrNull(body.monthlyPaymentEstimate),
    description: String(body.description || "").trim(),
    public_options: buildListingPublicOptions(body),
    updated_at: new Date().toISOString()
  };
  patch.published_at = status === "published" ? new Date().toISOString() : null;
  if (user?.email) patch.created_by = String(user.email || "").trim();

  const saveResult = await saveVehicleListing(client, {
    endpoint: `${client.url}/rest/v1/vehicle_listings?id=eq.${encodeURIComponent(id)}`,
    method: "PATCH",
    payload: patch
  });
  if (!saveResult.ok) return saveResult;
  if (Array.isArray(body.selectedPhotoUrls)) {
    await syncSelectedListingPhotos(client, id, String(body.sourceLeadId || "").trim(), body.selectedPhotoUrls);
  }
  if (hasAssignedTo && currentListing.source_lead_id) {
    if (!sourceLead) sourceLead = await fetchLeadById(client, currentListing.source_lead_id);
    const assignResult = await updateInventoryLeadAssignee(client, currentListing.source_lead_id, sourceLead, body.assignedTo, user);
    if (assignResult && !assignResult.ok) return assignResult;
  }
  const timeline = buildInventoryUpdateTimeline(currentListing, patch, body);
  if (currentListing.source_lead_id && timeline) {
    await createLeadNote(client, currentListing.source_lead_id, user, timeline);
  }
  await notifyBuyerLeadsForInventoryChange(client, currentListing, {
    nextStatus: status,
    actorEmail: String(user?.email || "").trim().toLowerCase()
  });
  return { ok: true, listing: publicInventoryRow(saveResult.data?.[0] || { ...saveResult.payload, id }) };
}

export async function deleteInventoryListing(id, user) {
  const client = serviceClient();
  if (!client.ok) return client;
  const listingId = String(id || "").trim();
  if (!listingId) return { ok: false, status: 400, error: "Listing id is required" };

  const listingResult = await fetchSupabaseJson(
    `${client.url}/rest/v1/vehicle_listings?select=*&id=eq.${encodeURIComponent(listingId)}&limit=1`,
    client.key
  );
  if (!listingResult.ok) return listingResult;
  const listing = listingResult.data?.[0];
  if (!listing) return { ok: false, status: 404, error: "Inventory listing not found" };

  if (!listing.source_lead_id) {
    return {
      ok: false,
      status: 409,
      error: "This warehouse listing is not linked to a SELL lead, so it cannot be moved back to Up Sheets automatically."
    };
  }

  const restored = await restoreLeadFromInventory(client, listing.source_lead_id);
  if (!restored.ok) return restored;

  const response = await fetch(`${client.url}/rest/v1/vehicle_listings?id=eq.${encodeURIComponent(listingId)}`, {
    method: "DELETE",
    headers: {
      ...serviceHeaders(client.key),
      Prefer: "return=representation"
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };

  await createLeadNote(
    client,
    listing.source_lead_id,
    user,
    `Inventory listing removed by ${user?.email || "admin"}. Lead restored to ${restored.status}. Staff can update the lead details, then an admin can publish it again.`
  );
  await notifySameVehicleBuyerLeads(client, listing, {
    code: "vehicle_unlisted",
    message: `This vehicle was removed from the Buy page: ${listing.title || "Vehicle"}. Review related buyer leads before continuing.`,
    authorEmail: String(user?.email || "").trim().toLowerCase()
  });

  return {
    ok: true,
    deleted: Array.isArray(data) ? data.length : 1,
    restoredStatus: restored.status,
    sourceLeadId: listing.source_lead_id,
    listing: publicInventoryRow(listing)
  };
}

export async function publishLeadToInventory(body, user) {
  const client = serviceClient();
  if (!client.ok) return client;
  const leadId = String(body.leadId || "").trim();
  if (!leadId) return { ok: false, status: 400, error: "Lead id is required" };

  const leadResult = await fetchSupabaseJson(
    `${client.url}/rest/v1/valuation_leads?select=*&id=eq.${encodeURIComponent(leadId)}&limit=1`,
    client.key
  );
  if (!leadResult.ok) return leadResult;
  const lead = leadResult.data?.[0];
  if (!lead) return { ok: false, status: 404, error: "Lead not found" };
  const duplicateWarning = await evaluateDuplicateSellerLead(client, lead);
  if (duplicateWarning && !duplicateWarning.reviewed) {
    return {
      ok: false,
      status: 409,
      error: "Duplicate seller vehicle must be reviewed by owner before moving into Warehouse.",
      duplicate_warning: duplicateWarning
    };
  }

  const existing = await fetchSupabaseJson(
    `${client.url}/rest/v1/vehicle_listings?select=id,status,updated_at,created_at&source_lead_id=eq.${encodeURIComponent(leadId)}&order=updated_at.desc.nullslast,created_at.desc&limit=1`,
    client.key
  );
  if (!existing.ok) return existing;

  const listing = buildListingFromLead(lead, body, user);
  const existingId = existing.data?.[0]?.id;
  const saveResult = await saveVehicleListing(client, {
    endpoint: existingId
      ? `${client.url}/rest/v1/vehicle_listings?id=eq.${encodeURIComponent(existingId)}`
      : `${client.url}/rest/v1/vehicle_listings`,
    method: existingId ? "PATCH" : "POST",
    payload: listing
  });
  if (!saveResult.ok) return saveResult;

  const savedListing = saveResult.data?.[0] || { ...saveResult.payload, id: existingId };
  if (isPublicOptionEnabled(savedListing.public_options || listing.public_options, "showPhotos")) {
    await attachLeadPhotosToListing(leadId, savedListing.id || existingId, client);
  }
  await createLeadNote(client, leadId, user, `Inventory listing ${existingId ? "updated" : "published"} by ${user?.email || "admin"}.`);
  return { ok: true, listing: publicInventoryRow(savedListing), updated: Boolean(existingId) };
}

async function saveVehicleListing(client, { endpoint, method, payload }) {
  let currentPayload = { ...payload };
  const removedColumns = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(endpoint, {
      method,
      headers: {
        ...serviceHeaders(client.key),
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(currentPayload)
    });
    const data = await response.json().catch(() => null);
    if (response.ok) return { ok: true, data, payload: currentPayload, removedColumns };

    const missingColumn = missingSchemaColumn(data);
    if (!missingColumn || !(missingColumn in currentPayload)) {
      return { ok: false, status: response.status, error: data };
    }
    delete currentPayload[missingColumn];
    removedColumns.push(missingColumn);
  }
  return { ok: false, status: 400, error: "Unable to save inventory listing after removing unsupported legacy columns." };
}

function missingSchemaColumn(error) {
  const text = [error?.message, error?.details, error?.hint, JSON.stringify(error || {})].filter(Boolean).join(" ");
  const match = text.match(/'([^']+)'\s+column/i);
  return match?.[1] || "";
}

function buildInventoryUpdateTimeline(current = {}, patch = {}, body = {}) {
  const changes = [];
  if (String(current.status || "") !== String(patch.status || "")) changes.push(`status ${current.status || "blank"} -> ${patch.status || "blank"}`);
  if (String(current.title || "") !== String(patch.title || "")) changes.push("title updated");
  if (numberOrNull(current.asking_price) !== numberOrNull(patch.asking_price)) changes.push(`asking price ${current.asking_price ?? "not set"} -> ${patch.asking_price ?? "not set"}`);
  if (numberOrNull(current.monthly_payment_estimate) !== numberOrNull(patch.monthly_payment_estimate)) {
    changes.push(`monthly estimate ${current.monthly_payment_estimate ?? "not set"} -> ${patch.monthly_payment_estimate ?? "not set"}`);
  }
  if (String(current.description || "") !== String(patch.description || "")) changes.push("description updated");
  if (JSON.stringify(current.public_options || {}) !== JSON.stringify(patch.public_options || {})) changes.push("public listing options updated");
  if (Array.isArray(body.selectedPhotoUrls)) changes.push(`public photos selected (${body.selectedPhotoUrls.length})`);
  if (!changes.length) return "";
  return `Inventory updated: ${changes.join("; ")}.`;
}

function buildListingFromLead(lead, body, user) {
  const input = lead.input || {};
  const valuation = lead.valuation || {};
  const adjustment = lead.owner_adjustment || {};
  const status = normalizeListingStatus(body.status || "published");
  const askingPrice = firstNumber(
    body.askingPrice,
    adjustment.retail,
    marketAverage(valuation, "retail"),
    marketAverage(valuation, "wholesale")
  ) || 0;
  const title = String(body.title || valuation.title || [input.year, input.make, input.model, input.series, input.style].filter(Boolean).join(" ")).trim();

  return {
    source_lead_id: lead.id,
    status,
    title,
    vin: String(input.vin || valuation.vin || "").trim(),
    uvc: String(input.uvc || "").trim(),
    vehicle_year: numberOrNull(input.year),
    make: String(input.make || "").trim(),
    model: String(input.model || "").trim(),
    series: String(input.series || "").trim(),
    style: String(input.style || "").trim(),
    kilometers: numberOrNull(input.kilometers),
    color: String(input.color || "").trim(),
    region: String(input.region || valuation.region || "").trim(),
    asking_price: askingPrice,
    monthly_payment_estimate: numberOrNull(body.monthlyPaymentEstimate),
    description: String(body.description || lead.notes || "").trim(),
    public_options: buildListingPublicOptions(body),
    published_at: status === "published" ? new Date().toISOString() : null,
    created_by: String(user?.email || "").trim(),
    updated_at: new Date().toISOString()
  };
}

function buildListingPublicOptions(body) {
  return {
    showVin: body.showVin === "on" || body.showVin === true,
    showUvc: body.showUvc === "on" || body.showUvc === true,
    showKilometers: body.showKilometers === "on" || body.showKilometers === true,
    showRegion: body.showRegion === "on" || body.showRegion === true,
    showColor: body.showColor === "on" || body.showColor === true,
    showMaintenance: body.showMaintenance === "on" || body.showMaintenance === true,
    showPhotos: body.showPhotos === "on" || body.showPhotos === true
  };
}

export function publicInventoryRow(row) {
  return {
    id: row.id || "",
    sourceLeadId: row.source_lead_id || "",
    status: row.status || "",
    title: row.title || "",
    vin: row.vin || "",
    uvc: row.uvc || "",
    year: row.vehicle_year || "",
    make: row.make || "",
    model: row.model || "",
    series: row.series || "",
    style: row.style || "",
    kilometers: row.kilometers || 0,
    color: row.color || "",
    region: row.region || "",
    price: Number(row.asking_price || 0),
    monthlyPaymentEstimate: Number(row.monthly_payment_estimate || 0),
    description: row.description || "",
    publicOptions: row.public_options || {},
    publishedAt: row.published_at || row.created_at || ""
  };
}

async function attachListingPhotos(inventory, publicOnly, client) {
  if (!inventory.length) return inventory;
  const ids = inventory.map((item) => item.id).filter(Boolean);
  if (!ids.length) return inventory;
  const result = await fetchSupabaseJson(
    `${client.url}/rest/v1/listing_photos?select=*&listing_id=in.(${ids.map(encodeURIComponent).join(",")})&order=sort_order.asc,created_at.asc`,
    client.key
  );
  if (!result.ok || !Array.isArray(result.data)) return inventory;
  const photosByListing = new Map();
  for (const row of result.data) {
    const list = photosByListing.get(row.listing_id) || [];
    list.push({
      id: row.id || "",
      url: row.url || "",
      label: row.label || "",
      sortOrder: row.sort_order || 0
    });
    photosByListing.set(row.listing_id, list);
  }
  return inventory.map((item) => ({
    ...item,
    photos: (!publicOnly || isPublicOptionEnabled(item.publicOptions, "showPhotos")) ? (photosByListing.get(item.id) || []) : []
  }));
}

async function attachAvailableLeadPhotos(inventory, client) {
  const leadIds = [...new Set(inventory.map((item) => item.sourceLeadId).filter(Boolean))];
  if (!leadIds.length) return inventory;
  const photosByLead = new Map();
  await Promise.all(leadIds.map(async (leadId) => {
    photosByLead.set(leadId, await findLeadPhotoLinks(leadId, client));
  }));
  return inventory.map((item) => ({
    ...item,
    availableLeadPhotos: photosByLead.get(item.sourceLeadId) || []
  }));
}

async function attachInventoryLeadSummary(inventory, client) {
  const leadIds = [...new Set(inventory.map((item) => item.sourceLeadId).filter(Boolean))];
  if (!leadIds.length) return inventory;
  const result = await fetchSupabaseJson(
    `${client.url}/rest/v1/valuation_leads?select=id,assigned_to,status,next_follow_up_at,last_activity_at&id=in.(${leadIds.map(encodeURIComponent).join(",")})`,
    client.key
  );
  if (!result.ok || !Array.isArray(result.data)) return inventory;
  const leads = new Map(result.data.map((lead) => [String(lead.id || ""), lead]));
  return inventory.map((item) => {
    const lead = leads.get(String(item.sourceLeadId || "")) || {};
    return {
      ...item,
      assignedTo: lead.assigned_to || "",
      leadStatus: lead.status || "",
      nextFollowUpAt: lead.next_follow_up_at || "",
      lastActivityAt: lead.last_activity_at || ""
    };
  });
}

async function updateInventoryLeadAssignee(client, leadId, sourceLead, assignedToValue, user) {
  const assignedTo = String(assignedToValue || "").trim().toLowerCase();
  const previous = String(sourceLead?.assigned_to || "").trim().toLowerCase();
  if (previous === assignedTo) return { ok: true, changed: false };
  const payload = {
    assigned_to: assignedTo || null,
    last_activity_at: new Date().toISOString()
  };
  const response = await fetch(`${client.url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...serviceHeaders(client.key),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data || "Unable to update inventory rep" };
  await createLeadNote(
    client,
    leadId,
    user,
    `Inventory follow-up rep updated by ${user?.email || "admin"}: ${previous || "unassigned"} -> ${assignedTo || "unassigned"}.`
  );
  return { ok: true, changed: true };
}

async function attachLeadPhotosToListing(leadId, listingId, client) {
  if (!leadId || !listingId) return;
  const links = await findLeadPhotoLinks(leadId, client);
  if (!links.length) return;
  const existing = await fetchSupabaseJson(
    `${client.url}/rest/v1/listing_photos?select=url&listing_id=eq.${encodeURIComponent(listingId)}&limit=200`,
    client.key
  );
  if (!existing.ok) return;
  const existingUrls = new Set((existing.data || []).map((row) => String(row.url || "").trim()).filter(Boolean));
  const rows = links
    .filter((photo) => photo.url && !existingUrls.has(photo.url))
    .map((photo, index) => ({
      listing_id: listingId,
      url: photo.url,
      label: photo.label || `Vehicle photo ${index + 1}`,
      sort_order: existingUrls.size + index
    }));
  if (!rows.length) return;

  await fetch(`${client.url}/rest/v1/listing_photos`, {
    method: "POST",
    headers: {
      ...serviceHeaders(client.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(rows)
  }).catch(() => null);
}

async function syncSelectedListingPhotos(client, listingId, leadId, selectedUrls = []) {
  if (!listingId) return;
  const urls = [...new Set((selectedUrls || []).map((url) => String(url || "").trim()).filter(Boolean))];
  await fetch(`${client.url}/rest/v1/listing_photos?listing_id=eq.${encodeURIComponent(listingId)}`, {
    method: "DELETE",
    headers: serviceHeaders(client.key)
  }).catch(() => null);
  if (!urls.length || !leadId) return;

  const available = await findLeadPhotoLinks(leadId, client);
  const byUrl = new Map(available.map((photo) => [photo.url, photo]));
  const rows = urls.map((url, index) => ({
    listing_id: listingId,
    url,
    label: byUrl.get(url)?.label || `Vehicle photo ${index + 1}`,
    sort_order: index
  }));
  await fetch(`${client.url}/rest/v1/listing_photos`, {
    method: "POST",
    headers: {
      ...serviceHeaders(client.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(rows)
  }).catch(() => null);
}

async function findLeadPhotoLinks(leadId, client) {
  const result = await fetchSupabaseJson(
    `${client.url}/rest/v1/lead_notes?select=note&lead_id=eq.${encodeURIComponent(leadId)}&note_type=eq.inspection&order=created_at.desc&limit=50`,
    client.key
  );
  if (!result.ok) return [];
  const photos = [];
  const seenUrls = new Set();
  const deletedUrls = new Set();
  for (const row of result.data || []) {
    const note = String(row.note || "");
    if (note.includes("Vehicle photo deleted:")) {
      for (const line of note.split(/\r?\n/)) {
        const deletedUrl = String(line || "").trim();
        if (deletedUrl.startsWith("http")) deletedUrls.add(deletedUrl);
      }
      continue;
    }
    if (!note.includes("Vehicle photo upload:")) continue;
    for (const line of note.split(/\r?\n/)) {
      const match = line.match(/^([^:]+):\s*(https?:\/\/\S+)/);
      if (match) {
        const label = match[1].trim();
        const url = match[2].trim();
        if (!url || isDriveFolderUrl(url) || seenUrls.has(url)) continue;
        photos.push({ label, url });
        seenUrls.add(url);
      }
    }
  }
  return photos.filter((photo) => !deletedUrls.has(photo.url));
}

function isDriveFolderUrl(url) {
  return /drive\.google\.com\/(?:drive\/)?folders\//i.test(String(url || ""));
}

async function createLeadNote(client, leadId, user, note) {
  if (!leadId || !note) return;
  await fetch(`${client.url}/rest/v1/lead_notes`, {
    method: "POST",
    headers: {
      ...serviceHeaders(client.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      lead_id: leadId,
      author_email: String(user?.email || "").trim().toLowerCase(),
      note_type: "internal",
      note
    })
  }).catch(() => null);
}

async function restoreLeadFromInventory(client, leadId) {
  const previousStatus = await previousLeadStatusBeforeInventory(client, leadId);
  const status = normalizeRestoredLeadStatus(previousStatus) || "assigned";
  const response = await fetch(`${client.url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...serviceHeaders(client.key),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      status,
      last_activity_at: new Date().toISOString()
    })
  }).catch(() => null);
  if (!response) return { ok: false, status: 500, error: "Unable to restore source SELL lead." };
  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data || "Unable to restore source SELL lead." };
  if (!Array.isArray(data) || !data[0]) return { ok: false, status: 404, error: "Source SELL lead was not found, so the vehicle cannot be moved back to Up Sheets." };
  return { ok: true, status, lead: data[0] };
}

async function fetchListingById(client, listingId) {
  const result = await fetchSupabaseJson(
    `${client.url}/rest/v1/vehicle_listings?select=*&id=eq.${encodeURIComponent(listingId)}&limit=1`,
    client.key
  );
  if (!result.ok) return null;
  return result.data?.[0] || null;
}

async function fetchLeadById(client, leadId) {
  if (!leadId) return null;
  const result = await fetchSupabaseJson(
    `${client.url}/rest/v1/valuation_leads?select=*&id=eq.${encodeURIComponent(leadId)}&limit=1`,
    client.key
  );
  if (!result.ok) return null;
  return result.data?.[0] || null;
}

async function notifyBuyerLeadsForInventoryChange(client, currentListing, options = {}) {
  const previousStatus = normalizeListingStatus(currentListing?.status);
  const nextStatus = normalizeListingStatus(options.nextStatus);
  const actorEmail = String(options.actorEmail || "system").trim().toLowerCase() || "system";
  if (previousStatus === nextStatus) return;
  if (nextStatus === "sold") {
    await notifySameVehicleBuyerLeads(client, currentListing, {
      code: "vehicle_sold",
      message: `This vehicle was marked sold: ${currentListing.title || "Vehicle"}. Review or close the other related buyer leads.`,
      authorEmail: actorEmail
    });
    return;
  }
  if (previousStatus === "published" && ["draft", "review", "archived"].includes(nextStatus)) {
    await notifySameVehicleBuyerLeads(client, currentListing, {
      code: "vehicle_unlisted",
      message: `This vehicle was removed from the Buy page: ${currentListing.title || "Vehicle"}. Review related buyer leads before continuing.`,
      authorEmail: actorEmail
    });
  }
}

async function previousLeadStatusBeforeInventory(client, leadId) {
  const result = await fetchSupabaseJson(
    `${client.url}/rest/v1/lead_notes?select=note&lead_id=eq.${encodeURIComponent(leadId)}&order=created_at.desc&limit=100`,
    client.key
  );
  if (!result.ok) return "";
  for (const row of result.data || []) {
    const match = String(row.note || "").match(/Previous CRM status:\s*([a-z_]+)/i);
    if (match) return match[1].toLowerCase();
  }
  return "";
}

function normalizeRestoredLeadStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return [
    "new",
    "assigned",
    "contacted",
    "waiting_for_customer",
    "inspection_booked",
    "appointment_booked",
    "finance_sent",
    "offer_sent"
  ].includes(status) ? status : "";
}

async function fetchSupabaseJson(url, key) {
  const response = await fetch(url, { headers: serviceHeaders(key) });
  const data = await response.json().catch(() => []);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, data };
}

function isPublicOptionEnabled(options, key) {
  if (!options || !Object.keys(options).length) return true;
  return options[key] === true;
}

function marketAverage(valuation, market) {
  const marketData = valuation?.values?.[market] || {};
  return positiveNumber(marketData.adjusted?.avg) ?? positiveNumber(marketData.base?.avg) ?? "";
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function firstNumber(...values) {
  for (const value of values) {
    const number = numberOrNull(value);
    if (number !== null) return number;
  }
  return null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
