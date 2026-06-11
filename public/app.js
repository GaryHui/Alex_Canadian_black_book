const form = document.querySelector("#valuation-form");
const freeForm = document.querySelector("#free-form");
const drilldownForm = document.querySelector("#drilldown-form");
const statusEl = document.querySelector("#status");
const detailsEl = document.querySelector("#details");
const valueBody = document.querySelector("#value-body");
const tabs = document.querySelectorAll(".market-tabs button");
const modeButtons = document.querySelectorAll(".lookup-mode");
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
let usageState = null;
let drilldownRequestId = 0;
let historyLeads = [];

initializeDatalists();
initializeAuth();

reloadHistoryButton.addEventListener("click", loadHistory);

logoutButton.addEventListener("click", async () => {
  if (supabaseClient) await supabaseClient.auth.signOut();
  setSession(null);
  window.location.replace("/login.html");
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    modeButtons.forEach((item) => item.classList.toggle("active", item === button));
    const mode = button.dataset.mode;
    if (mode === "free") openSearchModal();
    drilldownForm.hidden = mode !== "drilldown";
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
  const vinSearch = findVinInPayload(payload);
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
    if (!session?.user) window.location.replace("/login.html");
  });
}

function setSession(session) {
  authSession = session;
  const emailField = form.elements.email;

  if (session?.user) {
    const email = session.user.email || "";
    authTitle.textContent = `Signed in as ${email}`;
    authSubtitle.textContent = "Your valuation request will be saved for follow-up.";
    logoutButton.hidden = false;
    emailField.value = email;
    loadUsage();
    loadHistory();
  } else {
    if (supabaseClient) {
      window.location.replace("/login.html");
      return;
    }
    authTitle.textContent = "Login not configured";
    authSubtitle.textContent = "Add Supabase environment variables to enable Google login.";
    logoutButton.hidden = true;
    quotaPanel.hidden = true;
    historyPanel.hidden = true;
    historyList.innerHTML = "";
    historyLeads = [];
    emailField.value = "";
  }
}

function requireLogin() {
  if (authSession?.user) return true;
  if (!supabaseClient) {
    statusEl.textContent = "Supabase Google login is not configured yet. Add Supabase env vars to enable this flow.";
  } else {
    statusEl.textContent = "Please sign in with Google first.";
  }
  return false;
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
    quotaTitle.textContent = `${data.remaining} left`;
    quotaSubtitle.textContent = `${data.used} used of ${data.annualLimit} in ${data.year}`;
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

function canUseValuation() {
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
