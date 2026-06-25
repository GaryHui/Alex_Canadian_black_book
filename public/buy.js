const sampleInventory = [
  {
    id: "sample-lexus-nx",
    title: "2024 Lexus NX 350 Premium AWD",
    price: 51900,
    kilometers: 37000,
    region: "British Columbia",
    color: "White",
    tags: ["SUV", "AWD", "Hybrid-ready"],
    photoTone: "blue"
  },
  {
    id: "sample-audi-a7",
    title: "2019 Audi A7 Technik 3.0T",
    price: 43800,
    kilometers: 50000,
    region: "British Columbia",
    color: "Gray",
    tags: ["Sportback", "AWD", "Luxury"],
    photoTone: "silver"
  },
  {
    id: "sample-toyota-rav4",
    title: "2022 Toyota RAV4 XLE AWD",
    price: 34900,
    kilometers: 61200,
    region: "Ontario",
    color: "Black",
    tags: ["SUV", "AWD", "Fuel efficient"],
    photoTone: "green"
  }
];

const text = {
  en: {
    brandName: "AutoSwitch Canada",
    sellNav: "Sell",
    dealerNav: "Dealer portal",
    eyebrow: "Dealer-reviewed inventory",
    headline: "Find your next vehicle",
    subhead: "Browse available vehicles, estimate monthly payments, and contact the dealer when you are ready.",
    heroPointOne: "Verified listings",
    heroPointTwo: "Transparent pricing",
    heroPointThree: "Dealer follow-up",
    searchLabel: "Search",
    searchPlaceholder: "Lexus, SUV, 2024...",
    makeLabel: "Make",
    makeAny: "Any Make",
    modelLabel: "Model",
    modelAny: "Any Model",
    priceRangeLabel: "Monthly",
    priceAny: "Any Monthly",
    typeLabel: "Type",
    typeAny: "Any Type",
    filtersLabel: "Filters",
    regionLabel: "Region",
    regionAny: "Any Region",
    maxKmLabel: "Max KM",
    sortLabel: "Sort",
    sortMonthlyAsc: "Monthly low to high",
    sortMonthlyDesc: "Monthly high to low",
    sortPriceAsc: "Price low to high",
    sortPriceDesc: "Price high to low",
    sortYearDesc: "Newest year",
    sortKmAsc: "Lowest KM",
    sortRecent: "Recently added",
    budgetLabel: "Max price",
    monthlyBudgetLabel: "Max monthly payment",
    dealMonthlyLabel: "Finance from",
    dealDownLabel: "Initial down",
    dealTermLabel: "Term",
    dealRateLabel: "APR",
    filterButton: "Update search",
    clearFilters: "Clear",
    sendEstimateButton: "Send this estimate to dealer",
    sendEstimateDisabled: "Choose a vehicle first",
    filterEyebrow: "Vehicle search",
    inventoryEyebrow: "Available vehicles",
    inventoryTitle: "Current marketplace preview",
    inventoryIntro: "Browse dealer-reviewed vehicles when they are available.",
    inventoryEmptyIntro: "New dealer-reviewed vehicles will appear here when they are published.",
    financeEyebrow: "Finance estimate",
    financeTitle: "Monthly payment calculator",
    paymentModeLabel: "Payment type",
    paymentModeFinance: "Finance",
    paymentModeLease: "Lease",
    priceLabel: "Vehicle price",
    downLabel: "Down payment",
    rateLabel: "Annual rate",
    termLabel: "Term",
    taxLabel: "Tax rate",
    residualLabel: "Lease residual",
    financeNote: "Estimate only. Final approval, rate, term, and fees depend on the dealer and lender.",
    contactDealer: "Contact dealer",
    viewDetails: "View details",
    inventoryReal: "Showing published dealer inventory.",
    inventoryEmpty: "No vehicles are available right now.",
    inventoryDemo: "Demo inventory is shown because the inventory backend is not configured or unavailable.",
    resultsLabel: "vehicle available",
    resultsLabelPlural: "vehicles available",
    resultsFilteredLabel: "matching vehicle",
    resultsFilteredLabelPlural: "matching vehicles",
    detailEyebrow: "Vehicle details",
    detailPrice: "Price",
    detailMonthly: "Finance estimate",
    detailKilometers: "Kilometers",
    detailRegion: "Region",
    detailColor: "Color",
    detailVin: "VIN",
    detailUvc: "UVC",
    detailSource: "Source lead",
    detailDescription: "Description",
    detailUseCalculator: "Estimate payment",
    detailsOrder: "Details & order",
    contactEyebrow: "Dealer message",
    contactTitle: "Send buying intent",
    purchaseTitle: "Financial estimate",
    purchaseFinance: "Finance",
    purchaseLease: "Lease",
    purchaseCash: "Cash",
    purchaseUndecided: "Not sure",
    purchaseFinanceSummary: "Finance estimate",
    purchaseLeaseSummary: "Lease estimate",
    purchaseCashSummary: "Cash purchase",
    purchaseUndecidedSummary: "Buyer is still deciding between cash, finance, and lease.",
    timelineLabel: "Buying timeline",
    timelineAsap: "As soon as possible",
    timelineWeek: "This week",
    timelineMonth: "This month",
    timelineResearch: "Just researching",
    preferredContactLabel: "Preferred contact",
    preferredPhone: "Phone",
    preferredEmail: "Email",
    preferredEither: "Either",
    contactName: "Name",
    contactEmail: "Email",
    contactPhone: "Phone",
    contactMessage: "Message",
    contactSubmit: "Send message",
    contactDefaultMessage: "Hi, I am interested in this vehicle. Please contact me with availability and next steps.",
    contactNeedInfo: "Please provide an email or phone number.",
    contactSending: "Sending message...",
    contactSent: "Message sent. The dealer team can review it in the admin inbox.",
    contactFailed: "Unable to send message. Please try again.",
    notAvailable: "Not available",
    noResults: "No vehicles match the current filters."
  },
  fr: {
    brandName: "AutoSwitch Canada",
    sellNav: "Vendre",
    dealerNav: "Portail concessionnaire",
    eyebrow: "Inventaire revise par le concessionnaire",
    headline: "Trouvez votre prochain vehicule",
    subhead: "Consultez les vehicules disponibles, estimez les paiements mensuels et contactez le concessionnaire.",
    heroPointOne: "Annonces verifiees",
    heroPointTwo: "Prix transparents",
    heroPointThree: "Suivi concessionnaire",
    searchLabel: "Recherche",
    searchPlaceholder: "Lexus, VUS, 2024...",
    makeLabel: "Marque",
    makeAny: "Toute marque",
    modelLabel: "Modele",
    modelAny: "Tout modele",
    priceRangeLabel: "Mensuel",
    priceAny: "Tout mensuel",
    typeLabel: "Type",
    typeAny: "Tout type",
    filtersLabel: "Filtres",
    regionLabel: "Region",
    regionAny: "Toute region",
    maxKmLabel: "KM max.",
    sortLabel: "Trier",
    sortMonthlyAsc: "Mensuel croissant",
    sortMonthlyDesc: "Mensuel decroissant",
    sortPriceAsc: "Prix croissant",
    sortPriceDesc: "Prix decroissant",
    sortYearDesc: "Annee recente",
    sortKmAsc: "KM le plus bas",
    sortRecent: "Ajouts recents",
    budgetLabel: "Prix maximum",
    monthlyBudgetLabel: "Paiement mensuel max.",
    dealMonthlyLabel: "Financement des",
    dealDownLabel: "Mise initiale",
    dealTermLabel: "Duree",
    dealRateLabel: "TAEG",
    filterButton: "Mettre a jour",
    clearFilters: "Effacer",
    sendEstimateButton: "Envoyer cette estimation",
    sendEstimateDisabled: "Choisissez d'abord un vehicule",
    filterEyebrow: "Recherche de vehicule",
    inventoryEyebrow: "Vehicules disponibles",
    inventoryTitle: "Apercu du marche",
    inventoryIntro: "Consultez les vehicules verifies par le concessionnaire lorsqu'ils sont disponibles.",
    inventoryEmptyIntro: "Les vehicules verifies par le concessionnaire apparaitront ici lorsqu'ils seront publies.",
    financeEyebrow: "Estimation de financement",
    financeTitle: "Calculateur de paiement mensuel",
    paymentModeLabel: "Type de paiement",
    paymentModeFinance: "Financement",
    paymentModeLease: "Location",
    priceLabel: "Prix du vehicule",
    downLabel: "Mise de fonds",
    rateLabel: "Taux annuel",
    termLabel: "Duree",
    taxLabel: "Taux de taxe",
    residualLabel: "Valeur residuelle",
    financeNote: "Estimation seulement. L'approbation, le taux, la duree et les frais dependent du concessionnaire et du preteur.",
    contactDealer: "Contacter le concessionnaire",
    viewDetails: "Voir les details",
    inventoryReal: "Inventaire publie par l'equipe du concessionnaire.",
    inventoryEmpty: "Aucun vehicule disponible pour le moment.",
    inventoryDemo: "Un inventaire de demo est affiche parce que le backend d'inventaire n'est pas configure ou disponible.",
    resultsLabel: "vehicule disponible",
    resultsLabelPlural: "vehicules disponibles",
    resultsFilteredLabel: "vehicule trouve",
    resultsFilteredLabelPlural: "vehicules trouves",
    detailEyebrow: "Details du vehicule",
    detailPrice: "Prix",
    detailMonthly: "Estimation de financement",
    detailKilometers: "Kilometres",
    detailRegion: "Region",
    detailColor: "Couleur",
    detailVin: "NIV",
    detailUvc: "UVC",
    detailSource: "Lead source",
    detailDescription: "Description",
    detailUseCalculator: "Estimer le paiement",
    detailsOrder: "Details et commande",
    contactEyebrow: "Message au concessionnaire",
    contactTitle: "Envoyer mon intention d'achat",
    purchaseTitle: "Estimation financiere",
    purchaseFinance: "Financement",
    purchaseLease: "Location",
    purchaseCash: "Comptant",
    purchaseUndecided: "Pas certain",
    purchaseFinanceSummary: "Estimation de financement",
    purchaseLeaseSummary: "Estimation de location",
    purchaseCashSummary: "Achat comptant",
    purchaseUndecidedSummary: "L'acheteur hesite encore entre comptant, financement et location.",
    timelineLabel: "Delai d'achat",
    timelineAsap: "Des que possible",
    timelineWeek: "Cette semaine",
    timelineMonth: "Ce mois-ci",
    timelineResearch: "Recherche seulement",
    preferredContactLabel: "Contact prefere",
    preferredPhone: "Telephone",
    preferredEmail: "Courriel",
    preferredEither: "Les deux",
    contactName: "Nom",
    contactEmail: "Courriel",
    contactPhone: "Telephone",
    contactMessage: "Message",
    contactSubmit: "Envoyer le message",
    contactDefaultMessage: "Bonjour, ce vehicule m'interesse. Veuillez me contacter avec la disponibilite et les prochaines etapes.",
    contactNeedInfo: "Veuillez fournir un courriel ou un numero de telephone.",
    contactSending: "Envoi du message...",
    contactSent: "Message envoye. L'equipe du concessionnaire peut le voir dans l'administration.",
    contactFailed: "Impossible d'envoyer le message. Veuillez reessayer.",
    notAvailable: "Non disponible",
    noResults: "Aucun vehicule ne correspond aux filtres."
  }
};

let language = localStorage.getItem("customer-language") || "en";
let inventory = [...sampleInventory];
let filteredInventory = [...inventory];
let inventorySource = "sample";

const languageToggle = document.querySelector("#language-toggle");
const inventoryList = document.querySelector("#inventory-list");
const inventoryFilter = document.querySelector("#inventory-filter");
const financeForm = document.querySelector("#finance-form");
const paymentOutput = document.querySelector("#payment-output");
const sendEstimateButton = document.querySelector("#send-estimate-button");
const inventorySourceStatus = document.querySelector("#inventory-source-status");
const inventoryResultsCount = document.querySelector("#inventory-results-count");
const inventorySort = document.querySelector("#inventory-sort");
const moreFiltersPanel = document.querySelector("#marketplace-more-filters");
const moreFiltersToggle = document.querySelector("[data-toggle-marketplace-filters]");
const marketplaceFilterCount = document.querySelector("#marketplace-filter-count");
const vehicleDetailModal = document.querySelector("#vehicle-detail-modal");
const vehicleDetailTitle = document.querySelector("#vehicle-detail-title");
const vehicleDetailPriceSummary = document.querySelector("#vehicle-detail-price-summary");
const vehicleDetailBody = document.querySelector("#vehicle-detail-body");
const detailPaymentPanel = document.querySelector("#detail-payment-panel");
const detailOrderTitle = document.querySelector("#detail-order-title");
const detailOrderSubtitle = document.querySelector("#detail-order-subtitle");
const detailOrderPayment = document.querySelector("#detail-order-payment");
const detailOrderFees = document.querySelector("#detail-order-fees");
const contactDealerModal = document.querySelector("#contact-dealer-modal");
const contactDealerForm = document.querySelector("#contact-dealer-form");
const contactDealerStatus = document.querySelector("#contact-dealer-status");
const contactVehicleTitle = document.querySelector("#contact-vehicle-title");
const contactVehicleContext = document.querySelector("#contact-vehicle-context");
const contactFinanceSummary = document.querySelector("#contact-finance-summary");
const filterChipButtons = document.querySelectorAll("[data-filter-chip]");
const clearFilterButton = document.querySelector("[data-clear-filters]");
let currentContactVehicle = null;
let selectedFinanceVehicle = null;
let filterInputTimer = null;

function money(value) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function renderInventory() {
  updateInventoryResultsCount();
  if (!filteredInventory.length) {
    const emptyText = inventorySource === "supabase-empty" ? text[language].inventoryEmpty : text[language].noResults;
    inventoryList.innerHTML = `<div class="inventory-empty"><strong>${escapeHtml(emptyText)}</strong><p>${escapeHtml(text[language].inventoryEmptyIntro)}</p></div>`;
    return;
  }

  inventoryList.innerHTML = filteredInventory.map((vehicle) => {
    const deal = vehicleDeal(vehicle);
    const specs = vehicleSpecItems(vehicle);
    const tags = vehicle.tags.filter((tag) => tag && !specs.some((item) => String(item.value).toLowerCase() === String(tag).toLowerCase())).slice(0, 2);
    return `
    <article class="inventory-card inventory-deal-card">
      ${vehicleImageMarkup(vehicle)}
      <div class="inventory-card-body">
        <header class="inventory-card-copy inventory-deal-copy">
          <h3>${escapeHtml(vehicle.title)}</h3>
          <p>${escapeHtml(money(vehicle.price))} CBB-based dealer price</p>
          ${tags.length ? `<div class="inventory-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        </header>
        <div class="inventory-spec-row" aria-label="Vehicle specs">
          ${specs.map((item) => `
            <span>
              ${specIcon(item.icon)}
              <b>${escapeHtml(item.value)}</b>
              <small>${escapeHtml(item.label)}</small>
            </span>
          `).join("")}
        </div>
        <div class="inventory-card-price inventory-deal-price">
          <span>${escapeHtml(text[language].dealMonthlyLabel)}</span>
          <strong>${money(deal.monthly)} / mo</strong>
          <small>${escapeHtml(money(vehicle.price))} CBB-based dealer price</small>
          <div class="inventory-deal-terms" aria-label="Estimated payment terms">
            <span><b>${escapeHtml(money(deal.downPayment))}</b>${escapeHtml(text[language].dealDownLabel)}</span>
            <span><b>${escapeHtml(String(deal.termMonths))} mo</b>${escapeHtml(text[language].dealTermLabel)}</span>
            <span><b>${escapeHtml(String(deal.annualRate))}%</b>${escapeHtml(text[language].dealRateLabel)}</span>
          </div>
        </div>
        <div class="inventory-card-actions">
          <button class="primary-button inventory-order-button" type="button" data-view-vehicle="${escapeHtml(vehicle.id)}">
            <span>${escapeHtml(text[language].detailsOrder)}</span>
            ${specIcon("arrow")}
          </button>
        </div>
      </div>
    </article>
  `;
  }).join("");
}

async function loadInventory() {
  try {
    const response = await fetch("/api/inventory");
    const data = await response.json();
    if (data.ok && data.storage === "supabase" && Array.isArray(data.inventory)) {
      inventorySource = data.inventory.length ? "supabase" : "supabase-empty";
      inventory = data.inventory.map(normalizeInventoryVehicle).filter((vehicle) => vehicle.title);
      filteredInventory = [...inventory];
      updateInventoryIntro();
      updateInventorySourceStatus();
      return;
    }
  } catch (error) {
    console.warn("Unable to load inventory", error);
  }
  inventorySource = "sample";
  inventory = [...sampleInventory];
  filteredInventory = [...inventory];
  updateInventoryIntro();
  updateInventorySourceStatus();
}

function updateInventoryIntro() {
  const intro = document.querySelector("[data-i18n='inventoryIntro']");
  if (!intro) return;
  if (inventorySource === "supabase") {
    intro.textContent = text[language].inventoryReal;
  } else if (inventorySource === "supabase-empty") {
    intro.textContent = text[language].inventoryEmptyIntro;
  } else {
    intro.textContent = text[language].inventoryIntro;
  }
}

function updateInventorySourceStatus() {
  if (!inventorySourceStatus) return;
  if (inventorySource === "supabase") {
    inventorySourceStatus.textContent = text[language].inventoryReal;
  } else if (inventorySource === "supabase-empty") {
    inventorySourceStatus.textContent = "";
  } else {
    inventorySourceStatus.textContent = text[language].inventoryDemo;
  }
}

function updateInventoryResultsCount() {
  if (!inventoryResultsCount) return;
  const count = filteredInventory.length;
  const data = inventoryFilter ? new FormData(inventoryFilter) : null;
  const hasFilters = Boolean(
    String(data?.get("query") || "").trim()
    || String(data?.get("make") || "").trim()
    || String(data?.get("model") || "").trim()
    || String(data?.get("priceRange") || "").trim()
    || String(data?.get("type") || "").trim()
    || String(data?.get("region") || "").trim()
    || String(data?.get("maxKm") || "").trim()
  );
  const key = hasFilters
    ? count === 1 ? "resultsFilteredLabel" : "resultsFilteredLabelPlural"
    : count === 1 ? "resultsLabel" : "resultsLabelPlural";
  inventoryResultsCount.textContent = `${count} ${text[language][key]}`;
  updateMarketplaceFilterCount();
}

function normalizeInventoryVehicle(vehicle) {
  const title = vehicle.title || [vehicle.year, vehicle.make, vehicle.model, vehicle.series, vehicle.style].filter(Boolean).join(" ");
  const tags = [
    vehicle.series,
    vehicle.style,
    vehicle.region
  ].filter(Boolean).slice(0, 3);
  return {
    id: vehicle.id || vehicle.sourceLeadId || title,
    title,
    price: Number(vehicle.price || 0),
    kilometers: Number(vehicle.kilometers || 0),
    region: vehicle.region || "",
    color: vehicle.color || "",
    vin: vehicle.vin || "",
    uvc: vehicle.uvc || "",
    year: vehicle.year || "",
    make: vehicle.make || "",
    model: vehicle.model || "",
    series: vehicle.series || "",
    style: vehicle.style || "",
    description: vehicle.description || "",
    monthlyPaymentEstimate: vehicle.monthlyPaymentEstimate || "",
    sourceLeadId: vehicle.sourceLeadId || "",
    publicOptions: vehicle.publicOptions || {},
    photos: Array.isArray(vehicle.photos) ? vehicle.photos : [],
    tags: tags.length ? tags : ["Dealer reviewed"],
    photoTone: photoToneFor(vehicle.color || vehicle.make || title)
  };
}

function populateInventoryFilters() {
  if (!inventoryFilter) return;
  const selectedMake = String(inventoryFilter.elements.make?.value || "").trim();
  const modelSource = selectedMake
    ? inventory.filter((vehicle) => String(vehicle.make || "").trim() === selectedMake)
    : inventory;
  populateSelectOptions(inventoryFilter.elements.make, uniqueInventoryValues(inventory, (vehicle) => vehicle.make), text[language].makeAny);
  populateSelectOptions(inventoryFilter.elements.model, uniqueInventoryValues(modelSource, (vehicle) => vehicle.model), text[language].modelAny);
  populateSelectOptions(inventoryFilter.elements.type, uniqueInventoryValues((vehicle) => vehicle.style || vehicle.series || firstTypeTag(vehicle)), text[language].typeAny);
  populateSelectOptions(inventoryFilter.elements.region, uniqueInventoryValues(inventory, (vehicle) => vehicle.region), text[language].regionAny);
}

function uniqueInventoryValues(sourceOrSelector, maybeSelector) {
  const source = Array.isArray(sourceOrSelector) ? sourceOrSelector : inventory;
  const selector = Array.isArray(sourceOrSelector) ? maybeSelector : sourceOrSelector;
  return [...new Set(source.map(selector).map((value) => String(value || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function firstTypeTag(vehicle) {
  return (vehicle.tags || []).find((tag) => {
    const value = String(tag || "").toLowerCase();
    return value && !value.includes("british columbia") && value !== "bc" && value !== "on";
  }) || "";
}

function populateSelectOptions(select, values, emptyLabel) {
  if (!select) return;
  const current = select.value;
  select.innerHTML = [
    `<option value="">${escapeHtml(emptyLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
  ].join("");
  if (values.includes(current)) select.value = current;
}

function publicSummary(vehicle) {
  const parts = [];
  if (isPublicFieldVisible(vehicle, "showKilometers") && vehicle.kilometers) {
    parts.push(`${vehicle.kilometers.toLocaleString("en-CA")} km`);
  }
  if (isPublicFieldVisible(vehicle, "showRegion") && vehicle.region) parts.push(vehicle.region);
  if (isPublicFieldVisible(vehicle, "showColor") && vehicle.color) parts.push(vehicle.color);
  return parts.join(" | ") || text[language].notAvailable;
}

function isPublicFieldVisible(vehicle, key) {
  const options = vehicle.publicOptions || {};
  if (!Object.keys(options).length) return true;
  return options[key] === true;
}

function photoToneFor(value) {
  const textValue = String(value || "").toLowerCase();
  if (textValue.includes("gray") || textValue.includes("grey") || textValue.includes("silver") || textValue.includes("audi")) return "silver";
  if (textValue.includes("green") || textValue.includes("toyota")) return "green";
  return "blue";
}

function calculatePayment() {
  const data = new FormData(financeForm);
  const price = Number(data.get("price") || 0);
  const downPayment = Number(data.get("downPayment") || 0);
  const annualRate = Number(data.get("annualRate") || 0);
  const termMonths = Number(data.get("termMonths") || 72);
  const taxRate = Number(data.get("taxRate") || 0);
  const residualPercent = Number(data.get("residualPercent") || 48);
  const mode = String(data.get("paymentMode") || "finance");
  const payment = mode === "lease"
    ? estimatedLeasePayment({ price, downPayment, annualRate, termMonths, taxRate, residualPercent })
    : estimatedMonthlyPayment({ price, downPayment, annualRate, termMonths, taxRate });
  const monthlyText = `${money(payment)} / mo`;
  paymentOutput.textContent = monthlyText;
  if (detailOrderPayment) detailOrderPayment.textContent = monthlyText;
  if (detailOrderFees) {
    const modeLabel = mode === "lease" ? text[language].paymentModeLease : text[language].paymentModeFinance;
    const residual = mode === "lease" ? ` | ${residualPercent}% residual` : "";
    detailOrderFees.textContent = `${modeLabel} | ${money(downPayment)} down | ${termMonths} months | ${annualRate}%${residual}`;
  }
  financeForm?.classList.toggle("lease-mode", mode === "lease");
}

function estimatedMonthlyPayment({ price, downPayment, annualRate, termMonths, taxRate }) {
  const principal = Math.max(0, Number(price || 0) * (1 + Number(taxRate || 0) / 100) - Number(downPayment || 0));
  const monthlyRate = Number(annualRate || 0) / 100 / 12;
  const months = Number(termMonths || 72);
  return monthlyRate > 0
    ? principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
    : principal / months;
}

function estimatedLeasePayment({ price, downPayment, annualRate, termMonths, taxRate, residualPercent }) {
  const months = Math.max(1, Number(termMonths || 36));
  const vehiclePrice = Number(price || 0);
  const residualValue = Math.max(0, vehiclePrice * Number(residualPercent || 0) / 100);
  const capitalizedCost = Math.max(0, vehiclePrice - Number(downPayment || 0));
  const depreciationCharge = Math.max(0, capitalizedCost - residualValue) / months;
  const moneyFactor = Number(annualRate || 0) / 2400;
  const financeCharge = (capitalizedCost + residualValue) * moneyFactor;
  return (depreciationCharge + financeCharge) * (1 + Number(taxRate || 0) / 100);
}

function vehicleDeal(vehicle) {
  const price = Number(vehicle.price || 0);
  const downPayment = Math.max(2500, Math.round(price * 0.1 / 500) * 500);
  const termMonths = 72;
  const annualRate = 7.99;
  const taxRate = 12;
  const monthly = Number(vehicle.monthlyPaymentEstimate || 0) || estimatedMonthlyPayment({ price, downPayment, annualRate, termMonths, taxRate });
  return {
    downPayment,
    termMonths,
    annualRate,
    taxRate,
    monthly: Math.round(monthly)
  };
}

function vehicleSpecItems(vehicle) {
  return [
    { label: "Year", value: vehicle.year || "CBB", icon: "calendar" },
    { label: "KM", value: vehicle.kilometers ? vehicle.kilometers.toLocaleString("en-CA") : "-", icon: "gauge" },
    { label: "Region", value: vehicle.region || "-", icon: "map" },
    { label: "Style", value: vehicle.style || vehicle.series || "-", icon: "body" }
  ];
}

function specIcon(type) {
  const icons = {
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4M17 3v4M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>',
    gauge: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14a8 8 0 0 1 16 0M7 14h.01M17 14h.01M12 14l4-5M9 20h6"/></svg>',
    map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.4 7-12a7 7 0 1 0-14 0c0 6.6 7 12 7 12Z"/><path d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>',
    body: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h16l-2-5H6l-2 5Z"/><path d="M6 14v4M18 14v4M7 18h10M8 9V6h8v3"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
  };
  return icons[type] || icons.body;
}

function selectVehicleForFinance(vehicle) {
  if (!vehicle || !financeForm) return;
  selectedFinanceVehicle = vehicle;
  const deal = vehicleDeal(vehicle);
  financeForm.elements.price.value = vehicle.price;
  financeForm.elements.downPayment.value = deal.downPayment;
  financeForm.elements.termMonths.value = deal.termMonths;
  financeForm.elements.annualRate.value = deal.annualRate;
  financeForm.elements.taxRate.value = deal.taxRate;
  if (detailOrderTitle) detailOrderTitle.textContent = vehicle.title;
  if (detailOrderSubtitle) detailOrderSubtitle.textContent = [vehicle.series, vehicle.style].filter(Boolean).join(" | ");
  if (detailOrderFees) {
    detailOrderFees.textContent = `${money(deal.downPayment)} down | ${deal.termMonths} months | ${deal.annualRate}% APR`;
  }
  calculatePayment();
  updateSendEstimateButton();
}

function updateSendEstimateButton() {
  if (!sendEstimateButton) return;
  sendEstimateButton.disabled = !selectedFinanceVehicle;
  sendEstimateButton.textContent = selectedFinanceVehicle
    ? text[language].sendEstimateButton
    : text[language].sendEstimateDisabled;
}

function applyFilters(event) {
  event?.preventDefault();
  const data = new FormData(inventoryFilter);
  const query = String(data.get("query") || "").trim().toLowerCase();
  const make = String(data.get("make") || "").trim().toLowerCase();
  const model = String(data.get("model") || "").trim().toLowerCase();
  const type = String(data.get("type") || "").trim().toLowerCase();
  const region = String(data.get("region") || "").trim().toLowerCase();
  const maxKm = Number(data.get("maxKm") || 0);
  const priceRange = String(data.get("priceRange") || "").trim();
  const sortBy = String(inventorySort?.value || "monthly-asc");
  const [minMonthly, maxMonthly] = priceRange ? priceRange.split("-").map((value) => Number(value || 0)) : [0, 0];
  filteredInventory = inventory.filter((vehicle) => {
    const haystack = `${vehicle.title} ${vehicle.make} ${vehicle.model} ${vehicle.region} ${vehicle.color} ${vehicle.tags.join(" ")}`.toLowerCase();
    const vehicleType = `${vehicle.style || ""} ${vehicle.series || ""} ${(vehicle.tags || []).join(" ")}`.toLowerCase();
    const monthly = vehicleDeal(vehicle).monthly;
    const matchesQuery = !query || haystack.includes(query);
    const matchesMake = !make || String(vehicle.make || "").toLowerCase() === make;
    const matchesModel = !model || String(vehicle.model || "").toLowerCase() === model;
    const matchesType = !type || vehicleType.includes(type);
    const matchesRegion = !region || String(vehicle.region || "").toLowerCase() === region;
    const matchesKm = !maxKm || Number(vehicle.kilometers || 0) <= maxKm;
    const matchesPrice = !priceRange || (monthly >= minMonthly && monthly <= maxMonthly);
    return matchesQuery && matchesMake && matchesModel && matchesType && matchesRegion && matchesKm && matchesPrice;
  });
  filteredInventory.sort((a, b) => compareVehicles(a, b, sortBy));
  updateSearchUrl(data);
  renderInventory();
  syncFilterChipState();
}

function compareVehicles(a, b, sortBy) {
  const comparisons = {
    "monthly-asc": vehicleDeal(a).monthly - vehicleDeal(b).monthly,
    "monthly-desc": vehicleDeal(b).monthly - vehicleDeal(a).monthly,
    "price-asc": Number(a.price || 0) - Number(b.price || 0),
    "price-desc": Number(b.price || 0) - Number(a.price || 0),
    "year-desc": Number(b.year || 0) - Number(a.year || 0),
    "km-asc": Number(a.kilometers || 0) - Number(b.kilometers || 0),
    recent: String(b.id || "").localeCompare(String(a.id || ""))
  };
  const result = comparisons[sortBy] ?? comparisons["monthly-asc"];
  return Number.isFinite(result) && result !== 0
    ? result
    : String(a.title || "").localeCompare(String(b.title || ""));
}

function updateSearchUrl(data) {
  const params = new URLSearchParams();
  ["make", "model", "priceRange", "type", "region", "maxKm", "query"].forEach((key) => {
    const value = String(data.get(key) || "").trim();
    if (value) params.set(key, value);
  });
  const sort = String(inventorySort?.value || "");
  if (sort && sort !== "monthly-asc") params.set("sort", sort);
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

function updateMarketplaceFilterCount() {
  if (!marketplaceFilterCount || !inventoryFilter) return;
  const data = new FormData(inventoryFilter);
  const active = ["make", "model", "priceRange", "type", "region", "maxKm", "query"]
    .filter((key) => String(data.get(key) || "").trim()).length;
  marketplaceFilterCount.textContent = `${active} Selected`;
}

function applyFilterChip(button) {
  if (!inventoryFilter) return;
  const value = button.dataset.filterChip || "";
  const input = inventoryFilter.elements.query;
  input.value = input.value === value ? "" : value;
  applyFilters();
}

function clearInventoryFilters() {
  if (!inventoryFilter) return;
  inventoryFilter.reset();
  if (inventorySort) inventorySort.value = "monthly-asc";
  populateInventoryFilters();
  applyFilters();
}

function syncFilterChipState() {
  if (!inventoryFilter) return;
  const query = String(inventoryFilter.elements.query?.value || "").trim().toLowerCase();
  filterChipButtons.forEach((button) => {
    const active = String(button.dataset.filterChip || "").trim().toLowerCase() === query;
    button.classList.toggle("active", active);
  });
}

function applyUrlSearchParams() {
  if (!inventoryFilter) return;
  const params = new URLSearchParams(window.location.search);
  if (params.has("make") && inventoryFilter.elements.make) {
    setSelectValueCaseInsensitive(inventoryFilter.elements.make, params.get("make") || "");
    populateInventoryFilters();
  }
  ["model", "priceRange", "type", "region", "maxKm", "query"].forEach((key) => {
    if (!params.has(key) || !inventoryFilter.elements[key]) return;
    if (inventoryFilter.elements[key].tagName === "SELECT") {
      setSelectValueCaseInsensitive(inventoryFilter.elements[key], params.get(key) || "");
    } else {
      inventoryFilter.elements[key].value = params.get(key) || "";
    }
  });
  if (inventorySort && params.has("sort")) inventorySort.value = params.get("sort") || "monthly-asc";
}

function setSelectValueCaseInsensitive(select, value) {
  const directValue = String(value || "");
  const option = [...select.options].find((item) => item.value.toLowerCase() === directValue.toLowerCase());
  select.value = option ? option.value : directValue;
}

function toggleMoreFilters() {
  if (!moreFiltersPanel) return;
  moreFiltersPanel.hidden = !moreFiltersPanel.hidden;
}

function setLanguage(nextLanguage) {
  language = nextLanguage === "fr" ? "fr" : "en";
  localStorage.setItem("customer-language", language);
  document.documentElement.lang = language;
  languageToggle.textContent = language === "en" ? "FR" : "EN";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    if (text[language][key]) node.textContent = text[language][key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.dataset.i18nPlaceholder;
    if (text[language][key]) node.placeholder = text[language][key];
  });
  populateInventoryFilters();
  updateInventoryIntro();
  updateInventorySourceStatus();
  renderInventory();
  updateSendEstimateButton();
}

function showVehicleDetails(vehicle) {
  if (!vehicleDetailModal || !vehicleDetailTitle || !vehicleDetailBody) return;
  selectVehicleForFinance(vehicle);
  vehicleDetailTitle.textContent = vehicle.title;
  if (vehicleDetailPriceSummary) {
    vehicleDetailPriceSummary.innerHTML = `
      <span>${escapeHtml(text[language].detailPrice)}</span>
      <strong>${money(vehicle.price)}</strong>
    `;
  }
  vehicleDetailBody.innerHTML = `
    ${vehicleDetailMedia(vehicle)}
    <div class="vehicle-detail-content">
      <section class="vehicle-detail-main">
        <h3>Your vehicle details</h3>
        <div class="vehicle-detail-grid vehicle-detail-specs">
          ${detailItem(text[language].detailKilometers, isPublicFieldVisible(vehicle, "showKilometers") && vehicle.kilometers ? `${vehicle.kilometers.toLocaleString("en-CA")} km` : "")}
          ${detailItem(text[language].detailRegion, isPublicFieldVisible(vehicle, "showRegion") ? vehicle.region : "")}
          ${detailItem(text[language].detailColor, isPublicFieldVisible(vehicle, "showColor") ? vehicle.color : "")}
          ${detailItem("Year", vehicle.year)}
          ${detailItem("Make", vehicle.make)}
          ${detailItem("Model", vehicle.model)}
          ${detailItem("Series / Trim", vehicle.series)}
          ${detailItem("Style", vehicle.style)}
          ${detailItem(text[language].detailVin, isPublicFieldVisible(vehicle, "showVin") ? vehicle.vin : "")}
          ${detailItem(text[language].detailUvc, isPublicFieldVisible(vehicle, "showUvc") ? vehicle.uvc : "")}
        </div>
        <div class="vehicle-detail-description">
          <span>${escapeHtml(text[language].detailDescription)}</span>
          <p>${escapeHtml(vehicle.description || text[language].notAvailable)}</p>
        </div>
      </section>
      <aside class="vehicle-detail-payment-slot"></aside>
    </div>
  `;
  vehicleDetailBody.querySelector(".vehicle-detail-payment-slot")?.appendChild(detailPaymentPanel);
  vehicleDetailModal.hidden = false;
}

function vehicleDetailMedia(vehicle) {
  const photos = Array.isArray(vehicle.photos) ? vehicle.photos.filter((photo) => photo?.url) : [];
  const mainPhoto = photos[0] || null;
  const mainMarkup = mainPhoto?.url
    ? `<figure class="vehicle-detail-photo" data-detail-main-photo>
        <img src="${escapeHtml(photoDisplayUrl(mainPhoto.url))}" alt="${escapeHtml(vehicle.title)}" />
        <figcaption>${escapeHtml(mainPhoto.label || "Vehicle photo")}</figcaption>
      </figure>`
    : `<div class="vehicle-detail-photo vehicle-detail-photo-placeholder" data-detail-main-photo>${vehicleImageMarkup(vehicle)}</div>`;
  return `
    <section class="vehicle-detail-media" aria-label="Vehicle photos">
      <header class="vehicle-detail-media-head">
        <div>
          <span>Photos</span>
          <strong>${escapeHtml(photos.length ? `${photos.length} photo${photos.length === 1 ? "" : "s"}` : "Photo preview")}</strong>
        </div>
      </header>
      ${vehicleDetailPhotoStrip(vehicle, photos)}
      ${mainMarkup}
    </section>
  `;
}

function vehicleDetailPhotoStrip(vehicle, preparedPhotos) {
  const photos = Array.isArray(preparedPhotos) ? preparedPhotos : Array.isArray(vehicle.photos) ? vehicle.photos.filter((photo) => photo?.url) : [];
  if (!photos.length) {
    return `
      <div class="vehicle-detail-photo-strip" aria-label="Vehicle photos">
        <div class="vehicle-detail-thumb-placeholder">Photo preview</div>
      </div>
    `;
  }
  return `
    <div class="vehicle-detail-photo-strip" aria-label="Vehicle photos">
      ${photos.map((photo, index) => `
        <figure class="vehicle-detail-thumb ${index === 0 ? "is-selected" : ""}" data-detail-photo-index="${index}" tabindex="0" role="button" aria-label="${escapeHtml(photo.label || `Show photo ${index + 1}`)}">
          <img src="${escapeHtml(photoDisplayUrl(photo.url))}" alt="${escapeHtml(photo.label || `${vehicle.title} photo ${index + 1}`)}" loading="lazy" />
          <figcaption>${escapeHtml(photo.label || `Photo ${index + 1}`)}</figcaption>
        </figure>
      `).join("")}
    </div>
  `;
}

function vehicleImageMarkup(vehicle) {
  const photo = Array.isArray(vehicle.photos) ? vehicle.photos[0] : null;
  if (photo?.url) {
    return `
      <figure class="inventory-photo">
        <img src="${escapeHtml(photoDisplayUrl(photo.url))}" alt="${escapeHtml(vehicle.title)}" loading="lazy" />
      </figure>
    `;
  }
  return `
    <div class="inventory-image inventory-image-${vehicle.photoTone}" aria-hidden="true">
      <span></span>
    </div>
  `;
}

function photoDisplayUrl(url) {
  const value = String(url || "");
  const fileMatch = value.match(/\/d\/([^/]+)/);
  const idMatch = value.match(/[?&]id=([^&]+)/);
  const id = fileMatch?.[1] || idMatch?.[1] || "";
  return id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200` : value;
}

function detailItem(label, value) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <b>${escapeHtml(value || text[language].notAvailable)}</b>
    </div>
  `;
}

function closeVehicleDetails() {
  if (vehicleDetailModal) vehicleDetailModal.hidden = true;
}

function openContactDealer(vehicle) {
  if (!contactDealerModal || !contactDealerForm) return;
  currentContactVehicle = vehicle;
  selectVehicleForFinance(vehicle);
  contactDealerForm.reset();
  contactDealerForm.elements.listingId.value = vehicle.id;
  const financeChoice = contactDealerForm.querySelector("input[name='purchaseIntent'][value='finance']");
  if (financeChoice) financeChoice.checked = true;
  if (contactVehicleTitle) contactVehicleTitle.textContent = vehicle.title;
  if (contactVehicleContext) contactVehicleContext.innerHTML = contactVehicleContextMarkup(vehicle);
  if (contactDealerForm.elements.message) {
    contactDealerForm.elements.message.value = text[language].contactDefaultMessage;
  }
  updateContactBuyingSummary();
  if (contactDealerStatus) contactDealerStatus.textContent = "";
  contactDealerModal.hidden = false;
}

function closeContactDealer() {
  if (contactDealerModal) contactDealerModal.hidden = true;
  currentContactVehicle = null;
}

async function submitDealerContact(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(contactDealerForm).entries());
  if (!String(data.email || "").trim() && !String(data.phone || "").trim()) {
    contactDealerStatus.textContent = text[language].contactNeedInfo;
    return;
  }
  contactDealerStatus.textContent = text[language].contactSending;
  const vehicle = currentContactVehicle || inventory.find((item) => item.id === data.listingId) || {};
  const response = await fetch("/api/buyer-inquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...data,
      vehicle: buyerVehiclePayload(vehicle),
      finance: financeEstimatePayload(),
      purchase: purchaseIntentPayload(data)
    })
  });
  const result = await response.json().catch(() => ({}));
  contactDealerStatus.textContent = result.ok ? text[language].contactSent : (result.error || text[language].contactFailed);
  if (result.ok) {
    window.setTimeout(closeContactDealer, 1200);
  }
}

function contactVehicleContextMarkup(vehicle) {
  const parts = [
    vehicle.price ? money(vehicle.price) : "",
    isPublicFieldVisible(vehicle, "showKilometers") && vehicle.kilometers ? `${vehicle.kilometers.toLocaleString("en-CA")} km` : "",
    isPublicFieldVisible(vehicle, "showRegion") ? vehicle.region : "",
    isPublicFieldVisible(vehicle, "showColor") ? vehicle.color : "",
    vehicle.monthlyPaymentEstimate ? `${money(vehicle.monthlyPaymentEstimate)} / mo` : ""
  ].filter(Boolean);
  return parts.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
}

function updateContactBuyingSummary() {
  if (!contactFinanceSummary || !contactDealerForm) return;
  const data = Object.fromEntries(new FormData(contactDealerForm).entries());
  const purchase = purchaseIntentPayload(data);
  if (purchase.intent === "cash") {
    contactFinanceSummary.innerHTML = `
      <strong>${escapeHtml(text[language].purchaseCashSummary)}</strong>
      <span>${escapeHtml(money(purchase.vehiclePrice || currentContactVehicle?.price || 0))}</span>
    `;
    return;
  }
  if (purchase.intent === "lease") {
    contactFinanceSummary.innerHTML = `
      <strong>${escapeHtml(text[language].purchaseLeaseSummary)}</strong>
      <span>${escapeHtml(money(purchase.monthlyPayment))} / mo target</span>
      <small>${escapeHtml(money(purchase.downPayment))} down | ${escapeHtml(String(purchase.termMonths || ""))} months | calculator budget</small>
    `;
    return;
  }
  if (purchase.intent === "undecided") {
    contactFinanceSummary.innerHTML = `
      <strong>${escapeHtml(text[language].purchaseUndecidedSummary)}</strong>
      <span>${escapeHtml(money(purchase.vehiclePrice || currentContactVehicle?.price || 0))} vehicle</span>
    `;
    return;
  }
  contactFinanceSummary.innerHTML = `
    <strong>${escapeHtml(text[language].purchaseFinanceSummary)}</strong>
    <span>${escapeHtml(money(purchase.monthlyPayment))} / mo</span>
    <small>${escapeHtml(money(purchase.downPayment))} down | ${escapeHtml(String(purchase.termMonths || ""))} months | ${escapeHtml(String(purchase.annualRate || 0))}% APR</small>
  `;
}

function purchaseIntentPayload(formData = {}) {
  const finance = financeEstimatePayload();
  const intent = String(formData.purchaseIntent || "finance").trim();
  const monthlyPayment = intent === "lease" ? finance.leaseMonthlyPayment : finance.monthlyPayment;
  return {
    intent,
    buyingTimeline: String(formData.buyingTimeline || "").trim(),
    preferredContact: String(formData.preferredContact || "").trim(),
    vehiclePrice: finance.price || Number(currentContactVehicle?.price || 0),
    downPayment: finance.downPayment,
    annualRate: finance.annualRate,
    taxRate: finance.taxRate,
    termMonths: finance.termMonths,
    residualPercent: finance.residualPercent,
    paymentMode: finance.paymentMode,
    monthlyPayment
  };
}

function buyerVehiclePayload(vehicle) {
  return {
    id: vehicle.id || "",
    title: vehicle.title || "",
    price: Number(vehicle.price || 0),
    kilometers: Number(vehicle.kilometers || 0),
    region: vehicle.region || "",
    color: vehicle.color || "",
    vin: vehicle.vin || "",
    uvc: vehicle.uvc || "",
    year: vehicle.year || "",
    make: vehicle.make || "",
    model: vehicle.model || "",
    series: vehicle.series || "",
    style: vehicle.style || "",
    sourceLeadId: vehicle.sourceLeadId || "",
    monthlyPaymentEstimate: Number(vehicle.monthlyPaymentEstimate || 0),
    publicOptions: vehicle.publicOptions || {}
  };
}

function financeEstimatePayload() {
  if (!financeForm) return {};
  const data = new FormData(financeForm);
  const price = Number(data.get("price") || 0);
  const downPayment = Number(data.get("downPayment") || 0);
  const annualRate = Number(data.get("annualRate") || 0);
  const taxRate = Number(data.get("taxRate") || 0);
  const termMonths = Number(data.get("termMonths") || 0);
  const residualPercent = Number(data.get("residualPercent") || 48);
  const financeMonthlyPayment = estimatedMonthlyPayment({ price, downPayment, annualRate, termMonths, taxRate });
  const leaseMonthlyPayment = estimatedLeasePayment({ price, downPayment, annualRate, termMonths, taxRate, residualPercent });
  const paymentMode = String(data.get("paymentMode") || "finance");
  return {
    paymentMode,
    price,
    downPayment,
    annualRate,
    taxRate,
    termMonths,
    residualPercent,
    financeMonthlyPayment: Math.round(financeMonthlyPayment),
    leaseMonthlyPayment: Math.round(leaseMonthlyPayment),
    monthlyPayment: paymentMode === "lease" ? Math.round(leaseMonthlyPayment) : Math.round(financeMonthlyPayment)
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

languageToggle?.addEventListener("click", () => setLanguage(language === "en" ? "fr" : "en"));
inventoryFilter?.addEventListener("submit", applyFilters);
inventoryFilter?.addEventListener("change", (event) => {
  if (event.target?.name === "make") {
    if (inventoryFilter.elements.model) inventoryFilter.elements.model.value = "";
    populateInventoryFilters();
  }
  applyFilters();
});
inventoryFilter?.addEventListener("input", () => {
  updateMarketplaceFilterCount();
  window.clearTimeout(filterInputTimer);
  filterInputTimer = window.setTimeout(() => applyFilters(), 220);
});
inventorySort?.addEventListener("change", applyFilters);
moreFiltersToggle?.addEventListener("click", toggleMoreFilters);
filterChipButtons.forEach((button) => button.addEventListener("click", () => applyFilterChip(button)));
clearFilterButton?.addEventListener("click", clearInventoryFilters);
financeForm?.addEventListener("input", calculatePayment);
financeForm?.addEventListener("input", () => {
  if (contactDealerModal && !contactDealerModal.hidden) updateContactBuyingSummary();
});
sendEstimateButton?.addEventListener("click", () => {
  if (selectedFinanceVehicle) openContactDealer(selectedFinanceVehicle);
});
inventoryList?.addEventListener("click", (event) => {
  const detailButton = event.target.closest("[data-view-vehicle]");
  if (detailButton) {
    const vehicle = inventory.find((item) => item.id === detailButton.dataset.viewVehicle);
    if (vehicle) showVehicleDetails(vehicle);
    return;
  }

  const contactButton = event.target.closest("[data-contact-vehicle]");
  if (contactButton) {
    const vehicle = inventory.find((item) => item.id === contactButton.dataset.contactVehicle);
    if (vehicle) openContactDealer(vehicle);
    return;
  }

  const button = event.target.closest("[data-fill-finance]");
  if (!button) return;
  const vehicle = inventory.find((item) => item.id === button.dataset.fillFinance);
  if (!vehicle) return;
  selectVehicleForFinance(vehicle);
  document.querySelector(".finance-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
});

vehicleDetailModal?.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-detail]")) {
    closeVehicleDetails();
    return;
  }
  if (event.target.closest("[data-order-contact]")) {
    if (selectedFinanceVehicle) {
      closeVehicleDetails();
      openContactDealer(selectedFinanceVehicle);
    }
    return;
  }
  const thumb = event.target.closest("[data-detail-photo-index]");
  if (thumb && selectedFinanceVehicle) {
    const photos = Array.isArray(selectedFinanceVehicle.photos) ? selectedFinanceVehicle.photos.filter((photo) => photo?.url) : [];
    const photo = photos[Number(thumb.dataset.detailPhotoIndex || 0)];
    const mainPhoto = vehicleDetailModal.querySelector("[data-detail-main-photo]");
    if (photo?.url && mainPhoto) {
      mainPhoto.innerHTML = `<img src="${escapeHtml(photoDisplayUrl(photo.url))}" alt="${escapeHtml(photo.label || selectedFinanceVehicle.title)}" /><figcaption>${escapeHtml(photo.label || "Vehicle photo")}</figcaption>`;
      vehicleDetailModal.querySelectorAll("[data-detail-photo-index]").forEach((node) => {
        node.classList.toggle("is-selected", node === thumb);
      });
    }
    return;
  }
  const contactButton = event.target.closest("[data-detail-contact]");
  if (contactButton) {
    const vehicle = inventory.find((item) => item.id === contactButton.dataset.detailContact);
    if (vehicle) {
      closeVehicleDetails();
      openContactDealer(vehicle);
    }
    return;
  }
});

contactDealerModal?.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-contact]")) closeContactDealer();
});

contactDealerForm?.addEventListener("change", updateContactBuyingSummary);
contactDealerForm?.addEventListener("submit", submitDealerContact);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeVehicleDetails();
  if (event.key === "Escape") closeContactDealer();
  if ((event.key === "Enter" || event.key === " ") && event.target?.matches?.("[data-detail-photo-index]")) {
    event.preventDefault();
    event.target.click();
  }
});

async function init() {
  setLanguage(language);
  await loadInventory();
  populateInventoryFilters();
  applyUrlSearchParams();
  populateInventoryFilters();
  applyFilters();
  calculatePayment();
  updateSendEstimateButton();
}

init();
