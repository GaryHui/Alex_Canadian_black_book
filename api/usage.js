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

  const annualLimit = await getAnnualLimit({ url, key, userId, email, year });
  const used = await getUsedCount({ url, key, userId, email, year });

  if (annualLimit.error || used.error) {
    return { ok: false, error: annualLimit.error || used.error };
  }

  const unlimited = annualLimit.limit < 0;

  return {
    ok: true,
    storage: "supabase",
    year,
    used: used.count,
    annualLimit: annualLimit.limit,
    unlimited,
    remaining: unlimited ? null : Math.max(0, annualLimit.limit - used.count),
    contact: process.env.OWNER_CONTACT || "Please contact the website owner for more valuations."
  };
}

async function getAnnualLimit({ url, key, userId, email, year }) {
  const normalizedEmail = normalizeEmail(email);
  if (!userId && !normalizedEmail) return { limit: DEFAULT_LIMIT };

  const queries = [];
  if (userId) queries.push(`user_id=eq.${encodeURIComponent(userId)}`);
  if (normalizedEmail) {
    queries.push(`user_id=eq.${encodeURIComponent(normalizedEmail)}`);
    queries.push(`email=eq.${encodeURIComponent(normalizedEmail)}`);
  }

  const responses = await Promise.all(queries.map(async (filter) => {
    const response = await fetch(`${url}/rest/v1/valuation_user_limits?select=*&${filter}&valuation_year=eq.${year}&limit=10`, {
      headers: authHeaders(key)
    });
    const rows = await response.json().catch(() => []);
    if (!response.ok) return { error: `Unable to load valuation limit (${response.status})` };
    return { rows: Array.isArray(rows) ? rows : [] };
  }));

  const failed = responses.find((result) => result.error);
  if (failed) return failed;

  const rows = responses.flatMap((result) => result.rows);
  const exactUserLimit = rows.find((row) => row.user_id === userId);
  const emailLimit = rows.find((row) => {
    const rowUserId = normalizeEmail(row.user_id);
    const rowEmail = normalizeEmail(row.email);
    return rowUserId === normalizedEmail || rowEmail === normalizedEmail;
  });
  const limit = exactUserLimit || emailLimit;

  return { limit: Number(limit?.annual_limit ?? DEFAULT_LIMIT) };
}

async function getUsedCount({ url, key, userId, email, year }) {
  const normalizedEmail = normalizeEmail(email);
  const queries = [];
  if (userId) queries.push(`auth_user_id=eq.${encodeURIComponent(userId)}`);
  if (normalizedEmail) queries.push(`auth_email=eq.${encodeURIComponent(normalizedEmail)}`);

  const responses = await Promise.all(queries.map(async (filter) => {
    const response = await fetch(`${url}/rest/v1/valuation_leads?select=id,input,valuation&${filter}&valuation_year=eq.${year}`, {
      headers: authHeaders(key)
    });
    const rows = await response.json().catch(() => []);
    if (!response.ok) return { error: `Unable to load valuation usage (${response.status})` };
    return { rows: Array.isArray(rows) ? rows : [] };
  }));

  const failed = responses.find((result) => result.error);
  if (failed) return failed;

  const rowsById = new Map();
  for (const row of responses.flatMap((result) => result.rows)) {
    if (!isChargeableUsageLead(row)) continue;
    if (row?.id) rowsById.set(row.id, row);
  }

  return { count: rowsById.size };
}

function isBuyerInquiryLead(lead) {
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  return input.leadType === "buyer_inquiry" || valuation.source === "buyer_inquiry";
}

function isChargeableUsageLead(lead) {
  if (isBuyerInquiryLead(lead)) return false;
  if (lead?.valuation?.noCharge || lead?.valuation?.chargeable === false) return false;
  return isChargeableValuation(lead?.valuation || {});
}

function isChargeableValuation(valuation) {
  return ["wholesale", "retail", "tradeIn"].some((market) => {
    const marketData = valuation?.values?.[market] || {};
    return ["adjusted", "base"].some((rowKey) =>
      Object.values(marketData[rowKey] || {}).some((value) => positiveNumber(value) !== null)
    );
  });
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function authHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`
  };
}
