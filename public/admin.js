const statusEl = document.querySelector("#admin-status");
const leadsEl = document.querySelector("#admin-leads");
const usersStatusEl = document.querySelector("#users-status");
const usersEl = document.querySelector("#admin-users");
const reloadUsersButton = document.querySelector("#reload-users");
const adminAuthStatus = document.querySelector("#admin-auth-status");
const adminLoginButton = document.querySelector("#admin-login");
const adminLogoutButton = document.querySelector("#admin-logout");
const adminContent = document.querySelector("#admin-content");

let supabaseClient = null;
let adminSession = null;

reloadUsersButton.addEventListener("click", loadUsers);
adminLoginButton.addEventListener("click", signInAdmin);
adminLogoutButton.addEventListener("click", signOutAdmin);

initializeAdminAuth();

async function initializeAdminAuth() {
  const config = await fetch("/api/config").then((res) => res.json()).catch(() => ({}));
  if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) {
    adminAuthStatus.textContent = "Supabase login is not configured.";
    adminLoginButton.hidden = true;
    adminContent.hidden = true;
    return;
  }

  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
      persistSession: true
    }
  });

  const { data } = await supabaseClient.auth.getSession();
  if (window.location.hash.includes("access_token") || window.location.search.includes("code=")) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  await setAdminSession(data.session);
  supabaseClient.auth.onAuthStateChange((_event, session) => setAdminSession(session));
}

async function signInAdmin() {
  if (!supabaseClient) return;
  const redirectTo = `${window.location.origin}/admin.html`;
  await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo }
  });
}

async function signOutAdmin() {
  if (supabaseClient) await supabaseClient.auth.signOut();
  await setAdminSession(null);
}

async function setAdminSession(session) {
  adminSession = session;
  adminLoginButton.hidden = !!session?.user;
  adminLogoutButton.hidden = !session?.user;
  adminContent.hidden = !session?.user;

  if (!session?.user) {
    adminAuthStatus.textContent = "Admin Google sign-in required.";
    statusEl.textContent = "";
    usersStatusEl.textContent = "";
    leadsEl.innerHTML = "";
    usersEl.innerHTML = "";
    return;
  }

  adminAuthStatus.textContent = `Signed in as ${session.user.email}`;
  await Promise.all([loadLeads(), loadUsers()]);
}

async function loadUsers() {
  if (!adminSession) return;
  const response = await fetch("/api/user-limits", { headers: authHeaders() });
  const data = await response.json();

  if (!data.ok) {
    usersStatusEl.textContent = data.error || "Unable to load users.";
    return;
  }

  if (data.storage === "not_configured") {
    usersStatusEl.textContent = "Supabase is not configured, so user limits cannot be managed yet.";
    usersEl.innerHTML = "";
    return;
  }

  usersStatusEl.textContent = `${data.users.length} user(s) with valuation activity in ${data.year}.`;
  usersEl.innerHTML = data.users.map(renderUser).join("") || "<p>No user activity yet.</p>";
}

function renderUser(user) {
  return `
    <form class="user-limit-card" data-user-id="${escapeHtml(user.userId)}" data-email="${escapeHtml(user.email || "")}" data-year="${user.year}">
      <div>
        <strong>${escapeHtml(user.email || user.userId)}</strong>
        <span>${escapeHtml(user.userId)}</span>
      </div>
      <div>
        <span>Used</span>
        <b>${formatNumber(user.used)}</b>
      </div>
      <div>
        <span>Remaining</span>
        <b>${formatNumber(user.remaining)}</b>
      </div>
      <label>
        <span>Annual limit</span>
        <input name="annualLimit" type="number" min="0" step="1" value="${user.annualLimit}" />
      </label>
      <button type="submit">Save limit</button>
    </form>
  `;
}

async function loadLeads() {
  if (!adminSession) return;
  const response = await fetch("/api/leads", { headers: authHeaders() });
  const data = await response.json();

  if (!data.ok) {
    statusEl.textContent = data.error || "Unable to load leads.";
    return;
  }

  if (data.storage === "not_configured") {
    statusEl.textContent = "Lead storage is not configured on this deployment. Add Supabase env vars to persist leads.";
  } else {
    statusEl.textContent = `${data.leads.length} lead(s) captured.`;
  }

  leadsEl.innerHTML = data.leads.map(renderLead).join("") || "<p>No leads yet.</p>";
}

function renderLead(lead) {
  const input = lead.input || {};
  const authUser = lead.auth_user || {};
  const valuation = lead.valuation || {};
  const adjustment = lead.owner_adjustment || {};
  const wholesale = valuation.values?.wholesale?.adjusted?.avg;
  const retail = valuation.values?.retail?.adjusted?.avg;
  return `
    <article class="lead-card" data-id="${escapeHtml(lead.id || "")}">
      <header>
        <strong>${escapeHtml(valuation.title || "Vehicle lead")}</strong>
        <span>${escapeHtml(lead.created_at || "")}</span>
      </header>
      <div class="lead-grid">
        <span>Email</span><b>${escapeHtml(input.email || "-")}</b>
        <span>Google user</span><b>${escapeHtml(authUser.email || "-")}</b>
        <span>Phone</span><b>${escapeHtml(input.phone || "-")}</b>
        <span>VIN</span><b>${escapeHtml(input.vin || valuation.vin || "-")}</b>
        <span>UVC</span><b>${escapeHtml(input.uvc || "-")}</b>
        <span>Vehicle</span><b>${escapeHtml([input.year, input.make, input.model, input.series, input.style].filter(Boolean).join(" ") || "-")}</b>
        <span>Kilometers</span><b>${formatNumber(input.kilometers || 0)}</b>
        <span>Color</span><b>${escapeHtml(input.color || "-")}</b>
        <span>Region</span><b>${escapeHtml(input.region || valuation.region || "-")}</b>
        <span>AVG Wholesale</span><b>${wholesale ? formatNumber(wholesale) : "-"}</b>
        <span>AVG Retail</span><b>${retail ? formatNumber(retail) : "-"}</b>
      </div>
      <form class="owner-review">
        <label>
          <span>Status</span>
          <select name="status">
            ${["new", "reviewing", "manual_adjustment", "contacted", "sent_to_crm", "closed"].map((status) =>
              `<option value="${status}" ${lead.status === status ? "selected" : ""}>${status}</option>`
            ).join("")}
          </select>
        </label>
        <label>
          <span>Owner wholesale</span>
          <input name="ownerWholesale" type="number" value="${adjustment.wholesale ?? ""}" placeholder="Manual wholesale" />
        </label>
        <label>
          <span>Owner retail</span>
          <input name="ownerRetail" type="number" value="${adjustment.retail ?? ""}" placeholder="Manual retail" />
        </label>
        <label>
          <span>Reason</span>
          <input name="reason" value="${escapeHtml(adjustment.reason || "")}" placeholder="Why adjust this value?" />
        </label>
        <label class="review-notes">
          <span>Admin notes</span>
          <textarea name="notes" placeholder="Follow-up notes, CRM notes, customer preference...">${escapeHtml(lead.notes || "")}</textarea>
        </label>
        <button type="submit">Save owner review</button>
      </form>
      <details>
        <summary>Raw valuation summary</summary>
        <pre>${escapeHtml(JSON.stringify(valuation, null, 2))}</pre>
      </details>
    </article>
  `;
}

leadsEl.addEventListener("submit", async (event) => {
  const form = event.target.closest(".owner-review");
  if (!form) return;
  event.preventDefault();

  const card = form.closest(".lead-card");
  const payload = {
    id: card.dataset.id,
    ...Object.fromEntries(new FormData(form).entries())
  };
  const response = await fetch("/api/leads", {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  statusEl.textContent = data.ok ? "Owner review saved." : (data.error || "Unable to save owner review.");
});

usersEl.addEventListener("submit", async (event) => {
  const form = event.target.closest(".user-limit-card");
  if (!form) return;
  event.preventDefault();

  const payload = {
    userId: form.dataset.userId,
    email: form.dataset.email,
    year: Number(form.dataset.year),
    ...Object.fromEntries(new FormData(form).entries())
  };
  const response = await fetch("/api/user-limits", {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  usersStatusEl.textContent = data.ok ? "User valuation limit saved." : (data.error || "Unable to save user limit.");
  if (data.ok) await loadUsers();
});

function formatNumber(value) {
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(Number(value));
}

function authHeaders() {
  return {
    Authorization: `Bearer ${adminSession?.access_token || ""}`
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}
