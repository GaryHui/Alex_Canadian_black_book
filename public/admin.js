const statusEl = document.querySelector("#admin-status");
const leadsEl = document.querySelector("#admin-leads");
const usersStatusEl = document.querySelector("#users-status");
const usersEl = document.querySelector("#admin-users");
const dealersStatusEl = document.querySelector("#dealers-status");
const dealersEl = document.querySelector("#admin-dealers");
const inventoryStatusEl = document.querySelector("#inventory-status");
const inventoryEl = document.querySelector("#admin-inventory");
const inventorySummaryEl = document.querySelector("#inventory-summary");
const inventoryFilterButtons = [...document.querySelectorAll("[data-inventory-filter]")];
const inquiriesStatusEl = document.querySelector("#inquiries-status");
const inquiriesEl = document.querySelector("#admin-inquiries");
const adminControlBoardEl = document.querySelector("#admin-control-board");
const adminOverviewEl = document.querySelector("#admin-overview");
const adminLeadAlertsEl = document.querySelector("#admin-lead-alerts");
const adminTodayListEl = document.querySelector("#admin-today-list");
const adminLeadFilterButtons = [...document.querySelectorAll("[data-admin-lead-filter]")];
const adminLeadSearchInput = document.querySelector("#admin-lead-search");
const adminLeadSortSelect = document.querySelector("#admin-lead-sort");
const adminLeadDrawer = document.querySelector("#admin-lead-drawer");
const adminLeadDrawerContent = document.querySelector("#admin-lead-drawer-content");
const dealerStaffForm = document.querySelector("#dealer-staff-form");
const leadRecoveryForm = document.querySelector("#lead-recovery-form");
const leadRecoveryStatus = document.querySelector("#lead-recovery-status");
const operationsSettingsForm = document.querySelector("#operations-settings-form");
const operationsSettingsStatus = document.querySelector("#operations-settings-status");
const businessHoursGrid = document.querySelector("#business-hours-grid");
const reloadOperationsSettingsButton = document.querySelector("#reload-operations-settings");
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
const MAX_LEAD_PHOTOS = 20;
const ADMIN_LEAD_READ_TOKENS_KEY = "autoswitch-admin-lead-read-tokens";
const ADMIN_DASHBOARD_RANGE_KEY = "autoswitch-admin-dashboard-range";
const BUSINESS_DAYS = [
  ["1", "Monday"],
  ["2", "Tuesday"],
  ["3", "Wednesday"],
  ["4", "Thursday"],
  ["5", "Friday"],
  ["6", "Saturday"],
  ["0", "Sunday"]
];

let supabaseClient = null;
let adminSession = null;
let adminTurnstileGate = null;
let clearLeadsConfirmEl = null;
let adminRefreshTimer = null;
let adminLeadsCache = [];
let adminLeadFilter = "active";
let adminLeadSearch = "";
let adminLeadSort = "newest";
let inventoryCache = [];
let inventoryFilter = "active";
let adminLeadTokenMap = new Map();
let adminLeadAlertMap = new Map();
let adminLeadSnapshotReady = false;
let dealerStaffEmails = [];
let activeAdminLeadId = "";
let adminAttentionExpanded = false;
let activeAdminDrawerLeadId = "";
let adminDrawerActivityLoaded = false;
let adminDrawerLockedScrollY = 0;
let pendingAdminDeepLinkLeadId = new URLSearchParams(window.location.search).get("leadId") || "";
let adminDashboardRange = loadDashboardDateRange(ADMIN_DASHBOARD_RANGE_KEY);

reloadUsersButton.addEventListener("click", loadUsers);
reloadLeadsButton.addEventListener("click", () => Promise.all([
  loadLeads({ forceOpenActivity: true }),
  loadInventory()
]));
reloadDealersButton.addEventListener("click", loadDealers);
reloadOperationsSettingsButton?.addEventListener("click", loadOperationsSettings);
reloadInventoryButton?.addEventListener("click", loadInventory);
reloadInquiriesButton?.addEventListener("click", loadInquiries);
clearLeadsButton?.addEventListener("click", clearAllLeads);
dealerStaffForm.addEventListener("submit", addDealer);
leadRecoveryForm?.addEventListener("submit", recoverHiddenLead);
operationsSettingsForm?.addEventListener("submit", saveOperationsSettings);
adminLoginButton.addEventListener("click", signInAdmin);
adminLogoutButton.addEventListener("click", signOutAdmin);
adminLeadFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setAdminLeadFilter(button.dataset.adminLeadFilter || "all");
    renderLeadWorkbench(adminLeadsCache);
  });
});
adminLeadSearchInput?.addEventListener("input", () => {
  adminLeadSearch = adminLeadSearchInput.value || "";
  renderLeadWorkbench(adminLeadsCache);
});
adminLeadSortSelect?.addEventListener("change", () => {
  adminLeadSort = adminLeadSortSelect.value === "oldest" ? "oldest" : "newest";
  renderLeadWorkbench(adminLeadsCache);
});
adminLeadAlertsEl?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-admin-open-alert]");
  if (!button) return;
  await openAdminLeadFromAlert(button.dataset.adminOpenAlert || "");
});
adminOverviewEl?.addEventListener("click", (event) => {
  const filterButton = event.target.closest("[data-admin-set-filter]");
  if (!filterButton) return;
  setAdminLeadFilter(filterButton.dataset.adminSetFilter || "all");
  renderLeadWorkbench(adminLeadsCache);
  document.querySelector("#crm-leads")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
adminControlBoardEl?.addEventListener("click", (event) => {
  const filterButton = event.target.closest("[data-admin-set-filter]");
  if (filterButton) {
    setAdminLeadFilter(filterButton.dataset.adminSetFilter || "all");
    renderLeadWorkbench(adminLeadsCache);
    document.querySelector("#crm-leads")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const inventoryButton = event.target.closest("[data-open-inventory-filter]");
  if (inventoryButton) {
    setInventoryFilter(inventoryButton.dataset.openInventoryFilter || "active");
    renderInventoryWarehouse(inventoryCache);
    document.querySelector("#inventory-warehouse")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const urlButton = event.target.closest("[data-admin-open-url]");
  if (urlButton) {
    window.location.href = urlButton.dataset.adminOpenUrl || "/admin-vehicles.html";
  }
});
adminTodayListEl?.addEventListener("click", async (event) => {
  const toggleButton = event.target.closest("[data-admin-toggle-attention]");
  if (toggleButton) {
    adminAttentionExpanded = toggleButton.dataset.adminToggleAttention === "show";
    renderAdminToday(adminLeadsCache);
    return;
  }

  const leadButton = event.target.closest("[data-admin-open-lead]");
  if (leadButton) {
    await openAdminLeadFromAlert(leadButton.dataset.adminOpenLead || "");
    return;
  }

  const filterButton = event.target.closest("[data-admin-set-filter]");
  if (filterButton) {
    setAdminLeadFilter(filterButton.dataset.adminSetFilter || "all");
    renderLeadWorkbench(adminLeadsCache);
    document.querySelector("#crm-leads")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const inventoryButton = event.target.closest("[data-open-inventory-filter]");
  if (inventoryButton) {
    setInventoryFilter(inventoryButton.dataset.openInventoryFilter || "active");
    renderInventoryWarehouse(inventoryCache);
    document.querySelector("#inventory-warehouse")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});
adminTodayListEl?.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-admin-dashboard-range]");
  if (!form) return;
  event.preventDefault();
  const result = validateDashboardRangeForm(form);
  if (!result.ok) return;
  adminDashboardRange = normalizeDashboardDateRange(result.range);
  saveDashboardDateRange(ADMIN_DASHBOARD_RANGE_KEY, adminDashboardRange);
  renderAdminToday(adminLeadsCache);
});
adminTodayListEl?.addEventListener("input", (event) => {
  const form = event.target.closest("[data-admin-dashboard-range]");
  if (!form) return;
  syncDashboardDateConstraints(form);
});
inventoryFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setInventoryFilter(button.dataset.inventoryFilter || "active");
    renderInventoryWarehouse(inventoryCache);
  });
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
    closeAdminDrawer();
    adminAuthStatus.textContent = "Admin Google sign-in required.";
    statusEl.textContent = "";
    usersStatusEl.textContent = "";
    dealersStatusEl.textContent = "";
    if (operationsSettingsStatus) operationsSettingsStatus.textContent = "";
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
    if (operationsSettingsStatus) operationsSettingsStatus.textContent = "";
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
  await Promise.all([loadLeads(), loadUsers(), loadDealers(), loadInventory(), loadOperationsSettings()]);
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

function ensureBusinessHoursGrid() {
  if (!businessHoursGrid || businessHoursGrid.children.length) return;
  businessHoursGrid.innerHTML = BUSINESS_DAYS.map(([day, label]) => `
    <div class="business-hours-row" data-day="${escapeHtml(day)}">
      <label class="checkbox-row">
        <input name="dayEnabled:${escapeHtml(day)}" type="checkbox" />
        <span>${escapeHtml(label)}</span>
      </label>
      <label>
        <span>Start</span>
        <input name="dayStart:${escapeHtml(day)}" type="time" />
      </label>
      <label>
        <span>End</span>
        <input name="dayEnd:${escapeHtml(day)}" type="time" />
      </label>
    </div>
  `).join("");
}

async function loadOperationsSettings() {
  if (!adminSession || !operationsSettingsForm) return;
  ensureBusinessHoursGrid();
  operationsSettingsStatus.textContent = "Loading operations settings...";
  const response = await fetch("/api/operations-settings", { headers: authHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!data.ok) {
    operationsSettingsStatus.textContent = formatApiError(data, "Unable to load operations settings.");
    return;
  }
  renderOperationsSettings(data.settings || {});
  operationsSettingsStatus.textContent = data.warning || "Operations settings loaded.";
}

function renderOperationsSettings(settings = {}) {
  ensureBusinessHoursGrid();
  const timezone = operationsSettingsForm.elements.timezone;
  if (timezone) timezone.value = settings.timezone || "America/Toronto";
  const byDay = new Map((settings.businessHours || []).map((item) => [String(item.day), item]));
  for (const [day] of BUSINESS_DAYS) {
    const item = byDay.get(day) || {};
    const enabled = operationsSettingsForm.elements[`dayEnabled:${day}`];
    const start = operationsSettingsForm.elements[`dayStart:${day}`];
    const end = operationsSettingsForm.elements[`dayEnd:${day}`];
    if (enabled) enabled.checked = item.enabled !== false;
    if (start) start.value = item.start || (day === "0" ? "10:00" : "09:00");
    if (end) end.value = item.end || (day === "0" ? "17:00" : "18:00");
  }
  const autoReply = settings.autoReply || {};
  operationsSettingsForm.elements.autoReplyEnabled.checked = Boolean(autoReply.enabled);
  operationsSettingsForm.elements.fromEmail.value = autoReply.fromEmail || "";
  operationsSettingsForm.elements.subject.value = autoReply.subject || "";
  operationsSettingsForm.elements.body.value = autoReply.body || "";
  const financeLease = settings.financeLease || {};
  operationsSettingsForm.elements.financeEnabled.checked = financeLease.financeEnabled !== false;
  operationsSettingsForm.elements.leaseEnabled.checked = financeLease.leaseEnabled !== false;
  operationsSettingsForm.elements.defaultPaymentMode.value = financeLease.defaultPaymentMode || "finance";
  operationsSettingsForm.elements.financeAnnualRate.value = financeLease.financeAnnualRate ?? 7.99;
  operationsSettingsForm.elements.leaseAnnualRate.value = financeLease.leaseAnnualRate ?? 7.99;
  operationsSettingsForm.elements.taxRate.value = financeLease.taxRate ?? 12;
  operationsSettingsForm.elements.defaultDownPaymentPercent.value = financeLease.defaultDownPaymentPercent ?? 10;
  operationsSettingsForm.elements.minimumDownPayment.value = financeLease.minimumDownPayment ?? 2500;
  operationsSettingsForm.elements.leaseResidualPercent.value = financeLease.leaseResidualPercent ?? 48;
  operationsSettingsForm.elements.defaultFinanceTerm.value = financeLease.defaultFinanceTerm || 72;
  operationsSettingsForm.elements.defaultLeaseTerm.value = financeLease.defaultLeaseTerm || 48;
  operationsSettingsForm.elements.financeTerms.value = (financeLease.financeTerms || [36, 48, 60, 72, 84]).join(",");
  operationsSettingsForm.elements.leaseTerms.value = (financeLease.leaseTerms || [24, 36, 48, 60]).join(",");
  operationsSettingsForm.elements.annualMileageAllowance.value = financeLease.annualMileageAllowance ?? 16000;
  operationsSettingsForm.elements.financeDisclaimer.value = financeLease.disclaimer || "Estimate only. Final approval, rate, term, taxes, fees, residual, and payment depend on the dealer and lender.";
}

async function saveOperationsSettings(event) {
  event.preventDefault();
  if (!adminSession || !operationsSettingsForm) return;
  const settings = operationsSettingsPayload();
  operationsSettingsStatus.textContent = "Saving operations settings...";
  const response = await fetch("/api/operations-settings", {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ settings })
  });
  const data = await response.json().catch(() => ({}));
  if (!data.ok) {
    operationsSettingsStatus.textContent = formatApiError(data, "Unable to save operations settings.");
    return;
  }
  renderOperationsSettings(data.settings || settings);
  operationsSettingsStatus.textContent = "Operations settings saved.";
}

function operationsSettingsPayload() {
  ensureBusinessHoursGrid();
  return {
    timezone: operationsSettingsForm.elements.timezone.value,
    businessHours: BUSINESS_DAYS.map(([day]) => ({
      day: Number(day),
      enabled: Boolean(operationsSettingsForm.elements[`dayEnabled:${day}`]?.checked),
      start: operationsSettingsForm.elements[`dayStart:${day}`]?.value || "09:00",
      end: operationsSettingsForm.elements[`dayEnd:${day}`]?.value || "18:00"
    })),
    autoReply: {
      enabled: Boolean(operationsSettingsForm.elements.autoReplyEnabled.checked),
      fromEmail: operationsSettingsForm.elements.fromEmail.value,
      subject: operationsSettingsForm.elements.subject.value,
      body: operationsSettingsForm.elements.body.value
    },
    financeLease: {
      financeEnabled: Boolean(operationsSettingsForm.elements.financeEnabled.checked),
      leaseEnabled: Boolean(operationsSettingsForm.elements.leaseEnabled.checked),
      defaultPaymentMode: operationsSettingsForm.elements.defaultPaymentMode.value,
      financeAnnualRate: operationsSettingsForm.elements.financeAnnualRate.value,
      leaseAnnualRate: operationsSettingsForm.elements.leaseAnnualRate.value,
      taxRate: operationsSettingsForm.elements.taxRate.value,
      defaultDownPaymentPercent: operationsSettingsForm.elements.defaultDownPaymentPercent.value,
      minimumDownPayment: operationsSettingsForm.elements.minimumDownPayment.value,
      leaseResidualPercent: operationsSettingsForm.elements.leaseResidualPercent.value,
      defaultFinanceTerm: operationsSettingsForm.elements.defaultFinanceTerm.value,
      defaultLeaseTerm: operationsSettingsForm.elements.defaultLeaseTerm.value,
      financeTerms: operationsSettingsForm.elements.financeTerms.value,
      leaseTerms: operationsSettingsForm.elements.leaseTerms.value,
      annualMileageAllowance: operationsSettingsForm.elements.annualMileageAllowance.value,
      disclaimer: operationsSettingsForm.elements.financeDisclaimer.value
    }
  };
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
    dealersStatusEl.textContent = "Supabase is not configured, so staff access can only be managed through Vercel env vars.";
  } else {
    dealersStatusEl.textContent = `${data.staff.length} approved staff account(s). Staff see only assigned Up Sheets, assigned tasks, and assigned inventory follow-up.`;
  }

  dealerStaffEmails = (data.staff || [])
    .filter((staff) => staff.active !== false)
    .map((staff) => String(staff.email || "").trim().toLowerCase())
    .filter(Boolean);
  dealersEl.innerHTML = (data.staff || []).map(renderDealer).join("") || "<p>No staff access yet.</p>";
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

  inventoryCache = data.inventory || [];
  renderInventoryWarehouse(inventoryCache);
  if (adminLeadsCache.length) renderLeadWorkbench(adminLeadsCache);
}

function renderInventoryWarehouse(inventory) {
  const filtered = filterInventory(inventory);
  renderInventorySummary(inventory);
  if (adminLeadsCache.length) renderAdminOverview(adminLeadsCache);
  const draftCount = inventory.filter((item) => ["draft", "review"].includes(String(item.status || "").toLowerCase())).length;
  const publishedCount = inventory.filter((item) => String(item.status || "").toLowerCase() === "published").length;
  const soldCount = inventory.filter((item) => String(item.status || "").toLowerCase() === "sold").length;
  inventoryStatusEl.textContent = `${filtered.length} shown of ${inventory.length} inventory listing(s). Draft ${draftCount} / Published ${publishedCount} / Sold ${soldCount}.`;
  inventoryEl.innerHTML = renderInventoryGroups(filtered) || "<p>No inventory listings in this view. Add a SELL lead as a draft inventory item first.</p>";
}

function filterInventory(inventory) {
  if (inventoryFilter === "all") return inventory;
  if (inventoryFilter === "active") return inventory.filter((item) => !["sold", "archived"].includes(String(item.status || "").toLowerCase()));
  if (inventoryFilter === "draft") return inventory.filter((item) => ["draft", "review"].includes(String(item.status || "").toLowerCase()));
  return inventory.filter((item) => String(item.status || "").toLowerCase() === inventoryFilter);
}

function renderInventorySummary(inventory) {
  if (!inventorySummaryEl) return;
  inventorySummaryEl.hidden = true;
  inventorySummaryEl.innerHTML = "";
}

function renderInventoryGroups(inventory) {
  const groups = [
    { title: "Published", caption: "Live on the Buy page.", status: "published" },
    { title: "Draft / review", caption: "Warehouse vehicles not public yet.", status: "draft" },
    { title: "Sold", caption: "Sold vehicles kept for owner history.", status: "sold" },
    { title: "Archived", caption: "Hidden listings no longer active.", status: "archived" }
  ].map((group) => ({
    ...group,
    listings: group.status === "draft"
      ? inventory.filter((item) => ["draft", "review"].includes(String(item.status || "").toLowerCase()))
      : inventory.filter((item) => String(item.status || "").toLowerCase() === group.status)
  })).filter((group) => group.listings.length);

  return groups.map((group) => `
    <section class="inventory-group inventory-group-${escapeHtml(group.status)}">
      <header>
        <div>
          <h3>${escapeHtml(group.title)}</h3>
          <p>${escapeHtml(group.caption)}</p>
        </div>
        <b>${group.listings.length}</b>
      </header>
      <div class="inventory-group-list">
        <div class="inventory-list-header" aria-hidden="true">
          <span>Vehicle</span>
          <span>Price and stock</span>
          <span>Photos</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        ${group.listings.map(renderInventoryListing).join("")}
      </div>
    </section>
  `).join("");
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
  const availablePhotos = Array.isArray(listing.availableLeadPhotos) ? listing.availableLeadPhotos : [];
  const selectedPhotoUrls = new Set(photos.map((photo) => String(photo.url || "").trim()).filter(Boolean));
  const canUnpublish = listing.status === "published";
  const canPublish = listing.status !== "published" && listing.status !== "sold";
  const canArchive = listing.status !== "archived";
  const publicOptionInputs = renderInventoryPublicOptionInputs(listing.publicOptions || {});
  const assignedTo = String(listing.assignedTo || "").trim();
  const stockRepField = dealerStaffEmails.length ? `
          <label>
            <span>Stock rep</span>
            <select name="assignedTo">
              <option value="">Unassigned</option>
              ${dealerStaffEmails.map((email) => `<option value="${escapeHtml(email)}" ${assignedTo === email ? "selected" : ""}>${escapeHtml(email)}</option>`).join("")}
            </select>
          </label>` : `
          <label>
            <span>Stock rep</span>
            <input name="assignedTo" type="email" value="${escapeHtml(assignedTo)}" placeholder="staff@example.com" />
          </label>`;
  const selectablePhotos = availablePhotos.length ? `
            <fieldset class="inventory-photo-picker">
              <legend>Replace public photos</legend>
              <input type="hidden" name="photoSelectionPresent" value="1" />
              ${availablePhotos.map((photo, index) => {
                const url = String(photo.url || "").trim();
                return `
                  <label>
                    <input type="checkbox" name="selectedPhotoUrls" value="${escapeHtml(url)}" ${selectedPhotoUrls.has(url) ? "checked" : ""} />
                    <img src="${escapeHtml(adminPhotoPreviewUrl(url))}" alt="${escapeHtml(photo.label || `Vehicle photo ${index + 1}`)}" loading="lazy" />
                    <span>${escapeHtml(photo.label || `Vehicle photo ${index + 1}`)}</span>
                    <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open</a>
                    <button type="button" class="link-danger" data-remove-inventory-photo="${escapeHtml(url)}">Remove from Buy page</button>
                    <button type="button" class="link-danger strong-danger" data-delete-inventory-photo="${escapeHtml(url)}">Delete file</button>
                  </label>
                `;
              }).join("")}
            </fieldset>` : "";
  const photoManager = listing.sourceLeadId ? `
          <section class="inventory-photo-summary inventory-photo-manager">
            <h4>Vehicle photos</h4>
            <p>Choose which Drive photos appear on the Buy page. Upload up to ${MAX_LEAD_PHOTOS} photos per vehicle, then check the public set.</p>
            <div class="inventory-photo-upload">
              <label>
                <span>Photo type</span>
                <select name="inventoryPhotoLabel">
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
                <input name="inventoryPhotos" type="file" accept="image/*" multiple />
              </label>
              <button type="button" data-upload-inventory-photos="${escapeHtml(listing.id || "")}">Upload photos</button>
              <button type="button" data-sync-inventory-photos="${escapeHtml(listing.id || "")}">Sync vehicle folder</button>
            </div>
            <p class="inventory-photo-status" aria-live="polite"></p>
            ${selectablePhotos}
            <div class="inventory-photo-list">
              ${photos.map((photo) => `<a href="${escapeHtml(photo.url)}" target="_blank" rel="noreferrer">${escapeHtml(photo.label || "Vehicle photo")}</a>`).join("") || "<span>No photos attached yet.</span>"}
            </div>
          </section>` : `
          <section class="inventory-photo-summary">
            <h4>Vehicle photos</h4>
            <p>This listing was not created from a SELL lead, so direct photo upload is not connected yet.</p>
            <div class="inventory-photo-list">
              ${photos.map((photo) => `<a href="${escapeHtml(photo.url)}" target="_blank" rel="noreferrer">${escapeHtml(photo.label || "Vehicle photo")}</a>`).join("") || "<span>No photos attached yet.</span>"}
            </div>
          </section>`;
  return `
    <form class="inventory-card-admin" data-id="${escapeHtml(listing.id || "")}" data-source-lead-id="${escapeHtml(listing.sourceLeadId || "")}">
      <input type="hidden" name="sourceLeadId" value="${escapeHtml(listing.sourceLeadId || "")}" />
      ${publicOptionInputs}
      <section class="inventory-list-row">
        <div class="inventory-list-col inventory-list-col-main">
          <strong>${escapeHtml(listing.title || "Untitled vehicle")}</strong>
          <div class="lead-list-subline">
            <span>${escapeHtml([listing.year, listing.make, listing.model, listing.series, listing.style].filter(Boolean).join(" ") || "-")}</span>
            <span>VIN ${escapeHtml(listing.vin || "-")}</span>
          </div>
        </div>
        <div class="inventory-list-col">
          <strong>${listing.price ? `$${formatNumber(listing.price)}` : "-"}</strong>
          <div class="lead-list-subline">
            <span>KM ${escapeHtml(formatNumber(listing.kilometers || 0))}</span>
            <span>${escapeHtml(listing.region || "-")}</span>
          </div>
        </div>
        <div class="inventory-list-col">
          <strong>${escapeHtml(String(photos.length))}</strong>
          <div class="lead-list-subline">
            <span>${escapeHtml(photos.length === 1 ? "photo" : "photos")}</span>
            <span>${escapeHtml(listing.publicOptions?.showPhotos ? "public" : "hidden")}</span>
          </div>
        </div>
        <div class="inventory-list-col">
          <strong class="status-pill status-${escapeHtml(cssToken(listing.status || "draft"))}">${escapeHtml(listing.status || "draft")}</strong>
          <div class="lead-list-subline">
            <span>${escapeHtml(listing.sourceLeadId ? "From SELL lead" : "Manual listing")}</span>
            <span>${escapeHtml(assignedTo ? `Responsible ${shortEmail(assignedTo)}` : "No responsible rep")}</span>
          </div>
        </div>
        <div class="inventory-actions inventory-list-actions">
          <button type="button" data-inventory-status="${escapeHtml(listing.id || "")}" data-status="published" ${canPublish ? "" : "disabled"}>Publish</button>
          <button class="secondary-action" type="button" data-inventory-status="${escapeHtml(listing.id || "")}" data-status="draft" ${canUnpublish ? "" : "disabled"}>Unpublish</button>
          <button class="secondary-action" type="button" data-inventory-status="${escapeHtml(listing.id || "")}" data-status="sold">Mark sold</button>
          <button class="secondary-action" type="button" data-inventory-status="${escapeHtml(listing.id || "")}" data-status="archived" ${canArchive ? "" : "disabled"}>Archive</button>
          <button class="danger-outline" type="button" data-remove-inventory="${escapeHtml(listing.id || "")}">Move out</button>
        </div>
      </section>
      <details class="inventory-edit-details">
        <summary>Edit listing details</summary>
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
            <span>VIN</span>
            <input name="vin" value="${escapeHtml(listing.vin || "")}" />
          </label>
          <label>
            <span>UVC</span>
            <input name="uvc" value="${escapeHtml(listing.uvc || "")}" />
          </label>
          <label>
            <span>Year</span>
            <input name="vehicleYear" type="number" min="1900" max="2100" step="1" value="${escapeHtml(listing.year || "")}" />
          </label>
          <label>
            <span>Make</span>
            <input name="make" value="${escapeHtml(listing.make || "")}" />
          </label>
          <label>
            <span>Model</span>
            <input name="model" value="${escapeHtml(listing.model || "")}" />
          </label>
          <label>
            <span>Trim / series</span>
            <input name="series" value="${escapeHtml(listing.series || "")}" />
          </label>
          <label>
            <span>Style</span>
            <input name="style" value="${escapeHtml(listing.style || "")}" />
          </label>
          <label>
            <span>Kilometers</span>
            <input name="kilometers" type="number" min="0" step="1" value="${escapeHtml(listing.kilometers || "")}" />
          </label>
          <label>
            <span>Color</span>
            <input name="color" value="${escapeHtml(listing.color || "")}" />
          </label>
          <label>
            <span>Region</span>
            <input name="region" value="${escapeHtml(listing.region || "")}" />
          </label>
          <label>
            <span>Status</span>
            <select name="status">
              ${["draft", "review", "published", "sold", "archived"].map((status) =>
                `<option value="${status}" ${listing.status === status ? "selected" : ""}>${status}</option>`
              ).join("")}
            </select>
          </label>
          ${listing.sourceLeadId ? stockRepField : ""}
          <label class="inventory-description">
            <span>Description</span>
            <textarea name="description">${escapeHtml(listing.description || "")}</textarea>
          </label>
          ${photoManager}
        </div>
        <button type="button" data-save-inventory-listing>Save listing details</button>
      </details>
    </form>
  `;
}

function renderInventoryPublicOptionInputs(options) {
  const defaults = {
    showVin: true,
    showUvc: false,
    showKilometers: true,
    showRegion: true,
    showColor: true,
    showMaintenance: false
  };
  return Object.entries(defaults).map(([key, defaultValue]) => {
    const enabled = Object.prototype.hasOwnProperty.call(options || {}, key) ? options[key] === true : defaultValue;
    return enabled ? `<input type="hidden" name="${escapeHtml(key)}" value="on" />` : "";
  }).join("");
}

function adminPhotoPreviewUrl(url) {
  const value = String(url || "");
  const fileMatch = value.match(/\/d\/([^/]+)/);
  const idMatch = value.match(/[?&]id=([^&]+)/);
  const id = fileMatch?.[1] || idMatch?.[1] || "";
  return id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w240` : value;
}

function renderDealer(staff) {
  const removable = staff.source !== "vercel_env";
  return `
    <article class="user-limit-card dealer-staff-card" data-email="${escapeHtml(staff.email)}">
      <div>
        <strong>${escapeHtml(staff.email)}</strong>
        <span>${staff.source === "vercel_env" ? "Env-managed staff login" : "Team access list"}</span>
      </div>
      <div>
        <span>Role</span>
        <b>Staff rep</b>
      </div>
      <div>
        <span>Status</span>
        <b>${staff.active === false ? "Inactive" : "Active"}</b>
      </div>
      <div>
        <span>Added by</span>
        <b>${escapeHtml(staff.created_by || "-")}</b>
      </div>
      <button type="button" data-remove-dealer="${escapeHtml(staff.email)}" ${removable ? "" : "disabled"}>${removable ? "Remove access" : "Env locked"}</button>
    </article>
  `;
}

async function addDealer(event) {
  event.preventDefault();
  if (!adminSession) return;

  const email = String(new FormData(dealerStaffForm).get("email") || "").trim();
  dealersStatusEl.textContent = "Adding staff access...";
  const response = await fetch("/api/dealer-staff", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  const data = await response.json();
  dealersStatusEl.textContent = data.ok ? "Staff access saved." : formatApiError(data, "Unable to save staff access.");
  if (data.ok) {
    dealerStaffForm.reset();
    await loadDealers();
  }
}

async function recoverHiddenLead(event) {
  event.preventDefault();
  if (!adminSession || !leadRecoveryForm) return;

  const formData = new FormData(leadRecoveryForm);
  const driveFolderUrl = String(formData.get("driveFolderUrl") || "").trim();
  const vehicleQuery = String(formData.get("vehicleQuery") || "").trim();
  if (!driveFolderUrl && !vehicleQuery) {
    if (leadRecoveryStatus) leadRecoveryStatus.textContent = "Enter a Drive folder URL, vehicle, VIN, email, or phone first.";
    return;
  }
  const action = driveFolderUrl ? "recover_drive_folder" : "recover_vehicle_search";
  if (leadRecoveryStatus) {
    leadRecoveryStatus.textContent = driveFolderUrl
      ? "Searching CRM records for this Drive folder..."
      : `Searching hidden and active SELL leads for "${vehicleQuery}"...`;
  }
  const response = await fetch("/api/leads", {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      driveFolderUrl,
      vehicleQuery
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!data.ok) {
    if (leadRecoveryStatus) leadRecoveryStatus.textContent = formatApiError(data, "Unable to recover this Drive folder.");
    return;
  }
  const lead = data.recovered?.[0] || data.found?.[0] || null;
  if (leadRecoveryStatus) {
    const recoveredCount = Number(data.recoveredCount || data.recovered?.length || 0);
    const foundCount = Number(data.foundCount || data.found?.length || 0);
    const inventoryCount = Number(data.inventoryCount || data.stillInInventory?.length || 0);
    leadRecoveryStatus.textContent = [
      recoveredCount ? `Recovered ${recoveredCount}` : "",
      foundCount ? `Already active ${foundCount}` : "",
      inventoryCount ? `Still in inventory ${inventoryCount}` : "",
      "Reloading Up Sheets..."
    ].filter(Boolean).join(". ");
  }
  leadRecoveryForm.reset();
  setAdminLeadFilter(data.recovered?.length ? "restored" : "active");
  await Promise.all([loadLeads({ suppressAlerts: true, forceOpenActivity: true }), loadInventory()]);
  if (lead?.id) {
    await openAdminLeadFromAlert(lead.id);
  } else {
    document.querySelector("#crm-leads")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  renderLeadWorkbench(adminLeadsCache, options);
  if (data.storage === "not_configured") {
    statusEl.textContent = "Lead storage is not configured on this deployment. Add Supabase env vars to persist leads.";
  }
  await restoreOpenLeads(openIds, { forceActivity: Boolean(options.forceOpenActivity) });
  if (pendingAdminDeepLinkLeadId) {
    const leadId = pendingAdminDeepLinkLeadId;
    pendingAdminDeepLinkLeadId = "";
    await openAdminLeadFromAlert(leadId);
  }
}

function collectAdminLeadAlerts(leads) {
  const readTokens = loadAdminLeadReadTokens();
  let readTokensChanged = false;
  if (!adminLeadSnapshotReady) {
    for (const lead of leads) {
      const id = String(lead.id || "");
      if (!id) continue;
      const token = leadUpdateToken(lead);
      if (lead.owner_review?.unread) {
        adminLeadAlertMap.set(id, {
          id,
          type: "owner",
          title: leadAlertTitle(lead),
          message: lead.owner_review.reason || "Manager review required"
        });
      } else if (readTokens[id] !== token) {
        readTokens[id] = token;
        readTokensChanged = true;
      }
    }
    if (readTokensChanged) saveAdminLeadReadTokens(readTokens);
    adminLeadTokenMap = new Map(leads
      .map((lead) => [String(lead.id || ""), leadUpdateToken(lead)])
      .filter(([id]) => Boolean(id)));
    adminLeadSnapshotReady = true;
    return;
  }
  const nextMap = new Map();
  for (const lead of leads) {
    const id = String(lead.id || "");
    if (!id) continue;
    const token = leadUpdateToken(lead);
    nextMap.set(id, token);
    if (lead.owner_review?.unread) {
      adminLeadAlertMap.set(id, {
        id,
        type: "owner",
        title: leadAlertTitle(lead),
        message: lead.owner_review.reason || "Manager review required"
      });
    } else if (lead.duplicate_warning?.message && !lead.duplicate_warning?.reviewed && shouldShowAdminPassiveAlert(readTokens, id, token)) {
      adminLeadAlertMap.set(id, {
        id,
        type: "owner",
        title: leadAlertTitle(lead),
        message: lead.duplicate_warning.message
      });
    } else if (lead.vehicle_signal?.message && shouldShowAdminPassiveAlert(readTokens, id, token)) {
      adminLeadAlertMap.set(id, {
        id,
        type: lead.vehicle_signal.tone === "danger" ? "owner" : "updated",
        title: leadAlertTitle(lead),
        message: lead.vehicle_signal.message
      });
    } else if (readTokens[id] && readTokens[id] !== token) {
      adminLeadAlertMap.set(id, {
        id,
        type: "updated",
        title: leadAlertTitle(lead),
        message: "Timeline changed since you last opened it"
      });
    } else {
      adminLeadAlertMap.delete(id);
      if (!readTokens[id]) {
        readTokens[id] = token;
        readTokensChanged = true;
      }
    }
  }
  if (readTokensChanged) saveAdminLeadReadTokens(readTokens);
  adminLeadTokenMap = nextMap;
}

function adminAlertVisibleId(id) {
  return resolveVisibleAdminLeadId(id) || String(id || "").trim();
}

function buildAdminVisibleAlertGroups() {
  const groups = new Map();
  for (const alert of adminLeadAlertMap.values()) {
    const visibleId = adminAlertVisibleId(alert.id);
    if (!visibleId) continue;
    const current = groups.get(visibleId) || {
      id: visibleId,
      type: "updated",
      title: alert.title || "Vehicle lead",
      message: alert.message || "",
      count: 0,
      memberIds: []
    };
    current.count += 1;
    current.memberIds.push(String(alert.id || "").trim());
    if (alert.type === "owner") current.type = "owner";
    if (!current.message) current.message = alert.message || "";
    groups.set(visibleId, current);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    message: group.count > 1 ? `${group.count} updates in this vehicle cluster` : group.message
  }));
}

function hasAdminVisibleAlert(leadId) {
  const visibleId = adminAlertVisibleId(leadId);
  if (!visibleId) return false;
  for (const alert of adminLeadAlertMap.values()) {
    if (adminAlertVisibleId(alert.id) === visibleId) return true;
  }
  return false;
}

function clearAdminVisibleAlertGroup(id) {
  const visibleId = adminAlertVisibleId(id);
  if (!visibleId) return;
  const relatedIds = adminLeadsCache
    .filter((lead) => adminAlertVisibleId(lead.id) === visibleId)
    .map((lead) => String(lead.id || "").trim())
    .filter(Boolean);
  for (const leadId of relatedIds) {
    const lead = adminLeadsCache.find((item) => String(item.id || "") === leadId);
    if (!lead?.owner_review?.unread) markAdminLeadTokenRead(leadId);
    adminLeadAlertMap.delete(leadId);
  }
}

function rememberAdminLeadTokens(leads) {
  adminLeadTokenMap = new Map(leads
    .map((lead) => [String(lead.id || ""), leadUpdateToken(lead)])
    .filter(([id]) => Boolean(id)));
  const readTokens = loadAdminLeadReadTokens();
  let changed = false;
  for (const lead of leads) {
    const id = String(lead.id || "");
    if (!id || lead.owner_review?.unread) continue;
    readTokens[id] = leadUpdateToken(lead);
    changed = true;
  }
  if (changed) saveAdminLeadReadTokens(readTokens);
  adminLeadSnapshotReady = true;
}

function loadAdminLeadReadTokens() {
  try {
    return JSON.parse(window.localStorage.getItem(ADMIN_LEAD_READ_TOKENS_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveAdminLeadReadTokens(tokens) {
  try {
    window.localStorage.setItem(ADMIN_LEAD_READ_TOKENS_KEY, JSON.stringify(tokens || {}));
  } catch {
    // localStorage is best-effort; owner_review remains persisted in Supabase.
  }
}

function markAdminLeadTokenRead(id) {
  const lead = adminLeadsCache.find((item) => String(item.id || "") === String(id || ""));
  if (!lead) return;
  const readTokens = loadAdminLeadReadTokens();
  readTokens[String(id)] = leadUpdateToken(lead);
  saveAdminLeadReadTokens(readTokens);
}

function shouldShowAdminPassiveAlert(readTokens, id, token) {
  return !readTokens[id] || readTokens[id] !== token;
}

function leadUpdateToken(lead = {}) {
  const summary = lead.activity_summary || {};
  const signal = lead.vehicle_signal || {};
  const duplicate = lead.duplicate_warning || {};
  return [
    lead.last_activity_at || "",
    summary.latest_activity_at || "",
    summary.latest_activity_type || "",
    summary.latest_activity_by || "",
    signal.code || "",
    signal.at || "",
    duplicate.message || "",
    duplicate.reviewed ? "reviewed" : ""
  ].join("|");
}

function leadAlertTitle(lead = {}) {
  const input = lead.input || {};
  const valuation = lead.valuation || {};
  const buyer = isBuyerLead(lead);
  return cleanLeadTitle(valuation.title || [input.year, input.make, input.model, input.series, input.style].filter(Boolean).join(" "), buyer) || "Vehicle lead";
}

function vehicleSignalInline(lead) {
  const signal = lead?.vehicle_signal;
  if (!signal || !signal.message) return "";
  const tone = ["danger", "warning", "info"].includes(String(signal.tone || "").toLowerCase()) ? String(signal.tone).toLowerCase() : "warning";
  return `<p class="lead-vehicle-signal lead-vehicle-signal-${escapeHtml(tone)}">${escapeHtml(signal.message)}</p>`;
}

function vehicleContextInline(lead) {
  const context = lead?.vehicle_context;
  if (!context) return "";
  const pills = [];
  if (context.active_buyer_count > 0) pills.push(`${context.active_buyer_count} active buyer lead${context.active_buyer_count === 1 ? "" : "s"}`);
  if (context.has_active_offer) pills.push("offer already active");
  if (context.sold_elsewhere) pills.push("vehicle sold");
  if (context.off_market) pills.push("off market");
  if (context.primary_inventory_status) pills.push(`warehouse ${String(context.primary_inventory_status).replaceAll("_", " ")}`);
  if (!pills.length && !context.related_lead_count) return "";
  return `
    <section class="lead-vehicle-context">
      <span>Same vehicle file</span>
      <strong>${escapeHtml(context.cluster_label || "Same vehicle activity")}</strong>
      <small>${escapeHtml(pills.join(" | ") || "Related vehicle activity found.")}</small>
      ${context.primary_lead_id ? `<small>Primary record ${escapeHtml(context.primary_lead_title || "vehicle file")}${context.primary_listing_id ? " | linked to warehouse" : ""}</small>` : ""}
    </section>
  `;
}

function mergeStateInline(lead) {
  const state = lead?.merge_state;
  if (!state?.kind) return "";
  if (state.kind === "merged") {
    return `
      <section class="owner-review-read duplicate-vehicle-reviewed">
        <span>Merged into the primary vehicle file${state.at ? ` ${escapeHtml(formatDateTime(state.at))}` : ""}</span>
      </section>
    `;
  }
  return `
    <section class="owner-review-read duplicate-vehicle-reviewed">
      <span>Linked to the warehouse listing${state.at ? ` ${escapeHtml(formatDateTime(state.at))}` : ""}</span>
    </section>
  `;
}

function duplicateWarningInline(lead) {
  const duplicate = lead?.duplicate_warning;
  if (!duplicate?.message) return "";
  if (duplicate.reviewed) {
    return `
      <section class="owner-review-read duplicate-vehicle-reviewed">
        <span>Duplicate seller review completed${duplicate.reviewed_at ? ` ${escapeHtml(formatDateTime(duplicate.reviewed_at))}` : ""}${duplicate.reviewed_by ? ` by ${escapeHtml(duplicate.reviewed_by)}` : ""}</span>
      </section>
    `;
  }
  const currentId = String(lead?.id || "").trim();
  const mergeTargetId = String(lead?.vehicle_context?.primary_lead_id || "").trim();
  const safeMergeTargetId = mergeTargetId && mergeTargetId !== currentId ? mergeTargetId : "";
  const listingId = String(lead?.vehicle_context?.primary_listing_id || "").trim();
  const warehouseLinkButton = listingId
    ? `<button type="button" data-duplicate-review="link_inventory" data-target-lead-id="${escapeHtml(safeMergeTargetId)}" data-listing-id="${escapeHtml(listingId)}">Link warehouse</button>`
    : "";
  const mergeAllTargetId = safeMergeTargetId || currentId;
  return `
    <section class="owner-review-required duplicate-vehicle-warning" data-drawer-section="duplicate">
      <div>
        <span>Same vehicle review</span>
        <strong>Possible same vehicle. Review before warehouse.</strong>
        <small>Choose one primary CRM file, then fold duplicate seller leads into it.</small>
      </div>
      <div class="duplicate-review-actions">
        <button type="button" data-duplicate-review="keep_separate">Keep separate</button>
        <button type="button" data-duplicate-review="merge_existing" data-target-lead-id="${escapeHtml(safeMergeTargetId)}" ${safeMergeTargetId ? "" : "disabled"}>Merge into primary</button>
        <button type="button" data-duplicate-review="merge_all_existing" data-target-lead-id="${escapeHtml(mergeAllTargetId)}">Merge all into this file</button>
        ${warehouseLinkButton}
        <a class="duplicate-review-link" href="${escapeHtml(adminVehicleClusterUrl(lead))}" target="_blank" rel="noreferrer">Review vehicle file</a>
      </div>
    </section>
  `;
}

function renderAdminLeadAlerts() {
  if (!adminLeadAlertsEl) return;
  const alerts = buildAdminVisibleAlertGroups();
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
  if (adminLeadsCache.length) renderAdminToday(adminLeadsCache);
}

async function openAdminLeadFromAlert(id) {
  if (!id) return;
  if (!adminLeadsCache.some((lead) => String(lead.id || "") === id)) {
    await loadLeads({ suppressAlerts: true, forceOpenActivity: true });
  }
  const visibleId = resolveVisibleAdminLeadId(id);
  let card = leadsEl.querySelector(`.lead-card[data-id="${cssEscape(visibleId)}"]`);
  if (!card && adminLeadFilter !== "all") {
    setAdminLeadFilter("all");
    renderLeadWorkbench(adminLeadsCache);
    card = leadsEl.querySelector(`.lead-card[data-id="${cssEscape(visibleId)}"]`);
  }
  if (!card) return;
  setActiveAdminLead(visibleId);
  clearAdminVisibleAlertGroup(id);
  const lead = adminLeadsCache.find((item) => String(item.id || "") === visibleId) || adminLeadsCache.find((item) => String(item.id || "") === id);
  if (lead?.owner_review?.unread) {
    await markManagerReviewedByLeadId(String(lead.id || id), { silent: true, reload: false }).catch(() => null);
    lead.owner_review.unread = false;
  }
  renderAdminLeadAlerts();
  removeAdminInlineAlertButtons(card, id);
  card.classList.remove("lead-card-updated");
  card.classList.add("lead-card-flash");
  window.setTimeout(() => card.classList.remove("lead-card-flash"), 1600);
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  const details = card.querySelector(".lead-queue-more");
  if (details) details.open = true;
  highlightLeadChangeAreas(card);
  renderAdminDrawer(id);
  adminDrawerActivityLoaded = false;
  await loadAdminDrawerActivity({ force: true, highlightLatest: true });
}

function removeAdminInlineAlertButtons(card, id) {
  const visibleId = adminAlertVisibleId(id);
  card?.querySelectorAll("[data-admin-open-alert], [data-admin-open-lead]").forEach((button) => {
    const target = button.dataset.adminOpenAlert || button.dataset.adminOpenLead || "";
    if (!visibleId || adminAlertVisibleId(target) === visibleId) button.remove();
  });
}

function renderLeadWorkbench(leads, options = {}) {
  const filtered = filterAdminLeads(leads);
  const sorted = sortAdminLeads(filtered);
  const collapsed = collapseVisibleAdminLeads(sorted);
  const buyerCount = leads.filter(isBuyerLead).length;
  const sellerCount = leads.length - buyerCount;
  const activeCount = leads.filter((lead) => !isClosedLead(lead)).length;
  const closedCount = leads.length - activeCount;
  const searchLabel = adminLeadSearch.trim() ? ` Search: "${adminLeadSearch.trim()}".` : "";
  const sortLabel = adminLeadSort === "oldest" ? "Oldest first" : "Newest first";
  const duplicateLabel = collapsed.hiddenSellerDuplicates > 0
    ? ` ${collapsed.hiddenSellerDuplicates} duplicate SELL lead${collapsed.hiddenSellerDuplicates === 1 ? "" : "s"} collapsed into Vehicle clusters.`
    : "";
  statusEl.textContent = `${collapsed.visible.length} shown. ${activeCount} active / ${closedCount} closed. ${buyerCount} BUY / ${sellerCount} SELL. Sort: ${sortLabel}, with urgent, overdue, and new pinned first.${duplicateLabel}${searchLabel}`;
  leadsEl.innerHTML = `${renderDuplicateVehicleBlocks(sorted)}${renderLeadGroups(collapsed.visible)}`;
  syncActiveAdminLeadCard();
  if (activeAdminDrawerLeadId) {
    if (adminLeadsCache.some((lead) => String(lead.id || "") === activeAdminDrawerLeadId)) {
      if (options.refreshActiveDrawer && !isEditingAdminDrawer()) {
        renderAdminDrawer(activeAdminDrawerLeadId);
      }
    } else {
      closeAdminDrawer();
    }
  }
}

function setAdminLeadFilter(filter) {
  adminLeadFilter = filter || "all";
  adminLeadFilterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.adminLeadFilter === adminLeadFilter);
  });
}

function setInventoryFilter(filter) {
  inventoryFilter = filter || "active";
  inventoryFilterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.inventoryFilter === inventoryFilter);
  });
}

function filterAdminLeads(leads) {
  let filtered = leads;
  if (adminLeadFilter === "active") filtered = leads.filter((lead) => !isClosedLead(lead));
  if (adminLeadFilter === "restored") filtered = leads.filter((lead) => !isClosedLead(lead) && Boolean(lead.warehouse_restore?.restored));
  if (adminLeadFilter === "closed") filtered = leads.filter(isClosedLead);
  if (adminLeadFilter === "fresh") filtered = leads.filter((lead) => !isClosedLead(lead) && String(lead.status || "new").toLowerCase() === "new");
  if (adminLeadFilter === "delivered") filtered = leads.filter((lead) => ["delivered", "sold", "won"].includes(String(lead.status || "").toLowerCase()));
  if (adminLeadFilter === "lost") filtered = leads.filter((lead) => ["lost", "failed"].includes(String(lead.status || "").toLowerCase()));
  if (adminLeadFilter === "inactive") filtered = leads.filter((lead) => isClosedLead(lead) && !["delivered", "sold", "won", "lost", "failed", "deleted"].includes(String(lead.status || "").toLowerCase()));
  if (adminLeadFilter === "deleted") filtered = leads.filter((lead) => ["deleted", "archived"].includes(String(lead.status || "").toLowerCase()));
  if (adminLeadFilter === "call-now") filtered = leads.filter(isAdminCallNowLead);
  if (adminLeadFilter === "waiting-reply") filtered = leads.filter(isAdminWaitingReplyLead);
  if (adminLeadFilter === "deal-desk") filtered = leads.filter(isAdminDealDeskLead);
  if (adminLeadFilter === "aging-critical") filtered = leads.filter(isAdminAgingCriticalLead);
  if (adminLeadFilter === "owner-unread") filtered = leads.filter((lead) => Boolean(lead.owner_review?.unread));
  if (adminLeadFilter === "manager-approval") {
    filtered = leads.filter((lead) => {
      if (lead.owner_review?.unread) return true;
      if (isClosedLead(lead)) return false;
      const status = String(lead.status || "").toLowerCase();
      return !isBuyerLead(lead) && ["offer_sent", "won", "in_inventory"].includes(status);
    });
  }
  if (adminLeadFilter === "duplicate-review") filtered = leads.filter((lead) => !isClosedLead(lead) && Boolean(lead.duplicate_warning?.message) && !lead.duplicate_warning?.reviewed);
  if (adminLeadFilter === "buyer") filtered = leads.filter((lead) => !isClosedLead(lead) && isBuyerLead(lead));
  if (adminLeadFilter === "seller") filtered = leads.filter((lead) => !isClosedLead(lead) && !isBuyerLead(lead));
  if (adminLeadFilter === "unassigned") filtered = leads.filter((lead) => !isClosedLead(lead) && !String(lead.assigned_to || "").trim());
  if (adminLeadFilter === "open-tasks") filtered = leads.filter((lead) => !isClosedLead(lead) && hasAdminOpenTask(lead));
  if (adminLeadFilter === "urgent") filtered = leads.filter((lead) => !isClosedLead(lead) && String(lead.priority || "").toLowerCase() === "urgent");
  if (adminLeadFilter === "stale") filtered = leads.filter((lead) => isAdminStaleLead(lead));
  if (adminLeadFilter === "appointments") filtered = leads.filter((lead) => isAdminAppointmentLead(lead));
  if (adminLeadFilter === "needs-follow-up") {
    filtered = leads.filter((lead) => !isClosedLead(lead) && isFollowUpDue(lead.next_follow_up_at, lead.status || "new"));
  }
  const query = adminLeadSearch.trim().toLowerCase();
  if (!query) return filtered;
  const terms = query.split(/\s+/).filter(Boolean);
  return filtered.filter((lead) => {
    const haystack = searchableLeadText(lead);
    return terms.every((term) => haystack.includes(term));
  });
}

function hasAdminOpenTask(lead) {
  return Number(lead?.task_summary?.open_count || 0) > 0;
}

function renderDuplicateVehicleBlocks(leads) {
  const groups = new Map();
  leads
    .filter((lead) => !isBuyerLead(lead) && !isClosedLead(lead) && shouldGroupSellerLead(lead))
    .forEach((lead) => {
      const key = adminVehicleClusterKey(lead);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(lead);
    });
  const duplicateGroups = [...groups.entries()]
    .map(([key, members]) => ({
      key,
      members: members.sort(compareAdminLeadOrder),
      flagged: members.some((lead) => lead.duplicate_warning?.message && !lead.duplicate_warning?.reviewed)
    }))
    .filter((group) => group.members.length > 1 || group.flagged)
    .sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.members.length - a.members.length)
    .slice(0, 5);

  if (!duplicateGroups.length) return "";
  return `
    <section class="duplicate-cluster-block" aria-label="Duplicate vehicle review">
      <header>
        <div>
          <span>Manager alert</span>
          <h3>Duplicate vehicle review</h3>
          <p>These SELL leads look like the same vehicle. Pick one primary record before warehouse work.</p>
        </div>
        <b>${duplicateGroups.length}</b>
      </header>
      <div class="duplicate-cluster-list">
        ${duplicateGroups.map(renderDuplicateVehicleCluster).join("")}
      </div>
    </section>
  `;
}

function renderDuplicateVehicleCluster(group) {
  const primary = group.members[0] || {};
  const title = cleanLeadTitle(primary.valuation?.title || historyVehicleTitle(primary.input || {}) || "Vehicle lead", false);
  const vin = primary.valuation?.vin || primary.input?.vin || "";
  const warning = group.members.find((lead) => lead.duplicate_warning?.message && !lead.duplicate_warning?.reviewed)?.duplicate_warning?.message
    || `${group.members.length} seller leads may reference the same vehicle.`;
  return `
    <article class="duplicate-cluster-card">
      <div class="duplicate-cluster-main">
        <b>Same vehicle group</b>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(`${group.members.length} seller lead${group.members.length === 1 ? "" : "s"}${vin ? ` | VIN ${vin}` : ""}`)}</span>
        <small>${escapeHtml(warning)}</small>
      </div>
      <div class="duplicate-cluster-members">
        ${group.members.map((lead) => {
          const input = lead.input || {};
          const valuation = lead.valuation || {};
          const label = input.email || input.phone || lead.auth_email || "Seller lead";
          const status = leadStatusLabel(lead.status || "new", false);
          return `<button type="button" data-admin-open-lead="${escapeHtml(lead.id || "")}">
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(status)} | ${escapeHtml(formatDateTime(lead.created_at))}</span>
            <small>${escapeHtml(valuation.vin || input.vin || "No VIN")}</small>
          </button>`;
        }).join("")}
      </div>
      <div class="duplicate-cluster-actions">
        <button type="button" data-admin-open-lead="${escapeHtml(primary.id || "")}">Review lead</button>
        <button type="button" data-admin-set-filter="duplicate-review">Show duplicate queue</button>
      </div>
    </article>
  `;
}

function duplicateReviewDecision(lead) {
  return String(lead?.duplicate_warning?.decision || "").trim().toLowerCase();
}

function shouldGroupSellerLead(lead) {
  return !(lead?.duplicate_warning?.reviewed && duplicateReviewDecision(lead) === "keep_separate");
}

function sortAdminLeads(leads) {
  return [...leads].sort(compareAdminLeadOrder);
}

function compareAdminLeadOrder(a, b) {
  const pinnedDiff = adminLeadPinnedRank(a) - adminLeadPinnedRank(b);
  if (pinnedDiff) return pinnedDiff;
  const timeDiff = leadCreatedTimestamp(b) - leadCreatedTimestamp(a);
  if (timeDiff) return adminLeadSort === "oldest" ? -timeDiff : timeDiff;
  return String(b.id || "").localeCompare(String(a.id || ""));
}

function adminLeadPinnedRank(lead) {
  if (isClosedLead(lead)) return 7;
  if (lead?.owner_review?.unread || hasAdminVisibleAlert(lead?.id)) return 0;
  if (lead?.duplicate_warning?.message && !lead?.duplicate_warning?.reviewed) return 1;
  if (lead?.vehicle_signal?.message) return 2;
  if (lead?.warehouse_restore?.restored) return 2.5;
  const status = lead.status || "new";
  if (String(lead.priority || "").toLowerCase() === "urgent") return 3;
  if (isOverdue(lead.next_follow_up_at || "", status)) return 4;
  if (String(status).toLowerCase() === "new") return 5;
  return 6;
}

function leadCreatedTimestamp(lead) {
  const value = lead?.created_at || lead?.last_activity_at || lead?.next_follow_up_at || 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function leadRecentTouchTimestamp(lead) {
  const timestamps = [
    lead?.last_activity_at,
    lead?.updated_at,
    lead?.next_follow_up_at,
    lead?.created_at
  ]
    .map((value) => new Date(value || 0).getTime())
    .filter((value) => !Number.isNaN(value) && value > 0);
  return timestamps.length ? Math.max(...timestamps) : 0;
}

function isAdminStaleLead(lead) {
  if (isClosedLead(lead)) return false;
  const touchedAt = leadRecentTouchTimestamp(lead);
  if (!touchedAt) return true;
  return touchedAt < Date.now() - (48 * 60 * 60 * 1000);
}

function isAdminAppointmentLead(lead) {
  if (isClosedLead(lead)) return false;
  return ["appointment_booked", "inspection_booked"].includes(String(lead?.status || "").toLowerCase());
}

function isAdminWaitingReplyLead(lead) {
  if (isClosedLead(lead)) return false;
  return String(lead?.status || "").toLowerCase() === "waiting_for_customer";
}

function isAdminCallNowLead(lead) {
  if (isClosedLead(lead)) return false;
  return ["high", "urgent"].includes(String(lead?.priority || "").toLowerCase())
    || isFollowUpDue(lead?.next_follow_up_at || "", lead?.status || "new")
    || String(lead?.status || "").toLowerCase() === "new";
}

function isAdminDealDeskLead(lead) {
  const status = String(lead?.status || "").toLowerCase();
  if (isBuyerLead(lead)) return status === "won";
  return ["in_inventory", "won"].includes(status);
}

function adminDealDeskLabel(lead) {
  const status = String(lead?.status || "").toLowerCase();
  if (isBuyerLead(lead)) return "Delivery handoff";
  if (status === "in_inventory") return "Warehouse intake";
  return "Purchase closed";
}

function adminDealChecklistTemplate(lead) {
  const status = String(lead?.status || "").toLowerCase();
  if (isBuyerLead(lead) && status === "won") {
    return [
      { key: "docs_ready", label: "Docs ready" },
      { key: "keys_ready", label: "Keys ready" },
      { key: "delivery_booked", label: "Delivery booked" },
      { key: "vehicle_picked_up", label: "Vehicle picked up" }
    ];
  }
  if (!isBuyerLead(lead) && ["in_inventory", "won"].includes(status)) {
    return [
      { key: "intake_photos_complete", label: "Intake photos complete" },
      { key: "keys_collected", label: "Keys collected" },
      { key: "pricing_approved", label: "Pricing approved" },
      { key: "publish_review_complete", label: "Publish review complete" }
    ];
  }
  return [];
}

function adminDealChecklistSummary(lead) {
  return lead?.activity_summary?.deal_desk || {
    total: 0,
    completed: 0,
    pending: 0,
    progress_label: "",
    items: [],
    delivery_at: "",
    key_handoff_status: "pending",
    key_handoff_label: "Key handoff pending"
  };
}

function adminDealChecklistProgressLabel(lead) {
  return String(adminDealChecklistSummary(lead)?.progress_label || "").trim();
}

function renderAdminDealChecklistSection(lead) {
  if (!isAdminDealDeskLead(lead)) return "";
  const summary = adminDealChecklistSummary(lead);
  const items = Array.isArray(summary.items) && summary.items.length
    ? summary.items
    : adminDealChecklistTemplate(lead).map((item) => ({ ...item, completed: false, completed_at: "" }));
  const missingCount = items.filter((item) => !item.completed).length;
  return `
    <section class="admin-drawer-section" data-drawer-section="dealdesk">
      <header>
        <h3>Deal desk checklist</h3>
        <span>${escapeHtml(summary.progress_label || "Checklist 0/0")}</span>
      </header>
      <div class="deal-checklist-grid">
        ${items.map((item) => `
          <button type="button" class="deal-checklist-item ${item.completed ? "complete" : ""}" data-drawer-dealdesk-check="${escapeHtml(item.key || "")}" data-completed="${item.completed ? "true" : "false"}">
            <strong>${escapeHtml(item.label || "")}</strong>
            <small>${escapeHtml(item.completed ? `Done ${item.completed_at ? formatDateTime(item.completed_at) : ""}`.trim() : "Mark complete")}</small>
          </button>
        `).join("")}
      </div>
      <div class="deal-checklist-actions">
        <label class="deal-checklist-field">
          <span>Delivery date</span>
          <input type="datetime-local" data-drawer-dealdesk-delivery value="${escapeHtml(datetimeLocalValue(summary.delivery_at || ""))}">
        </label>
        <div class="deal-checklist-key-handoff">
          ${["pending", "ready", "complete"].map((value) => `
            <button type="button" class="${summary.key_handoff_status === value ? "active" : ""}" data-drawer-dealdesk-key="${escapeHtml(value)}">${escapeHtml(value === "pending" ? "Key pending" : value === "ready" ? "Key ready" : "Key handed off")}</button>
          `).join("")}
        </div>
        <span class="deal-checklist-meta">${escapeHtml(summary.key_handoff_label || (missingCount > 0 ? `${missingCount} checklist items still open` : "Checklist loaded"))}</span>
      </div>
    </section>
  `;
}

function adminLeadAgeDays(lead) {
  return Number(lead?.activity_summary?.age_days || 0);
}

function adminLeadAgeLabel(lead) {
  return String(lead?.activity_summary?.age_label || "").trim() || "Fresh";
}

function isAdminAgingCriticalLead(lead) {
  return !isClosedLead(lead) && String(lead?.activity_summary?.age_bucket || "") === "critical";
}

function adminOutboundLabel(lead) {
  const summary = lead?.activity_summary || {};
  if (summary.last_outbound_at && summary.last_outbound_label) {
    return `${summary.last_outbound_label} ${formatDateTime(summary.last_outbound_at)}`;
  }
  return "";
}

function adminInboundLabel(lead) {
  const summary = lead?.activity_summary || {};
  if (summary.last_inbound_at) return `Customer inquiry ${formatDateTime(summary.last_inbound_at)}`;
  return "Customer inquiry not logged";
}

function adminLastTouchLabel(lead) {
  if (lead?.last_activity_at) return `Last touch ${formatDateTime(lead.last_activity_at)}`;
  if (lead?.created_at) return `Created ${formatDateTime(lead.created_at)}`;
  return "No touch logged";
}

function adminNextBestAction(lead) {
  const buyer = isBuyerLead(lead);
  const status = String(lead?.status || "new").toLowerCase();
  if (lead?.duplicate_warning?.message && !lead?.duplicate_warning?.reviewed) return "Review duplicate vehicle before warehouse work";
  if (lead?.owner_review?.unread) return "Read dealer update and confirm next manager step";
  if (adminSellerOwnerNeedsInfo(lead)) return "Confirm vehicle owner name and best contact";
  if (isAdminDealDeskLead(lead) && adminDealChecklistSummary(lead).pending > 0) return `Finish ${adminDealChecklistProgressLabel(lead)} before closing the handoff`;
  if (buyer && status === "won") return "Start delivery checklist, docs, and final customer handoff";
  if (!buyer && status === "in_inventory") return "Confirm warehouse intake, pricing, and publish plan";
  if (!buyer && status === "won") return "Confirm purchase paperwork and stock transfer";
  if (!String(lead?.assigned_to || "").trim()) return "Assign a rep and start first contact";
  if (isOverdue(lead?.next_follow_up_at || "", status)) return "Call now and reset follow-up SLA";
  if (isAdminWaitingReplyLead(lead)) return "Follow up on the pending reply before this goes cold";
  if (isAdminAppointmentLead(lead)) return buyer ? "Confirm the buyer appointment and prep the next step" : "Confirm the inspection appointment and prep the appraisal";
  if (status === "new") return buyer ? "Call buyer and confirm vehicle interest" : "Call seller and confirm appraisal details";
  if (buyer && status === "contacted") return "Book appointment or send quote follow-up";
  if (!buyer && status === "contacted") return "Book inspection or confirm appraisal visit";
  if (!buyer && isAdminReadyForWarehouse(lead)) return "Move this seller vehicle to warehouse";
  if (!lead?.next_follow_up_at) return "Schedule the next follow-up before leaving the lead";
  return buyer ? "Work the buyer plan and move toward appointment" : "Work the seller plan and move toward inspection or handoff";
}

function adminNextActionTarget(lead) {
  const buyer = isBuyerLead(lead);
  const status = String(lead?.status || "new").toLowerCase();
  if (lead?.duplicate_warning?.message && !lead?.duplicate_warning?.reviewed) return "duplicate";
  if (lead?.owner_review?.unread) return "review";
  if (adminSellerOwnerNeedsInfo(lead)) return "owner";
  if (isAdminDealDeskLead(lead) && adminDealChecklistSummary(lead).pending > 0) return "dealdesk";
  if (!String(lead?.assigned_to || "").trim()) return "assign";
  if (isOverdue(lead?.next_follow_up_at || "", status)) return "update";
  if (!buyer && ["inspection_booked", "offer_sent", "won", "in_inventory"].includes(status)) return "pricing";
  if (!buyer && !(Array.isArray(lead?.lead_photos) && lead.lead_photos.length)) return "photos";
  if (!lead?.next_follow_up_at) return "assign";
  return "update";
}

function adminSellerOwnerNeedsInfo(lead) {
  if (isBuyerLead(lead)) return false;
  const input = lead?.input || {};
  const ownerName = String(input.ownerName || "").trim();
  const ownerPhone = String(input.ownerPhone || "").trim();
  const ownerEmail = String(input.ownerEmail || "").trim();
  return !ownerName || (!ownerPhone && !ownerEmail);
}

function renderAdminCommunicationStrip(lead) {
  const chips = [];
  chips.push(isAdminStaleLead(lead) ? "No response 48h+" : (adminOutboundLabel(lead) || adminLastTouchLabel(lead)));
  chips.push(adminInboundLabel(lead));
  chips.push(lead?.next_follow_up_at ? `Next follow-up ${formatDateTime(lead.next_follow_up_at)}` : "No follow-up scheduled");
  if (lead?.vehicle_signal?.message) chips.push(lead.vehicle_signal.message);
  else if (lead?.vehicle_context?.has_active_offer) chips.push("Vehicle has active offer");
  else if (lead?.vehicle_context?.sold_elsewhere) chips.push("Vehicle already sold");
  else if (isAdminAppointmentLead(lead)) chips.push("Appointment on the board");
  else if (isAdminWaitingReplyLead(lead)) chips.push("Waiting for customer reply");
  else if (isAdminDealDeskLead(lead) && adminDealChecklistProgressLabel(lead)) chips.push(adminDealChecklistProgressLabel(lead));
  else if (isAdminDealDeskLead(lead)) chips.push(adminDealDeskLabel(lead));
  else if (lead?.owner_review?.unread) chips.push("Manager review unread");
  else chips.push(adminLeadAgeLabel(lead));
  return `
    <section class="lead-communication-strip">
      <div class="lead-communication-chips">
        ${chips.slice(0, 4).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
      <button type="button" class="lead-next-action-jump" data-drawer-jump-next="${escapeHtml(adminNextActionTarget(lead))}">
        <span>Next action</span>
        <strong>${escapeHtml(adminNextBestAction(lead))}</strong>
      </button>
    </section>
  `;
}

function renderAdminLeadPhotoReviewSection(lead) {
  if (isBuyerLead(lead)) return "";
  const photos = Array.isArray(lead?.lead_photos) ? lead.lead_photos.slice(0, MAX_LEAD_PHOTOS) : [];
  return `
            <section class="admin-drawer-section admin-lead-photo-review" data-drawer-section="photos">
              <header>
                <h3>Vehicle photos</h3>
                <span>${photos.length ? `${photos.length}/${MAX_LEAD_PHOTOS} uploaded for appraisal and publish review` : "No staff photos yet"}</span>
              </header>
              ${photos.length ? `
                <div class="lead-photo-review-grid">
                  ${photos.map((photo, index) => `
                    <a href="${escapeHtml(photo.url)}" target="_blank" rel="noreferrer">
                      <img src="${escapeHtml(adminPhotoPreviewUrl(photo.url))}" alt="${escapeHtml(photo.label || `Vehicle photo ${index + 1}`)}" loading="lazy" />
                      <span>${escapeHtml(photo.label || `Photo ${index + 1}`)}</span>
                    </a>
                  `).join("")}
                </div>
              ` : `
                <p class="admin-drawer-empty">Ask staff to upload exterior, interior, odometer, VIN, damage, recon, and listing photos before final price approval.</p>
              `}
            </section>`;
}

function isAdminReadyForWarehouse(lead) {
  if (isBuyerLead(lead) || isClosedLead(lead)) return false;
  if (inventoryCache.some((item) => item.sourceLeadId && item.sourceLeadId === lead?.id)) return false;
  return ["inspection_booked", "offer_sent", "won"].includes(String(lead?.status || "").toLowerCase());
}

function renderAdminControlCard(config = {}) {
  return `
    <section class="admin-control-card ${escapeHtml(config.tone || "")}">
      <header>
        <div>
          <span>${escapeHtml(config.kicker || "")}</span>
          <h3>${escapeHtml(config.title || "")}</h3>
        </div>
        <b>${escapeHtml(String(config.total || 0))}</b>
      </header>
      <p>${escapeHtml(config.caption || "")}</p>
      <div class="admin-control-chips">
        ${(config.chips || []).filter(Boolean).map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}
      </div>
      <div class="admin-control-actions">
        ${(config.actions || []).map((action) => `
          <button
            type="button"
            ${action.filter ? `data-admin-set-filter="${escapeHtml(action.filter)}"` : ""}
            ${action.inventoryFilter ? `data-open-inventory-filter="${escapeHtml(action.inventoryFilter)}"` : ""}
            ${action.url ? `data-admin-open-url="${escapeHtml(action.url)}"` : ""}
          >${escapeHtml(action.label || "")}</button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderAdminControlBoard(leads) {
  if (!adminControlBoardEl) return;
  adminControlBoardEl.hidden = true;
  adminControlBoardEl.innerHTML = "";
}

function renderAdminOverview(leads) {
  if (!adminOverviewEl) return;
  adminOverviewEl.hidden = true;
  adminOverviewEl.innerHTML = "";
  renderAdminControlBoard(leads);
  renderAdminToday(leads);
}

function renderAdminToday(leads) {
  if (!adminTodayListEl) return;
  const activeLeads = leads.filter((lead) => !isClosedLead(lead));
  const taskCount = activeLeads.filter(hasAdminOpenTask).length;
  const freshCount = activeLeads.filter((lead) => String(lead.status || "new").toLowerCase() === "new").length;
  const waitingReplyCount = activeLeads.filter((lead) => isAdminWaitingReplyLead(lead)).length;
  const unassignedCount = activeLeads.filter((lead) => !String(lead.assigned_to || "").trim()).length;
  const dueCount = activeLeads.filter((lead) => isFollowUpDue(lead.next_follow_up_at, lead.status || "new")).length;
  const duplicateCount = activeLeads.filter((lead) => lead.duplicate_warning?.message && !lead.duplicate_warning?.reviewed).length;
  const ownerUnreadCount = leads.filter((lead) => lead.owner_review?.unread).length;
  const draftCount = inventoryCache.filter((item) => ["draft", "review"].includes(String(item.status || "").toLowerCase())).length;
  const buyerInquiryCount = activeLeads.filter((lead) => isBuyerLead(lead)).length;
  const managerApprovalCount = ownerUnreadCount
    + activeLeads.filter((lead) => !isBuyerLead(lead) && ["offer_sent", "won", "in_inventory"].includes(String(lead.status || "").toLowerCase())).length
    + draftCount;
  const reconBlockerCount = activeLeads.filter((lead) => !isBuyerLead(lead) && Number(adminDealChecklistSummary(lead).pending || 0) > 0).length;
  const dashboardStats = renderAdminDashboardStats(leads);
  const focus = adminWorkFocus([
    { count: managerApprovalCount, label: "Clear manager approvals", detail: "Price, recon, publish, or staff updates need your decision.", filter: "manager-approval" },
    { count: unassignedCount, label: "Assign responsible reps", detail: "Give every hot lead one clear main rep before it gets cold.", filter: "unassigned" },
    { count: reconBlockerCount, label: "Unblock recon / listing", detail: "Seller vehicles are waiting on photos, keys, recon, pricing, or publish review.", filter: "deal-desk" },
    { count: dueCount, label: "Push due follow-ups", detail: "These leads need action today or are overdue.", filter: "needs-follow-up" },
    { count: taskCount, label: "Check open tasks", detail: "See team tasks that still need completion.", filter: "open-tasks" },
    { count: duplicateCount, label: "Clear vehicle conflicts", detail: "Review duplicate or same-vehicle warnings.", filter: "duplicate-review" },
    { count: freshCount, label: "Start fresh leads", detail: "Make sure every new lead has a responsible rep and next step.", filter: "fresh" },
    { count: activeLeads.length, label: "Monitor active pipeline", detail: "Open the active queue and coach the next bottleneck.", filter: "active" }
  ]);

  adminTodayListEl.innerHTML = `
    ${dashboardStats}
    <section class="work-focus-panel admin-work-focus" aria-label="Manager focus">
      <div>
        <span>Manager focus</span>
        <strong>${escapeHtml(focus.label)}</strong>
        <small>${escapeHtml(focus.detail)}</small>
      </div>
      <button type="button" data-admin-set-filter="${escapeHtml(focus.filter)}">Open work</button>
    </section>
    <section class="admin-manager-brief" aria-label="Manager brief">
      <button type="button" class="admin-brief-card brief-card-hot" data-admin-set-filter="owner-unread">
        <span>Updates</span>
        <strong>${ownerUnreadCount}</strong>
        <small>Staff changes to review</small>
      </button>
      <button type="button" class="admin-brief-card" data-admin-set-filter="unassigned">
        <span>Unassigned</span>
        <strong>${unassignedCount}</strong>
        <small>Needs staff rep</small>
      </button>
      <button type="button" class="admin-brief-card" data-admin-set-filter="needs-follow-up">
        <span>Due</span>
        <strong>${dueCount}</strong>
        <small>Follow-up due or overdue</small>
      </button>
      <button type="button" class="admin-brief-card" data-admin-set-filter="duplicate-review">
        <span>Same vehicle</span>
        <strong>${duplicateCount}</strong>
        <small>Seller conflicts to clear</small>
      </button>
      <button type="button" class="admin-brief-card brief-card-hot" data-admin-set-filter="deal-desk">
        <span>Recon / listing</span>
        <strong>${reconBlockerCount}</strong>
        <small>Photos, keys, price, publish</small>
      </button>
      <button type="button" class="admin-brief-card" data-open-inventory-filter="draft">
        <span>Inventory draft</span>
        <strong>${draftCount}</strong>
        <small>Stock waiting on review</small>
      </button>
    </section>
  `;
}

function adminWorkFocus(items) {
  return items.find((item) => Number(item.count || 0) > 0) || {
    label: "No urgent manager work",
    detail: "The team queue is clear. Review totals or inventory drafts when needed.",
    filter: "active"
  };
}

function renderAdminDashboardStats(leads) {
  const stats = buildLeadDashboardStats(leads, adminDashboardRange);
  return renderLeadDashboardPanel({
    title: "Account totals",
    caption: "Real Up Sheet totals from current CRM data.",
    dealership: "AutoSwitch Canada",
    stats,
    columns: stats.columns,
    rowGroups: [
      { label: "Total Up Sheets", values: stats.created },
      { label: "BUY E-Leads", values: stats.buyers },
      { label: "SELL valuations", values: stats.sellers },
      { label: "Sold / purchased", values: stats.sold },
      { label: "Lost", values: stats.lost },
      { label: "Closing %", values: stats.closing, suffix: "%" }
    ]
  });
}

function buildLeadDashboardStats(leads, selectedRange) {
  const now = new Date();
  const today = startOfLocalDay(now);
  const tomorrow = addLocalDays(today, 1);
  const yesterday = addLocalDays(today, -1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const range = normalizeDashboardDateRange(selectedRange);
  const start = parseDashboardDate(range.start) || monthStart;
  const endInclusive = parseDashboardDate(range.end) || now;
  const endExclusive = addLocalDays(startOfLocalDay(endInclusive), 1);
  const selectedMonthCount = countCalendarMonths(start, endInclusive);
  const ranges = [
    { key: "selected", label: "Selected Range", start, end: endExclusive },
    { key: "today", label: "Today", start: today, end: tomorrow },
    { key: "yesterday", label: "Yesterday", start: yesterday, end: today },
    { key: "thisMonth", label: "This Month", start: monthStart, end: nextMonthStart },
    { key: "lastMonth", label: "Last Month", start: lastMonthStart, end: monthStart },
    { key: "monthlyAverage", label: "Monthly Average", start, end: endExclusive, averageMonths: selectedMonthCount }
  ];
  const metricForRange = (range, predicate = () => true, timestampGetter = leadCreatedTimestamp) => {
    const count = leads.filter((lead) => {
      const at = timestampGetter(lead);
      if (!at || at < range.start.getTime() || at >= range.end.getTime()) return false;
      return predicate(lead);
    }).length;
    return range.averageMonths ? Math.round(count / Math.max(1, range.averageMonths)) : count;
  };
  const created = ranges.map((range) => metricForRange(range));
  const buyers = ranges.map((range) => metricForRange(range, isBuyerLead));
  const sellers = ranges.map((range) => metricForRange(range, (lead) => !isBuyerLead(lead)));
  const sold = ranges.map((range) => metricForRange(range, isDashboardSoldLead, leadStatusTimestamp));
  const lost = ranges.map((range) => metricForRange(range, isDashboardLostLead, leadStatusTimestamp));
  const closing = created.map((value, index) => value ? Math.round((sold[index] / value) * 100) : 0);
  const selectedIndex = 0;
  return {
    columns: ranges.map((range) => range.label),
    created,
    buyers,
    sellers,
    sold,
    lost,
    closing,
    rangeCreated: created[selectedIndex],
    rangeSold: sold[selectedIndex],
    rangeClosing: closing[selectedIndex],
    rangeLabel: `${formatShortDate(start)} - ${formatShortDate(addLocalDays(endExclusive, -1))}`,
    startValue: formatDateInputValue(start),
    endValue: formatDateInputValue(addLocalDays(endExclusive, -1))
  };
}

function renderLeadDashboardPanel({ title, caption, dealership, stats, columns, rowGroups }) {
  return `
    <section class="crm-dashboard-panel" aria-label="${escapeHtml(title)}">
      <header class="crm-dashboard-hero">
        <div>
          <span>${escapeHtml(title)}</span>
          <h3>${escapeHtml(caption)}</h3>
        </div>
        <form class="crm-dashboard-range" data-admin-dashboard-range>
          <label>
            <span>From</span>
            <input type="date" value="${escapeHtml(stats.startValue)}" max="${escapeHtml(stats.endValue)}" data-dashboard-start>
          </label>
          <label>
            <span>To</span>
            <input type="date" value="${escapeHtml(stats.endValue)}" min="${escapeHtml(stats.startValue)}" data-dashboard-end>
          </label>
          <button type="submit">Apply</button>
          <small class="crm-dashboard-range-status" data-dashboard-range-status>Showing ${escapeHtml(stats.rangeLabel)}</small>
        </form>
      </header>
      <div class="crm-dashboard-total-row">
        <div>
          <span>Created</span>
          <strong>${formatNumber(stats.rangeCreated)}</strong>
        </div>
        <div>
          <span>Sold</span>
          <strong>${formatNumber(stats.rangeSold)}</strong>
        </div>
        <div>
          <span>Closing Percentage</span>
          <strong>${formatNumber(stats.rangeClosing)}%</strong>
        </div>
      </div>
      <div class="crm-dashboard-table-wrap">
        <table class="crm-dashboard-table">
          <thead>
            <tr>
              <th>Dealership</th>
              ${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            <tr class="crm-dashboard-dealer-row">
              <th>${escapeHtml(dealership)}</th>
              ${columns.map((_, index) => `<td>${formatNumber(stats.created[index])}</td>`).join("")}
            </tr>
            ${rowGroups.map((row) => `
              <tr>
                <th>${escapeHtml(row.label)}</th>
                ${row.values.map((value) => `<td>${formatNumber(value)}${row.suffix || ""}</td>`).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function isDashboardSoldLead(lead) {
  return ["won", "sold", "delivered"].includes(String(lead?.status || "").toLowerCase());
}

function isDashboardLostLead(lead) {
  return ["lost", "failed"].includes(String(lead?.status || "").toLowerCase());
}

function leadStatusTimestamp(lead) {
  const value = lead?.updated_at || lead?.last_activity_at || lead?.created_at || 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function loadDashboardDateRange(key) {
  try {
    return normalizeDashboardDateRange(JSON.parse(localStorage.getItem(key) || "{}"));
  } catch (error) {
    return normalizeDashboardDateRange({});
  }
}

function saveDashboardDateRange(key, range) {
  try {
    localStorage.setItem(key, JSON.stringify(normalizeDashboardDateRange(range)));
  } catch (error) {
    // Date range persistence is best-effort.
  }
}

function validateDashboardRangeForm(form) {
  const startInput = form.querySelector("[data-dashboard-start]");
  const endInput = form.querySelector("[data-dashboard-end]");
  const status = form.querySelector("[data-dashboard-range-status]");
  const start = startInput?.value || "";
  const end = endInput?.value || "";
  if (!start || !end) {
    if (status) status.textContent = "Choose both From and To dates.";
    form.classList.add("has-error");
    return { ok: false };
  }
  const startDate = parseDashboardDate(start);
  const endDate = parseDashboardDate(end);
  if (!startDate || !endDate || startDate.getTime() > endDate.getTime()) {
    if (status) status.textContent = "To date cannot be earlier than From date.";
    if (endInput) endInput.min = start;
    if (startInput) startInput.max = end || "";
    form.classList.add("has-error");
    return { ok: false };
  }
  form.classList.remove("has-error");
  return { ok: true, range: { start, end } };
}

function syncDashboardDateConstraints(form) {
  const startInput = form.querySelector("[data-dashboard-start]");
  const endInput = form.querySelector("[data-dashboard-end]");
  const status = form.querySelector("[data-dashboard-range-status]");
  const start = startInput?.value || "";
  const end = endInput?.value || "";
  if (endInput && start) endInput.min = start;
  if (startInput && end) startInput.max = end;
  if (start && end && parseDashboardDate(start)?.getTime() > parseDashboardDate(end)?.getTime()) {
    form.classList.add("has-error");
    if (status) status.textContent = "To date cannot be earlier than From date.";
  } else {
    form.classList.remove("has-error");
    if (status) status.textContent = start && end ? `Ready to apply ${start.replaceAll("-", "/")} - ${end.replaceAll("-", "/")}` : "Choose both dates.";
  }
}

function normalizeDashboardDateRange(range = {}) {
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultEnd = now;
  let start = parseDashboardDate(range.start) || defaultStart;
  let end = parseDashboardDate(range.end) || defaultEnd;
  if (start.getTime() > end.getTime()) [start, end] = [end, start];
  return {
    start: formatDateInputValue(start),
    end: formatDateInputValue(end)
  };
}

function parseDashboardDate(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfLocalDay(value) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function daysInMonth(value) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function countCalendarMonths(startValue, endValue) {
  const start = new Date(startValue.getFullYear(), startValue.getMonth(), 1);
  const end = new Date(endValue.getFullYear(), endValue.getMonth(), 1);
  return Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
}

function formatDateInputValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function renderLeadGroups(leads) {
  if (!leads.length) {
    const hasSearch = adminLeadSearch.trim();
    if (hasSearch) return `<p>No matching leads for "${escapeHtml(adminLeadSearch.trim())}". Try VIN, vehicle, email, phone, staff, or status.</p>`;
    if (adminLeadFilter === "closed") return "<p>No closed leads yet.</p>";
    if (adminLeadFilter === "active") return "<p>No active leads right now. Seller vehicles moved to Warehouse are saved under Closed / All, and the vehicle itself is managed in Inventory.</p>";
    return "<p>No leads in this view.</p>";
  }
  const buyerLeads = leads.filter(isBuyerLead);
  const sellerLeads = leads.filter((lead) => !isBuyerLead(lead));
  const groups = [
    { title: "BUY - Buyer leads", caption: "People asking about vehicles on the Buy page.", leads: buyerLeads, kind: "buyer" },
    { title: "SELL - Seller leads", caption: "People submitting vehicles for valuation or sale.", leads: sellerLeads, kind: "seller" }
  ]
    .filter((group) => group.leads.length)
    .sort((a, b) => compareAdminLeadOrder(a.leads[0], b.leads[0]));
  return groups.map((group) => `
    <section class="lead-group lead-group-${group.kind}">
      <header class="lead-group-head">
        <div>
          <h3>${escapeHtml(group.title)}</h3>
          <p>${escapeHtml(group.caption)}</p>
          <div class="lead-group-inline-metrics">
            <span>${group.leads.filter((lead) => String(lead.priority || "").toLowerCase() === "urgent").length} urgent</span>
            <span>${group.leads.filter((lead) => isFollowUpDue(lead.next_follow_up_at, lead.status || "new")).length} due</span>
            <span>${group.leads.filter((lead) => String(lead.status || "").toLowerCase() === "new").length} new</span>
          </div>
        </div>
        <b>${group.leads.length}</b>
      </header>
      <div class="lead-list-header" aria-hidden="true">
        <span>Lead</span>
        <span>Owner</span>
        <span>Responsible rep</span>
        <span>VIN</span>
        <span>Stage</span>
        <span>Next step</span>
        <span>Actions</span>
      </div>
      <div class="lead-group-list">
        ${group.leads.map((lead, index) => renderLead(lead, index)).join("")}
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
  return Boolean(active && (leadsEl.contains(active) || adminLeadDrawer?.contains(active)) && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(active.tagName));
}

function isEditingAdminDrawer() {
  const active = document.activeElement;
  if (!active || !adminLeadDrawer?.contains(active)) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
}

function getOpenLeadIds() {
  return [...leadsEl.querySelectorAll(".lead-card")]
    .filter((card) => card.querySelector(".lead-queue-more")?.open)
    .map((card) => card.dataset.id)
    .filter(Boolean);
}

async function restoreOpenLeads(openIds, options = {}) {
  if (!openIds.length) return;
  const openSet = new Set(openIds);
  const cards = [...leadsEl.querySelectorAll(".lead-card")].filter((card) => openSet.has(card.dataset.id));
  for (const card of cards) {
    const details = card.querySelector(".lead-queue-more");
    if (details) details.open = true;
  }
}

function isBuyerLead(lead) {
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  return input.leadType === "buyer_inquiry" || valuation.source === "buyer_inquiry";
}

function isClosedLead(lead) {
  if (!isBuyerLead(lead) && inventoryCache.some((item) => item.sourceLeadId && item.sourceLeadId === lead?.id)) return true;
  return ["won", "lost", "closed", "deleted", "in_inventory"].includes(String(lead?.status || "").toLowerCase());
}

function resolveVisibleAdminLeadId(id) {
  const lead = adminLeadsCache.find((item) => String(item.id || "") === String(id || ""));
  return String(lead?.vehicle_context?.primary_lead_id || lead?.merge_state?.primary_lead_id || id || "").trim();
}

function collapseVisibleAdminLeads(leads) {
  const visibleBuyerLeads = [];
  const visibleUngroupedSellerLeads = [];
  const sellerGroups = new Map();
  let hiddenSellerDuplicates = 0;

  for (const lead of leads) {
    if (isBuyerLead(lead)) {
      visibleBuyerLeads.push(lead);
      continue;
    }
    const key = adminVehicleClusterKey(lead);
    if (!key) {
      visibleUngroupedSellerLeads.push(lead);
      continue;
    }
    if (!shouldGroupSellerLead(lead)) {
      visibleUngroupedSellerLeads.push(lead);
      continue;
    }
    const group = sellerGroups.get(key) || [];
    group.push(lead);
    sellerGroups.set(key, group);
  }

  const visibleSellerLeads = [];
  for (const group of sellerGroups.values()) {
    const visibleLead = pickVisibleSellerLead(group);
    if (!visibleLead) continue;
    visibleSellerLeads.push(visibleLead);
    hiddenSellerDuplicates += Math.max(group.length - 1, 0);
  }

  return {
    visible: [...visibleBuyerLeads, ...visibleUngroupedSellerLeads, ...visibleSellerLeads].sort(compareAdminLeadOrder),
    hiddenSellerDuplicates
  };
}

function pickVisibleSellerLead(group) {
  const primaryId = String(group.find((lead) => String(lead?.vehicle_context?.primary_lead_id || "").trim())?.vehicle_context?.primary_lead_id || "").trim();
  return [...group].sort((a, b) => {
    const primaryDiff = Number(String(b?.id || "") === primaryId) - Number(String(a?.id || "") === primaryId);
    if (primaryDiff) return primaryDiff;
    const childDiff = Number(Boolean(a?.merge_state?.kind)) - Number(Boolean(b?.merge_state?.kind));
    if (childDiff) return childDiff;
    return compareAdminLeadOrder(a, b);
  })[0] || null;
}

function adminClusterMembersForLead(lead) {
  const id = String(lead?.id || "").trim();
  if (!id || isBuyerLead(lead)) return [];
  const key = adminVehicleClusterKey(lead);
  if (!key) return [];
  return adminLeadsCache
    .filter((item) => !isBuyerLead(item) && adminVehicleClusterKey(item) === key)
    .sort(compareAdminLeadOrder);
}

function adminCollapsedSellerMembers(lead) {
  const id = String(lead?.id || "").trim();
  return adminClusterMembersForLead(lead).filter((item) => (
    String(item.id || "").trim() !== id && shouldGroupSellerLead(item)
  ));
}

function adminVehicleClusterUrl(lead) {
  const leadId = String(lead?.id || "").trim();
  return leadId ? `/admin-vehicles.html?leadId=${encodeURIComponent(leadId)}` : "/admin-vehicles.html";
}

function renderCollapsedSellerMembersInline(lead) {
  if (isBuyerLead(lead)) return "";
  if (!shouldGroupSellerLead(lead)) return "";
  const hiddenMembers = adminCollapsedSellerMembers(lead);
  if (!hiddenMembers.length) return "";
  const unresolvedMembers = hiddenMembers.filter((item) => !item?.merge_state?.kind && item?.duplicate_warning?.message && !item.duplicate_warning.reviewed);
  const foldedMembers = hiddenMembers.filter((item) => item?.merge_state?.kind);
  const firstHiddenId = String((unresolvedMembers[0] || hiddenMembers[0])?.id || "").trim();
  const currentId = String(lead?.id || "").trim();
  const sourcePreview = hiddenMembers.slice(0, 3).map(adminSellerLeadSourcePreview).join(" | ");
  const summary = unresolvedMembers.length
    ? `${unresolvedMembers.length} same-vehicle SELL lead${unresolvedMembers.length === 1 ? "" : "s"} still need review`
    : `${hiddenMembers.length} same-vehicle source${hiddenMembers.length === 1 ? "" : "s"} folded into this file`;
  const detail = [
    sourcePreview,
    foldedMembers.length ? `${foldedMembers.length} already merged / archived` : "",
    hiddenMembers.length > 3 ? `+${hiddenMembers.length - 3} more` : ""
  ].filter(Boolean).join(" | ");
  return `
    <section class="lead-collapsed-cluster">
      <div>
        <span>${unresolvedMembers.length ? "Same vehicle review" : "Same vehicle file"}</span>
        <strong>${escapeHtml(summary)}</strong>
        <small>${escapeHtml(detail)}</small>
      </div>
      <div class="lead-collapsed-actions">
        ${unresolvedMembers.length ? `<button type="button" data-duplicate-review="merge_all_existing" data-target-lead-id="${escapeHtml(currentId)}">Merge all into this file</button>` : ""}
        <button type="button" data-admin-open-url="${escapeHtml(adminVehicleClusterUrl(lead))}">Review vehicle file</button>
        ${unresolvedMembers.length ? `<button type="button" data-admin-set-filter="duplicate-review">Review duplicate queue</button>` : ""}
        ${firstHiddenId ? `<button type="button" data-admin-open-lead="${escapeHtml(firstHiddenId)}">Open related lead</button>` : ""}
      </div>
    </section>
  `;
}

function adminSellerLeadSourcePreview(lead) {
  const input = lead?.input || {};
  return input.ownerEmail || input.email || input.ownerPhone || input.phone || lead?.auth_email || lead?.id || "Seller lead";
}

function adminVehicleClusterKey(lead) {
  const primaryId = String(lead?.vehicle_context?.primary_lead_id || "").trim();
  if (primaryId) return `primary:${primaryId}`;
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  const vin = String(input.vin || valuation.vin || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (vin) return `vin:${vin}`;
  const uvc = String(input.uvc || valuation.uvc || "").trim().toLowerCase();
  if (uvc) return `uvc:${uvc}`;
  const spec = [
    input.year || valuation.year,
    input.make || valuation.make,
    input.model || valuation.model,
    input.series || valuation.series,
    input.style || valuation.style
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join("|");
  return spec ? `spec:${spec}` : "";
}

function searchableLeadText(lead) {
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  const ownerReview = lead?.owner_review || {};
  const duplicate = lead?.duplicate_warning || {};
  const vehicleContext = lead?.vehicle_context || {};
  const mergeState = lead?.merge_state || {};
  return [
    lead?.id,
    lead?.status,
    lead?.priority,
    lead?.assigned_to,
    lead?.notes,
    ownerReview.reason,
    ownerReview.by,
    input.name,
    input.ownerName,
    input.email,
    input.phone,
    input.leadSource,
    input.sourceLabel,
    input.dealerEmail,
    input.vin,
    input.uvc,
    input.year,
    input.make,
    input.model,
    input.series,
    input.style,
    input.color,
    input.region,
    input.purchaseIntent,
    input.buyingTimeline,
    input.preferredContact,
    input.ownershipType,
    valuation.title,
    valuation.source,
    duplicate.message,
    duplicate.decision,
    mergeState.kind,
    mergeState.primary_lead_id,
    mergeState.listing_id,
    vehicleContext.cluster_label,
    vehicleContext.primary_inventory_status,
    vehicleContext.primary_lead_id,
    vehicleContext.primary_lead_title,
    vehicleContext.primary_listing_id
  ].filter(Boolean).join(" ").toLowerCase();
}

function cleanLeadTitle(title, buyer) {
  const value = String(title || "").trim();
  return buyer ? value.replace(/^Buyer inquiry\s*-\s*/i, "") : value;
}

function leadSourceLabel(lead = {}) {
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  const source = String(input.leadSource || input.sourceLabel || valuation.source || "").trim().toLowerCase();
  if (input.leadType === "buyer_inquiry" || source === "buyer_inquiry") return "Buyer inquiry";
  if (source.includes("dealer")) return "Dealer appraisal";
  return "Owner appraisal";
}

function leadSourceDetailLabel(lead = {}) {
  const label = leadSourceLabel(lead);
  if (label === "Buyer inquiry") return "Buy page buyer inquiry";
  if (label === "Dealer appraisal") return "Dealer staff appraisal";
  return "Sell page owner appraisal";
}

function renderLead(lead, index = 0) {
  const input = lead.input || {};
  const valuation = lead.valuation || {};
  const buyer = isBuyerLead(lead);
  const leadType = buyer ? "buyer" : "seller";
  const leadTypeLabel = buyer ? "Buyer lead" : "Seller lead";
  const wholesale = valuation.values?.wholesale?.adjusted?.avg;
  const retail = valuation.values?.retail?.adjusted?.avg;
  const title = cleanLeadTitle(valuation.title || [input.year, input.make, input.model, input.series, input.style].filter(Boolean).join(" "), buyer) || "Vehicle lead";
  const sourceLabel = leadSourceLabel(lead);
  const sourceDetailLabel = leadSourceDetailLabel(lead);
  const dealerCreated = sourceLabel === "Dealer appraisal";
  const customerName = buyer ? (input.name || input.ownerName || "") : (input.ownerName || "");
  const customerEmail = buyer
    ? (input.email || input.ownerEmail || (dealerCreated ? "" : lead.auth_email || currentAdminEmail()) || "")
    : (input.ownerEmail || "");
  const customerDisplay = customerName || customerEmail || (buyer ? "Customer not recorded" : "Owner not recorded");
  const customerPhone = buyer ? (input.phone || input.ownerPhone || "No phone") : (input.ownerPhone || "No phone");
  const submitterEmail = input.submitterEmail || input.dealerEmail || lead.auth_email || lead.auth_user?.email || "";
  const submitterLabel = submitterEmail ? `Submitted by ${shortEmail(submitterEmail)}` : (input.submitterRelationship || "");
  const vin = input.vin || valuation.vin || "-";
  const status = lead.status || "new";
  const assignedTo = lead.assigned_to || "";
  const priority = lead.priority || "normal";
  const ownerReview = lead.owner_review || {};
  const vehicleContext = lead.vehicle_context || {};
  const mergeState = lead.merge_state || {};
  const purchase = input.buyerPlan || valuation.buyerPlan || {};
  const followUp = lead.next_follow_up_at || "";
  const lastActivity = lead.last_activity_at || "";
  const overdue = isOverdue(followUp, status);
  const statusClass = overdue ? "status-overdue" : `status-${cssToken(status)}`;
  const statusLabel = overdue ? "Overdue" : leadStatusLabel(status, buyer);
  const unreadOwnerReview = Boolean(ownerReview.unread);
  const pendingAlert = unreadOwnerReview || hasAdminVisibleAlert(String(lead.id || ""));
  const progressSteps = renderLeadProgress(buyer, status);
  const inventoryListing = inventoryCache.find((item) => item.sourceLeadId && item.sourceLeadId === lead.id);
  const warehousePanel = buyer ? "" : inventoryListing ? `
      <section class="lead-warehouse-handoff lead-warehouse-linked">
        <div>
          <span>Warehouse</span>
          <strong>This seller vehicle is already in inventory.</strong>
          <small>Staff can keep uploading intake/recon photos from the lead; Warehouse is for manager approval, public photo selection, price, visibility, sold/archive.</small>
        </div>
        <button type="button" data-view-inventory="${escapeHtml(inventoryListing.id || "")}">Open warehouse listing</button>
      </section>` : `
      <section class="lead-warehouse-handoff">
        <div>
          <span>Warehouse handoff</span>
          <strong>Ready to manage this vehicle as inventory?</strong>
          <small>Create a draft listing first. The seller lead will leave Active CRM and stay traceable in Closed / All.</small>
        </div>
        <button type="button" data-quick-inventory="${escapeHtml(lead.id || "")}">Move to warehouse</button>
      </section>`;
  const ownerReviewBanner = ownerReview.unread ? `
      <section class="owner-review-required">
        <div>
          <span>Manager review required</span>
          <strong>${escapeHtml(ownerReview.reason || "Important staff update needs review.")}</strong>
          <small>${escapeHtml(ownerReview.at ? `${formatDateTime(ownerReview.at)}${ownerReview.by ? ` by ${ownerReview.by}` : ""}` : "Unread important update")}</small>
        </div>
        <button type="button" data-owner-read="${escapeHtml(lead.id || "")}">Mark reviewed</button>
      </section>` : ownerReview.read_at ? `
      <section class="owner-review-read">
        <span>Manager reviewed ${escapeHtml(formatDateTime(ownerReview.read_at))}${ownerReview.read_by ? ` by ${escapeHtml(ownerReview.read_by)}` : ""}</span>
      </section>` : "";
  const signalBanner = vehicleSignalInline(lead);
  const hasOpenDuplicateReview = Boolean(lead?.duplicate_warning?.message && !lead?.duplicate_warning?.reviewed);
  const contextBanner = hasOpenDuplicateReview ? "" : vehicleContextInline(lead);
  const collapsedMembersBanner = hasOpenDuplicateReview ? "" : renderCollapsedSellerMembersInline(lead);
  const mergeBanner = mergeStateInline(lead);
  const duplicateBanner = duplicateWarningInline(lead);
  const needsOwnerInfo = adminSellerOwnerNeedsInfo(lead);
  const queueSummary = needsOwnerInfo
    ? "Confirm vehicle owner name and contact"
    : overdue
    ? "Responsible rep follow-up is overdue"
    : followUp
      ? `Next follow-up ${formatDateTime(followUp)}`
      : String(status || "").toLowerCase() === "new"
        ? "New lead waiting for first contact"
        : "No follow-up scheduled";
  const vehicleSummary = mergeState.kind
    ? `Vehicle grouped under primary ${mergeState.primary_lead_id || "record"}`
    : vehicleContext.primary_inventory_status
      ? `Warehouse ${String(vehicleContext.primary_inventory_status).replaceAll("_", " ")}`
      : lead.duplicate_warning?.message
        ? "Duplicate vehicle review needed"
        : buyer
          ? "Buyer journey in CRM"
          : "Seller valuation in CRM";
  const responseSummary = lastActivity ? `Last activity ${formatDateTime(lastActivity)}` : "No recent activity logged";
  const progressSummary = leadStatusLabel(status, buyer);
  const nextAction = adminNextBestAction(lead);
  const compactTouchSummary = isAdminStaleLead(lead) ? "No response 48h+" : (adminOutboundLabel(lead) || adminLastTouchLabel(lead));
  const vehicleValuePills = buyer
    ? [
      purchase.intent || input.purchaseIntent || "Buyer inquiry",
      purchase.monthlyPayment ? `Budget ${formatNumber(purchase.monthlyPayment)}/mo` : ""
    ].filter(Boolean)
    : [
      wholesale ? `W ${formatNumber(wholesale)}` : "",
      retail ? `R ${formatNumber(retail)}` : ""
    ].filter(Boolean);
  const compactAlertLabel = lead?.duplicate_warning?.message && !lead?.duplicate_warning?.reviewed
    ? "Duplicate review required"
    : ownerReview.unread
      ? "Manager review required"
      : pendingAlert
        ? "New update on this lead"
        : "";
  const restoredBadge = lead?.warehouse_restore?.restored
    ? `<b class="lead-restored-badge" title="${escapeHtml(lead.warehouse_restore.note || "Recovered from warehouse move-out")}">RESTORED</b>`
    : "";
  const needsDetailLayer = String(activeAdminLeadId || "") === String(lead.id || "")
    || Boolean(pendingAlert)
    || Boolean(unreadOwnerReview)
    || Boolean(hasOpenDuplicateReview)
    || Boolean(signalBanner)
    || Boolean(contextBanner)
    || Boolean(collapsedMembersBanner)
    || Boolean(mergeBanner)
    || Boolean(inventoryListing);
  const detailLayer = `
      <details class="lead-queue-more">
        <summary>More details and alerts</summary>
        ${signalBanner}
        ${contextBanner}
        ${collapsedMembersBanner}
        ${mergeBanner}
        ${duplicateBanner}
        ${ownerReviewBanner}
        ${warehousePanel}
      </details>`;
  return `
    <article class="lead-card lead-card-${leadType} lead-card-alt-${index % 2 === 0 ? "even" : "odd"} ${priority === "urgent" ? "lead-card-urgent" : ""} ${isClosedLead(lead) ? "lead-card-closed" : ""} ${overdue ? "lead-overdue" : ""} ${pendingAlert && !unreadOwnerReview ? "lead-card-updated" : ""} ${mergeState.kind ? "lead-card-vehicle-child" : ""} ${needsDetailLayer ? "lead-card-has-detail-layer" : ""}" data-id="${escapeHtml(lead.id || "")}">
      <section class="lead-list-row">
        <div class="lead-list-col lead-list-col-main">
          <span class="lead-list-label">Lead</span>
          <div class="lead-title-row">
            <b class="lead-type-pill lead-type-${leadType}">${escapeHtml(leadTypeLabel)}</b>
            <b class="lead-source-pill">${escapeHtml(sourceLabel)}</b>
            ${unreadOwnerReview ? `<b class="lead-new-badge">NEW</b>` : ""}
            ${restoredBadge}
            <span class="lead-current-badge" aria-hidden="true">CURRENT</span>
            <strong>${escapeHtml(title)}</strong>
          </div>
          <div class="lead-list-subline lead-primary-meta">
            <span class="lead-time-chip">${escapeHtml(formatDateTime(lead.created_at))}</span>
            <span class="priority-pill priority-${escapeHtml(priority)}">${escapeHtml(priority)}</span>
          </div>
        </div>
        <div class="lead-list-col">
          <span class="lead-list-label">${buyer ? "Customer" : "Owner"}</span>
          <strong>${escapeHtml(customerDisplay)}</strong>
          <div class="lead-list-subline">
            ${customerName && customerEmail ? `<span>${escapeHtml(customerEmail)}</span>` : ""}
            <span>${escapeHtml(customerPhone)}</span>
          </div>
        </div>
        <div class="lead-list-col">
          <span class="lead-list-label">Responsible rep</span>
          <strong class="${assignedTo ? "" : "lead-unassigned-value"}">${escapeHtml(assignedTo ? shortEmail(assignedTo) : "Unassigned")}</strong>
          <div class="lead-list-subline">
            <span>${escapeHtml(assignedTo ? "Responsible" : "Needs rep")}</span>
            <span>${escapeHtml(overdue ? "Overdue" : followUp ? "Scheduled" : "No follow-up")}</span>
          </div>
        </div>
        <div class="lead-list-col">
          <span class="lead-list-label">VIN</span>
          <strong class="lead-vin-value">VIN ${escapeHtml(vin)}</strong>
          <div class="lead-list-subline">
            <span>${escapeHtml(sourceDetailLabel)}</span>
            ${submitterLabel ? `<span>${escapeHtml(submitterLabel)}</span>` : ""}
            ${vehicleValuePills.map((pill) => `<span>${escapeHtml(pill)}</span>`).join("")}
          </div>
        </div>
        <div class="lead-list-col">
          <span class="lead-list-label">Stage</span>
          <strong>${escapeHtml(progressSummary)}</strong>
          <div class="lead-list-subline">
            <span class="${escapeHtml(statusClass)}">${escapeHtml(statusLabel)}</span>
            <span>${escapeHtml(vehicleSummary)}</span>
          </div>
        </div>
        <div class="lead-list-col">
          <span class="lead-list-label">Next step</span>
          <strong>${escapeHtml(queueSummary)}</strong>
          <div class="lead-list-subline">
            <span>${escapeHtml(overdue ? "Overdue" : followUp ? "Scheduled" : "Unscheduled")}</span>
            <span>${escapeHtml(responseSummary)}</span>
          </div>
        </div>
        <div class="lead-list-col lead-list-col-actions">
          <span class="lead-list-label">Quick actions</span>
          <div class="lead-quick-strip" aria-label="Lead quick actions">
            <button type="button" class="lead-quick-button lead-quick-button-primary" data-admin-open-workspace>Open workspace</button>
            <button type="button" class="lead-quick-button" data-admin-focus-followup>Follow-up</button>
            <button type="button" class="lead-quick-button" data-admin-focus-note="call">Call / log</button>
            <button type="button" class="lead-quick-button" data-admin-focus-task>Add task</button>
          </div>
        </div>
      </section>
      <section class="lead-queue-insight">
        <div>
          <span class="lead-queue-insight-label">Next action</span>
          <strong>${escapeHtml(nextAction)}</strong>
        </div>
        <span>${escapeHtml(compactTouchSummary)}</span>
      </section>
      ${pendingAlert ? `<button class="lead-inline-alert" type="button" data-admin-open-alert="${escapeHtml(lead.id || "")}">${escapeHtml(compactAlertLabel)}</button>` : ""}
      ${detailLayer}
    </article>
  `;
}

function renderSharedLeadMeta({
  customerEmail,
  customerName,
  phone,
  vin,
  assignedTo,
  priority,
  followUp,
  lastActivity,
  leadTypeLabel
}) {
  return `
    <dl class="lead-shared-meta">
      <div><dt>Customer</dt><dd>${escapeHtml(customerEmail || "-")}</dd></div>
      ${customerName ? `<div><dt>Name</dt><dd>${escapeHtml(customerName)}</dd></div>` : ""}
      <div><dt>Phone</dt><dd>${escapeHtml(phone || "-")}</dd></div>
      <div><dt>VIN</dt><dd>${escapeHtml(vin || "-")}</dd></div>
      <div><dt>Lead type</dt><dd>${escapeHtml(leadTypeLabel || "-")}</dd></div>
      <div><dt>Responsible rep</dt><dd>${escapeHtml(assignedTo || "Unassigned")}</dd></div>
      <div><dt>Priority</dt><dd>${escapeHtml(priority || "normal")}</dd></div>
      <div><dt>Next follow-up</dt><dd>${escapeHtml(followUp ? formatDateTime(followUp) : "Not set")}</dd></div>
      <div><dt>Last activity</dt><dd>${escapeHtml(lastActivity ? formatDateTime(lastActivity) : "No recent activity")}</dd></div>
    </dl>
  `;
}

function renderAdminDrawer(leadId) {
  if (!adminLeadDrawer || !adminLeadDrawerContent) return;
  const id = String(leadId || "").trim();
  const lead = adminLeadsCache.find((item) => String(item.id || "") === id);
  if (!lead) {
    adminLeadDrawer.hidden = true;
    adminLeadDrawer.classList.remove("open");
    adminLeadDrawerContent.innerHTML = "";
    unlockAdminDrawerPageScroll();
    activeAdminDrawerLeadId = "";
    adminDrawerActivityLoaded = false;
    return;
  }

  const input = lead.input || {};
  const valuation = lead.valuation || {};
  const adjustment = lead.owner_adjustment || {};
  const cbbWholesale = marketAverageFromValuation(valuation, "wholesale");
  const cbbRetail = marketAverageFromValuation(valuation, "retail");
  const ownerWholesaleValue = adjustment.wholesale ?? cbbWholesale ?? "";
  const ownerRetailValue = adjustment.retail ?? cbbRetail ?? "";
  const buyer = isBuyerLead(lead);
  const title = cleanLeadTitle(valuation.title || [input.year, input.make, input.model, input.series, input.style].filter(Boolean).join(" "), buyer) || "Vehicle lead";
  const vehicleYear = input.year || valuation.year || "";
  const vehicleMake = input.make || valuation.make || "";
  const vehicleModel = input.model || valuation.model || "";
  const vehicleSeries = input.series || valuation.series || "";
  const vehicleStyle = input.style || valuation.style || "";
  const vehicleKilometers = input.kilometers || input.mileage || "";
  const vehicleColor = input.color || "";
  const vehicleRegion = input.region || valuation.region || "";
  const customerName = input.ownerName || input.name || "";
  const sourceLabel = leadSourceLabel(lead);
  const dealerCreated = sourceLabel === "Dealer appraisal";
  const customerEmail = input.ownerEmail || input.email || (dealerCreated ? "" : lead.auth_user?.email || lead.auth_email) || "";
  const customerDisplay = customerName || customerEmail || (buyer ? "Customer not recorded" : "Owner not recorded");
  const customerPhone = input.ownerPhone || input.phone || "No phone";
  const submitterEmail = input.submitterEmail || input.dealerEmail || lead.auth_email || lead.auth_user?.email || "";
  const submitterLabel = submitterEmail ? `${shortEmail(submitterEmail)}${input.submitterRelationship ? ` · ${input.submitterRelationship}` : ""}` : (input.submitterRelationship || "");
  const vin = input.vin || valuation.vin || "-";
  const status = lead.status || "new";
  const priority = lead.priority || "normal";
  const assignedTo = lead.assigned_to || "";
  const followUp = lead.next_follow_up_at || "";
  const lastActivity = lead.last_activity_at || "";
  const overdue = isOverdue(followUp, status);
  const ownerReview = lead.owner_review || {};
  const vehicleContext = lead.vehicle_context || {};
  const inventoryListing = inventoryCache.find((item) => item.sourceLeadId && item.sourceLeadId === id);
  const pipelineLabel = leadStatusLabel(status, buyer);
  const nextAction = adminNextBestAction(lead);
  const clusterLabel = vehicleContext.cluster_label || title;
  const warehouseLabel = vehicleContext.primary_inventory_status
    ? `Warehouse ${String(vehicleContext.primary_inventory_status).replaceAll("_", " ")}`
    : "CRM only";
  const statusOptions = leadStatusOptions(buyer)
    .map((item) => `<option value="${item.value}" ${status === item.value ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
  const assignField = dealerStaffEmails.length ? `
                  <select name="assignedTo">
                    <option value="">Unassigned</option>
                    ${dealerStaffEmails.map((email) => `<option value="${escapeHtml(email)}" ${assignedTo === email ? "selected" : ""}>${escapeHtml(email)}</option>`).join("")}
                  </select>` : `
                  <input name="assignedTo" type="email" value="${escapeHtml(assignedTo)}" placeholder="staff@example.com" />`;
  const taskAssigneeField = dealerStaffEmails.length ? `
                  <select name="assignedTo">
                    <option value="${escapeHtml(assignedTo)}">${escapeHtml(assignedTo ? `Main rep: ${shortEmail(assignedTo)}` : "Use main responsible rep")}</option>
                    ${dealerStaffEmails.map((email) => `<option value="${escapeHtml(email)}">${escapeHtml(email)}</option>`).join("")}
                  </select>` : `
                  <input name="assignedTo" type="email" value="${escapeHtml(assignedTo)}" placeholder="staff@example.com" />`;
  const quickAssignButtons = dealerStaffEmails.length ? `
              <div class="admin-drawer-quick-assign" aria-label="Quick assign staff">
                <span>One-click responsible rep</span>
                ${dealerStaffEmails.slice(0, 6).map((email) => `
                  <button type="button" data-drawer-assign-to="${escapeHtml(email)}">${escapeHtml(shortEmail(email))}</button>
                `).join("")}
              </div>` : "";
  const taskTemplates = adminTaskTemplates(buyer);
  const sellerAdjustmentFields = buyer ? "" : `
                <label>
                  <span>Approved wholesale</span>
                  <input name="ownerWholesale" type="number" value="${ownerWholesaleValue}" placeholder="Manual wholesale" />
                </label>
                <label>
                  <span>Approved retail</span>
                  <input name="ownerRetail" type="number" value="${ownerRetailValue}" placeholder="Manual retail" />
                </label>
                <label class="admin-price-reason-field">
                  <span>Reason</span>
                  <textarea name="reason" placeholder="Why adjust this value?">${escapeHtml(adjustment.reason || (cbbWholesale || cbbRetail ? "Pre-filled from current CBB estimate" : ""))}</textarea>
                </label>`;
  const sellerPricingSection = buyer ? "" : `
            <section class="admin-drawer-section admin-drawer-pricing-card" data-drawer-section="pricing">
              <header>
                <div>
                  <h3>Price decision</h3>
                  <span>${escapeHtml(cbbWholesale || cbbRetail ? `CBB W ${cbbWholesale ? formatNumber(cbbWholesale) : "-"} / R ${cbbRetail ? formatNumber(cbbRetail) : "-"}` : "Manager-approved vehicle numbers")}</span>
                </div>
                <button type="button" class="drawer-edit-lock" data-drawer-toggle-lock=".admin-drawer-pricing-form" aria-pressed="true">Locked</button>
              </header>
              <form class="owner-review admin-drawer-owner-form admin-drawer-pricing-form admin-locked-form" data-edit-locked="true">
                <input type="hidden" name="status" value="${escapeHtml(status)}" />
                <input type="hidden" name="assignedTo" value="${escapeHtml(assignedTo)}" />
                <input type="hidden" name="priority" value="${escapeHtml(priority)}" />
                <input type="hidden" name="nextFollowUpAt" value="${escapeHtml(datetimeLocalValue(followUp))}" />
                <input type="hidden" name="notes" value="${escapeHtml(lead.notes || "")}" />
                ${sellerAdjustmentFields}
                <button type="submit">Save pricing</button>
              </form>
            </section>`;
  const vehicleDetailsSection = `
            <section class="admin-drawer-section admin-drawer-vehicle-card" data-drawer-section="vehicle">
              <header>
                <div>
                  <h3>Vehicle details</h3>
                  <span>VIN, trim, mileage, color, and market region</span>
                </div>
                <button type="button" class="drawer-edit-lock" data-drawer-toggle-lock=".admin-drawer-vehicle-form" aria-pressed="true">Locked</button>
              </header>
              <form class="owner-review admin-drawer-owner-form admin-drawer-vehicle-form admin-locked-form" data-edit-locked="true">
                <input type="hidden" name="status" value="${escapeHtml(status)}" />
                <input type="hidden" name="assignedTo" value="${escapeHtml(assignedTo)}" />
                <input type="hidden" name="priority" value="${escapeHtml(priority)}" />
                <input type="hidden" name="nextFollowUpAt" value="${escapeHtml(datetimeLocalValue(followUp))}" />
                <input type="hidden" name="notes" value="${escapeHtml(lead.notes || "")}" />
                <input type="hidden" name="ownerWholesale" value="${ownerWholesaleValue}" />
                <input type="hidden" name="ownerRetail" value="${ownerRetailValue}" />
                <input type="hidden" name="reason" value="${escapeHtml(adjustment.reason || "")}" />
                <label class="admin-drawer-field-wide">
                  <span>Vehicle title</span>
                  <input name="vehicleTitle" value="${escapeHtml(title)}" placeholder="2019 Toyota Mirai Base 4D Sedan" />
                </label>
                <label class="admin-vin-field">
                  <span>VIN</span>
                  <input name="vehicleVin" value="${escapeHtml(vin === "-" ? "" : vin)}" placeholder="VIN" />
                </label>
                <label>
                  <span>Year</span>
                  <input name="vehicleYear" value="${escapeHtml(vehicleYear)}" placeholder="2020" />
                </label>
                <label>
                  <span>Make</span>
                  <input name="vehicleMake" value="${escapeHtml(vehicleMake)}" placeholder="Toyota" />
                </label>
                <label>
                  <span>Model</span>
                  <input name="vehicleModel" value="${escapeHtml(vehicleModel)}" placeholder="Camry" />
                </label>
                <label>
                  <span>Trim / series</span>
                  <input name="vehicleSeries" value="${escapeHtml(vehicleSeries)}" placeholder="XSE Hybrid" />
                </label>
                <label>
                  <span>Style</span>
                  <input name="vehicleStyle" value="${escapeHtml(vehicleStyle)}" placeholder="4D Sedan" />
                </label>
                <label>
                  <span>Kilometers</span>
                  <input name="vehicleKilometers" type="number" min="0" value="${escapeHtml(vehicleKilometers)}" placeholder="50000" />
                </label>
                <label>
                  <span>Color</span>
                  <input name="vehicleColor" value="${escapeHtml(vehicleColor)}" placeholder="Black" />
                </label>
                <label>
                  <span>Region</span>
                  <input name="vehicleRegion" value="${escapeHtml(vehicleRegion)}" placeholder="BC" />
                </label>
                <button type="submit">Save vehicle</button>
              </form>
            </section>`;
  const vehiclePriceSection = `
            <div class="admin-drawer-vehicle-price-grid ${buyer ? "single" : ""}">
              ${vehicleDetailsSection}
              ${sellerPricingSection}
            </div>`;
  const ownerInfoSection = buyer ? "" : `
            <section class="admin-drawer-section admin-drawer-owner-info-card" data-drawer-section="owner">
              <header>
                <div>
                  <h3>Owner info</h3>
                  <span>Confirm the legal seller before appraisal, pricing, or warehouse work.</span>
                </div>
              </header>
              <form class="owner-review admin-drawer-owner-form admin-drawer-owner-info-form">
                <input type="hidden" name="status" value="${escapeHtml(status)}" />
                <input type="hidden" name="assignedTo" value="${escapeHtml(assignedTo)}" />
                <input type="hidden" name="priority" value="${escapeHtml(priority)}" />
                <input type="hidden" name="nextFollowUpAt" value="${escapeHtml(datetimeLocalValue(followUp))}" />
                <input type="hidden" name="ownerWholesale" value="${ownerWholesaleValue}" />
                <input type="hidden" name="ownerRetail" value="${ownerRetailValue}" />
                <input type="hidden" name="reason" value="${escapeHtml(adjustment.reason || "")}" />
                <input type="hidden" name="notes" value="${escapeHtml(lead.notes || "")}" />
                <label>
                  <span>Owner name</span>
                  <input name="ownerName" value="${escapeHtml(input.ownerName || "")}" placeholder="Legal seller name" />
                </label>
                <label>
                  <span>Owner phone</span>
                  <input name="ownerPhone" value="${escapeHtml(input.ownerPhone || "")}" placeholder="Best phone number" />
                </label>
                <label>
                  <span>Owner email</span>
                  <input name="ownerEmail" type="email" value="${escapeHtml(input.ownerEmail || "")}" placeholder="owner@example.com" />
                </label>
                <button type="submit">Save owner info</button>
              </form>
            </section>`;
  const activityStatusButtons = leadStatusActions(buyer, status)
    .map((action) => `<button type="button" data-drawer-status="${escapeHtml(action.status)}">${escapeHtml(action.label)}</button>`)
    .join("");
  const hasOpenDuplicateReview = Boolean(lead?.duplicate_warning?.message && !lead?.duplicate_warning?.reviewed);
  const drawerWarehouseSection = buyer ? "" : `
            <section class="admin-drawer-section admin-drawer-warehouse-card" data-drawer-section="warehouse">
              <header>
                <div>
                  <h3>Warehouse handoff</h3>
                  <span>${escapeHtml(inventoryListing ? "This lead is already linked to Inventory" : "Create a draft listing when this vehicle is ready for stock work")}</span>
                </div>
              </header>
              ${inventoryListing ? `
                <div class="drawer-spotlight drawer-warehouse-spotlight">
                  <strong>Already in warehouse</strong>
                  <small>Photos, price, publish, sold/archive, and public visibility are managed from Inventory.</small>
                  <button type="button" data-view-inventory="${escapeHtml(inventoryListing.id || "")}">Open warehouse listing</button>
                </div>
              ` : `
                <div class="drawer-spotlight drawer-warehouse-spotlight">
                  <strong>Ready to manage this vehicle as inventory?</strong>
                  <small>The SELL lead leaves Active CRM, but stays traceable in Closed / All and can be restored if moved out.</small>
                  <button type="button" data-quick-inventory="${escapeHtml(id)}" ${hasOpenDuplicateReview ? "disabled" : ""}>Move to warehouse</button>
                  ${hasOpenDuplicateReview ? `<small>Resolve duplicate vehicle review before warehouse handoff.</small>` : ""}
                </div>
              `}
            </section>`;
  const drawerVehicleContext = hasOpenDuplicateReview ? "" : vehicleContextInline(lead);
  const drawerDuplicateWarning = duplicateWarningInline(lead);

  adminLeadDrawer.hidden = false;
  adminLeadDrawer.classList.add("open");
  lockAdminDrawerPageScroll();
  activeAdminDrawerLeadId = id;
  adminLeadDrawerContent.innerHTML = `
    <section class="admin-drawer-shell" data-drawer-lead-id="${escapeHtml(id)}">
      <header class="admin-drawer-head">
        <div>
          <span>Lead workspace</span>
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(sourceLabel)} | ${buyer ? "Customer" : "Vehicle owner"} ${escapeHtml(customerDisplay)} | ${escapeHtml(customerPhone)} | VIN ${escapeHtml(vin)}</small>
        </div>
        <div class="admin-drawer-head-actions">
          <button class="drawer-close-strong" type="button" data-drawer-close aria-label="Close drawer">Close</button>
        </div>
      </header>
      <div class="drawer-workspace-scroll">
        <div class="drawer-workspace-grid">
          <aside class="drawer-workspace-side">
            <section class="admin-drawer-summary">
              <div class="admin-drawer-stat">
                <span>Pipeline</span>
                <strong>${escapeHtml(pipelineLabel)}</strong>
                <small>${escapeHtml(overdue ? "Overdue follow-up" : followUp ? formatDateTime(followUp) : "No follow-up scheduled")}</small>
              </div>
              <div class="admin-drawer-stat">
                <span>${buyer ? "Customer" : "Vehicle owner / seller"}</span>
                <strong>${escapeHtml(customerDisplay)}</strong>
                <small>${escapeHtml([customerEmail !== customerDisplay ? customerEmail : "", customerPhone].filter(Boolean).join(" | "))}</small>
              </div>
              ${!buyer ? `
              <div class="admin-drawer-stat">
                <span>Submitted by</span>
                <strong>${escapeHtml(submitterLabel || "Unknown")}</strong>
                <small>${escapeHtml(input.submitterEmail || input.dealerEmail || "Lead creator / authorized contact")}</small>
              </div>` : ""}
              <div class="admin-drawer-stat">
                <span>Source</span>
                <strong>${escapeHtml(sourceLabel)}</strong>
                <small>${escapeHtml(input.dealerEmail ? `Dealer ${input.dealerEmail}` : "Public owner flow")}</small>
              </div>
              <div class="admin-drawer-stat">
                <span>Responsible rep</span>
                <strong>${escapeHtml(assignedTo ? shortEmail(assignedTo) : "Unassigned")}</strong>
                <small>${escapeHtml(priority)} priority</small>
              </div>
              <div class="admin-drawer-stat">
                <span>Vehicle</span>
                <strong>${escapeHtml(clusterLabel)}</strong>
                <small>${escapeHtml(warehouseLabel)}</small>
              </div>
              <div class="admin-drawer-stat">
                <span>Last touch</span>
                <strong>${escapeHtml(adminLeadAgeLabel(lead))}</strong>
                <small>${escapeHtml(lastActivity ? formatDateTime(lastActivity) : "No recent activity")}</small>
              </div>
            </section>
            ${ownerReview.unread ? `
              <section class="owner-review-required admin-drawer-owner-review" data-drawer-section="review">
                <div>
                  <span>Manager review required</span>
                  <strong>${escapeHtml(ownerReview.reason || "Important staff update needs review.")}</strong>
                  <small>${escapeHtml(ownerReview.at ? formatDateTime(ownerReview.at) : "Unread update")}</small>
                </div>
                <button type="button" data-owner-read="${escapeHtml(id)}">Mark reviewed</button>
              </section>
            ` : ""}
            ${vehicleSignalInline(lead)}
            ${drawerVehicleContext}
          </aside>
          <div class="drawer-workspace-main">
            ${drawerDuplicateWarning}
            ${renderAdminCommunicationStrip(lead)}
            ${ownerInfoSection}
            <section class="admin-drawer-section admin-drawer-command-card" data-drawer-section="assign">
              <header>
                <h3>Responsible rep & next step</h3>
                <span>One main responsible rep owns the lead. Assign other helpers through tasks.</span>
              </header>
              <form class="owner-review admin-drawer-owner-form admin-drawer-assign-form">
                <input type="hidden" name="ownerWholesale" value="${ownerWholesaleValue}" />
                <input type="hidden" name="ownerRetail" value="${ownerRetailValue}" />
                <input type="hidden" name="reason" value="${escapeHtml(adjustment.reason || "")}" />
                <input type="hidden" name="notes" value="${escapeHtml(lead.notes || "")}" />
                <label>
                  <span>Responsible rep</span>
                  ${assignField}
                </label>
                <label>
                  <span>Next follow-up</span>
                  <input name="nextFollowUpAt" type="datetime-local" value="${escapeHtml(datetimeLocalValue(followUp))}" />
                </label>
                <label>
                  <span>Status</span>
                  <select name="status">
                    ${statusOptions}
                  </select>
                </label>
                <label>
                  <span>Priority</span>
                  <select name="priority">
                    ${["low", "normal", "high", "urgent"].map((item) =>
                      `<option value="${item}" ${priority === item ? "selected" : ""}>${item}</option>`
                    ).join("")}
                  </select>
                </label>
                <button type="submit">${assignedTo ? "Save responsible rep" : "Assign responsible rep"}</button>
                <small class="admin-drawer-form-status" data-assign-status></small>
              </form>
              <div class="admin-drawer-followup-presets" aria-label="Follow-up presets">
                <span>Quick follow-up</span>
                <button type="button" data-followup-preset="today">Today 5 PM</button>
                <button type="button" data-followup-preset="tomorrow">Tomorrow 10 AM</button>
                <button type="button" data-followup-preset="3d">In 3 days</button>
                <button type="button" data-followup-preset="7d">Next week</button>
              </div>
              ${quickAssignButtons}
              ${renderAdminCrmWorkflowPanel(lead)}
              ${renderLeadProgress(buyer, status)}
              <div class="lead-action-row admin-drawer-actions">
                ${activityStatusButtons || `<span class="admin-drawer-empty">No quick status actions</span>`}
              </div>
            </section>
            ${vehiclePriceSection}
            ${renderAdminLeadPhotoReviewSection(lead)}
            ${drawerWarehouseSection}
            ${renderAdminDealChecklistSection(lead)}
            <section class="admin-drawer-section admin-drawer-task-card" data-drawer-section="task">
              <header>
                <h3>Collaborator task</h3>
                <span>Use tasks when another teammate helps with photos, calls, recon, finance, or paperwork.</span>
              </header>
              <form class="lead-task-form admin-drawer-task-form">
                <label class="task-form-field">
                  <span>Task type</span>
                  <select name="taskPreset">
                    <option value="">Custom task</option>
                    ${taskTemplates.map((task) => `<option value="${escapeHtml(task.key)}">${escapeHtml(task.label)} - ${escapeHtml(task.hint)}</option>`).join("")}
                  </select>
                </label>
                <label class="task-form-field task-title-field">
                  <span>Task</span>
                  <textarea name="title" placeholder="Example: Call customer and confirm appointment time..."></textarea>
                </label>
                <div class="task-due-controls" aria-label="Task due date">
                  <span>Due</span>
                  <button type="button" data-admin-task-due="soon">2 hours</button>
                  <button type="button" data-admin-task-due="today">Today</button>
                  <button type="button" data-admin-task-due="tomorrow">Tomorrow</button>
                  <button type="button" data-admin-task-due="next_week">Next week</button>
                </div>
                <label class="task-form-field task-time-field">
                  <span>Due time</span>
                  <input name="dueAt" type="datetime-local" />
                </label>
                <details class="task-advanced-options">
                  <summary>Assign this task to a helper</summary>
                  ${taskAssigneeField}
                </details>
                <button type="submit">Add task</button>
              </form>
            </section>
            <section class="admin-drawer-section admin-drawer-update-card" data-drawer-section="update">
              <header>
                <h3>Log update</h3>
                <span>LOG = what already happened. TASK = who does next. Timeline records both.</span>
              </header>
              <div class="drawer-spotlight">
                <strong>${escapeHtml(nextAction)}</strong>
                <small>${escapeHtml(followUp ? `Next follow-up ${formatDateTime(followUp)}` : "No follow-up scheduled yet.")}</small>
              </div>
              <div class="admin-drawer-comm-shortcuts">
                <button type="button" data-drawer-note-type="call">Call</button>
                <button type="button" data-drawer-note-type="sms">Text</button>
                <button type="button" data-drawer-focus-email>Email</button>
                <button type="button" data-drawer-note-type="internal">Internal note</button>
              </div>
              <form class="lead-note-form admin-drawer-note-form">
                <select name="noteType">
                  <option value="internal">Internal note</option>
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="inspection">Inspection</option>
                  <option value="offer">Offer</option>
                </select>
                <textarea name="note" placeholder="What changed? What should the next person know?"></textarea>
                <button type="submit">Post update</button>
              </form>
            </section>
            <details class="admin-drawer-section admin-drawer-settings-details">
              <summary>
                <span>
                  <strong>Team timeline</strong>
                  <small>Saved assignments, tasks, notes, photos, inventory, and manager decisions</small>
                </span>
              </summary>
              <header>
                <h3>Team timeline</h3>
                <button type="button" data-drawer-load-activity>Refresh</button>
              </header>
              <div class="lead-activity-list admin-drawer-activity-list">Activity not loaded yet.</div>
            </details>
            <details class="admin-drawer-section admin-drawer-settings-details">
              <summary>
                <span>
                  <strong>More lead tools</strong>
                  <small>Admin notes, email log, and recycle bin</small>
                </span>
              </summary>
              <form class="owner-review admin-drawer-owner-form">
                <input type="hidden" name="status" value="${escapeHtml(status)}" />
                <input type="hidden" name="assignedTo" value="${escapeHtml(assignedTo)}" />
                <input type="hidden" name="priority" value="${escapeHtml(priority)}" />
                <input type="hidden" name="nextFollowUpAt" value="${escapeHtml(datetimeLocalValue(followUp))}" />
                <input type="hidden" name="ownerWholesale" value="${ownerWholesaleValue}" />
                <input type="hidden" name="ownerRetail" value="${ownerRetailValue}" />
                <input type="hidden" name="reason" value="${escapeHtml(adjustment.reason || "")}" />
                <label class="review-notes">
                  <span>Admin notes</span>
                  <textarea name="notes" placeholder="Follow-up notes, CRM notes, customer preference...">${escapeHtml(lead.notes || "")}</textarea>
                </label>
                <button type="submit">Save lead notes</button>
              </form>
              <form class="lead-email-form admin-drawer-email-form">
                <input name="sentTo" type="email" value="${escapeHtml(customerEmail)}" placeholder="customer@example.com" />
                <input name="subject" placeholder="Email subject" />
                <textarea name="body" placeholder="Log the outbound email summary or draft text..."></textarea>
                <button type="submit">Log email</button>
              </form>
              <div class="admin-drawer-danger-zone">
                <span>Recycle bin</span>
                ${status === "deleted" ? `
                  <button class="secondary-action" type="button" data-restore-lead="${escapeHtml(id)}" data-restore-title="${escapeHtml(title)}">Restore lead</button>
                ` : `
                  <button class="danger-outline" type="button" data-delete-lead="${escapeHtml(id)}" data-delete-title="${escapeHtml(title)}">Move to recycle bin</button>
                `}
              </div>
            </details>
          </div>
        </div>
      </div>
    </section>
  `;
  initializeAdminDrawerEditableLocks();
}

function initializeAdminDrawerEditableLocks() {
  adminLeadDrawerContent?.querySelectorAll(".admin-locked-form").forEach((form) => {
    setAdminDrawerFormLocked(form, true);
  });
}

function setAdminDrawerFormLocked(form, locked) {
  if (!form) return;
  form.dataset.editLocked = locked ? "true" : "false";
  form.classList.toggle("is-locked", locked);
  form.querySelectorAll("input, select, textarea, button").forEach((field) => {
    if (field.type === "hidden") return;
    field.disabled = locked;
  });
  const selector = form.classList.contains("admin-drawer-pricing-form")
    ? ".admin-drawer-pricing-form"
    : form.classList.contains("admin-drawer-vehicle-form")
      ? ".admin-drawer-vehicle-form"
      : "";
  if (!selector) return;
  const toggle = adminLeadDrawerContent?.querySelector(`[data-drawer-toggle-lock="${selector}"]`);
  if (toggle) {
    toggle.textContent = locked ? "Locked" : "Editing";
    toggle.setAttribute("aria-pressed", locked ? "true" : "false");
    toggle.classList.toggle("unlocked", !locked);
  }
}

function scrollAdminDrawerToSection(target) {
  if (!adminLeadDrawerContent) return;
  const safeTarget = String(target || "update").trim().replace(/[^a-z0-9_-]/gi, "");
  const section = adminLeadDrawerContent.querySelector(`[data-drawer-section="${safeTarget}"]`)
    || adminLeadDrawerContent.querySelector('[data-drawer-section="update"]');
  if (!section) return;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
  section.classList.remove("drawer-section-pulse");
  window.setTimeout(() => section.classList.add("drawer-section-pulse"), 10);
  window.setTimeout(() => section.classList.remove("drawer-section-pulse"), 1800);
  const firstField = section.querySelector("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)");
  window.setTimeout(() => firstField?.focus?.({ preventScroll: true }), 320);
}

function closeAdminDrawer() {
  if (!adminLeadDrawer || !adminLeadDrawerContent) return;
  adminLeadDrawer.classList.remove("open");
  adminLeadDrawer.hidden = true;
  adminLeadDrawerContent.innerHTML = "";
  unlockAdminDrawerPageScroll();
  activeAdminDrawerLeadId = "";
  adminDrawerActivityLoaded = false;
}

function lockAdminDrawerPageScroll() {
  if (document.body.classList.contains("admin-drawer-open")) return;
  adminDrawerLockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  document.body.style.top = `-${adminDrawerLockedScrollY}px`;
  document.body.classList.add("admin-drawer-open");
}

function unlockAdminDrawerPageScroll() {
  if (!document.body.classList.contains("admin-drawer-open")) return;
  document.body.classList.remove("admin-drawer-open");
  document.body.style.top = "";
  window.scrollTo(0, adminDrawerLockedScrollY || 0);
}

async function loadAdminDrawerActivity(options = {}) {
  if (!adminLeadDrawerContent || !activeAdminDrawerLeadId) return;
  const list = adminLeadDrawerContent.querySelector(".admin-drawer-activity-list");
  if (!list) return;
  if (adminDrawerActivityLoaded && !options.force) return;
  list.textContent = "Loading activity...";
  const response = await fetch(`/api/lead-activity?leadId=${encodeURIComponent(activeAdminDrawerLeadId)}`, {
    headers: authHeaders()
  });
  const data = await response.json();
  if (!data.ok) {
    list.textContent = data.error || "Unable to load activity.";
    return;
  }
  adminDrawerActivityLoaded = true;
  list.innerHTML = renderActivity(data, { highlightLatest: Boolean(options.highlightLatest), limit: 12 });
}

async function readApiJson(response) {
  const data = await response.json().catch(() => null);
  if (data) return data;
  return {
    ok: false,
    status: response?.status || 0,
    error: response?.ok ? "Empty server response." : `Server returned ${response?.status || "an error"}.`
  };
}

async function fetchApiJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return await readApiJson(response);
  } catch (error) {
    if (error?.name === "AbortError") {
      return { ok: false, error: "Request timed out. Please try again." };
    }
    return { ok: false, error: error?.message || "Network request failed." };
  } finally {
    window.clearTimeout(timeout);
  }
}

function mergeLeadIntoCache(updatedLead) {
  if (!updatedLead?.id) return null;
  const id = String(updatedLead.id);
  const index = adminLeadsCache.findIndex((item) => String(item.id || "") === id);
  if (index === -1) return updatedLead;
  adminLeadsCache[index] = {
    ...adminLeadsCache[index],
    ...updatedLead
  };
  return adminLeadsCache[index];
}

async function quickAssignDrawerLead(button) {
  const email = String(button.dataset.drawerAssignTo || "").trim().toLowerCase();
  const lead = adminLeadsCache.find((item) => String(item.id || "") === activeAdminDrawerLeadId);
  if (!email || !lead) return;
  button.disabled = true;
  statusEl.textContent = `Assigning lead to ${email}...`;
  const nextStatus = String(lead.status || "new").toLowerCase() === "new" ? "assigned" : lead.status || "assigned";
  try {
    const data = await fetchApiJson("/api/leads", {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign_lead",
        id: activeAdminDrawerLeadId,
        authorEmail: currentAdminEmail(),
        status: nextStatus,
        assignedTo: email,
        priority: lead.priority || "normal",
        nextFollowUpAt: lead.next_follow_up_at || ""
      })
    });
    if (!data.ok) {
      throw new Error(formatApiError(data, "Unable to assign lead."));
    }
    mergeLeadIntoCache(data.lead);
    if (lead.owner_review?.unread) {
      await markManagerReviewedByLeadId(activeAdminDrawerLeadId, { silent: true, reload: false }).catch(() => null);
    }
    statusEl.textContent = `Assigned to ${shortEmail(email)}.`;
    await loadLeads({ suppressAlerts: true, forceOpenActivity: true, refreshActiveDrawer: true }).catch(() => null);
    adminDrawerActivityLoaded = false;
    await loadAdminDrawerActivity({ force: true, highlightLatest: true }).catch(() => null);
  } catch (error) {
    statusEl.textContent = error.message || "Unable to assign lead.";
  } finally {
    button.disabled = false;
  }
}

function setActiveAdminLead(id) {
  activeAdminLeadId = String(id || "").trim();
  syncActiveAdminLeadCard();
}

function isAdminCardControlClick(event) {
  return Boolean(event.target.closest("button, a, input, select, textarea, summary, label"));
}

function syncActiveAdminLeadCard() {
  const cards = [...leadsEl.querySelectorAll(".lead-card")];
  const hasMatch = Boolean(activeAdminLeadId) && cards.some((card) => card.dataset.id === activeAdminLeadId);
  leadsEl.classList.toggle("lead-focus-mode", hasMatch);
  cards.forEach((card) => {
    card.classList.toggle("lead-card-current", hasMatch && card.dataset.id === activeAdminLeadId);
  });
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
        { value: "deleted", label: "Recycle Bin" }
      ]
    : [
        { value: "new", label: "New seller lead" },
        { value: "assigned", label: "Assigned" },
        { value: "contacted", label: "Contacted" },
        { value: "waiting_for_customer", label: "Waiting for seller" },
        { value: "inspection_booked", label: "Inspection booked" },
        { value: "offer_sent", label: "Offer sent" },
        { value: "in_inventory", label: "In inventory" },
        { value: "won", label: "Acquired / consigned" },
        { value: "lost", label: "Lost" },
        { value: "closed", label: "Closed" },
        { value: "deleted", label: "Recycle Bin" }
      ];
}

function leadStatusLabel(status, buyer) {
  const option = leadStatusOptions(buyer).find((item) => item.value === status);
  return option?.label || String(status || "new").replaceAll("_", " ");
}

function renderAdminCrmWorkflowPanel(lead) {
  const current = adminCrmStage(lead);
  const steps = adminCrmWorkflowSteps(lead);
  const currentIndex = Math.max(0, steps.findIndex((step) => step.key === current.key));
  const task = lead?.task_summary || {};
  return `
    <section class="crm-workflow-panel admin-crm-workflow" aria-label="CRM workflow">
      <header>
        <div>
          <span>CRM stage</span>
          <strong>${escapeHtml(current.label)}</strong>
          <small>${escapeHtml(`Workflow position: ${current.hint}`)}</small>
        </div>
      </header>
      <ol class="crm-workflow-steps">
        ${steps.map((step, index) => `
          <li class="${index < currentIndex ? "complete" : ""} ${index === currentIndex ? "active" : ""}">
            <span></span>
            <b>${escapeHtml(step.label)}</b>
          </li>
        `).join("")}
      </ol>
      <div class="crm-responsibility-grid">
        <div>
          <span>Responsible</span>
          <strong>${escapeHtml(lead?.assigned_to || "Unassigned")}</strong>
        </div>
        <div>
          <span>Team task</span>
          <strong>${escapeHtml(task.latest_open_title || "No open task")}</strong>
          <small>${escapeHtml(task.latest_open_due_at ? `Due ${formatDateTime(task.latest_open_due_at)}` : "Add or assign a task when a handoff is needed.")}</small>
        </div>
        <div>
          <span>Manager checkpoint</span>
          <strong>${escapeHtml(lead?.owner_review?.unread ? "Staff update unread" : current.needsManager ? "Decision point" : "Not required")}</strong>
        </div>
      </div>
    </section>
  `;
}

function adminCrmWorkflowSteps(lead) {
  if (isBuyerLead(lead)) {
    return [
      { key: "lead", label: "Lead" },
      { key: "contact", label: "Contact" },
      { key: "appointment", label: "Appointment" },
      { key: "finance", label: "Finance / offer" },
      { key: "sold", label: "Sold" }
    ];
  }
  return [
    { key: "lead", label: "Lead" },
    { key: "contact", label: "Contact" },
    { key: "appraisal", label: "Appraisal" },
    { key: "offer", label: "Offer" },
    { key: "purchase", label: "Acquired / consigned" },
    { key: "recon", label: "Intake / recon" },
    { key: "inventory", label: "Inventory" },
    { key: "sold", label: "Sold" }
  ];
}

function adminCrmStage(lead) {
  const status = String(lead?.status || "new").toLowerCase();
  const inventoryStatus = String(lead?.vehicle_context?.primary_inventory_status || "").toLowerCase();
  if (isBuyerLead(lead)) {
    if (["won", "sold", "delivered"].includes(status)) return { key: "sold", label: "Sold / delivery", hint: "Manager confirms delivery, paperwork, and final handoff.", needsManager: true };
    if (["finance_sent", "offer_sent"].includes(status)) return { key: "finance", label: "Finance / offer", hint: "Decision point: approval, gross, trade, and close plan.", needsManager: true };
    if (status === "appointment_booked") return { key: "appointment", label: "Appointment", hint: "Confirm appointment quality and vehicle availability." };
    if (["contacted", "waiting_for_customer"].includes(status)) return { key: "contact", label: "Customer contact", hint: "Coach next follow-up and keep the lead warm." };
    return { key: "lead", label: "New buyer lead", hint: "Assign rep and require first touch." };
  }
  if (inventoryStatus === "sold" || status === "sold") return { key: "sold", label: "Vehicle sold", hint: "Confirm delivery, accounting, and final CRM close.", needsManager: true };
  if (inventoryStatus === "published") return { key: "inventory", label: "Listed inventory", hint: "Vehicle is live. Watch buyer activity and sales handoff." };
  if (["draft", "review"].includes(inventoryStatus) || status === "in_inventory") return { key: "recon", label: "Intake / recon", hint: "Vehicle is being prepared: repairs, price, photos, and publish approval.", needsManager: true };
  if (status === "won") return { key: "purchase", label: "Acquired / consigned", hint: "Confirm purchase or consignment terms, then move vehicle into intake.", needsManager: true };
  if (status === "offer_sent") return { key: "offer", label: "Offer sent", hint: "Decision point: purchase price or consignment commission, expiry, and seller response.", needsManager: true };
  if (status === "inspection_booked") return { key: "appraisal", label: "Inspection / appraisal", hint: "Confirm condition, title, lien, and appraisal path." };
  if (["contacted", "waiting_for_customer"].includes(status)) return { key: "contact", label: "Seller contact", hint: "Make sure inspection or next task is assigned." };
  return { key: "lead", label: "New seller lead", hint: "Assign rep and verify the vehicle." };
}

function marketAverageFromValuation(valuation, market) {
  const marketData = valuation?.values?.[market] || {};
  const adjusted = Number(marketData.adjusted?.avg);
  if (Number.isFinite(adjusted) && adjusted > 0) return Math.round(adjusted);
  const base = Number(marketData.base?.avg);
  return Number.isFinite(base) && base > 0 ? Math.round(base) : "";
}

function leadStatusActions(buyer, status) {
  const current = String(status || "new").toLowerCase();
  const actions = buyer
    ? [
        ["assigned", "Assign"],
        ["contacted", "Contacted"],
        ["waiting_for_customer", "Waiting"],
        ["appointment_booked", "Appointment"],
        ["finance_sent", "Finance sent"],
        ["won", "Won"],
        ["lost", "Lost"]
      ]
    : [
        ["assigned", "Assign"],
        ["contacted", "Contacted"],
        ["waiting_for_customer", "Waiting"],
        ["inspection_booked", "Inspection"],
        ["offer_sent", "Offer sent"],
        ["won", "Acquired / consigned"],
        ["in_inventory", "In inventory"],
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
        ["won", "Acquired"],
        ["in_inventory", "Inventory"]
      ];
}

function renderLeadProgress(buyer, status) {
  const current = String(status || "new").toLowerCase();
  const steps = leadProgressSteps(buyer);
  const currentIndex = steps.findIndex(([value]) => value === current);
  const closedLost = ["lost", "closed", "deleted", "in_inventory"].includes(current);
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

inventoryEl?.addEventListener("submit", async (event) => {
  const form = event.target.closest(".inventory-card-admin");
  if (!form) return;
  event.preventDefault();
  await saveInventoryListing(form);
});

inventoryEl?.addEventListener("click", async (event) => {
  const saveListingButton = event.target.closest("[data-save-inventory-listing]");
  if (saveListingButton) {
    event.preventDefault();
    const form = saveListingButton.closest(".inventory-card-admin");
    if (form) {
      const assignedTo = String(form.querySelector("[name='assignedTo']")?.value || "").trim();
      if (assignedTo) await syncInventoryRepAssignment({
        sourceLeadId: form.dataset.sourceLeadId || form.querySelector("[name='sourceLeadId']")?.value || "",
        assignedTo
      });
      await saveInventoryListing(form, assignedTo ? { assignedTo } : {});
    }
    return;
  }

  const uploadPhotosButton = event.target.closest("[data-upload-inventory-photos]");
  if (uploadPhotosButton) {
    await uploadInventoryPhotos(uploadPhotosButton);
    return;
  }

  const syncPhotosButton = event.target.closest("[data-sync-inventory-photos]");
  if (syncPhotosButton) {
    await syncInventoryDrivePhotos(syncPhotosButton);
    return;
  }

  const removePhotoButton = event.target.closest("[data-remove-inventory-photo]");
  if (removePhotoButton) {
    event.preventDefault();
    await removeInventoryPublicPhoto(removePhotoButton);
    return;
  }

  const deletePhotoButton = event.target.closest("[data-delete-inventory-photo]");
  if (deletePhotoButton) {
    event.preventDefault();
    await deleteInventoryDrivePhoto(deletePhotoButton);
    return;
  }

  const statusButton = event.target.closest("[data-inventory-status]");
  if (statusButton) {
    const form = statusButton.closest(".inventory-card-admin");
    if (!form) return;
    const nextStatus = statusButton.dataset.status || "draft";
    const label = nextStatus === "draft" ? "unpublish this listing" : `mark this listing as ${nextStatus}`;
    if (!window.confirm(`Confirm ${label}?`)) return;
    await saveInventoryListing(form, { status: nextStatus });
    return;
  }

  const removeButton = event.target.closest("[data-remove-inventory]");
  if (removeButton) {
    await removeInventoryListing(removeButton);
  }
});

async function removeInventoryPublicPhoto(button) {
  const form = button.closest(".inventory-card-admin");
  const url = String(button.dataset.removeInventoryPhoto || "").trim();
  if (!form || !url) return;
  const label = button.closest("label")?.querySelector("span")?.textContent || "this photo";
  const confirmed = window.confirm(
    `Remove "${label}" from the Buy page?\n\nThe original file stays in the vehicle Drive folder, but shoppers will no longer see it on this listing.`
  );
  if (!confirmed) return;

  const selectedUrls = [...form.querySelectorAll("input[name='selectedPhotoUrls']:checked")]
    .map((input) => String(input.value || "").trim())
    .filter(Boolean)
    .filter((selectedUrl) => selectedUrl !== url);

  button.disabled = true;
  inventoryStatusEl.textContent = "Removing photo from Buy page...";
  await saveInventoryListing(form, {
    selectedPhotoUrls: selectedUrls,
    showPhotos: selectedUrls.length > 0
  });
  button.disabled = false;
}

async function deleteInventoryDrivePhoto(button) {
  const form = button.closest(".inventory-card-admin");
  const url = String(button.dataset.deleteInventoryPhoto || "").trim();
  const listingId = form?.dataset.id || "";
  const leadId = form?.dataset.sourceLeadId || "";
  if (!form || !url || !listingId || !leadId) return;
  const label = button.closest("label")?.querySelector("span")?.textContent || "this photo";
  const confirmed = window.confirm(
    `Delete "${label}" from Google Drive?\n\nThis moves the source file to Drive trash and removes it from the Buy page. This should only be used for wrong, duplicate, or private photos.`
  );
  if (!confirmed) return;

  button.disabled = true;
  inventoryStatusEl.textContent = "Deleting Drive photo...";
  try {
    const response = await fetch("/api/inventory-photo", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId,
        leadId,
        url,
        fileId: driveFileIdFromUrl(url)
      })
    });
    const data = await response.json();
    if (!data.ok) throw new Error(formatApiError(data, "Unable to delete Drive photo."));
    inventoryStatusEl.textContent = "Drive photo deleted and removed from the Buy page.";
    await loadInventory();
  } catch (error) {
    inventoryStatusEl.textContent = error.message || "Unable to delete Drive photo.";
    button.disabled = false;
  }
}

async function saveInventoryListing(form, overrides = {}) {
  const payload = {
    id: form.dataset.id,
    ...inventoryListingPayloadFromForm(form),
    ...overrides
  };
  inventoryStatusEl.textContent = "Saving inventory listing...";
  const response = await fetch("/api/admin-inventory", {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  inventoryStatusEl.textContent = data.ok ? "Inventory listing saved." : formatApiError(data, "Unable to save inventory listing.");
  if (data.ok) {
    await syncInventoryRepAssignment(payload);
    await loadInventory();
  }
}

async function syncInventoryRepAssignment(payload) {
  const leadId = String(payload?.sourceLeadId || "").trim();
  const assignedTo = String(payload?.assignedTo || "").trim().toLowerCase();
  if (!leadId || !assignedTo) return;
  const response = await fetch("/api/leads", {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "assign_lead",
      id: leadId,
      assignedTo,
      status: "assigned"
    })
  });
  const data = await response.json();
  if (!data.ok) {
    throw new Error(formatApiError(data, "Inventory saved, but the stock rep was not assigned to the source lead."));
  }
}

async function removeInventoryListing(button) {
  const form = button.closest(".inventory-card-admin");
  const title = form?.querySelector(".inventory-list-col-main strong")?.textContent || "this vehicle";
  const id = button.dataset.removeInventory || form?.dataset.id || "";
  const sourceLeadId = form?.dataset.sourceLeadId || "";
  if (!id) return;
  const confirmed = window.confirm(
    `Move "${title}" out of warehouse?\n\nIt will disappear from Inventory management and the public Buy page. The original lead and activity remain, so staff can keep working on it and an admin can publish it again later.`
  );
  if (!confirmed) return;
  button.disabled = true;
  inventoryStatusEl.textContent = "Moving vehicle out of warehouse...";
  const response = await fetch(`/api/admin-inventory?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  const data = await response.json();
  inventoryStatusEl.textContent = data.ok ? "Vehicle moved out of warehouse. The seller lead was restored to the CRM Active queue." : formatApiError(data, "Unable to move vehicle out of warehouse.");
  if (data.ok) {
    inventoryCache = inventoryCache.filter((item) => item.id !== id && (!sourceLeadId || item.sourceLeadId !== sourceLeadId));
    renderInventoryWarehouse(inventoryCache);
    setAdminLeadFilter("restored");
    await loadLeads({ suppressAlerts: true, forceOpenActivity: true });
    const leadId = data.sourceLeadId || sourceLeadId;
    if (leadId) await openAdminLeadFromAlert(leadId);
    await loadInventory();
  }
  button.disabled = false;
}

async function uploadInventoryPhotos(button) {
  const form = button.closest(".inventory-card-admin");
  const leadId = form?.dataset?.sourceLeadId || "";
  const fileInput = form?.querySelector("input[name='inventoryPhotos']");
  const labelInput = form?.querySelector("select[name='inventoryPhotoLabel']");
  const status = form?.querySelector(".inventory-photo-status");
  const files = [...(fileInput?.files || [])];
  if (!leadId || !files.length) {
    if (status) status.textContent = "Choose at least one photo first.";
    return;
  }
  if (files.length > MAX_LEAD_PHOTOS) {
    const message = `Upload ${MAX_LEAD_PHOTOS} photos or fewer at a time.`;
    if (status) status.textContent = message;
    inventoryStatusEl.textContent = message;
    return;
  }

  button.disabled = true;
  inventoryStatusEl.textContent = "Uploading vehicle photos...";
  if (status) status.textContent = "Preparing photos...";
  try {
    const photoFiles = [];
    for (const file of files) {
      photoFiles.push(await fileToBase64Payload(file, labelInput?.value || "Vehicle photo"));
    }
    const uploadResponse = await fetch("/api/lead-photos", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        files: photoFiles
      })
    });
    const uploadData = await uploadResponse.json();
    if (!uploadData.ok) throw new Error(formatApiError(uploadData, "Unable to upload photos."));

    const listingPayload = inventoryListingPayloadFromForm(form);
    listingPayload.leadId = leadId;
    listingPayload.showPhotos = true;
    const syncResponse = await fetch("/api/inventory/from-lead", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(listingPayload)
    });
    const syncData = await syncResponse.json();
    if (!syncData.ok) throw new Error(formatApiError(syncData, "Photos uploaded, but could not attach them to the listing."));

    const message = `${uploadData.photos.length} photo(s) uploaded and attached to this warehouse listing.`;
    if (status) status.textContent = message;
    inventoryStatusEl.textContent = message;
    if (fileInput) fileInput.value = "";
    await loadInventory();
  } catch (error) {
    const message = error.message || "Unable to upload inventory photos.";
    if (status) status.textContent = message;
    inventoryStatusEl.textContent = message;
  } finally {
    button.disabled = false;
  }
}

async function syncInventoryDrivePhotos(button) {
  const form = button.closest(".inventory-card-admin");
  const listingId = form?.dataset?.id || "";
  const leadId = form?.dataset?.sourceLeadId || "";
  const status = form?.querySelector(".inventory-photo-status");
  if (!listingId || !leadId) {
    const message = "This listing is not connected to a vehicle lead folder.";
    if (status) status.textContent = message;
    inventoryStatusEl.textContent = message;
    return;
  }

  button.disabled = true;
  inventoryStatusEl.textContent = "Syncing this vehicle Drive folder...";
  if (status) status.textContent = "Checking this vehicle folder in Google Drive...";
  try {
    const response = await fetch("/api/inventory-photo-sync", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, leadId })
    });
    const data = await response.json();
    if (!data.ok) throw new Error(formatApiError(data, "Unable to sync this vehicle folder."));
    const message = data.count
      ? `${data.count} Drive photo(s) synced. Check the photos you want shoppers to see, then save.`
      : "Vehicle folder synced. No image files were found in this folder.";
    if (status) status.textContent = message;
    inventoryStatusEl.textContent = message;
    await loadInventory();
  } catch (error) {
    const message = error.message || "Unable to sync this vehicle folder.";
    if (status) status.textContent = message;
    inventoryStatusEl.textContent = message;
  } finally {
    button.disabled = false;
  }
}

function inventoryListingPayloadFromForm(form) {
  const data = new FormData(form);
  const assignedToField = form.querySelector("[name='assignedTo']");
  const payload = {
    sourceLeadId: String(data.get("sourceLeadId") || form.dataset.sourceLeadId || "").trim(),
    title: String(data.get("title") || "").trim(),
    askingPrice: String(data.get("askingPrice") || "").trim(),
    monthlyPaymentEstimate: String(data.get("monthlyPaymentEstimate") || "").trim(),
    vin: String(data.get("vin") || "").trim(),
    uvc: String(data.get("uvc") || "").trim(),
    vehicleYear: String(data.get("vehicleYear") || "").trim(),
    make: String(data.get("make") || "").trim(),
    model: String(data.get("model") || "").trim(),
    series: String(data.get("series") || "").trim(),
    style: String(data.get("style") || "").trim(),
    kilometers: String(data.get("kilometers") || "").trim(),
    color: String(data.get("color") || "").trim(),
    region: String(data.get("region") || "").trim(),
    status: String(data.get("status") || "draft").trim(),
    description: String(data.get("description") || "").trim(),
    assignedTo: String(assignedToField?.value || data.get("assignedTo") || "").trim()
  };
  ["showVin", "showUvc", "showKilometers", "showRegion", "showColor", "showMaintenance", "showPhotos"].forEach((key) => {
    if (data.has(key)) payload[key] = true;
  });
  if (data.has("photoSelectionPresent")) {
    payload.selectedPhotoUrls = data.getAll("selectedPhotoUrls").map((url) => String(url || "").trim()).filter(Boolean);
    payload.showPhotos = payload.selectedPhotoUrls.length > 0;
  }
  return payload;
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

function driveFileIdFromUrl(url) {
  const value = String(url || "");
  const fileMatch = value.match(/\/d\/([^/]+)/);
  const idMatch = value.match(/[?&]id=([^&]+)/);
  return fileMatch?.[1] || idMatch?.[1] || "";
}

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

leadsEl.addEventListener("click", async (event) => {
  const alertButton = event.target.closest("[data-admin-open-alert]");
  if (alertButton) {
    event.preventDefault();
    event.stopPropagation();
    await openAdminLeadFromAlert(alertButton.dataset.adminOpenAlert || "");
    return;
  }

  const openUrlButton = event.target.closest("[data-admin-open-url]");
  if (openUrlButton) {
    window.location.href = openUrlButton.dataset.adminOpenUrl || "/admin-vehicles.html";
    return;
  }

  const filterButton = event.target.closest("[data-admin-set-filter]");
  if (filterButton) {
    setAdminLeadFilter(filterButton.dataset.adminSetFilter || "all");
    renderLeadWorkbench(adminLeadsCache);
    document.querySelector("#crm-leads")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const openLeadButton = event.target.closest("[data-admin-open-lead]");
  if (openLeadButton) {
    await openAdminLeadFromAlert(openLeadButton.dataset.adminOpenLead || "");
    return;
  }

  const quickInventoryButton = event.target.closest("[data-quick-inventory]");
  if (quickInventoryButton) {
    await quickAddDraftInventory(quickInventoryButton);
    return;
  }

  const openWorkspaceButton = event.target.closest("[data-admin-open-workspace]");
  if (openWorkspaceButton) {
    const card = openWorkspaceButton.closest(".lead-card");
    if (card?.dataset?.id) setActiveAdminLead(card.dataset.id);
    await openAdminLeadWorkspace(card, { forceActivity: true });
    return;
  }

  const focusFollowUpButton = event.target.closest("[data-admin-focus-followup]");
  if (focusFollowUpButton) {
    const card = focusFollowUpButton.closest(".lead-card");
    if (card?.dataset?.id) setActiveAdminLead(card.dataset.id);
    await openAdminLeadWorkspace(card, { forceActivity: true, focus: "followup" });
    return;
  }

  const focusNoteButton = event.target.closest("[data-admin-focus-note]");
  if (focusNoteButton) {
    const card = focusNoteButton.closest(".lead-card");
    if (card?.dataset?.id) setActiveAdminLead(card.dataset.id);
    await openAdminLeadWorkspace(card, {
      forceActivity: true,
      focus: "note",
      noteType: focusNoteButton.dataset.adminFocusNote || "internal"
    });
    return;
  }

  const focusTaskButton = event.target.closest("[data-admin-focus-task]");
  if (focusTaskButton) {
    const card = focusTaskButton.closest(".lead-card");
    if (card?.dataset?.id) setActiveAdminLead(card.dataset.id);
    await openAdminLeadWorkspace(card, { forceActivity: true, focus: "task" });
    return;
  }

  const viewInventoryButton = event.target.closest("[data-view-inventory]");
  if (viewInventoryButton) {
    openInventoryListing(viewInventoryButton.dataset.viewInventory || "");
    return;
  }

  const deleteButton = event.target.closest("[data-delete-lead]");
  if (deleteButton) {
    await deleteSingleLead(deleteButton);
    return;
  }

  const restoreButton = event.target.closest("[data-restore-lead]");
  if (restoreButton) {
    await restoreSingleLead(restoreButton);
    return;
  }

  const uploadLeadPhotosButton = event.target.closest("[data-upload-lead-photos]");
  if (uploadLeadPhotosButton) {
    await uploadLeadPhotos(uploadLeadPhotosButton);
    return;
  }

  const ownerReadButton = event.target.closest("[data-owner-read]");
  if (ownerReadButton) {
    await markOwnerReviewed(ownerReadButton);
    return;
  }

  if (!isAdminCardControlClick(event)) {
    const clickedCard = event.target.closest(".lead-card");
    if (clickedCard?.dataset?.id) setActiveAdminLead(clickedCard.dataset.id);
  }
  return;
});

adminLeadDrawer?.addEventListener("click", async (event) => {
  if (event.target === adminLeadDrawer || event.target.classList.contains("admin-lead-drawer-panel")) {
    closeAdminDrawer();
    return;
  }
  const closeButton = event.target.closest("[data-drawer-close]");
  if (closeButton) {
    closeAdminDrawer();
    return;
  }

  const nextJumpButton = event.target.closest("[data-drawer-jump-next]");
  if (nextJumpButton) {
    scrollAdminDrawerToSection(nextJumpButton.dataset.drawerJumpNext || "update");
    return;
  }

  const lockToggleButton = event.target.closest("[data-drawer-toggle-lock]");
  if (lockToggleButton) {
    const form = adminLeadDrawerContent?.querySelector(lockToggleButton.dataset.drawerToggleLock || "");
    const locked = form?.dataset.editLocked !== "false";
    setAdminDrawerFormLocked(form, !locked);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-lead]");
  if (deleteButton) {
    await deleteSingleLead(deleteButton);
    return;
  }

  const restoreButton = event.target.closest("[data-restore-lead]");
  if (restoreButton) {
    await restoreSingleLead(restoreButton);
    return;
  }

  const quickInventoryButton = event.target.closest("[data-quick-inventory]");
  if (quickInventoryButton) {
    await quickAddDraftInventory(quickInventoryButton);
    return;
  }

  const viewInventoryButton = event.target.closest("[data-view-inventory]");
  if (viewInventoryButton) {
    openInventoryListing(viewInventoryButton.dataset.viewInventory || "");
    return;
  }

  const quickAssignButton = event.target.closest("[data-drawer-assign-to]");
  if (quickAssignButton) {
    await quickAssignDrawerLead(quickAssignButton);
    return;
  }

  const followUpPresetButton = event.target.closest("[data-followup-preset]");
  if (followUpPresetButton) {
    applyFollowUpPreset(followUpPresetButton.dataset.followupPreset || "");
    return;
  }

  const taskDueButton = event.target.closest("[data-admin-task-due]");
  if (taskDueButton) {
    applyAdminTaskDue(taskDueButton.dataset.adminTaskDue || "today");
    return;
  }

  const refreshButton = event.target.closest("[data-drawer-load-activity]");
  if (refreshButton) {
    adminDrawerActivityLoaded = false;
    await loadAdminDrawerActivity({ force: true, highlightLatest: true });
    return;
  }

  const noteTypeButton = event.target.closest("[data-drawer-note-type]");
  if (noteTypeButton) {
    const type = noteTypeButton.dataset.drawerNoteType || "internal";
    const select = adminLeadDrawerContent?.querySelector('.admin-drawer-note-form select[name="noteType"]');
    const field = adminLeadDrawerContent?.querySelector('.admin-drawer-note-form textarea[name="note"]');
    if (select) select.value = type;
    field?.focus();
    return;
  }

  const focusEmailButton = event.target.closest("[data-drawer-focus-email]");
  if (focusEmailButton) {
    const field = adminLeadDrawerContent?.querySelector('.admin-drawer-email-form input[name="subject"]');
    field?.focus();
    return;
  }

  const checklistToggleButton = event.target.closest("[data-drawer-dealdesk-check]");
  if (checklistToggleButton && activeAdminDrawerLeadId) {
    const itemKey = checklistToggleButton.dataset.drawerDealdeskCheck || "";
    const completed = checklistToggleButton.dataset.completed !== "true";
    checklistToggleButton.disabled = true;
    statusEl.textContent = "Saving deal desk checklist...";
    try {
      const response = await fetch("/api/lead-activity", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: activeAdminDrawerLeadId,
          type: "deal_desk",
          kind: "check",
          itemKey,
          completed
        })
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Unable to save deal desk checklist.");
      adminDrawerActivityLoaded = false;
      statusEl.textContent = "Deal desk checklist updated.";
      await Promise.all([
        loadAdminDrawerActivity({ force: true, highlightLatest: true }),
        loadLeads({ suppressAlerts: true, forceOpenActivity: true })
      ]);
    } catch (error) {
      checklistToggleButton.disabled = false;
      statusEl.textContent = error.message || "Unable to save deal desk checklist.";
    }
    return;
  }

  const keyHandoffButton = event.target.closest("[data-drawer-dealdesk-key]");
  if (keyHandoffButton && activeAdminDrawerLeadId) {
    const handoffStatus = keyHandoffButton.dataset.drawerDealdeskKey || "pending";
    keyHandoffButton.disabled = true;
    statusEl.textContent = "Saving key handoff...";
    try {
      const response = await fetch("/api/lead-activity", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: activeAdminDrawerLeadId,
          type: "deal_desk",
          kind: "key_handoff",
          status: handoffStatus
        })
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Unable to save key handoff.");
      adminDrawerActivityLoaded = false;
      statusEl.textContent = "Key handoff updated.";
      await Promise.all([
        loadAdminDrawerActivity({ force: true, highlightLatest: true }),
        loadLeads({ suppressAlerts: true, forceOpenActivity: true })
      ]);
    } catch (error) {
      keyHandoffButton.disabled = false;
      statusEl.textContent = error.message || "Unable to save key handoff.";
    }
    return;
  }

  const ownerReadButton = event.target.closest("[data-owner-read]");
  if (ownerReadButton) {
    await markOwnerReviewed(ownerReadButton);
    return;
  }

  const reviewButton = event.target.closest("[data-duplicate-review]");
  if (reviewButton && activeAdminDrawerLeadId) {
    reviewButton.disabled = true;
    statusEl.textContent = "Saving duplicate vehicle review...";
    try {
      const response = await fetch("/api/leads", {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "duplicate_review",
          id: activeAdminDrawerLeadId,
          decision: reviewButton.dataset.duplicateReview || "keep_separate",
          targetLeadId: reviewButton.dataset.targetLeadId || "",
          listingId: reviewButton.dataset.listingId || ""
        })
      });
      const data = await response.json();
      if (!data.ok) throw new Error(formatApiError(data, "Unable to save duplicate review."));
      statusEl.textContent = "Duplicate vehicle review saved.";
      await loadLeads({ suppressAlerts: true, forceOpenActivity: true });
    } catch (error) {
      statusEl.textContent = error.message || "Unable to save duplicate review.";
      reviewButton.disabled = false;
    }
    return;
  }

  const completeButton = event.target.closest("[data-complete-task]");
  if (completeButton && activeAdminDrawerLeadId) {
    const response = await fetch("/api/lead-activity", {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: activeAdminDrawerLeadId,
        taskId: completeButton.dataset.completeTask,
        completed: completeButton.dataset.completed !== "true"
      })
    });
    const data = await response.json();
    statusEl.textContent = data.ok ? "Task updated." : (data.error || "Unable to update task.");
    if (data.ok) {
      adminDrawerActivityLoaded = false;
      await Promise.all([
        loadAdminDrawerActivity({ force: true, highlightLatest: true }),
        loadLeads({ suppressAlerts: true, forceOpenActivity: true })
      ]);
    }
    return;
  }

  const statusButton = event.target.closest("[data-drawer-status]");
  if (statusButton && activeAdminDrawerLeadId) {
    const response = await fetch("/api/lead-activity", {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: activeAdminDrawerLeadId,
        action: "status",
        status: statusButton.dataset.drawerStatus,
        note: `Admin updated status to ${String(statusButton.dataset.drawerStatus || "").replaceAll("_", " ")}.`
      })
    });
    const data = await response.json();
    statusEl.textContent = data.ok ? "Lead status updated." : (data.error || "Unable to update lead status.");
    if (data.ok) await loadLeads({ suppressAlerts: true, forceOpenActivity: true, refreshActiveDrawer: true });
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeAdminDrawerLeadId) closeAdminDrawer();
});

adminLeadDrawer?.addEventListener("submit", async (event) => {
  const ownerForm = event.target.closest(".admin-drawer-owner-form");
  if (ownerForm && activeAdminDrawerLeadId) {
    event.preventDefault();
    if (ownerForm.dataset.editLocked === "true") {
      statusEl.textContent = "Unlock this section before editing.";
      ownerForm.closest(".admin-drawer-section")?.classList.add("drawer-section-pulse");
      window.setTimeout(() => ownerForm.closest(".admin-drawer-section")?.classList.remove("drawer-section-pulse"), 1800);
      return;
    }
    const isAssignForm = ownerForm.classList.contains("admin-drawer-assign-form");
    if (isAssignForm) syncAssignmentStatus(ownerForm);
    const payload = {
      id: activeAdminDrawerLeadId,
      authorEmail: currentAdminEmail(),
      ...Object.fromEntries(new FormData(ownerForm).entries())
    };
    if (isAssignForm) payload.action = "assign_lead";
    const formStatus = isAssignForm ? ownerForm.querySelector("[data-assign-status]") : null;
    const submitButton = ownerForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    if (formStatus) formStatus.textContent = "Saving...";
    const savedMessage = ownerForm.classList.contains("admin-drawer-assign-form")
      ? "Assignment saved."
      : ownerForm.classList.contains("admin-drawer-pricing-form")
        ? "Manager pricing saved."
        : ownerForm.classList.contains("admin-drawer-vehicle-form")
          ? "Vehicle details saved."
          : ownerForm.classList.contains("admin-drawer-owner-info-form")
            ? "Owner info saved."
            : "Lead tools saved.";
    try {
      const data = await fetchApiJson("/api/leads", {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!data.ok) {
        throw new Error(formatApiError(data, isAssignForm ? "Unable to save assignment." : "Unable to save lead."));
      }
      mergeLeadIntoCache(data.lead);
      statusEl.textContent = savedMessage;
      if (formStatus) formStatus.textContent = savedMessage;
      await loadLeads({ suppressAlerts: true, forceOpenActivity: true, refreshActiveDrawer: true }).catch(() => null);
      if (isAssignForm) {
        adminDrawerActivityLoaded = false;
        await loadAdminDrawerActivity({ force: true, highlightLatest: true }).catch(() => null);
      }
    } catch (error) {
      const message = error.message || (isAssignForm ? "Unable to save assignment." : "Unable to save lead.");
      statusEl.textContent = message;
      if (formStatus) formStatus.textContent = message;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
    return;
  }

  const noteForm = event.target.closest(".admin-drawer-note-form");
  if (noteForm && activeAdminDrawerLeadId) {
    event.preventDefault();
    const payload = {
      leadId: activeAdminDrawerLeadId,
      type: "note",
      ...Object.fromEntries(new FormData(noteForm).entries())
    };
    const response = await fetch("/api/lead-activity", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    statusEl.textContent = data.ok ? "Note saved." : (data.error || "Unable to save note.");
    if (data.ok) {
      await maybeAdvanceStatusAfterCustomerTouch(payload.noteType);
      noteForm.reset();
      adminDrawerActivityLoaded = false;
      await Promise.all([
        loadAdminDrawerActivity({ force: true, highlightLatest: true }),
        loadLeads({ suppressAlerts: true, forceOpenActivity: true, refreshActiveDrawer: true })
      ]);
    }
    return;
  }

  const taskForm = event.target.closest(".admin-drawer-task-form");
  if (taskForm && activeAdminDrawerLeadId) {
    event.preventDefault();
    const payload = {
      leadId: activeAdminDrawerLeadId,
      type: "task",
      ...Object.fromEntries(new FormData(taskForm).entries())
    };
    const response = await fetch("/api/lead-activity", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    statusEl.textContent = data.ok ? "Task saved." : (data.error || "Unable to save task.");
    if (data.ok) {
      taskForm.reset();
      adminDrawerActivityLoaded = false;
      await Promise.all([
        loadAdminDrawerActivity({ force: true, highlightLatest: true }),
        loadLeads({ suppressAlerts: true, forceOpenActivity: true, refreshActiveDrawer: true })
      ]);
    }
    return;
  }

  const emailForm = event.target.closest(".admin-drawer-email-form");
  if (emailForm && activeAdminDrawerLeadId) {
    event.preventDefault();
    const payload = {
      leadId: activeAdminDrawerLeadId,
      type: "email",
      ...Object.fromEntries(new FormData(emailForm).entries())
    };
    const response = await fetch("/api/lead-activity", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    statusEl.textContent = data.ok ? "Email logged." : (data.error || "Unable to log email.");
    if (data.ok) {
      emailForm.reset();
      const recipient = emailForm.querySelector('input[name="sentTo"]');
      if (recipient) recipient.value = payload.sentTo || "";
      adminDrawerActivityLoaded = false;
      await Promise.all([
        loadAdminDrawerActivity({ force: true, highlightLatest: true }),
        loadLeads({ suppressAlerts: true, forceOpenActivity: true, refreshActiveDrawer: true })
      ]);
    }
  }
});

adminLeadDrawer?.addEventListener("change", async (event) => {
  const taskPreset = event.target.closest('.admin-drawer-task-form select[name="taskPreset"]');
  if (taskPreset) {
    applyAdminTaskTemplate(taskPreset.value || "");
    return;
  }

  const assignField = event.target.closest('.admin-drawer-assign-form [name="assignedTo"]');
  if (assignField) {
    const form = assignField.closest(".admin-drawer-assign-form");
    syncAssignmentStatus(form);
    const formStatus = form?.querySelector("[data-assign-status]");
    const assignedValue = String(assignField.value || "").trim();
    if (assignedValue) {
      if (formStatus) formStatus.textContent = "Saving rep...";
      form?.requestSubmit();
    } else if (formStatus) {
      formStatus.textContent = "Choose a rep, then save.";
    }
    return;
  }

  const deliveryField = event.target.closest("[data-drawer-dealdesk-delivery]");
  if (!deliveryField || !activeAdminDrawerLeadId) return;
  statusEl.textContent = "Saving delivery date...";
  try {
    const response = await fetch("/api/lead-activity", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: activeAdminDrawerLeadId,
        type: "deal_desk",
        kind: "delivery",
        deliveryAt: deliveryField.value
      })
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Unable to save delivery date.");
    adminDrawerActivityLoaded = false;
    statusEl.textContent = "Delivery date updated.";
    await Promise.all([
      loadAdminDrawerActivity({ force: true, highlightLatest: true }),
      loadLeads({ suppressAlerts: true, forceOpenActivity: true })
    ]);
  } catch (error) {
    statusEl.textContent = error.message || "Unable to save delivery date.";
  }
});

function syncAssignmentStatus(form) {
  if (!form) return;
  const assignedField = form.querySelector('[name="assignedTo"]');
  const statusField = form.querySelector('select[name="status"]');
  if (!assignedField || !statusField) return;
  const currentStatus = String(statusField.value || "").trim().toLowerCase();
  if (String(assignedField.value || "").trim() && (!currentStatus || currentStatus === "new")) {
    statusField.value = "assigned";
  }
}

function applyFollowUpPreset(preset) {
  const input = adminLeadDrawerContent?.querySelector('.admin-drawer-assign-form input[name="nextFollowUpAt"]');
  if (!input) return;
  const date = new Date();
  if (preset === "today") {
    date.setHours(17, 0, 0, 0);
  } else if (preset === "tomorrow") {
    date.setDate(date.getDate() + 1);
    date.setHours(10, 0, 0, 0);
  } else if (preset === "3d") {
    date.setDate(date.getDate() + 3);
    date.setHours(10, 0, 0, 0);
  } else if (preset === "7d") {
    date.setDate(date.getDate() + 7);
    date.setHours(10, 0, 0, 0);
  } else {
    return;
  }
  input.value = datetimeLocalValue(date.toISOString());
  input.focus();
}

function adminTaskTemplates(buyerLead) {
  const shared = [
    { key: "first_touch", label: "First touch", hint: "Call/text within 15 min", title: "First touch: call or text customer, confirm request and best callback time.", due: "soon" },
    { key: "manager_review", label: "Manager review", hint: "Decision needed", title: "Manager review: confirm price, status, and next move before staff updates customer.", due: "today" },
    { key: "assign_rep", label: "Assign rep", hint: "Main responsibility", title: "Assign responsible rep and confirm the next required customer touch.", due: "today" }
  ];
  const buyer = [
    { key: "buyer_followup", label: "Buyer follow-up", hint: "Buy page inquiry", title: "Call buyer inquiry, confirm vehicle interest, budget, trade, finance plan, and visit timeline.", due: "soon" },
    { key: "test_drive", label: "Test drive", hint: "Appointment ready", title: "Book or confirm test drive; verify vehicle availability, keys, plate, and appointment time.", due: "today" },
    { key: "finance_trade", label: "Finance / trade", hint: "Docs and approval", title: "Confirm trade-in, finance documents, credit application, deposit, and decision timeline.", due: "tomorrow" },
    { key: "delivery", label: "Delivery", hint: "Final handoff", title: "Prepare delivery handoff: documents, insurance, plates, payment, keys, and pickup time.", due: "next_week" }
  ];
  const seller = [
    { key: "inspection", label: "Inspection", hint: "Appraisal visit", title: "Book inspection/appraisal and verify VIN, kilometers, condition, lien, title, and seller intent.", due: "tomorrow" },
    { key: "photo_package", label: "Photo package", hint: "Staff upload", title: "Upload full vehicle photo package: exterior, interior, odometer, VIN, damage, keys/documents, recon, and listing photos.", due: "today" },
    { key: "keys_docs", label: "Keys / docs", hint: "Ownership ready", title: "Collect and verify keys, registration/title, lien payout, ownership documents, and seller ID.", due: "today" },
    { key: "recon", label: "Recon", hint: "Repair blockers", title: "Get recon estimate and update repairs, detail, safety, tires/brakes, cost, timeline, and blockers.", due: "tomorrow" },
    { key: "publish_review", label: "Publish review", hint: "Price/photos/listing", title: "Manager approval: price, recon spend, public photos, description, and publish readiness.", due: "today" }
  ];
  return buyerLead ? [...shared, ...buyer] : [...shared, ...seller];
}

function applyAdminTaskTemplate(key) {
  const lead = adminLeadsCache.find((item) => String(item.id || "") === String(activeAdminDrawerLeadId || ""));
  const template = adminTaskTemplates(isBuyerLead(lead)).find((item) => item.key === key);
  if (!template) return;
  const title = adminLeadDrawerContent?.querySelector('.admin-drawer-task-form textarea[name="title"], .admin-drawer-task-form input[name="title"]');
  const dueAt = adminLeadDrawerContent?.querySelector('.admin-drawer-task-form input[name="dueAt"]');
  const assignedTo = adminLeadDrawerContent?.querySelector('.admin-drawer-task-form input[name="assignedTo"], .admin-drawer-task-form select[name="assignedTo"]');
  if (title) title.value = template.title;
  if (dueAt) dueAt.value = adminTaskDueValue(template.due);
  if (assignedTo && !assignedTo.value) assignedTo.value = lead?.assigned_to || "";
  title?.focus();
}

function applyAdminTaskDue(due) {
  const dueAt = adminLeadDrawerContent?.querySelector('.admin-drawer-task-form input[name="dueAt"]');
  if (dueAt) dueAt.value = adminTaskDueValue(due);
}

function adminTaskDueValue(due) {
  const date = new Date();
  if (due === "soon") {
    date.setHours(date.getHours() + 2, 0, 0, 0);
  } else if (due === "tomorrow") {
    date.setDate(date.getDate() + 1);
    date.setHours(10, 0, 0, 0);
  } else if (due === "next_week") {
    date.setDate(date.getDate() + 7);
    date.setHours(10, 0, 0, 0);
  } else {
    date.setHours(17, 0, 0, 0);
  }
  return datetimeLocalValue(date.toISOString());
}

async function maybeAdvanceStatusAfterCustomerTouch(noteType) {
  const type = String(noteType || "").trim().toLowerCase();
  if (!["call", "sms", "email"].includes(type) || !activeAdminDrawerLeadId) return;
  const lead = adminLeadsCache.find((item) => String(item.id || "") === String(activeAdminDrawerLeadId));
  const currentStatus = String(lead?.status || "").trim().toLowerCase();
  if (!["new", "assigned"].includes(currentStatus)) return;
  await fetch("/api/lead-activity", {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      leadId: activeAdminDrawerLeadId,
      action: "status",
      status: "contacted",
      note: "Customer touch logged; status advanced to contacted."
    })
  }).catch(() => null);
}

async function markManagerReviewedByLeadId(leadId, options = {}) {
  const id = String(leadId || "").trim();
  if (!id) return null;
  const response = await fetch("/api/leads", {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "owner_read",
      id
    })
  });
  const data = await response.json();
  if (!data.ok) throw new Error(formatApiError(data, "Unable to mark reviewed."));
  adminLeadAlertMap.delete(id);
  markAdminLeadTokenRead(id);
  if (!options.silent) statusEl.textContent = "Manager review marked read.";
  if (options.reload !== false) await loadLeads({ suppressAlerts: true, forceOpenActivity: true });
  return data;
}

async function markOwnerReviewed(button) {
  const card = button.closest(".lead-card");
  const leadId = button.dataset.ownerRead || card?.dataset?.id || "";
  if (!leadId) return;
  button.disabled = true;
  statusEl.textContent = "Marking manager review as read...";
  try {
    await markManagerReviewedByLeadId(leadId);
  } catch (error) {
    statusEl.textContent = error.message || "Unable to mark reviewed.";
    button.disabled = false;
  }
}

async function openAdminLeadWorkspace(card, options = {}) {
  if (!card) return;
  if (card.dataset.id) {
    const leadId = card.dataset.id;
    const lead = adminLeadsCache.find((item) => String(item.id || "") === String(leadId));
    const hadAlert = hasAdminVisibleAlert(leadId);
    const switchingDrawer = activeAdminDrawerLeadId !== String(leadId) || adminLeadDrawer.hidden;
    setActiveAdminLead(leadId);
    if (hadAlert) {
      clearAdminVisibleAlertGroup(leadId);
      renderAdminLeadAlerts();
      card.classList.remove("lead-card-updated");
      renderLeadWorkbench(adminLeadsCache);
    }
    if (switchingDrawer) {
      renderAdminDrawer(leadId);
      adminDrawerActivityLoaded = false;
    }
    await loadAdminDrawerActivity({
      force: Boolean(switchingDrawer || hadAlert || options.focus === "timeline"),
      highlightLatest: Boolean(hadAlert || options.focus === "timeline")
    });
    if (lead?.owner_review?.unread) {
      await markManagerReviewedByLeadId(leadId, { silent: true });
    }
  }
  const details = card.querySelector(".lead-queue-more");
  if (details && !details.open) details.open = true;

  if (options.focus === "followup") {
    const input = adminLeadDrawerContent?.querySelector('.admin-drawer-owner-form input[name="nextFollowUpAt"]');
    input?.focus();
    return;
  }

  if (options.focus === "task") {
    const taskInput = adminLeadDrawerContent?.querySelector('.admin-drawer-task-form textarea[name="title"], .admin-drawer-task-form input[name="title"]');
    taskInput?.focus();
    return;
  }

  if (options.focus === "note") {
    const noteType = adminLeadDrawerContent?.querySelector('.admin-drawer-note-form select[name="noteType"]');
    const noteField = adminLeadDrawerContent?.querySelector('.admin-drawer-note-form textarea[name="note"]');
    if (noteType && options.noteType) noteType.value = options.noteType;
    noteField?.focus();
  }
}

async function quickAddDraftInventory(button) {
  const card = button.closest(".lead-card");
  const leadId = button.dataset.quickInventory || card?.dataset?.id || "";
  if (!leadId) return;
  const lead = adminLeadsCache.find((item) => String(item.id || "") === String(leadId));
  if (lead?.duplicate_warning?.message && !lead?.duplicate_warning?.reviewed) {
    statusEl.textContent = "Review duplicate seller vehicle first, then move it into Warehouse.";
    return;
  }
  const previousStatus = String(lead?.status || "assigned").trim().toLowerCase() || "assigned";

  button.disabled = true;
  statusEl.textContent = "Moving vehicle to warehouse draft...";
  try {
    const response = await fetch("/api/inventory/from-lead", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        status: "draft"
      })
    });
    const data = await response.json();
    if (!data.ok) throw new Error(formatApiError(data, "Unable to add inventory draft."));
    await fetch("/api/lead-activity", {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        action: "status",
        status: "in_inventory",
        note: `Admin moved this seller lead into the warehouse. Previous CRM status: ${previousStatus}. Vehicle details, photos, price, and publishing are now managed from Inventory.`
      })
    }).catch(() => null);
    statusEl.textContent = "Warehouse draft created. The SELL lead was moved out of Active leads.";
    await Promise.all([loadInventory(), loadLeads({ suppressAlerts: true, forceOpenActivity: true })]);
    document.querySelector("#inventory-warehouse")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    statusEl.textContent = error.message || "Unable to add inventory draft.";
    button.disabled = false;
  }
}

function openInventoryListing(id) {
  if (!id) return;
  if (inventoryFilter !== "all" && !filterInventory(inventoryCache).some((item) => item.id === id)) {
    setInventoryFilter("all");
    renderInventoryWarehouse(inventoryCache);
  }
  const card = inventoryEl.querySelector(`.inventory-card-admin[data-id="${cssEscape(id)}"]`);
  if (!card) return;
  document.querySelector("#inventory-warehouse")?.scrollIntoView({ behavior: "smooth", block: "start" });
  card.classList.add("lead-card-flash");
  window.setTimeout(() => card.classList.remove("lead-card-flash"), 1600);
}

leadsEl.addEventListener("toggle", async (event) => {
  const details = event.target.closest(".lead-queue-more");
  if (!details || !details.open) return;

  const card = details.closest(".lead-card");
  if (!card) return;
  if (card.dataset.id) setActiveAdminLead(card.dataset.id);
  if (card.dataset.id && hasAdminVisibleAlert(card.dataset.id)) {
    clearAdminVisibleAlertGroup(card.dataset.id);
    renderAdminLeadAlerts();
    card.classList.remove("lead-card-updated");
  }
}, true);

leadsEl.addEventListener("click", async (event) => {
  const reviewButton = event.target.closest("[data-duplicate-review]");
  if (!reviewButton) return;
  const card = reviewButton.closest(".lead-card");
  const leadId = card?.dataset?.id || "";
  const decision = reviewButton.dataset.duplicateReview || "keep_separate";
  const targetLeadId = reviewButton.dataset.targetLeadId || "";
  const listingId = reviewButton.dataset.listingId || "";
  if (!leadId) return;
  reviewButton.disabled = true;
  statusEl.textContent = "Saving duplicate vehicle review...";
  try {
    const response = await fetch("/api/leads", {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "duplicate_review",
        id: leadId,
        decision,
        targetLeadId,
        listingId
      })
    });
    const data = await response.json();
    if (!data.ok) throw new Error(formatApiError(data, "Unable to save duplicate review."));
    statusEl.textContent = "Duplicate vehicle review saved.";
    await loadLeads({ suppressAlerts: true, forceOpenActivity: true });
  } catch (error) {
    statusEl.textContent = error.message || "Unable to save duplicate review.";
    reviewButton.disabled = false;
  }
});

leadsEl.addEventListener("focusin", (event) => {
  const card = event.target.closest(".lead-card");
  if (card?.dataset?.id) setActiveAdminLead(card.dataset.id);
});

async function deleteSingleLead(button) {
  const id = button.dataset.deleteLead || "";
  const title = button.dataset.deleteTitle || "this lead";
  if (!id || !adminSession) return;

  const confirmed = window.confirm(
    `Move "${title}" to the recycle bin?\n\nThis hides the lead from Active work but keeps its notes, tasks, email logs, Google Sheet rows, and Google Drive files. You can restore it from the Recycle Bin filter.`
  );
  if (!confirmed) return;

  button.disabled = true;
  statusEl.textContent = "Moving lead to recycle bin...";
  const response = await fetch(`/api/leads?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  const data = await response.json();
  statusEl.textContent = data.ok ? `Moved ${data.deleted || 0} lead record to recycle bin.` : formatApiError(data, "Unable to move lead to recycle bin.");
  if (data.ok) {
    if (activeAdminDrawerLeadId === id) closeAdminDrawer();
    await loadLeads({ suppressAlerts: true });
  }
  button.disabled = false;
}

async function restoreSingleLead(button) {
  const id = button.dataset.restoreLead || "";
  const title = button.dataset.restoreTitle || "this lead";
  if (!id || !adminSession) return;

  const lead = adminLeadsCache.find((item) => String(item.id || "") === String(id));
  const nextStatus = String(lead?.assigned_to || "").trim() ? "assigned" : "new";
  const confirmed = window.confirm(`Restore "${title}" from the recycle bin?`);
  if (!confirmed) return;

  button.disabled = true;
  statusEl.textContent = "Restoring lead...";
  const response = await fetch("/api/leads", {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      status: nextStatus,
      updatedBy: adminSession?.user?.email || "admin"
    })
  });
  const data = await response.json().catch(() => ({}));
  statusEl.textContent = data.ok ? "Lead restored to Active Up Sheets." : formatApiError(data, "Unable to restore lead.");
  if (data.ok) {
    if (activeAdminDrawerLeadId === id) closeAdminDrawer();
    setAdminLeadFilter("active");
    await loadLeads({ suppressAlerts: true, forceOpenActivity: true });
    await openAdminLeadFromAlert(id);
  }
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
  if (files.length > MAX_LEAD_PHOTOS) {
    const message = `Upload ${MAX_LEAD_PHOTOS} photos or fewer at a time.`;
    if (status) status.textContent = message;
    statusEl.textContent = message;
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
      if (activeAdminDrawerLeadId === card?.dataset?.id) {
        adminDrawerActivityLoaded = false;
        await loadAdminDrawerActivity({ force: true, highlightLatest: true });
      }
      await loadLeads({ suppressAlerts: true, forceOpenActivity: true });
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

function renderActivity(data, options = {}) {
  const latestKey = options.highlightLatest ? latestActivityKey(data) : "";
  const items = [
    ...(data.tasks || []).map((task) => ({
      key: `task:${task.id}`,
      time: new Date(task.completed_at || task.created_at || task.due_at || 0).getTime(),
      render: `
        <article class="activity-item ${task.completed_at ? "activity-done" : ""} ${latestKey === `task:${task.id}` ? "activity-highlight" : ""}">
          <div>
            <strong>${escapeHtml(task.title || "Task")}</strong>
            <span>Task for ${escapeHtml(task.assigned_to || "unassigned")} ${task.due_at ? `due ${escapeHtml(formatDateTime(task.due_at))}` : ""}</span>
          </div>
          <button type="button" data-complete-task="${escapeHtml(task.id)}" data-completed="${task.completed_at ? "true" : "false"}">
            ${task.completed_at ? "Reopen" : "Complete"}
          </button>
        </article>
      `
    })),
    ...(data.notes || [])
      .filter((note) => note.note_type !== "owner_read")
      .map((note) => ({
        key: `note:${note.id}`,
        time: new Date(note.created_at || 0).getTime(),
        render: `
          <article class="activity-item ${latestKey === `note:${note.id}` ? "activity-highlight" : ""}">
            <div>
              <strong>${escapeHtml(activityNoteLabel(note.note_type))} by ${escapeHtml(note.author_email || "-")}</strong>
              <span>${escapeHtml(formatDateTime(note.created_at))}</span>
              <p>${linkifyNote(formatActivityNoteText(note.note || ""))}</p>
            </div>
          </article>
        `
      })),
    ...(data.emails || []).map((email) => ({
      key: `email:${email.id}`,
      time: new Date(email.created_at || 0).getTime(),
      render: `
        <article class="activity-item ${latestKey === `email:${email.id}` ? "activity-highlight" : ""}">
          <div>
            <strong>Email to ${escapeHtml(email.sent_to || "-")}</strong>
            <span>${escapeHtml(email.subject || "")} - ${escapeHtml(formatDateTime(email.created_at))}</span>
          </div>
        </article>
      `
    }))
  ]
    .filter((item) => !Number.isNaN(item.time))
    .sort((a, b) => b.time - a.time);
  const limited = Number(options.limit || 0) > 0 ? items.slice(0, Number(options.limit)) : items;
  return limited.map((item) => item.render).join("") || "<p>No activity yet.</p>";
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

function activityNoteLabel(type) {
  const value = String(type || "note").trim().toLowerCase();
  const labels = {
    owner_review: "manager review request",
    correction: "correction request",
    internal: "internal note",
    inspection: "inspection note",
    offer: "offer note",
    call: "call note",
    sms: "sms note",
    email: "email note"
  };
  return labels[value] || value || "note";
}

function formatActivityNoteText(note) {
  const text = String(note || "").trim();
  let match = text.match(/^\[Deal desk:check:([a-z_]+):(done|open)\]/i);
  if (match) return `${dealDeskItemLabel(match[1])} marked ${String(match[2]).toLowerCase() === "done" ? "complete" : "open"}.`;
  match = text.match(/^\[Deal desk:delivery_at:([^\]]+)\]/i);
  if (match) return `Delivery date set for ${formatDateTime(match[1])}.`;
  match = text.match(/^\[Deal desk:key_handoff:(pending|ready|complete)\]/i);
  if (match) return match[1] === "complete" ? "Keys handed off." : match[1] === "ready" ? "Keys ready for handoff." : "Key handoff pending.";
  return text;
}

function dealDeskItemLabel(key) {
  const labels = {
    docs_ready: "Docs ready",
    keys_ready: "Keys ready",
    delivery_booked: "Delivery booked",
    vehicle_picked_up: "Vehicle picked up",
    purchase_or_consignment_agreement: "Purchase / consignment agreement",
    commission_terms_confirmed: "Commission terms confirmed",
    intake_photos_complete: "Intake photos complete",
    keys_collected: "Keys collected",
    recon_estimate_ready: "Recon estimate ready",
    repairs_complete: "Repairs complete",
    pricing_approved: "Pricing approved",
    publish_review_complete: "Publish review complete",
    listing_live: "Listing live",
    photos_approved: "Photos approved",
    price_approved: "Price approved",
    sales_followup_ready: "Sales follow-up ready",
    sold_deal_recorded: "Sold deal recorded",
    delivery_confirmed: "Delivery confirmed",
    gross_confirmed: "Gross confirmed",
    final_docs_complete: "Final docs complete"
  };
  return labels[String(key || "").trim().toLowerCase()] || "Deal desk item";
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
  dealersStatusEl.textContent = "Removing staff access...";
  const response = await fetch(`/api/dealer-staff?email=${encodeURIComponent(email)}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  const data = await response.json();
  dealersStatusEl.textContent = data.ok ? "Staff access removed." : formatApiError(data, "Unable to remove staff access.");
  await loadDealers();
});

function formatApiError(data, fallback) {
  const value = data?.error || data?.details || data;
  if (!value) return fallback;
  if (typeof value === "string") return value;
  if (isMissingInventoryTable(value)) {
    return "Supabase is missing public.vehicle_listings. Open Supabase SQL Editor, run the latest supabase.sql, then reload this page.";
  }
  if (isMissingInventoryColumn(value)) {
    const message = value.message || value.details || "Supabase inventory schema is missing a column.";
    return `${message} Run the latest supabase.sql in Supabase SQL Editor, then reload this page.`;
  }
  if (value.message) return [value.message, value.hint].filter(Boolean).join(" ");
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
  return text.includes("vehicle_listings") && text.includes("schema cache") && text.includes("table");
}

function isMissingInventoryColumn(value) {
  const text = JSON.stringify(value || {}).toLowerCase();
  return text.includes("vehicle_listings") && text.includes("schema cache") && text.includes("column");
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
  const closedStatuses = new Set(["won", "lost", "closed", "deleted", "in_inventory"]);
  if (closedStatuses.has(String(status || "").toLowerCase())) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function isFollowUpDue(value, status) {
  if (!value) return false;
  const closedStatuses = new Set(["won", "lost", "closed", "deleted", "in_inventory"]);
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

function currentAdminEmail() {
  return String(adminSession?.user?.email || "").trim().toLowerCase();
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
