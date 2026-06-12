import { requireDealer, serviceClient, serviceHeaders } from "./_auth.js";

export default async function handler(req, res) {
  const dealer = await requireDealer(req);
  if (!dealer.ok) return res.status(dealer.status).json({ ok: false, error: dealer.error });

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const result = await listDealerLeads(dealer);
  return res.status(result.ok ? 200 : result.status || 500).json(result);
}

async function listDealerLeads(dealer) {
  const client = serviceClient();
  if (!client.ok) return client;

  const email = String(dealer.user?.email || "").trim().toLowerCase();
  const isAdmin = dealer.role === "admin";
  const filters = ["select=*", "order=next_follow_up_at.asc.nullslast,created_at.desc", "limit=100"];

  let rows = [];
  if (isAdmin) {
    const response = await fetch(`${client.url}/rest/v1/valuation_leads?${filters.join("&")}`, {
      headers: serviceHeaders(client.key)
    });
    rows = await response.json().catch(() => []);
    if (!response.ok) return { ok: false, status: response.status, error: rows };
  } else {
    const direct = await fetchJson(
      `${client.url}/rest/v1/valuation_leads?select=*&assigned_to=eq.${encodeURIComponent(email)}&order=next_follow_up_at.asc.nullslast,created_at.desc&limit=100`,
      client.key
    );
    if (!direct.ok) return direct;

    const taskRows = await fetchJson(
      `${client.url}/rest/v1/lead_tasks?select=lead_id&assigned_to=eq.${encodeURIComponent(email)}&limit=200`,
      client.key
    );
    if (!taskRows.ok) return taskRows;

    const taskLeadIds = [...new Set((taskRows.data || []).map((task) => String(task.lead_id || "").trim()).filter(Boolean))];
    let taskLeads = [];
    if (taskLeadIds.length) {
      const taskLeadResult = await fetchJson(
        `${client.url}/rest/v1/valuation_leads?select=*&id=in.(${taskLeadIds.map(encodeURIComponent).join(",")})&order=next_follow_up_at.asc.nullslast,created_at.desc&limit=100`,
        client.key
      );
      if (!taskLeadResult.ok) return taskLeadResult;
      taskLeads = taskLeadResult.data || [];
    }

    rows = [...new Map([...(direct.data || []), ...taskLeads].map((lead) => [lead.id, lead])).values()]
      .sort(compareDealerLeads);
  }

  const leads = (Array.isArray(rows) ? rows : [])
    .filter((lead) => String(lead.status || "").toLowerCase() !== "deleted");

  return {
    ok: true,
    storage: "supabase",
    role: dealer.role,
    email,
    leads
  };
}

async function fetchJson(url, key) {
  const response = await fetch(url, { headers: serviceHeaders(key) });
  const data = await response.json().catch(() => []);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, data };
}

function compareDealerLeads(a, b) {
  const followUpA = a.next_follow_up_at ? new Date(a.next_follow_up_at).getTime() : Number.MAX_SAFE_INTEGER;
  const followUpB = b.next_follow_up_at ? new Date(b.next_follow_up_at).getTime() : Number.MAX_SAFE_INTEGER;
  if (followUpA !== followUpB) return followUpA - followUpB;
  return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
}
