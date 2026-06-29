(() => {
  const nav = document.querySelector(".top-nav");
  const dashboardLink = document.querySelector("[data-customer-dashboard-link]");
  if (!nav || !dashboardLink) return;

  const labels = {
    en: {
      dealer: "Dealer portal",
      admin: "Admin"
    },
    fr: {
      dealer: "Portail concessionnaire",
      admin: "Admin"
    }
  };

  let supabaseClient = null;
  let staffRole = "";

  function currentLanguage() {
    const lang = document.documentElement.lang || localStorage.getItem("customer-language") || "en";
    return String(lang).toLowerCase().startsWith("fr") ? "fr" : "en";
  }

  function staffLabels() {
    return labels[currentLanguage()] || labels.en;
  }

  function ensureStaffLink(key, href, text) {
    let link = nav.querySelector(`[data-staff-nav-link="${key}"]`);
    if (!link) {
      link = document.createElement("a");
      link.href = href;
      link.dataset.staffNavLink = key;
      nav.insertBefore(link, nav.querySelector("#language-toggle") || nav.firstElementChild?.nextSibling || null);
    }
    link.textContent = text;
    link.hidden = false;
    return link;
  }

  function removeStaffLinks() {
    nav.querySelectorAll("[data-staff-nav-link]").forEach((link) => link.remove());
  }

  function renderNav() {
    const copy = staffLabels();
    removeStaffLinks();
    if (!staffRole) {
      dashboardLink.hidden = false;
      return;
    }

    dashboardLink.hidden = true;
    ensureStaffLink("dealer", "/dealer.html", copy.dealer);
    if (staffRole === "admin") ensureStaffLink("admin", "/admin.html", copy.admin);
  }

  async function detectStaff(session) {
    staffRole = "";
    if (!session?.access_token) {
      renderNav();
      return;
    }

    try {
      const response = await fetch("/api/dealer-check", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      staffRole = data.ok ? (data.role === "admin" ? "admin" : "staff") : "";
    } catch (_error) {
      staffRole = "";
    }
    renderNav();
  }

  async function initStaffNav() {
    renderNav();
    if (!window.supabase) return;
    const config = await fetch("/api/config", { cache: "no-store" }).then((res) => res.json()).catch(() => ({}));
    if (!config.supabaseUrl || !config.supabaseAnonKey) return;

    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: false,
        persistSession: true
      }
    });
    const { data } = await supabaseClient.auth.getSession();
    await detectStaff(data.session);
    supabaseClient.auth.onAuthStateChange((_event, session) => detectStaff(session));
  }

  new MutationObserver(renderNav).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"]
  });

  initStaffNav();
})();
