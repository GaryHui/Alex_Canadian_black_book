const authStatusEl = document.querySelector("#vehicle-admin-auth-status");
const loginButton = document.querySelector("#vehicle-admin-login");
const logoutButton = document.querySelector("#vehicle-admin-logout");
const contentEl = document.querySelector("#vehicle-admin-content");
const turnstileWrap = document.querySelector("#vehicle-admin-turnstile-wrap");
const turnstileEl = document.querySelector("#vehicle-admin-turnstile");
const turnstileStatusEl = document.querySelector("#vehicle-admin-turnstile-status");
const reloadButton = document.querySelector("#reload-vehicle-clusters");
const statusEl = document.querySelector("#vehicle-clusters-status");
const overviewEl = document.querySelector("#vehicle-clusters-overview");
const listEl = document.querySelector("#vehicle-clusters-list");
const focusParams = new URLSearchParams(window.location.search);

let supabaseClient = null;
let adminSession = null;
let turnstileGate = null;
let clustersCache = [];
let focusedLeadId = focusParams.get("leadId") || "";
let focusedClusterKey = focusParams.get("cluster") || "";

loginButton?.addEventListener("click", signInAdmin);
logoutButton?.addEventListener("click", signOutAdmin);
reloadButton?.addEventListener("click", loadVehicleClusters);
listEl?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-cluster-review]");
  if (!button) return;
  await saveVehicleReview(button);
});

initializeAdminAuth();

async function initializeAdminAuth() {
  const config = await fetch("/api/config").then((res) => res.json()).catch(() => ({}));
  if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) {
    authStatusEl.textContent = "Supabase login is not configured.";
    loginButton.hidden = true;
    contentEl.hidden = true;
    return;
  }

  turnstileGate = window.createTurnstileGate?.({
    siteKey: config.turnstileSiteKey,
    wrap: turnstileWrap,
    container: turnstileEl,
    button: loginButton,
    statusEl: turnstileStatusEl,
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
  if (turnstileGate && !turnstileGate.canProceed()) return;
  await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/admin-vehicles.html`
    }
  });
}

async function signOutAdmin() {
  if (supabaseClient) await supabaseClient.auth.signOut();
  await setAdminSession(null);
}

async function setAdminSession(session) {
  adminSession = session;
  loginButton.hidden = !!session?.user;
  logoutButton.hidden = !session?.user;
  contentEl.hidden = !session?.user;
  if (turnstileWrap && turnstileGate?.enabled) {
    if (session?.user) turnstileGate.hide();
    turnstileWrap.hidden = true;
  }

  if (!session?.user) {
    authStatusEl.textContent = "Admin Google sign-in required.";
    statusEl.textContent = "";
    overviewEl.innerHTML = "";
    listEl.innerHTML = "";
    return;
  }

  const admin = await checkAdminAccess();
  if (!admin.ok) {
    contentEl.hidden = true;
    authStatusEl.textContent = admin.error || `This Google account is not an admin: ${session.user.email}`;
    statusEl.textContent = "Ask the site owner to add this email to ADMIN_EMAILS in Vercel.";
    overviewEl.innerHTML = "";
    listEl.innerHTML = "";
    return;
  }

  authStatusEl.textContent = `Signed in as ${session.user.email}`;
  await loadVehicleClusters();
}

async function checkAdminAccess() {
  try {
    const response = await fetch("/api/admin-check", { headers: authHeaders() });
    return response.json();
  } catch (error) {
    return { ok: false, error: error.message || "Unable to verify admin access." };
  }
}

async function loadVehicleClusters() {
  if (!adminSession) return;
  statusEl.textContent = "Loading vehicle clusters...";
  const response = await fetch("/api/vehicle-clusters", { headers: authHeaders() });
  const data = await response.json();
  if (!data.ok) {
    statusEl.textContent = data.error || "Unable to load vehicle clusters.";
    overviewEl.innerHTML = "";
    listEl.innerHTML = "";
    return;
  }

  clustersCache = data.clusters || [];
  renderOverview(clustersCache);
  renderClusters(clustersCache);
  statusEl.textContent = `${clustersCache.length} vehicle cluster(s) loaded. ${clustersCache.filter((item) => Number(item.needs_review_count || 0) > 0).length} still need review.`;
  highlightFocusedCluster();
}

function renderOverview(clusters) {
  const needsReview = clusters.filter((item) => Number(item.needs_review_count || 0) > 0).length;
  const withInventory = clusters.filter((item) => Array.isArray(item.inventory) && item.inventory.length > 0).length;
  const mergedChildren = clusters.reduce((total, cluster) => (
    total + (cluster.seller_leads || []).filter((lead) => Boolean(lead.merge_state)).length
  ), 0);
  overviewEl.innerHTML = `
    <article class="admin-overview-card overview-owner">
      <span>Clusters</span>
      <strong>${clusters.length}</strong>
      <small>Vehicle groups found in CRM / Warehouse</small>
    </article>
    <article class="admin-overview-card overview-urgent">
      <span>Need review</span>
      <strong>${needsReview}</strong>
      <small>Clusters with open duplicate SELL review</small>
    </article>
    <article class="admin-overview-card overview-seller">
      <span>Merged or linked</span>
      <strong>${mergedChildren}</strong>
      <small>Seller duplicates already collapsed under a primary record</small>
    </article>
    <article class="admin-overview-card overview-follow">
      <span>Warehouse linked</span>
      <strong>${withInventory}</strong>
      <small>Clusters already tied to inventory records</small>
    </article>
  `;
}

function renderClusters(clusters) {
  if (!clusters.length) {
    listEl.innerHTML = `<p>No duplicate vehicle clusters found right now.</p>`;
    return;
  }
  const ordered = [...clusters].sort((a, b) => Number(clusterMatchesFocus(b)) - Number(clusterMatchesFocus(a)));
  listEl.innerHTML = ordered.map(renderClusterCard).join("");
}

function renderClusterCard(cluster) {
  const pendingSellerLeads = (cluster.seller_leads || []).filter((lead) => lead.duplicate_warning?.message && !lead.duplicate_warning?.reviewed && !lead.merge_state);
  const primaryLead = (cluster.seller_leads || []).find((lead) => lead.id === cluster.primary_lead_id) || null;
  const primaryListing = (cluster.inventory || []).find((listing) => listing.id === cluster.primary_listing_id) || cluster.inventory?.[0] || null;
  return `
    <article class="vehicle-cluster-card ${clusterMatchesFocus(cluster) ? "vehicle-cluster-card-focus" : ""}" data-cluster-key="${escapeHtml(cluster.key || "")}">
      <header class="vehicle-cluster-head">
        <div>
          <span>Vehicle cluster</span>
          <strong>${escapeHtml(cluster.label || "Vehicle cluster")}</strong>
          <small>${escapeHtml(cluster.key || "-")}</small>
        </div>
        <div class="vehicle-cluster-badges">
          <b class="status-pill">${escapeHtml(`${cluster.seller_leads.length} SELL`)}</b>
          <b class="status-pill">${escapeHtml(`${cluster.buyer_leads.length} BUY`)}</b>
          <b class="status-pill">${escapeHtml(`${cluster.inventory.length} Warehouse`)}</b>
          ${cluster.needs_review_count ? `<b class="priority-pill priority-urgent">${escapeHtml(`${cluster.needs_review_count} need review`)}</b>` : ""}
        </div>
      </header>

      <div class="vehicle-cluster-grid">
        <section class="vehicle-cluster-panel">
          <header>
            <span>Primary CRM</span>
            <a href="${escapeHtml(primaryLead ? adminLeadUrl(primaryLead.id) : "/admin.html")}" target="_blank" rel="noreferrer">Open CRM</a>
          </header>
          ${primaryLead ? renderClusterLeadSummary(primaryLead, true) : `<p class="vehicle-cluster-empty">No primary seller lead chosen yet.</p>`}
        </section>

        <section class="vehicle-cluster-panel">
          <header>
            <span>Warehouse</span>
            <a href="/admin.html#inventory-warehouse" target="_blank" rel="noreferrer">Open inventory</a>
          </header>
          ${primaryListing ? renderClusterListingSummary(primaryListing) : `<p class="vehicle-cluster-empty">No warehouse listing linked yet.</p>`}
        </section>
      </div>

      <section class="vehicle-cluster-panel">
        <header>
          <span>Open duplicate SELL leads</span>
          <b>${pendingSellerLeads.length}</b>
        </header>
        ${pendingSellerLeads.length ? `
          <div class="vehicle-cluster-items">
            ${pendingSellerLeads.map((lead) => renderPendingClusterLead(lead, cluster)).join("")}
          </div>
        ` : `<p class="vehicle-cluster-empty">No open duplicate SELL review remains in this cluster.</p>`}
      </section>

      <div class="vehicle-cluster-grid">
        <section class="vehicle-cluster-panel">
          <header>
            <span>All seller leads</span>
            <b>${cluster.seller_leads.length}</b>
          </header>
          <div class="vehicle-cluster-items">
            ${cluster.seller_leads.map((lead) => renderClusterLeadSummary(lead, lead.id === cluster.primary_lead_id)).join("")}
          </div>
        </section>

        <section class="vehicle-cluster-panel">
          <header>
            <span>Buyer leads</span>
            <b>${cluster.buyer_leads.length}</b>
          </header>
          ${cluster.buyer_leads.length ? `
            <div class="vehicle-cluster-items">
              ${cluster.buyer_leads.map((lead) => `
                <article class="vehicle-cluster-item">
                  <strong>${escapeHtml(lead.title || lead.id || "Buyer lead")}</strong>
                  <small>${escapeHtml([lead.status, lead.assigned_to ? `Owner ${shortEmail(lead.assigned_to)}` : "Unassigned"].filter(Boolean).join(" | "))}</small>
                </article>
              `).join("")}
            </div>
          ` : `<p class="vehicle-cluster-empty">No buyer leads in this cluster.</p>`}
        </section>
      </div>
    </article>
  `;
}

function renderPendingClusterLead(lead, cluster) {
  const targetLeadId = cluster.primary_lead_id && cluster.primary_lead_id !== lead.id ? cluster.primary_lead_id : "";
  const listingId = cluster.primary_listing_id || "";
  return `
    <article class="vehicle-cluster-item vehicle-cluster-pending">
      <div>
        <strong>${escapeHtml(lead.title || lead.id || "Seller lead")}</strong>
        <small>${escapeHtml([
          lead.status,
          lead.assigned_to ? `Owner ${shortEmail(lead.assigned_to)}` : "Unassigned",
          lead.created_at ? formatDateTime(lead.created_at) : ""
        ].filter(Boolean).join(" | "))}</small>
        <p>${escapeHtml(lead.duplicate_warning?.message || "Duplicate review required.")}</p>
      </div>
      <div class="vehicle-cluster-actions">
        <button type="button" data-cluster-review="keep_separate" data-lead-id="${escapeHtml(lead.id || "")}">Keep separate</button>
        <button type="button" data-cluster-review="merge_existing" data-lead-id="${escapeHtml(lead.id || "")}" data-target-lead-id="${escapeHtml(targetLeadId)}" ${targetLeadId ? "" : "disabled"}>Merge into primary</button>
        <button type="button" data-cluster-review="link_inventory" data-lead-id="${escapeHtml(lead.id || "")}" data-target-lead-id="${escapeHtml(targetLeadId)}" data-listing-id="${escapeHtml(listingId)}" ${listingId ? "" : "disabled"}>Link warehouse</button>
      </div>
    </article>
  `;
}

function renderClusterLeadSummary(lead, isPrimary) {
  const relationText = lead.merge_state?.kind === "merged"
    ? `Merged into ${lead.merge_state.primary_lead_id || "-"}`
    : lead.merge_state?.kind === "linked_inventory"
      ? `Linked to ${lead.merge_state.listing_id || "-"}`
      : isPrimary ? "Primary lead" : "Independent lead";
  return `
    <article class="vehicle-cluster-item ${isPrimary ? "vehicle-cluster-item-primary" : ""}">
      <strong>${escapeHtml(lead.title || lead.id || "Seller lead")}</strong>
      <small>${escapeHtml([
        lead.status,
        lead.assigned_to ? `Owner ${shortEmail(lead.assigned_to)}` : "Unassigned",
        lead.priority || "normal",
        relationText
      ].filter(Boolean).join(" | "))}</small>
      <a class="vehicle-cluster-item-link" href="${escapeHtml(adminLeadUrl(lead.id))}" target="_blank" rel="noreferrer">Open in CRM</a>
    </article>
  `;
}

function renderClusterListingSummary(listing) {
  return `
    <article class="vehicle-cluster-item vehicle-cluster-item-primary">
      <strong>${escapeHtml(listing.title || listing.id || "Warehouse listing")}</strong>
      <small>${escapeHtml([
        listing.status,
        listing.source_lead_title ? `Source ${listing.source_lead_title}` : listing.source_lead_id ? `Source ${listing.source_lead_id}` : "No source lead",
        listing.asking_price ? formatNumber(listing.asking_price) : ""
      ].filter(Boolean).join(" | "))}</small>
    </article>
  `;
}

function clusterMatchesFocus(cluster) {
  if (focusedClusterKey && String(cluster?.key || "") === focusedClusterKey) return true;
  if (!focusedLeadId) return false;
  return [...(cluster?.seller_leads || []), ...(cluster?.buyer_leads || [])].some((lead) => String(lead?.id || "") === focusedLeadId)
    || (cluster?.inventory || []).some((listing) => String(listing?.source_lead_id || "") === focusedLeadId);
}

function highlightFocusedCluster() {
  const target = listEl?.querySelector(".vehicle-cluster-card-focus");
  if (!target) return;
  window.requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  if (focusedLeadId || focusedClusterKey) {
    statusEl.textContent = `${statusEl.textContent} Focused vehicle cluster opened from the admin workbench.`;
  }
}

function adminLeadUrl(leadId) {
  const id = String(leadId || "").trim();
  return id ? `/admin.html?leadId=${encodeURIComponent(id)}` : "/admin.html";
}

async function saveVehicleReview(button) {
  const leadId = String(button.dataset.leadId || "").trim();
  const decision = String(button.dataset.clusterReview || "keep_separate").trim();
  const targetLeadId = String(button.dataset.targetLeadId || "").trim();
  const listingId = String(button.dataset.listingId || "").trim();
  if (!leadId) return;

  button.disabled = true;
  statusEl.textContent = "Saving vehicle review...";
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
    if (!data.ok) throw new Error(formatApiError(data, "Unable to save vehicle review."));
    statusEl.textContent = "Vehicle review saved.";
    await loadVehicleClusters();
  } catch (error) {
    statusEl.textContent = error.message || "Unable to save vehicle review.";
    button.disabled = false;
  }
}

function authHeaders() {
  return adminSession?.access_token ? { Authorization: `Bearer ${adminSession.access_token}` } : {};
}

function formatApiError(data, fallback) {
  const direct = typeof data?.error === "string" ? data.error : "";
  if (direct) return direct;
  const message = typeof data?.error?.message === "string" ? data.error.message : "";
  if (message) return message;
  return fallback;
}

function formatNumber(value) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDateTime(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function shortEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  return value.split("@")[0] || value || "-";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
