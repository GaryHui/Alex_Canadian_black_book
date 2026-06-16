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
const ADMIN_LEAD_READ_TOKENS_KEY = "autoswitch-admin-lead-read-tokens";

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
let pendingAdminDeepLinkLeadId = new URLSearchParams(window.location.search).get("leadId") || "";

reloadUsersButton.addEventListener("click", loadUsers);
reloadLeadsButton.addEventListener("click", () => Promise.all([
  loadLeads({ forceOpenActivity: true }),
  loadInventory()
]));
reloadDealersButton.addEventListener("click", loadDealers);
reloadInventoryButton?.addEventListener("click", loadInventory);
reloadInquiriesButton?.addEventListener("click", loadInquiries);
clearLeadsButton?.addEventListener("click", clearAllLeads);
dealerStaffForm.addEventListener("submit", addDealer);
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

  inventoryCache = data.inventory || [];
  renderInventoryWarehouse(inventoryCache);
  if (adminLeadsCache.length) renderLeadWorkbench(adminLeadsCache);
}

function renderInventoryWarehouse(inventory) {
  const filtered = filterInventory(inventory);
  renderInventorySummary(inventory);
  if (adminLeadsCache.length) renderAdminOverview(adminLeadsCache);
  inventoryStatusEl.textContent = `${filtered.length} shown of ${inventory.length} inventory listing(s).`;
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
  const counts = {
    published: inventory.filter((item) => item.status === "published").length,
    draft: inventory.filter((item) => ["draft", "review"].includes(item.status)).length,
    sold: inventory.filter((item) => item.status === "sold").length,
    archived: inventory.filter((item) => item.status === "archived").length
  };
  inventorySummaryEl.innerHTML = [
    ["Published", counts.published, "Visible on Buy page"],
    ["Draft / review", counts.draft, "Not public yet"],
    ["Sold", counts.sold, "Closed stock"],
    ["Archived", counts.archived, "Hidden history"]
  ].map(([label, value, hint]) => `
    <article>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(hint)}</small>
    </article>
  `).join("");
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
            <p>Choose which Drive photos appear on the Buy page. Saving this listing replaces the public photo set with the checked photos.</p>
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
      <div class="inventory-card-head">
        <div>
          <strong>${escapeHtml(listing.title || "Untitled vehicle")}</strong>
          <span>${escapeHtml([listing.year, listing.make, listing.model, listing.series, listing.style].filter(Boolean).join(" ") || "-")}</span>
        </div>
        <b class="status-pill status-${escapeHtml(cssToken(listing.status || "draft"))}">${escapeHtml(listing.status || "draft")}</b>
      </div>
      <div class="inventory-card-facts">
        <span>Price <b>${listing.price ? `$${formatNumber(listing.price)}` : "-"}</b></span>
        <span>KM <b>${formatNumber(listing.kilometers || 0)}</b></span>
        <span>Region <b>${escapeHtml(listing.region || "-")}</b></span>
        <span>Photos <b>${photos.length}</b></span>
      </div>
      <div class="inventory-actions">
        <button type="button" data-inventory-status="${escapeHtml(listing.id || "")}" data-status="published" ${canPublish ? "" : "disabled"}>Publish</button>
        <button class="secondary-action" type="button" data-inventory-status="${escapeHtml(listing.id || "")}" data-status="draft" ${canUnpublish ? "" : "disabled"}>Unpublish</button>
        <button class="secondary-action" type="button" data-inventory-status="${escapeHtml(listing.id || "")}" data-status="sold">Mark sold</button>
        <button class="secondary-action" type="button" data-inventory-status="${escapeHtml(listing.id || "")}" data-status="archived" ${canArchive ? "" : "disabled"}>Archive</button>
        <button class="danger-outline" type="button" data-remove-inventory="${escapeHtml(listing.id || "")}">Remove from inventory</button>
      </div>
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
            <span>Status</span>
            <select name="status">
              ${["draft", "review", "published", "sold", "archived"].map((status) =>
                `<option value="${status}" ${listing.status === status ? "selected" : ""}>${status}</option>`
              ).join("")}
            </select>
          </label>
          <label class="inventory-description">
            <span>Description</span>
            <textarea name="description">${escapeHtml(listing.description || "")}</textarea>
          </label>
          ${photoManager}
        </div>
        <button type="submit">Save listing details</button>
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
          message: lead.owner_review.reason || "Owner review required"
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
          message: "Lead changed since you last opened it"
        });
      } else if (!readTokens[id]) {
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
        message: lead.owner_review.reason || "Owner review required"
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
        message: "Lead changed since you last opened it"
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
  return [
    lead.updated_at || "",
    lead.last_activity_at || "",
    lead.status || "",
    lead.assigned_to || "",
    lead.priority || "",
    lead.next_follow_up_at || "",
    JSON.stringify(lead.owner_adjustment || {}),
    JSON.stringify(lead.owner_review || {}),
    JSON.stringify(lead.vehicle_signal || {}),
    JSON.stringify(lead.duplicate_warning || {}),
    lead.notes || ""
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
      <span>Vehicle cluster</span>
      <strong>${escapeHtml(context.cluster_label || "Same vehicle activity")}</strong>
      <small>${escapeHtml(pills.join(" | ") || "Related vehicle activity found.")}</small>
      ${context.primary_lead_id ? `<small>Primary CRM lead ${escapeHtml(context.primary_lead_title || context.primary_lead_id)}${context.primary_listing_id ? ` | warehouse ${escapeHtml(context.primary_listing_id)}` : ""}</small>` : ""}
    </section>
  `;
}

function mergeStateInline(lead) {
  const state = lead?.merge_state;
  if (!state?.kind) return "";
  if (state.kind === "merged") {
    return `
      <section class="owner-review-read duplicate-vehicle-reviewed">
        <span>Merged into primary CRM lead ${escapeHtml(state.primary_lead_id || "-")} ${state.at ? escapeHtml(formatDateTime(state.at)) : ""}</span>
      </section>
    `;
  }
  return `
    <section class="owner-review-read duplicate-vehicle-reviewed">
      <span>Linked to warehouse listing ${escapeHtml(state.listing_id || "-")} under CRM lead ${escapeHtml(state.primary_lead_id || "-")} ${state.at ? escapeHtml(formatDateTime(state.at)) : ""}</span>
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
  const count = Number(duplicate.count || 0);
  const currentId = String(lead?.id || "").trim();
  const mergeTargetId = String(lead?.vehicle_context?.primary_lead_id || "").trim();
  const safeMergeTargetId = mergeTargetId && mergeTargetId !== currentId ? mergeTargetId : "";
  const listingId = String(lead?.vehicle_context?.primary_listing_id || "").trim();
  const actionHint = safeMergeTargetId || listingId
    ? `${safeMergeTargetId ? `Primary CRM ${safeMergeTargetId}` : ""}${safeMergeTargetId && listingId ? " | " : ""}${listingId ? `Warehouse ${listingId}` : ""}`
    : "Open Vehicle clusters to review the related records.";
  return `
    <section class="owner-review-required duplicate-vehicle-warning">
      <div>
        <span>Duplicate vehicle warning</span>
        <strong>${escapeHtml(duplicate.message)}</strong>
        <small>${escapeHtml(count ? `${count} related CRM / Warehouse record${count === 1 ? "" : "s"} detected.` : "Related records detected.")}</small>
        <small>${escapeHtml(actionHint)}</small>
      </div>
      <div class="duplicate-review-actions">
        <button type="button" data-duplicate-review="keep_separate">Keep separate</button>
        <button type="button" data-duplicate-review="merge_existing" data-target-lead-id="${escapeHtml(safeMergeTargetId)}" ${safeMergeTargetId ? "" : "disabled"}>Merge into primary</button>
        <button type="button" data-duplicate-review="link_inventory" data-target-lead-id="${escapeHtml(safeMergeTargetId)}" data-listing-id="${escapeHtml(listingId)}" ${listingId ? "" : "disabled"}>Link warehouse</button>
        <a class="duplicate-review-link" href="/admin-vehicles.html" target="_blank" rel="noreferrer">Open vehicle clusters</a>
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
  if (adminLeadFilter !== "all") {
    setAdminLeadFilter("all");
    renderLeadWorkbench(adminLeadsCache);
  }
  const visibleId = resolveVisibleAdminLeadId(id);
  const card = leadsEl.querySelector(`.lead-card[data-id="${cssEscape(visibleId)}"]`);
  if (!card) return;
  setActiveAdminLead(visibleId);
  clearAdminVisibleAlertGroup(id);
  const lead = adminLeadsCache.find((item) => String(item.id || "") === visibleId) || adminLeadsCache.find((item) => String(item.id || "") === id);
  renderAdminLeadAlerts();
  if (!lead?.owner_review?.unread) card.classList.remove("lead-card-updated");
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
  leadsEl.innerHTML = renderLeadGroups(collapsed.visible);
  syncActiveAdminLeadCard();
  if (activeAdminDrawerLeadId) {
    if (adminLeadsCache.some((lead) => String(lead.id || "") === activeAdminDrawerLeadId)) {
      renderAdminDrawer(activeAdminDrawerLeadId);
      loadAdminDrawerActivity({ force: true }).catch(() => null);
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
  if (adminLeadFilter === "closed") filtered = leads.filter(isClosedLead);
  if (adminLeadFilter === "call-now") filtered = leads.filter(isAdminCallNowLead);
  if (adminLeadFilter === "waiting-reply") filtered = leads.filter(isAdminWaitingReplyLead);
  if (adminLeadFilter === "deal-desk") filtered = leads.filter(isAdminDealDeskLead);
  if (adminLeadFilter === "aging-critical") filtered = leads.filter(isAdminAgingCriticalLead);
  if (adminLeadFilter === "owner-unread") filtered = leads.filter((lead) => Boolean(lead.owner_review?.unread));
  if (adminLeadFilter === "duplicate-review") filtered = leads.filter((lead) => !isClosedLead(lead) && Boolean(lead.duplicate_warning?.message) && !lead.duplicate_warning?.reviewed);
  if (adminLeadFilter === "buyer") filtered = leads.filter((lead) => !isClosedLead(lead) && isBuyerLead(lead));
  if (adminLeadFilter === "seller") filtered = leads.filter((lead) => !isClosedLead(lead) && !isBuyerLead(lead));
  if (adminLeadFilter === "unassigned") filtered = leads.filter((lead) => !isClosedLead(lead) && !String(lead.assigned_to || "").trim());
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
  if (isClosedLead(lead)) return 4;
  const status = lead.status || "new";
  if (String(lead.priority || "").toLowerCase() === "urgent") return 0;
  if (isOverdue(lead.next_follow_up_at || "", status)) return 1;
  if (String(status).toLowerCase() === "new") return 2;
  return 3;
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
    <section class="admin-drawer-section">
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
  if (isAdminDealDeskLead(lead) && adminDealChecklistSummary(lead).pending > 0) return `Finish ${adminDealChecklistProgressLabel(lead)} before closing the handoff`;
  if (buyer && status === "won") return "Start delivery checklist, docs, and final customer handoff";
  if (!buyer && status === "in_inventory") return "Confirm warehouse intake, pricing, and publish plan";
  if (!buyer && status === "won") return "Confirm purchase paperwork and stock transfer";
  if (!String(lead?.assigned_to || "").trim()) return "Assign an owner and start first contact";
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
  else if (lead?.owner_review?.unread) chips.push("Owner review unread");
  else chips.push(adminLeadAgeLabel(lead));
  return `
    <section class="lead-communication-strip">
      <div class="lead-communication-chips">
        ${chips.slice(0, 4).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
      <strong>${escapeHtml(adminNextBestAction(lead))}</strong>
    </section>
  `;
}

function isAdminReadyForWarehouse(lead) {
  if (isBuyerLead(lead) || isClosedLead(lead)) return false;
  if (inventoryCache.some((item) => item.sourceLeadId && item.sourceLeadId === lead?.id)) return false;
  return ["inspection_booked", "offer_sent", "won"].includes(String(lead?.status || "").toLowerCase());
}

function renderAdminOverviewCard(filter, tone, label, value, hint) {
  return `
    <button class="admin-overview-card ${escapeHtml(tone)}" type="button" data-admin-set-filter="${escapeHtml(filter)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(hint)}</small>
    </button>
  `;
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
  const activeLeads = leads.filter((lead) => !isClosedLead(lead));
  const crmQueueCount = activeLeads.length;
  const callNowCount = activeLeads.filter(isAdminCallNowLead).length;
  const ownerUnreadCount = activeLeads.filter((lead) => Boolean(lead.owner_review?.unread)).length;
  const duplicateReviewCount = activeLeads.filter((lead) => Boolean(lead.duplicate_warning?.message) && !lead.duplicate_warning?.reviewed).length;
  const dealDeskCount = leads.filter(isAdminDealDeskLead).length;
  const dealDeskPendingCount = leads.filter((lead) => isAdminDealDeskLead(lead) && adminDealChecklistSummary(lead).pending > 0).length;
  const deliveryBookedCount = leads.filter((lead) => isAdminDealDeskLead(lead) && Boolean(adminDealChecklistSummary(lead).delivery_at)).length;
  const keyReadyCount = leads.filter((lead) => isAdminDealDeskLead(lead) && ["ready", "complete"].includes(String(adminDealChecklistSummary(lead).key_handoff_status || "").toLowerCase())).length;
  const inventoryActiveCount = inventoryCache.filter((item) => !["sold", "archived"].includes(String(item.status || "").toLowerCase())).length;
  const inventoryDraftCount = inventoryCache.filter((item) => ["draft", "review"].includes(String(item.status || "").toLowerCase())).length;
  const inventoryPublishedCount = inventoryCache.filter((item) => String(item.status || "").toLowerCase() === "published").length;
  const inventorySoldCount = inventoryCache.filter((item) => String(item.status || "").toLowerCase() === "sold").length;
  const clusterCount = new Set(
    leads
      .filter((lead) => (lead?.vehicle_context?.related_lead_count || 0) > 0 || (lead?.vehicle_context?.inventory_count || 0) > 0 || lead?.duplicate_warning?.message || lead?.vehicle_signal?.message)
      .map(adminVehicleClusterKey)
      .filter(Boolean)
  ).size;
  const clusterAlertCount = leads.filter((lead) => lead?.vehicle_signal?.message || (lead?.duplicate_warning?.message && !lead?.duplicate_warning?.reviewed)).length;

  adminControlBoardEl.innerHTML = `
    ${renderAdminControlCard({
      tone: "control-crm",
      kicker: "CRM",
      title: "Manager queue",
      total: crmQueueCount,
      caption: "Work live BUY and SELL opportunities, unread updates, and follow-ups from one lane.",
      chips: [`Call now ${callNowCount}`, `Owner unread ${ownerUnreadCount}`, `Duplicate review ${duplicateReviewCount}`],
      actions: [
        { label: "Open active CRM", filter: "active" },
        { label: "Open call now", filter: "call-now" },
        { label: "Open owner unread", filter: "owner-unread" }
      ]
    })}
    ${renderAdminControlCard({
      tone: "control-inventory",
      kicker: "Inventory",
      title: "Warehouse board",
      total: inventoryActiveCount,
      caption: "Move seller vehicles through draft, publish, sold, and archive without losing CRM context.",
      chips: [`Draft / review ${inventoryDraftCount}`, `Published ${inventoryPublishedCount}`, `Sold ${inventorySoldCount}`],
      actions: [
        { label: "Open active stock", inventoryFilter: "active" },
        { label: "Open draft / review", inventoryFilter: "draft" },
        { label: "Open sold stock", inventoryFilter: "sold" }
      ]
    })}
    ${renderAdminControlCard({
      tone: "control-dealdesk",
      kicker: "Deal Desk",
      title: "Handoff and delivery",
      total: dealDeskCount,
      caption: "Track won buyers, warehouse intake, checklist progress, delivery booking, and key handoff.",
      chips: [`Checklist open ${dealDeskPendingCount}`, `Delivery booked ${deliveryBookedCount}`, `Keys ready ${keyReadyCount}`],
      actions: [
        { label: "Open deal desk", filter: "deal-desk" },
        { label: "Open sold inventory", inventoryFilter: "sold" },
        { label: "Open ready for warehouse", filter: "seller" }
      ]
    })}
    ${renderAdminControlCard({
      tone: "control-clusters",
      kicker: "Vehicle Clusters",
      title: "Duplicate and shared vehicle watch",
      total: clusterCount,
      caption: "Review duplicate seller vehicles, same-vehicle buyer activity, and cross-lane vehicle signals.",
      chips: [`Vehicle alerts ${clusterAlertCount}`, `Needs duplicate review ${duplicateReviewCount}`, `Shared vehicle map ${clusterCount}`],
      actions: [
        { label: "Open duplicate review", filter: "duplicate-review" },
        { label: "Open owner watchlist", filter: "owner-unread" },
        { label: "Open vehicle clusters", url: "/admin-vehicles.html" }
      ]
    })}
  `;
}

function renderAdminOverview(leads) {
  if (!adminOverviewEl) return;
  const activeLeads = leads.filter((lead) => !isClosedLead(lead));
  const newCount = activeLeads.filter((lead) => String(lead.status || "").toLowerCase() === "new").length;
  const dueTodayCount = activeLeads.filter((lead) => isFollowUpDue(lead.next_follow_up_at, lead.status || "new")).length;
  const callNowCount = activeLeads.filter(isAdminCallNowLead).length;
  const staleCount = activeLeads.filter(isAdminStaleLead).length;
  const waitingReplyCount = activeLeads.filter(isAdminWaitingReplyLead).length;
  const agingCriticalCount = activeLeads.filter(isAdminAgingCriticalLead).length;
  const dealDeskCount = leads.filter(isAdminDealDeskLead).length;
  const assignmentCount = activeLeads.filter((lead) => !String(lead.assigned_to || "").trim()).length;
  const duplicateReviewCount = activeLeads.filter((lead) => Boolean(lead.duplicate_warning?.message) && !lead.duplicate_warning?.reviewed).length;
  const handoffCount = activeLeads.filter(isAdminReadyForWarehouse).length;
  const ownerUnreadCount = activeLeads.filter((lead) => Boolean(lead.owner_review?.unread)).length;
  const appointmentCount = activeLeads.filter(isAdminAppointmentLead).length;
  const closedCount = leads.length - activeLeads.length;
  const urgentCount = activeLeads.filter((lead) => String(lead.priority || "").toLowerCase() === "urgent").length;
  adminOverviewEl.innerHTML = `
    ${renderAdminOverviewCard("active", "overview-total", "Manager queue", activeLeads.length, "All active CRM work")}
    ${renderAdminOverviewCard("call-now", "overview-urgent", "Call now", callNowCount, "Hot leads needing immediate touch")}
    ${renderAdminOverviewCard("needs-follow-up", "overview-follow", "Due today", dueTodayCount, "Call, text, or close next step")}
    ${renderAdminOverviewCard("stale", "overview-unassigned", "No response", staleCount, "No touch in the last 48h")}
    ${renderAdminOverviewCard("waiting-reply", "overview-owner", "Waiting reply", waitingReplyCount, "Customer owes the next answer")}
    ${renderAdminOverviewCard("deal-desk", "overview-closed", "Deal desk", dealDeskCount, "Won buyers and intake handoffs")}
    ${renderAdminOverviewCard("aging-critical", "overview-urgent", "Aging 7d+", agingCriticalCount, "Older leads that need manager attention")}
    ${renderAdminOverviewCard("unassigned", "overview-unassigned", "Needs assignment", assignmentCount, "New leads waiting for owner")}
    ${renderAdminOverviewCard("duplicate-review", "overview-owner", "Duplicate vehicles", duplicateReviewCount, "SELL conflicts waiting for review")}
    ${renderAdminOverviewCard("seller", "overview-seller", "Ready for warehouse", handoffCount, "SELL leads ready to hand off")}
    ${renderAdminOverviewCard("owner-unread", "overview-owner", "Owner unread", ownerUnreadCount, "Important dealer updates")}
    ${renderAdminOverviewCard("appointments", "overview-follow", "Appointments", appointmentCount, "Booked meetings and inspections")}
    ${renderAdminOverviewCard("urgent", "overview-urgent", "Urgent", urgentCount, "Hot deals or escalation")}
    ${renderAdminOverviewCard("closed", "overview-closed", "Closed", closedCount, "Won, lost, or archived")}
    ${renderAdminOverviewCard("active", "overview-buyer", "New leads", newCount, "Fresh opportunities to route")}
  `;
  renderAdminControlBoard(leads);
  renderAdminToday(leads);
}

function renderAdminToday(leads) {
  if (!adminTodayListEl) return;
  const attention = buildAdminAttentionItems(leads);
  const attentionLimit = 4;
  const visibleAttention = adminAttentionExpanded ? attention : attention.slice(0, attentionLimit);
  const hiddenAttentionCount = Math.max(attention.length - visibleAttention.length, 0);
  const appointmentItems = leads
    .filter((lead) => isAdminAppointmentLead(lead))
    .sort(compareAdminLeadOrder)
    .slice(0, 4);
  const waitingReplyItems = leads
    .filter((lead) => isAdminWaitingReplyLead(lead))
    .sort(compareAdminLeadOrder)
    .slice(0, 4);
  const dealDeskItems = leads
    .filter((lead) => isAdminDealDeskLead(lead))
    .sort(compareAdminLeadOrder)
    .slice(0, 5);
  const agingCriticalItems = leads
    .filter((lead) => isAdminAgingCriticalLead(lead))
    .sort((a, b) => adminLeadAgeDays(b) - adminLeadAgeDays(a) || compareAdminLeadOrder(a, b))
    .slice(0, 4);
  const staleItems = leads
    .filter((lead) => isAdminStaleLead(lead))
    .sort(compareAdminLeadOrder)
    .slice(0, 4);
  const ownerUnreadItems = leads
    .filter((lead) => !isClosedLead(lead) && lead.owner_review?.unread)
    .sort(compareAdminLeadOrder)
    .slice(0, 4);
  const dueItems = leads
    .filter((lead) => !isClosedLead(lead) && isFollowUpDue(lead.next_follow_up_at, lead.status || "new"))
    .sort((a, b) => new Date(a.next_follow_up_at || a.created_at || 0).getTime() - new Date(b.next_follow_up_at || b.created_at || 0).getTime())
    .slice(0, 6);
  const duplicateItems = leads
    .filter((lead) => !isClosedLead(lead) && lead.duplicate_warning?.message && !lead.duplicate_warning?.reviewed)
    .sort(compareAdminLeadOrder)
    .slice(0, 4);
  const warehouseReadyItems = leads
    .filter((lead) => isAdminReadyForWarehouse(lead))
    .sort(compareAdminLeadOrder)
    .slice(0, 4);
  const draftCount = inventoryCache.filter((item) => ["draft", "review"].includes(String(item.status || "").toLowerCase())).length;
  const soldCount = inventoryCache.filter((item) => String(item.status || "").toLowerCase() === "sold").length;
  const attentionMarkup = attention.length
    ? visibleAttention.map((item) => `
        <button type="button" class="admin-today-item admin-today-${escapeHtml(item.tone)} manager-queue-item" data-admin-open-lead="${escapeHtml(item.id)}">
          <span>${escapeHtml(item.reason)}</span>
          <b>${escapeHtml(item.title)}</b>
          <small>${escapeHtml(item.meta)}</small>
        </button>
      `).join("")
    : `<div class="admin-today-empty">
        <b>No urgent lead work right now.</b>
        <span>Use CRM leads for the full pipeline or Inventory for warehouse work.</span>
      </div>`;
  const attentionFooter = hiddenAttentionCount > 0 ? `
      <button type="button" class="admin-today-more" data-admin-toggle-attention="show">
        Show ${hiddenAttentionCount} more item${hiddenAttentionCount === 1 ? "" : "s"}
      </button>
    ` : adminAttentionExpanded && attention.length > attentionLimit ? `
      <button type="button" class="admin-today-more" data-admin-toggle-attention="hide">
        Show less
      </button>
    ` : "";

  adminTodayListEl.innerHTML = `
    <div class="admin-today-grid">
      <section class="admin-attention-panel admin-manager-panel">
        <header>
          <span>Manager queue</span>
          <b>${attention.length}</b>
        </header>
        <p class="admin-panel-caption">Work the hot lane first: urgent, overdue, unassigned, and fresh opportunities.</p>
        <div class="admin-today-items">${attentionMarkup}</div>
        ${attentionFooter}
      </section>
      <section class="admin-due-panel admin-lane-panel">
        <header>
          <span>Today follow-up lane</span>
          <b>${dueItems.length}</b>
        </header>
        <div class="admin-today-actions admin-due-actions">
          <button type="button" data-admin-set-filter="needs-follow-up">
            <b>${dueItems.length}</b>
            <span>Open all due and overdue follow-ups</span>
          </button>
          ${dueItems.length ? `<div class="admin-due-list">${dueItems.map(renderAdminDueButton).join("")}</div>` : `
            <div class="admin-today-empty">
              <b>No due leads right now.</b>
              <span>Next follow-up dates will show here for the owner desk.</span>
            </div>
          `}
        </div>
      </section>
      <section class="admin-duplicate-panel admin-watch-panel">
        <header>
          <span>Deal desk</span>
          <b>${dealDeskItems.length + soldCount}</b>
        </header>
        <div class="admin-watch-grid">
          <button type="button" class="admin-watch-tile" data-admin-set-filter="deal-desk">
            <span>Won and handoff</span>
            <b>${dealDeskItems.length}</b>
            <small>Buyer delivery and seller intake work</small>
          </button>
          <button type="button" class="admin-watch-tile" data-open-inventory-filter="sold">
            <span>Sold inventory</span>
            <b>${soldCount}</b>
            <small>Closed stock to archive or review</small>
          </button>
        </div>
        <div class="admin-today-actions">
          <button type="button" data-admin-set-filter="deal-desk">
            <b>${dealDeskItems.length}</b>
            <span>Open deal desk queue</span>
          </button>
          <button type="button" data-open-inventory-filter="sold">
            <b>${soldCount}</b>
            <span>Open sold inventory</span>
          </button>
          ${dealDeskItems.length ? `<div class="admin-due-list">${dealDeskItems.map((lead) => renderAdminDueButton(lead, adminDealDeskLabel(lead))).join("")}</div>` : `
            <div class="admin-today-empty">
              <b>No delivery or intake handoffs waiting.</b>
              <span>Won buyers and seller warehouse intake leads will show here.</span>
            </div>
          `}
        </div>
      </section>
      <section class="admin-duplicate-panel admin-watch-panel">
        <header>
          <span>Manager watchlist</span>
          <b>${duplicateItems.length + staleItems.length + ownerUnreadItems.length + appointmentItems.length + waitingReplyItems.length + agingCriticalItems.length}</b>
        </header>
        <div class="admin-watch-grid">
          <button type="button" class="admin-watch-tile" data-admin-set-filter="duplicate-review">
            <span>Duplicate vehicles</span>
            <b>${duplicateItems.length}</b>
            <small>SELL conflicts to review</small>
          </button>
          <button type="button" class="admin-watch-tile" data-admin-set-filter="owner-unread">
            <span>Owner unread</span>
            <b>${ownerUnreadItems.length}</b>
            <small>Dealer updates waiting for read</small>
          </button>
          <button type="button" class="admin-watch-tile" data-admin-set-filter="stale">
            <span>No response</span>
            <b>${staleItems.length}</b>
            <small>Leads with no recent touch</small>
          </button>
          <button type="button" class="admin-watch-tile" data-admin-set-filter="appointments">
            <span>Appointments</span>
            <b>${appointmentItems.length}</b>
            <small>Booked buyer or seller meetings</small>
          </button>
          <button type="button" class="admin-watch-tile" data-admin-set-filter="waiting-reply">
            <span>Waiting reply</span>
            <b>${waitingReplyItems.length}</b>
            <small>Customer owes the next answer</small>
          </button>
          <button type="button" class="admin-watch-tile" data-admin-set-filter="aging-critical">
            <span>Aging 7d+</span>
            <b>${agingCriticalItems.length}</b>
            <small>Older leads drifting too long</small>
          </button>
        </div>
        <div class="admin-today-actions">
          <button type="button" data-admin-set-filter="duplicate-review">
            <b>${duplicateItems.length}</b>
            <span>Open duplicate vehicle queue</span>
          </button>
          <button type="button" data-admin-set-filter="appointments">
            <b>${appointmentItems.length}</b>
            <span>Open appointment queue</span>
          </button>
          <button type="button" data-admin-set-filter="waiting-reply">
            <b>${waitingReplyItems.length}</b>
            <span>Open waiting reply queue</span>
          </button>
          <button type="button" data-admin-set-filter="aging-critical">
            <b>${agingCriticalItems.length}</b>
            <span>Open aging queue</span>
          </button>
          ${(duplicateItems.length || staleItems.length || appointmentItems.length || waitingReplyItems.length || agingCriticalItems.length) ? `<div class="admin-due-list">${duplicateItems.map(renderAdminDuplicateButton).join("")}${staleItems.map((lead) => renderAdminDueButton(lead, "No response")).join("")}${appointmentItems.map((lead) => renderAdminDueButton(lead, "Appointment")).join("")}${waitingReplyItems.map((lead) => renderAdminDueButton(lead, "Waiting")).join("")}${agingCriticalItems.map((lead) => renderAdminDueButton(lead, adminLeadAgeLabel(lead))).join("")}</div>` : `
            <div class="admin-today-empty">
              <b>No manager watch items waiting.</b>
              <span>Duplicate VINs, unread reviews, and stale leads will show here.</span>
            </div>
          `}
        </div>
      </section>
      <section class="admin-warehouse-panel">
        <header>
          <span>Warehouse handoff</span>
          <b>${warehouseReadyItems.length + draftCount}</b>
        </header>
        <div class="admin-today-actions">
          <button type="button" data-admin-set-filter="seller">
            <b>${warehouseReadyItems.length}</b>
            <span>SELL leads ready for warehouse</span>
          </button>
          <button type="button" data-open-inventory-filter="draft">
            <b>${draftCount}</b>
            <span>Draft / review vehicles</span>
          </button>
          <button type="button" data-open-inventory-filter="sold">
            <b>${soldCount}</b>
            <span>Sold vehicles to close or archive</span>
          </button>
          ${warehouseReadyItems.length ? `<div class="admin-due-list">${warehouseReadyItems.map((lead) => renderAdminDueButton(lead, "Warehouse")).join("")}</div>` : ""}
        </div>
      </section>
    </div>
  `;
}

function renderAdminDueButton(lead, overrideType = "") {
  const input = lead.input || {};
  const valuation = lead.valuation || {};
  const buyer = isBuyerLead(lead);
  const title = cleanLeadTitle(valuation.title || [input.year, input.make, input.model, input.series, input.style].filter(Boolean).join(" "), buyer) || "Vehicle lead";
  const followUp = lead.next_follow_up_at ? formatDateTime(lead.next_follow_up_at) : "No next follow-up";
  return `
    <button type="button" class="admin-due-item" data-admin-open-lead="${escapeHtml(lead.id || "")}">
      <span class="admin-due-type">${escapeHtml(overrideType || (buyer ? "BUY" : "SELL"))}</span>
      <div>
        <b>${escapeHtml(title)}</b>
        <small>${escapeHtml(followUp)}</small>
      </div>
    </button>
  `;
}

function renderAdminDuplicateButton(lead) {
  const input = lead.input || {};
  const valuation = lead.valuation || {};
  const title = cleanLeadTitle(valuation.title || [input.year, input.make, input.model, input.series, input.style].filter(Boolean).join(" "), isBuyerLead(lead)) || "Vehicle lead";
  const duplicate = lead.duplicate_warning || {};
  return `
    <button type="button" class="admin-due-item admin-duplicate-item" data-admin-open-lead="${escapeHtml(lead.id || "")}">
      <span class="admin-due-type">SELL</span>
      <div>
        <b>${escapeHtml(title)}</b>
        <small>${escapeHtml(duplicate.message || "Duplicate vehicle review required")}</small>
      </div>
    </button>
  `;
}

function buildAdminAttentionItems(leads) {
  const seen = new Set();
  const items = [];
  const add = (lead, reason, tone) => {
    const id = String(lead.id || "");
    if (!id || seen.has(id)) return;
    seen.add(id);
    const buyer = isBuyerLead(lead);
    const input = lead.input || {};
    const valuation = lead.valuation || {};
    const title = cleanLeadTitle(valuation.title || [input.year, input.make, input.model, input.series, input.style].filter(Boolean).join(" "), buyer) || "Vehicle lead";
    const owner = lead.assigned_to ? `Owner ${shortEmail(lead.assigned_to)}` : "Unassigned";
    const next = lead.next_follow_up_at ? `Next ${formatDateTime(lead.next_follow_up_at)}` : "No next follow-up";
    items.push({
      id,
      reason,
      tone,
      title: `${buyer ? "BUY" : "SELL"} - ${title}`,
      meta: `${owner} | ${leadStatusLabel(lead.status || "new", buyer)} | ${adminNextBestAction(lead) || next}`
    });
  };

  leads.filter((lead) => !isClosedLead(lead) && String(lead.priority || "").toLowerCase() === "urgent").forEach((lead) => add(lead, "Urgent", "urgent"));
  leads.filter((lead) => isAdminCallNowLead(lead)).forEach((lead) => add(lead, "Call now", "urgent"));
  leads.filter((lead) => !isClosedLead(lead) && isFollowUpDue(lead.next_follow_up_at, lead.status || "new")).forEach((lead) => add(lead, "Follow-up due", "due"));
  leads.filter((lead) => !isClosedLead(lead) && !String(lead.assigned_to || "").trim()).forEach((lead) => add(lead, "Needs assignment", "assign"));
  leads.filter((lead) => isAdminAppointmentLead(lead)).forEach((lead) => add(lead, "Appointment", "assign"));
  leads.filter((lead) => isAdminWaitingReplyLead(lead)).forEach((lead) => add(lead, "Waiting reply", "assign"));
  leads.filter((lead) => isAdminDealDeskLead(lead)).forEach((lead) => add(lead, adminDealDeskLabel(lead), "assign"));
  leads.filter((lead) => isAdminAgingCriticalLead(lead)).forEach((lead) => add(lead, adminLeadAgeLabel(lead), "update"));
  leads.filter((lead) => !isClosedLead(lead) && String(lead.status || "").toLowerCase() === "new").forEach((lead) => add(lead, "New lead", "update"));
  leads.filter((lead) => isAdminStaleLead(lead)).forEach((lead) => add(lead, "No response", "update"));
  return items.slice(0, 8);
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
        <span>Customer</span>
        <span>Vehicle</span>
        <span>Next step</span>
        <span>Pipeline</span>
        <span>Quick actions</span>
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
  return adminClusterMembersForLead(lead).filter((item) => String(item.id || "").trim() !== id);
}

function adminVehicleClusterUrl(lead) {
  const leadId = String(lead?.id || "").trim();
  return leadId ? `/admin-vehicles.html?leadId=${encodeURIComponent(leadId)}` : "/admin-vehicles.html";
}

function renderCollapsedSellerMembersInline(lead) {
  if (isBuyerLead(lead)) return "";
  const hiddenMembers = adminCollapsedSellerMembers(lead);
  if (!hiddenMembers.length) return "";
  return `
    <section class="lead-collapsed-cluster">
      <div>
        <span>Collapsed SELL leads</span>
        <strong>${escapeHtml(`${hiddenMembers.length} more seller lead${hiddenMembers.length === 1 ? "" : "s"} folded into this vehicle card`)}</strong>
        <small>${escapeHtml(hiddenMembers.slice(0, 3).map((item) => item.input?.email || item.auth_email || item.id || "Seller lead").join(" | "))}${hiddenMembers.length > 3 ? ` +${hiddenMembers.length - 3} more` : ""}</small>
      </div>
      <button type="button" data-admin-open-url="${escapeHtml(adminVehicleClusterUrl(lead))}">Open vehicle cluster</button>
    </section>
  `;
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
    input.email,
    input.phone,
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

function renderLead(lead, index = 0) {
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
  const ownerReview = lead.owner_review || {};
  const vehicleContext = lead.vehicle_context || {};
  const mergeState = lead.merge_state || {};
  const purchase = input.buyerPlan || valuation.buyerPlan || {};
  const followUp = lead.next_follow_up_at || "";
  const lastActivity = lead.last_activity_at || "";
  const overdue = isOverdue(followUp, status);
  const statusClass = overdue ? "status-overdue" : `status-${cssToken(status)}`;
  const statusLabel = overdue ? "Overdue" : leadStatusLabel(status, buyer);
  const pendingAlert = Boolean(ownerReview.unread) || hasAdminVisibleAlert(String(lead.id || ""));
  const progressSteps = renderLeadProgress(buyer, status);
  const inventoryListing = inventoryCache.find((item) => item.sourceLeadId && item.sourceLeadId === lead.id);
  const actionButtons = leadStatusActions(buyer, status)
    .map((action) => `<button type="button" data-lead-status="${escapeHtml(action.status)}">${escapeHtml(action.label)}</button>`)
    .join("");
  const warehousePanel = buyer ? "" : inventoryListing ? `
      <section class="lead-warehouse-handoff lead-warehouse-linked">
        <div>
          <span>Warehouse</span>
          <strong>This seller vehicle is already in inventory.</strong>
          <small>Photos, listing details, price, public visibility, sold/archive actions are managed in Warehouse.</small>
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
  const valueRows = buyer ? `
          <span>Asking price</span><b>${retail ? formatNumber(retail) : input.askingPrice ? formatNumber(input.askingPrice) : "-"}</b>
          <span>Payment target</span><b>${purchase.monthlyPayment ? `${formatNumber(purchase.monthlyPayment)} / mo` : "-"}</b>` : `
          <span>AVG Wholesale</span><b>${wholesale ? formatNumber(wholesale) : "-"}</b>
          <span>AVG Retail</span><b>${retail ? formatNumber(retail) : "-"}</b>`;
  const ownerReviewBanner = ownerReview.unread ? `
      <section class="owner-review-required">
        <div>
          <span>Owner review required</span>
          <strong>${escapeHtml(ownerReview.reason || "Important staff update needs review.")}</strong>
          <small>${escapeHtml(ownerReview.at ? `${formatDateTime(ownerReview.at)}${ownerReview.by ? ` by ${ownerReview.by}` : ""}` : "Unread important update")}</small>
        </div>
        <button type="button" data-owner-read="${escapeHtml(lead.id || "")}">Mark reviewed</button>
      </section>` : ownerReview.read_at ? `
      <section class="owner-review-read">
        <span>Owner reviewed ${escapeHtml(formatDateTime(ownerReview.read_at))}${ownerReview.read_by ? ` by ${escapeHtml(ownerReview.read_by)}` : ""}</span>
      </section>` : "";
  const signalBanner = vehicleSignalInline(lead);
  const contextBanner = vehicleContextInline(lead);
  const collapsedMembersBanner = renderCollapsedSellerMembersInline(lead);
  const mergeBanner = mergeStateInline(lead);
  const duplicateBanner = duplicateWarningInline(lead);
  const queueSummary = overdue
    ? "Owner follow-up is overdue"
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
  const sharedMeta = renderSharedLeadMeta({
    customerEmail,
    phone: input.phone || "-",
    vin,
    assignedTo,
    priority,
    followUp,
    lastActivity,
    leadTypeLabel
  });
  return `
    <article class="lead-card lead-card-${leadType} lead-card-alt-${index % 2 === 0 ? "even" : "odd"} ${priority === "urgent" ? "lead-card-urgent" : ""} ${isClosedLead(lead) ? "lead-card-closed" : ""} ${overdue ? "lead-overdue" : ""} ${pendingAlert ? "lead-card-updated" : ""} ${mergeState.kind ? "lead-card-vehicle-child" : ""}" data-id="${escapeHtml(lead.id || "")}">
      <section class="lead-list-row">
        <div class="lead-list-col lead-list-col-main">
          <div class="lead-title-row">
            <b class="lead-type-pill lead-type-${leadType}">${escapeHtml(leadTypeLabel)}</b>
            <strong>${escapeHtml(title)}</strong>
          </div>
          <div class="lead-list-subline">
            <span>${escapeHtml(formatDateTime(lead.created_at))}</span>
            <span>${escapeHtml(priority)}</span>
            <span>${escapeHtml(statusLabel)}</span>
          </div>
        </div>
        <div class="lead-list-col">
          <strong>${escapeHtml(customerEmail)}</strong>
          <div class="lead-list-subline">
            <span>${escapeHtml(input.phone || "No phone")}</span>
            <span>${escapeHtml(assignedTo || "Unassigned")}</span>
          </div>
        </div>
        <div class="lead-list-col">
          <strong>${escapeHtml(vehicleContext.cluster_label || title)}</strong>
          <div class="lead-list-subline">
            <span>VIN ${escapeHtml(vin)}</span>
            <span>${escapeHtml(buyer ? (purchase.intent || input.purchaseIntent || "Buyer") : (wholesale ? `W ${formatNumber(wholesale)}` : "Seller"))}</span>
            <span>${escapeHtml(!buyer && retail ? `R ${formatNumber(retail)}` : buyer && (purchase.monthlyPayment || retail) ? `Budget ${purchase.monthlyPayment ? `${formatNumber(purchase.monthlyPayment)}/mo` : formatNumber(retail)}` : "-")}</span>
          </div>
        </div>
        <div class="lead-list-col">
          <strong>${escapeHtml(queueSummary)}</strong>
          <div class="lead-list-subline">
            <span>${escapeHtml(assignedTo ? `Owner ${assignedTo}` : "Assign owner")}</span>
            <span>${escapeHtml(overdue ? "Overdue" : followUp ? "Scheduled" : "Unscheduled")}</span>
          </div>
        </div>
        <div class="lead-list-col">
          <strong>${escapeHtml(progressSummary)}</strong>
          <div class="lead-list-subline">
            <span>${escapeHtml(responseSummary)}</span>
          </div>
        </div>
        <div class="lead-list-col lead-list-col-actions">
          <div class="lead-quick-strip" aria-label="Lead quick actions">
            <span class="lead-current-badge" aria-hidden="true">CURRENT</span>
            <button type="button" class="lead-quick-button" data-admin-open-workspace>Open</button>
            <button type="button" class="lead-quick-button" data-admin-focus-followup>Follow-up</button>
            <button type="button" class="lead-quick-button" data-admin-focus-note="call">Log call</button>
            <button type="button" class="lead-quick-button" data-admin-focus-task>Add task</button>
          </div>
          <div class="lead-summary-metrics">
            <b class="priority-pill priority-${escapeHtml(priority)}">${escapeHtml(priority)}</b>
            <b class="status-pill ${escapeHtml(statusClass)}">${escapeHtml(statusLabel)}</b>
          </div>
        </div>
      </section>
      ${renderAdminCommunicationStrip(lead)}
      ${pendingAlert ? `<button class="lead-inline-alert" type="button" data-admin-open-alert="${escapeHtml(lead.id || "")}">${ownerReview.unread ? "Owner review required" : "New update on this lead"}</button>` : ""}
      ${signalBanner}
      ${contextBanner}
      ${collapsedMembersBanner}
      ${mergeBanner}
      ${duplicateBanner}
      ${ownerReviewBanner}
      ${quickAssign}
      ${actionButtons ? `<div class="lead-action-row">${actionButtons}</div>` : ""}
      ${warehousePanel}
      <details class="lead-manage">
        <summary>Open lead workspace</summary>
        ${sharedMeta}
        ${progressSteps}
        ${vehicleContext.related_lead_count || vehicleContext.inventory_count ? `
          <section class="lead-detail-section lead-vehicle-ops-panel">
            <header>
              <h3>Vehicle operations</h3>
              <span>Same-vehicle activity across CRM and Warehouse</span>
            </header>
            <dl class="lead-grid">
              <span>Related leads</span><b>${escapeHtml(String(vehicleContext.related_lead_count || 0))}</b>
              <span>Active buyer leads</span><b>${escapeHtml(String(vehicleContext.active_buyer_count || 0))}</b>
              <span>Warehouse records</span><b>${escapeHtml(String(vehicleContext.inventory_count || 0))}</b>
              <span>Warehouse status</span><b>${escapeHtml(vehicleContext.primary_inventory_status ? String(vehicleContext.primary_inventory_status).replaceAll("_", " ") : "Not in warehouse")}</b>
              <span>Offer activity</span><b>${escapeHtml(vehicleContext.has_active_offer ? "Active" : "None")}</b>
              <span>Vehicle availability</span><b>${escapeHtml(vehicleContext.sold_elsewhere ? "Sold" : vehicleContext.off_market ? "Off market" : "Available / unknown")}</b>
              <span>Primary CRM lead</span><b>${escapeHtml(vehicleContext.primary_lead_title || vehicleContext.primary_lead_id || "-")}</b>
            </dl>
            ${collapsedMembersBanner}
          </section>` : ""}
        <section class="lead-detail-section lead-detail-summary">
          <header>
            <h3>Customer and vehicle summary</h3>
            <span>${escapeHtml(leadTypeLabel)}</span>
          </header>
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
        </section>
        <div class="lead-workspace-grid">
        <section class="lead-detail-section lead-owner-action-panel">
          <header>
            <h3>Next action</h3>
            <span>Owner decision, assignment, priority, and follow-up</span>
          </header>
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
        </section>
        <section class="lead-detail-section lead-activity-panel">
          <div class="lead-activity-head">
            <h3>Activity timeline</h3>
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
        </div>
      </details>
      <details class="lead-raw">
        <summary>Raw valuation summary</summary>
        <pre>${escapeHtml(JSON.stringify(valuation, null, 2))}</pre>
      </details>
    </article>
  `;
}

function renderSharedLeadMeta({
  customerEmail,
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
      <div><dt>Phone</dt><dd>${escapeHtml(phone || "-")}</dd></div>
      <div><dt>VIN</dt><dd>${escapeHtml(vin || "-")}</dd></div>
      <div><dt>Lead type</dt><dd>${escapeHtml(leadTypeLabel || "-")}</dd></div>
      <div><dt>Owner</dt><dd>${escapeHtml(assignedTo || "Unassigned")}</dd></div>
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
    document.body.classList.remove("admin-drawer-open");
    activeAdminDrawerLeadId = "";
    adminDrawerActivityLoaded = false;
    return;
  }

  const input = lead.input || {};
  const valuation = lead.valuation || {};
  const buyer = isBuyerLead(lead);
  const title = cleanLeadTitle(valuation.title || [input.year, input.make, input.model, input.series, input.style].filter(Boolean).join(" "), buyer) || "Vehicle lead";
  const customerEmail = input.email || lead.auth_user?.email || lead.auth_email || "-";
  const vin = input.vin || valuation.vin || "-";
  const status = lead.status || "new";
  const priority = lead.priority || "normal";
  const assignedTo = lead.assigned_to || "";
  const followUp = lead.next_follow_up_at || "";
  const lastActivity = lead.last_activity_at || "";
  const overdue = isOverdue(followUp, status);
  const ownerReview = lead.owner_review || {};
  const vehicleContext = lead.vehicle_context || {};
  const activityStatusButtons = leadStatusActions(buyer, status)
    .map((action) => `<button type="button" data-drawer-status="${escapeHtml(action.status)}">${escapeHtml(action.label)}</button>`)
    .join("");

  adminLeadDrawer.hidden = false;
  adminLeadDrawer.classList.add("open");
  document.body.classList.add("admin-drawer-open");
  activeAdminDrawerLeadId = id;
  adminLeadDrawerContent.innerHTML = `
    <section class="admin-drawer-shell" data-drawer-lead-id="${escapeHtml(id)}">
      <header class="admin-drawer-head">
        <div>
          <span>Lead workspace</span>
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(customerEmail)} | VIN ${escapeHtml(vin)}</small>
        </div>
        <div class="admin-drawer-head-actions">
          <button type="button" data-drawer-open-card>Open full</button>
          <button type="button" data-drawer-close>Close</button>
        </div>
      </header>
      <section class="admin-drawer-summary">
        <div class="admin-drawer-stat">
          <span>Pipeline</span>
          <strong>${escapeHtml(leadStatusLabel(status, buyer))}</strong>
          <small>${escapeHtml(overdue ? "Overdue follow-up" : followUp ? formatDateTime(followUp) : "No follow-up scheduled")}</small>
        </div>
        <div class="admin-drawer-stat">
          <span>Owner</span>
          <strong>${escapeHtml(assignedTo || "Unassigned")}</strong>
          <small>${escapeHtml(priority)} priority</small>
        </div>
        <div class="admin-drawer-stat">
          <span>Vehicle</span>
          <strong>${escapeHtml(vehicleContext.cluster_label || title)}</strong>
          <small>${escapeHtml(vehicleContext.primary_inventory_status ? `Warehouse ${String(vehicleContext.primary_inventory_status).replaceAll("_", " ")}` : "CRM only")}</small>
        </div>
      </section>
      ${renderAdminCommunicationStrip(lead)}
      ${ownerReview.unread ? `
        <section class="owner-review-required admin-drawer-owner-review">
          <div>
            <span>Owner review required</span>
            <strong>${escapeHtml(ownerReview.reason || "Important staff update needs review.")}</strong>
            <small>${escapeHtml(ownerReview.at ? formatDateTime(ownerReview.at) : "Unread update")}</small>
          </div>
          <button type="button" data-owner-read="${escapeHtml(id)}">Mark reviewed</button>
        </section>
      ` : ""}
      ${vehicleSignalInline(lead)}
      ${vehicleContextInline(lead)}
      ${duplicateWarningInline(lead)}
      <section class="admin-drawer-section">
        <header>
          <h3>Pipeline actions</h3>
          <span>Fast status updates from the manager desk</span>
        </header>
        <div class="lead-action-row admin-drawer-actions">
          ${activityStatusButtons || `<span class="admin-drawer-empty">No quick status actions</span>`}
        </div>
      </section>
      ${renderAdminDealChecklistSection(lead)}
      <section class="admin-drawer-section">
        <header>
          <h3>Communication hub</h3>
          <span>Call, text, email, notes, and tasks in one lane</span>
        </header>
        <div class="admin-drawer-comm-shortcuts">
          <button type="button" data-drawer-note-type="call">Call</button>
          <button type="button" data-drawer-note-type="sms">Text</button>
          <button type="button" data-drawer-focus-email>Email</button>
          <button type="button" data-drawer-note-type="internal">Note</button>
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
          <textarea name="note" placeholder="Record the latest call, text, email, or manager instruction..."></textarea>
          <button type="submit">Save note</button>
        </form>
        <form class="lead-task-form admin-drawer-task-form">
          <input name="title" placeholder="Next task, e.g. call customer back" />
          <input name="assignedTo" type="email" value="${escapeHtml(assignedTo)}" placeholder="staff@example.com" />
          <input name="dueAt" type="datetime-local" />
          <button type="submit">Add task</button>
        </form>
        <form class="lead-email-form admin-drawer-email-form">
          <input name="sentTo" type="email" value="${escapeHtml(customerEmail)}" placeholder="customer@example.com" />
          <input name="subject" placeholder="Email subject" />
          <textarea name="body" placeholder="Log the outbound email summary or draft text..."></textarea>
          <button type="submit">Log email</button>
        </form>
      </section>
      <section class="admin-drawer-section">
        <header>
          <h3>Activity timeline</h3>
          <button type="button" data-drawer-load-activity>Refresh</button>
        </header>
        <div class="lead-activity-list admin-drawer-activity-list">Activity not loaded yet.</div>
      </section>
    </section>
  `;
}

function closeAdminDrawer() {
  if (!adminLeadDrawer || !adminLeadDrawerContent) return;
  adminLeadDrawer.classList.remove("open");
  adminLeadDrawer.hidden = true;
  adminLeadDrawerContent.innerHTML = "";
  document.body.classList.remove("admin-drawer-open");
  activeAdminDrawerLeadId = "";
  adminDrawerActivityLoaded = false;
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
  list.innerHTML = renderActivity(data, { highlightLatest: Boolean(options.highlightLatest) });
}

function setActiveAdminLead(id) {
  activeAdminLeadId = String(id || "").trim();
  syncActiveAdminLeadCard();
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
        { value: "deleted", label: "Deleted" }
      ]
    : [
        { value: "new", label: "New seller lead" },
        { value: "assigned", label: "Assigned" },
        { value: "contacted", label: "Contacted" },
        { value: "waiting_for_customer", label: "Waiting for seller" },
        { value: "inspection_booked", label: "Inspection booked" },
        { value: "offer_sent", label: "Offer sent" },
        { value: "in_inventory", label: "In inventory" },
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
        ["in_inventory", "In inventory"],
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
        ["in_inventory", "Inventory"],
        ["won", "Purchased"]
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
  const uploadPhotosButton = event.target.closest("[data-upload-inventory-photos]");
  if (uploadPhotosButton) {
    await uploadInventoryPhotos(uploadPhotosButton);
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
  inventoryStatusEl.textContent = data.ok ? "Inventory listing removed. The seller lead was restored to the CRM Active queue." : formatApiError(data, "Unable to remove inventory listing.");
  if (data.ok) {
    await Promise.all([loadInventory(), loadLeads({ suppressAlerts: true, forceOpenActivity: true })]);
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

function inventoryListingPayloadFromForm(form) {
  const data = new FormData(form);
  const payload = {
    sourceLeadId: String(data.get("sourceLeadId") || form.dataset.sourceLeadId || "").trim(),
    title: String(data.get("title") || "").trim(),
    askingPrice: String(data.get("askingPrice") || "").trim(),
    monthlyPaymentEstimate: String(data.get("monthlyPaymentEstimate") || "").trim(),
    status: String(data.get("status") || "draft").trim(),
    description: String(data.get("description") || "").trim()
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
  const clickedCard = event.target.closest(".lead-card");
  if (clickedCard?.dataset?.id) setActiveAdminLead(clickedCard.dataset.id);
  const row = event.target.closest(".lead-list-row");
  if (row && !event.target.closest("button, a, input, select, textarea, summary")) {
    await openAdminLeadWorkspace(row.closest(".lead-card"), { forceActivity: false });
    return;
  }
  const alertButton = event.target.closest("[data-admin-open-alert]");
  if (alertButton) {
    await openAdminLeadFromAlert(alertButton.dataset.adminOpenAlert || "");
    return;
  }

  const openUrlButton = event.target.closest("[data-admin-open-url]");
  if (openUrlButton) {
    window.location.href = openUrlButton.dataset.adminOpenUrl || "/admin-vehicles.html";
    return;
  }

  const quickAssignButton = event.target.closest("[data-quick-assign]");
  if (quickAssignButton) {
    await quickAssignLead(quickAssignButton);
    return;
  }

  const quickInventoryButton = event.target.closest("[data-quick-inventory]");
  if (quickInventoryButton) {
    await quickAddDraftInventory(quickInventoryButton);
    return;
  }

  const openWorkspaceButton = event.target.closest("[data-admin-open-workspace]");
  if (openWorkspaceButton) {
    await openAdminLeadWorkspace(openWorkspaceButton.closest(".lead-card"), { forceActivity: true });
    return;
  }

  const focusFollowUpButton = event.target.closest("[data-admin-focus-followup]");
  if (focusFollowUpButton) {
    await openAdminLeadWorkspace(focusFollowUpButton.closest(".lead-card"), { forceActivity: true, focus: "followup" });
    return;
  }

  const focusNoteButton = event.target.closest("[data-admin-focus-note]");
  if (focusNoteButton) {
    await openAdminLeadWorkspace(focusNoteButton.closest(".lead-card"), {
      forceActivity: true,
      focus: "note",
      noteType: focusNoteButton.dataset.adminFocusNote || "internal"
    });
    return;
  }

  const focusTaskButton = event.target.closest("[data-admin-focus-task]");
  if (focusTaskButton) {
    await openAdminLeadWorkspace(focusTaskButton.closest(".lead-card"), { forceActivity: true, focus: "task" });
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

  const ownerReadButton = event.target.closest("[data-owner-read]");
  if (ownerReadButton) {
    await markOwnerReviewed(ownerReadButton);
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

adminLeadDrawer?.addEventListener("click", async (event) => {
  const closeButton = event.target.closest("[data-drawer-close]");
  if (closeButton) {
    closeAdminDrawer();
    return;
  }

  const openCardButton = event.target.closest("[data-drawer-open-card]");
  if (openCardButton) {
    await openFullLeadFromDrawer();
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
    if (data.ok) await loadLeads({ suppressAlerts: true, forceOpenActivity: true });
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeAdminDrawerLeadId) closeAdminDrawer();
});

adminLeadDrawer?.addEventListener("submit", async (event) => {
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
      noteForm.reset();
      adminDrawerActivityLoaded = false;
      await Promise.all([
        loadAdminDrawerActivity({ force: true, highlightLatest: true }),
        loadLeads({ suppressAlerts: true, forceOpenActivity: true })
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
        loadLeads({ suppressAlerts: true, forceOpenActivity: true })
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
        loadLeads({ suppressAlerts: true, forceOpenActivity: true })
      ]);
    }
  }
});

adminLeadDrawer?.addEventListener("change", async (event) => {
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

async function markOwnerReviewed(button) {
  const card = button.closest(".lead-card");
  const leadId = button.dataset.ownerRead || card?.dataset?.id || "";
  if (!leadId) return;
  button.disabled = true;
  statusEl.textContent = "Marking owner update as reviewed...";
  try {
    const response = await fetch("/api/leads", {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "owner_read",
        id: leadId
      })
    });
    const data = await response.json();
    if (!data.ok) throw new Error(formatApiError(data, "Unable to mark reviewed."));
    adminLeadAlertMap.delete(leadId);
    statusEl.textContent = "Owner review marked read.";
    await loadLeads({ suppressAlerts: true, forceOpenActivity: true });
  } catch (error) {
    statusEl.textContent = error.message || "Unable to mark reviewed.";
    button.disabled = false;
  }
}

async function openAdminLeadWorkspace(card, options = {}) {
  if (!card) return;
  if (card.dataset.id) {
    renderAdminDrawer(card.dataset.id);
    adminDrawerActivityLoaded = false;
    await loadAdminDrawerActivity({ force: true, highlightLatest: true });
  }
  const details = card.querySelector(".lead-manage");
  if (details && !details.open) details.open = true;
  await loadLeadActivity(card, { force: Boolean(options.forceActivity) });

  if (options.focus === "followup") {
    const input = card.querySelector('.owner-review input[name="nextFollowUpAt"]');
    input?.focus();
    return;
  }

  if (options.focus === "task") {
    const taskInput = card.querySelector('.lead-task-form input[name="title"]');
    taskInput?.focus();
    return;
  }

  if (options.focus === "note") {
    const noteType = card.querySelector('.lead-note-form select[name="noteType"]');
    const noteField = card.querySelector('.lead-note-form textarea[name="note"]');
    if (noteType && options.noteType) noteType.value = options.noteType;
    noteField?.focus();
  }
}

async function openFullLeadFromDrawer() {
  if (!activeAdminDrawerLeadId) return;
  const target = leadsEl.querySelector(`.lead-card[data-id="${CSS.escape(activeAdminDrawerLeadId)}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  setActiveAdminLead(activeAdminDrawerLeadId);
  await openAdminLeadWorkspace(target, { forceActivity: true });
}

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
  const details = event.target.closest(".lead-manage");
  if (!details || !details.open) return;

  const card = details.closest(".lead-card");
  if (!card) return;
  if (card.dataset.id) setActiveAdminLead(card.dataset.id);
  if (card.dataset.id && hasAdminVisibleAlert(card.dataset.id)) {
    clearAdminVisibleAlertGroup(card.dataset.id);
    renderAdminLeadAlerts();
    card.classList.remove("lead-card-updated");
  }
  if (card.dataset.activityLoaded === "true") return;
  await loadLeadActivity(card, { force: true });
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

  const notes = (data.notes || []).filter((note) => note.note_type !== "owner_read").map((note) => `
    <article class="activity-item ${latestKey === `note:${note.id}` ? "activity-highlight" : ""}">
      <div>
        <strong>${escapeHtml(activityNoteLabel(note.note_type))} by ${escapeHtml(note.author_email || "-")}</strong>
        <span>${escapeHtml(formatDateTime(note.created_at))}</span>
        <p>${linkifyNote(formatActivityNoteText(note.note || ""))}</p>
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

function activityNoteLabel(type) {
  const value = String(type || "note").trim().toLowerCase();
  const labels = {
    owner_review: "owner review request",
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
    intake_photos_complete: "Intake photos complete",
    keys_collected: "Keys collected",
    pricing_approved: "Pricing approved",
    publish_review_complete: "Publish review complete"
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
