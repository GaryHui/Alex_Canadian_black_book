const loginButton = document.querySelector("#google-login");
const statusEl = document.querySelector("#login-status");
let client = null;

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
      redirectTo: `${window.location.origin}/`
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

  client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data } = await client.auth.getSession();
  if (data.session?.user) {
    window.location.replace("/");
    return;
  }

  statusEl.textContent = "Ready.";
}
