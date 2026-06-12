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
  if (!isAdmin) filters.push(`assigned_to=eq.${encodeURIComponent(email)}`);

  const response = await fetch(`${client.url}/rest/v1/valuation_leads?${filters.join("&")}`, {
    headers: serviceHeaders(client.key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return { ok: false, status: response.status, error: rows };

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
