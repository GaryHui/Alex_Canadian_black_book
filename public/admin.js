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
const adminOverviewEl = document.querySelector("#admin-overview");
const adminLeadAlertsEl = document.querySelector("#admin-lead-alerts");
const adminTodayListEl = document.querySelector("#admin-today-list");
const adminLeadFilterButtons = [...document.querySelectorAll("[data-admin-lead-filter]")];
const adminLeadSearchInput = document.querySelector("#admin-lead-search");
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
let inventoryCache = [];
let inventoryFilter = "active";
let adminLeadTokenMap = new Map();
let adminLeadAlertMap = new Map();
let adminLeadSnapshotReady = false;
let dealerStaffEmails = [];
let activeAdminLeadId = "";

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
adminTodayListEl?.addEventListener("click", async (event) => {
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
  if (adminLeadsCache.length) renderAdminToday(adminLeadsCache);
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
  const card = leadsEl.querySelector(`.lead-card[data-id="${cssEscape(id)}"]`);
  if (!card) return;
  setActiveAdminLead(id);
  const lead = adminLeadsCache.find((item) => String(item.id || "") === id);
  if (!lead?.owner_review?.unread) {
    markAdminLeadTokenRead(id);
    adminLeadAlertMap.delete(id);
  }
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
  const buyerCount = leads.filter(isBuyerLead).length;
  const sellerCount = leads.length - buyerCount;
  const activeCount = leads.filter((lead) => !isClosedLead(lead)).length;
  const closedCount = leads.length - activeCount;
  const searchLabel = adminLeadSearch.trim() ? ` Search: "${adminLeadSearch.trim()}".` : "";
  statusEl.textContent = `${filtered.length} shown. ${activeCount} active / ${closedCount} closed. ${buyerCount} BUY / ${sellerCount} SELL.${searchLabel}`;
  leadsEl.innerHTML = renderLeadGroups(filtered);
  syncActiveAdminLeadCard();
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
  if (adminLeadFilter === "owner-unread") filtered = leads.filter((lead) => Boolean(lead.owner_review?.unread));
  if (adminLeadFilter === "buyer") filtered = leads.filter((lead) => !isClosedLead(lead) && isBuyerLead(lead));
  if (adminLeadFilter === "seller") filtered = leads.filter((lead) => !isClosedLead(lead) && !isBuyerLead(lead));
  if (adminLeadFilter === "unassigned") filtered = leads.filter((lead) => !isClosedLead(lead) && !String(lead.assigned_to || "").trim());
  if (adminLeadFilter === "urgent") filtered = leads.filter((lead) => !isClosedLead(lead) && String(lead.priority || "").toLowerCase() === "urgent");
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

function renderAdminOverview(leads) {
  if (!adminOverviewEl) return;
  const buyerCount = leads.filter(isBuyerLead).length;
  const sellerCount = leads.length - buyerCount;
  const activeCount = leads.filter((lead) => !isClosedLead(lead)).length;
  const closedCount = leads.length - activeCount;
  const ownerUnreadCount = leads.filter((lead) => Boolean(lead.owner_review?.unread)).length;
  const unassignedCount = leads.filter((lead) => !isClosedLead(lead) && !String(lead.assigned_to || "").trim()).length;
  const followUpCount = leads.filter((lead) => !isClosedLead(lead) && isFollowUpDue(lead.next_follow_up_at, lead.status || "new")).length;
  const urgentCount = leads.filter((lead) => !isClosedLead(lead) && String(lead.priority || "").toLowerCase() === "urgent").length;
  adminOverviewEl.innerHTML = `
    <button class="admin-overview-card overview-total" type="button" data-admin-set-filter="active">
      <span>Active leads</span>
      <strong>${activeCount}</strong>
      <small>${buyerCount} BUY / ${sellerCount} SELL</small>
    </button>
    <button class="admin-overview-card overview-owner" type="button" data-admin-set-filter="owner-unread">
      <span>Owner unread</span>
      <strong>${ownerUnreadCount}</strong>
      <small>Needs review</small>
    </button>
    <button class="admin-overview-card overview-follow" type="button" data-admin-set-filter="needs-follow-up">
      <span>Needs follow-up</span>
      <strong>${followUpCount}</strong>
      <small>Due or overdue</small>
    </button>
    <button class="admin-overview-card overview-unassigned" type="button" data-admin-set-filter="unassigned">
      <span>Unassigned</span>
      <strong>${unassignedCount}</strong>
      <small>Needs owner</small>
    </button>
    <button class="admin-overview-card overview-urgent" type="button" data-admin-set-filter="urgent">
      <span>Urgent</span>
      <strong>${urgentCount}</strong>
      <small>High attention</small>
    </button>
    <button class="admin-overview-card overview-closed" type="button" data-admin-set-filter="closed">
      <span>Closed</span>
      <strong>${closedCount}</strong>
      <small>Won, lost, or archived</small>
    </button>
  `;
  renderAdminToday(leads);
}

function renderAdminToday(leads) {
  if (!adminTodayListEl) return;
  const attention = buildAdminAttentionItems(leads);
  const dueItems = leads
    .filter((lead) => !isClosedLead(lead) && isFollowUpDue(lead.next_follow_up_at, lead.status || "new"))
    .sort((a, b) => new Date(a.next_follow_up_at || a.created_at || 0).getTime() - new Date(b.next_follow_up_at || b.created_at || 0).getTime())
    .slice(0, 6);
  const draftCount = inventoryCache.filter((item) => ["draft", "review"].includes(String(item.status || "").toLowerCase())).length;
  const soldCount = inventoryCache.filter((item) => String(item.status || "").toLowerCase() === "sold").length;
  const attentionMarkup = attention.length
    ? attention.map((item) => `
        <button type="button" class="admin-today-item admin-today-${escapeHtml(item.tone)}" data-admin-open-lead="${escapeHtml(item.id)}">
          <span>${escapeHtml(item.reason)}</span>
          <b>${escapeHtml(item.title)}</b>
          <small>${escapeHtml(item.meta)}</small>
        </button>
      `).join("")
    : `<div class="admin-today-empty">
        <b>No urgent lead work right now.</b>
        <span>Use CRM leads for the full pipeline or Inventory for warehouse work.</span>
      </div>`;

  adminTodayListEl.innerHTML = `
    <div class="admin-today-grid">
      <section>
        <header>
          <span>Lead attention queue</span>
          <b>${attention.length}</b>
        </header>
        <div class="admin-today-items">${attentionMarkup}</div>
      </section>
      <section class="admin-due-panel">
        <header>
          <span>DUE</span>
          <b>${dueItems.length}</b>
        </header>
        <div class="admin-today-actions admin-due-actions">
          <button type="button" data-admin-set-filter="needs-follow-up">
            <b>${dueItems.length}</b>
            <span>Open all due follow-ups</span>
          </button>
          ${dueItems.length ? dueItems.map(renderAdminDueButton).join("") : `
            <div class="admin-today-empty">
              <b>No due leads right now.</b>
              <span>Next follow-up dates will show here for the owner desk.</span>
            </div>
          `}
        </div>
      </section>
      <section>
        <header>
          <span>Warehouse decisions</span>
          <b>${draftCount + soldCount}</b>
        </header>
        <div class="admin-today-actions">
          <button type="button" data-open-inventory-filter="draft">
            <b>${draftCount}</b>
            <span>Draft / review vehicles</span>
          </button>
          <button type="button" data-open-inventory-filter="sold">
            <b>${soldCount}</b>
            <span>Sold vehicles to close or archive</span>
          </button>
        </div>
      </section>
    </div>
  `;
}

function renderAdminDueButton(lead) {
  const input = lead.input || {};
  const valuation = lead.valuation || {};
  const buyer = isBuyerLead(lead);
  const title = cleanLeadTitle(valuation.title || [input.year, input.make, input.model, input.series, input.style].filter(Boolean).join(" "), buyer) || "Vehicle lead";
  const followUp = lead.next_follow_up_at ? formatDateTime(lead.next_follow_up_at) : "No next follow-up";
  return `
    <button type="button" class="admin-today-item admin-today-due" data-admin-open-lead="${escapeHtml(lead.id || "")}">
      <b>${escapeHtml(`${buyer ? "BUY" : "SELL"} - ${title}`)}</b>
      <span>${escapeHtml(followUp)}</span>
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
      meta: `${owner} | ${leadStatusLabel(lead.status || "new", buyer)} | ${next}`
    });
  };

  leads.filter((lead) => !isClosedLead(lead) && isFollowUpDue(lead.next_follow_up_at, lead.status || "new")).forEach((lead) => add(lead, "Follow-up due", "due"));
  leads.filter((lead) => !isClosedLead(lead) && !String(lead.assigned_to || "").trim()).forEach((lead) => add(lead, "Needs assignment", "assign"));
  leads.filter((lead) => !isClosedLead(lead) && String(lead.priority || "").toLowerCase() === "urgent").forEach((lead) => add(lead, "Urgent", "urgent"));
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

function searchableLeadText(lead) {
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  const ownerReview = lead?.owner_review || {};
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
    valuation.source
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
  const purchase = input.buyerPlan || valuation.buyerPlan || {};
  const followUp = lead.next_follow_up_at || "";
  const lastActivity = lead.last_activity_at || "";
  const overdue = isOverdue(followUp, status);
  const statusClass = overdue ? "status-overdue" : `status-${cssToken(status)}`;
  const statusLabel = overdue ? "Overdue" : leadStatusLabel(status, buyer);
  const pendingAlert = Boolean(ownerReview.unread) || adminLeadAlertMap.has(String(lead.id || ""));
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
    <article class="lead-card lead-card-${leadType} lead-card-alt-${index % 2 === 0 ? "even" : "odd"} ${isClosedLead(lead) ? "lead-card-closed" : ""} ${overdue ? "lead-overdue" : ""} ${pendingAlert ? "lead-card-updated" : ""}" data-id="${escapeHtml(lead.id || "")}">
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
      ${pendingAlert ? `<button class="lead-inline-alert" type="button" data-admin-open-alert="${escapeHtml(lead.id || "")}">${ownerReview.unread ? "Owner review required" : "New update on this lead"}</button>` : ""}
      ${ownerReviewBanner}
      ${sharedMeta}
      ${progressSteps}
      ${quickAssign}
      ${actionButtons ? `<div class="lead-action-row">${actionButtons}</div>` : ""}
      ${warehousePanel}
      <details class="lead-manage">
        <summary>Open lead workspace</summary>
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

function setActiveAdminLead(id) {
  activeAdminLeadId = String(id || "").trim();
  syncActiveAdminLeadCard();
}

function syncActiveAdminLeadCard() {
  const cards = [...leadsEl.querySelectorAll(".lead-card")];
  cards.forEach((card) => {
    card.classList.toggle("lead-card-current", Boolean(activeAdminLeadId) && card.dataset.id === activeAdminLeadId);
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
  if (card.dataset.id && adminLeadAlertMap.has(card.dataset.id)) {
    const lead = adminLeadsCache.find((item) => String(item.id || "") === String(card.dataset.id));
    if (!lead?.owner_review?.unread) markAdminLeadTokenRead(card.dataset.id);
    adminLeadAlertMap.delete(card.dataset.id);
    renderAdminLeadAlerts();
    card.classList.remove("lead-card-updated");
  }
  if (card.dataset.activityLoaded === "true") return;
  await loadLeadActivity(card, { force: true });
}, true);

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

function activityNoteLabel(type) {
  const value = String(type || "note").trim().toLowerCase();
  const labels = {
    owner_review: "owner review request",
    correction: "correction request",
    internal: "internal note",
    inspection: "inspection note",
    offer: "offer note"
  };
  return labels[value] || value || "note";
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
