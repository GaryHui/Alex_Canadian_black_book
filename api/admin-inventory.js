import { requireAdmin } from "./_admin.js";
import { deleteInventoryListing, listAdminInventory, updateInventoryListing } from "./_inventory.js";

export default async function handler(req, res) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return res.status(admin.status).json({ ok: false, error: admin.error });

  if (req.method === "GET") {
    const result = await listAdminInventory();
    return res.status(result.ok ? 200 : result.status || 400).json(result);
  }

  if (req.method === "PATCH") {
    const result = await updateInventoryListing(req.body || {}, admin.user);
    return res.status(result.ok ? 200 : result.status || 400).json(result);
  }

  if (req.method === "DELETE") {
    const result = await deleteInventoryListing(req.query?.id || "", admin.user);
    return res.status(result.ok ? 200 : result.status || 400).json(result);
  }

  res.setHeader("Allow", "GET, PATCH, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
