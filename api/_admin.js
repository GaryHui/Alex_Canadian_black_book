export async function requireAdmin(req) {
  const adminEmails = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.length) {
    return { ok: false, status: 403, error: "Admin access is not configured. Set ADMIN_EMAILS on Vercel." };
  }

  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, error: "Admin sign-in required" };

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { ok: false, status: 500, error: "Supabase auth is not configured" };

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`
    }
  });

  const user = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: 401, error: "Invalid or expired admin session" };

  const email = String(user?.email || "").toLowerCase();
  if (!adminEmails.includes(email)) {
    return { ok: false, status: 403, error: `This Google account is not an admin: ${email || "unknown"}` };
  }

  return { ok: true, user: { id: user.id, email } };
}

function bearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}
