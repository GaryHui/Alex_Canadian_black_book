import { requireAdmin } from "./_admin.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const admin = await requireAdmin(req);
    if (!admin.ok) return res.status(admin.status).json({ ok: false, error: admin.error });
    const result = await listUserLimits(Number(req.query.year || new Date().getFullYear()));
    return res.status(result.ok ? 200 : 500).json(result);
  }

  if (req.method === "PATCH") {
    const admin = await requireAdmin(req);
    if (!admin.ok) return res.status(admin.status).json({ ok: false, error: admin.error });
    const result = await updateUserLimit(req.body || {});
    return res.status(result.ok ? 200 : 400).json(result);
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

const DEFAULT_LIMIT = Number(process.env.ANNUAL_VALUATION_LIMIT || 3);

async function listUserLimits(year) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: true, storage: "not_configured", users: [] };

  const [leadsResult, limitsResult] = await Promise.all([
    fetchJson(`${url}/rest/v1/valuation_leads?select=auth_user_id,auth_email&valuation_year=eq.${year}`, key),
    fetchJson(`${url}/rest/v1/valuation_user_limits?select=*&valuation_year=eq.${year}`, key)
  ]);

  if (!leadsResult.ok) return leadsResult;
  if (!limitsResult.ok) return limitsResult;

  const limitsByUser = new Map((limitsResult.data || []).map((limit) => [limit.user_id, limit]));
  const usersById = new Map();

  for (const lead of leadsResult.data || []) {
    const userId = lead.auth_user_id || lead.auth_email;
    if (!userId) continue;
    const current = usersById.get(userId) || {
      userId,
      email: lead.auth_email || "",
      used: 0
    };
    current.used += 1;
    if (!current.email && lead.auth_email) current.email = lead.auth_email;
    usersById.set(userId, current);
  }

  for (const limit of limitsResult.data || []) {
    const userId = limit.user_id;
    if (!userId) continue;
    const current = usersById.get(userId) || {
      userId,
      email: limit.email || "",
      used: 0
    };
    current.email = current.email || limit.email || "";
    usersById.set(userId, current);
  }

  const users = [...usersById.values()]
    .map((user) => {
      const limit = limitsByUser.get(user.userId);
      const annualLimit = Number(limit?.annual_limit || DEFAULT_LIMIT);
      return {
        ...user,
        year,
        annualLimit,
        remaining: Math.max(0, annualLimit - user.used)
      };
    })
    .sort((a, b) => (a.email || a.userId).localeCompare(b.email || b.userId));

  return { ok: true, storage: "supabase", year, users };
}

async function updateUserLimit(body) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, error: "Supabase is not configured" };

  const userId = String(body.userId || "").trim();
  const email = String(body.email || "").trim();
  const year = Number(body.year || new Date().getFullYear());
  const annualLimit = Number(body.annualLimit);

  if (!userId) return { ok: false, error: "User id is required" };
  if (!Number.isInteger(annualLimit) || annualLimit < 0) return { ok: false, error: "Annual limit must be 0 or more" };

  const response = await fetch(`${url}/rest/v1/valuation_user_limits?on_conflict=user_id,valuation_year`, {
    method: "POST",
    headers: {
      ...authHeaders(key),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify({
      user_id: userId,
      email,
      valuation_year: year,
      annual_limit: annualLimit,
      updated_at: new Date().toISOString()
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, limit: data?.[0] || null };
}

async function fetchJson(url, key) {
  const response = await fetch(url, { headers: authHeaders(key) });
  const data = await response.json().catch(() => []);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, data };
}

function authHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`
  };
}
