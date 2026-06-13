const statusEl = document.querySelector("#admin-status");
const leadsEl = document.querySelector("#admin-leads");
const usersStatusEl = document.querySelector("#users-status");
const usersEl = document.querySelector("#admin-users");
const dealersStatusEl = document.querySelector("#dealers-status");
const dealersEl = document.querySelector("#admin-dealers");
const inventoryStatusEl = document.querySelector("#inventory-status");
const inventoryEl = document.querySelector("#admin-inventory");
const dealerStaffForm = document.querySelector("#dealer-staff-form");
const reloadDealersButton = document.querySelector("#reload-dealers");
const reloadUsersButton = document.querySelector("#reload-users");
const reloadLeadsButton = document.querySelector("#reload-leads");
const reloadInventoryButton = document.querySelector("#reload-inventory");
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

reloadUsersButton.addEventListener("click", loadUsers);
reloadLeadsButton.addEventListener("click", () => loadLeads({ forceOpenActivity: true }));
reloadDealersButton.addEventListener("click", loadDealers);
reloadInventoryButton?.addEventListener("click", loadInventory);
clearLeadsButton?.addEventListener("click", clearAllLeads);
dealerStaffForm.addEventListener("submit", addDealer);
adminLoginButton.addEventListener("click", signInAdmin);
adminLogoutButton.addEventListener("click", signOutAdmin);

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
    leadsEl.innerHTML = "";
    usersEl.innerHTML = "";
    dealersEl.innerHTML = "";
    inventoryEl.innerHTML = "";
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
    leadsEl.innerHTML = "";
    usersEl.innerHTML = "";
    dealersEl.innerHTML = "";
    inventoryEl.innerHTML = "";
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

  dealersEl.innerHTML = (data.staff || []).map(renderDealer).join("") || "<p>No dealer emails yet.</p>";
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

function renderInventoryListing(listing) {
  const options = listing.publicOptions || {};
  const photos = Array.isArray(listing.photos) ? listing.photos : [];
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
        <fieldset class="inventory-public-options">
          <legend>Public information</legend>
          <label><input type="checkbox" name="showVin" ${checkedOption(options, "showVin")} /> VIN</label>
          <label><input type="checkbox" name="showUvc" ${checkedOption(options, "showUvc")} /> UVC</label>
          <label><input type="checkbox" name="showKilometers" ${checkedOption(options, "showKilometers")} /> Kilometers</label>
          <label><input type="checkbox" name="showRegion" ${checkedOption(options, "showRegion")} /> Region</label>
          <label><input type="checkbox" name="showColor" ${checkedOption(options, "showColor")} /> Color</label>
          <label><input type="checkbox" name="showMaintenance" ${checkedOption(options, "showMaintenance", false)} /> Maintenance / repair notes</label>
          <label><input type="checkbox" name="showPhotos" ${checkedOption(options, "showPhotos", false)} /> Publish photos</label>
        </fieldset>
        <section class="inventory-photo-manager">
          <h4>Vehicle photos</h4>
          <p>Upload photos to Google Drive, then save this listing with Publish photos checked to show them on the Buy page.</p>
          <div class="inventory-photo-list">
            ${photos.map((photo) => `<a href="${escapeHtml(photo.url)}" target="_blank" rel="noreferrer">${escapeHtml(photo.label || "Vehicle photo")}</a>`).join("") || "<span>No photos attached yet.</span>"}
          </div>
          <label>
            <span>Photo label</span>
            <input name="photoLabel" value="Vehicle photo" />
          </label>
          <label>
            <span>Upload photos</span>
            <input name="inventoryPhotos" type="file" accept="image/*" multiple />
          </label>
          <button type="button" data-upload-inventory-photos="${escapeHtml(listing.id || "")}">Upload photos to Drive</button>
          <p class="inventory-photo-status" aria-live="polite"></p>
        </section>
      </div>
      <div class="inventory-actions">
        <button type="submit">Save listing</button>
        <button class="danger-outline" type="button" data-archive-listing="${escapeHtml(listing.id || "")}">Archive</button>
      </div>
    </form>
  `;
}

function checkedOption(options, key, defaultValue = true) {
  const hasOptions = options && Object.keys(options).length > 0;
  const enabled = hasOptions ? options[key] === true : defaultValue;
  return enabled ? "checked" : "";
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

  if (data.storage === "not_configured") {
    statusEl.textContent = "Lead storage is not configured on this deployment. Add Supabase env vars to persist leads.";
  } else {
    statusEl.textContent = `${data.leads.length} lead(s) captured.`;
  }

  leadsEl.innerHTML = data.leads.map(renderLead).join("") || "<p>No leads yet.</p>";
  await restoreOpenLeads(openIds, { forceActivity: Boolean(options.forceOpenActivity) });
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

function renderLead(lead) {
  const input = lead.input || {};
  const authUser = lead.auth_user || {};
  const valuation = lead.valuation || {};
  const adjustment = lead.owner_adjustment || {};
  const wholesale = valuation.values?.wholesale?.adjusted?.avg;
  const retail = valuation.values?.retail?.adjusted?.avg;
  const title = valuation.title || [input.year, input.make, input.model, input.series, input.style].filter(Boolean).join(" ") || "Vehicle lead";
  const customerEmail = input.email || authUser.email || lead.auth_email || "-";
  const vin = input.vin || valuation.vin || "-";
  const status = lead.status || "new";
  const assignedTo = lead.assigned_to || "";
  const priority = lead.priority || "normal";
  const followUp = lead.next_follow_up_at || "";
  const overdue = isOverdue(followUp, status);
  const statusClass = overdue ? "status-overdue" : `status-${cssToken(status)}`;
  const statusLabel = overdue ? "Overdue" : status.replaceAll("_", " ");
  return `
    <article class="lead-card ${overdue ? "lead-overdue" : ""}" data-id="${escapeHtml(lead.id || "")}">
      <header class="lead-summary">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(formatDateTime(lead.created_at))}</span>
        </div>
        <div class="lead-summary-metrics">
          <span>${escapeHtml(customerEmail)}</span>
          <span>VIN ${escapeHtml(vin)}</span>
          <span>Owner ${escapeHtml(assignedTo || "Unassigned")}</span>
          <span>Wholesale ${wholesale ? formatNumber(wholesale) : "-"}</span>
          <span>Retail ${retail ? formatNumber(retail) : "-"}</span>
          <b class="priority-pill priority-${escapeHtml(priority)}">${escapeHtml(priority)}</b>
          <b class="status-pill ${escapeHtml(statusClass)}">${escapeHtml(statusLabel)}</b>
        </div>
      </header>
      <details class="lead-manage">
        <summary>Manage lead</summary>
        <div class="lead-grid">
          <span>Email</span><b>${escapeHtml(input.email || "-")}</b>
          <span>Google user</span><b>${escapeHtml(authUser.email || "-")}</b>
          <span>Phone</span><b>${escapeHtml(input.phone || "-")}</b>
          <span>VIN</span><b>${escapeHtml(vin)}</b>
          <span>UVC</span><b>${escapeHtml(input.uvc || "-")}</b>
          <span>Vehicle</span><b>${escapeHtml([input.year, input.make, input.model, input.series, input.style].filter(Boolean).join(" ") || "-")}</b>
          <span>Kilometers</span><b>${formatNumber(input.kilometers || 0)}</b>
          <span>Ownership</span><b>${escapeHtml(input.ownershipType || (input.ownsVehicle ? "Owned" : "-"))}</b>
          <span>Color</span><b>${escapeHtml(input.color || "-")}</b>
          <span>Region</span><b>${escapeHtml(input.region || valuation.region || "-")}</b>
          <span>AVG Wholesale</span><b>${wholesale ? formatNumber(wholesale) : "-"}</b>
          <span>AVG Retail</span><b>${retail ? formatNumber(retail) : "-"}</b>
        </div>
        <form class="owner-review">
          <label>
            <span>Status</span>
            <select name="status">
              ${["new", "assigned", "contacted", "waiting_for_customer", "inspection_booked", "offer_sent", "won", "lost", "closed", "deleted"].map((item) =>
                `<option value="${item}" ${status === item ? "selected" : ""}>${item}</option>`
              ).join("")}
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
          <button class="danger-outline" type="button" data-delete-lead="${escapeHtml(lead.id || "")}" data-delete-title="${escapeHtml(title)}">Delete lead</button>
        </form>
        <form class="inventory-publish-form">
          <h3>Publish to buy page</h3>
          <p class="inventory-helper">Published listings appear on the public Buy page. Use Inventory management to unpublish by changing status to draft, sold, or archived.</p>
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
            <label><input type="checkbox" name="showPhotos" /> Publish selected vehicle photos when public photo URLs are available</label>
          </fieldset>
          <button type="submit">Publish inventory listing</button>
          <p class="inventory-publish-status" aria-live="polite"></p>
        </form>
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
  if (data.ok) await loadLeads();
});

inventoryEl?.addEventListener("submit", async (event) => {
  const form = event.target.closest(".inventory-card-admin");
  if (!form) return;
  event.preventDefault();
  await saveInventoryListing(form);
});

inventoryEl?.addEventListener("click", async (event) => {
  const uploadButton = event.target.closest("[data-upload-inventory-photos]");
  if (uploadButton) {
    const form = uploadButton.closest(".inventory-card-admin");
    if (!form) return;
    await uploadInventoryPhotos(form, uploadButton);
    return;
  }

  const button = event.target.closest("[data-archive-listing]");
  if (!button) return;
  const form = button.closest(".inventory-card-admin");
  if (!form) return;
  const confirmed = window.confirm("Archive this listing? It will be removed from the public buy page.");
  if (!confirmed) return;
  form.elements.status.value = "archived";
  await saveInventoryListing(form);
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

async function uploadInventoryPhotos(form, button) {
  const fileInput = form.elements.inventoryPhotos;
  const status = form.querySelector(".inventory-photo-status");
  const files = Array.from(fileInput?.files || []).slice(0, 6);
  if (!files.length) {
    if (status) status.textContent = "Choose at least one photo first.";
    return;
  }
  button.disabled = true;
  if (status) status.textContent = "Preparing photos...";
  try {
    const photoFiles = [];
    for (const file of files) {
      photoFiles.push(await fileToBase64Payload(file, form.elements.photoLabel?.value || "Vehicle photo"));
    }
    if (status) status.textContent = "Uploading photos to Google Drive...";
    const response = await fetch("/api/inventory-photos", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId: form.dataset.id,
        files: photoFiles
      })
    });
    const data = await response.json();
    const message = data.ok ? `${data.photos.length} photo(s) uploaded.` : formatApiError(data, "Unable to upload photos.");
    if (status) status.textContent = message;
    inventoryStatusEl.textContent = message;
    if (data.ok) await loadInventory();
  } catch (error) {
    if (status) status.textContent = error.message || "Unable to upload photos.";
  } finally {
    button.disabled = false;
  }
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
    ? `Inventory listing ${data.updated ? "updated" : "published"}.`
    : formatApiError(data, "Unable to publish inventory listing.");
  statusEl.textContent = message;
  if (formStatus) formStatus.textContent = message;
  if (data.ok) await loadInventory();
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

  const completeButton = event.target.closest("[data-complete-task]");
  if (!completeButton) return;

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
});

leadsEl.addEventListener("toggle", async (event) => {
  const details = event.target.closest(".lead-manage");
  if (!details || !details.open) return;

  const card = details.closest(".lead-card");
  if (!card || card.dataset.activityLoaded === "true") return;
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
  if (data.ok) await loadLeads();
  button.disabled = false;
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
      await loadLeads();
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
  if (list) list.innerHTML = renderActivity(data);
}

function renderActivity(data) {
  const tasks = (data.tasks || []).map((task) => `
    <article class="activity-item ${task.completed_at ? "activity-done" : ""}">
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
    <article class="activity-item">
      <div>
        <strong>${escapeHtml(note.note_type || "note")} by ${escapeHtml(note.author_email || "-")}</strong>
        <span>${escapeHtml(formatDateTime(note.created_at))}</span>
        <p>${escapeHtml(note.note || "")}</p>
      </div>
    </article>
  `);

  const emails = (data.emails || []).map((email) => `
    <article class="activity-item">
      <div>
        <strong>Email to ${escapeHtml(email.sent_to || "-")}</strong>
        <span>${escapeHtml(email.subject || "")} - ${escapeHtml(formatDateTime(email.created_at))}</span>
      </div>
    </article>
  `);

  const content = [...tasks, ...notes, ...emails].join("");
  return content || "<p>No activity yet.</p>";
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
