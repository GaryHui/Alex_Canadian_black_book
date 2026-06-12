export async function requireAdmin(req) {
  const auth = await requireUser(req, "Admin sign-in required");
  if (!auth.ok) return auth;

  const adminEmails = configuredEmails(process.env.ADMIN_EMAILS);
  if (!adminEmails.length) {
    return { ok: false, status: 403, error: "Admin access is not configured. Set ADMIN_EMAILS on Vercel." };
  }

  if (!adminEmails.includes(auth.user.email)) {
    return { ok: false, status: 403, error: `This Google account is not an admin: ${auth.user.email || "unknown"}` };
  }

  return { ok: true, user: auth.user, role: "admin" };
}

export async function requireDealer(req) {
  const auth = await requireUser(req, "Dealer sign-in required");
  if (!auth.ok) return auth;

  const email = auth.user.email;
  if (configuredEmails(process.env.ADMIN_EMAILS).includes(email)) {
    return { ok: true, user: auth.user, role: "admin" };
  }

  if (configuredEmails(process.env.DEALER_EMAILS).includes(email)) {
    return { ok: true, user: auth.user, role: "dealer_env" };
  }

  const staff = await isDealerStaffEmail(email);
  if (staff.ok && staff.allowed) return { ok: true, user: auth.user, role: "dealer_staff" };
  if (!staff.ok && staff.error) return { ok: false, status: 500, error: staff.error };

  return { ok: false, status: 403, error: `This Google account is not approved for dealer portal: ${email || "unknown"}` };
}

export async function requireUser(req, missingMessage = "Sign-in required") {
  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, error: missingMessage };

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
  if (!response.ok) return { ok: false, status: 401, error: "Invalid or expired session" };

  return {
    ok: true,
    user: {
      id: String(user?.id || "").trim(),
      email: String(user?.email || "").trim().toLowerCase()
    }
  };
}

export function configuredEmails(value) {
  return String(value || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };
  return { ok: true, url, key };
}

export function serviceHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`
  };
}

async function isDealerStaffEmail(email) {
  const client = serviceClient();
  if (!client.ok) return { ok: true, allowed: false };

  const response = await fetch(`${client.url}/rest/v1/dealer_staff?select=email,active&email=eq.${encodeURIComponent(email)}&active=eq.true&limit=1`, {
    headers: serviceHeaders(client.key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return { ok: false, error: "Unable to verify dealer staff. Create the dealer_staff table in Supabase first." };
  return { ok: true, allowed: Array.isArray(rows) && rows.length > 0 };
}

function bearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}
