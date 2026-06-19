import { requireAdmin } from "./_admin.js";
import { getOperationsSettings, saveOperationsSettings } from "./_operations-settings.js";

export default async function handler(req, res) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return res.status(admin.status).json({ ok: false, error: admin.error });

  const client = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY
  };

  if (req.method === "GET") {
    const result = await getOperationsSettings(client);
    return res.status(result.ok ? 200 : result.status || 500).json(result);
  }

  if (req.method === "PATCH") {
    const result = await saveOperationsSettings(client, req.body?.settings || req.body || {}, admin.user);
    return res.status(result.ok ? 200 : result.status || 400).json(result);
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
