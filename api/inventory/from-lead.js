import { requireAdmin } from "../_admin.js";
import { publishLeadToInventory } from "../_inventory.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const admin = await requireAdmin(req);
  if (!admin.ok) return res.status(admin.status).json({ ok: false, error: admin.error });

  const result = await publishLeadToInventory(req.body || {}, admin.user);
  return res.status(result.ok ? 200 : result.status || 400).json(result);
}
