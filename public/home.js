const homeText = {
  en: {
    brandName: "AutoSwitch Canada",
    buyNav: "Buy",
    sellNav: "Sell",
    dealerNav: "Dealer portal",
    eyebrow: "Canadian vehicle marketplace",
    headline: "Buy smarter. Sell with confidence.",
    subhead: "Start with the path that fits you today. Browse available vehicles or get a market estimate before selling your car.",
    buyKicker: "I want to",
    buyTitle: "Buy a car",
    buyText: "Browse dealer-reviewed inventory, compare vehicles, and estimate monthly payments.",
    sellKicker: "I want to",
    sellTitle: "Sell my car",
    sellText: "Check your vehicle value, upload details, and let a dealer review your quote.",
    flowEyebrow: "How the MVP works",
    flowTitle: "One system for selling leads, dealer follow-up, and future inventory.",
    flowOneTitle: "Customer submits vehicle",
    flowOneText: "The sell flow captures vehicle data, quote results, contact details, and photos.",
    flowTwoTitle: "Dealer follows up",
    flowTwoText: "Admin assigns the lead, staff records calls, tasks, inspection notes, and offer details.",
    flowThreeTitle: "Inventory goes public",
    flowThreeText: "Accepted vehicles can become listings for buyers to view and inquire about."
  },
  fr: {
    brandName: "AutoSwitch Canada",
    buyNav: "Acheter",
    sellNav: "Vendre",
    dealerNav: "Portail concessionnaire",
    eyebrow: "Marche automobile canadien",
    headline: "Achetez plus intelligemment. Vendez avec confiance.",
    subhead: "Choisissez le parcours qui vous convient aujourd'hui. Consultez les vehicules disponibles ou obtenez une estimation avant de vendre.",
    buyKicker: "Je veux",
    buyTitle: "Acheter une voiture",
    buyText: "Parcourez les vehicules revises par le concessionnaire, comparez et estimez les paiements mensuels.",
    sellKicker: "Je veux",
    sellTitle: "Vendre ma voiture",
    sellText: "Verifiez la valeur, ajoutez les details et laissez un concessionnaire examiner votre estimation.",
    flowEyebrow: "Fonctionnement du MVP",
    flowTitle: "Un systeme pour les leads vendeurs, le suivi interne et le futur inventaire.",
    flowOneTitle: "Le client soumet son vehicule",
    flowOneText: "Le parcours vendeur recueille les donnees du vehicule, l'estimation, les coordonnees et les photos.",
    flowTwoTitle: "Le concessionnaire fait le suivi",
    flowTwoText: "L'admin assigne le lead; l'equipe note les appels, taches, inspections et offres.",
    flowThreeTitle: "L'inventaire devient public",
    flowThreeText: "Les vehicules acceptes peuvent devenir des annonces visibles par les acheteurs."
  }
};

let homeLanguage = localStorage.getItem("customer-language") || "en";
const languageToggle = document.querySelector("#language-toggle");

function setHomeLanguage(nextLanguage) {
  homeLanguage = nextLanguage === "fr" ? "fr" : "en";
  localStorage.setItem("customer-language", homeLanguage);
  document.documentElement.lang = homeLanguage;
  languageToggle.textContent = homeLanguage === "en" ? "FR" : "EN";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    if (homeText[homeLanguage][key]) node.textContent = homeText[homeLanguage][key];
  });
}

languageToggle?.addEventListener("click", () => setHomeLanguage(homeLanguage === "en" ? "fr" : "en"));
setHomeLanguage(homeLanguage);
