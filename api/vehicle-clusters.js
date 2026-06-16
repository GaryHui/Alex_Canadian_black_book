import { requireAdmin } from "./_admin.js";
import { buildVehicleClusters } from "./_lead-signals.js";

export default async function handler(req, res) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return res.status(admin.status).json({ ok: false, error: admin.error });

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(200).json({ ok: true, storage: "not_configured", clusters: [] });

  const clusters = await buildVehicleClusters({ url, key });
  return res.status(200).json({
    ok: true,
    storage: "supabase",
    clusters,
    summary: {
      clusters: clusters.length,
      needsReview: clusters.filter((item) => Number(item.needs_review_count || 0) > 0).length
    }
  });
}
