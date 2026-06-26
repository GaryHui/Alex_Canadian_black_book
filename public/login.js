const loginButton = document.querySelector("#google-login");
const statusEl = document.querySelector("#login-status");
const loginTitle = document.querySelector("#login-title");
const loginCopy = document.querySelector("#login-copy");
const turnstileWrap = document.querySelector("#login-turnstile-wrap");
const turnstileContainer = document.querySelector("#login-turnstile");
const turnstileStatus = document.querySelector("#login-turnstile-status");
let client = null;
let siteUrl = window.location.origin;
let turnstileGate = null;
const nextPath = safeNextPath(new URLSearchParams(window.location.search).get("next") || "/");

initializeLogin();
renderLoginIntent();

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

function renderLoginIntent() {
  if (!loginTitle || !loginCopy) return;
  if (nextPath.startsWith("/admin.html")) {
    loginTitle.textContent = "Manager login";
    loginCopy.textContent = "Managers can review all Up Sheets, assign responsible reps, approve pricing, publish inventory, and manage team access.";
    return;
  }
  if (nextPath.startsWith("/dealer.html") || nextPath === "/") {
    loginTitle.textContent = "Staff login";
    loginCopy.textContent = "Staff can work assigned Up Sheets, assigned inventory follow-up, tasks, notes, and photo uploads. Manager-only decisions stay locked.";
    return;
  }
  loginTitle.textContent = "Sign in to continue";
  loginCopy.textContent = "Use Google to enter the right dealership workspace. Managers and staff are routed by approved access.";
}
