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
const dealerLeadSummary = document.querySelector("#dealer-lead-summary");
const dealerLeadAlertsEl = document.querySelector("#dealer-lead-alerts");
const dealerTodayWorkEl = document.querySelector("#dealer-today-work");
const dealerLeadFilterButtons = document.querySelectorAll("[data-dealer-filter]");
const saveValuationLeadButton = document.querySelector("#save-valuation-lead");
const DEALER_REFRESH_MS = 30000;
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
let dealerLeadAlertMap = new Map();

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
dealerLeadSummary?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-dealer-summary-filter]");
  if (!button) return;
  setDealerLeadFilter(button.dataset.dealerSummaryFilter || "all");
  renderDealerLeads(dealerLeadsCache, dealerLeadRole);
  document.querySelector("#dealer-assigned-leads")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
setLookupMode("free", { openModal: false });

dealerLeadsList?.addEventListener("submit", async (event) => {
  const noteForm = event.target.closest(".dealer-note-form");
  const taskForm = event.target.closest(".dealer-task-form");
  if (!noteForm && !taskForm) return;
  event.preventDefault();

  const card = event.target.closest(".dealer-lead-card");
  const leadId = card?.dataset?.leadId || "";
  const isTask = Boolean(taskForm);
  const payload = {
    leadId,
    type: isTask ? "task" : "note",
    ...Object.fromEntries(new FormData(isTask ? taskForm : noteForm).entries())
  };

  dealerLeadsStatus.textContent = isTask ? "Saving task..." : "Saving note...";
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
    dealerLeadsStatus.textContent = isTask ? "Task saved." : "Note saved.";
    (isTask ? taskForm : noteForm).reset();
    await loadDealerActivity(card, { force: true });
  } catch (error) {
    dealerLeadsStatus.textContent = error.message || "Unable to save follow-up";
  }
});

dealerLeadsList?.addEventListener("click", async (event) => {
  const completeButton = event.target.closest("[data-complete-dealer-task]");
  if (completeButton) {
    const card = completeButton.closest(".dealer-lead-card");
    const leadId = card?.dataset?.leadId || "";
    const taskId = completeButton.dataset.completeDealerTask || "";
    if (!leadId || !taskId) return;
    completeButton.disabled = true;
    dealerLeadsStatus.textContent = "Marking task complete...";
    try {
      const response = await fetch("/api/lead-activity", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authSession?.access_token || ""}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ leadId, taskId, completed: true })
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Unable to complete task");
      dealerLeadsStatus.textContent = "Task completed. Admin can review it.";
      await loadDealerActivity(card, { force: true });
    } catch (error) {
      completeButton.disabled = false;
      dealerLeadsStatus.textContent = error.message || "Unable to complete task";
    }
    return;
  }

  const button = event.target.closest("[data-load-dealer-activity]");
  if (button) {
    await loadDealerActivity(button.closest(".dealer-lead-card"), { force: true });
    return;
  }

  const statusButton = event.target.closest("[data-dealer-status]");
  if (statusButton) {
    await updateDealerLeadStatus(statusButton);
    return;
  }

  const followUpButton = event.target.closest("[data-dealer-follow-up]");
  if (followUpButton) {
    await updateDealerFollowUp(followUpButton);
  }
});

dealerLeadsList?.addEventListener("toggle", async (event) => {
  const details = event.target.closest(".dealer-lead-details");
  if (!details || !details.open) return;
  const card = details.closest(".dealer-lead-card");
  if (!card) return;
  clearDealerLeadUpdateNotice(card);
  await loadDealerActivity(card);
}, true);

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
      if (dealerLeadSummary) dealerLeadSummary.innerHTML = "";
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
    loadDealerLeads({ forceActivity: true });
    startDealerAutoRefresh();
  } else {
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
    renderDealerLeads(dealerLeadsCache, dealerLeadRole);
    renderDealerLeadAlerts();
    renderDealerTodayWork(dealerLeadsCache);
  } catch (error) {
    dealerLeadsStatus.textContent = error.message || "Unable to load assigned leads";
    dealerLeadsList.innerHTML = "";
  }
}

function renderDealerLeads(leads, role) {
  renderDealerLeadSummary(leads);
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
  dealerLeadsStatus.textContent = `${visibleLeads.length} shown. ${activeCount} active / ${closedCount} closed assigned lead${leads.length === 1 ? "" : "s"}.`;
  dealerLeadsList.innerHTML = renderDealerLeadGroups(visibleLeads, (lead) => {
    const input = lead.input || {};
    const valuation = lead.valuation || {};
    const ownerAdjustment = lead.owner_adjustment || {};
    const buyerLead = isBuyerLead(lead);
    const leadKind = buyerLead ? "buyer" : "seller";
    const leadTypeLabel = buyerLead ? "BUY lead" : "SELL lead";
    const purchase = input.buyerPlan || valuation.buyerPlan || {};
    const adminNotes = buyerLead && isAutoBuyerInquiryNote(lead.notes) ? "" : lead.notes;
    const title = cleanDealerLeadTitle(valuation.title || historyVehicleTitle(input) || "Vehicle lead", buyerLead);
    const customerEmail = input.email || lead.auth_email || lead.auth_user?.email || "-";
    const followUp = lead.next_follow_up_at || "";
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
    const buyerPlanSummary = buyerLead ? `
          <section class="dealer-review-summary dealer-buyer-plan">
            <h3>Buyer plan</h3>
            <dl class="history-meta">
              <div><dt>Intent</dt><dd>${escapeHtml(purchase.intent || input.purchaseIntent || "-")}</dd></div>
              <div><dt>Timeline</dt><dd>${escapeHtml(purchase.buyingTimeline || input.buyingTimeline || "-")}</dd></div>
              <div><dt>Preferred contact</dt><dd>${escapeHtml(purchase.preferredContact || input.preferredContact || "-")}</dd></div>
              <div><dt>Payment target</dt><dd>${purchase.monthlyPayment ? `$${escapeHtml(formatNumber(purchase.monthlyPayment))} / mo` : "-"}</dd></div>
            </dl>
            ${adminNotes ? `<div class="dealer-admin-notes"><strong>Owner notes</strong><p>${escapeHtml(adminNotes)}</p></div>` : ""}
          </section>` : `
          <section class="dealer-review-summary">
            <h3>Owner review from admin</h3>
            <dl class="history-meta">
              <div><dt>Owner wholesale</dt><dd>${dealerWholesale !== "" && dealerWholesale !== null ? `$${escapeHtml(formatNumber(dealerWholesale))}` : "-"}</dd></div>
              <div><dt>Owner retail</dt><dd>${dealerRetail !== "" && dealerRetail !== null ? `$${escapeHtml(formatNumber(dealerRetail))}` : "-"}</dd></div>
              <div><dt>Reason</dt><dd>${escapeHtml(ownerAdjustment.reason || "-")}</dd></div>
            </dl>
            ${adminNotes ? `<div class="dealer-admin-notes"><strong>Owner notes</strong><p>${escapeHtml(adminNotes)}</p></div>` : ""}
          </section>`;
    const dealerEmailOptionsId = `dealer-email-options-${cssToken(lead.id || String(Math.random()))}`;
    const dealerEmailOptions = dealerDirectoryEmails.map((email) => `<option value="${escapeHtml(email)}"></option>`).join("");
    const vehicleDetails = [
      ["Year", input.year || valuation.year || ""],
      ["Make", input.make || valuation.make || ""],
      ["Model", input.model || valuation.model || ""],
      ["Series / Trim", input.series || valuation.series || ""],
      ["Style", input.style || valuation.style || ""],
      ["UVC", input.uvc || valuation.uvc || ""],
      ["Odometer", input.kilometers ? `${formatNumber(input.kilometers)} km` : ""],
      ["Region", input.region || valuation.region || ""],
      ["Postal code", input.postalCode || input.postal_code || ""],
      ["Color", input.color || ""],
      ["Ownership", input.ownershipType || input.ownership || ""],
      ["Condition notes", input.conditionNotes || input.condition_notes || ""],
      buyerLead ? ["Purchase intent", purchase.intent || input.purchaseIntent || ""] : null,
      buyerLead ? ["Buying timeline", purchase.buyingTimeline || input.buyingTimeline || ""] : null,
      buyerLead ? ["Preferred contact", purchase.preferredContact || input.preferredContact || ""] : null,
      buyerLead ? ["Payment target", purchase.monthlyPayment ? `$${formatNumber(purchase.monthlyPayment)} / mo` : ""] : null,
      buyerLead ? ["Asking price", retailAvg ? `$${formatNumber(retailAvg)}` : input.askingPrice ? `$${formatNumber(input.askingPrice)}` : ""] : ["CBB wholesale AVG", wholesaleAvg ? `$${formatNumber(wholesaleAvg)}` : ""],
      buyerLead ? null : ["CBB retail AVG", retailAvg ? `$${formatNumber(retailAvg)}` : ""]
    ].filter(Boolean).filter(([, value]) => value !== "" && value !== null && value !== undefined);

    const updateToken = dealerLeadUpdateToken(lead);
    const progressSteps = renderDealerLeadProgress(buyerLead, status);
    const actionButtons = dealerStatusActions(buyerLead, status)
      .map((action) => `<button type="button" data-dealer-status="${escapeHtml(action.status)}">${escapeHtml(action.label)}</button>`)
      .join("");
    const followUpButtons = dealerFollowUpActions()
      .map((action) => `<button type="button" data-dealer-follow-up="${escapeHtml(action.key)}">${escapeHtml(action.label)}</button>`)
      .join("");

    return `
      <article class="history-card dealer-lead-card dealer-lead-${leadKind} ${overdue ? "lead-overdue" : ""} ${pendingAlert ? "dealer-lead-updated" : ""}" data-lead-id="${escapeHtml(lead.id || "")}" data-update-token="${escapeHtml(updateToken)}">
        <div class="dealer-lead-top">
          <div>
            <div class="dealer-lead-title">
              <b class="dealer-type-pill dealer-type-${leadKind}">${escapeHtml(leadTypeLabel)}</b>
              <strong>${escapeHtml(title)}</strong>
            </div>
            <span>${escapeHtml(formatDateTime(lead.created_at))}</span>
          </div>
          <b class="dealer-status-badge ${escapeHtml(statusClass)}">${escapeHtml(statusLabel)}</b>
        </div>
        ${pendingAlert ? `<button class="lead-inline-alert" type="button" data-dealer-open-alert="${escapeHtml(lead.id || "")}">New update on this lead</button>` : ""}
        <p class="dealer-update-notice" ${pendingAlert ? "" : "hidden"}>Task or follow-up activity changed. Open this lead to review the latest update.</p>
        <dl class="history-meta">
          <div><dt>Customer</dt><dd>${escapeHtml(customerEmail)}</dd></div>
          <div><dt>Phone</dt><dd>${escapeHtml(input.phone || "-")}</dd></div>
          <div><dt>VIN</dt><dd>${escapeHtml(valuation.vin || input.vin || "-")}</dd></div>
          <div><dt>Lead type</dt><dd>${escapeHtml(leadTypeLabel)}</dd></div>
          ${buyerLead ? `<div><dt>Buyer intent</dt><dd>${escapeHtml(purchase.intent || input.purchaseIntent || "-")}</dd></div>` : ""}
          <div><dt>Status</dt><dd>${escapeHtml(status)}</dd></div>
          <div><dt>Priority</dt><dd>${escapeHtml(lead.priority || "normal")}</dd></div>
          <div><dt>Next follow-up</dt><dd>${escapeHtml(followUp ? formatDateTime(followUp) : "-")}</dd></div>
        </dl>
        ${progressSteps}
        ${actionButtons ? `<div class="dealer-lead-actions">${actionButtons}</div>` : ""}
        <div class="dealer-lead-actions dealer-follow-up-actions" aria-label="Set next follow-up">
          ${followUpButtons}
        </div>
        <details class="dealer-lead-details">
          <summary>Open lead details, tasks, and activity</summary>
          <section class="dealer-info-block">
            <h3>Vehicle details</h3>
            <dl class="history-meta dealer-detail-grid">
              ${vehicleDetails.map(([label, value]) => `
                <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>
              `).join("")}
            </dl>
          </section>
          ${buyerPlanSummary}
          ${overdue ? `<p class="status overdue-text">Overdue follow-up</p>` : ""}
          <form class="dealer-note-form">
            <select name="noteType">
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="inspection">Inspection</option>
              <option value="offer">Offer</option>
              <option value="internal">Internal note</option>
            </select>
            <textarea name="note" placeholder="Record calls, inspection result, or corrections for admin approval. Price and inventory fields are owner-only."></textarea>
            <button type="submit">Add note</button>
          </form>
          <form class="dealer-task-form">
            <input name="title" placeholder="Next task" />
            <input name="assignedTo" type="email" list="${escapeHtml(dealerEmailOptionsId)}" placeholder="Assign to dealer email" />
            <datalist id="${escapeHtml(dealerEmailOptionsId)}">${dealerEmailOptions}</datalist>
            <input name="dueAt" type="datetime-local" />
            <button type="submit">Add task</button>
          </form>
          <div class="dealer-activity-list">
            <button type="button" data-load-dealer-activity>Refresh activity</button>
          </div>
        </details>
      </article>
    `;
  });
}

function setDealerLeadFilter(filter) {
  dealerLeadFilter = filter || "all";
  dealerLeadFilterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.dealerFilter === dealerLeadFilter);
  });
}

function renderDealerLeadSummary(leads) {
  if (!dealerLeadSummary) return;
  const activeLeads = leads.filter((lead) => !isDealerClosedLead(lead));
  const buyer = activeLeads.filter(isBuyerLead).length;
  const seller = activeLeads.length - buyer;
  const due = activeLeads.filter((lead) => isDealerLeadDueNow(lead.next_follow_up_at || "", lead.status || "new")).length;
  const priority = activeLeads.filter((lead) => ["high", "urgent"].includes(String(lead.priority || "").toLowerCase())).length;
  const closed = leads.length - activeLeads.length;
  const updated = dealerLeadAlertMap.size;
  dealerLeadSummary.innerHTML = [
    ["Active", activeLeads.length, "Current assigned work", "active"],
    ["High priority", priority, "High or urgent leads", "priority"],
    ["BUY", buyer, "Buyer inquiries from inventory", "buyer"],
    ["SELL", seller, "Seller valuation leads", "seller"],
    ["Needs follow-up", due, "Overdue or due today", "due"],
    ["Closed", closed, "Done or moved to inventory", "closed"],
    ["Updated", updated, "Changed since last refresh", "all"]
  ].map(([label, value, hint, filter]) => `
    <button type="button" data-dealer-summary-filter="${escapeHtml(filter || "all")}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(hint)}</small>
    </button>
  `).join("");
}

function renderDealerTodayWork(leads) {
  if (!dealerTodayWorkEl) return;
  const activeLeads = leads.filter((lead) => !isDealerClosedLead(lead));
  const priorityLeads = activeLeads
    .filter((lead) => ["high", "urgent"].includes(String(lead.priority || "").toLowerCase()))
    .slice(0, 5);
  const dueLeads = activeLeads
    .filter((lead) => isDealerLeadDueNow(lead.next_follow_up_at || "", lead.status || "new"))
    .slice(0, 5);
  const updatedLeads = [...dealerLeadAlertMap.values()]
    .map((alert) => leads.find((lead) => String(lead.id || "") === String(alert.id || "")))
    .filter(Boolean)
    .filter((lead, index, list) => list.findIndex((item) => item.id === lead.id) === index)
    .slice(0, 5);
  dealerTodayWorkEl.hidden = false;
  const quickList = priorityLeads.length ? priorityLeads : dueLeads.length ? dueLeads : updatedLeads;
  const todayTitle = priorityLeads.length
    ? `${priorityLeads.length} high priority lead${priorityLeads.length === 1 ? "" : "s"}`
    : dueLeads.length
      ? `${dueLeads.length} follow-up${dueLeads.length === 1 ? "" : "s"} due`
      : `${updatedLeads.length} updated lead${updatedLeads.length === 1 ? "" : "s"}`;
  dealerTodayWorkEl.innerHTML = quickList.length ? `
    <header>
      <div>
        <span>Today</span>
        <strong>${todayTitle}</strong>
      </div>
      <button type="button" data-dealer-filter-shortcut="${priorityLeads.length ? "priority" : dueLeads.length ? "due" : "active"}">${priorityLeads.length ? "View priority" : dueLeads.length ? "View all due" : "View active"}</button>
    </header>
    <div class="dealer-today-list">
      ${quickList.map((lead) => {
        const input = lead.input || {};
        const valuation = lead.valuation || {};
        const title = cleanDealerLeadTitle(valuation.title || historyVehicleTitle(input) || "Vehicle lead", isBuyerLead(lead));
        return `
          <button type="button" data-dealer-open-lead="${escapeHtml(lead.id || "")}">
            <b>${escapeHtml(title)}</b>
            <span>${escapeHtml(lead.next_follow_up_at ? formatDateTime(lead.next_follow_up_at) : "No follow-up time")}</span>
          </button>
        `;
      }).join("")}
    </div>
  ` : `
    <header>
      <div>
        <span>Today</span>
        <strong>No due follow-ups right now</strong>
      </div>
      <button type="button" data-dealer-filter-shortcut="active">View active leads</button>
    </header>
    <div class="dealer-today-empty">
      <b>Your current queue is clear.</b>
      <span>Use Assigned leads for the full pipeline or Valuation when you need to price a vehicle manually.</span>
    </div>
  `;
}

function filterDealerLeads(leads) {
  if (dealerLeadFilter === "active") return leads.filter((lead) => !isDealerClosedLead(lead));
  if (dealerLeadFilter === "closed") return leads.filter(isDealerClosedLead);
  if (dealerLeadFilter === "priority") return leads.filter((lead) => !isDealerClosedLead(lead) && ["high", "urgent"].includes(String(lead.priority || "").toLowerCase()));
  if (dealerLeadFilter === "buyer") return leads.filter((lead) => !isDealerClosedLead(lead) && isBuyerLead(lead));
  if (dealerLeadFilter === "seller") return leads.filter((lead) => !isDealerClosedLead(lead) && !isBuyerLead(lead));
  if (dealerLeadFilter === "due") {
    return leads.filter((lead) => !isDealerClosedLead(lead) && isDealerLeadDueNow(lead.next_follow_up_at || "", lead.status || "new"));
  }
  return leads;
}

function sortDealerLeads(leads) {
  const priorityRank = { urgent: 0, high: 1, normal: 2, low: 3 };
  return [...leads].sort((a, b) => {
    const priorityDiff = (priorityRank[String(a.priority || "normal").toLowerCase()] ?? 2) - (priorityRank[String(b.priority || "normal").toLowerCase()] ?? 2);
    if (priorityDiff) return priorityDiff;
    const aDue = new Date(a.next_follow_up_at || a.created_at || 0).getTime();
    const bDue = new Date(b.next_follow_up_at || b.created_at || 0).getTime();
    return (Number.isNaN(aDue) ? Infinity : aDue) - (Number.isNaN(bDue) ? Infinity : bDue);
  });
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
      <div class="dealer-lead-group-list">
        ${group.leads.map(cardRenderer).join("")}
      </div>
    </section>
  `).join("");
}

function isBuyerLead(lead) {
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  return input.leadType === "buyer_inquiry" || valuation.source === "buyer_inquiry";
}

function isDealerClosedLead(lead) {
  return ["won", "lost", "closed", "deleted", "in_inventory"].includes(String(lead?.status || "").toLowerCase());
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
        ["appointment_booked", "Book appointment"],
        ["finance_sent", "Finance sent"],
        ["won", "Won"],
        ["lost", "Lost"]
      ]
    : [
        ["contacted", "Mark contacted"],
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

async function updateDealerFollowUp(button) {
  const card = button.closest(".dealer-lead-card");
  const leadId = card?.dataset?.leadId || "";
  const key = button.dataset.dealerFollowUp || "tomorrow";
  if (!leadId) return;

  const dueAt = dealerFollowUpDate(key);
  button.disabled = true;
  dealerLeadsStatus.textContent = "Setting next follow-up...";
  try {
    const response = await fetch("/api/lead-activity", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${authSession?.access_token || ""}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        leadId,
        action: "follow_up",
        dueAt,
        note: `Dealer set next follow-up for ${formatDateTime(dueAt)}.`
      })
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Unable to set follow-up");
    dealerLeadsStatus.textContent = "Next follow-up updated.";
    await loadDealerLeads({ forceActivity: true });
  } catch (error) {
    dealerLeadsStatus.textContent = error.message || "Unable to set follow-up";
    button.disabled = false;
  }
}

async function updateDealerLeadStatus(button) {
  const card = button.closest(".dealer-lead-card");
  const leadId = card?.dataset?.leadId || "";
  const status = button.dataset.dealerStatus || "";
  if (!leadId || !status) return;

  button.disabled = true;
  dealerLeadsStatus.textContent = "Updating lead status...";
  try {
    const response = await fetch("/api/lead-activity", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${authSession?.access_token || ""}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        leadId,
        action: "status",
        status,
        note: `Dealer updated status to ${status.replaceAll("_", " ")}.`
      })
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Unable to update lead status");
    dealerLeadsStatus.textContent = "Lead status updated.";
    await loadDealerLeads({ forceActivity: true });
  } catch (error) {
    dealerLeadsStatus.textContent = error.message || "Unable to update lead status";
    button.disabled = false;
  }
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

async function loadVisibleDealerActivities(options = {}) {
  const cards = [...dealerLeadsList.querySelectorAll(".dealer-lead-card")];
  await Promise.all(cards.map((card) => loadDealerActivity(card, { force: Boolean(options.force) })));
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
    renderDealerLeadSummary(dealerLeadsCache);
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
  if (options.fromAlert) {
    dealerLeadAlertMap.delete(id);
    renderDealerLeadAlerts();
    renderDealerLeadSummary(dealerLeadsCache);
    clearDealerLeadUpdateNotice(card);
  }
  card.classList.add("lead-card-flash");
  window.setTimeout(() => card.classList.remove("lead-card-flash"), 1600);
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  const details = card.querySelector(".dealer-lead-details");
  if (details) details.open = true;
  if (options.fromAlert) highlightDealerLeadChangeAreas(card);
  await loadDealerActivity(card, { force: true, highlightLatest: Boolean(options.fromAlert) });
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
  renderDealerLeadSummary(dealerLeadsCache);
}

async function loadDealerActivity(card, options = {}) {
  if (!card?.dataset?.leadId) return;
  if (card.dataset.activityLoaded === "true" && !options.force) return;
  const list = card.querySelector(".dealer-activity-list");
  if (list) list.textContent = "Loading activity...";

  try {
    const response = await fetch(`/api/lead-activity?leadId=${encodeURIComponent(card.dataset.leadId)}`, {
      headers: {
        Authorization: `Bearer ${authSession?.access_token || ""}`
      }
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Unable to load activity");
    card.dataset.activityLoaded = "true";
    if (list) list.innerHTML = renderDealerActivity(data, { highlightLatest: Boolean(options.highlightLatest) });
  } catch (error) {
    if (list) list.textContent = error.message || "Unable to load activity";
  }
}

function renderDealerActivity(data, options = {}) {
  const latestKey = options.highlightLatest ? latestDealerActivityKey(data) : "";
  const tasks = (data.tasks || []).map((task) => {
    const dueText = task.due_at ? ` - Due ${escapeHtml(formatDateTime(task.due_at))}` : " - No due date";
    const action = task.completed_at
      ? `<span class="task-complete-note">Completed ${escapeHtml(formatDateTime(task.completed_at))}</span>`
      : `<button type="button" data-complete-dealer-task="${escapeHtml(task.id || "")}">Mark complete</button>`;
    return `
      <article class="activity-item ${task.completed_at ? "activity-done" : ""} ${latestKey === `task:${task.id}` ? "activity-highlight" : ""}">
        <div>
          <strong>${escapeHtml(task.title || "Task")}</strong>
          <span>Assigned to ${escapeHtml(task.assigned_to || "unassigned")}${dueText}</span>
        </div>
        ${action}
      </article>
    `;
  });

  const notes = (data.notes || []).map((note) => `
    <article class="activity-item ${latestKey === `note:${note.id}` ? "activity-highlight" : ""}">
      <div>
        <strong>${escapeHtml(note.note_type || "note")} by ${escapeHtml(note.author_email || "-")}</strong>
        <span>${escapeHtml(formatDateTime(note.created_at))}</span>
        <p>${escapeHtml(note.note || "")}</p>
      </div>
    </article>
  `);

  return [...tasks, ...notes].join("") || "<p>No activity yet.</p>";
}

function latestDealerActivityKey(data) {
  const items = [
    ...(data.tasks || []).map((item) => ({ key: `task:${item.id}`, at: item.completed_at || item.created_at || item.due_at })),
    ...(data.notes || []).map((item) => ({ key: `note:${item.id}`, at: item.created_at }))
  ];
  return items
    .map((item) => ({ ...item, time: new Date(item.at || 0).getTime() }))
    .filter((item) => item.key && !Number.isNaN(item.time))
    .sort((a, b) => b.time - a.time)[0]?.key || "";
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
