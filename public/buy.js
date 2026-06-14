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
    homeNav: "Home",
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
    budgetLabel: "Max price",
    filterButton: "Search inventory",
    sendEstimateButton: "Send this estimate to dealer",
    sendEstimateDisabled: "Choose a vehicle first",
    filterEyebrow: "Vehicle search",
    inventoryEyebrow: "Available vehicles",
    inventoryTitle: "Current marketplace preview",
    inventoryIntro: "Browse dealer-reviewed vehicles when they are available.",
    inventoryEmptyIntro: "New dealer-reviewed vehicles will appear here when they are published.",
    financeEyebrow: "Finance estimate",
    financeTitle: "Monthly payment calculator",
    priceLabel: "Vehicle price",
    downLabel: "Down payment",
    rateLabel: "Annual rate",
    termLabel: "Term",
    taxLabel: "Tax rate",
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
    contactEyebrow: "Dealer message",
    contactTitle: "Send buying intent",
    purchaseTitle: "Buying plan",
    purchaseFinance: "Finance",
    purchaseLease: "Lease",
    purchaseCash: "Cash",
    purchaseUndecided: "Not sure",
    purchaseFinanceSummary: "Finance estimate",
    purchaseLeaseSummary: "Lease interest",
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
    homeNav: "Accueil",
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
    budgetLabel: "Prix maximum",
    filterButton: "Rechercher",
    sendEstimateButton: "Envoyer cette estimation",
    sendEstimateDisabled: "Choisissez d'abord un vehicule",
    filterEyebrow: "Recherche de vehicule",
    inventoryEyebrow: "Vehicules disponibles",
    inventoryTitle: "Apercu du marche",
    inventoryIntro: "Consultez les vehicules verifies par le concessionnaire lorsqu'ils sont disponibles.",
    inventoryEmptyIntro: "Les vehicules verifies par le concessionnaire apparaitront ici lorsqu'ils seront publies.",
    financeEyebrow: "Estimation de financement",
    financeTitle: "Calculateur de paiement mensuel",
    priceLabel: "Prix du vehicule",
    downLabel: "Mise de fonds",
    rateLabel: "Taux annuel",
    termLabel: "Duree",
    taxLabel: "Taux de taxe",
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
    contactEyebrow: "Message au concessionnaire",
    contactTitle: "Envoyer mon intention d'achat",
    purchaseTitle: "Plan d'achat",
    purchaseFinance: "Financement",
    purchaseLease: "Location",
    purchaseCash: "Comptant",
    purchaseUndecided: "Pas certain",
    purchaseFinanceSummary: "Estimation de financement",
    purchaseLeaseSummary: "Interet pour la location",
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
const vehicleDetailModal = document.querySelector("#vehicle-detail-modal");
const vehicleDetailTitle = document.querySelector("#vehicle-detail-title");
const vehicleDetailPriceSummary = document.querySelector("#vehicle-detail-price-summary");
const vehicleDetailBody = document.querySelector("#vehicle-detail-body");
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

  inventoryList.innerHTML = filteredInventory.map((vehicle) => `
    <article class="inventory-card">
      ${vehicleImageMarkup(vehicle)}
      <div class="inventory-card-body">
        <div class="inventory-card-copy">
          <h3>${escapeHtml(vehicle.title)}</h3>
          <p>${escapeHtml(publicSummary(vehicle))}</p>
        </div>
        <div class="inventory-card-price">
          <strong>${money(vehicle.price)}</strong>
          ${vehicle.monthlyPaymentEstimate ? `<span>${escapeHtml(money(vehicle.monthlyPaymentEstimate))} / mo</span>` : ""}
        </div>
        <div class="inventory-tags">
          ${vehicle.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="inventory-card-actions">
          <button class="primary-button" type="button" data-contact-vehicle="${escapeHtml(vehicle.id)}">${escapeHtml(text[language].contactDealer)}</button>
          <button class="secondary-button" type="button" data-view-vehicle="${escapeHtml(vehicle.id)}">${escapeHtml(text[language].viewDetails)}</button>
          <button class="secondary-button compact" type="button" data-fill-finance="${escapeHtml(vehicle.id)}">${escapeHtml(text[language].detailUseCalculator)}</button>
        </div>
      </div>
    </article>
  `).join("");
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
  const hasFilters = Boolean(String(data?.get("query") || "").trim() || String(data?.get("maxPrice") || "").trim());
  const key = hasFilters
    ? count === 1 ? "resultsFilteredLabel" : "resultsFilteredLabelPlural"
    : count === 1 ? "resultsLabel" : "resultsLabelPlural";
  inventoryResultsCount.textContent = `${count} ${text[language][key]}`;
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
  const principal = Math.max(0, price * (1 + taxRate / 100) - downPayment);
  const monthlyRate = annualRate / 100 / 12;
  const payment = monthlyRate > 0
    ? principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1)
    : principal / termMonths;
  paymentOutput.textContent = `${money(payment)} / mo`;
}

function selectVehicleForFinance(vehicle) {
  if (!vehicle || !financeForm) return;
  selectedFinanceVehicle = vehicle;
  financeForm.elements.price.value = vehicle.price;
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
  const maxPrice = Number(data.get("maxPrice") || 0);
  filteredInventory = inventory.filter((vehicle) => {
    const haystack = `${vehicle.title} ${vehicle.region} ${vehicle.color} ${vehicle.tags.join(" ")}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesPrice = !maxPrice || vehicle.price <= maxPrice;
    return matchesQuery && matchesPrice;
  });
  renderInventory();
  syncFilterChipState();
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
  updateInventoryIntro();
  updateInventorySourceStatus();
  renderInventory();
  updateSendEstimateButton();
}

function showVehicleDetails(vehicle) {
  if (!vehicleDetailModal || !vehicleDetailTitle || !vehicleDetailBody) return;
  vehicleDetailTitle.textContent = vehicle.title;
  if (vehicleDetailPriceSummary) {
    vehicleDetailPriceSummary.innerHTML = `
      <span>${escapeHtml(text[language].detailPrice)}</span>
      <strong>${money(vehicle.price)}</strong>
    `;
  }
  vehicleDetailBody.innerHTML = `
    ${vehicle.photos?.length ? `<figure class="vehicle-detail-photo"><img src="${escapeHtml(photoDisplayUrl(vehicle.photos[0].url))}" alt="${escapeHtml(vehicle.title)}" /><figcaption>${escapeHtml(vehicle.photos[0].label || "Vehicle photo")}</figcaption></figure>` : ""}
    <div class="vehicle-detail-grid">
      ${detailItem(text[language].detailKilometers, isPublicFieldVisible(vehicle, "showKilometers") && vehicle.kilometers ? `${vehicle.kilometers.toLocaleString("en-CA")} km` : "")}
      ${detailItem(text[language].detailRegion, isPublicFieldVisible(vehicle, "showRegion") ? vehicle.region : "")}
      ${detailItem(text[language].detailColor, isPublicFieldVisible(vehicle, "showColor") ? vehicle.color : "")}
      ${detailItem(text[language].detailVin, isPublicFieldVisible(vehicle, "showVin") ? vehicle.vin : "")}
      ${detailItem(text[language].detailUvc, isPublicFieldVisible(vehicle, "showUvc") ? vehicle.uvc : "")}
      ${detailItem(text[language].detailMonthly, vehicle.monthlyPaymentEstimate ? money(vehicle.monthlyPaymentEstimate) : "")}
      ${detailItem("Year", vehicle.year)}
      ${detailItem("Make", vehicle.make)}
      ${detailItem("Model", vehicle.model)}
      ${detailItem("Series / Trim", vehicle.series)}
      ${detailItem("Style", vehicle.style)}
      ${detailItem(text[language].detailSource, vehicle.sourceLeadId)}
    </div>
    <div class="vehicle-detail-description">
      <span>${escapeHtml(text[language].detailDescription)}</span>
      <p>${escapeHtml(vehicle.description || text[language].notAvailable)}</p>
    </div>
    <div class="vehicle-detail-actions">
      <button class="primary-button" type="button" data-detail-contact="${escapeHtml(vehicle.id)}">${escapeHtml(text[language].contactDealer)}</button>
      <button class="secondary-button" type="button" data-detail-finance="${escapeHtml(vehicle.id)}">${escapeHtml(text[language].detailUseCalculator)}</button>
    </div>
  `;
  vehicleDetailModal.hidden = false;
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
  return {
    intent: String(formData.purchaseIntent || "finance").trim(),
    buyingTimeline: String(formData.buyingTimeline || "").trim(),
    preferredContact: String(formData.preferredContact || "").trim(),
    vehiclePrice: finance.price || Number(currentContactVehicle?.price || 0),
    downPayment: finance.downPayment,
    annualRate: finance.annualRate,
    taxRate: finance.taxRate,
    termMonths: finance.termMonths,
    monthlyPayment: finance.monthlyPayment
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
  return {
    price: Number(data.get("price") || 0),
    downPayment: Number(data.get("downPayment") || 0),
    annualRate: Number(data.get("annualRate") || 0),
    taxRate: Number(data.get("taxRate") || 0),
    termMonths: Number(data.get("termMonths") || 0),
    monthlyPayment: paymentOutput ? Number(paymentOutput.textContent.replace(/[^0-9.]/g, "")) : 0
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
  const contactButton = event.target.closest("[data-detail-contact]");
  if (contactButton) {
    const vehicle = inventory.find((item) => item.id === contactButton.dataset.detailContact);
    if (vehicle) {
      closeVehicleDetails();
      openContactDealer(vehicle);
    }
    return;
  }

  const financeButton = event.target.closest("[data-detail-finance]");
  if (!financeButton) return;
  const vehicle = inventory.find((item) => item.id === financeButton.dataset.detailFinance);
  if (!vehicle) return;
  selectVehicleForFinance(vehicle);
  closeVehicleDetails();
  document.querySelector(".finance-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
});

contactDealerModal?.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-contact]")) closeContactDealer();
});

contactDealerForm?.addEventListener("change", updateContactBuyingSummary);
contactDealerForm?.addEventListener("submit", submitDealerContact);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeVehicleDetails();
  if (event.key === "Escape") closeContactDealer();
});

async function init() {
  setLanguage(language);
  await loadInventory();
  applyFilters();
  calculatePayment();
  updateSendEstimateButton();
}

init();
