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

  const [signalNotes, inventoryRows] = await Promise.all([
    fetchVehicleSignalNotes(ids, client),
    fetchVehicleListings(client)
  ]);

  const duplicateMap = buildDuplicateWarningMap(leads, inventoryRows);
  const signalMap = latestSignalByLead(signalNotes);
  return leads.map((lead) => ({
    ...lead,
    vehicle_signal: signalMap.get(String(lead.id || "")) || null,
    duplicate_warning: duplicateMap.get(String(lead.id || "")) || null
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
  const leads = await fetchAllLeads(client);
  const inventoryRows = await fetchVehicleListings(client);
  const duplicates = duplicateMatchesForLead(lead, leads, inventoryRows).slice(0, 3);
  if (!duplicates.length) return { ok: true, count: 0 };

  const message = duplicates.some((item) => item.kind === "inventory")
    ? "Possible duplicate seller vehicle. Matching CRM or Warehouse records already exist for this vehicle."
    : "Possible duplicate seller vehicle. Another SELL lead already matches this vehicle.";

  await createOwnerReviewNote(client, String(lead.id || ""), message, "system");
  await createVehicleSignalNotes(client, [String(lead.id || "")], {
    code: "duplicate_vehicle",
    message
  });
  return { ok: true, count: duplicates.length };
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

async function fetchVehicleSignalNotes(ids, client) {
  const encoded = ids.map(encodeURIComponent).join(",");
  const response = await fetch(`${client.url}/rest/v1/lead_notes?select=lead_id,created_at,author_email,note,note_type&lead_id=in.(${encoded})&order=created_at.desc&limit=500`, {
    headers: authHeaders(client.key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return [];
  return (Array.isArray(rows) ? rows : []).filter((row) => isVehicleSignalNote(row?.note));
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

function buildDuplicateWarningMap(leads, inventoryRows) {
  const map = new Map();
  for (const lead of leads) {
    const id = String(lead.id || "").trim();
    if (!id || isBuyerLead(lead)) continue;
    const matches = duplicateMatchesForLead(lead, leads, inventoryRows).slice(0, 3);
    if (!matches.length) continue;
    map.set(id, {
      count: matches.length,
      items: matches,
      message: matches.some((item) => item.kind === "inventory")
        ? "Possible duplicate seller vehicle already exists in CRM / Warehouse."
        : "Possible duplicate seller vehicle already exists in CRM."
    });
  }
  return map;
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
  for (const note of Array.isArray(notes) ? notes : []) {
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

function parseVehicleSignalNote(note) {
  const match = String(note || "").match(/^\[Vehicle signal:([a-z_]+)\]\s*(.+)$/i);
  if (!match) return null;
  return {
    code: signalCode(match[1]),
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

function authHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`
  };
}
