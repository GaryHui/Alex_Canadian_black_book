import { listPublishedInventory } from "./_inventory.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const result = await listPublishedInventory();
  return res.status(result.ok ? 200 : result.status || 400).json(result);
}
