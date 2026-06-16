export function isBuyerLead(lead) {
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  return input.leadType === "buyer_inquiry" || valuation.source === "buyer_inquiry";
}

export function isClosedLeadStatus(status) {
  return ["won", "lost", "closed", "deleted", "in_inventory"].includes(String(status || "").trim().toLowerCase());
}

export function leadVehicleKeys(lead) {
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  return vehicleKeysFromFields({
    vin: input.vin || valuation.vin,
    uvc: input.uvc || valuation.uvc,
    year: input.year || valuation.year,
    make: input.make || valuation.make,
    model: input.model || valuation.model,
    series: input.series || valuation.series,
    style: input.style || valuation.style
  });
}

export function listingVehicleKeys(listing) {
  return vehicleKeysFromFields({
    vin: listing?.vin,
    uvc: listing?.uvc,
    year: listing?.vehicle_year || listing?.year,
    make: listing?.make,
    model: listing?.model,
    series: listing?.series,
    style: listing?.style
  });
}

export function leadDisplayTitle(lead) {
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  const raw = String(valuation.title || [input.year, input.make, input.model, input.series, input.style].filter(Boolean).join(" ") || "Vehicle lead").trim();
  return isBuyerLead(lead) ? raw.replace(/^Buyer inquiry\s*-\s*/i, "") : raw;
}

export async function attachLeadSignals(leads, client) {
  if (!Array.isArray(leads) || !leads.length || !client?.url || !client?.key) return Array.isArray(leads) ? leads : [];
  const ids = leads.map((lead) => String(lead.id || "").trim()).filter(Boolean);
  if (!ids.length) return leads;

  const [signalNotes, inventoryRows, allLeads] = await Promise.all([
    fetchLeadSignalNotes(ids, client),
    fetchVehicleListings(client),
    fetchAllLeads(client)
  ]);

  const duplicateMap = buildDuplicateWarningMap(leads, allLeads, inventoryRows, signalNotes);
  const vehicleContextMap = buildVehicleContextMap(leads, allLeads, inventoryRows);
  const signalMap = latestSignalByLead(signalNotes);
  return leads.map((lead) => ({
    ...lead,
    vehicle_signal: signalMap.get(String(lead.id || "")) || null,
    duplicate_warning: duplicateMap.get(String(lead.id || "")) || null,
    vehicle_context: vehicleContextMap.get(String(lead.id || "")) || null
  }));
}

export async function notifySameVehicleBuyerLeads(client, reference, options = {}) {
  if (!client?.url || !client?.key) return { ok: false, count: 0 };
  const leads = await fetchAllLeads(client);
  if (!leads.length) return { ok: true, count: 0 };
  const referenceKeys = vehicleKeysForRecord(reference);
  if (!referenceKeys.length) return { ok: true, count: 0 };

  const excludeId = String(options.excludeLeadId || reference?.id || "").trim();
  const targetLeadIds = leads
    .filter((lead) => {
      const id = String(lead.id || "").trim();
      if (!id || id === excludeId) return false;
      if (!isBuyerLead(lead) || isClosedLeadStatus(lead.status)) return false;
      return sharesVehicle(referenceKeys, leadVehicleKeys(lead));
    })
    .map((lead) => String(lead.id || "").trim());

  if (!targetLeadIds.length) return { ok: true, count: 0 };
  await createVehicleSignalNotes(client, targetLeadIds, options);
  return { ok: true, count: targetLeadIds.length };
}

export async function notifyDuplicateSellerLead(client, lead) {
  if (!client?.url || !client?.key || !lead?.id || isBuyerLead(lead)) return { ok: true, count: 0 };
  const duplicate = await evaluateDuplicateSellerLead(client, lead);
  if (!duplicate) return { ok: true, count: 0 };
  await createOwnerReviewNote(client, String(lead.id || ""), duplicate.message, "system");
  await createVehicleSignalNotes(client, [String(lead.id || "")], {
    code: "duplicate_vehicle",
    message: duplicate.message
  });
  return { ok: true, count: duplicate.count || 0 };
}

export async function evaluateDuplicateSellerLead(client, lead) {
  if (!client?.url || !client?.key || !lead?.id || isBuyerLead(lead)) return null;
  const [allLeads, inventoryRows, notes] = await Promise.all([
    fetchAllLeads(client),
    fetchVehicleListings(client),
    fetchLeadSignalNotes([String(lead.id || "")], client)
  ]);
  return duplicateWarningForLead(lead, allLeads, inventoryRows, notes);
}

export async function reviewDuplicateSellerLead(client, leadId, decision, authorEmail) {
  const id = String(leadId || "").trim();
  const choice = duplicateDecision(decision);
  if (!client?.url || !client?.key || !id) return { ok: false, error: "Lead id is required" };
  const author = String(authorEmail || "system").trim().toLowerCase() || "system";
  const message = duplicateDecisionMessage(choice);
  await insertLeadNote(client, {
    lead_id: id,
    author_email: author,
    note_type: "internal",
    note: `[Vehicle review:duplicate_reviewed:${choice}] ${message}`
  });
  await insertLeadNote(client, {
    lead_id: id,
    author_email: author,
    note_type: "owner_read",
    note: `Duplicate vehicle review completed: ${message}`
  });
  await touchLeadIds(client, [id]);
  return { ok: true, decision: choice };
}

export async function createVehicleSignalNotes(client, leadIds, options = {}) {
  const ids = [...new Set((Array.isArray(leadIds) ? leadIds : []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!client?.url || !client?.key || !ids.length) return;

  const code = signalCode(options.code);
  const message = String(options.message || "").trim();
  if (!message) return;

  await Promise.all(ids.map((leadId) => insertLeadNote(client, {
    lead_id: leadId,
    author_email: String(options.authorEmail || "system").trim().toLowerCase() || "system",
    note_type: "internal",
    note: `[Vehicle signal:${code}] ${message}`
  })));
  await touchLeadIds(client, ids);
}

async function fetchLeadSignalNotes(ids, client) {
  const encoded = ids.map(encodeURIComponent).join(",");
  const response = await fetch(`${client.url}/rest/v1/lead_notes?select=lead_id,created_at,author_email,note,note_type&lead_id=in.(${encoded})&order=created_at.desc&limit=500`, {
    headers: authHeaders(client.key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return [];
  return Array.isArray(rows) ? rows : [];
}

async function fetchAllLeads(client) {
  const response = await fetch(`${client.url}/rest/v1/valuation_leads?select=*&order=created_at.desc&limit=200`, {
    headers: authHeaders(client.key)
  });
  const rows = await response.json().catch(() => []);
  return response.ok && Array.isArray(rows) ? rows : [];
}

async function fetchVehicleListings(client) {
  const response = await fetch(`${client.url}/rest/v1/vehicle_listings?select=id,source_lead_id,status,title,vin,uvc,vehicle_year,make,model,series,style,updated_at,created_at&order=updated_at.desc.nullslast,created_at.desc&limit=200`, {
    headers: authHeaders(client.key)
  });
  const rows = await response.json().catch(() => []);
  return response.ok && Array.isArray(rows) ? rows : [];
}

function buildDuplicateWarningMap(leads, allLeads, inventoryRows, notes) {
  const map = new Map();
  for (const lead of leads) {
    const warning = duplicateWarningForLead(lead, allLeads, inventoryRows, notes);
    if (warning) map.set(String(lead.id || "").trim(), warning);
  }
  return map;
}

function duplicateWarningForLead(lead, leads, inventoryRows, notes) {
  const id = String(lead?.id || "").trim();
  if (!id || isBuyerLead(lead)) return null;
  const matches = duplicateMatchesForLead(lead, leads, inventoryRows).slice(0, 4);
  if (!matches.length) return null;
  const review = latestDuplicateReviewByLead(notes).get(id) || null;
  return {
    count: matches.length,
    items: matches,
    reviewed: Boolean(review),
    reviewed_at: review?.created_at || "",
    reviewed_by: review?.author_email || "",
    decision: review?.decision || "",
    message: matches.some((item) => item.kind === "inventory")
      ? "Possible duplicate seller vehicle already exists in CRM / Warehouse."
      : "Possible duplicate seller vehicle already exists in CRM."
  };
}

function duplicateMatchesForLead(lead, leads, inventoryRows) {
  const sourceId = String(lead?.id || "").trim();
  const keys = leadVehicleKeys(lead);
  if (!keys.length) return [];

  const leadMatches = (Array.isArray(leads) ? leads : [])
    .filter((item) => {
      const id = String(item?.id || "").trim();
      return id && id !== sourceId && !isBuyerLead(item) && sharesVehicle(keys, leadVehicleKeys(item));
    })
    .map((item) => ({
      kind: "lead",
      id: String(item.id || ""),
      title: leadDisplayTitle(item),
      status: String(item.status || "new").replaceAll("_", " "),
      createdAt: item.created_at || ""
    }));

  const inventoryMatches = (Array.isArray(inventoryRows) ? inventoryRows : [])
    .filter((item) => String(item?.source_lead_id || "").trim() !== sourceId && sharesVehicle(keys, listingVehicleKeys(item)))
    .map((item) => ({
      kind: "inventory",
      id: String(item.id || ""),
      title: String(item.title || [item.vehicle_year, item.make, item.model, item.series, item.style].filter(Boolean).join(" ") || "Warehouse listing").trim(),
      status: String(item.status || "draft"),
      createdAt: item.updated_at || item.created_at || ""
    }));

  return [...leadMatches, ...inventoryMatches];
}

function latestSignalByLead(notes) {
  const map = new Map();
  for (const note of (Array.isArray(notes) ? notes : []).filter((row) => isVehicleSignalNote(row?.note))) {
    const leadId = String(note.lead_id || "").trim();
    if (!leadId || map.has(leadId)) continue;
    const parsed = parseVehicleSignalNote(note.note);
    if (!parsed) continue;
    map.set(leadId, {
      code: parsed.code,
      message: parsed.message,
      at: note.created_at || "",
      by: note.author_email || "system",
      tone: signalTone(parsed.code)
    });
  }
  return map;
}

function latestDuplicateReviewByLead(notes) {
  const map = new Map();
  for (const note of Array.isArray(notes) ? notes : []) {
    const leadId = String(note?.lead_id || "").trim();
    const parsed = parseDuplicateReviewNote(note?.note);
    if (!leadId || !parsed) continue;
    if (map.has(leadId)) continue;
    map.set(leadId, {
      created_at: note.created_at || "",
      author_email: note.author_email || "",
      decision: parsed.decision,
      message: parsed.message
    });
  }
  return map;
}

function parseVehicleSignalNote(note) {
  const match = String(note || "").match(/^\[Vehicle signal:([a-z_]+)\]\s*(.+)$/i);
  if (!match) return null;
  return {
    code: signalCode(match[1]),
    message: String(match[2] || "").trim()
  };
}

function parseDuplicateReviewNote(note) {
  const match = String(note || "").match(/^\[Vehicle review:duplicate_reviewed:([a-z_]+)\]\s*(.+)$/i);
  if (!match) return null;
  return {
    decision: duplicateDecision(match[1]),
    message: String(match[2] || "").trim()
  };
}

function isVehicleSignalNote(note) {
  return /^\[Vehicle signal:[a-z_]+\]/i.test(String(note || ""));
}

function signalCode(value) {
  return String(value || "shared_update").trim().toLowerCase().replace(/[^a-z_]/g, "") || "shared_update";
}

function signalTone(code) {
  if (["vehicle_sold", "duplicate_vehicle"].includes(code)) return "danger";
  if (["vehicle_unlisted", "shared_offer"].includes(code)) return "warning";
  return "info";
}

function buildVehicleContextMap(leads, allLeads, inventoryRows) {
  const map = new Map();
  for (const lead of Array.isArray(leads) ? leads : []) {
    const id = String(lead?.id || "").trim();
    if (!id) continue;
    const keys = leadVehicleKeys(lead);
    if (!keys.length) continue;
    const relatedLeads = (Array.isArray(allLeads) ? allLeads : [])
      .filter((item) => {
        const itemId = String(item?.id || "").trim();
        return itemId && itemId !== id && sharesVehicle(keys, leadVehicleKeys(item));
      });
    const relatedBuyerLeads = relatedLeads.filter(isBuyerLead);
    const activeBuyerLeads = relatedBuyerLeads.filter((item) => !isClosedLeadStatus(item.status));
    const sellerDuplicates = relatedLeads.filter((item) => !isBuyerLead(item));
    const matchingInventory = (Array.isArray(inventoryRows) ? inventoryRows : [])
      .filter((item) => sharesVehicle(keys, listingVehicleKeys(item)));
    const activeOffer = activeBuyerLeads.some((item) => ["finance_sent", "appointment_booked", "offer_sent"].includes(String(item.status || "").toLowerCase()));
    const soldState = activeBuyerLeads.some((item) => String(item.status || "").toLowerCase() === "won")
      || matchingInventory.some((item) => String(item.status || "").toLowerCase() === "sold");
    const offMarket = matchingInventory.length > 0 && matchingInventory.every((item) => ["archived", "draft", "review"].includes(String(item.status || "").toLowerCase()));
    map.set(id, {
      related_lead_count: relatedLeads.length,
      related_buyer_count: relatedBuyerLeads.length,
      active_buyer_count: activeBuyerLeads.length,
      seller_duplicate_count: sellerDuplicates.length,
      inventory_count: matchingInventory.length,
      inventory_statuses: [...new Set(matchingInventory.map((item) => String(item.status || "").toLowerCase()).filter(Boolean))],
      has_active_offer: activeOffer,
      sold_elsewhere: soldState,
      off_market: offMarket,
      primary_inventory_status: matchingInventory[0]?.status || "",
      cluster_label: vehicleClusterLabel(lead)
    });
  }
  return map;
}

function vehicleKeysForRecord(record) {
  if (record?.input || record?.valuation) return leadVehicleKeys(record);
  return listingVehicleKeys(record);
}

function sharesVehicle(leftKeys, rightKeys) {
  const right = new Set(rightKeys || []);
  return Array.isArray(leftKeys) && leftKeys.some((key) => right.has(key));
}

function vehicleKeysFromFields(fields) {
  const vin = cleanVin(fields?.vin);
  const uvc = normalizeVehicleText(fields?.uvc);
  const year = normalizeVehicleText(fields?.year);
  const make = normalizeVehicleText(fields?.make);
  const model = normalizeVehicleText(fields?.model);
  const series = normalizeVehicleText(fields?.series);
  const style = normalizeVehicleText(fields?.style);
  const keys = [];
  if (vin) keys.push(`vin:${vin}`);
  if (uvc) keys.push(`uvc:${uvc}`);
  if (year && make && model) keys.push(`spec:${[year, make, model, series, style].join("|")}`);
  return [...new Set(keys)];
}

function vehicleClusterLabel(lead) {
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  return String([input.year || valuation.year, input.make || valuation.make, input.model || valuation.model].filter(Boolean).join(" ") || leadDisplayTitle(lead)).trim();
}

function normalizeVehicleText(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function cleanVin(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function createOwnerReviewNote(client, leadId, reason, authorEmail) {
  if (!leadId || !reason) return;
  await insertLeadNote(client, {
    lead_id: leadId,
    author_email: String(authorEmail || "system").trim().toLowerCase(),
    note_type: "owner_review",
    note: String(reason || "").trim()
  });
}

async function touchLeadIds(client, ids) {
  const timestamp = new Date().toISOString();
  await Promise.all(ids.map((leadId) => fetch(`${client.url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(client.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ last_activity_at: timestamp })
  }).catch(() => null)));
}

async function insertLeadNote(client, payload) {
  await fetch(`${client.url}/rest/v1/lead_notes`, {
    method: "POST",
    headers: {
      ...authHeaders(client.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  }).catch(() => null);
}

function duplicateDecision(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["keep_separate", "merge_existing", "link_inventory"].includes(normalized) ? normalized : "keep_separate";
}

function duplicateDecisionMessage(decision) {
  if (decision === "merge_existing") return "Owner reviewed duplicate seller vehicle and will merge it into the existing CRM record.";
  if (decision === "link_inventory") return "Owner reviewed duplicate seller vehicle and linked it to the existing warehouse record.";
  return "Owner reviewed duplicate seller vehicle and chose to keep it as a separate lead.";
}

function authHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`
  };
}
