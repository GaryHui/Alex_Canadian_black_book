const homeText = {
  en: {
    brandName: "AutoSwitch Canada",
    buyNav: "Buy",
    sellNav: "Sell",
    dealerNav: "Dealer portal",
    eyebrow: "Canada's modern vehicle marketplace",
    headline: "Buy Or Sell With Clarity.",
    subhead: "A cleaner way to compare inventory, understand market value, and move from interest to dealer follow-up with confidence.",
    buyKicker: "Shop",
    buyTitle: "Find a Vehicle",
    buyText: "Explore dealer-reviewed inventory, compare pricing, and estimate payments before you contact the team.",
    sellKicker: "Value",
    sellTitle: "Sell Your Vehicle",
    sellText: "Check your market range, share the right details, and get reviewed by a dealer team.",
    flowEyebrow: "How AutoSwitch works",
    flowTitle: "One connected flow for buyers, sellers, and dealer teams.",
    flowOneTitle: "Start with the vehicle",
    flowOneText: "Buyers browse available listings while sellers submit vehicle details, value ranges, and photos.",
    flowTwoTitle: "Dealer team follows up",
    flowTwoText: "Staff manage calls, tasks, inspections, offers, and timeline updates in one workspace.",
    flowThreeTitle: "Inventory stays connected",
    flowThreeText: "Accepted vehicles can move into public inventory for buyers to review and inquire about."
  },
  fr: {
    brandName: "AutoSwitch Canada",
    buyNav: "Acheter",
    sellNav: "Vendre",
    dealerNav: "Portail concessionnaire",
    eyebrow: "Marche automobile moderne au Canada",
    headline: "Acheter Ou Vendre Avec Clarte.",
    subhead: "Une facon plus simple de comparer l'inventaire, comprendre la valeur du marche et passer au suivi concessionnaire.",
    buyKicker: "Magasiner",
    buyTitle: "Trouver un vehicule",
    buyText: "Consultez l'inventaire verifie, comparez les prix et estimez les paiements avant de contacter l'equipe.",
    sellKicker: "Evaluer",
    sellTitle: "Vendre votre vehicule",
    sellText: "Verifiez votre fourchette de marche, partagez les bons details et obtenez une revue concessionnaire.",
    flowEyebrow: "Fonctionnement AutoSwitch",
    flowTitle: "Un parcours connecte pour acheteurs, vendeurs et equipes concessionnaires.",
    flowOneTitle: "Commencer par le vehicule",
    flowOneText: "Les acheteurs consultent les annonces pendant que les vendeurs soumettent details, valeur et photos.",
    flowTwoTitle: "L'equipe fait le suivi",
    flowTwoText: "Le personnel gere appels, taches, inspections, offres et mises a jour dans un seul espace.",
    flowThreeTitle: "L'inventaire reste connecte",
    flowThreeText: "Les vehicules acceptes peuvent passer dans l'inventaire public pour les acheteurs."
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
