export default async function handler(req, res) {
  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

  if (req.method === "GET") {
    const result = await listMyLeads(auth.user);
    return res.status(result.ok ? 200 : 500).json(result);
  }

  if (req.method === "DELETE") {
    const result = await deleteMyLead(auth.user, req.query?.id || "");
    return res.status(result.ok ? 200 : result.status || 400).json(result);
  }

  res.setHeader("Allow", "GET, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

async function requireUser(req) {
  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, error: "Sign-in required" };

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { ok: false, status: 500, error: "Supabase auth is not configured" };

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`
    }
  });

  const user = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: 401, error: "Invalid or expired session" };

  return {
    ok: true,
    user: {
      id: String(user?.id || "").trim(),
      email: String(user?.email || "").trim().toLowerCase()
    }
  };
}

async function listMyLeads(user) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: true, storage: "not_configured", leads: [] };

  const requests = [];
  if (user.id) {
    requests.push(fetchSupabaseJson(`${url}/rest/v1/valuation_leads?select=*&auth_user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc&limit=50`, key));
  }
  if (user.email) {
    requests.push(fetchSupabaseJson(`${url}/rest/v1/valuation_leads?select=*&auth_email=eq.${encodeURIComponent(user.email)}&order=created_at.desc&limit=50`, key));
  }

  const results = await Promise.all(requests);
  const failed = results.find((result) => !result.ok);
  if (failed) return failed;

  const rowsById = new Map();
  for (const result of results) {
    for (const row of result.data || []) {
      rowsById.set(row.id || `${row.created_at}-${row.auth_email}`, row);
    }
  }

  const leads = [...rowsById.values()]
    .filter((lead) => String(lead.status || "").toLowerCase() !== "deleted")
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 50);

  return { ok: true, storage: "supabase", leads };
}

async function deleteMyLead(user, id) {
  const leadId = String(id || "").trim();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!leadId) return { ok: false, status: 400, error: "Lead id is required" };
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const lookup = await fetch(`${url}/rest/v1/valuation_leads?select=id,auth_user_id,auth_email,status&id=eq.${encodeURIComponent(leadId)}&limit=1`, {
    headers: supabaseServiceHeaders(key)
  });
  const rows = await lookup.json().catch(() => []);
  if (!lookup.ok) return { ok: false, status: lookup.status, error: rows };

  const lead = rows?.[0];
  if (!lead) return { ok: false, status: 404, error: "Quote not found" };

  const leadUserId = String(lead.auth_user_id || "").trim();
  const leadEmail = String(lead.auth_email || "").trim().toLowerCase();
  const userId = String(user.id || "").trim();
  const email = String(user.email || "").trim().toLowerCase();
  const ownsLead = (leadUserId && leadUserId === userId) || (leadEmail && leadEmail === email);
  if (!ownsLead) return { ok: false, status: 403, error: "You can only delete your own quote history" };

  const response = await fetch(`${url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...supabaseServiceHeaders(key),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      status: "deleted",
      notes: "Deleted by customer from quote history. This does not restore valuation allowance."
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, lead: data?.[0] || null };
}

async function fetchSupabaseJson(url, key) {
  const response = await fetch(url, {
    headers: supabaseServiceHeaders(key)
  });
  const data = await response.json().catch(() => []);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, data };
}

function supabaseServiceHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`
  };
}

function bearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}
