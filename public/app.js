const form = document.querySelector("#valuation-form");
const freeForm = document.querySelector("#free-form");
const drilldownForm = document.querySelector("#drilldown-form");
const statusEl = document.querySelector("#status");
const detailsEl = document.querySelector("#details");
const valueBody = document.querySelector("#value-body");
const tabs = document.querySelectorAll(".market-tabs button");
const modeButtons = document.querySelectorAll(".lookup-mode");
const choiceList = document.querySelector("#choice-list");
const authTitle = document.querySelector("#auth-title");
const authSubtitle = document.querySelector("#auth-subtitle");
const logoutButton = document.querySelector("#logout");
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

initializeDatalists();
initializeAuth();

logoutButton.addEventListener("click", async () => {
  if (supabaseClient) await supabaseClient.auth.signOut();
  setSession(null);
  window.location.replace("/login.html");
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    modeButtons.forEach((item) => item.classList.toggle("active", item === button));
    const mode = button.dataset.mode;
    freeForm.hidden = mode !== "free";
    drilldownForm.hidden = mode !== "drilldown";
  });
});

freeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireLogin()) return;
  const searchText = new FormData(freeForm).get("searchText");
  const vin = String(searchText || "").trim().toUpperCase();

  if (/^[A-HJ-NPR-Z0-9]{10,17}$/.test(vin)) {
    setValuationFields({ vin, uvc: "", year: "", make: "", model: "", series: "", style: "" });
    return runValuation();
  }

  statusEl.textContent = "Searching vehicles...";
  choiceList.hidden = true;
  const response = await fetch(`/api/autocomplete?searchText=${encodeURIComponent(searchText)}`);
  const data = await response.json();
  if (!data.ok) {
    statusEl.textContent = data.error || "Search failed.";
    return;
  }
  renderChoices(data.items || []);
});

drilldownForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireLogin()) return;
  const payload = Object.fromEntries(new FormData(drilldownForm).entries());
  setValuationFields({ vin: "", uvc: "", ...payload });
  await runValuation();
});

drilldownForm.querySelectorAll(".drill-select").forEach((select) => {
  select.addEventListener("change", () => handleDrillSelect(select));
});

drilldownForm.querySelectorAll(".manual-input").forEach((input) => {
  input.addEventListener("input", () => {
    drilldownForm.elements[input.dataset.field].value = input.value;
    if (input.dataset.field === "make" || input.dataset.field === "model") updateVehicleDropdowns();
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await runValuation();
});

async function runValuation(extra = {}) {
  if (!requireLogin()) return;
  statusEl.textContent = "Calling valuation API...";

  const formData = new FormData(form);
  const payload = {
    ...Object.fromEntries(formData.entries()),
    ...extra,
    authUserId: authSession?.user?.id || "",
    authEmail: authSession?.user?.email || ""
  };

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
      statusEl.textContent = "Multiple matches found. Choose the correct trim.";
      renderChoices(data.choices);
      return;
    }

    currentResult = data;
    currentMarket = firstAvailableMarket(data) || "wholesale";
    renderResult(data);
    await captureLead(payload, data);
    statusEl.textContent = data.source === "mock"
      ? "Rendered with mock data and lead captured locally if available."
      : "Rendered from Black Book API and lead captured.";
  } catch (error) {
    statusEl.textContent = error.message || "Unexpected error.";
  }
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

function renderChoices(items) {
  detailsEl.hidden = true;
  if (!items.length) {
    choiceList.hidden = false;
    choiceList.innerHTML = `
      <p>No vehicle matches found.</p>
      <p class="hint">Try a more specific description like "2024 Lexus NX350", or enter a full VIN and click Generate.</p>
    `;
    statusEl.textContent = "No matches.";
    return;
  }

  choiceList.hidden = false;
  choiceList.innerHTML = `
    <h2>Choose a vehicle</h2>
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

  choiceList.querySelectorAll(".choice-card").forEach((button) => {
    button.addEventListener("click", async () => {
      const item = items[Number(button.dataset.index)];
      setValuationFields({
        vin: "",
        uvc: item.uvc || "",
        year: item.year || "",
        make: item.make || "",
        model: item.model || "",
        series: item.series || "",
        style: item.style || ""
      });
      await runValuation({ uvc: item.uvc || "" });
    });
  });
}

function setValuationFields(values) {
  for (const [key, value] of Object.entries(values)) {
    const field = form.elements[key];
    if (field) field.value = value ?? "";
  }
}

function initializeDatalists() {
  setSelectOptions("year", Array.from({ length: 47 }, (_, index) => String(2027 - index)), "2017");
  setSelectOptions("make", commonMakes, "Honda");
  setSelectOptions("model", Object.values(drilldownSuggestions).flatMap((item) => item.models), "Odyssey");
  setSelectOptions("series", ["LX", "EX", "EX-L", "SE", "Sport", "Touring", "Premium", "Ultra Premium"], "LX");
  setSelectOptions("style", commonStyles, "4D Wagon");
  updateVehicleDropdowns();
}

function updateVehicleDropdowns() {
  const make = drilldownForm.elements.make.value.trim();
  const model = drilldownForm.elements.model.value.trim();
  const makeData = drilldownSuggestions[make];

  if (makeData?.models?.length) {
    setSelectOptions("model", makeData.models, drilldownForm.elements.model.value || makeData.models[0]);
  }

  const series = makeData?.series?.[model];
  const styles = makeData?.styles?.[model];
  setSelectOptions("series", series?.length ? series : ["LX", "EX", "EX-L", "SE", "Sport", "Touring", "Premium", "Ultra Premium"], drilldownForm.elements.series.value || series?.[0]);
  setSelectOptions("style", styles?.length ? styles : commonStyles, drilldownForm.elements.style.value || styles?.[0]);
}

function setSelectOptions(field, values, selectedValue = "") {
  const select = drilldownForm.querySelector(`.drill-select[data-field="${field}"]`);
  const manual = drilldownForm.querySelector(`.manual-input[data-field="${field}"]`);
  const hidden = drilldownForm.elements[field];
  const unique = [...new Set(values.filter(Boolean))];
  const withUnknown = ["model", "series", "style"].includes(field) ? [unknownOption, ...unique] : unique;
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

function handleDrillSelect(select) {
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

  if (field === "make" || field === "model") updateVehicleDropdowns();
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
    await fetch("/api/leads", {
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
  } catch (error) {
    console.warn("Lead capture failed", error);
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
  } else {
    if (supabaseClient) {
      window.location.replace("/login.html");
      return;
    }
    authTitle.textContent = "Login not configured";
    authSubtitle.textContent = "Add Supabase environment variables to enable Google login.";
    logoutButton.hidden = true;
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}
