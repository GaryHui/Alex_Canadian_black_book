const loginButton = document.querySelector("#google-login");
const statusEl = document.querySelector("#login-status");
let client = null;
let siteUrl = window.location.origin;
const nextPath = safeNextPath(new URLSearchParams(window.location.search).get("next") || "/");

initializeLogin();

loginButton.addEventListener("click", async () => {
  if (!client) {
    statusEl.textContent = "Supabase is not configured.";
    return;
  }

  statusEl.textContent = "Redirecting to Google...";
  await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}${nextPath}`
    }
  });
});

async function initializeLogin() {
  const config = await fetch("/api/config").then((res) => res.json()).catch(() => ({}));
  if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) {
    loginButton.disabled = true;
    statusEl.textContent = "Supabase environment variables are missing.";
    return;
  }

  siteUrl = config.siteUrl || window.location.origin;
  client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
      persistSession: true
    }
  });
  const { data } = await client.auth.getSession();
  if (data.session?.user) {
    window.location.replace(nextPath);
    return;
  }

  statusEl.textContent = "Ready.";
}

function safeNextPath(value) {
  const text = String(value || "/").trim();
  if (!text.startsWith("/") || text.startsWith("//")) return "/";
  return text;
}
