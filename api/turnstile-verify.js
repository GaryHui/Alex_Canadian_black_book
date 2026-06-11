export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const secret = process.env.TURNSTILE_SECRET_KEY || "";
  if (!secret) {
    return res.status(200).json({ ok: true, skipped: true });
  }

  const token = String(req.body?.token || "").trim();
  if (!token) {
    return res.status(400).json({ ok: false, error: "Human verification token is missing." });
  }

  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    const ip = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"];
    if (ip) form.set("remoteip", String(ip).split(",")[0].trim());

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form
    });
    const data = await response.json().catch(() => ({}));
    if (!data.success) {
      return res.status(403).json({
        ok: false,
        error: "Human verification failed.",
        codes: data["error-codes"] || []
      });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Human verification failed." });
  }
}
