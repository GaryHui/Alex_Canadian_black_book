export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const forwardedHost = req.headers["x-forwarded-host"];
  const forwardedProto = req.headers["x-forwarded-proto"] || "https";
  const host = forwardedHost || req.headers.host || "blackbook-demo.vercel.app";
  const origin = `${forwardedProto}://${host}`;

  return res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    siteUrl: process.env.PUBLIC_SITE_URL || origin,
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || ""
  });
}
