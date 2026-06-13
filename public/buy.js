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
    searchLabel: "Search",
    searchPlaceholder: "Lexus, SUV, 2024...",
    budgetLabel: "Max price",
    filterButton: "Filter",
    inventoryEyebrow: "Available vehicles",
    inventoryTitle: "Current marketplace preview",
    inventoryIntro: "This MVP uses sample inventory until the admin inventory module is connected.",
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
    inventoryEmpty: "No published vehicles yet. Publish a vehicle from the admin inventory panel to show it here.",
    inventoryDemo: "Demo inventory is shown because the inventory backend is not configured or unavailable.",
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
    detailUseCalculator: "Use this price in calculator",
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
    searchLabel: "Recherche",
    searchPlaceholder: "Lexus, VUS, 2024...",
    budgetLabel: "Prix maximum",
    filterButton: "Filtrer",
    inventoryEyebrow: "Vehicules disponibles",
    inventoryTitle: "Apercu du marche",
    inventoryIntro: "Ce MVP utilise un inventaire exemple jusqu'a la connexion du module admin.",
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
    inventoryEmpty: "Aucun vehicule publie pour le moment. Publiez un vehicule dans le panneau admin pour l'afficher ici.",
    inventoryDemo: "Un inventaire de demo est affiche parce que le backend d'inventaire n'est pas configure ou disponible.",
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
    detailUseCalculator: "Utiliser ce prix dans le calculateur",
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
const inventorySourceStatus = document.querySelector("#inventory-source-status");
const vehicleDetailModal = document.querySelector("#vehicle-detail-modal");
const vehicleDetailTitle = document.querySelector("#vehicle-detail-title");
const vehicleDetailBody = document.querySelector("#vehicle-detail-body");

function money(value) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function renderInventory() {
  if (!filteredInventory.length) {
    const emptyText = inventorySource === "supabase-empty" ? text[language].inventoryEmpty : text[language].noResults;
    inventoryList.innerHTML = `<p class="status">${escapeHtml(emptyText)}</p>`;
    return;
  }

  inventoryList.innerHTML = filteredInventory.map((vehicle) => `
    <article class="inventory-card">
      ${vehicleImageMarkup(vehicle)}
      <div class="inventory-card-body">
        <div>
          <h3>${escapeHtml(vehicle.title)}</h3>
          <p>${escapeHtml(publicSummary(vehicle))}</p>
        </div>
        <strong>${money(vehicle.price)}</strong>
        <div class="inventory-tags">
          ${vehicle.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="inventory-card-actions">
          <button class="secondary-button" type="button" data-view-vehicle="${escapeHtml(vehicle.id)}">${escapeHtml(text[language].viewDetails)}</button>
          <button class="secondary-button" type="button" data-fill-finance="${escapeHtml(vehicle.id)}">${escapeHtml(text[language].contactDealer)}</button>
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
    intro.textContent = text[language].inventoryEmpty;
  } else {
    intro.textContent = text[language].inventoryIntro;
  }
}

function updateInventorySourceStatus() {
  if (!inventorySourceStatus) return;
  if (inventorySource === "supabase") {
    inventorySourceStatus.textContent = text[language].inventoryReal;
  } else if (inventorySource === "supabase-empty") {
    inventorySourceStatus.textContent = text[language].inventoryEmpty;
  } else {
    inventorySourceStatus.textContent = text[language].inventoryDemo;
  }
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
}

function showVehicleDetails(vehicle) {
  if (!vehicleDetailModal || !vehicleDetailTitle || !vehicleDetailBody) return;
  vehicleDetailTitle.textContent = vehicle.title;
  vehicleDetailBody.innerHTML = `
    <div class="vehicle-detail-price">
      <span>${escapeHtml(text[language].detailPrice)}</span>
      <strong>${money(vehicle.price)}</strong>
    </div>
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
    <button class="primary-button" type="button" data-detail-finance="${escapeHtml(vehicle.id)}">${escapeHtml(text[language].detailUseCalculator)}</button>
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
  return id ? `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}` : value;
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
financeForm?.addEventListener("input", calculatePayment);
inventoryList?.addEventListener("click", (event) => {
  const detailButton = event.target.closest("[data-view-vehicle]");
  if (detailButton) {
    const vehicle = inventory.find((item) => item.id === detailButton.dataset.viewVehicle);
    if (vehicle) showVehicleDetails(vehicle);
    return;
  }

  const button = event.target.closest("[data-fill-finance]");
  if (!button) return;
  const vehicle = inventory.find((item) => item.id === button.dataset.fillFinance);
  if (!vehicle) return;
  financeForm.elements.price.value = vehicle.price;
  calculatePayment();
  document.querySelector(".finance-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
});

vehicleDetailModal?.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-detail]")) {
    closeVehicleDetails();
    return;
  }
  const financeButton = event.target.closest("[data-detail-finance]");
  if (!financeButton) return;
  const vehicle = inventory.find((item) => item.id === financeButton.dataset.detailFinance);
  if (!vehicle) return;
  financeForm.elements.price.value = vehicle.price;
  calculatePayment();
  closeVehicleDetails();
  document.querySelector(".finance-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeVehicleDetails();
});

async function init() {
  setLanguage(language);
  await loadInventory();
  applyFilters();
  calculatePayment();
}

init();
