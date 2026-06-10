export default async function handler(req, res) {
  if (req.method === "PATCH") {
    const result = await updateLead(req.body || {});
    return res.status(result.ok ? 200 : 400).json(result);
  }

  if (req.method === "POST") {
    const lead = {
      created_at: new Date().toISOString(),
      input: sanitizeLeadInput(req.body?.input || {}),
      auth_user: sanitizeAuthUser(req.body?.user || {}),
      valuation: sanitizeValuation(req.body?.valuation || {}),
      auth_user_id: String(req.body?.user?.id || "").trim(),
      auth_email: String(req.body?.user?.email || req.body?.input?.email || "").trim(),
      valuation_year: new Date().getFullYear(),
      status: "new",
      notes: "",
      owner_adjustment: {}
    };

    const saved = await saveToSupabase(lead);
    if (saved.ok) return res.status(200).json(saved);

    return res.status(200).json({
      ok: true,
      captured: false,
      storage: "not_configured",
      message: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel to persist leads."
    });
  }

  if (req.method === "GET") {
    return res.status(200).json(await listFromSupabase());
  }

  res.setHeader("Allow", "GET, POST, PATCH");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

async function saveToSupabase(lead) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false };

  const result = await insertLead({ url, key, lead });
  if (result.ok) return result;

  const legacyLead = { ...lead };
  delete legacyLead.auth_user_id;
  delete legacyLead.auth_email;
  delete legacyLead.valuation_year;
  const legacyResult = await insertLead({ url, key, lead: legacyLead });
  if (legacyResult.ok) return { ...legacyResult, legacyColumns: true };

  return result;
}

async function insertLead({ url, key, lead }) {
  const response = await fetch(`${url}/rest/v1/valuation_leads`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(lead)
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, captured: true, storage: "supabase", lead: data?.[0] || null };
}

async function listFromSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: true, storage: "not_configured", leads: [] };

  const response = await fetch(`${url}/rest/v1/valuation_leads?select=*&order=created_at.desc&limit=100`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });

  const leads = await response.json().catch(() => []);
  if (!response.ok) return { ok: false, status: response.status, error: leads, leads: [] };
  return { ok: true, storage: "supabase", leads };
}

async function updateLead(body) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, error: "Lead id is required" };
  if (!url || !key) return { ok: false, error: "Supabase is not configured" };

  const patch = {
    status: String(body.status || "reviewing").trim(),
    notes: String(body.notes || "").trim(),
    owner_adjustment: {
      wholesale: numberOrNull(body.ownerWholesale),
      retail: numberOrNull(body.ownerRetail),
      reason: String(body.reason || "").trim(),
      updated_at: new Date().toISOString()
    }
  };

  const response = await fetch(`${url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(patch)
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, lead: data?.[0] || null };
}

function sanitizeLeadInput(input) {
  return {
    email: String(input.email || "").trim(),
    phone: String(input.phone || "").trim(),
    vin: cleanVin(input.vin),
    uvc: String(input.uvc || "").trim(),
    year: String(input.year || "").trim(),
    make: String(input.make || "").trim(),
    model: String(input.model || "").trim(),
    series: String(input.series || "").trim(),
    style: String(input.style || "").trim(),
    kilometers: Number(input.kilometers || input.mileage || 0),
    color: String(input.color || "").trim(),
    region: String(input.region || "").trim(),
    country: String(input.country || "").trim()
  };
}

function sanitizeAuthUser(user) {
  return {
    id: String(user.id || "").trim(),
    email: String(user.email || "").trim(),
    name: String(user.name || "").trim()
  };
}

function sanitizeValuation(valuation) {
  return {
    source: valuation.source,
    title: valuation.title,
    vin: valuation.vin,
    region: valuation.region,
    country: valuation.country,
    values: valuation.values,
    loanValue: valuation.loanValue,
    thresholds: valuation.thresholds,
    choices: valuation.choices || []
  };
}

function cleanVin(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
