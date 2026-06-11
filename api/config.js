export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    siteUrl: process.env.PUBLIC_SITE_URL || "https://blackbook-demo.vercel.app",
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || ""
  });
}
