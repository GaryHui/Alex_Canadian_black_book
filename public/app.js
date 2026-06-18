const form = document.querySelector("#valuation-form");
const freeForm = document.querySelector("#free-form");
const drilldownForm = document.querySelector("#drilldown-form");
const statusEl = document.querySelector("#status");
const detailsEl = document.querySelector("#details");
const valueBody = document.querySelector("#value-body");
const tabs = document.querySelectorAll(".market-tabs button");
const modeButtons = document.querySelectorAll(".lookup-mode");
const lookupPanel = document.querySelector(".lookup-panel");
const choiceList = document.querySelector("#choice-list");
const inlineChoiceList = document.querySelector("#inline-choice-list");
const authTitle = document.querySelector("#auth-title");
const authSubtitle = document.querySelector("#auth-subtitle");
const logoutButton = document.querySelector("#logout");
const searchModal = document.querySelector("#search-modal");
const searchClose = document.querySelector("#search-close");
const searchBackdrop = document.querySelector("#search-backdrop");
const searchClear = document.querySelector("#search-clear");
const modalStatus = document.querySelector("#modal-status");
const quotaPanel = document.querySelector("#quota-panel");
const quotaTitle = document.querySelector("#quota-title");
const quotaSubtitle = document.querySelector("#quota-subtitle");
const historyPanel = document.querySelector("#history-panel");
const historyStatus = document.querySelector("#history-status");
const historyList = document.querySelector("#history-list");
const reloadHistoryButton = document.querySelector("#reload-history");
const dealerWorkbench = document.querySelector("#dealer-workbench");
const dealerLeadsStatus = document.querySelector("#dealer-leads-status");
const dealerLeadsList = document.querySelector("#dealer-leads-list");
const reloadDealerLeadsButton = document.querySelector("#reload-dealer-leads");
const dealerLeadAlertsEl = document.querySelector("#dealer-lead-alerts");
const dealerTodayWorkEl = document.querySelector("#dealer-today-work");
const dealerLeadFilterButtons = document.querySelectorAll("[data-dealer-filter]");
const dealerLeadSortSelect = document.querySelector("#dealer-lead-sort");
const dealerLeadDrawer = document.querySelector("#dealer-lead-drawer");
const dealerLeadDrawerContent = document.querySelector("#dealer-lead-drawer-content");
const saveValuationLeadButton = document.querySelector("#save-valuation-lead");
const DEALER_REFRESH_MS = 30000;
const DEALER_LEAD_READ_TOKENS_KEY = "autoswitch-dealer-lead-read-tokens";
const DEALER_DASHBOARD_RANGE_KEY = "autoswitch-dealer-dashboard-range";
const drilldownSuggestions = {
  Honda: {
    models: ["Accord", "Civic", "CR-V", "HR-V", "Odyssey", "Pilot", "Ridgeline"],
    series: {
      Odyssey: ["LX", "EX", "EX-L", "Touring", "Touring RES", "SE"],
      Accord: ["LX", "Sport", "EX-L", "Touring"],
      Civic: ["DX", "LX", "EX", "Sport", "Touring"],
      "CR-V": ["LX", "EX", "EX-L", "Touring"]
    },
    styles: {
      Odyssey: ["4D Wagon"],
      Accord: ["2D Coupe", "4D Sedan"],
      Civic: ["2D Coupe", "4D Hatchback", "4D Sedan"],
      "CR-V": ["4D Utility AWD", "4D Utility FWD"]
    }
  },
  Lexus: {
    models: ["ES-Series", "IS-Series", "NX-Series", "RX-Series", "UX-Series"],
    series: {
      "NX-Series": ["NX250", "NX350 Premium", "NX350 Ultra Premium", "NX350h"]
    },
    styles: {
      "NX-Series": ["4D Utility AWD"]
    }
  },
  Toyota: {
    models: ["Camry", "Corolla", "Highlander", "RAV4", "Sienna", "Tacoma"],
    series: {},
    styles: {}
  },
  Ford: {
    models: ["Escape", "Explorer", "F150", "F250", "Mustang"],
    series: {},
    styles: {}
  }
};
const commonMakes = ["Acura", "Audi", "BMW", "Chevrolet", "Ford", "Honda", "Hyundai", "Kia", "Lexus", "Mazda", "Mercedes-Benz", "Nissan", "Subaru", "Toyota", "Volkswagen"];
const commonStyles = ["2D Coupe", "4D Hatchback", "4D Sedan", "4D Utility AWD", "4D Utility FWD", "4D Wagon"];
const unknownOption = "Not sure";

let currentResult = null;
let currentMarket = "wholesale";
let supabaseClient = null;
let authSession = null;
let dealerAdminAllowed = false;
let usageState = null;
let drilldownRequestId = 0;
let historyLeads = [];
let pendingDealerLeadCapture = null;
let currentLookupMode = "free";
let dealerRefreshTimer = null;
let dealerDirectoryEmails = [];
let dealerLeadsCache = [];
let dealerLeadRole = "dealer";
let dealerLeadFilter = "active";
let dealerLeadSort = "newest";
let dealerLeadAlertMap = new Map();
let activeDealerLeadId = "";
let activeDealerDrawerLeadId = "";
let dealerDrawerActivityLoaded = false;
let dealerDashboardRange = loadDashboardDateRange(DEALER_DASHBOARD_RANGE_KEY);

initializeDatalists();
initializeAuth();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && authSession && dealerAdminAllowed) refreshOpenDealerTasks();
});

reloadHistoryButton.addEventListener("click", loadHistory);
reloadDealerLeadsButton?.addEventListener("click", () => loadDealerLeads({ forceActivity: true }));
saveValuationLeadButton?.addEventListener("click", savePendingDealerLead);
dealerLeadFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setDealerLeadFilter(button.dataset.dealerFilter || "all");
    renderDealerLeads(dealerLeadsCache, dealerLeadRole);
  });
});
dealerLeadSortSelect?.addEventListener("change", () => {
  dealerLeadSort = dealerLeadSortSelect.value === "oldest" ? "oldest" : "newest";
  renderDealerLeads(dealerLeadsCache, dealerLeadRole);
});
dealerLeadAlertsEl?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-dealer-open-alert]");
  if (!button) return;
  await openDealerLeadFromAlert(button.dataset.dealerOpenAlert || "");
});
dealerTodayWorkEl?.addEventListener("click", async (event) => {
  const filterButton = event.target.closest("[data-dealer-filter-shortcut]");
  if (filterButton) {
    setDealerLeadFilter(filterButton.dataset.dealerFilterShortcut || "due");
    renderDealerLeads(dealerLeadsCache, dealerLeadRole);
    document.querySelector("#dealer-assigned-leads")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const button = event.target.closest("[data-dealer-open-lead]");
  if (!button) return;
  await openDealerLead(button.dataset.dealerOpenLead || "");
});
dealerTodayWorkEl?.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-dealer-dashboard-range]");
  if (!form) return;
  event.preventDefault();
  const result = validateDashboardRangeForm(form);
  if (!result.ok) return;
  dealerDashboardRange = normalizeDashboardDateRange(result.range);
  saveDashboardDateRange(DEALER_DASHBOARD_RANGE_KEY, dealerDashboardRange);
  renderDealerTodayWork(dealerLeadsCache);
});
dealerTodayWorkEl?.addEventListener("input", (event) => {
  const form = event.target.closest("[data-dealer-dashboard-range]");
  if (!form) return;
  syncDashboardDateConstraints(form);
});
setLookupMode("free", { openModal: false });

dealerLeadsList?.addEventListener("click", async (event) => {
  const clickedCard = event.target.closest(".dealer-lead-card");
  if (clickedCard?.dataset?.leadId) setActiveDealerLead(clickedCard.dataset.leadId);
  const row = event.target.closest(".dealer-list-row");
  if (row && !event.target.closest("button, a, input, select, textarea, summary")) {
    await openDealerWorkspace(row.closest(".dealer-lead-card"), { forceActivity: false });
    return;
  }
  const openWorkspaceButton = event.target.closest("[data-dealer-open-workspace]");
  if (openWorkspaceButton) {
    await openDealerWorkspace(openWorkspaceButton.closest(".dealer-lead-card"), { forceActivity: true });
    return;
  }

  const focusNoteButton = event.target.closest("[data-dealer-focus-note]");
  if (focusNoteButton) {
    await openDealerWorkspace(focusNoteButton.closest(".dealer-lead-card"), {
      forceActivity: true,
      focus: "note",
      noteType: focusNoteButton.dataset.dealerFocusNote || "internal"
    });
    return;
  }

  const focusTaskButton = event.target.closest("[data-dealer-focus-task]");
  if (focusTaskButton) {
    await openDealerWorkspace(focusTaskButton.closest(".dealer-lead-card"), { forceActivity: true, focus: "task" });
    return;
  }

  return;
});

dealerLeadsList?.addEventListener("toggle", async (event) => {
  const details = event.target.closest(".lead-queue-more");
  if (!details || !details.open) return;
  const card = details.closest(".dealer-lead-card");
  if (!card) return;
  if (card.dataset.leadId) setActiveDealerLead(card.dataset.leadId);
  clearDealerLeadUpdateNotice(card);
}, true);

dealerLeadsList?.addEventListener("focusin", (event) => {
  const card = event.target.closest(".dealer-lead-card");
  if (card?.dataset?.leadId) setActiveDealerLead(card.dataset.leadId);
});

dealerLeadDrawer?.addEventListener("click", async (event) => {
  if (event.target === dealerLeadDrawer || event.target.classList.contains("dealer-lead-drawer-panel")) {
    closeDealerDrawer();
    return;
  }
  const closeButton = event.target.closest("[data-dealer-drawer-close]");
  if (closeButton) {
    closeDealerDrawer();
    return;
  }

  const openCardButton = event.target.closest("[data-dealer-drawer-open-card]");
  if (openCardButton) {
    await openFullDealerLeadFromDrawer();
    return;
  }

  const refreshButton = event.target.closest("[data-drawer-load-dealer-activity]");
  if (refreshButton) {
    dealerDrawerActivityLoaded = false;
    await loadDealerDrawerActivity({ force: true, highlightLatest: true });
    return;
  }

  const noteTypeButton = event.target.closest("[data-drawer-note-type]");
  if (noteTypeButton) {
    const type = noteTypeButton.dataset.drawerNoteType || "internal";
    const select = dealerLeadDrawerContent?.querySelector('.dealer-drawer-note-form select[name="noteType"]');
    const field = dealerLeadDrawerContent?.querySelector('.dealer-drawer-note-form textarea[name="note"]');
    if (select) select.value = type;
    field?.focus();
    return;
  }

  const focusEmailButton = event.target.closest("[data-drawer-focus-email]");
  if (focusEmailButton) {
    const field = dealerLeadDrawerContent?.querySelector('.dealer-drawer-email-form input[name="subject"]');
    field?.focus();
    return;
  }

  const checklistToggleButton = event.target.closest("[data-dealer-dealdesk-check]");
  if (checklistToggleButton && activeDealerDrawerLeadId) {
    const itemKey = checklistToggleButton.dataset.dealerDealdeskCheck || "";
    const completed = checklistToggleButton.dataset.completed !== "true";
    checklistToggleButton.disabled = true;
    dealerLeadsStatus.textContent = "Saving deal desk checklist...";
    try {
      const response = await fetch("/api/lead-activity", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authSession?.access_token || ""}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          leadId: activeDealerDrawerLeadId,
          type: "deal_desk",
          kind: "check",
          itemKey,
          completed
        })
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Unable to save deal desk checklist");
      dealerDrawerActivityLoaded = false;
      dealerLeadsStatus.textContent = "Deal desk checklist updated.";
      await Promise.all([
        loadDealerDrawerActivity({ force: true, highlightLatest: true }),
        loadDealerLeads({ forceActivity: true, suppressAlerts: true })
      ]);
    } catch (error) {
      checklistToggleButton.disabled = false;
      dealerLeadsStatus.textContent = error.message || "Unable to save deal desk checklist";
    }
    return;
  }

  const keyHandoffButton = event.target.closest("[data-dealer-dealdesk-key]");
  if (keyHandoffButton && activeDealerDrawerLeadId) {
    const handoffStatus = keyHandoffButton.dataset.dealerDealdeskKey || "pending";
    keyHandoffButton.disabled = true;
    dealerLeadsStatus.textContent = "Saving key handoff...";
    try {
      const response = await fetch("/api/lead-activity", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authSession?.access_token || ""}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          leadId: activeDealerDrawerLeadId,
          type: "deal_desk",
          kind: "key_handoff",
          status: handoffStatus
        })
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Unable to save key handoff");
      dealerDrawerActivityLoaded = false;
      dealerLeadsStatus.textContent = "Key handoff updated.";
      await Promise.all([
        loadDealerDrawerActivity({ force: true, highlightLatest: true }),
        loadDealerLeads({ forceActivity: true, suppressAlerts: true })
      ]);
    } catch (error) {
      keyHandoffButton.disabled = false;
      dealerLeadsStatus.textContent = error.message || "Unable to save key handoff";
    }
    return;
  }

  const completeButton = event.target.closest("[data-complete-dealer-task]");
  if (completeButton && activeDealerDrawerLeadId) {
    completeButton.disabled = true;
    dealerLeadsStatus.textContent = "Marking task complete...";
    try {
      const response = await fetch("/api/lead-activity", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authSession?.access_token || ""}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ leadId: activeDealerDrawerLeadId, taskId: completeButton.dataset.completeDealerTask || "", completed: true })
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Unable to complete task");
      dealerLeadsStatus.textContent = "Task completed. Admin can review it.";
      dealerDrawerActivityLoaded = false;
      await Promise.all([
        loadDealerDrawerActivity({ force: true, highlightLatest: true }),
        loadDealerLeads({ forceActivity: true, suppressAlerts: true })
      ]);
    } catch (error) {
      completeButton.disabled = false;
      dealerLeadsStatus.textContent = error.message || "Unable to complete task";
    }
    return;
  }

  const statusButton = event.target.closest("[data-drawer-dealer-status]");
  if (statusButton && activeDealerDrawerLeadId) {
    statusButton.disabled = true;
    dealerLeadsStatus.textContent = "Updating lead status...";
    try {
      const response = await fetch("/api/lead-activity", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authSession?.access_token || ""}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          leadId: activeDealerDrawerLeadId,
          action: "status",
          status: statusButton.dataset.drawerDealerStatus || "",
          note: `Dealer updated status to ${String(statusButton.dataset.drawerDealerStatus || "").replaceAll("_", " ")}.`
        })
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Unable to update lead status");
      dealerLeadsStatus.textContent = "Lead status updated.";
      await loadDealerLeads({ forceActivity: true, suppressAlerts: true });
    } catch (error) {
      dealerLeadsStatus.textContent = error.message || "Unable to update lead status";
      statusButton.disabled = false;
    }
    return;
  }

  const followUpButton = event.target.closest("[data-drawer-dealer-follow-up]");
  if (followUpButton && activeDealerDrawerLeadId) {
    followUpButton.disabled = true;
    dealerLeadsStatus.textContent = "Scheduling follow-up...";
    try {
      const followUpAt = dealerFollowUpDate(followUpButton.dataset.drawerDealerFollowUp || "");
      const response = await fetch("/api/leads", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authSession?.access_token || ""}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id: activeDealerDrawerLeadId, nextFollowUpAt: followUpAt })
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Unable to schedule follow-up");
      dealerLeadsStatus.textContent = `Next follow-up scheduled for ${formatDateTime(followUpAt)}.`;
      await loadDealerLeads({ forceActivity: true, suppressAlerts: true });
    } catch (error) {
      dealerLeadsStatus.textContent = error.message || "Unable to schedule follow-up";
      followUpButton.disabled = false;
    }
  }
});

dealerLeadDrawer?.addEventListener("submit", async (event) => {
  const noteForm = event.target.closest(".dealer-drawer-note-form");
  if (noteForm && activeDealerDrawerLeadId) {
    event.preventDefault();
    const payload = {
      leadId: activeDealerDrawerLeadId,
      type: "note",
      ...Object.fromEntries(new FormData(noteForm).entries())
    };
    dealerLeadsStatus.textContent = "Saving note...";
    try {
      const response = await fetch("/api/lead-activity", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authSession?.access_token || ""}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Unable to save follow-up");
      dealerLeadsStatus.textContent = "Note saved.";
      noteForm.reset();
      dealerDrawerActivityLoaded = false;
      await Promise.all([
        loadDealerDrawerActivity({ force: true, highlightLatest: true }),
        loadDealerLeads({ forceActivity: true, suppressAlerts: true })
      ]);
    } catch (error) {
      dealerLeadsStatus.textContent = error.message || "Unable to save follow-up";
    }
    return;
  }

  const taskForm = event.target.closest(".dealer-drawer-task-form");
  if (taskForm && activeDealerDrawerLeadId) {
    event.preventDefault();
    const payload = {
      leadId: activeDealerDrawerLeadId,
      type: "task",
      ...Object.fromEntries(new FormData(taskForm).entries())
    };
    dealerLeadsStatus.textContent = "Saving task...";
    try {
      const response = await fetch("/api/lead-activity", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authSession?.access_token || ""}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Unable to save follow-up");
      dealerLeadsStatus.textContent = "Task saved.";
      taskForm.reset();
      dealerDrawerActivityLoaded = false;
      await Promise.all([
        loadDealerDrawerActivity({ force: true, highlightLatest: true }),
        loadDealerLeads({ forceActivity: true, suppressAlerts: true })
      ]);
    } catch (error) {
      dealerLeadsStatus.textContent = error.message || "Unable to save follow-up";
    }
    return;
  }

  const emailForm = event.target.closest(".dealer-drawer-email-form");
  if (emailForm && activeDealerDrawerLeadId) {
    event.preventDefault();
    const payload = {
      leadId: activeDealerDrawerLeadId,
      type: "email",
      ...Object.fromEntries(new FormData(emailForm).entries())
    };
    dealerLeadsStatus.textContent = "Logging email...";
    try {
      const response = await fetch("/api/lead-activity", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authSession?.access_token || ""}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Unable to log email");
      dealerLeadsStatus.textContent = "Email logged.";
      emailForm.reset();
      const recipient = emailForm.querySelector('input[name="sentTo"]');
      if (recipient) recipient.value = payload.sentTo || "";
      dealerDrawerActivityLoaded = false;
      await Promise.all([
        loadDealerDrawerActivity({ force: true, highlightLatest: true }),
        loadDealerLeads({ forceActivity: true, suppressAlerts: true })
      ]);
    } catch (error) {
      dealerLeadsStatus.textContent = error.message || "Unable to log email";
    }
  }
});

dealerLeadDrawer?.addEventListener("change", async (event) => {
  const deliveryField = event.target.closest("[data-dealer-dealdesk-delivery]");
  if (!deliveryField || !activeDealerDrawerLeadId) return;
  dealerLeadsStatus.textContent = "Saving delivery date...";
  try {
    const response = await fetch("/api/lead-activity", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authSession?.access_token || ""}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        leadId: activeDealerDrawerLeadId,
        type: "deal_desk",
        kind: "delivery",
        deliveryAt: deliveryField.value
      })
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Unable to save delivery date");
    dealerDrawerActivityLoaded = false;
    dealerLeadsStatus.textContent = "Delivery date updated.";
    await Promise.all([
      loadDealerDrawerActivity({ force: true, highlightLatest: true }),
      loadDealerLeads({ forceActivity: true, suppressAlerts: true })
    ]);
  } catch (error) {
    dealerLeadsStatus.textContent = error.message || "Unable to save delivery date";
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeDealerDrawerLeadId) closeDealerDrawer();
});

logoutButton.addEventListener("click", async () => {
  if (supabaseClient) await supabaseClient.auth.signOut();
  setSession(null);
  window.location.replace("/login.html");
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setLookupMode(button.dataset.mode, { openModal: true });
  });
});

searchClose.addEventListener("click", closeSearchModal);
searchBackdrop.addEventListener("click", closeSearchModal);
searchClear.addEventListener("click", () => {
  freeForm.elements.searchText.value = "";
  choiceList.hidden = true;
  inlineChoiceList.hidden = true;
  modalStatus.textContent = "Type a VIN or vehicle description, then press Enter.";
  freeForm.elements.searchText.focus();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !searchModal.hidden) closeSearchModal();
});

freeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireLogin()) return;
  const searchText = new FormData(freeForm).get("searchText");
  const vin = String(searchText || "").trim().toUpperCase();

  if (/^[A-HJ-NPR-Z0-9]{10,17}$/.test(vin)) {
    modalStatus.textContent = "Searching vehicle matches...";
    setValuationFields({ vin, uvc: "", year: "", make: "", model: "", series: "", style: "" });
  } else {
    modalStatus.textContent = "Searching vehicles...";
  }

  choiceList.hidden = true;
  const data = await fetchVehicleChoices(searchText);
  if (!data.ok) {
    modalStatus.textContent = data.error || "Search failed.";
    return;
  }
  renderChoices(data.items || [], { modal: true, selectOnly: true });
});

drilldownForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireLogin()) return;
  const payload = Object.fromEntries(new FormData(drilldownForm).entries());
  const vinSearch = findVinInDrilldownForm(payload);
  if (vinSearch) {
    modalStatus.textContent = "Searching vehicle matches...";
    setValuationFields({ vin: vinSearch, uvc: "", year: "", make: "", model: "", series: "", style: "" });
    await searchVehicleChoices({ vin: vinSearch });
    return;
  }

  const exactVehicle = await findExactDrilldownVehicle(payload);
  if (exactVehicle) {
    setValuationFields({
      vin: form.elements.vin.value || "",
      ...payload,
      year: exactVehicle.year || payload.year || "",
      make: exactVehicle.make || payload.make || "",
      model: exactVehicle.model || payload.model || "",
      series: exactVehicle.series || payload.series || "",
      style: exactVehicle.style || payload.style || "",
      uvc: exactVehicle.uvc || ""
    });
    detailsEl.hidden = true;
    statusEl.textContent = "Vehicle selected. Click Generate to create the valuation.";
    return;
  }
  setValuationFields({ vin: form.elements.vin.value || "", uvc: "", ...payload });
  await searchVehicleChoices(payload);
});

drilldownForm.querySelectorAll(".drill-select").forEach((select) => {
  select.addEventListener("change", () => handleDrillSelect(select));
});

drilldownForm.querySelectorAll(".manual-input").forEach((input) => {
  input.addEventListener("input", async () => {
    drilldownForm.elements[input.dataset.field].value = input.value;
    if (isVinLike(cleanVinText(input.value))) return;
    if (input.dataset.field === "make" || input.dataset.field === "model") await updateVehicleDropdowns(input.dataset.field);
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await runValuation();
});

async function runValuation(extra = {}, options = {}) {
  if (!requireLogin()) return;
  if (!usageState) await loadUsage();
  if (!canUseValuation()) return;
  hideDealerSaveOption();
  statusEl.textContent = "Calling valuation API...";

  const formData = new FormData(form);
  const payload = {
    ...Object.fromEntries(formData.entries()),
    ...extra,
    authUserId: authSession?.user?.id || "",
    authEmail: authSession?.user?.email || ""
  };
  if (dealerAdminAllowed) {
    payload.leadSource = payload.leadSource || "dealer_appraisal";
    payload.createdByDealer = true;
    payload.dealerEmail = authSession?.user?.email || "";
  }

  if (!payload.vin && !payload.uvc && payload.year && payload.make && (!payload.model || payload.model === unknownOption)) {
    statusEl.textContent = "Choose a model first, or use Find to search matching vehicles.";
    await searchVehicleChoices(payload);
    return;
  }

  if (!payload.vin && !payload.uvc && payload.year && payload.make && payload.model && payload.model !== unknownOption) {
    const exactVehicle = await findExactDrilldownVehicle(payload);
    if (exactVehicle?.uvc) payload.uvc = exactVehicle.uvc;
  }

  try {
    const response = await fetch("/api/valuation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!data.ok) {
      statusEl.textContent = data.error || "API request failed.";
      console.error(data);
      return;
    }

    if (data.choices?.length > 1 && !payload.uvc) {
      const message = payload.vin
        ? "This VIN can match more than one trim. Choose the closest vehicle."
        : "Multiple matches found. Choose the correct trim.";
      statusEl.textContent = message;
      modalStatus.textContent = message;
      renderChoices(data.choices, { modal: Boolean(options.choicesInModal) });
      return;
    }

    currentResult = data;
    currentMarket = firstAvailableMarket(data) || "wholesale";
    renderResult(data);
    closeSearchModal();
    if (dealerAdminAllowed) {
      pendingDealerLeadCapture = { payload, valuation: data };
      if (saveValuationLeadButton) saveValuationLeadButton.hidden = false;
      statusEl.textContent = "Valuation rendered. Click Save valuation to leads if this should be kept for follow-up.";
      return;
    }

    const capture = await captureLead(payload, data);
    await loadUsage();
    if (capture?.captured) {
      statusEl.textContent = data.source === "mock"
        ? "Rendered with mock data and lead captured."
        : "Rendered from Black Book API and lead captured.";
      await loadHistory();
    } else {
      statusEl.textContent = capture?.message || "Rendered, but lead storage is not configured yet.";
    }
  } catch (error) {
    statusEl.textContent = error.message || "Unexpected error.";
  }
}

async function savePendingDealerLead() {
  if (!pendingDealerLeadCapture) {
    statusEl.textContent = "No valuation is ready to save yet.";
    return;
  }

  saveValuationLeadButton.disabled = true;
  statusEl.textContent = "Saving valuation to leads...";
  try {
    const capture = await captureLead(pendingDealerLeadCapture.payload, pendingDealerLeadCapture.valuation);
    await loadUsage();
    if (capture?.captured) {
      statusEl.textContent = "Valuation saved to captured leads.";
      pendingDealerLeadCapture = null;
      if (saveValuationLeadButton) saveValuationLeadButton.hidden = true;
      await loadHistory();
      if (dealerAdminAllowed) await loadDealerLeads();
    } else {
      statusEl.textContent = capture?.message || "Valuation rendered, but lead storage is not configured yet.";
    }
  } catch (error) {
    statusEl.textContent = error.message || "Unable to save valuation to leads.";
  } finally {
    saveValuationLeadButton.disabled = false;
  }
}

function hideDealerSaveOption() {
  pendingDealerLeadCapture = null;
  if (saveValuationLeadButton) {
    saveValuationLeadButton.hidden = true;
    saveValuationLeadButton.disabled = false;
  }
}

async function searchVehicleChoices(payload) {
  const searchText = vehicleSearchText(payload);
  if (!searchText) {
    statusEl.textContent = "Choose at least year and make, or enter a VIN.";
    return;
  }

  statusEl.textContent = "Searching matching vehicles...";
  detailsEl.hidden = true;
  choiceList.hidden = true;
  inlineChoiceList.hidden = true;

  try {
    const data = await fetchVehicleChoices(searchText);
    if (!data.ok) {
      statusEl.textContent = data.error || "Search failed.";
      console.error(data);
      return;
    }

    renderChoices(data.items || [], { modal: true, selectOnly: true });
    statusEl.textContent = data.items?.length
      ? "Choose the closest vehicle, then click Generate to create the valuation."
      : "No matching vehicles found. Try another model, series, or style.";
  } catch (error) {
    statusEl.textContent = error.message || "Search failed.";
  }
}

async function fetchVehicleChoices(searchText) {
  const primary = await fetchAutocomplete(searchText);
  if (primary.items?.length || !needsSeriesFallback(searchText)) return primary;

  const fallbackText = simplifySeriesName(searchText);
  const fallback = await fetchAutocomplete(fallbackText);
  return fallback.items?.length ? fallback : primary;
}

async function fetchAutocomplete(searchText) {
  const response = await fetch(`/api/autocomplete?searchText=${encodeURIComponent(searchText)}`);
  return response.json();
}

function needsSeriesFallback(searchText) {
  return /-Series\b/i.test(String(searchText || ""));
}

function simplifySeriesName(searchText) {
  return String(searchText || "").replace(/-Series\b/gi, "").replace(/\s+/g, " ").trim();
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    currentMarket = tab.dataset.market;
    tabs.forEach((item) => item.classList.toggle("active", item === tab));
    renderTable();
  });
});

function renderResult(data) {
  choiceList.hidden = true;
  inlineChoiceList.hidden = true;
  detailsEl.hidden = false;
  document.querySelector("#vehicle-title").textContent = data.title;
  document.querySelector("#vehicle-vin").textContent = data.vin;
  document.querySelector("#vehicle-km").textContent = formatNumber(data.kilometers);
  document.querySelector("#vehicle-region").textContent = data.region;
  document.querySelector("#vehicle-options").textContent = `${data.optionsSelected || 0} selected`;
  document.querySelector("#vehicle-color").textContent = data.input?.color || "Not provided";
  document.querySelector("#threshold-json").textContent = JSON.stringify(data.thresholds || {}, null, 2);
  document.querySelector("#loan-value").textContent = data.loanValue
    ? `Loan Value: ${formatNumber(data.loanValue)}`
    : "";

  renderTabs(data);
  renderTable();
  detailsEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderChoices(items, options = {}) {
  const useModal = options.modal !== false;
  const selectOnly = Boolean(options.selectOnly);
  const target = useModal ? choiceList : inlineChoiceList;
  const other = useModal ? inlineChoiceList : choiceList;

  if (useModal) openSearchModal(false);
  if (other) {
    other.hidden = true;
    other.innerHTML = "";
  }

  detailsEl.hidden = true;
  if (!items.length) {
    target.hidden = false;
    target.innerHTML = `
      <p>No vehicle matches found.</p>
      <p class="hint">Try a more specific description like "2024 Lexus NX350", or enter a full VIN and click Generate.</p>
    `;
    statusEl.textContent = "No matches.";
    modalStatus.textContent = "No matches found.";
    return;
  }

  target.hidden = false;
  modalStatus.textContent = "";
  const currentVin = form.elements.vin.value || "";
  target.innerHTML = `
    <div class="choice-grid">
      ${items.map((item, index) => `
        <button type="button" class="choice-card" data-index="${index}">
          <strong>${escapeHtml(item.title || "Vehicle match")}</strong>
          <span>${[
            item.uvc ? `UVC ${item.uvc}` : "",
            item.adjustedWholesaleAvg ? `AVG Wholesale ${formatNumber(item.adjustedWholesaleAvg)}` : "",
            item.adjustedRetailAvg ? `AVG Retail ${formatNumber(item.adjustedRetailAvg)}` : ""
          ].filter(Boolean).join(" · ")}</span>
        </button>
      `).join("")}
    </div>
  `;

  target.querySelectorAll(".choice-card").forEach((button) => {
    button.addEventListener("click", async () => {
      const item = items[Number(button.dataset.index)];
      setValuationFields({
        vin: currentVin,
        uvc: item.uvc || "",
        year: item.year || "",
        make: item.make || "",
        model: item.model || "",
        series: item.series || "",
        style: item.style || ""
      });
      showValuationFormForCurrentSelection();
      target.hidden = true;
      if (selectOnly) {
        closeSearchModal();
        detailsEl.hidden = true;
        statusEl.textContent = "Vehicle selected. Click Generate to create the valuation.";
        return;
      }
      await runValuation({ vin: currentVin, uvc: item.uvc || "" });
    });
  });
}

function openSearchModal(focusInput = true) {
  searchModal.hidden = false;
  document.body.classList.add("modal-open");
  if (focusInput) freeForm.elements.searchText.focus();
}

function closeSearchModal() {
  searchModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function setValuationFields(values) {
  for (const [key, value] of Object.entries(values)) {
    const field = form.elements[key];
    if (field) field.value = value === unknownOption ? "" : value ?? "";
  }
  setDrilldownFields(values);
}

function setLookupMode(mode, options = {}) {
  currentLookupMode = mode === "drilldown" ? "drilldown" : "free";
  modeButtons.forEach((item) => item.classList.toggle("active", item.dataset.mode === currentLookupMode));
  if (currentLookupMode === "free" && options.openModal) openSearchModal();
  drilldownForm.hidden = currentLookupMode !== "drilldown";
  form.hidden = currentLookupMode === "free" && !options.showValuation;
  if (lookupPanel) lookupPanel.hidden = currentLookupMode === "free" && !options.showValuation;
}

function showValuationFormForCurrentSelection() {
  if (currentLookupMode === "free") {
    form.hidden = false;
    if (lookupPanel) lookupPanel.hidden = false;
  }
}

function setDrilldownFields(values) {
  if (!drilldownForm) return;
  for (const key of ["year", "make", "model", "series", "style"]) {
    if (!(key in values)) continue;
    const value = values[key] === unknownOption ? "" : String(values[key] ?? "").trim();
    const hidden = drilldownForm.elements[key];
    const select = drilldownForm.querySelector(`.drill-select[data-field="${key}"]`);
    const manual = drilldownForm.querySelector(`.manual-input[data-field="${key}"]`);
    if (!hidden || !select || !manual) continue;

    if (!value) {
      hidden.value = "";
      if ([...select.options].some((option) => option.value === unknownOption)) {
        select.value = unknownOption;
      }
      manual.hidden = true;
      manual.value = "";
      continue;
    }

    const options = [...select.options].map((option) => option.value);
    if (!options.includes(value)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      const manualOption = [...select.options].find((item) => item.value === "__manual__");
      select.insertBefore(option, manualOption || null);
    }

    select.value = value;
    manual.hidden = true;
    manual.value = "";
    hidden.value = value;
  }
}

function vehicleSearchText(payload) {
  const vin = cleanVinText(payload.vin);
  if (isVinLike(vin)) return vin;

  return ["year", "make", "model", "series", "style"]
    .map((key) => String(payload[key] || "").trim())
    .filter((value) => value && value !== unknownOption)
    .join(" ");
}

function findVinInPayload(payload) {
  for (const value of Object.values(payload)) {
    const vin = cleanVinText(value);
    if (isVinLike(vin)) return vin;
  }
  return "";
}

function findVinInDrilldownForm(payload) {
  const values = [
    ...Object.values(payload),
    ...[...drilldownForm.querySelectorAll(".manual-input, .drill-select")]
      .map((field) => field.value)
  ];

  for (const value of values) {
    const vin = cleanVinText(value);
    if (isVinLike(vin)) return vin;
  }
  return "";
}

function cleanVinText(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isVinLike(value) {
  return /^[A-HJ-NPR-Z0-9]{10,17}$/.test(String(value || ""));
}

async function initializeDatalists() {
  setSelectOptions("year", Array.from({ length: 47 }, (_, index) => String(2027 - index)), "2024");
  setSelectOptions("make", commonMakes, "Lexus");
  setSelectOptions("model", ["Not sure", ...Object.values(drilldownSuggestions).flatMap((item) => item.models)], "Not sure");
  setSelectOptions("series", ["Not sure"], "Not sure");
  setSelectOptions("style", ["Not sure"], "Not sure");
  await updateVehicleDropdowns("init");
}

async function updateVehicleDropdowns(changedField = "") {
  const requestId = ++drilldownRequestId;
  const year = drilldownForm.elements.year.value.trim();
  const make = drilldownForm.elements.make.value.trim();
  const model = drilldownForm.elements.model.value.trim();
  const makeData = drilldownSuggestions[make];
  const shouldResetModel = changedField === "year" || changedField === "make";
  const shouldResetDetails = shouldResetModel || changedField === "model";

  if (changedField === "year") {
    setSelectOptions("make", commonMakes, "");
    setSelectOptions("model", ["Not sure"], "Not sure");
    setSelectOptions("series", ["Not sure"], "Not sure");
    setSelectOptions("style", ["Not sure"], "Not sure");
  } else if (shouldResetModel) {
    setSelectOptions("model", ["Not sure"], "Not sure");
    setSelectOptions("series", ["Not sure"], "Not sure");
    setSelectOptions("style", ["Not sure"], "Not sure");
  } else if (shouldResetDetails) {
    setSelectOptions("series", ["Not sure"], "Not sure");
    setSelectOptions("style", ["Not sure"], "Not sure");
  }

  if (!year) return;

  const drilldown = await fetchDrilldown({
    year,
    make: changedField === "year" ? "" : make,
    model: shouldResetModel ? "" : model
  });
  if (requestId !== drilldownRequestId || !drilldown.ok) return;

  if (drilldown.makes?.length) {
    setSelectOptions("make", drilldown.makes, drilldown.makes.includes(make) ? make : drilldown.makes[0]);
  }

  const activeMake = drilldownForm.elements.make.value.trim();
  const localModels = drilldownSuggestions[activeMake]?.models || [];
  const modelOptions = drilldown.models?.length ? drilldown.models : localModels;
  if (modelOptions.length) {
    const selectedModel = shouldResetModel ? "Not sure" : drilldownForm.elements.model.value || "Not sure";
    setSelectOptions("model", modelOptions, selectedModel);
  }

  const activeModel = drilldownForm.elements.model.value.trim();
  const localSeries = drilldownSuggestions[activeMake]?.series?.[activeModel] || [];
  const localStyles = drilldownSuggestions[activeMake]?.styles?.[activeModel] || [];
  const seriesOptions = drilldown.series?.length ? drilldown.series : localSeries;
  const styleOptions = drilldown.styles?.length ? drilldown.styles : localStyles.length ? localStyles : commonStyles;
  setSelectOptions("series", seriesOptions.length ? seriesOptions : ["Not sure"], shouldResetDetails ? "Not sure" : drilldownForm.elements.series.value || "Not sure");
  setSelectOptions("style", styleOptions.length ? styleOptions : ["Not sure"], shouldResetDetails ? "Not sure" : drilldownForm.elements.style.value || "Not sure");
}

async function fetchDrilldown(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value !== unknownOption) query.set(key, value);
  }
  const response = await fetch(`/api/drilldown?${query.toString()}`);
  return response.json();
}

async function findExactDrilldownVehicle(payload) {
  if (!payload.year || !payload.make || !payload.model || payload.model === unknownOption) return null;
  const data = await fetchDrilldown(payload);
  if (!data.ok || !data.vehicles?.length) return null;

  const series = String(payload.series || "").trim();
  const style = String(payload.style || "").trim();
  const exactMatches = data.vehicles.filter((vehicle) =>
    (!series || series === unknownOption || vehicle.series === series) &&
    (!style || style === unknownOption || vehicle.style === style)
  );
  return exactMatches.length === 1 ? exactMatches[0] : null;
}

function setSelectOptions(field, values, selectedValue = "") {
  const select = drilldownForm.querySelector(`.drill-select[data-field="${field}"]`);
  const manual = drilldownForm.querySelector(`.manual-input[data-field="${field}"]`);
  const hidden = drilldownForm.elements[field];
  const unique = [...new Set(values.filter(Boolean))];
  const withUnknown = ["model", "series", "style"].includes(field)
    ? [unknownOption, ...unique.filter((value) => value !== unknownOption)]
    : unique;
  const hasSelected = withUnknown.includes(selectedValue);
  select.innerHTML = [
    ...withUnknown.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`),
    `<option value="__manual__">Manual / Other...</option>`
  ].join("");

  if (hasSelected) {
    select.value = selectedValue;
    manual.hidden = true;
    manual.value = "";
    hidden.value = selectedValue;
  } else if (selectedValue) {
    select.value = "__manual__";
    manual.hidden = false;
    manual.value = selectedValue;
    hidden.value = selectedValue;
  } else {
    select.value = withUnknown[0] || "__manual__";
    manual.hidden = select.value !== "__manual__";
    hidden.value = withUnknown[0] || "";
  }
}

async function handleDrillSelect(select) {
  const field = select.dataset.field;
  const manual = drilldownForm.querySelector(`.manual-input[data-field="${field}"]`);
  const hidden = drilldownForm.elements[field];

  if (select.value === "__manual__") {
    manual.hidden = false;
    manual.focus();
    hidden.value = manual.value;
  } else {
    manual.hidden = true;
    manual.value = "";
    hidden.value = select.value;
  }

  if (field === "year" || field === "make" || field === "model") await updateVehicleDropdowns(field);
}

function renderTable() {
  if (!currentResult) return;
  const marketData = currentResult.values[currentMarket] || {};
  const rows = [
    ["Base", "base"],
    ["Options", "options"],
    ["Mileage", "mileage"],
    ["Region", "region"],
    ["Adjusted", "adjusted"]
  ];
  const conditions = ["xclean", "clean", "avg", "rough"];

  document.querySelector("#active-market-label").textContent = averageMarketLabel(currentMarket, marketData);

  valueBody.innerHTML = rows.map(([label, key]) => {
    const cells = conditions.map((condition) => {
      const value = marketData[key]?.[condition];
      return `<td>${formatValue(value, key)}</td>`;
    }).join("");
    return `<tr class="${key === "adjusted" ? "adjusted" : ""}"><td>${label}</td>${cells}</tr>`;
  }).join("");
}

function renderTabs(data) {
  tabs.forEach((item) => {
    const available = marketHasValues(data.values[item.dataset.market]);
    item.hidden = !available;
    item.disabled = !available;
    item.classList.toggle("active", item.dataset.market === currentMarket);
  });
}

function firstAvailableMarket(data) {
  return ["wholesale", "retail", "tradeIn"].find((market) => marketHasValues(data.values?.[market]));
}

function marketHasValues(marketData) {
  if (!marketData) return false;
  return Object.values(marketData).some((row) =>
    Object.values(row || {}).some((value) => value !== null && value !== undefined)
  );
}

function marketLabel(value) {
  if (value === "tradeIn") return "Trade-In";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function averageMarketLabel(market, marketData) {
  const avgValue = marketData.adjusted?.avg ?? marketData.base?.avg;
  const label = `AVG ${marketLabel(market).toUpperCase()}`;
  return avgValue === null || avgValue === undefined
    ? label
    : `${label} ${formatNumber(avgValue)}`;
}

function formatValue(value, rowKey) {
  if (value === null || value === undefined) return rowKey === "options" ? "N/A" : "-";
  if (rowKey === "options" && Number(value) === 0) return "N/A";
  return formatNumber(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(Number(value));
}

async function captureLead(input, valuation) {
  try {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input,
        valuation,
        user: {
          id: authSession?.user?.id || "",
          email: authSession?.user?.email || "",
          name: authSession?.user?.user_metadata?.full_name || authSession?.user?.user_metadata?.name || ""
        }
      })
    });
    return response.json();
  } catch (error) {
    console.warn("Lead capture failed", error);
    return { ok: false, captured: false, message: error.message || "Lead capture failed." };
  }
}

async function initializeAuth() {
  const config = await fetch("/api/config").then((res) => res.json()).catch(() => ({}));
  if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) {
    authTitle.textContent = "Demo mode";
    authSubtitle.textContent = "Supabase Google login is not configured yet.";
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
  if (window.location.hash.includes("access_token")) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  setSession(data.session);
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    setSession(session);
    if (!session?.user) window.location.replace("/login.html?next=/dealer.html");
  });
}

async function setSession(session) {
  authSession = session;
  const emailField = form.elements.email;
  dealerAdminAllowed = false;
  stopDealerAutoRefresh();

  if (session?.user) {
    const email = session.user.email || "";
    if (dealerWorkbench) dealerWorkbench.hidden = false;
    authTitle.textContent = `Signed in as ${email}`;
    logoutButton.hidden = false;
    emailField.value = email;
    const dealer = await checkDealerAccess();
    if (!dealer.ok) {
      authTitle.textContent = "Dealer access denied";
      authSubtitle.textContent = dealer.error || `This Google account is not allowed: ${email}`;
      disableDealerTools(true);
      quotaPanel.hidden = true;
      historyPanel.hidden = true;
      if (dealerLeadsList) dealerLeadsList.innerHTML = "";
      if (dealerLeadsStatus) dealerLeadsStatus.textContent = dealer.error || "Dealer access denied.";
      statusEl.textContent = "Ask the site owner to add this email in Admin > Dealer portal access.";
      return;
    }
    dealerAdminAllowed = true;
    authSubtitle.textContent = "Dealer access confirmed. Dealer tools are available.";
    disableDealerTools(false);
    await loadDealerDirectory();
    loadUsage();
    loadHistory();
    loadDealerLeads({ forceActivity: true, suppressAlerts: true });
    startDealerAutoRefresh();
  } else {
    closeDealerDrawer();
    if (supabaseClient) {
      window.location.replace("/login.html?next=/dealer.html");
      return;
    }
    authTitle.textContent = "Login not configured";
    authSubtitle.textContent = "Add Supabase environment variables to enable Google login.";
    logoutButton.hidden = true;
    quotaPanel.hidden = true;
    historyPanel.hidden = true;
    if (dealerWorkbench) dealerWorkbench.hidden = true;
    historyList.innerHTML = "";
    if (dealerLeadsList) dealerLeadsList.innerHTML = "";
    historyLeads = [];
    emailField.value = "";
    disableDealerTools(true);
  }
}

function requireLogin() {
  if (authSession?.user && dealerAdminAllowed) return true;
  if (!supabaseClient) {
    statusEl.textContent = "Supabase Google login is not configured yet. Add Supabase env vars to enable this flow.";
  } else if (authSession?.user && !dealerAdminAllowed) {
    statusEl.textContent = "Dealer access is restricted to approved dealer emails.";
  } else {
    statusEl.textContent = "Please sign in with Google first.";
  }
  return false;
}

async function checkDealerAccess() {
  try {
    const response = await fetch("/api/dealer-check", {
      headers: {
        Authorization: `Bearer ${authSession?.access_token || ""}`
      }
    });
    return response.json();
  } catch (error) {
    return { ok: false, error: error.message || "Unable to verify dealer access." };
  }
}

async function loadDealerDirectory() {
  dealerDirectoryEmails = [];
  if (!authSession?.access_token) return;
  try {
    const response = await fetch("/api/dealer-directory", {
      headers: {
        Authorization: `Bearer ${authSession.access_token}`
      }
    });
    const data = await response.json();
    if (data.ok) dealerDirectoryEmails = Array.isArray(data.emails) ? data.emails : [];
  } catch {
    dealerDirectoryEmails = [];
  }
}

function disableDealerTools(disabled) {
  [form, freeForm, drilldownForm].forEach((item) => {
    item.querySelectorAll("input, select, button").forEach((control) => {
      control.disabled = disabled;
    });
  });
  modeButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

async function loadUsage() {
  if (!authSession?.user) return;

  const userId = encodeURIComponent(authSession.user.id || "");
  const email = encodeURIComponent(authSession.user.email || "");
  quotaPanel.hidden = false;
  quotaTitle.textContent = "Checking...";
  quotaSubtitle.textContent = "";

  try {
    const response = await fetch(`/api/usage?userId=${userId}&email=${email}`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Unable to load usage");

    usageState = data;
    if (data.unlimited || Number(data.annualLimit) < 0) {
      quotaTitle.textContent = "Unlimited";
      quotaSubtitle.textContent = `${data.used} used in ${data.year}`;
    } else {
      quotaTitle.textContent = `${data.remaining} left`;
      quotaSubtitle.textContent = `${data.used} used of ${data.annualLimit} in ${data.year}`;
    }
  } catch (error) {
    usageState = null;
    quotaTitle.textContent = "Unavailable";
    quotaSubtitle.textContent = error.message || "Unable to load usage";
  }
  return usageState;
}

async function loadHistory() {
  if (!authSession?.access_token) return;

  historyPanel.hidden = false;
  historyStatus.textContent = "Loading quote history...";

  try {
    const response = await fetch("/api/my-leads", {
      headers: {
        Authorization: `Bearer ${authSession.access_token}`
      }
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Unable to load quote history");

    historyLeads = data.leads || [];
    renderHistory(historyLeads);
  } catch (error) {
    historyStatus.textContent = error.message || "Unable to load quote history";
    historyList.innerHTML = "";
  }
}

async function loadDealerLeads(options = {}) {
  if (!authSession?.access_token || !dealerWorkbench) return;

  dealerWorkbench.hidden = false;
  dealerLeadsStatus.textContent = "Loading assigned leads...";

  try {
    const response = await fetch("/api/dealer-leads", {
      headers: {
        Authorization: `Bearer ${authSession.access_token}`
      }
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Unable to load assigned leads");

    dealerLeadsCache = data.leads || [];
    dealerLeadRole = data.role || "dealer";
    if (options.suppressAlerts) rememberDealerLeadTokens(dealerLeadsCache);
    else collectDealerLeadAlerts(dealerLeadsCache);
    renderDealerLeads(dealerLeadsCache, dealerLeadRole);
    renderDealerLeadAlerts();
    renderDealerTodayWork(dealerLeadsCache);
  } catch (error) {
    dealerLeadsStatus.textContent = error.message || "Unable to load assigned leads";
    dealerLeadsList.innerHTML = "";
  }
}

function collectDealerLeadAlerts(leads) {
  const readTokens = loadDealerLeadReadTokens();
  let changed = false;
  for (const lead of leads) {
    const id = String(lead.id || "");
    if (!id) continue;
    const token = dealerLeadUpdateToken(lead);
    if (lead.vehicle_signal?.message) {
      dealerLeadAlertMap.set(id, {
        id,
        type: lead.vehicle_signal.tone === "danger" ? "owner" : "updated",
        title: dealerLeadAlertTitle(lead),
        message: lead.vehicle_signal.message
      });
    } else if (readTokens[id] && readTokens[id] !== token) {
      dealerLeadAlertMap.set(id, {
        id,
        type: "updated",
        title: dealerLeadAlertTitle(lead),
        message: "Lead changed since you last opened it"
      });
    } else if (!readTokens[id]) {
      readTokens[id] = token;
      changed = true;
    }
  }
  if (changed) saveDealerLeadReadTokens(readTokens);
}

function dealerVehicleSignalInline(lead) {
  const signal = lead?.vehicle_signal;
  if (!signal?.message) return "";
  const tone = ["danger", "warning", "info"].includes(String(signal.tone || "").toLowerCase()) ? String(signal.tone).toLowerCase() : "warning";
  return `<p class="lead-vehicle-signal lead-vehicle-signal-${escapeHtml(tone)}">${escapeHtml(signal.message)}</p>`;
}

function dealerVehicleContextInline(lead) {
  const context = lead?.vehicle_context;
  if (!context) return "";
  const pills = [];
  if (context.active_buyer_count > 0) pills.push(`${context.active_buyer_count} active buyer lead${context.active_buyer_count === 1 ? "" : "s"}`);
  if (context.has_active_offer) pills.push("offer active");
  if (context.sold_elsewhere) pills.push("vehicle sold");
  if (context.off_market) pills.push("off market");
  if (context.primary_inventory_status) pills.push(`warehouse ${String(context.primary_inventory_status).replaceAll("_", " ")}`);
  if (!pills.length && !context.related_lead_count) return "";
  return `
    <section class="lead-vehicle-context">
      <span>Vehicle cluster</span>
      <strong>${escapeHtml(context.cluster_label || "Same vehicle activity")}</strong>
      <small>${escapeHtml(pills.join(" | ") || "Related vehicle activity found.")}</small>
    </section>
  `;
}

function rememberDealerLeadTokens(leads) {
  const readTokens = loadDealerLeadReadTokens();
  let changed = false;
  for (const lead of leads) {
    const id = String(lead.id || "");
    if (!id) continue;
    readTokens[id] = dealerLeadUpdateToken(lead);
    dealerLeadAlertMap.delete(id);
    changed = true;
  }
  if (changed) saveDealerLeadReadTokens(readTokens);
}

function loadDealerLeadReadTokens() {
  try {
    return JSON.parse(window.localStorage.getItem(dealerLeadReadTokensKey()) || "{}") || {};
  } catch {
    return {};
  }
}

function saveDealerLeadReadTokens(tokens) {
  try {
    window.localStorage.setItem(dealerLeadReadTokensKey(), JSON.stringify(tokens || {}));
  } catch {
    // localStorage is best-effort. Alerts will still work during the current session.
  }
}

function dealerLeadReadTokensKey() {
  const email = String(authSession?.user?.email || "unknown").trim().toLowerCase();
  return `${DEALER_LEAD_READ_TOKENS_KEY}:${email}`;
}

function markDealerLeadTokenRead(id) {
  const lead = dealerLeadsCache.find((item) => String(item.id || "") === String(id || ""));
  if (!lead) return;
  const readTokens = loadDealerLeadReadTokens();
  readTokens[String(id)] = dealerLeadUpdateToken(lead);
  saveDealerLeadReadTokens(readTokens);
}

function renderDealerLeads(leads, role) {
  if (!leads.length) {
    dealerLeadsStatus.textContent = role === "admin"
      ? "No active leads yet."
      : "No leads assigned to you yet.";
    dealerLeadsList.innerHTML = "";
    return;
  }

  const visibleLeads = sortDealerLeads(filterDealerLeads(leads));
  if (!visibleLeads.length) {
    dealerLeadsStatus.textContent = `No ${dealerLeadFilter.replace("-", " ")} leads in this view.`;
    dealerLeadsList.innerHTML = "";
    return;
  }

  const activeCount = leads.filter((lead) => !isDealerClosedLead(lead)).length;
  const closedCount = leads.length - activeCount;
  const sortLabel = dealerLeadSort === "oldest" ? "Oldest first" : "Newest first";
  dealerLeadsStatus.textContent = `${visibleLeads.length} shown. ${activeCount} active / ${closedCount} closed assigned lead${leads.length === 1 ? "" : "s"}. Sort: ${sortLabel}, with urgent, overdue, and new pinned first.`;
  dealerLeadsList.innerHTML = renderDealerLeadGroups(visibleLeads, (lead, index) => {
    const input = lead.input || {};
    const valuation = lead.valuation || {};
    const buyerLead = isBuyerLead(lead);
    const leadKind = buyerLead ? "buyer" : "seller";
    const leadTypeLabel = buyerLead ? "BUY lead" : "SELL lead";
    const sourceLabel = dealerLeadSourceLabel(lead);
    const purchase = input.buyerPlan || valuation.buyerPlan || {};
    const title = cleanDealerLeadTitle(valuation.title || historyVehicleTitle(input) || "Vehicle lead", buyerLead);
    const customerName = input.ownerName || input.name || "";
    const dealerCreated = sourceLabel === "Dealer appraisal";
    const customerEmail = input.email || (dealerCreated ? "" : lead.auth_email || lead.auth_user?.email) || "-";
    const customerPhone = input.phone || "No phone";
    const followUp = lead.next_follow_up_at || "";
    const lastActivity = lead.last_activity_at || "";
    const status = lead.status || "new";
    const closedLead = isDealerClosedLead(lead);
    const dueNow = !closedLead && isDealerLeadDueNow(followUp, status);
    const overdue = isDealerLeadOverdue(followUp, status);
    const statusLabel = overdue ? "Overdue" : dueNow ? "Due today" : status.replaceAll("_", " ");
    const statusClass = overdue ? "status-overdue" : dueNow ? "status-due" : `status-${cssToken(status)}`;
    const pendingAlert = dealerLeadAlertMap.has(String(lead.id || ""));
    const wholesaleAvg = historyMarketAverage(valuation, "wholesale");
    const retailAvg = historyMarketAverage(valuation, "retail");
    const dealerWholesale = ownerAdjustment.wholesale ?? "";
    const dealerRetail = ownerAdjustment.retail ?? "";
    const updateToken = dealerLeadUpdateToken(lead);
    const vehicleContext = lead.vehicle_context || {};
    const taskSummary = lead.task_summary || {};
    const hasOpenTask = hasDealerOpenTask(lead);
    const taskDue = taskSummary.latest_open_due_at || "";
    const taskSummaryText = hasOpenTask
      ? `${taskSummary.latest_open_title || "Open task"}${taskDue ? ` due ${formatDateTime(taskDue)}` : ""}`
      : "";
    const nextStepSummary = hasOpenTask
      ? taskSummaryText
      : overdue
      ? "Follow-up overdue"
      : followUp
        ? `Next follow-up ${formatDateTime(followUp)}`
        : String(status || "").toLowerCase() === "new"
          ? "New lead waiting for first response"
          : "No next follow-up scheduled";
    const vehicleSummary = vehicleContext.primary_inventory_status
      ? `Warehouse ${String(vehicleContext.primary_inventory_status).replaceAll("_", " ")}`
      : vehicleContext.sold_elsewhere
        ? "Vehicle already sold"
        : vehicleContext.off_market
          ? "Vehicle off market"
          : buyerLead
            ? "Buyer opportunity"
            : "Seller appraisal";
    const customerSummary = customerName || input.phone || customerEmail;
    const progressSummary = leadStatusLabel(status, buyerLead);
    const nextAction = dealerNextBestAction(lead);
    const compactTouchSummary = isDealerNoResponseLead(lead) ? "No response 48h+" : (dealerOutboundLabel(lead) || dealerLastTouchLabel(lead));

    return `
      <article class="history-card dealer-lead-card dealer-lead-${leadKind} dealer-lead-card-alt-${index % 2 === 0 ? "even" : "odd"} ${String(lead.priority || "").toLowerCase() === "urgent" ? "dealer-lead-card-urgent" : ""} ${overdue ? "lead-overdue" : ""} ${pendingAlert ? "dealer-lead-updated" : ""}" data-lead-id="${escapeHtml(lead.id || "")}" data-update-token="${escapeHtml(updateToken)}">
        <section class="lead-list-row dealer-list-row">
          <div class="lead-list-col lead-list-col-main">
            <div class="dealer-lead-title">
              <b class="dealer-type-pill dealer-type-${leadKind}">${escapeHtml(leadTypeLabel)}</b>
              <b class="lead-source-pill">${escapeHtml(sourceLabel)}</b>
              <strong>${escapeHtml(title)}</strong>
            </div>
            <div class="lead-list-subline">
              <span>${escapeHtml(formatDateTime(lead.created_at))}</span>
              <span>${escapeHtml(lead.priority || "normal")}</span>
              ${hasOpenTask ? `<span>${escapeHtml(`${taskSummary.open_count} open task${Number(taskSummary.open_count) === 1 ? "" : "s"}`)}</span>` : ""}
              <span>${escapeHtml(statusLabel)}</span>
            </div>
          </div>
          <div class="lead-list-col">
            <strong>${escapeHtml(customerSummary)}</strong>
            <div class="lead-list-subline">
              ${customerName && customerEmail !== "-" ? `<span>${escapeHtml(customerEmail)}</span>` : ""}
              <span>${escapeHtml(customerPhone)}</span>
              <span>${escapeHtml(lead.assigned_to || "Assigned lead")}</span>
            </div>
          </div>
          <div class="lead-list-col">
            <strong>${escapeHtml(vehicleSummary)}</strong>
            <div class="lead-list-subline">
              <span>${escapeHtml(vehicleContext.cluster_label || `VIN ${valuation.vin || input.vin || "-"}`)}</span>
              <span>${escapeHtml(buyerLead ? (purchase.intent || input.purchaseIntent || "Buyer") : (wholesaleAvg ? `W ${formatNumber(wholesaleAvg)}` : "Seller"))}</span>
              <span>${escapeHtml(!buyerLead && retailAvg ? `R ${formatNumber(retailAvg)}` : buyerLead && (purchase.monthlyPayment || retailAvg) ? `Budget ${purchase.monthlyPayment ? `${formatNumber(purchase.monthlyPayment)}/mo` : formatNumber(retailAvg)}` : "-")}</span>
            </div>
          </div>
          <div class="lead-list-col">
            <strong>${escapeHtml(nextStepSummary)}</strong>
            <div class="lead-list-subline">
              <span>${escapeHtml(hasOpenTask ? "Task assigned" : overdue ? "Overdue" : followUp ? "Scheduled" : "Unscheduled")}</span>
              <span>${escapeHtml(lead.assigned_to || "Assigned")}</span>
            </div>
          </div>
          <div class="lead-list-col">
            <strong>${escapeHtml(progressSummary)}</strong>
            <div class="lead-list-subline">
              <span>${escapeHtml(lastActivity ? `Last activity ${formatDateTime(lastActivity)}` : "No recent activity")}</span>
            </div>
          </div>
          <div class="lead-list-col lead-list-col-actions">
            <div class="lead-quick-strip dealer-quick-strip" aria-label="Dealer quick actions">
              <button type="button" class="lead-quick-button lead-quick-button-primary" data-dealer-open-workspace>Open workspace</button>
              <button type="button" class="lead-quick-button" data-dealer-focus-note="call">Log call</button>
              <button type="button" class="lead-quick-button" data-dealer-focus-note="sms">Text</button>
              <button type="button" class="lead-quick-button" data-dealer-focus-task>Add task</button>
            </div>
            <div class="lead-summary-metrics">
              <b class="priority-pill priority-${escapeHtml(lead.priority || "normal")}">${escapeHtml(lead.priority || "normal")}</b>
              <b class="dealer-status-badge ${escapeHtml(statusClass)}">${escapeHtml(statusLabel)}</b>
            </div>
          </div>
        </section>
        <section class="lead-queue-insight">
          <strong>${escapeHtml(nextAction)}</strong>
          <span>${escapeHtml(nextStepSummary)} | ${escapeHtml(compactTouchSummary)}</span>
        </section>
        ${pendingAlert ? `<button class="lead-inline-alert" type="button" data-dealer-open-alert="${escapeHtml(lead.id || "")}">New update on this lead</button>` : ""}
        <details class="lead-queue-more dealer-queue-more">
          <summary>More details and alerts</summary>
          ${dealerVehicleSignalInline(lead)}
          ${dealerVehicleContextInline(lead)}
          <p class="dealer-update-notice" ${pendingAlert ? "" : "hidden"}>Task or follow-up activity changed. Open this lead to review the latest update.</p>
        </details>
      </article>
    `;
  });
  syncActiveDealerLeadCard();
  if (activeDealerDrawerLeadId) {
    if (dealerLeadsCache.some((lead) => String(lead.id || "") === activeDealerDrawerLeadId)) {
      renderDealerDrawer(activeDealerDrawerLeadId);
      loadDealerDrawerActivity({ force: true }).catch(() => null);
    } else {
      closeDealerDrawer();
    }
  }
}

function renderDealerSharedLeadMeta({
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

function renderDealerDrawer(leadId) {
  if (!dealerLeadDrawer || !dealerLeadDrawerContent) return;
  const id = String(leadId || "").trim();
  const lead = dealerLeadsCache.find((item) => String(item.id || "") === id);
  if (!lead) {
    closeDealerDrawer();
    return;
  }

  const input = lead.input || {};
  const valuation = lead.valuation || {};
  const purchase = input.purchase || {};
  const buyerLead = isBuyerLead(lead);
  const status = lead.status || "new";
  const priority = lead.priority || "normal";
  const followUp = lead.next_follow_up_at || "";
  const lastActivity = lead.last_activity_at || "";
  const overdue = isDealerLeadOverdue(followUp, status);
  const title = cleanDealerLeadTitle(valuation.title || historyVehicleTitle(input) || "Vehicle lead", buyerLead);
  const customerName = input.ownerName || input.name || "";
  const sourceLabel = dealerLeadSourceLabel(lead);
  const dealerCreated = sourceLabel === "Dealer appraisal";
  const customerEmail = input.email || (dealerCreated ? "" : lead.auth_user?.email || lead.auth_email) || "-";
  const customerDisplay = customerName || customerEmail;
  const customerPhone = input.phone || "No phone";
  const vehicleContext = lead.vehicle_context || {};
  const pipelineLabel = leadStatusLabel(status, buyerLead);
  const nextAction = dealerNextBestAction(lead);
  const clusterLabel = vehicleContext.cluster_label || title;
  const planSummary = buyerLead
    ? `${purchase.intent || input.purchaseIntent || "Buyer opportunity"} | ${purchase.buyingTimeline || input.buyingTimeline || "Timeline open"}`
    : `${valuation.wholesale?.avg ? `Wholesale ${formatNumber(valuation.wholesale.avg)}` : "Seller appraisal"} | ${input.ownershipType || input.ownership || "Ownership unknown"}`;
  const warehouseLabel = vehicleContext.primary_inventory_status
    ? `Warehouse ${String(vehicleContext.primary_inventory_status).replaceAll("_", " ")}`
    : planSummary;
  const dealerEmailOptionsId = `dealer-drawer-email-options-${cssToken(lead.id || id)}`;
  const dealerEmailOptions = dealerDirectoryEmails.map((email) => `<option value="${escapeHtml(email)}"></option>`).join("");
  const actionButtons = dealerStatusActions(buyerLead, status)
    .map((action) => `<button type="button" data-drawer-dealer-status="${escapeHtml(action.status)}">${escapeHtml(action.label)}</button>`)
    .join("");
  const followUpButtons = dealerFollowUpActions()
    .map((action) => `<button type="button" data-drawer-dealer-follow-up="${escapeHtml(action.key)}">${escapeHtml(action.label)}</button>`)
    .join("");

  dealerLeadDrawer.hidden = false;
  dealerLeadDrawer.classList.add("open");
  document.body.classList.add("dealer-drawer-open");
  activeDealerDrawerLeadId = id;
  dealerLeadDrawerContent.innerHTML = `
    <section class="dealer-drawer-shell" data-drawer-lead-id="${escapeHtml(id)}">
      <header class="dealer-drawer-head">
        <div>
          <span>Dealer workspace</span>
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(sourceLabel)} | ${escapeHtml(customerDisplay)} | ${escapeHtml(customerPhone)}</small>
        </div>
        <div class="dealer-drawer-head-actions">
          <button type="button" data-dealer-drawer-open-card>Locate in queue</button>
          <button type="button" data-dealer-drawer-close>Close</button>
        </div>
      </header>
      <div class="drawer-workspace-scroll">
        <div class="drawer-workspace-grid">
          <aside class="drawer-workspace-side">
            <section class="dealer-drawer-summary">
              <div class="dealer-drawer-stat">
                <span>Pipeline</span>
                <strong>${escapeHtml(pipelineLabel)}</strong>
                <small>${escapeHtml(overdue ? "Overdue follow-up" : followUp ? formatDateTime(followUp) : "No follow-up scheduled")}</small>
              </div>
              <div class="dealer-drawer-stat">
                <span>Priority</span>
                <strong>${escapeHtml(priority)}</strong>
                <small>${escapeHtml(lastActivity ? `Last touch ${formatDateTime(lastActivity)}` : "No recent activity")}</small>
              </div>
              <div class="dealer-drawer-stat">
                <span>Vehicle</span>
                <strong>${escapeHtml(clusterLabel)}</strong>
                <small>${escapeHtml(warehouseLabel)}</small>
              </div>
              <div class="dealer-drawer-stat">
                <span>Lead age</span>
                <strong>${escapeHtml(dealerLeadAgeLabel(lead))}</strong>
                <small>${escapeHtml(dealerLastTouchLabel(lead))}</small>
              </div>
            </section>
            <section class="dealer-drawer-section drawer-overview-panel">
              <header>
                <h3>Overview</h3>
                <span>${escapeHtml(buyerLead ? "BUY lead" : "SELL lead")}</span>
              </header>
              <div class="drawer-spotlight">
                <strong>${escapeHtml(nextAction)}</strong>
                <small>${escapeHtml(followUp ? `Next follow-up ${formatDateTime(followUp)}` : "Set the next follow-up before leaving this workspace.")}</small>
              </div>
              ${renderDealerLeadProgress(buyerLead, status)}
              <div class="drawer-meta-grid">
                <div class="drawer-meta-item">
                  <span>Customer</span>
                  <strong>${escapeHtml(customerDisplay)}</strong>
                  <small>${escapeHtml([customerEmail !== customerDisplay ? customerEmail : "", customerPhone].filter(Boolean).join(" | "))}</small>
                </div>
                <div class="drawer-meta-item">
                  <span>Source</span>
                  <strong>${escapeHtml(sourceLabel)}</strong>
                  <small>${escapeHtml(input.dealerEmail ? `Dealer ${input.dealerEmail}` : "Public owner flow")}</small>
                </div>
                <div class="drawer-meta-item">
                  <span>Plan</span>
                  <strong>${escapeHtml(planSummary)}</strong>
                  <small>${escapeHtml(warehouseLabel)}</small>
                </div>
                <div class="drawer-meta-item">
                  <span>Vehicle</span>
                  <strong>${escapeHtml(clusterLabel)}</strong>
                  <small>${escapeHtml(vehicleContext.primary_inventory_status ? warehouseLabel : "CRM lead only")}</small>
                </div>
                <div class="drawer-meta-item">
                  <span>Status</span>
                  <strong>${escapeHtml(pipelineLabel)}</strong>
                  <small>${escapeHtml(overdue ? "Follow-up overdue" : "Pipeline on track")}</small>
                </div>
              </div>
            </section>
            ${dealerVehicleSignalInline(lead)}
            ${dealerVehicleContextInline(lead)}
          </aside>
          <div class="drawer-workspace-main">
            ${renderDealerCommunicationStrip(lead)}
            <section class="dealer-drawer-section">
              <header>
                <h3>Quick follow-up</h3>
                <span>Move the lead forward without opening the full CRM card</span>
              </header>
              <div class="dealer-lead-actions dealer-drawer-actions">
                ${actionButtons}
              </div>
              <div class="dealer-lead-actions dealer-follow-up-actions dealer-drawer-followups">
                ${followUpButtons}
              </div>
            </section>
            ${renderDealerDealChecklistSection(lead)}
            <section class="dealer-drawer-section">
              <header>
                <h3>Log touch</h3>
                <span>Record the latest customer touch, then review recent activity below</span>
              </header>
              <div class="dealer-drawer-comm-shortcuts">
                <button type="button" data-drawer-note-type="call">Call</button>
                <button type="button" data-drawer-note-type="sms">Text</button>
                <button type="button" data-drawer-focus-email>Email</button>
                <button type="button" data-drawer-note-type="internal">Note</button>
              </div>
              <form class="dealer-note-form dealer-drawer-note-form">
                <select name="noteType">
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="inspection">Inspection</option>
                  <option value="correction">Correction request</option>
                  <option value="offer">Offer</option>
                  <option value="internal">Internal note</option>
                </select>
                <textarea name="note" placeholder="Record the latest customer touch, inspection result, correction, or quote update..."></textarea>
                <button type="submit">Save note</button>
              </form>
              <details class="drawer-secondary-forms">
                <summary>Task and email tools</summary>
                <form class="dealer-task-form dealer-drawer-task-form">
                  <input name="title" placeholder="Next task" />
                  <input name="assignedTo" type="email" list="${escapeHtml(dealerEmailOptionsId)}" placeholder="Assign to dealer email" />
                  <datalist id="${escapeHtml(dealerEmailOptionsId)}">${dealerEmailOptions}</datalist>
                  <input name="dueAt" type="datetime-local" />
                  <button type="submit">Add task</button>
                </form>
                <form class="lead-email-form dealer-email-form dealer-drawer-email-form">
                  <input name="sentTo" type="email" value="${escapeHtml(customerEmail)}" placeholder="customer@example.com" />
                  <input name="subject" placeholder="Email subject" />
                  <textarea name="body" placeholder="Log the outbound email summary or draft text..."></textarea>
                  <button type="submit">Log email</button>
                </form>
              </details>
            </section>
            <section class="dealer-drawer-section">
              <header>
                <h3>Recent activity</h3>
                <button type="button" data-drawer-load-dealer-activity>Refresh</button>
              </header>
              <div class="dealer-activity-list dealer-drawer-activity-list">Activity not loaded yet.</div>
            </section>
          </div>
        </div>
      </div>
    </section>
  `;
}

function closeDealerDrawer() {
  if (!dealerLeadDrawer || !dealerLeadDrawerContent) return;
  dealerLeadDrawer.classList.remove("open");
  dealerLeadDrawer.hidden = true;
  dealerLeadDrawerContent.innerHTML = "";
  document.body.classList.remove("dealer-drawer-open");
  activeDealerDrawerLeadId = "";
  dealerDrawerActivityLoaded = false;
}

async function loadDealerDrawerActivity(options = {}) {
  if (!dealerLeadDrawerContent || !activeDealerDrawerLeadId) return;
  const list = dealerLeadDrawerContent.querySelector(".dealer-drawer-activity-list");
  if (!list) return;
  if (dealerDrawerActivityLoaded && !options.force) return;
  list.textContent = "Loading activity...";
  try {
    const response = await fetch(`/api/lead-activity?leadId=${encodeURIComponent(activeDealerDrawerLeadId)}`, {
      headers: {
        Authorization: `Bearer ${authSession?.access_token || ""}`
      }
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Unable to load activity");
    dealerDrawerActivityLoaded = true;
    list.innerHTML = renderDealerActivity(data, { highlightLatest: Boolean(options.highlightLatest), limit: 12 });
  } catch (error) {
    list.textContent = error.message || "Unable to load activity";
  }
}

function setActiveDealerLead(id) {
  activeDealerLeadId = String(id || "").trim();
  syncActiveDealerLeadCard();
}

function syncActiveDealerLeadCard() {
  const cards = [...dealerLeadsList.querySelectorAll(".dealer-lead-card")];
  const hasMatch = Boolean(activeDealerLeadId) && cards.some((card) => card.dataset.leadId === activeDealerLeadId);
  dealerLeadsList.classList.toggle("lead-focus-mode", hasMatch);
  cards.forEach((card) => {
    card.classList.toggle("dealer-lead-card-current", hasMatch && card.dataset.leadId === activeDealerLeadId);
  });
}

function setDealerLeadFilter(filter) {
  dealerLeadFilter = filter || "all";
  dealerLeadFilterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.dealerFilter === dealerLeadFilter);
  });
}

function isDealerWaitingReply(lead) {
  if (isDealerClosedLead(lead)) return false;
  return String(lead?.status || "").toLowerCase() === "waiting_for_customer";
}

function dealerRecentTouchTimestamp(lead) {
  const timestamps = [
    lead?.last_activity_at,
    lead?.updated_at,
    lead?.created_at
  ]
    .map((value) => new Date(value || 0).getTime())
    .filter((value) => !Number.isNaN(value) && value > 0);
  return timestamps.length ? Math.max(...timestamps) : 0;
}

function isDealerNoResponseLead(lead) {
  if (isDealerClosedLead(lead)) return false;
  const touchedAt = dealerRecentTouchTimestamp(lead);
  if (!touchedAt) return true;
  return touchedAt < Date.now() - (48 * 60 * 60 * 1000);
}

function isDealerAppointmentLead(lead) {
  if (isDealerClosedLead(lead)) return false;
  return ["appointment_booked", "inspection_booked"].includes(String(lead?.status || "").toLowerCase());
}

function isDealerCallNowLead(lead) {
  if (isDealerClosedLead(lead)) return false;
  return ["high", "urgent"].includes(String(lead?.priority || "").toLowerCase())
    || isDealerLeadDueNow(lead?.next_follow_up_at || "", lead?.status || "new")
    || String(lead?.status || "").toLowerCase() === "new";
}

function isDealerDealDeskLead(lead) {
  const status = String(lead?.status || "").toLowerCase();
  if (isBuyerLead(lead)) return status === "won";
  return ["in_inventory", "won"].includes(status);
}

function dealerDealDeskLabel(lead) {
  const status = String(lead?.status || "").toLowerCase();
  if (isBuyerLead(lead)) return "Delivery handoff";
  if (status === "in_inventory") return "Warehouse intake";
  return "Purchase closed";
}

function dealerDealChecklistTemplate(lead) {
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

function dealerDealChecklistSummary(lead) {
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

function dealerDealChecklistProgressLabel(lead) {
  return String(dealerDealChecklistSummary(lead)?.progress_label || "").trim();
}

function renderDealerDealChecklistSection(lead) {
  if (!isDealerDealDeskLead(lead)) return "";
  const summary = dealerDealChecklistSummary(lead);
  const items = Array.isArray(summary.items) && summary.items.length
    ? summary.items
    : dealerDealChecklistTemplate(lead).map((item) => ({ ...item, completed: false, completed_at: "" }));
  const missingCount = items.filter((item) => !item.completed).length;
  return `
    <section class="dealer-drawer-section">
      <header>
        <h3>Deal desk checklist</h3>
        <span>${escapeHtml(summary.progress_label || "Checklist 0/0")}</span>
      </header>
      <div class="deal-checklist-grid">
        ${items.map((item) => `
          <button type="button" class="deal-checklist-item ${item.completed ? "complete" : ""}" data-dealer-dealdesk-check="${escapeHtml(item.key || "")}" data-completed="${item.completed ? "true" : "false"}">
            <strong>${escapeHtml(item.label || "")}</strong>
            <small>${escapeHtml(item.completed ? `Done ${item.completed_at ? formatDateTime(item.completed_at) : ""}`.trim() : "Mark complete")}</small>
          </button>
        `).join("")}
      </div>
      <div class="deal-checklist-actions">
        <label class="deal-checklist-field">
          <span>Delivery date</span>
          <input type="datetime-local" data-dealer-dealdesk-delivery value="${escapeHtml(dealerDateTimeValue(summary.delivery_at || ""))}">
        </label>
        <div class="deal-checklist-key-handoff">
          ${["pending", "ready", "complete"].map((value) => `
            <button type="button" class="${summary.key_handoff_status === value ? "active" : ""}" data-dealer-dealdesk-key="${escapeHtml(value)}">${escapeHtml(value === "pending" ? "Key pending" : value === "ready" ? "Key ready" : "Key handed off")}</button>
          `).join("")}
        </div>
        <span class="deal-checklist-meta">${escapeHtml(summary.key_handoff_label || (missingCount > 0 ? `${missingCount} checklist items still open` : "Checklist loaded"))}</span>
      </div>
    </section>
  `;
}

function dealerLeadAgeDays(lead) {
  return Number(lead?.activity_summary?.age_days || 0);
}

function dealerLeadAgeLabel(lead) {
  return String(lead?.activity_summary?.age_label || "").trim() || "Fresh";
}

function isDealerAgingCriticalLead(lead) {
  return !isDealerClosedLead(lead) && String(lead?.activity_summary?.age_bucket || "") === "critical";
}

function dealerOutboundLabel(lead) {
  const summary = lead?.activity_summary || {};
  if (summary.last_outbound_at && summary.last_outbound_label) {
    return `${summary.last_outbound_label} ${formatDateTime(summary.last_outbound_at)}`;
  }
  return "";
}

function dealerInboundLabel(lead) {
  const summary = lead?.activity_summary || {};
  if (summary.last_inbound_at) return `Customer inquiry ${formatDateTime(summary.last_inbound_at)}`;
  return "Customer inquiry not logged";
}

function dealerLastTouchLabel(lead) {
  if (lead?.last_activity_at) return `Last touch ${formatDateTime(lead.last_activity_at)}`;
  if (lead?.created_at) return `Created ${formatDateTime(lead.created_at)}`;
  return "No touch logged";
}

function dealerNextBestAction(lead) {
  const buyer = isBuyerLead(lead);
  const status = String(lead?.status || "new").toLowerCase();
  if (hasDealerOpenTask(lead)) {
    const summary = lead.task_summary || {};
    return summary.latest_open_title ? `Complete task: ${summary.latest_open_title}` : "Complete the assigned task";
  }
  if (lead?.vehicle_signal?.message) return "Review the vehicle alert before the next customer update";
  if (isDealerDealDeskLead(lead) && dealerDealChecklistSummary(lead).pending > 0) return `Finish ${dealerDealChecklistProgressLabel(lead)} before closing the handoff`;
  if (buyer && status === "won") return "Prep delivery, finance docs, and final handoff";
  if (!buyer && status === "in_inventory") return "Confirm intake photos, price, and warehouse handoff";
  if (!buyer && status === "won") return "Confirm purchase paperwork and stock handoff";
  if (isDealerNoResponseLead(lead)) return "Reach out now and log a fresh touch";
  if (isDealerLeadOverdue(lead?.next_follow_up_at || "", status)) return "Call now and reset the next follow-up";
  if (isDealerAppointmentLead(lead)) return buyer ? "Confirm the buyer appointment and prep the handoff" : "Confirm the inspection appointment and prep the appraisal";
  if (status === "new") return buyer ? "Call buyer and confirm the exact vehicle interest" : "Call seller and confirm appraisal details";
  if (status === "contacted") return buyer ? "Work toward appointment or finance next step" : "Book inspection or send the appraisal next step";
  if (isDealerWaitingReply(lead)) return "Follow up on the pending reply before this goes cold";
  if (!lead?.next_follow_up_at) return "Schedule the next follow-up before leaving the lead";
  return buyer ? "Keep the buyer plan moving toward appointment or finance" : "Keep the seller plan moving toward inspection or inventory";
}

function renderDealerCommunicationStrip(lead) {
  const chips = [];
  chips.push(isDealerNoResponseLead(lead) ? "No response 48h+" : (dealerOutboundLabel(lead) || dealerLastTouchLabel(lead)));
  chips.push(dealerInboundLabel(lead));
  chips.push(lead?.next_follow_up_at ? `Next follow-up ${formatDateTime(lead.next_follow_up_at)}` : "No follow-up scheduled");
  if (lead?.vehicle_signal?.message) chips.push(lead.vehicle_signal.message);
  else if (lead?.vehicle_context?.has_active_offer) chips.push("Vehicle has active offer");
  else if (lead?.vehicle_context?.sold_elsewhere) chips.push("Vehicle already sold");
  else if (isDealerAppointmentLead(lead)) chips.push("Appointment on the board");
  else if (isDealerWaitingReply(lead)) chips.push("Waiting for customer reply");
  else if (isDealerDealDeskLead(lead) && dealerDealChecklistProgressLabel(lead)) chips.push(dealerDealChecklistProgressLabel(lead));
  else if (isDealerDealDeskLead(lead)) chips.push(dealerDealDeskLabel(lead));
  else chips.push(dealerLeadAgeLabel(lead));
  return `
    <section class="lead-communication-strip">
      <div class="lead-communication-chips">
        ${chips.slice(0, 4).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
      <strong>${escapeHtml(dealerNextBestAction(lead))}</strong>
    </section>
  `;
}

function renderDealerTodayWork(leads) {
  if (!dealerTodayWorkEl) return;
  const activeLeads = leads.filter(isDealerActiveWorkLead);
  const callNowCount = activeLeads.filter((lead) => isDealerCallNowLead(lead)).length;
  const dueCount = activeLeads.filter((lead) => isDealerLeadDueNow(lead.next_follow_up_at || "", lead.status || "new")).length;
  const waitingReplyCount = activeLeads.filter((lead) => isDealerWaitingReply(lead)).length;
  const freshCount = activeLeads.filter((lead) => String(lead.status || "new").toLowerCase() === "new").length;
  const vehicleAlertCount = activeLeads.filter((lead) => lead.vehicle_signal?.message || lead.vehicle_context?.has_active_offer || lead.vehicle_context?.sold_elsewhere || lead.vehicle_context?.off_market).length;
  const noResponseCount = activeLeads.filter((lead) => isDealerNoResponseLead(lead)).length;
  dealerTodayWorkEl.hidden = false;
  dealerTodayWorkEl.innerHTML = `
    ${renderDealerDashboardStats(leads)}
    <section class="dealer-manager-brief" aria-label="Dealer brief">
      <button type="button" class="dealer-brief-card" data-dealer-filter-shortcut="active">
        <span>My queue</span>
        <strong>${activeLeads.length}</strong>
        <small>All assigned active work</small>
      </button>
      <button type="button" class="dealer-brief-card" data-dealer-filter-shortcut="fresh">
        <span>Fresh</span>
        <strong>${freshCount}</strong>
        <small>New assigned leads</small>
      </button>
      <button type="button" class="dealer-brief-card" data-dealer-filter-shortcut="waiting-reply">
        <span>Needs Reply</span>
        <strong>${waitingReplyCount}</strong>
        <small>Customer waiting</small>
      </button>
      <button type="button" class="dealer-brief-card" data-dealer-filter-shortcut="call-now">
        <span>Call now</span>
        <strong>${callNowCount}</strong>
        <small>Hot leads first</small>
      </button>
      <button type="button" class="dealer-brief-card" data-dealer-filter-shortcut="due">
        <span>Due today</span>
        <strong>${dueCount}</strong>
        <small>Follow-up due or overdue</small>
      </button>
      <button type="button" class="dealer-brief-card" data-dealer-filter-shortcut="no-response">
        <span>No response</span>
        <strong>${noResponseCount}</strong>
        <small>Needs a touch</small>
      </button>
      <button type="button" class="dealer-brief-card" data-dealer-filter-shortcut="vehicle-alerts">
        <span>Vehicle alerts</span>
        <strong>${vehicleAlertCount}</strong>
        <small>Same-vehicle changes to review</small>
      </button>
    </section>
  `;
}

function renderDealerDashboardStats(leads) {
  const stats = buildDealerLeadDashboardStats(leads, dealerDashboardRange);
  return `
    <section class="crm-dashboard-panel dealer-dashboard-panel" aria-label="Dealer account totals">
      <header class="crm-dashboard-hero">
        <div>
          <span>My totals</span>
          <h3>Real assigned Up Sheet totals from current CRM data.</h3>
        </div>
        <form class="crm-dashboard-range" data-dealer-dashboard-range>
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
              <th>My queue</th>
              ${stats.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${[
              { label: "Total Up Sheets", values: stats.created },
              { label: "BUY E-Leads", values: stats.buyers },
              { label: "SELL valuations", values: stats.sellers },
              { label: "Sold / purchased", values: stats.sold },
              { label: "Lost", values: stats.lost },
              { label: "Closing %", values: stats.closing, suffix: "%" }
            ].map((row) => `
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

function buildDealerLeadDashboardStats(leads, selectedRange) {
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
    { label: "Selected Range", start, end: endExclusive },
    { label: "Today", start: today, end: tomorrow },
    { label: "Yesterday", start: yesterday, end: today },
    { label: "This Month", start: monthStart, end: nextMonthStart },
    { label: "Last Month", start: lastMonthStart, end: monthStart },
    { label: "Monthly Average", start, end: endExclusive, averageMonths: selectedMonthCount }
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
  const sold = ranges.map((range) => metricForRange(range, isDealerDashboardSoldLead, leadStatusTimestamp));
  const lost = ranges.map((range) => metricForRange(range, isDealerDashboardLostLead, leadStatusTimestamp));
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

function isDealerDashboardSoldLead(lead) {
  return ["won", "sold", "delivered"].includes(String(lead?.status || "").toLowerCase());
}

function isDealerDashboardLostLead(lead) {
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

function filterDealerLeads(leads) {
  if (dealerLeadFilter === "active") return leads.filter(isDealerActiveWorkLead);
  if (dealerLeadFilter === "closed") return leads.filter(isDealerClosedLead);
  if (dealerLeadFilter === "fresh") return leads.filter((lead) => !isDealerClosedLead(lead) && String(lead.status || "new").toLowerCase() === "new");
  if (dealerLeadFilter === "delivered") return leads.filter((lead) => ["delivered", "sold", "won"].includes(String(lead.status || "").toLowerCase()));
  if (dealerLeadFilter === "lost") return leads.filter((lead) => ["lost", "failed"].includes(String(lead.status || "").toLowerCase()));
  if (dealerLeadFilter === "inactive") return leads.filter((lead) => isDealerClosedLead(lead) && !["delivered", "sold", "won", "lost", "failed", "deleted"].includes(String(lead.status || "").toLowerCase()));
  if (dealerLeadFilter === "call-now") return leads.filter(isDealerCallNowLead);
  if (dealerLeadFilter === "no-response") return leads.filter(isDealerNoResponseLead);
  if (dealerLeadFilter === "appointments") return leads.filter(isDealerAppointmentLead);
  if (dealerLeadFilter === "deal-desk") return leads.filter(isDealerDealDeskLead);
  if (dealerLeadFilter === "aging-critical") return leads.filter(isDealerAgingCriticalLead);
  if (dealerLeadFilter === "priority") return leads.filter((lead) => !isDealerClosedLead(lead) && ["high", "urgent"].includes(String(lead.priority || "").toLowerCase()));
  if (dealerLeadFilter === "unassigned") return leads.filter((lead) => !isDealerClosedLead(lead) && !String(lead.assigned_to || "").trim());
  if (dealerLeadFilter === "buyer") return leads.filter((lead) => !isDealerClosedLead(lead) && isBuyerLead(lead));
  if (dealerLeadFilter === "seller") return leads.filter((lead) => !isDealerClosedLead(lead) && !isBuyerLead(lead));
  if (dealerLeadFilter === "waiting-reply") return leads.filter(isDealerWaitingReply);
  if (dealerLeadFilter === "vehicle-alerts") return leads.filter((lead) => !isDealerClosedLead(lead) && (lead.vehicle_signal?.message || lead.vehicle_context?.has_active_offer || lead.vehicle_context?.sold_elsewhere || lead.vehicle_context?.off_market));
  if (dealerLeadFilter === "due") {
    return leads.filter((lead) => !isDealerClosedLead(lead) && isDealerLeadDueNow(lead.next_follow_up_at || "", lead.status || "new"));
  }
  return leads;
}

function sortDealerLeads(leads) {
  return [...leads].sort((a, b) => {
    const pinnedDiff = dealerLeadPinnedRank(a) - dealerLeadPinnedRank(b);
    if (pinnedDiff) return pinnedDiff;
    const timeDiff = leadCreatedTimestamp(b) - leadCreatedTimestamp(a);
    if (timeDiff) return dealerLeadSort === "oldest" ? -timeDiff : timeDiff;
    return String(b.id || "").localeCompare(String(a.id || ""));
  });
}

function dealerLeadPinnedRank(lead) {
  if (hasDealerOpenTask(lead)) return 0;
  if (isDealerClosedLead(lead)) return 4;
  const status = lead.status || "new";
  if (String(lead.priority || "").toLowerCase() === "urgent") return 0;
  if (isDealerLeadOverdue(lead.next_follow_up_at || "", status)) return 1;
  if (String(status).toLowerCase() === "new") return 2;
  return 3;
}

function leadCreatedTimestamp(lead) {
  const value = lead?.created_at || lead?.last_activity_at || lead?.next_follow_up_at || 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function renderDealerLeadGroups(leads, cardRenderer) {
  const buyerLeads = leads.filter(isBuyerLead);
  const sellerLeads = leads.filter((lead) => !isBuyerLead(lead));
  const groups = [
    { title: "BUY leads", caption: "Inventory shoppers asking about a specific vehicle.", kind: "buyer", leads: buyerLeads },
    { title: "SELL leads", caption: "Customers selling or valuing their own vehicle.", kind: "seller", leads: sellerLeads }
  ].filter((group) => group.leads.length);

  return groups.map((group) => `
    <section class="dealer-lead-group dealer-lead-group-${group.kind}">
      <header>
        <div>
          <h2>${escapeHtml(group.title)}</h2>
          <p>${escapeHtml(group.caption)}</p>
        </div>
        <b>${group.leads.length}</b>
      </header>
      <div class="lead-list-header dealer-lead-list-header" aria-hidden="true">
        <span>Lead</span>
        <span>Customer</span>
        <span>Vehicle</span>
        <span>Next step</span>
        <span>Pipeline</span>
        <span>Quick actions</span>
      </div>
      <div class="dealer-lead-group-list">
        ${group.leads.map((lead, index) => cardRenderer(lead, index)).join("")}
      </div>
    </section>
  `).join("");
}

function isBuyerLead(lead) {
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  return input.leadType === "buyer_inquiry" || valuation.source === "buyer_inquiry";
}

function dealerLeadSourceLabel(lead = {}) {
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  const source = String(input.leadSource || input.sourceLabel || valuation.source || "").trim().toLowerCase();
  if (input.leadType === "buyer_inquiry" || source === "buyer_inquiry") return "Buyer inquiry";
  if (source.includes("dealer")) return "Dealer appraisal";
  return "Owner appraisal";
}

function isDealerClosedLead(lead) {
  return ["won", "lost", "closed", "deleted", "in_inventory"].includes(String(lead?.status || "").toLowerCase());
}

function isDealerActiveWorkLead(lead) {
  return !isDealerClosedLead(lead) || hasDealerOpenTask(lead);
}

function hasDealerOpenTask(lead) {
  return Number(lead?.task_summary?.open_count || 0) > 0;
}

function cleanDealerLeadTitle(title, buyerLead) {
  const value = String(title || "").trim();
  return buyerLead ? value.replace(/^Buyer inquiry\s*-\s*/i, "") : value;
}

function isAutoBuyerInquiryNote(note) {
  const value = String(note || "").trim();
  return /^Buyer inquiry from public Buy page/i.test(value) || /^Buyer inquiry for /i.test(value);
}

function dealerStatusActions(buyerLead, status) {
  const current = String(status || "new").toLowerCase();
  const actions = buyerLead
    ? [
        ["contacted", "Mark contacted"],
        ["waiting_for_customer", "Waiting"],
        ["appointment_booked", "Book appointment"],
        ["finance_sent", "Finance sent"],
        ["won", "Won"],
        ["lost", "Lost"]
      ]
    : [
        ["contacted", "Mark contacted"],
        ["waiting_for_customer", "Waiting"],
        ["inspection_booked", "Inspection booked"],
        ["offer_sent", "Offer sent"],
        ["in_inventory", "Moved to inventory"],
        ["won", "Purchased"],
        ["lost", "Lost"]
      ];
  return actions
    .filter(([next]) => next !== current)
    .map(([next, label]) => ({ status: next, label }));
}

function dealerLeadProgressSteps(buyerLead) {
  return buyerLead
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

function renderDealerLeadProgress(buyerLead, status) {
  const current = String(status || "new").toLowerCase();
  const steps = dealerLeadProgressSteps(buyerLead);
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
      ${closedLost ? `<li class="active closed"><span></span><b>${escapeHtml(current.replaceAll("_", " "))}</b></li>` : ""}
    </ol>
  `;
}

function dealerFollowUpActions() {
  return [
    { key: "tomorrow", label: "Follow up tomorrow" },
    { key: "next_week", label: "Next week" }
  ];
}

function dealerFollowUpDate(key) {
  const date = new Date();
  if (key === "next_week") {
    date.setDate(date.getDate() + 7);
  } else {
    date.setDate(date.getDate() + 1);
  }
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

async function openDealerWorkspace(card, options = {}) {
  if (!card) return;
  if (card.dataset.leadId) {
    renderDealerDrawer(card.dataset.leadId);
    dealerDrawerActivityLoaded = false;
    await loadDealerDrawerActivity({ force: true, highlightLatest: true });
  }
  const details = card.querySelector(".lead-queue-more");
  if (details && !details.open) details.open = true;

  if (options.focus === "task") {
    const taskInput = dealerLeadDrawerContent?.querySelector('.dealer-drawer-task-form input[name="title"]');
    taskInput?.focus();
    return;
  }

  if (options.focus === "note") {
    const noteType = dealerLeadDrawerContent?.querySelector('.dealer-drawer-note-form select[name="noteType"]');
    const noteField = dealerLeadDrawerContent?.querySelector('.dealer-drawer-note-form textarea[name="note"]');
    if (noteType && options.noteType) noteType.value = options.noteType;
    noteField?.focus();
  }
}

async function openFullDealerLeadFromDrawer() {
  if (!activeDealerDrawerLeadId) return;
  const target = dealerLeadsList.querySelector(`.dealer-lead-card[data-lead-id="${cssEscape(activeDealerDrawerLeadId)}"]`);
  if (!target) return;
  closeDealerDrawer();
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  setActiveDealerLead(activeDealerDrawerLeadId);
}

function startDealerAutoRefresh() {
  stopDealerAutoRefresh();
  dealerRefreshTimer = window.setInterval(refreshOpenDealerTasks, DEALER_REFRESH_MS);
}

function stopDealerAutoRefresh() {
  if (dealerRefreshTimer) window.clearInterval(dealerRefreshTimer);
  dealerRefreshTimer = null;
}

async function refreshOpenDealerTasks() {
  if (!authSession?.access_token || !dealerAdminAllowed || document.hidden || isEditingDealerLeads()) return;
  await checkDealerLeadUpdates();
}

function isEditingDealerLeads() {
  const active = document.activeElement;
  return Boolean(active && dealerLeadsList?.contains(active) && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(active.tagName));
}

async function checkDealerLeadUpdates() {
  const cardsById = new Map([...dealerLeadsList.querySelectorAll(".dealer-lead-card")]
    .map((card) => [card.dataset.leadId, card])
    .filter(([id]) => Boolean(id)));
  const previousTokens = new Map(dealerLeadsCache
    .map((lead) => [String(lead.id || ""), dealerLeadUpdateToken(lead)])
    .filter(([id]) => Boolean(id)));

  try {
    const response = await fetch("/api/dealer-leads", {
      headers: {
        Authorization: `Bearer ${authSession.access_token}`
      }
    });
    const data = await response.json();
    if (!data.ok) return;
    let updatedCount = 0;
    let newCount = 0;
    for (const lead of data.leads || []) {
      const id = String(lead.id || "");
      const card = cardsById.get(id);
      const previousToken = previousTokens.get(id);
      if (!previousToken) {
        dealerLeadAlertMap.set(id, {
          id,
          type: "new",
          title: dealerLeadAlertTitle(lead),
          message: "New assigned lead"
        });
        newCount += 1;
        continue;
      }
      const nextToken = dealerLeadUpdateToken(lead);
      if (nextToken && previousToken !== nextToken) {
        if (card) card.dataset.pendingUpdateToken = nextToken;
        dealerLeadAlertMap.set(id, {
          id,
          type: "updated",
          title: dealerLeadAlertTitle(lead),
          message: "Lead changed"
        });
        if (card) showDealerLeadUpdateNotice(card);
        updatedCount += 1;
      }
    }
    dealerLeadsCache = data.leads || [];
    renderDealerLeadAlerts();
    renderDealerTodayWork(dealerLeadsCache);
    if (newCount) {
      dealerLeadsStatus.textContent = `${newCount} new assigned lead${newCount === 1 ? "" : "s"}. Click the update above to open.`;
    } else if (updatedCount) {
      dealerLeadsStatus.textContent = `${updatedCount} lead${updatedCount === 1 ? "" : "s"} updated. Open highlighted leads to review task or follow-up changes.`;
    }
  } catch {
    // Background checks should not interrupt active follow-up work.
  }
}

function dealerLeadAlertTitle(lead = {}) {
  const input = lead.input || {};
  const valuation = lead.valuation || {};
  return cleanDealerLeadTitle(valuation.title || historyVehicleTitle(input) || "Vehicle lead", isBuyerLead(lead));
}

function renderDealerLeadAlerts() {
  if (!dealerLeadAlertsEl) return;
  const alerts = [...dealerLeadAlertMap.values()];
  dealerLeadAlertsEl.hidden = alerts.length === 0;
  dealerLeadAlertsEl.innerHTML = alerts.length ? `
    <div>
      <strong>${alerts.length} lead update${alerts.length === 1 ? "" : "s"}</strong>
      <span>Click an update to open the lead.</span>
    </div>
    <div class="lead-alert-list">
      ${alerts.map((alert) => `
        <button type="button" data-dealer-open-alert="${escapeHtml(alert.id)}" class="lead-alert-item lead-alert-${escapeHtml(alert.type)}">
          <b>${escapeHtml(alert.message)}</b>
          <span>${escapeHtml(alert.title)}</span>
        </button>
      `).join("")}
    </div>
  ` : "";
}

async function openDealerLeadFromAlert(id) {
  await openDealerLead(id, { fromAlert: true });
}

async function openDealerLead(id, options = {}) {
  if (!id) return;
  if (!dealerLeadsCache.some((lead) => String(lead.id || "") === id)) {
    await loadDealerLeads({ forceActivity: true, suppressAlerts: true });
  }
  if (dealerLeadFilter !== "all") {
    setDealerLeadFilter("all");
    renderDealerLeads(dealerLeadsCache, dealerLeadRole);
  }
  let card = dealerLeadsList.querySelector(`.dealer-lead-card[data-lead-id="${cssEscape(id)}"]`);
  if (!card) {
    renderDealerLeads(dealerLeadsCache, dealerLeadRole);
    card = dealerLeadsList.querySelector(`.dealer-lead-card[data-lead-id="${cssEscape(id)}"]`);
  }
  if (!card) return;
  setActiveDealerLead(id);
  if (options.fromAlert) {
    markDealerLeadTokenRead(id);
    dealerLeadAlertMap.delete(id);
    renderDealerLeadAlerts();
    clearDealerLeadUpdateNotice(card);
  }
  card.classList.add("lead-card-flash");
  window.setTimeout(() => card.classList.remove("lead-card-flash"), 1600);
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  renderDealerDrawer(id);
  dealerDrawerActivityLoaded = false;
  const details = card.querySelector(".lead-queue-more");
  if (details) details.open = true;
  if (options.fromAlert) highlightDealerLeadChangeAreas(card);
  await loadDealerDrawerActivity({ force: true, highlightLatest: Boolean(options.fromAlert) });
}

function dealerLeadUpdateToken(lead = {}) {
  return [
    lead.updated_at || "",
    lead.last_activity_at || "",
    lead.status || "",
    lead.assigned_to || "",
    lead.priority || "",
    lead.next_follow_up_at || "",
    JSON.stringify(lead.owner_adjustment || {}),
    JSON.stringify(lead.vehicle_signal || {}),
    lead.notes || ""
  ].join("|");
}

function showDealerLeadUpdateNotice(card) {
  card.classList.add("dealer-lead-updated");
  const notice = card.querySelector(".dealer-update-notice");
  if (notice) notice.hidden = false;
}

function clearDealerLeadUpdateNotice(card) {
  card.classList.remove("dealer-lead-updated");
  card.dataset.activityLoaded = "false";
  if (card.dataset.leadId) dealerLeadAlertMap.delete(card.dataset.leadId);
  if (card.dataset.pendingUpdateToken) {
    card.dataset.updateToken = card.dataset.pendingUpdateToken;
    delete card.dataset.pendingUpdateToken;
  }
  const notice = card.querySelector(".dealer-update-notice");
  if (notice) notice.hidden = true;
  renderDealerLeadAlerts();
}

function renderDealerActivity(data, options = {}) {
  const latestKey = options.highlightLatest ? latestDealerActivityKey(data) : "";
  const items = [
    ...(data.tasks || []).map((task) => {
      const dueText = task.due_at ? ` - Due ${escapeHtml(formatDateTime(task.due_at))}` : " - No due date";
      const action = task.completed_at
        ? `<span class="task-complete-note">Completed ${escapeHtml(formatDateTime(task.completed_at))}</span>`
        : `<button type="button" data-complete-dealer-task="${escapeHtml(task.id || "")}">Mark complete</button>`;
      return {
        key: `task:${task.id}`,
        time: new Date(task.completed_at || task.created_at || task.due_at || 0).getTime(),
        render: `
          <article class="activity-item ${task.completed_at ? "activity-done" : ""} ${latestKey === `task:${task.id}` ? "activity-highlight" : ""}">
            <div>
              <strong>${escapeHtml(task.title || "Task")}</strong>
              <span>Assigned to ${escapeHtml(task.assigned_to || "unassigned")}${dueText}</span>
            </div>
            ${action}
          </article>
        `
      };
    }),
    ...(data.notes || []).map((note) => ({
      key: `note:${note.id}`,
      time: new Date(note.created_at || 0).getTime(),
      render: `
        <article class="activity-item ${latestKey === `note:${note.id}` ? "activity-highlight" : ""}">
          <div>
            <strong>${escapeHtml(dealerActivityNoteLabel(note.note_type))} by ${escapeHtml(note.author_email || "-")}</strong>
            <span>${escapeHtml(formatDateTime(note.created_at))}</span>
            <p>${escapeHtml(formatDealerActivityNoteText(note.note || ""))}</p>
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
            <p>${escapeHtml(email.body || "")}</p>
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

function latestDealerActivityKey(data) {
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

function dealerActivityNoteLabel(type) {
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

function formatDealerActivityNoteText(note) {
  const text = String(note || "").trim();
  let match = text.match(/^\[Deal desk:check:([a-z_]+):(done|open)\]/i);
  if (match) return `${dealerDealDeskItemLabel(match[1])} marked ${String(match[2]).toLowerCase() === "done" ? "complete" : "open"}.`;
  match = text.match(/^\[Deal desk:delivery_at:([^\]]+)\]/i);
  if (match) return `Delivery date set for ${formatDateTime(match[1])}.`;
  match = text.match(/^\[Deal desk:key_handoff:(pending|ready|complete)\]/i);
  if (match) return match[1] === "complete" ? "Keys handed off." : match[1] === "ready" ? "Keys ready for handoff." : "Key handoff pending.";
  return text;
}

function dealerDealDeskItemLabel(key) {
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

function dealerDateTimeValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function highlightDealerLeadChangeAreas(card) {
  [".lead-progress", ".history-meta", ".dealer-buyer-plan", ".dealer-review-summary", ".dealer-activity-list"].forEach((selector) => {
    const element = card.querySelector(selector);
    if (!element) return;
    element.classList.remove("change-focus");
    window.requestAnimationFrame(() => element.classList.add("change-focus"));
    window.setTimeout(() => element.classList.remove("change-focus"), 2200);
  });
}

function renderHistory(leads) {
  if (!leads.length) {
    historyStatus.textContent = "No saved quotes yet. Generate a valuation and it will appear here.";
    historyList.innerHTML = "";
    return;
  }

  historyStatus.textContent = `${leads.length} saved quote${leads.length === 1 ? "" : "s"}.`;
  historyList.innerHTML = leads.map((lead, index) => {
    const input = lead.input || {};
    const valuation = lead.valuation || {};
    const title = valuation.title || historyVehicleTitle(input) || "Vehicle valuation";
    const wholesaleAvg = historyMarketAverage(valuation, "wholesale");
    const retailAvg = historyMarketAverage(valuation, "retail");
    const tradeInAvg = historyMarketAverage(valuation, "tradeIn");

    return `
      <article class="history-card">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(formatDateTime(lead.created_at))}</span>
        </div>
        <dl class="history-meta">
          <div><dt>VIN</dt><dd>${escapeHtml(valuation.vin || input.vin || "-")}</dd></div>
          <div><dt>UVC</dt><dd>${escapeHtml(input.uvc || "-")}</dd></div>
          <div><dt>Kilometers</dt><dd>${input.kilometers ? formatNumber(input.kilometers) : "-"}</dd></div>
          <div><dt>Region</dt><dd>${escapeHtml(valuation.region || input.region || "-")}</dd></div>
          <div><dt>Color</dt><dd>${escapeHtml(input.color || "Not provided")}</dd></div>
          <div><dt>Status</dt><dd>${escapeHtml(lead.status || "new")}</dd></div>
        </dl>
        <div class="history-values">
          <span>Wholesale ${formatHistoryValue(wholesaleAvg)}</span>
          <span>Retail ${formatHistoryValue(retailAvg)}</span>
          <span>Trade-In ${formatHistoryValue(tradeInAvg)}</span>
        </div>
        <div class="history-actions">
          <button type="button" data-history-index="${index}">View result</button>
          <button class="danger" type="button" data-delete-lead-id="${escapeHtml(lead.id || "")}" data-delete-title="${escapeHtml(title)}">Delete</button>
        </div>
      </article>
    `;
  }).join("");

  historyList.querySelectorAll("[data-history-index]").forEach((button) => {
    button.addEventListener("click", () => showHistoryResult(historyLeads[Number(button.dataset.historyIndex)]));
  });

  historyList.querySelectorAll("[data-delete-lead-id]").forEach((button) => {
    button.addEventListener("click", () => deleteHistoryLead(button));
  });
}

async function deleteHistoryLead(button) {
  const id = button.dataset.deleteLeadId || "";
  const title = button.dataset.deleteTitle || "this quote";
  if (!id || !authSession?.access_token) return;

  const confirmed = window.confirm(
    `Delete "${title}" from your quote history?\n\nThis cannot be undone and it will not restore your annual valuation allowance.`
  );
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "Deleting...";
  historyStatus.textContent = "Deleting quote history item...";

  try {
    const response = await fetch(`/api/my-leads?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authSession.access_token}`
      }
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Unable to delete quote");

    historyLeads = historyLeads.filter((lead) => lead.id !== id);
    renderHistory(historyLeads);
    historyStatus.textContent = "Quote deleted. Annual valuation allowance was not restored.";
    await loadUsage();
  } catch (error) {
    button.disabled = false;
    button.textContent = "Delete";
    historyStatus.textContent = error.message || "Unable to delete quote";
  }
}

function showHistoryResult(lead) {
  if (!lead) return;
  const input = lead.input || {};
  const valuation = lead.valuation || {};
  const replay = {
    ok: true,
    title: valuation.title || historyVehicleTitle(input) || "Vehicle",
    vin: valuation.vin || input.vin || "",
    kilometers: input.kilometers || valuation.kilometers || 0,
    region: valuation.region || input.region || "",
    country: valuation.country || input.country || "C",
    optionsSelected: valuation.optionsSelected || 0,
    values: valuation.values || {},
    loanValue: valuation.loanValue || null,
    thresholds: valuation.thresholds || null,
    input
  };

  currentResult = replay;
  currentMarket = firstAvailableMarket(replay) || "wholesale";
  renderResult(replay);
}

function historyVehicleTitle(input) {
  return ["year", "make", "model", "series", "style"]
    .map((key) => String(input?.[key] || "").trim())
    .filter(Boolean)
    .join(" ");
}

function historyMarketAverage(valuation, market) {
  const marketData = valuation?.values?.[market] || {};
  return marketData.adjusted?.avg ?? marketData.base?.avg ?? null;
}

function formatHistoryValue(value) {
  return value === null || value === undefined ? "-" : formatNumber(value);
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

function isDealerLeadOverdue(value, status) {
  if (!value) return false;
  const closedStatuses = new Set(["won", "lost", "closed", "deleted", "in_inventory"]);
  if (closedStatuses.has(String(status || "").toLowerCase())) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function isDealerLeadDueNow(value, status) {
  if (!value) return false;
  const closedStatuses = new Set(["won", "lost", "closed", "deleted", "in_inventory"]);
  if (closedStatuses.has(String(status || "").toLowerCase())) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return date.getTime() <= endOfToday.getTime();
}

function canUseValuation() {
  if (usageState?.unlimited || Number(usageState?.annualLimit) < 0) return true;
  if (!usageState || usageState.remaining > 0) return true;
  const message = `${usageState.year} valuation limit reached. ${usageState.contact || "Please contact the website owner for more valuations."}`;
  statusEl.textContent = message;
  modalStatus.textContent = message;
  return false;
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
