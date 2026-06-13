const inventory = [
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
    noResults: "Aucun vehicule ne correspond aux filtres."
  }
};

let language = localStorage.getItem("customer-language") || "en";
let filteredInventory = [...inventory];

const languageToggle = document.querySelector("#language-toggle");
const inventoryList = document.querySelector("#inventory-list");
const inventoryFilter = document.querySelector("#inventory-filter");
const financeForm = document.querySelector("#finance-form");
const paymentOutput = document.querySelector("#payment-output");

function money(value) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function renderInventory() {
  if (!filteredInventory.length) {
    inventoryList.innerHTML = `<p class="status">${text[language].noResults}</p>`;
    return;
  }

  inventoryList.innerHTML = filteredInventory.map((vehicle) => `
    <article class="inventory-card">
      <div class="inventory-image inventory-image-${vehicle.photoTone}" aria-hidden="true">
        <span></span>
      </div>
      <div class="inventory-card-body">
        <div>
          <h3>${escapeHtml(vehicle.title)}</h3>
          <p>${escapeHtml(vehicle.kilometers.toLocaleString("en-CA"))} km | ${escapeHtml(vehicle.region)} | ${escapeHtml(vehicle.color)}</p>
        </div>
        <strong>${money(vehicle.price)}</strong>
        <div class="inventory-tags">
          ${vehicle.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
        <button class="secondary-button" type="button" data-fill-finance="${escapeHtml(vehicle.id)}">${escapeHtml(text[language].contactDealer)}</button>
      </div>
    </article>
  `).join("");
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
  renderInventory();
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
  const button = event.target.closest("[data-fill-finance]");
  if (!button) return;
  const vehicle = inventory.find((item) => item.id === button.dataset.fillFinance);
  if (!vehicle) return;
  financeForm.elements.price.value = vehicle.price;
  calculatePayment();
  document.querySelector(".finance-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
});

setLanguage(language);
applyFilters();
calculatePayment();
