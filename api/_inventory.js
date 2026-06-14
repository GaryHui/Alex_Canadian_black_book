import { serviceClient, serviceHeaders } from "./_auth.js";

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
  return { ok: true, storage: "supabase", inventory: await attachAvailableLeadPhotos(withListingPhotos, client) };
}

export async function updateInventoryListing(body, user) {
  const client = serviceClient();
  if (!client.ok) return client;
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, status: 400, error: "Listing id is required" };

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

  const response = await fetch(`${client.url}/rest/v1/vehicle_listings?id=eq.${encodeURIComponent(listingId)}`, {
    method: "DELETE",
    headers: {
      ...serviceHeaders(client.key),
      Prefer: "return=representation"
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };

  if (listing.source_lead_id) {
    const restoredStatus = await restoreLeadFromInventory(client, listing.source_lead_id);
    await createLeadNote(
      client,
      listing.source_lead_id,
      user,
      `Inventory listing removed by ${user?.email || "admin"}. Lead restored to ${restoredStatus}. Staff can update the lead details, then an admin can publish it again.`
    );
  }

  return { ok: true, deleted: Array.isArray(data) ? data.length : 1, listing: publicInventoryRow(listing) };
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
      if (match) photos.push({ label: match[1].trim(), url: match[2].trim() });
    }
  }
  return photos.filter((photo) => !deletedUrls.has(photo.url));
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
  await fetch(`${client.url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...serviceHeaders(client.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      status,
      last_activity_at: new Date().toISOString()
    })
  }).catch(() => null);
  return status;
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
    "offer_sent",
    "won",
    "lost",
    "closed"
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
