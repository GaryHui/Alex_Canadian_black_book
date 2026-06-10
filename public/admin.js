const statusEl = document.querySelector("#admin-status");
const leadsEl = document.querySelector("#admin-leads");

loadLeads();

async function loadLeads() {
  const response = await fetch("/api/leads");
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
  const wholesale = valuation.values?.wholesale?.adjusted?.avg;
  const retail = valuation.values?.retail?.adjusted?.avg;
  return `
    <article class="lead-card">
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
      <details>
        <summary>Raw valuation summary</summary>
        <pre>${escapeHtml(JSON.stringify(valuation, null, 2))}</pre>
      </details>
    </article>
  `;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(Number(value));
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
