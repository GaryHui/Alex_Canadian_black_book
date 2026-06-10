export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const userId = String(req.query.userId || "").trim();
  const email = String(req.query.email || "").trim();
  const year = Number(req.query.year || new Date().getFullYear());

  if (!userId && !email) {
    return res.status(400).json({ ok: false, error: "userId or email is required" });
  }

  const usage = await getUsage({ userId, email, year });
  return res.status(usage.ok ? 200 : 500).json(usage);
}

const DEFAULT_LIMIT = Number(process.env.ANNUAL_VALUATION_LIMIT || 3);

async function getUsage({ userId, email, year }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return {
      ok: true,
      storage: "not_configured",
      year,
      used: 0,
      annualLimit: DEFAULT_LIMIT,
      remaining: DEFAULT_LIMIT
    };
  }

  const annualLimit = await getAnnualLimit({ url, key, userId, year });
  const used = await getUsedCount({ url, key, userId, email, year });

  if (annualLimit.error || used.error) {
    return { ok: false, error: annualLimit.error || used.error };
  }

  return {
    ok: true,
    storage: "supabase",
    year,
    used: used.count,
    annualLimit: annualLimit.limit,
    remaining: Math.max(0, annualLimit.limit - used.count),
    contact: process.env.OWNER_CONTACT || "Please contact the website owner for more valuations."
  };
}

async function getAnnualLimit({ url, key, userId, year }) {
  if (!userId) return { limit: DEFAULT_LIMIT };

  const response = await fetch(`${url}/rest/v1/valuation_user_limits?select=annual_limit&user_id=eq.${encodeURIComponent(userId)}&valuation_year=eq.${year}&limit=1`, {
    headers: authHeaders(key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return { error: `Unable to load valuation limit (${response.status})` };

  return { limit: Number(rows?.[0]?.annual_limit || DEFAULT_LIMIT) };
}

async function getUsedCount({ url, key, userId, email, year }) {
  const filter = userId
    ? `auth_user_id=eq.${encodeURIComponent(userId)}`
    : `auth_email=eq.${encodeURIComponent(email)}`;
  const response = await fetch(`${url}/rest/v1/valuation_leads?select=id&${filter}&valuation_year=eq.${year}`, {
    headers: authHeaders(key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return { error: `Unable to load valuation usage (${response.status})` };

  return { count: Array.isArray(rows) ? rows.length : 0 };
}

function authHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`
  };
}
