const loginButton = document.querySelector("#google-login");
const statusEl = document.querySelector("#login-status");
const turnstileWrap = document.querySelector("#login-turnstile-wrap");
const turnstileContainer = document.querySelector("#login-turnstile");
const turnstileStatus = document.querySelector("#login-turnstile-status");
let client = null;
let siteUrl = window.location.origin;
let turnstileGate = null;
const nextPath = safeNextPath(new URLSearchParams(window.location.search).get("next") || "/");

initializeLogin();

loginButton.addEventListener("click", async () => {
  if (!client) {
    statusEl.textContent = "Supabase is not configured.";
    return;
  }

  statusEl.textContent = "Redirecting to Google...";
  if (turnstileGate && !turnstileGate.canProceed()) {
    statusEl.textContent = "Complete the human verification first.";
    return;
  }
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
  turnstileGate = window.createTurnstileGate?.({
    siteKey: config.turnstileSiteKey,
    container: turnstileContainer,
    button: loginButton,
    statusEl: turnstileStatus,
    waitingText: "Complete the human verification first.",
    readyText: "Human verification passed.",
    failedText: "Human verification failed. Please try again."
  }) || null;
  if (turnstileWrap && turnstileGate?.enabled) turnstileWrap.hidden = false;
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
