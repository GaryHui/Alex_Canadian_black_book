import { requireDealer, serviceClient, serviceHeaders } from "./_auth.js";

export default async function handler(req, res) {
  const dealer = await requireDealer(req);
  if (!dealer.ok) return res.status(dealer.status).json({ ok: false, error: dealer.error });

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const result = await listDealerInventory(dealer);
  return res.status(result.ok ? 200 : result.status || 500).json(result);
}

async function listDealerInventory(dealer) {
  const client = serviceClient();
  if (!client.ok) return client;

  const email = String(dealer.user?.email || "").trim().toLowerCase();
  const isAdmin = dealer.role === "admin";
  const allowedLeadIds = isAdmin ? null : await assignedLeadIdsForStaff(client, email);
  if (allowedLeadIds && !allowedLeadIds.length) {
    return { ok: true, storage: "supabase", role: dealer.role, email, inventory: [] };
  }

  const query = [
    "select=*",
    "order=updated_at.desc.nullslast,created_at.desc",
    "limit=120"
  ];
  if (allowedLeadIds) query.splice(1, 0, `source_lead_id=in.(${allowedLeadIds.map(encodeURIComponent).join(",")})`);

  const listings = await fetchJson(`${client.url}/rest/v1/vehicle_listings?${query.join("&")}`, client.key);
  if (!listings.ok) return listings;

  const rows = Array.isArray(listings.data) ? listings.data : [];
  const sourceLeadIds = [...new Set(rows.map((row) => String(row.source_lead_id || "").trim()).filter(Boolean))];
  const leadMap = await fetchLeadMap(client, sourceLeadIds);
  const photoMap = await fetchPhotoMap(client, rows.map((row) => row.id).filter(Boolean));

  return {
    ok: true,
    storage: "supabase",
    role: dealer.role,
    email,
    inventory: rows.map((row) => dealerInventoryRow(row, leadMap.get(String(row.source_lead_id || "")), photoMap.get(row.id) || []))
  };
}

async function assignedLeadIdsForStaff(client, email) {
  const direct = await fetchJson(
    `${client.url}/rest/v1/valuation_leads?select=id&assigned_to=eq.${encodeURIComponent(email)}&limit=200`,
    client.key
  );
  if (!direct.ok) return [];

  const taskRows = await fetchJson(
    `${client.url}/rest/v1/lead_tasks?select=lead_id&assigned_to=eq.${encodeURIComponent(email)}&limit=200`,
    client.key
  );
  if (!taskRows.ok) return [...new Set((direct.data || []).map((lead) => String(lead.id || "").trim()).filter(Boolean))];

  return [...new Set([
    ...(direct.data || []).map((lead) => String(lead.id || "").trim()),
    ...(taskRows.data || []).map((task) => String(task.lead_id || "").trim())
  ].filter(Boolean))];
}

async function fetchLeadMap(client, ids) {
  const map = new Map();
  if (!ids.length) return map;
  const result = await fetchJson(
    `${client.url}/rest/v1/valuation_leads?select=id,auth_email,assigned_to,status,next_follow_up_at,last_activity_at,input,valuation&${`id=in.(${ids.map(encodeURIComponent).join(",")})`}`,
    client.key
  );
  if (!result.ok) return map;
  for (const lead of result.data || []) map.set(String(lead.id || ""), lead);
  return map;
}

async function fetchPhotoMap(client, listingIds) {
  const map = new Map();
  if (!listingIds.length) return map;
  const result = await fetchJson(
    `${client.url}/rest/v1/listing_photos?select=*&listing_id=in.(${listingIds.map(encodeURIComponent).join(",")})&order=sort_order.asc,created_at.asc`,
    client.key
  );
  if (!result.ok) return map;
  for (const photo of result.data || []) {
    const list = map.get(photo.listing_id) || [];
    list.push({
      id: photo.id || "",
      url: photo.url || "",
      label: photo.label || "",
      sortOrder: photo.sort_order || 0
    });
    map.set(photo.listing_id, list);
  }
  return map;
}

function dealerInventoryRow(row, lead, photos) {
  const input = lead?.input || {};
  return {
    id: row.id || "",
    sourceLeadId: row.source_lead_id || "",
    status: row.status || "draft",
    title: row.title || [row.vehicle_year, row.make, row.model, row.series, row.style].filter(Boolean).join(" "),
    vin: row.vin || "",
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
    publicOptions: row.public_options || {},
    updatedAt: row.updated_at || row.created_at || "",
    publishedAt: row.published_at || "",
    assignedTo: lead?.assigned_to || "",
    leadStatus: lead?.status || "",
    nextFollowUpAt: lead?.next_follow_up_at || "",
    lastActivityAt: lead?.last_activity_at || "",
    ownerName: input.ownerName || input.name || "",
    ownerEmail: input.ownerEmail || input.email || lead?.auth_email || "",
    ownerPhone: input.ownerPhone || input.phone || "",
    photos
  };
}

async function fetchJson(url, key) {
  const response = await fetch(url, { headers: serviceHeaders(key) });
  const data = await response.json().catch(() => []);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, data };
}
