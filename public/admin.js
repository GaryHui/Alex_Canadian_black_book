const statusEl = document.querySelector("#admin-status");
const leadsEl = document.querySelector("#admin-leads");
const usersStatusEl = document.querySelector("#users-status");
const usersEl = document.querySelector("#admin-users");
const dealersStatusEl = document.querySelector("#dealers-status");
const dealersEl = document.querySelector("#admin-dealers");
const inventoryStatusEl = document.querySelector("#inventory-status");
const inventoryEl = document.querySelector("#admin-inventory");
const inquiriesStatusEl = document.querySelector("#inquiries-status");
const inquiriesEl = document.querySelector("#admin-inquiries");
const adminOverviewEl = document.querySelector("#admin-overview");
const adminLeadAlertsEl = document.querySelector("#admin-lead-alerts");
const adminLeadFilterButtons = [...document.querySelectorAll("[data-admin-lead-filter]")];
const dealerStaffForm = document.querySelector("#dealer-staff-form");
const reloadDealersButton = document.querySelector("#reload-dealers");
const reloadUsersButton = document.querySelector("#reload-users");
const reloadLeadsButton = document.querySelector("#reload-leads");
const reloadInventoryButton = document.querySelector("#reload-inventory");
const reloadInquiriesButton = document.querySelector("#reload-inquiries");
const clearLeadsButton = document.querySelector("#clear-leads");
const adminAuthStatus = document.querySelector("#admin-auth-status");
const adminLoginButton = document.querySelector("#admin-login");
const adminLogoutButton = document.querySelector("#admin-logout");
const adminContent = document.querySelector("#admin-content");
const adminTurnstileWrap = document.querySelector("#admin-turnstile-wrap");
const adminTurnstile = document.querySelector("#admin-turnstile");
const adminTurnstileStatus = document.querySelector("#admin-turnstile-status");
const AUTO_REFRESH_MS = 30000;

let supabaseClient = null;
let adminSession = null;
let adminTurnstileGate = null;
let clearLeadsConfirmEl = null;
let adminRefreshTimer = null;
let adminLeadsCache = [];
let adminLeadFilter = "all";
let adminLeadTokenMap = new Map();
let adminLeadAlertMap = new Map();
let adminLeadSnapshotReady = false;
let dealerStaffEmails = [];

reloadUsersButton.addEventListener("click", loadUsers);
reloadLeadsButton.addEventListener("click", () => loadLeads({ forceOpenActivity: true }));
reloadDealersButton.addEventListener("click", loadDealers);
reloadInventoryButton?.addEventListener("click", loadInventory);
reloadInquiriesButton?.addEventListener("click", loadInquiries);
clearLeadsButton?.addEventListener("click", clearAllLeads);
dealerStaffForm.addEventListener("submit", addDealer);
adminLoginButton.addEventListener("click", signInAdmin);
adminLogoutButton.addEventListener("click", signOutAdmin);
adminLeadFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    adminLeadFilter = button.dataset.adminLeadFilter || "all";
    adminLeadFilterButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderLeadWorkbench(adminLeadsCache);
  });
});
adminLeadAlertsEl?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-admin-open-alert]");
  if (!button) return;
  await openAdminLeadFromAlert(button.dataset.adminOpenAlert || "");
});

initializeAdminAuth();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && adminSession) refreshOpenAdminTasks();
});

async function initializeAdminAuth() {
  const config = await fetch("/api/config").then((res) => res.json()).catch(() => ({}));
  if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) {
    adminAuthStatus.textContent = "Supabase login is not configured.";
    adminLoginButton.hidden = true;
    adminContent.hidden = true;
    return;
  }

  adminTurnstileGate = window.createTurnstileGate?.({
    siteKey: config.turnstileSiteKey,
    wrap: adminTurnstileWrap,
    container: adminTurnstile,
    button: adminLoginButton,
    statusEl: adminTurnstileStatus,
    waitingText: "Complete the human verification first.",
    readyText: "Human verification passed.",
    failedText: "Human verification failed. Please try again.",
    lazy: true,
    onVerified: signInAdmin
  }) || null;
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
  if (adminTurnstileGate && !adminTurnstileGate.canProceed()) return;
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
  if (adminTurnstileWrap && adminTurnstileGate?.enabled) {
    if (session?.user) adminTurnstileGate.hide();
    adminTurnstileWrap.hidden = true;
  }

  if (!session?.user) {
    stopAdminAutoRefresh();
    adminAuthStatus.textContent = "Admin Google sign-in required.";
    statusEl.textContent = "";
    usersStatusEl.textContent = "";
    dealersStatusEl.textContent = "";
    inventoryStatusEl.textContent = "";
    inquiriesStatusEl.textContent = "";
    leadsEl.innerHTML = "";
    usersEl.innerHTML = "";
    dealersEl.innerHTML = "";
    inventoryEl.innerHTML = "";
    inquiriesEl.innerHTML = "";
    return;
  }

  const admin = await checkAdminAccess();
  if (!admin.ok) {
    stopAdminAutoRefresh();
    adminContent.hidden = true;
    adminAuthStatus.textContent = admin.error || `This Google account is not an admin: ${session.user.email}`;
    statusEl.textContent = "Ask the site owner to add this email to ADMIN_EMAILS in Vercel.";
    usersStatusEl.textContent = "";
    dealersStatusEl.textContent = "";
    inventoryStatusEl.textContent = "";
    inquiriesStatusEl.textContent = "";
    leadsEl.innerHTML = "";
    usersEl.innerHTML = "";
    dealersEl.innerHTML = "";
    inventoryEl.innerHTML = "";
    inquiriesEl.innerHTML = "";
    return;
  }

  adminAuthStatus.textContent = `Signed in as ${session.user.email}`;
  await Promise.all([loadLeads(), loadUsers(), loadDealers(), loadInventory()]);
  startAdminAutoRefresh();
}

async function checkAdminAccess() {
  try {
    const response = await fetch("/api/admin-check", { headers: authHeaders() });
    return response.json();
  } catch (error) {
    return { ok: false, error: error.message || "Unable to verify admin access." };
  }
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

  const warningText = data.staffFilterWarning ? ` ${data.staffFilterWarning}` : "";
  usersStatusEl.textContent = `${data.users.length} account(s) with valuation access or activity in ${data.year}.${warningText}`;
  usersEl.innerHTML = data.users.map(renderUser).join("") || "<p>No user activity yet.</p>";
}

async function loadDealers() {
  if (!adminSession) return;
  const response = await fetch("/api/dealer-staff", { headers: authHeaders() });
  const data = await response.json();

  if (!data.ok) {
    dealersStatusEl.textContent = formatApiError(data, "Unable to load dealer staff.");
    dealersEl.innerHTML = "";
    return;
  }

  if (data.storage === "not_configured") {
    dealersStatusEl.textContent = "Supabase is not configured, so dealer staff can only be managed through Vercel env vars.";
  } else {
    dealersStatusEl.textContent = `${data.staff.length} approved dealer email(s).`;
  }

  dealerStaffEmails = (data.staff || [])
    .filter((staff) => staff.active !== false)
    .map((staff) => String(staff.email || "").trim().toLowerCase())
    .filter(Boolean);
  dealersEl.innerHTML = (data.staff || []).map(renderDealer).join("") || "<p>No dealer emails yet.</p>";
  if (adminLeadsCache.length) renderLeadWorkbench(adminLeadsCache);
}

async function loadInventory() {
  if (!adminSession) return;
  inventoryStatusEl.textContent = "Loading inventory...";
  const response = await fetch("/api/admin-inventory", { headers: authHeaders() });
  const data = await response.json();

  if (!data.ok) {
    inventoryStatusEl.textContent = formatApiError(data, "Unable to load inventory.");
    inventoryEl.innerHTML = "";
    return;
  }

  if (data.storage === "not_configured") {
    inventoryStatusEl.textContent = "Supabase is not configured, so inventory cannot be managed yet.";
    inventoryEl.innerHTML = "";
    return;
  }

  inventoryStatusEl.textContent = `${data.inventory.length} inventory listing(s).`;
  inventoryEl.innerHTML = (data.inventory || []).map(renderInventoryListing).join("") || "<p>No inventory listings yet. Publish a lead from Captured leads first.</p>";
}

async function loadInquiries() {
  if (!adminSession) return;
  inquiriesStatusEl.textContent = "Loading buyer inquiries...";
  const response = await fetch("/api/buyer-inquiries", { headers: authHeaders() });
  const data = await response.json();

  if (!data.ok) {
    inquiriesStatusEl.textContent = formatApiError(data, "Unable to load buyer inquiries.");
    inquiriesEl.innerHTML = "";
    return;
  }

  if (data.storage === "not_configured") {
    inquiriesStatusEl.textContent = "Supabase is not configured, so buyer inquiries cannot be stored yet.";
    inquiriesEl.innerHTML = "";
    return;
  }

  inquiriesStatusEl.textContent = `${data.inquiries.length} buyer inquiry message(s).`;
  inquiriesEl.innerHTML = (data.inquiries || []).map(renderInquiry).join("") || "<p>No buyer inquiries yet.</p>";
}

function renderInquiry(inquiry) {
  return `
    <article class="inquiry-card">
      <div>
        <strong>${escapeHtml(inquiry.name || inquiry.email || inquiry.phone || "Buyer inquiry")}</strong>
        <span>${escapeHtml(formatDateTime(inquiry.createdAt))}</span>
      </div>
      <div class="inquiry-meta">
        <span>Email ${escapeHtml(inquiry.email || "-")}</span>
        <span>Phone ${escapeHtml(inquiry.phone || "-")}</span>
        <span>Listing ${escapeHtml(inquiry.listingId || "-")}</span>
        <b class="status-pill status-${escapeHtml(cssToken(inquiry.status || "new"))}">${escapeHtml(inquiry.status || "new")}</b>
      </div>
      <p>${escapeHtml(inquiry.message || "No message.")}</p>
    </article>
  `;
}

function renderInventoryListing(listing) {
  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  const canUnpublish = listing.status === "published";
  return `
    <form class="inventory-card-admin" data-id="${escapeHtml(listing.id || "")}">
      <div class="inventory-card-head">
        <div>
          <strong>${escapeHtml(listing.title || "Untitled vehicle")}</strong>
          <span>${escapeHtml([listing.year, listing.make, listing.model, listing.series, listing.style].filter(Boolean).join(" ") || "-")}</span>
        </div>
        <b class="status-pill status-${escapeHtml(cssToken(listing.status || "draft"))}">${escapeHtml(listing.status || "draft")}</b>
      </div>
      <div class="inventory-edit-grid">
        <label>
          <span>Title</span>
          <input name="title" value="${escapeHtml(listing.title || "")}" />
        </label>
        <label>
          <span>Asking price</span>
          <input name="askingPrice" type="number" min="0" step="1" value="${escapeHtml(listing.price || "")}" />
        </label>
        <label>
          <span>Monthly estimate</span>
          <input name="monthlyPaymentEstimate" type="number" min="0" step="1" value="${escapeHtml(listing.monthlyPaymentEstimate || "")}" />
        </label>
        <label>
          <span>Status</span>
          <select name="status">
            ${["draft", "review", "published", "sold", "archived"].map((status) =>
              `<option value="${status}" ${listing.status === status ? "selected" : ""}>${status}</option>`
            ).join("")}
          </select>
        </label>
        <label>
          <span>Kilometers</span>
          <input value="${escapeHtml(formatNumber(listing.kilometers || 0))}" disabled />
        </label>
        <label>
          <span>Region</span>
          <input value="${escapeHtml(listing.region || "-")}" disabled />
        </label>
        <label class="inventory-description">
          <span>Description</span>
          <textarea name="description">${escapeHtml(listing.description || "")}</textarea>
        </label>
        <section class="inventory-photo-summary">
          <h4>Published photos</h4>
          <p>Photos are managed in Captured leads before the vehicle is sent to inventory.</p>
          <div class="inventory-photo-list">
            ${photos.map((photo) => `<a href="${escapeHtml(photo.url)}" target="_blank" rel="noreferrer">${escapeHtml(photo.label || "Vehicle photo")}</a>`).join("") || "<span>No photos attached yet.</span>"}
          </div>
        </section>
      </div>
      <div class="inventory-actions">
        <button type="submit">Save listing</button>
        <button class="secondary-action" type="button" data-inventory-status="${escapeHtml(listing.id || "")}" data-status="draft" ${canUnpublish ? "" : "disabled"}>Unpublish</button>
        <button class="secondary-action" type="button" data-inventory-status="${escapeHtml(listing.id || "")}" data-status="sold">Mark sold</button>
        <button class="danger-outline" type="button" data-remove-inventory="${escapeHtml(listing.id || "")}">Remove from inventory</button>
      </div>
    </form>
  `;
}

function renderDealer(staff) {
  const removable = staff.source !== "vercel_env";
  return `
    <article class="user-limit-card dealer-staff-card" data-email="${escapeHtml(staff.email)}">
      <div>
        <strong>${escapeHtml(staff.email)}</strong>
        <span>${staff.source === "vercel_env" ? "Vercel DEALER_EMAILS" : "Supabase dealer_staff"}</span>
      </div>
      <div>
        <span>Status</span>
        <b>${staff.active === false ? "Inactive" : "Active"}</b>
      </div>
      <div>
        <span>Added by</span>
        <b>${escapeHtml(staff.created_by || "-")}</b>
      </div>
      <button type="button" data-remove-dealer="${escapeHtml(staff.email)}" ${removable ? "" : "disabled"}>${removable ? "Remove" : "Env locked"}</button>
    </article>
  `;
}

async function addDealer(event) {
  event.preventDefault();
  if (!adminSession) return;

  const email = String(new FormData(dealerStaffForm).get("email") || "").trim();
  dealersStatusEl.textContent = "Adding dealer email...";
  const response = await fetch("/api/dealer-staff", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  const data = await response.json();
  dealersStatusEl.textContent = data.ok ? "Dealer email saved." : formatApiError(data, "Unable to save dealer email.");
  if (data.ok) {
    dealerStaffForm.reset();
    await loadDealers();
  }
}

function renderUser(user) {
  const unlimited = user.unlimited || Number(user.annualLimit) < 0;
  return `
    <form class="user-limit-card" data-user-id="${escapeHtml(user.userId)}" data-email="${escapeHtml(user.email || "")}" data-year="${user.year}">
      <div>
        <strong>${escapeHtml(user.email || user.userId)}</strong>
        <span>${escapeHtml(user.userId)}</span>
        <b class="role-pill role-${escapeHtml(user.role || "customer")}">${escapeHtml(roleLabel(user.role))}</b>
      </div>
      <div>
        <span>Used</span>
        <b>${formatNumber(user.used)}</b>
      </div>
      <div>
        <span>Remaining</span>
        <b>${unlimited ? "Unlimited" : formatNumber(user.remaining)}</b>
      </div>
      <label>
        <span>Annual limit</span>
        <input name="annualLimit" type="number" min="-1" step="1" value="${unlimited ? -1 : user.annualLimit}" />
      </label>
      <label class="inline-check">
        <input name="unlimited" type="checkbox" ${unlimited ? "checked" : ""} />
        <span>Unlimited</span>
      </label>
      <button type="submit">Save limit</button>
    </form>
  `;
}

async function loadLeads(options = {}) {
  if (!adminSession) return;
  const openIds = getOpenLeadIds();
  const response = await fetch("/api/leads", { headers: authHeaders() });
  const data = await response.json();

  if (!data.ok) {
    statusEl.textContent = data.error || "Unable to load leads.";
    return;
  }

  adminLeadsCache = data.leads || [];
  if (!options.suppressAlerts) collectAdminLeadAlerts(adminLeadsCache);
  else rememberAdminLeadTokens(adminLeadsCache);
  renderAdminOverview(adminLeadsCache);
  renderAdminLeadAlerts();

  renderLeadWorkbench(adminLeadsCache);
  if (data.storage === "not_configured") {
    statusEl.textContent = "Lead storage is not configured on this deployment. Add Supabase env vars to persist leads.";
  }
  await restoreOpenLeads(openIds, { forceActivity: Boolean(options.forceOpenActivity) });
}

function collectAdminLeadAlerts(leads) {
  if (!adminLeadSnapshotReady) {
    rememberAdminLeadTokens(leads);
    adminLeadSnapshotReady = true;
    return;
  }
  const nextMap = new Map();
  for (const lead of leads) {
    const id = String(lead.id || "");
    if (!id) continue;
    const token = leadUpdateToken(lead);
    const previousToken = adminLeadTokenMap.get(id);
    nextMap.set(id, token);
    if (!previousToken) {
      adminLeadAlertMap.set(id, {
        id,
        type: "new",
        title: leadAlertTitle(lead),
        message: "New lead received"
      });
    } else if (previousToken !== token) {
      adminLeadAlertMap.set(id, {
        id,
        type: "updated",
        title: leadAlertTitle(lead),
        message: "Lead changed"
      });
    }
  }
  adminLeadTokenMap = nextMap;
}

function rememberAdminLeadTokens(leads) {
  adminLeadTokenMap = new Map(leads
    .map((lead) => [String(lead.id || ""), leadUpdateToken(lead)])
    .filter(([id]) => Boolean(id)));
  adminLeadSnapshotReady = true;
}

function leadUpdateToken(lead = {}) {
  return [
    lead.updated_at || "",
    lead.last_activity_at || "",
    lead.status || "",
    lead.assigned_to || "",
    lead.priority || "",
    lead.next_follow_up_at || "",
    JSON.stringify(lead.owner_adjustment || {}),
    lead.notes || ""
  ].join("|");
}

function leadAlertTitle(lead = {}) {
  const input = lead.input || {};
  const valuation = lead.valuation || {};
  const buyer = isBuyerLead(lead);
  return cleanLeadTitle(valuation.title || [input.year, input.make, input.model, input.series, input.style].filter(Boolean).join(" "), buyer) || "Vehicle lead";
}

function renderAdminLeadAlerts() {
  if (!adminLeadAlertsEl) return;
  const alerts = [...adminLeadAlertMap.values()];
  adminLeadAlertsEl.hidden = alerts.length === 0;
  adminLeadAlertsEl.innerHTML = alerts.length ? `
    <div>
      <strong>${alerts.length} lead update${alerts.length === 1 ? "" : "s"}</strong>
      <span>Click an update to open the lead.</span>
    </div>
    <div class="lead-alert-list">
      ${alerts.map((alert) => `
        <button type="button" data-admin-open-alert="${escapeHtml(alert.id)}" class="lead-alert-item lead-alert-${escapeHtml(alert.type)}">
          <b>${escapeHtml(alert.message)}</b>
          <span>${escapeHtml(alert.title)}</span>
        </button>
      `).join("")}
    </div>
  ` : "";
}

async function openAdminLeadFromAlert(id) {
  if (!id) return;
  if (!adminLeadsCache.some((lead) => String(lead.id || "") === id)) {
    await loadLeads({ suppressAlerts: true, forceOpenActivity: true });
  }
  if (adminLeadFilter !== "all") {
    adminLeadFilter = "all";
    adminLeadFilterButtons.forEach((button) => button.classList.toggle("active", button.dataset.adminLeadFilter === "all"));
    renderLeadWorkbench(adminLeadsCache);
  }
  const card = leadsEl.querySelector(`.lead-card[data-id="${cssEscape(id)}"]`);
  if (!card) return;
  adminLeadAlertMap.delete(id);
  renderAdminLeadAlerts();
  card.classList.remove("lead-card-updated");
  card.classList.add("lead-card-flash");
  window.setTimeout(() => card.classList.remove("lead-card-flash"), 1600);
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  const details = card.querySelector(".lead-manage");
  if (details) details.open = true;
  highlightLeadChangeAreas(card);
  await loadLeadActivity(card, { force: true, highlightLatest: true });
}

function renderLeadWorkbench(leads) {
  const filtered = filterAdminLeads(leads);
  const buyerCount = leads.filter(isBuyerLead).length;
  const sellerCount = leads.length - buyerCount;
  statusEl.textContent = `${filtered.length} shown of ${leads.length} lead(s): ${buyerCount} BUY, ${sellerCount} SELL.`;
  leadsEl.innerHTML = renderLeadGroups(filtered);
}

function filterAdminLeads(leads) {
  if (adminLeadFilter === "buyer") return leads.filter(isBuyerLead);
  if (adminLeadFilter === "seller") return leads.filter((lead) => !isBuyerLead(lead));
  if (adminLeadFilter === "unassigned") return leads.filter((lead) => !String(lead.assigned_to || "").trim());
  if (adminLeadFilter === "needs-follow-up") {
    return leads.filter((lead) => isFollowUpDue(lead.next_follow_up_at, lead.status || "new"));
  }
  return leads;
}

function renderAdminOverview(leads) {
  if (!adminOverviewEl) return;
  const buyerCount = leads.filter(isBuyerLead).length;
  const sellerCount = leads.length - buyerCount;
  const unassignedCount = leads.filter((lead) => !String(lead.assigned_to || "").trim()).length;
  const followUpCount = leads.filter((lead) => isFollowUpDue(lead.next_follow_up_at, lead.status || "new")).length;
  const urgentCount = leads.filter((lead) => String(lead.priority || "").toLowerCase() === "urgent").length;
  adminOverviewEl.innerHTML = `
    <article class="admin-overview-card overview-total">
      <span>Total leads</span>
      <strong>${leads.length}</strong>
      <small>${buyerCount} BUY / ${sellerCount} SELL</small>
    </article>
    <article class="admin-overview-card overview-follow">
      <span>Needs follow-up</span>
      <strong>${followUpCount}</strong>
      <small>Due or overdue</small>
    </article>
    <article class="admin-overview-card overview-unassigned">
      <span>Unassigned</span>
      <strong>${unassignedCount}</strong>
      <small>Needs owner</small>
    </article>
    <article class="admin-overview-card overview-urgent">
      <span>Urgent</span>
      <strong>${urgentCount}</strong>
      <small>High attention</small>
    </article>
  `;
}

function renderLeadGroups(leads) {
  if (!leads.length) return "<p>No leads yet.</p>";
  const buyerLeads = leads.filter(isBuyerLead);
  const sellerLeads = leads.filter((lead) => !isBuyerLead(lead));
  const groups = [
    { title: "BUY - Buyer leads", caption: "People asking about vehicles on the Buy page.", leads: buyerLeads, kind: "buyer" },
    { title: "SELL - Seller leads", caption: "People submitting vehicles for valuation or sale.", leads: sellerLeads, kind: "seller" }
  ].filter((group) => group.leads.length);
  return groups.map((group) => `
    <section class="lead-group lead-group-${group.kind}">
      <header class="lead-group-head">
        <div>
          <h3>${escapeHtml(group.title)}</h3>
          <p>${escapeHtml(group.caption)}</p>
        </div>
        <b>${group.leads.length}</b>
      </header>
      <div class="lead-group-list">
        ${group.leads.map(renderLead).join("")}
      </div>
    </section>
  `).join("");
}

function startAdminAutoRefresh() {
  stopAdminAutoRefresh();
  adminRefreshTimer = window.setInterval(refreshOpenAdminTasks, AUTO_REFRESH_MS);
}

function stopAdminAutoRefresh() {
  if (adminRefreshTimer) window.clearInterval(adminRefreshTimer);
  adminRefreshTimer = null;
}

async function refreshOpenAdminTasks() {
  if (!adminSession || document.hidden || isEditingLeads()) return;
  await loadLeads({ forceOpenActivity: true });
}

function isEditingLeads() {
  const active = document.activeElement;
  return Boolean(active && leadsEl.contains(active) && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(active.tagName));
}

function getOpenLeadIds() {
  return [...leadsEl.querySelectorAll(".lead-card")]
    .filter((card) => card.querySelector(".lead-manage")?.open)
    .map((card) => card.dataset.id)
    .filter(Boolean);
}

async function restoreOpenLeads(openIds, options = {}) {
  if (!openIds.length) return;
  const openSet = new Set(openIds);
  const cards = [...leadsEl.querySelectorAll(".lead-card")].filter((card) => openSet.has(card.dataset.id));
  for (const card of cards) {
    const details = card.querySelector(".lead-manage");
    if (details) details.open = true;
  }
  await Promise.all(cards.map((card) => loadLeadActivity(card, { force: Boolean(options.forceActivity) })));
}

function isBuyerLead(lead) {
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  return input.leadType === "buyer_inquiry" || valuation.source === "buyer_inquiry";
}

function cleanLeadTitle(title, buyer) {
  const value = String(title || "").trim();
  return buyer ? value.replace(/^Buyer inquiry\s*-\s*/i, "") : value;
}

function renderLead(lead) {
  const input = lead.input || {};
  const authUser = lead.auth_user || {};
  const valuation = lead.valuation || {};
  const adjustment = lead.owner_adjustment || {};
  const buyer = isBuyerLead(lead);
  const leadType = buyer ? "buyer" : "seller";
  const leadTypeLabel = buyer ? "Buyer lead" : "Seller lead";
  const wholesale = valuation.values?.wholesale?.adjusted?.avg;
  const retail = valuation.values?.retail?.adjusted?.avg;
  const title = cleanLeadTitle(valuation.title || [input.year, input.make, input.model, input.series, input.style].filter(Boolean).join(" "), buyer) || "Vehicle lead";
  const customerEmail = input.email || authUser.email || lead.auth_email || "-";
  const vin = input.vin || valuation.vin || "-";
  const status = lead.status || "new";
  const assignedTo = lead.assigned_to || "";
  const priority = lead.priority || "normal";
  const purchase = input.buyerPlan || valuation.buyerPlan || {};
  const followUp = lead.next_follow_up_at || "";
  const overdue = isOverdue(followUp, status);
  const statusClass = overdue ? "status-overdue" : `status-${cssToken(status)}`;
  const statusLabel = overdue ? "Overdue" : leadStatusLabel(status, buyer);
  const pendingAlert = adminLeadAlertMap.has(String(lead.id || ""));
  const progressSteps = renderLeadProgress(buyer, status);
  const actionButtons = leadStatusActions(buyer, status)
    .map((action) => `<button type="button" data-lead-status="${escapeHtml(action.status)}">${escapeHtml(action.label)}</button>`)
    .join("");
  const quickAssign = dealerStaffEmails.length ? `
      <div class="quick-assign-row" aria-label="Quick assign lead">
        <span>Assign</span>
        ${dealerStaffEmails.map((email) => `
          <button type="button" data-quick-assign="${escapeHtml(email)}" ${email === assignedTo ? "disabled" : ""}>
            ${escapeHtml(shortEmail(email))}
          </button>
        `).join("")}
      </div>` : "";
  const statusOptions = leadStatusOptions(buyer)
    .map((item) => `<option value="${item.value}" ${status === item.value ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
  const sellerAdjustmentFields = buyer ? "" : `
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
          </label>`;
  const sellerPhotoManager = buyer ? "" : `
        <section class="lead-photo-manager">
          <div>
            <h3>Vehicle photos for intake</h3>
            <p>Upload customer or inspection photos here while the vehicle is still a lead. If photos are selected as public when publishing, they can be shown on the Buy page.</p>
          </div>
          <label>
            <span>Photo type</span>
            <select name="photoLabel">
              <option value="Front exterior">Front exterior</option>
              <option value="Rear exterior">Rear exterior</option>
              <option value="Driver side">Driver side</option>
              <option value="Passenger side">Passenger side</option>
              <option value="Interior">Interior</option>
              <option value="Odometer">Odometer</option>
              <option value="Engine bay">Engine bay</option>
              <option value="Damage or wear">Damage or wear</option>
              <option value="Service record">Service record</option>
              <option value="Other vehicle photo">Other vehicle photo</option>
            </select>
          </label>
          <label>
            <span>Choose photos</span>
            <input name="leadPhotos" type="file" accept="image/*" multiple />
          </label>
          <button type="button" data-upload-lead-photos="${escapeHtml(lead.id || "")}">Upload photos to Drive</button>
          <p class="lead-photo-status" aria-live="polite"></p>
        </section>`;
  const sellerPublishForm = buyer ? "" : `
        <form class="inventory-publish-form">
          <h3>Publish to buy page</h3>
          <p class="inventory-helper">Choose what buyers can see before sending this lead into inventory. Once it is in inventory, use Inventory management to edit price, upload photos, unpublish, mark sold, or remove it from inventory.</p>
          <label>
            <span>Listing title</span>
            <input name="title" value="${escapeHtml(title)}" />
          </label>
          <label>
            <span>Asking price</span>
            <input name="askingPrice" type="number" min="0" step="1" value="${escapeHtml(retail || wholesale || "")}" placeholder="Listing price" />
          </label>
          <label>
            <span>Status</span>
            <select name="status">
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </label>
          <label class="review-notes">
            <span>Listing description</span>
            <textarea name="description" placeholder="Short public description for buyers...">${escapeHtml(lead.notes || "")}</textarea>
          </label>
          <fieldset class="inventory-public-options">
            <legend>Public information</legend>
            <label><input type="checkbox" name="showVin" checked /> VIN</label>
            <label><input type="checkbox" name="showUvc" /> UVC</label>
            <label><input type="checkbox" name="showKilometers" checked /> Kilometers</label>
            <label><input type="checkbox" name="showRegion" checked /> Region</label>
            <label><input type="checkbox" name="showColor" checked /> Color</label>
            <label><input type="checkbox" name="showMaintenance" /> Publish selected maintenance / repair activity</label>
            <label><input type="checkbox" name="showPhotos" /> Publish photos uploaded in this lead</label>
          </fieldset>
          <button type="submit">Publish inventory listing</button>
          <p class="inventory-publish-status" aria-live="polite"></p>
        </form>`;
  const valueRows = buyer ? `
          <span>Asking price</span><b>${retail ? formatNumber(retail) : input.askingPrice ? formatNumber(input.askingPrice) : "-"}</b>
          <span>Payment target</span><b>${purchase.monthlyPayment ? `${formatNumber(purchase.monthlyPayment)} / mo` : "-"}</b>` : `
          <span>AVG Wholesale</span><b>${wholesale ? formatNumber(wholesale) : "-"}</b>
          <span>AVG Retail</span><b>${retail ? formatNumber(retail) : "-"}</b>`;
  return `
    <article class="lead-card lead-card-${leadType} ${overdue ? "lead-overdue" : ""} ${pendingAlert ? "lead-card-updated" : ""}" data-id="${escapeHtml(lead.id || "")}">
      <header class="lead-summary">
        <div>
          <div class="lead-title-row">
            <b class="lead-type-pill lead-type-${leadType}">${escapeHtml(leadTypeLabel)}</b>
            <strong>${escapeHtml(title)}</strong>
          </div>
          <span>${escapeHtml(formatDateTime(lead.created_at))}</span>
        </div>
        <div class="lead-summary-metrics">
          <span>${escapeHtml(customerEmail)}</span>
          <span>VIN ${escapeHtml(vin)}</span>
          <span>Owner ${escapeHtml(assignedTo || "Unassigned")}</span>
          ${buyer ? `<span>Intent ${escapeHtml(purchase.intent || input.purchaseIntent || "-")}</span>` : `<span>Wholesale ${wholesale ? formatNumber(wholesale) : "-"}</span>`}
          ${buyer ? `<span>Budget ${purchase.monthlyPayment ? `${formatNumber(purchase.monthlyPayment)}/mo` : retail ? formatNumber(retail) : "-"}</span>` : `<span>Retail ${retail ? formatNumber(retail) : "-"}</span>`}
          <b class="priority-pill priority-${escapeHtml(priority)}">${escapeHtml(priority)}</b>
          <b class="status-pill ${escapeHtml(statusClass)}">${escapeHtml(statusLabel)}</b>
        </div>
      </header>
      ${pendingAlert ? `<button class="lead-inline-alert" type="button" data-admin-open-alert="${escapeHtml(lead.id || "")}">New update on this lead</button>` : ""}
      ${progressSteps}
      ${quickAssign}
      ${actionButtons ? `<div class="lead-action-row">${actionButtons}</div>` : ""}
      <details class="lead-manage">
        <summary>Manage lead</summary>
        <div class="lead-grid">
          <span>Email</span><b>${escapeHtml(input.email || "-")}</b>
          <span>Google user</span><b>${escapeHtml(authUser.email || "-")}</b>
          <span>Phone</span><b>${escapeHtml(input.phone || "-")}</b>
          ${buyer ? `<span>Lead type</span><b>Buyer inquiry</b>` : ""}
          ${buyer ? `<span>Purchase intent</span><b>${escapeHtml(purchase.intent || input.purchaseIntent || "-")}</b>` : ""}
          ${buyer ? `<span>Buying timeline</span><b>${escapeHtml(purchase.buyingTimeline || input.buyingTimeline || "-")}</b>` : ""}
          ${buyer ? `<span>Preferred contact</span><b>${escapeHtml(purchase.preferredContact || input.preferredContact || "-")}</b>` : ""}
          ${buyer ? `<span>Payment target</span><b>${purchase.monthlyPayment ? `${formatNumber(purchase.monthlyPayment)} / mo` : "-"}</b>` : ""}
          <span>VIN</span><b>${escapeHtml(vin)}</b>
          <span>UVC</span><b>${escapeHtml(input.uvc || "-")}</b>
          <span>Vehicle</span><b>${escapeHtml([input.year, input.make, input.model, input.series, input.style].filter(Boolean).join(" ") || "-")}</b>
          <span>Kilometers</span><b>${formatNumber(input.kilometers || 0)}</b>
          <span>Ownership</span><b>${escapeHtml(input.ownershipType || (input.ownsVehicle ? "Owned" : "-"))}</b>
          <span>Color</span><b>${escapeHtml(input.color || "-")}</b>
          <span>Region</span><b>${escapeHtml(input.region || valuation.region || "-")}</b>
          ${valueRows}
        </div>
        ${sellerPhotoManager}
        <form class="owner-review">
          <label>
            <span>Status</span>
            <select name="status">
              ${statusOptions}
            </select>
          </label>
          <label>
            <span>Assigned to</span>
            <input name="assignedTo" type="email" value="${escapeHtml(assignedTo)}" placeholder="staff@example.com" />
          </label>
          <label>
            <span>Priority</span>
            <select name="priority">
              ${["low", "normal", "high", "urgent"].map((item) =>
                `<option value="${item}" ${priority === item ? "selected" : ""}>${item}</option>`
              ).join("")}
            </select>
          </label>
          <label>
            <span>Next follow-up</span>
            <input name="nextFollowUpAt" type="datetime-local" value="${escapeHtml(datetimeLocalValue(followUp))}" />
          </label>
          ${sellerAdjustmentFields}
          <label class="review-notes">
            <span>Admin notes</span>
            <textarea name="notes" placeholder="Follow-up notes, CRM notes, customer preference...">${escapeHtml(lead.notes || "")}</textarea>
          </label>
          <button type="submit">Save owner review</button>
          <button class="danger-outline" type="button" data-delete-lead="${escapeHtml(lead.id || "")}" data-delete-title="${escapeHtml(title)}">Delete lead</button>
        </form>
        ${sellerPublishForm}
        <section class="lead-activity-panel">
          <div class="lead-activity-head">
            <h3>Follow-up activity</h3>
            <button type="button" data-load-activity>Refresh activity</button>
          </div>
          <form class="lead-note-form">
            <select name="noteType">
              <option value="internal">Internal note</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="inspection">Inspection</option>
              <option value="offer">Offer</option>
            </select>
            <textarea name="note" placeholder="Record a call, inspection result, quote discussion, or next-step detail..."></textarea>
            <button type="submit">Add note</button>
          </form>
          <form class="lead-task-form">
            <input name="title" placeholder="Next task, e.g. Call customer" />
            <input name="assignedTo" type="email" value="${escapeHtml(assignedTo)}" placeholder="staff@example.com" />
            <input name="dueAt" type="datetime-local" />
            <button type="submit">Add task</button>
          </form>
          <div class="lead-activity-list">Activity not loaded yet.</div>
        </section>
      </details>
      <details class="lead-raw">
        <summary>Raw valuation summary</summary>
        <pre>${escapeHtml(JSON.stringify(valuation, null, 2))}</pre>
      </details>
    </article>
  `;
}

function leadStatusOptions(buyer) {
  return buyer
    ? [
        { value: "new", label: "New buyer inquiry" },
        { value: "assigned", label: "Assigned" },
        { value: "contacted", label: "Contacted" },
        { value: "waiting_for_customer", label: "Waiting for buyer" },
        { value: "appointment_booked", label: "Appointment booked" },
        { value: "finance_sent", label: "Finance sent" },
        { value: "won", label: "Won" },
        { value: "lost", label: "Lost" },
        { value: "closed", label: "Closed" },
        { value: "deleted", label: "Deleted" }
      ]
    : [
        { value: "new", label: "New seller lead" },
        { value: "assigned", label: "Assigned" },
        { value: "contacted", label: "Contacted" },
        { value: "waiting_for_customer", label: "Waiting for seller" },
        { value: "inspection_booked", label: "Inspection booked" },
        { value: "offer_sent", label: "Offer sent" },
        { value: "won", label: "Purchased" },
        { value: "lost", label: "Lost" },
        { value: "closed", label: "Closed" },
        { value: "deleted", label: "Deleted" }
      ];
}

function leadStatusLabel(status, buyer) {
  const option = leadStatusOptions(buyer).find((item) => item.value === status);
  return option?.label || String(status || "new").replaceAll("_", " ");
}

function leadStatusActions(buyer, status) {
  const current = String(status || "new").toLowerCase();
  const actions = buyer
    ? [
        ["assigned", "Assign"],
        ["contacted", "Contacted"],
        ["appointment_booked", "Appointment"],
        ["finance_sent", "Finance sent"],
        ["won", "Won"],
        ["lost", "Lost"]
      ]
    : [
        ["assigned", "Assign"],
        ["contacted", "Contacted"],
        ["inspection_booked", "Inspection"],
        ["offer_sent", "Offer sent"],
        ["won", "Purchased"],
        ["lost", "Lost"]
      ];
  return actions
    .filter(([next]) => next !== current)
    .map(([next, label]) => ({ status: next, label }));
}

function leadProgressSteps(buyer) {
  return buyer
    ? [
        ["new", "New"],
        ["assigned", "Assigned"],
        ["contacted", "Contacted"],
        ["appointment_booked", "Appointment"],
        ["finance_sent", "Finance"],
        ["won", "Won"]
      ]
    : [
        ["new", "New"],
        ["assigned", "Assigned"],
        ["contacted", "Contacted"],
        ["inspection_booked", "Inspection"],
        ["offer_sent", "Offer"],
        ["won", "Purchased"]
      ];
}

function renderLeadProgress(buyer, status) {
  const current = String(status || "new").toLowerCase();
  const steps = leadProgressSteps(buyer);
  const currentIndex = steps.findIndex(([value]) => value === current);
  const closedLost = ["lost", "closed", "deleted"].includes(current);
  return `
    <ol class="lead-progress ${closedLost ? "lead-progress-closed" : ""}" aria-label="Lead progress">
      ${steps.map(([value, label], index) => {
        const complete = !closedLost && currentIndex >= 0 && index < currentIndex;
        const active = !closedLost && value === current;
        return `<li class="${complete ? "complete" : ""} ${active ? "active" : ""}">
          <span></span><b>${escapeHtml(label)}</b>
        </li>`;
      }).join("")}
      ${closedLost ? `<li class="active closed"><span></span><b>${escapeHtml(leadStatusLabel(current, buyer))}</b></li>` : ""}
    </ol>
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
  if (data.ok) await loadLeads({ suppressAlerts: true, forceOpenActivity: true });
});

inventoryEl?.addEventListener("submit", async (event) => {
  const form = event.target.closest(".inventory-card-admin");
  if (!form) return;
  event.preventDefault();
  await saveInventoryListing(form);
});

inventoryEl?.addEventListener("click", async (event) => {
  const statusButton = event.target.closest("[data-inventory-status]");
  if (statusButton) {
    const form = statusButton.closest(".inventory-card-admin");
    if (!form) return;
    const nextStatus = statusButton.dataset.status || "draft";
    const label = nextStatus === "draft" ? "unpublish this listing" : `mark this listing as ${nextStatus}`;
    if (!window.confirm(`Confirm ${label}?`)) return;
    form.elements.status.value = nextStatus;
    await saveInventoryListing(form);
    return;
  }

  const removeButton = event.target.closest("[data-remove-inventory]");
  if (removeButton) {
    await removeInventoryListing(removeButton);
  }
});

async function saveInventoryListing(form) {
  const payload = {
    id: form.dataset.id,
    ...Object.fromEntries(new FormData(form).entries())
  };
  inventoryStatusEl.textContent = "Saving inventory listing...";
  const response = await fetch("/api/admin-inventory", {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  inventoryStatusEl.textContent = data.ok ? "Inventory listing saved." : formatApiError(data, "Unable to save inventory listing.");
  if (data.ok) await loadInventory();
}

async function removeInventoryListing(button) {
  const form = button.closest(".inventory-card-admin");
  const title = form?.querySelector(".inventory-card-head strong")?.textContent || "this vehicle";
  const id = button.dataset.removeInventory || form?.dataset.id || "";
  if (!id) return;
  const confirmed = window.confirm(
    `Remove "${title}" from inventory?\n\nIt will disappear from Inventory management and the public Buy page. The original lead and activity remain, so staff can keep working on it and an admin can publish it again later.`
  );
  if (!confirmed) return;
  button.disabled = true;
  inventoryStatusEl.textContent = "Removing inventory listing...";
  const response = await fetch(`/api/admin-inventory?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  const data = await response.json();
  inventoryStatusEl.textContent = data.ok ? "Inventory listing removed. The original lead remains available for follow-up." : formatApiError(data, "Unable to remove inventory listing.");
  if (data.ok) {
    await Promise.all([loadInventory(), loadLeads({ suppressAlerts: true, forceOpenActivity: true })]);
  }
  button.disabled = false;
}

function fileToBase64Payload(file, label) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve({
        name: file.name,
        originalName: file.name,
        role: label,
        angle: label,
        mimeType: file.type || "image/jpeg",
        size: file.size,
        base64: result.includes(",") ? result.split(",").pop() : result
      });
    };
    reader.onerror = () => reject(new Error("Unable to read photo file."));
    reader.readAsDataURL(file);
  });
}

leadsEl.addEventListener("submit", async (event) => {
  const form = event.target.closest(".lead-note-form");
  if (!form) return;
  event.preventDefault();

  const card = form.closest(".lead-card");
  const payload = {
    leadId: card.dataset.id,
    type: "note",
    ...Object.fromEntries(new FormData(form).entries())
  };
  const response = await fetch("/api/lead-activity", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  statusEl.textContent = data.ok ? "Note saved." : (data.error || "Unable to save note.");
  if (data.ok) {
    form.reset();
    await loadLeadActivity(card, { force: true });
  }
});

leadsEl.addEventListener("submit", async (event) => {
  const form = event.target.closest(".inventory-publish-form");
  if (!form) return;
  event.preventDefault();

  const card = form.closest(".lead-card");
  const formStatus = form.querySelector(".inventory-publish-status");
  const payload = {
    leadId: card.dataset.id,
    ...Object.fromEntries(new FormData(form).entries())
  };
  if (formStatus) formStatus.textContent = "Publishing inventory listing...";
  const response = await fetch("/api/inventory/from-lead", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  const message = data.ok
    ? `Inventory listing ${data.updated ? "updated" : "published"}. Inventory management has been refreshed.`
    : formatApiError(data, "Unable to publish inventory listing.");
  statusEl.textContent = message;
  if (formStatus) formStatus.textContent = message;
  if (data.ok) {
    await Promise.all([loadInventory(), loadLeads({ suppressAlerts: true, forceOpenActivity: true })]);
  }
});

leadsEl.addEventListener("submit", async (event) => {
  const form = event.target.closest(".lead-task-form");
  if (!form) return;
  event.preventDefault();

  const card = form.closest(".lead-card");
  const payload = {
    leadId: card.dataset.id,
    type: "task",
    ...Object.fromEntries(new FormData(form).entries())
  };
  const response = await fetch("/api/lead-activity", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  statusEl.textContent = data.ok ? "Task saved." : (data.error || "Unable to save task.");
  if (data.ok) {
    form.reset();
    await loadLeadActivity(card, { force: true });
  }
});

leadsEl.addEventListener("click", async (event) => {
  const alertButton = event.target.closest("[data-admin-open-alert]");
  if (alertButton) {
    await openAdminLeadFromAlert(alertButton.dataset.adminOpenAlert || "");
    return;
  }

  const quickAssignButton = event.target.closest("[data-quick-assign]");
  if (quickAssignButton) {
    await quickAssignLead(quickAssignButton);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-lead]");
  if (deleteButton) {
    await deleteSingleLead(deleteButton);
    return;
  }

  const loadButton = event.target.closest("[data-load-activity]");
  if (loadButton) {
    await loadLeadActivity(loadButton.closest(".lead-card"), { force: true });
    return;
  }

  const uploadLeadPhotosButton = event.target.closest("[data-upload-lead-photos]");
  if (uploadLeadPhotosButton) {
    await uploadLeadPhotos(uploadLeadPhotosButton);
    return;
  }

  const completeButton = event.target.closest("[data-complete-task]");
  if (completeButton) {
    const card = completeButton.closest(".lead-card");
    const response = await fetch("/api/lead-activity", {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: card.dataset.id,
        taskId: completeButton.dataset.completeTask,
        completed: completeButton.dataset.completed !== "true"
      })
    });
    const data = await response.json();
    statusEl.textContent = data.ok ? "Task updated." : (data.error || "Unable to update task.");
    if (data.ok) await loadLeadActivity(card, { force: true });
    return;
  }

  const statusButton = event.target.closest("[data-lead-status]");
  if (!statusButton) return;
  const card = statusButton.closest(".lead-card");
  const response = await fetch("/api/lead-activity", {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      leadId: card.dataset.id,
      action: "status",
      status: statusButton.dataset.leadStatus,
      note: `Admin updated status to ${String(statusButton.dataset.leadStatus || "").replaceAll("_", " ")}.`
    })
  });
  const data = await response.json();
  statusEl.textContent = data.ok ? "Lead status updated." : (data.error || "Unable to update lead status.");
  if (data.ok) await loadLeads({ suppressAlerts: true, forceOpenActivity: true });
});

async function quickAssignLead(button) {
  const card = button.closest(".lead-card");
  const email = String(button.dataset.quickAssign || "").trim().toLowerCase();
  if (!card?.dataset?.id || !email) return;

  button.disabled = true;
  statusEl.textContent = `Assigning lead to ${email}...`;
  try {
    const response = await fetch("/api/leads", {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        id: card.dataset.id,
        assignedTo: email,
        status: "assigned"
      })
    });
    const data = await response.json();
    if (!data.ok) throw new Error(formatApiError(data, "Unable to assign lead."));
    await fetch("/api/lead-activity", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: card.dataset.id,
        type: "note",
        noteType: "internal",
        note: `Admin assigned this lead to ${email}.`
      })
    }).catch(() => null);
    statusEl.textContent = `Lead assigned to ${email}.`;
    await loadLeads({ suppressAlerts: true, forceOpenActivity: true });
  } catch (error) {
    statusEl.textContent = error.message || "Unable to assign lead.";
    button.disabled = false;
  }
}

leadsEl.addEventListener("toggle", async (event) => {
  const details = event.target.closest(".lead-manage");
  if (!details || !details.open) return;

  const card = details.closest(".lead-card");
  if (!card) return;
  if (card.dataset.id && adminLeadAlertMap.has(card.dataset.id)) {
    adminLeadAlertMap.delete(card.dataset.id);
    renderAdminLeadAlerts();
    card.classList.remove("lead-card-updated");
  }
  if (card.dataset.activityLoaded === "true") return;
  await loadLeadActivity(card, { force: true });
}, true);

async function deleteSingleLead(button) {
  const id = button.dataset.deleteLead || "";
  const title = button.dataset.deleteTitle || "this lead";
  if (!id || !adminSession) return;

  const confirmed = window.confirm(
    `Delete "${title}" permanently?\n\nThis removes the lead and its notes/tasks/email records from Supabase. This does not delete Google Sheet rows or Google Drive files.`
  );
  if (!confirmed) return;

  button.disabled = true;
  statusEl.textContent = "Deleting lead...";
  const response = await fetch(`/api/leads?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  const data = await response.json();
  statusEl.textContent = data.ok ? `Deleted ${data.deleted || 0} lead record.` : formatApiError(data, "Unable to delete lead.");
  if (data.ok) await loadLeads({ suppressAlerts: true });
  button.disabled = false;
}

async function uploadLeadPhotos(button) {
  const card = button.closest(".lead-card");
  const manager = button.closest(".lead-photo-manager");
  const fileInput = manager?.querySelector("input[name='leadPhotos']");
  const labelInput = manager?.querySelector("select[name='photoLabel']");
  const status = manager?.querySelector(".lead-photo-status");
  const files = [...(fileInput?.files || [])];
  if (!card?.dataset?.id || !files.length) {
    if (status) status.textContent = "Choose at least one photo first.";
    return;
  }

  button.disabled = true;
  if (status) status.textContent = "Preparing photos...";
  try {
    const photoFiles = [];
    for (const file of files) {
      photoFiles.push(await fileToBase64Payload(file, labelInput?.value || "Vehicle photo"));
    }
    if (status) status.textContent = "Uploading photos to Google Drive...";
    const response = await fetch("/api/lead-photos", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: card.dataset.id,
        files: photoFiles
      })
    });
    const data = await response.json();
    const message = data.ok ? `${data.photos.length} photo(s) uploaded and saved to activity.` : formatApiError(data, "Unable to upload photos.");
    if (status) status.textContent = message;
    statusEl.textContent = message;
    if (data.ok) {
      if (fileInput) fileInput.value = "";
      await loadLeadActivity(card, { force: true });
    }
  } catch (error) {
    const message = error.message || "Unable to upload photos.";
    if (status) status.textContent = message;
    statusEl.textContent = message;
  } finally {
    button.disabled = false;
  }
}

async function clearAllLeads() {
  if (!adminSession) return;
  if (clearLeadsConfirmEl) {
    clearLeadsConfirmEl.querySelector("input")?.focus();
    statusEl.textContent = "Type DELETE ALL LEADS in the confirmation box below.";
    return;
  }

  clearLeadsConfirmEl = document.createElement("div");
  clearLeadsConfirmEl.className = "clear-leads-confirm";
  clearLeadsConfirmEl.innerHTML = `
    <p><strong>Confirm permanent deletion</strong></p>
    <p>This deletes all Supabase lead records, notes, tasks, and email activity. Google Sheet rows and Google Drive files are not deleted.</p>
    <label>
      <span>Type DELETE ALL LEADS</span>
      <input type="text" autocomplete="off" placeholder="DELETE ALL LEADS" />
    </label>
    <div>
      <button type="button" class="danger-confirm">Confirm clear all</button>
      <button type="button" class="secondary-cancel">Cancel</button>
    </div>
  `;
  clearLeadsButton.parentElement?.insertAdjacentElement("afterend", clearLeadsConfirmEl);
  clearLeadsConfirmEl.querySelector("input")?.focus();
  clearLeadsConfirmEl.querySelector(".danger-confirm")?.addEventListener("click", confirmClearAllLeads);
  clearLeadsConfirmEl.querySelector(".secondary-cancel")?.addEventListener("click", cancelClearAllLeads);
  statusEl.textContent = "Type DELETE ALL LEADS in the confirmation box below.";
}

async function confirmClearAllLeads() {
  const confirmText = "DELETE ALL LEADS";
  const typed = clearLeadsConfirmEl?.querySelector("input")?.value || "";
  if (normalizeDeleteConfirm(typed) !== confirmText) {
    statusEl.textContent = "Confirmation text does not match. Type DELETE ALL LEADS exactly.";
    clearLeadsConfirmEl?.querySelector("input")?.focus();
    return;
  }

  clearLeadsButton.disabled = true;
  clearLeadsConfirmEl.querySelector(".danger-confirm").disabled = true;
  statusEl.textContent = "Clearing all leads...";
  try {
    const response = await fetch(`/api/leads?confirm=${encodeURIComponent(confirmText)}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    const data = await response.json();
    statusEl.textContent = data.ok ? `Deleted ${data.deleted || 0} lead record(s).` : formatApiError(data, "Unable to clear leads.");
    if (data.ok) {
      cancelClearAllLeads();
      await loadLeads({ suppressAlerts: true });
    }
  } catch (error) {
    statusEl.textContent = error.message || "Unable to clear leads.";
  } finally {
    clearLeadsButton.disabled = false;
    clearLeadsConfirmEl?.querySelector(".danger-confirm")?.removeAttribute("disabled");
  }
}

function normalizeDeleteConfirm(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function cancelClearAllLeads() {
  clearLeadsConfirmEl?.remove();
  clearLeadsConfirmEl = null;
}

async function loadLeadActivity(card, options = {}) {
  if (!card?.dataset?.id) return;
  if (card.dataset.activityLoaded === "true" && !options.force) return;
  const list = card.querySelector(".lead-activity-list");
  if (list) list.textContent = "Loading activity...";

  const response = await fetch(`/api/lead-activity?leadId=${encodeURIComponent(card.dataset.id)}`, {
    headers: authHeaders()
  });
  const data = await response.json();
  if (!data.ok) {
    if (list) list.textContent = data.error || "Unable to load activity.";
    return;
  }

  card.dataset.activityLoaded = "true";
  if (list) list.innerHTML = renderActivity(data, { highlightLatest: Boolean(options.highlightLatest) });
}

function renderActivity(data, options = {}) {
  const latestKey = options.highlightLatest ? latestActivityKey(data) : "";
  const tasks = (data.tasks || []).map((task) => `
    <article class="activity-item ${task.completed_at ? "activity-done" : ""} ${latestKey === `task:${task.id}` ? "activity-highlight" : ""}">
      <div>
        <strong>${escapeHtml(task.title || "Task")}</strong>
        <span>Task for ${escapeHtml(task.assigned_to || "unassigned")} ${task.due_at ? `due ${escapeHtml(formatDateTime(task.due_at))}` : ""}</span>
      </div>
      <button type="button" data-complete-task="${escapeHtml(task.id)}" data-completed="${task.completed_at ? "true" : "false"}">
        ${task.completed_at ? "Reopen" : "Complete"}
      </button>
    </article>
  `);

  const notes = (data.notes || []).map((note) => `
    <article class="activity-item ${latestKey === `note:${note.id}` ? "activity-highlight" : ""}">
      <div>
        <strong>${escapeHtml(note.note_type || "note")} by ${escapeHtml(note.author_email || "-")}</strong>
        <span>${escapeHtml(formatDateTime(note.created_at))}</span>
        <p>${linkifyNote(note.note || "")}</p>
      </div>
    </article>
  `);

  const emails = (data.emails || []).map((email) => `
    <article class="activity-item ${latestKey === `email:${email.id}` ? "activity-highlight" : ""}">
      <div>
        <strong>Email to ${escapeHtml(email.sent_to || "-")}</strong>
        <span>${escapeHtml(email.subject || "")} - ${escapeHtml(formatDateTime(email.created_at))}</span>
      </div>
    </article>
  `);

  const content = [...tasks, ...notes, ...emails].join("");
  return content || "<p>No activity yet.</p>";
}

function latestActivityKey(data) {
  const items = [
    ...(data.tasks || []).map((item) => ({ key: `task:${item.id}`, at: item.completed_at || item.created_at || item.due_at })),
    ...(data.notes || []).map((item) => ({ key: `note:${item.id}`, at: item.created_at })),
    ...(data.emails || []).map((item) => ({ key: `email:${item.id}`, at: item.created_at }))
  ];
  return items
    .map((item) => ({ ...item, time: new Date(item.at || 0).getTime() }))
    .filter((item) => item.key && !Number.isNaN(item.time))
    .sort((a, b) => b.time - a.time)[0]?.key || "";
}

function highlightLeadChangeAreas(card) {
  [".lead-progress", ".lead-grid", ".owner-review", ".lead-activity-panel"].forEach((selector) => {
    const element = card.querySelector(selector);
    if (!element) return;
    element.classList.remove("change-focus");
    window.requestAnimationFrame(() => element.classList.add("change-focus"));
    window.setTimeout(() => element.classList.remove("change-focus"), 2200);
  });
}

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
  if (form.elements.unlimited?.checked) payload.annualLimit = -1;
  const response = await fetch("/api/user-limits", {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  usersStatusEl.textContent = data.ok ? "User valuation limit saved." : (data.error || "Unable to save user limit.");
  if (data.ok) await loadUsers();
});

function roleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "dealer") return "Dealer";
  return "Customer";
}

function linkifyNote(value) {
  const escaped = escapeHtml(value).replace(/\r?\n/g, "<br>");
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
}

dealersEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove-dealer]");
  if (!button || !adminSession) return;

  const email = button.dataset.removeDealer;
  const confirmed = window.confirm(`Remove ${email} from dealer portal access?`);
  if (!confirmed) return;

  button.disabled = true;
  dealersStatusEl.textContent = "Removing dealer email...";
  const response = await fetch(`/api/dealer-staff?email=${encodeURIComponent(email)}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  const data = await response.json();
  dealersStatusEl.textContent = data.ok ? "Dealer email removed." : formatApiError(data, "Unable to remove dealer email.");
  await loadDealers();
});

function formatApiError(data, fallback) {
  const value = data?.error || data?.details || data;
  if (!value) return fallback;
  if (typeof value === "string") return value;
  if (isMissingInventoryTable(value)) {
    return "Supabase is missing public.vehicle_listings. Open Supabase SQL Editor, run the latest supabase.sql, then reload this page.";
  }
  if (value.message) return value.message;
  if (value.error_description) return value.error_description;
  if (value.details && typeof value.details === "string") return value.details;
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function isMissingInventoryTable(value) {
  const text = JSON.stringify(value || {}).toLowerCase();
  return text.includes("vehicle_listings") && (text.includes("schema cache") || text.includes("could not find"));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(Number(value));
}

function formatDateTime(value) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function datetimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function isOverdue(value, status) {
  if (!value) return false;
  const closedStatuses = new Set(["won", "lost", "closed", "deleted"]);
  if (closedStatuses.has(String(status || "").toLowerCase())) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function isFollowUpDue(value, status) {
  if (!value) return false;
  const closedStatuses = new Set(["won", "lost", "closed", "deleted"]);
  if (closedStatuses.has(String(status || "").toLowerCase())) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return date.getTime() <= endOfToday.getTime();
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

function cssToken(value) {
  return String(value || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value));
  return String(value).replace(/["\\]/g, "\\$&");
}

function shortEmail(email) {
  const [name, domain] = String(email || "").split("@");
  if (!domain) return email;
  return `${name.slice(0, 12)}@${domain.split(".")[0]}`;
}
