const form = document.querySelector("#customer-form");
const statusEl = document.querySelector("#customer-status");
const choiceSection = document.querySelector("#choice-section");
const choiceList = document.querySelector("#choice-list");
const vehicleReviewSection = document.querySelector("#vehicle-review");
const reviewForm = document.querySelector("#review-form");
const changeVehicleButton = document.querySelector("#change-vehicle");
const photoInputs = [...document.querySelectorAll("[data-photo-role]")];
const blackbookOptions = document.querySelector("#blackbook-options");
const resultSection = document.querySelector("#result-section");
const resultTitle = document.querySelector("#result-title");
const resultMeta = document.querySelector("#result-meta");
const wholesaleValue = document.querySelector("#wholesale-value");
const retailValue = document.querySelector("#retail-value");
const wholesaleAverage = document.querySelector("#wholesale-average");
const retailAverage = document.querySelector("#retail-average");
const languageToggle = document.querySelector("#language-toggle");
const postalHelp = document.querySelector("#postal-help");
const modal = document.querySelector("#modal");
const startOver = document.querySelector("#start-over");
const makeSelect = form.elements.make;
const modelSelect = form.elements.model;
const vinHelpButton = document.querySelector("#vin-help");
const vinGuide = document.querySelector("#vin-guide");
const vinGuideClose = document.querySelector("#vin-guide-close");
const customerAuthTitle = document.querySelector("#customer-auth-title");
const customerAuthSubtitle = document.querySelector("#customer-auth-subtitle");
const customerLoginButton = document.querySelector("#customer-login");
const customerLogoutButton = document.querySelector("#customer-logout");
const customerAuthActions = document.querySelector("#customer-auth-actions");
const openCreateAccountButton = document.querySelector("#open-create-account");
const openLoginButton = document.querySelector("#open-login");
const emailAuthModal = document.querySelector("#email-auth-modal");
const emailAuthModalTitle = document.querySelector("#email-auth-modal-title");
const emailAuthClose = document.querySelector("#email-auth-close");
const emailAuthBackdrop = document.querySelector("#email-auth-backdrop");
const emailAuthForm = document.querySelector("#email-auth-form");
const emailAuthTabs = [...document.querySelectorAll(".email-auth-tab")];
const emailAuthEmailWrap = document.querySelector("#email-auth-email-wrap");
const emailAuthEmail = document.querySelector("#email-auth-email");
const emailAuthPasswordWrap = document.querySelector("#email-auth-password-wrap");
const emailAuthPassword = document.querySelector("#email-auth-password");
const emailAuthConfirmWrap = document.querySelector("#email-auth-confirm-wrap");
const emailAuthConfirm = document.querySelector("#email-auth-confirm");
const emailAuthTermsWrap = document.querySelector("#email-auth-terms-wrap");
const emailAuthTermsCheck = document.querySelector("#email-auth-terms-check");
const emailAuthSwitchText = document.querySelector("#email-auth-switch-text");
const emailAuthSwitchButton = document.querySelector("#email-auth-switch-button");
const emailAuthSubmit = document.querySelector("#email-auth-submit");
const emailAuthStatus = document.querySelector("#email-auth-status");
const customerTurnstileWrap = document.querySelector("#customer-turnstile-wrap");
const customerTurnstile = document.querySelector("#customer-turnstile");
const customerTurnstileStatus = document.querySelector("#customer-turnstile-status");
const quotaPanel = document.querySelector("#customer-quota");
const quotaTitle = document.querySelector("#quota-title");
const quotaSubtitle = document.querySelector("#quota-subtitle");
const historyPanel = document.querySelector("#history-panel");
const historyStatus = document.querySelector("#history-status");
const historyList = document.querySelector("#history-list");
const reloadHistoryButton = document.querySelector("#reload-history");

const commonMakes = [
  "Acura",
  "Audi",
  "BMW",
  "Buick",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Ford",
  "Genesis",
  "GMC",
  "Honda",
  "Hyundai",
  "Infiniti",
  "Jeep",
  "Kia",
  "Land Rover",
  "Lexus",
  "Mazda",
  "Mercedes-Benz",
  "MINI",
  "Mitsubishi",
  "Nissan",
  "Porsche",
  "Ram",
  "Subaru",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo"
];

const commonColors = [
  "White",
  "Black",
  "Silver",
  "Gray",
  "Blue",
  "Red",
  "Brown",
  "Green",
  "Gold",
  "Beige",
  "Other / not listed"
];

const commonModels = {
  Acura: ["ILX", "Integra", "MDX", "RDX", "TLX"],
  Audi: ["A3", "A4", "A5", "Q3", "Q5", "Q7"],
  BMW: ["3-Series", "4-Series", "5-Series", "X1", "X3", "X5"],
  Chevrolet: ["Colorado", "Equinox", "Malibu", "Silverado", "Tahoe", "Traverse"],
  Ford: ["Bronco", "Escape", "Explorer", "F150", "Mustang"],
  Honda: ["Accord", "Civic", "CR-V", "HR-V", "Odyssey", "Pilot", "Ridgeline"],
  Hyundai: ["Elantra", "Kona", "Palisade", "Santa Fe", "Sonata", "Tucson"],
  Kia: ["Forte", "Seltos", "Sorento", "Soul", "Sportage", "Telluride"],
  Lexus: ["ES-Series", "IS-Series", "NX-Series", "RX-Series", "UX-Series"],
  Mazda: ["CX-3", "CX-30", "CX-5", "CX-9", "Mazda3"],
  "Mercedes-Benz": ["C-Class", "E-Class", "GLA-Class", "GLC-Class", "GLE-Class"],
  Nissan: ["Altima", "Kicks", "Murano", "Pathfinder", "Rogue", "Sentra"],
  Subaru: ["Ascent", "Crosstrek", "Forester", "Impreza", "Outback"],
  Toyota: ["Camry", "Corolla", "Highlander", "RAV4", "Sienna", "Tacoma", "Tundra"],
  Volkswagen: ["Atlas", "Golf", "Jetta", "Taos", "Tiguan"]
};

const text = {
  en: {
    brandName: "AutoSwitch Canada",
    homeLink: "Home",
    buyLink: "Buy",
    dealerLink: "Dealer portal",
    toolsLink: "Tools",
    eyebrow: "Canadian vehicle valuation",
    headline: "What could your car be worth?",
    subhead: "Get a clear market estimate before you trade, sell, or plan your next vehicle.",
    trustOneTitle: "Fast",
    trustOneText: "Most estimates take under two minutes.",
    trustTwoTitle: "Canadian",
    trustTwoText: "Values are built for Canadian vehicle data.",
    trustThreeTitle: "Follow-up ready",
    trustThreeText: "A specialist can review your result if needed.",
    cardTitle: "Tell us about the car",
    cardSubtitle: "Get a free value in less than 2 minutes.",
    stepLabel: "Step 1",
    modeDrilldown: "Year/Make/Model",
    modeVin: "VIN",
    yearLabel: "Year",
    makeLabel: "Make",
    modelLabel: "Model",
    vinLabel: "VIN",
    postalLabel: "Postal code",
    odometerLabel: "Odometer",
    emailLabel: "Email",
    phoneLabel: "Phone (optional)",
    postalHelp: "Why do you need my postal code?",
    ownershipLabel: "Type of Ownership",
    ownershipOwned: "Owned",
    ownershipFinanced: "Financed",
    ownershipLeased: "Leased",
    continueButton: "Continue",
    chooseEyebrow: "Confirm vehicle",
    chooseTitle: "Choose the closest match",
    chooseText: "Some vehicles can match more than one trim. Pick the option that best fits your car.",
    resultEyebrow: "Estimated value",
    startOver: "Start over",
    wholesaleAvg: "Estimated Wholesale Range",
    retailAvg: "Estimated Private Range",
    tradeInAvg: "Estimated Trade-In Range",
    dealerPurchaseRange: "Average Dealer Purchase Price",
    privateSaleRange: "If you prefer to sell yourself",
    wholesaleAvgLabel: "Wholesale AVG",
    retailAvgLabel: "Private AVG",
    tradeInAvgLabel: "Trade-In AVG",
    averageLabel: "Average",
    avgFormula: "Average uses CBB adjusted.avg; if unavailable, base.avg.",
    resultNote: "This is an estimate. A dealer may adjust it after reviewing condition, options, and photos.",
    toolsEyebrow: "Useful tools",
    toolsTitle: "Plan the next step with confidence",
    toolsIntro: "These tools help visitors prepare for a trade-in conversation without overwhelming them.",
    toolOneTitle: "Vehicle value estimate",
    toolOneText: "Search by VIN or by year, make, and model to get a value range.",
    toolTwoTitle: "Trade-in preparation",
    toolTwoText: "Capture mileage, region, ownership, and contact details for follow-up.",
    toolThreeTitle: "Dealer review",
    toolThreeText: "A dealer can review the saved quote and provide a second opinion.",
    toolFourTitle: "Customer history",
    toolFourText: "Logged-in customers can keep track of prior quotes on the dealer side.",
    vinGuideEyebrow: "VIN help",
    vinGuideTitle: "Where to find your VIN",
    vinGuideIntro: "Your VIN is a 17-character vehicle ID. It helps match the estimate to the correct year, make, model, and trim.",
    vinSpotOneTitle: "Driver-side dashboard",
    vinSpotOneText: "Look through the windshield near the lower corner on the driver side.",
    vinSpotTwoTitle: "Driver door label",
    vinSpotTwoText: "Open the driver door and check the label on the door jamb or pillar.",
    vinSpotThreeTitle: "Engine bay or front frame",
    vinSpotThreeText: "Some vehicles show the VIN under the hood or on a front frame area.",
    vinSpotFourTitle: "Registration or insurance",
    vinSpotFourText: "If you cannot access the car, check your registration, insurance card, or bill of sale.",
    vinGuideNote: "Tip: most modern VINs are 17 characters and do not use the letters I, O, or Q.",
    authChecking: "Checking sign-in...",
    authRequired: "Sign in with Google or email before valuation.",
    authReady: "Signed in as",
    authReadyHelp: "Your email will be saved with the valuation for follow-up.",
    authMissing: "Customer sign-in is not configured yet.",
    authUnverified: "Please verify your email before generating a valuation.",
    loginButton: "Continue with Google",
    createFreeAccount: "Create Free Account",
    loginShort: "Login",
    continueWith: "or continue with",
    emailAuthModalTitle: "Create Account",
    emailCreateModalTitle: "Create Account",
    emailLoginModalTitle: "Login",
    emailPasswordHint: "Minimum 6 characters",
    emailTermsPrefix: "I agree to the",
    emailTermsLink: "Terms of Service",
    emailTermsRequired: "Please agree to the Terms of Service.",
    emailSwitchToSignInText: "Already have an account?",
    emailSwitchToSignInAction: "Sign in",
    emailSwitchToSignUpText: "Need an account?",
    emailSwitchToSignUpAction: "Create free account",
    emailSignInTab: "Email sign in",
    emailSignUpTab: "Create account",
    emailResetTab: "Forgot password",
    emailAuthEmail: "Email",
    emailAuthPassword: "Password",
    emailAuthConfirm: "Confirm password",
    emailSignInAction: "Sign in",
    emailSignUpAction: "Create account",
    emailResetAction: "Send reset link",
    emailUpdateAction: "Update password",
    emailPasswordMismatch: "Passwords do not match.",
    emailPasswordShort: "Use at least 6 characters for your password.",
    emailSignInReady: "Signed in successfully.",
    emailSignUpSent: "Check your email to confirm your account, then sign in.",
    emailResetSent: "Check your email for the password reset link.",
    emailUpdateReady: "Password updated.",
    emailAuthRequired: "Enter your email and password.",
    emailResetRequired: "Enter your email to receive a reset link.",
    emailUpdateTitle: "Set a new password",
    emailUpdateHelp: "Enter a new password for your account.",
    verifyHuman: "Please complete the human verification first.",
    verifyHumanReady: "Human verification passed.",
    verifyHumanFailed: "Human verification failed. Please try again.",
    logoutButton: "Sign out",
    quotaLabel: "Annual valuations",
    quotaChecking: "Checking...",
    quotaUnavailable: "Unavailable",
    quotaSummary: "used of",
    quotaLeft: "left",
    historyEyebrow: "My valuations",
    historyTitle: "Quote history",
    historyIntro: "Your saved valuations stay here so you and the dealer can review them later.",
    reloadHistory: "Reload",
    historyLoading: "Loading quote history...",
    historyEmpty: "No saved quotes yet. Generate a valuation and it will appear here.",
    historySaved: "saved quote",
    historyView: "View result",
    historyDelete: "Delete",
    historyDeleting: "Deleting...",
    historyDeleted: "Quote deleted. Annual valuation allowance was not restored.",
    historyDeleteConfirm: "Delete this quote from your history? This cannot be undone and it will not restore your annual valuation allowance.",
    historyDeleteError: "Unable to delete quote",
    limitReached: "valuation limit reached.",
    postalModalTitle: "Why do you need my postal code?",
    postalModalText: "Market pricing changes by region. Your postal code helps estimate values near your area.",
    gotIt: "Got it",
    makePlaceholder: "Make",
    modelPlaceholder: "Model",
    vinPlaceholder: "17-character VIN",
    postalPlaceholder: "A1A 1A1",
    odometerPlaceholder: "Kilometers",
    emailPlaceholder: "you@example.com",
    phonePlaceholder: "604-000-0000",
    searching: "Searching vehicle matches...",
    noMatches: "No matching vehicle was found. Try VIN or add more vehicle details.",
    chooseRequired: "Choose a vehicle match to continue.",
    reviewEyebrow: "Vehicle check",
    reviewTitle: "Confirm a few more details about the car",
    reviewIntro: "This will help us provide a more accurate value.",
    reviewSummary: "Vehicle data",
    blackbookOptionsTitle: "Black Book options",
    additionalDetailsTitle: "Additional details",
    editVehicle: "Edit",
    goBack: "Go Back",
    changeVehicle: "Change vehicle",
    seriesLabel: "Series / Trim",
    engineLabel: "Engine",
    drivetrainLabel: "Drivetrain",
    transmissionLabel: "Transmission",
    styleLabel: "Style",
    regionLabel: "Region",
    colorLabel: "Color",
    colorPlaceholder: "White, black, silver...",
    conditionLabel: "Condition notes",
    conditionPlaceholder: "Any damage, warning lights, recent repairs, tire condition...",
    photoLabel: "Vehicle photo (optional)",
    photoNote: "Optional: If you think your car is in above-average condition, please upload one clear photo. A dealer can review it for a more accurate follow-up.",
    photoMain: "Vehicle photo",
    photoMainHelp: "Upload one clear photo that shows the whole vehicle or the most important condition detail.",
    photoFront: "Front exterior",
    photoFrontHelp: "Stand in front and show the whole vehicle.",
    photoRear: "Rear exterior",
    photoRearHelp: "Stand behind and show the whole vehicle.",
    photoDriverSide: "Driver side",
    photoDriverSideHelp: "Show the full driver side profile.",
    photoPassengerSide: "Passenger side",
    photoPassengerSideHelp: "Show the full passenger side profile.",
    photoOdometer: "Odometer",
    photoOdometerHelp: "Show the mileage clearly on the cluster.",
    photoInterior: "Interior",
    photoInteriorHelp: "Show front seats, dashboard, and center console.",
    photoEngineBay: "Engine bay",
    photoEngineBayHelp: "Open the hood and show the engine bay clearly.",
    photoWheels: "Wheels and tires",
    photoWheelsHelp: "Show tire tread, rims, and any curb rash.",
    photoDamage: "Damage or wear",
    photoDamageHelp: "Show scratches, dents, warning lights, or other concerns.",
    choosePhoto: "Choose photo",
    noPhotoSelected: "No photo selected",
    generateValuation: "Get Value Range",
    vehicleReady: "Vehicle found. Please review the details before generating a valuation.",
    odometerTooLow: "Please enter an odometer value greater than 500 km.",
    valuing: "Generating your valuation...",
    saving: "Saving your request for follow-up...",
    saved: "Your valuation is ready and has been saved for follow-up.",
    saveIssue: "Your valuation is ready, but the lead receiver did not confirm saving.",
    pleaseLogin: "Please sign in with Google before generating a valuation.",
    pleaseVerifyEmail: "Please verify your email first, then sign in again.",
    invalidVin: "Please enter a valid VIN.",
    required: "Please complete the required fields.",
    ownershipRequired: "Please choose one ownership type.",
    selectText: "Select this vehicle",
    sourceText: "Source",
    valueUnavailable: "Not available"
  },
  fr: {
    brandName: "AutoÉchange Canada",
    homeLink: "Accueil",
    buyLink: "Acheter",
    dealerLink: "Portail concessionnaire",
    toolsLink: "Outils",
    eyebrow: "Évaluation automobile canadienne",
    headline: "Combien vaut votre voiture?",
    subhead: "Obtenez une estimation claire avant un échange, une vente ou votre prochain achat.",
    trustOneTitle: "Rapide",
    trustOneText: "La plupart des estimations prennent moins de deux minutes.",
    trustTwoTitle: "Canada",
    trustTwoText: "Les valeurs sont adaptées aux données automobiles canadiennes.",
    trustThreeTitle: "Suivi possible",
    trustThreeText: "Un spécialiste peut revoir le résultat au besoin.",
    cardTitle: "Parlez-nous du véhicule",
    cardSubtitle: "Obtenez une valeur gratuite en moins de 2 minutes.",
    stepLabel: "Étape 1",
    modeDrilldown: "Année/Marque/Modèle",
    modeVin: "NIV",
    yearLabel: "Année",
    makeLabel: "Marque",
    modelLabel: "Modèle",
    vinLabel: "NIV",
    postalLabel: "Code postal",
    odometerLabel: "Odomètre",
    emailLabel: "Courriel",
    phoneLabel: "Téléphone (optionnel)",
    postalHelp: "Pourquoi demander mon code postal?",
    ownershipLabel: "Type de propriete",
    ownershipOwned: "Proprietaire",
    ownershipFinanced: "Finance",
    ownershipLeased: "Location",
    continueButton: "Continuer",
    chooseEyebrow: "Confirmer le véhicule",
    chooseTitle: "Choisissez la meilleure correspondance",
    chooseText: "Certains véhicules peuvent correspondre à plusieurs versions. Choisissez celle qui convient le mieux.",
    resultEyebrow: "Valeur estimée",
    startOver: "Recommencer",
    wholesaleAvg: "Fourchette gros estimée",
    retailAvg: "Fourchette privée estimée",
    tradeInAvg: "Fourchette échange estimée",
    dealerPurchaseRange: "Prix moyen d'achat par un concessionnaire",
    privateSaleRange: "Si vous préférez vendre vous-même",
    wholesaleAvgLabel: "Moyenne gros",
    retailAvgLabel: "Moyenne vente privée",
    tradeInAvgLabel: "Moyenne échange",
    averageLabel: "Moyenne",
    avgFormula: "La moyenne utilise adjusted.avg de CBB; sinon base.avg.",
    resultNote: "Il s'agit d'une estimation. Un concessionnaire peut l'ajuster après examen de l'état, des options et des photos.",
    toolsEyebrow: "Outils utiles",
    toolsTitle: "Planifiez la prochaine étape avec confiance",
    toolsIntro: "Ces outils aident les visiteurs à préparer une discussion d'échange sans les submerger.",
    toolOneTitle: "Estimation de valeur",
    toolOneText: "Recherchez par NIV ou par année, marque et modèle pour obtenir une fourchette de valeur.",
    toolTwoTitle: "Préparation à l'échange",
    toolTwoText: "Recueillez le kilométrage, la région, la propriété et les coordonnées pour le suivi.",
    toolThreeTitle: "Révision par le concessionnaire",
    toolThreeText: "Un concessionnaire peut revoir le devis enregistré et donner un second avis.",
    toolFourTitle: "Historique client",
    toolFourText: "Les clients connectés peuvent consulter leurs anciens devis côté concessionnaire.",
    vinGuideEyebrow: "Aide NIV",
    vinGuideTitle: "Où trouver votre NIV",
    vinGuideIntro: "Le NIV est un identifiant de 17 caractères. Il aide à associer l'estimation à la bonne année, marque, modèle et version.",
    vinSpotOneTitle: "Tableau de bord côté conducteur",
    vinSpotOneText: "Regardez à travers le pare-brise, dans le coin inférieur du côté conducteur.",
    vinSpotTwoTitle: "Étiquette de la porte conducteur",
    vinSpotTwoText: "Ouvrez la porte conducteur et vérifiez l'étiquette sur le montant ou le cadre de porte.",
    vinSpotThreeTitle: "Compartiment moteur ou cadre avant",
    vinSpotThreeText: "Certains véhicules affichent le NIV sous le capot ou près d'une zone du cadre avant.",
    vinSpotFourTitle: "Immatriculation ou assurance",
    vinSpotFourText: "Si vous n'avez pas accès au véhicule, vérifiez l'immatriculation, l'assurance ou l'acte de vente.",
    vinGuideNote: "Conseil : la plupart des NIV modernes comptent 17 caractères et n'utilisent pas les lettres I, O ou Q.",
    authChecking: "Vérification de la connexion...",
    authRequired: "Connectez-vous avec Google ou par courriel avant l'evaluation.",
    authReady: "Connecté avec",
    authReadyHelp: "Votre courriel sera enregistré avec l'évaluation pour le suivi.",
    authMissing: "La connexion client n'est pas encore configuree.",
    authUnverified: "Veuillez vérifier votre courriel avant de générer une évaluation.",
    loginButton: "Continuer avec Google",
    createFreeAccount: "Creer un compte gratuit",
    loginShort: "Connexion",
    continueWith: "ou continuer avec",
    emailAuthModalTitle: "Creer un compte",
    emailCreateModalTitle: "Creer un compte",
    emailLoginModalTitle: "Connexion",
    emailPasswordHint: "Minimum 6 caractères",
    emailTermsPrefix: "J'accepte les",
    emailTermsLink: "conditions d'utilisation",
    emailTermsRequired: "Veuillez accepter les conditions d'utilisation.",
    emailSwitchToSignInText: "Vous avez déjà un compte?",
    emailSwitchToSignInAction: "Connexion",
    emailSwitchToSignUpText: "Besoin d'un compte?",
    emailSwitchToSignUpAction: "Créer un compte gratuit",
    emailSignInTab: "Connexion courriel",
    emailSignUpTab: "Créer un compte",
    emailResetTab: "Mot de passe oublié",
    emailAuthEmail: "Courriel",
    emailAuthPassword: "Mot de passe",
    emailAuthConfirm: "Confirmer le mot de passe",
    emailSignInAction: "Se connecter",
    emailSignUpAction: "Créer le compte",
    emailResetAction: "Envoyer le lien",
    emailUpdateAction: "Mettre à jour",
    emailPasswordMismatch: "Les mots de passe ne correspondent pas.",
    emailPasswordShort: "Utilisez au moins 6 caractères.",
    emailSignInReady: "Connexion réussie.",
    emailSignUpSent: "Vérifiez votre courriel pour confirmer le compte, puis connectez-vous.",
    emailResetSent: "Vérifiez votre courriel pour le lien de réinitialisation.",
    emailUpdateReady: "Mot de passe mis à jour.",
    emailAuthRequired: "Entrez votre courriel et votre mot de passe.",
    emailResetRequired: "Entrez votre courriel pour recevoir un lien.",
    emailUpdateTitle: "Définir un nouveau mot de passe",
    emailUpdateHelp: "Entrez un nouveau mot de passe pour votre compte.",
    verifyHuman: "Veuillez completer la verification humaine.",
    verifyHumanReady: "Verification humaine reussie.",
    verifyHumanFailed: "La verification humaine a echoue. Veuillez reessayer.",
    logoutButton: "Déconnexion",
    quotaLabel: "Évaluations annuelles",
    quotaChecking: "Vérification...",
    quotaUnavailable: "Indisponible",
    quotaSummary: "utilisées sur",
    quotaLeft: "restantes",
    historyEyebrow: "Mes évaluations",
    historyTitle: "Historique des devis",
    historyIntro: "Vos évaluations enregistrées restent ici pour révision avec le concessionnaire.",
    reloadHistory: "Recharger",
    historyLoading: "Chargement de l'historique...",
    historyEmpty: "Aucun devis enregistré. Générez une évaluation et elle apparaîtra ici.",
    historySaved: "devis enregistré",
    historyView: "Voir le résultat",
    historyDelete: "Supprimer",
    historyDeleting: "Suppression...",
    historyDeleted: "Devis supprimé. La limite annuelle n'a pas été restaurée.",
    historyDeleteConfirm: "Supprimer ce devis de votre historique? Cette action est définitive et ne restaure pas votre limite annuelle.",
    historyDeleteError: "Impossible de supprimer le devis",
    limitReached: "limite d'évaluations atteinte.",
    postalModalTitle: "Pourquoi demander mon code postal?",
    postalModalText: "Les prix changent selon la région. Le code postal aide à estimer les valeurs près de chez vous.",
    gotIt: "Compris",
    makePlaceholder: "Marque",
    modelPlaceholder: "Modèle",
    vinPlaceholder: "NIV de 17 caractères",
    postalPlaceholder: "A1A 1A1",
    odometerPlaceholder: "Kilomètres",
    emailPlaceholder: "vous@exemple.com",
    phonePlaceholder: "604-000-0000",
    searching: "Recherche des correspondances...",
    noMatches: "Aucun véhicule correspondant. Essayez le NIV ou ajoutez plus de détails.",
    chooseRequired: "Choisissez un véhicule pour continuer.",
    reviewEyebrow: "Vérification du véhicule",
    reviewTitle: "Confirmez quelques détails sur le véhicule",
    reviewIntro: "Ces renseignements nous aident à fournir une valeur plus précise.",
    reviewSummary: "Données du véhicule",
    editVehicle: "Modifier",
    goBack: "Retour",
    changeVehicle: "Changer de véhicule",
    seriesLabel: "Version / finition",
    engineLabel: "Moteur",
    drivetrainLabel: "Motricité",
    transmissionLabel: "Transmission",
    styleLabel: "Carrosserie",
    regionLabel: "Région",
    colorLabel: "Couleur",
    colorPlaceholder: "Blanc, noir, argent...",
    conditionLabel: "Notes sur l'état",
    conditionPlaceholder: "Dommages, voyants, réparations récentes, pneus...",
    photoLabel: "Photo du véhicule (facultatif)",
    photoNote: "Facultatif : si vous pensez que votre véhicule est dans un état supérieur à la moyenne, veuillez téléverser une photo claire. Un concessionnaire pourra l'examiner pour un suivi plus précis.",
    photoMain: "Photo du véhicule",
    photoMainHelp: "Téléversez une photo claire montrant tout le véhicule ou le détail d'état le plus important.",
    photoFront: "Avant extérieur",
    photoFrontHelp: "Placez-vous devant le véhicule et montrez-le au complet.",
    photoRear: "Arrière extérieur",
    photoRearHelp: "Placez-vous derrière le véhicule et montrez-le au complet.",
    photoDriverSide: "Côté conducteur",
    photoDriverSideHelp: "Montrez le profil complet côté conducteur.",
    photoPassengerSide: "Côté passager",
    photoPassengerSideHelp: "Montrez le profil complet côté passager.",
    photoOdometer: "Odomètre",
    photoOdometerHelp: "Montrez clairement le kilométrage au tableau de bord.",
    photoInterior: "Intérieur",
    photoInteriorHelp: "Montrez les sièges avant, le tableau de bord et la console.",
    photoEngineBay: "Compartiment moteur",
    photoEngineBayHelp: "Ouvrez le capot et montrez clairement le compartiment moteur.",
    photoWheels: "Roues et pneus",
    photoWheelsHelp: "Montrez la bande de roulement, les jantes et les marques de trottoir.",
    photoDamage: "Dommages ou usure",
    photoDamageHelp: "Montrez les rayures, bosses, voyants ou autres points à signaler.",
    choosePhoto: "Choisir une photo",
    noPhotoSelected: "Aucune photo choisie",
    generateValuation: "Obtenir la fourchette",
    vehicleReady: "Véhicule trouvé. Vérifiez les détails avant de générer une évaluation.",
    odometerTooLow: "Veuillez entrer un odomètre supérieur à 500 km.",
    valuing: "Génération de votre évaluation...",
    saving: "Enregistrement de votre demande pour le suivi...",
    saved: "Votre évaluation est prête et enregistrée pour le suivi.",
    saveIssue: "Votre évaluation est prête, mais l'enregistrement n'a pas été confirmé.",
    pleaseLogin: "Veuillez vous connecter avec Google avant de générer une évaluation.",
    pleaseVerifyEmail: "Veuillez d'abord vérifier votre courriel, puis vous reconnecter.",
    invalidVin: "Veuillez entrer un NIV valide.",
    required: "Veuillez remplir les champs requis.",
    ownershipRequired: "Veuillez choisir un type de propriété.",
    selectText: "Choisir ce véhicule",
    sourceText: "Source",
    valueUnavailable: "Non disponible"
  }
};

let language = "en";
let selectedVehicle = null;
let pendingInput = null;
const selectedPhotos = new Map();
let supabaseClient = null;
let authSession = null;
let usageState = null;
let historyLeads = [];
let siteUrl = window.location.origin;
let customerTurnstileGate = null;
let pendingHumanAction = null;
let emailAuthMode = "signin";
let makeRequestId = 0;
let modelRequestId = 0;

const MAX_PHOTO_COUNT = 9;
const MAX_PHOTO_EDGE = 1400;
const PHOTO_JPEG_QUALITY = 0.78;

initialize();

function initialize() {
  populateYears();
  populateSelectOptions(makeSelect, commonMakes, t("makePlaceholder"));
  loadMakesForYear({ preserveMake: true });
  syncModelList({ preserveModel: true });
  setLanguage(language);
  updateMode();

  form.addEventListener("submit", handleSubmit);
  reviewForm.addEventListener("submit", handleReviewSubmit);
  changeVehicleButton.addEventListener("click", () => {
    vehicleReviewSection.hidden = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  document.querySelector("[data-review-back]")?.addEventListener("click", () => {
    vehicleReviewSection.hidden = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  photoInputs.forEach((input) => input.addEventListener("change", renderPhotoPreview));
  form.elements.mode.forEach((item) => item.addEventListener("change", updateMode));
  form.elements.make.addEventListener("change", () => syncModelList({ preserveModel: false }));
  form.elements.year.addEventListener("change", () => {
    loadMakesForYear({ preserveMake: false });
    syncModelList({ preserveModel: false });
  });
  languageToggle.addEventListener("click", () => setLanguage(language === "en" ? "fr" : "en"));
  vinHelpButton.addEventListener("click", () => {
    openVinGuide();
  });
  vinGuideClose.addEventListener("click", closeVinGuide);
  postalHelp.addEventListener("click", openModal);
  modal.querySelectorAll("[data-close-modal]").forEach((item) => item.addEventListener("click", closeModal));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
      closeVinGuide();
      closeEmailAuthModal();
    }
  });
  startOver.addEventListener("click", resetCustomerFlow);
  customerLoginButton.addEventListener("click", signInCustomer);
  customerLogoutButton.addEventListener("click", signOutCustomer);
  openCreateAccountButton?.addEventListener("click", () => openEmailAuthModal("signup"));
  openLoginButton?.addEventListener("click", () => openEmailAuthModal("signin"));
  emailAuthClose?.addEventListener("click", closeEmailAuthModal);
  emailAuthBackdrop?.addEventListener("click", closeEmailAuthModal);
  emailAuthSwitchButton?.addEventListener("click", () => {
    setEmailAuthMode(emailAuthSwitchButton.dataset.authMode || "signin");
  });
  emailAuthTabs.forEach((button) => button.addEventListener("click", () => setEmailAuthMode(button.dataset.authMode || "signin")));
  emailAuthForm.addEventListener("submit", handleEmailAuthSubmit);
  reloadHistoryButton.addEventListener("click", loadHistory);
  initializeCustomerAuth();
}

function populateYears() {
  const select = form.elements.year;
  const currentYear = new Date().getFullYear() + 1;
  for (let year = currentYear; year >= 1981; year -= 1) {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    select.append(option);
  }
  select.value = String(Math.min(currentYear, new Date().getFullYear()));
}

function populateDatalist(list, values) {
  list.replaceChildren(...values.map((value) => {
    const option = document.createElement("option");
    option.value = value;
    return option;
  }));
}

function populateSelectOptions(select, values, placeholder, selectedValue = "") {
  if (!select) return;
  const uniqueValues = [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  placeholderOption.disabled = true;
  placeholderOption.selected = !selectedValue;
  const options = uniqueValues.map((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = sameText(value, selectedValue);
    return option;
  });
  select.replaceChildren(placeholderOption, ...options);
  select.disabled = uniqueValues.length === 0;
}

async function loadMakesForYear({ preserveMake = true } = {}) {
  const year = form.elements.year.value.trim();
  const currentMake = form.elements.make.value.trim();
  populateSelectOptions(makeSelect, commonMakes, t("makePlaceholder"), preserveMake ? currentMake : "");
  if (!preserveMake) {
    form.elements.make.value = "";
    form.elements.model.value = "";
    populateSelectOptions(modelSelect, [], t("modelPlaceholder"));
  }
  if (!year) return;

  const requestId = ++makeRequestId;
  try {
    const query = new URLSearchParams({ year, country: "C" });
    const response = await fetch(`/api/drilldown?${query.toString()}`);
    const data = await response.json();
    if (requestId !== makeRequestId || !data.ok) return;
    if (Array.isArray(data.makes) && data.makes.length) {
      const liveMake = form.elements.make.value.trim();
      const candidateMake = preserveMake ? currentMake : liveMake;
      const selectedMake = hasDatalistValue(data.makes, candidateMake) ? candidateMake : "";
      populateSelectOptions(makeSelect, data.makes, t("makePlaceholder"), selectedMake);
      if (preserveMake && currentMake && !hasDatalistValue(data.makes, currentMake)) {
        form.elements.make.value = "";
        form.elements.model.value = "";
        populateSelectOptions(modelSelect, [], t("modelPlaceholder"));
      }
    }
  } catch (error) {
    console.warn("Unable to load Black Book make list", error);
  }
}

async function syncModelList({ preserveModel = false } = {}) {
  const make = form.elements.make.value.trim();
  const year = form.elements.year.value.trim();
  const currentModel = form.elements.model.value.trim();
  if (!preserveModel) form.elements.model.value = "";
  populateSelectOptions(modelSelect, commonModels[make] || [], t("modelPlaceholder"), preserveModel ? currentModel : "");
  if (!year || !make) return;

  const requestId = ++modelRequestId;
  try {
    const query = new URLSearchParams({ year, make, country: "C" });
    const response = await fetch(`/api/drilldown?${query.toString()}`);
    const data = await response.json();
    if (requestId !== modelRequestId || !data.ok) return;
    if (Array.isArray(data.models) && data.models.length) {
      const selectedModel = preserveModel && hasDatalistValue(data.models, currentModel) ? currentModel : "";
      populateSelectOptions(modelSelect, data.models, t("modelPlaceholder"), selectedModel);
    }
  } catch (error) {
    console.warn("Unable to load Black Book model list", error);
  }
}

function hasDatalistValue(values = [], target = "") {
  const normalizedTarget = target.trim().toLowerCase();
  return values.some((value) => String(value || "").trim().toLowerCase() === normalizedTarget);
}

function sameText(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

async function initializeCustomerAuth() {
  const config = await fetch("/api/config").then((res) => res.json()).catch(() => ({}));
  if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) {
    supabaseClient = null;
    setCustomerSession(null);
    customerAuthTitle.textContent = t("authMissing");
    customerAuthSubtitle.textContent = t("authRequired");
    return;
  }

  siteUrl = config.siteUrl || window.location.origin;
  customerTurnstileGate = null;
  if (customerTurnstileWrap) customerTurnstileWrap.hidden = true;
  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
      persistSession: true
    }
  });

  const { data } = await supabaseClient.auth.getSession();
  if (window.location.hash.includes("access_token") || window.location.search.includes("code=")) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  if (window.location.search.includes("reset_password=1")) {
    setEmailAuthMode("update");
  } else {
    setEmailAuthMode(emailAuthMode);
  }
  setCustomerSession(data.session);
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") setEmailAuthMode("update");
    setCustomerSession(session);
  });
}

async function signInCustomer() {
  if (!supabaseClient) {
    statusEl.textContent = t("authMissing");
    return;
  }
  await runWithHumanVerification(startGoogleSignIn);
}

async function startGoogleSignIn() {
  await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/`
    }
  });
}

async function handleEmailAuthSubmit(event) {
  event.preventDefault();
  if (!supabaseClient) {
    setEmailAuthStatus(t("authMissing"));
    return;
  }

  const email = emailAuthEmail.value.trim();
  const password = emailAuthPassword.value;
  const confirmPassword = emailAuthConfirm.value;

  if (emailAuthMode === "reset") {
    if (!email) {
      setEmailAuthStatus(t("emailResetRequired"));
      return;
    }
    await runWithHumanVerification(() => sendPasswordReset(email));
    return;
  }

  if (emailAuthMode === "update") {
    if (!isUsablePassword(password)) {
      setEmailAuthStatus(t("emailPasswordShort"));
      return;
    }
    if (password !== confirmPassword) {
      setEmailAuthStatus(t("emailPasswordMismatch"));
      return;
    }
    await updateEmailPassword(password);
    return;
  }

  if (!email || !password) {
    setEmailAuthStatus(t("emailAuthRequired"));
    return;
  }
  if (emailAuthMode === "signup") {
    if (!isUsablePassword(password)) {
      setEmailAuthStatus(t("emailPasswordShort"));
      return;
    }
    if (password !== confirmPassword) {
      setEmailAuthStatus(t("emailPasswordMismatch"));
      return;
    }
    if (emailAuthTermsCheck && !emailAuthTermsCheck.checked) {
      setEmailAuthStatus(t("emailTermsRequired"));
      return;
    }
    await runWithHumanVerification(() => signUpWithEmail(email, password));
    return;
  }

  await runWithHumanVerification(() => signInWithEmail(email, password));
}

async function runWithHumanVerification(action) {
  await action();
}

async function completePendingHumanAction() {
  const action = pendingHumanAction;
  pendingHumanAction = null;
  if (action) await action();
}

async function signInWithEmail(email, password) {
  setEmailAuthBusy(true);
  setEmailAuthStatus("");
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  setEmailAuthBusy(false);
  if (error) {
    setEmailAuthStatus(error.message || t("emailAuthRequired"));
    return;
  }
  setEmailAuthStatus(t("emailSignInReady"));
  customerTurnstileGate?.hide?.();
}

async function signUpWithEmail(email, password) {
  setEmailAuthBusy(true);
  setEmailAuthStatus("");
  const { error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/`
    }
  });
  setEmailAuthBusy(false);
  if (error) {
    setEmailAuthStatus(error.message || t("emailAuthRequired"));
    return;
  }
  emailAuthForm.reset();
  customerTurnstileGate?.hide?.();
  setEmailAuthStatus(t("emailSignUpSent"));
}

async function sendPasswordReset(email) {
  setEmailAuthBusy(true);
  setEmailAuthStatus("");
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/?reset_password=1`
  });
  setEmailAuthBusy(false);
  if (error) {
    setEmailAuthStatus(error.message || t("emailResetRequired"));
    return;
  }
  customerTurnstileGate?.hide?.();
  setEmailAuthStatus(t("emailResetSent"));
}

async function updateEmailPassword(password) {
  setEmailAuthBusy(true);
  setEmailAuthStatus("");
  const { error } = await supabaseClient.auth.updateUser({ password });
  setEmailAuthBusy(false);
  if (error) {
    setEmailAuthStatus(error.message || t("emailPasswordShort"));
    return;
  }
  emailAuthForm.reset();
  setEmailAuthMode("signin");
  setEmailAuthStatus(t("emailUpdateReady"));
}

async function signOutCustomer() {
  if (supabaseClient) await supabaseClient.auth.signOut();
  setCustomerSession(null);
  resetCustomerFlow();
}

function openEmailAuthModal(mode = "signin") {
  setEmailAuthMode(mode);
  if (!emailAuthModal) return;
  emailAuthModal.hidden = false;
  document.body.classList.add("modal-open");
  if (emailAuthTermsCheck) emailAuthTermsCheck.checked = false;
  window.setTimeout(() => emailAuthEmail?.focus(), 0);
}

function closeEmailAuthModal() {
  if (!emailAuthModal || emailAuthModal.hidden) return;
  emailAuthModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function setEmailAuthMode(mode) {
  emailAuthMode = mode || "signin";
  const isReset = emailAuthMode === "reset";
  const isSignup = emailAuthMode === "signup";
  const isUpdate = emailAuthMode === "update";

  emailAuthTabs.forEach((button) => {
    const active = button.dataset.authMode === emailAuthMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });

  emailAuthForm.hidden = Boolean(authSession?.user && !isUpdate);
  emailAuthEmailWrap.hidden = isUpdate;
  emailAuthPasswordWrap.hidden = isReset;
  emailAuthConfirmWrap.hidden = !(isSignup || isUpdate);
  if (emailAuthTermsWrap) emailAuthTermsWrap.hidden = !isSignup;
  emailAuthEmail.required = !isUpdate;
  emailAuthPassword.required = !isReset;
  emailAuthConfirm.required = isSignup || isUpdate;
  if (emailAuthTermsCheck) emailAuthTermsCheck.required = isSignup;
  emailAuthPassword.autocomplete = isSignup || isUpdate ? "new-password" : "current-password";

  const actionKey = isReset
    ? "emailResetAction"
    : isSignup
      ? "emailSignUpAction"
      : isUpdate
        ? "emailUpdateAction"
        : "emailSignInAction";
  emailAuthSubmit.textContent = t(actionKey);
  emailAuthSubmit.dataset.i18n = actionKey;
  if (emailAuthModalTitle) {
    const titleKey = isUpdate
      ? "emailUpdateTitle"
      : isSignup
        ? "emailCreateModalTitle"
        : isReset
          ? "emailResetTab"
          : "emailLoginModalTitle";
    emailAuthModalTitle.textContent = t(titleKey);
    emailAuthModalTitle.dataset.i18n = titleKey;
  }
  if (emailAuthSwitchText && emailAuthSwitchButton) {
    const switchTextKey = isSignup ? "emailSwitchToSignInText" : "emailSwitchToSignUpText";
    const switchActionKey = isSignup ? "emailSwitchToSignInAction" : "emailSwitchToSignUpAction";
    const switchMode = isSignup ? "signin" : "signup";
    emailAuthSwitchText.textContent = t(switchTextKey);
    emailAuthSwitchText.dataset.i18n = switchTextKey;
    emailAuthSwitchButton.textContent = t(switchActionKey);
    emailAuthSwitchButton.dataset.i18n = switchActionKey;
    emailAuthSwitchButton.dataset.authMode = switchMode;
  }

  if (isUpdate) {
    if (emailAuthModal?.hidden) {
      emailAuthModal.hidden = false;
      document.body.classList.add("modal-open");
    }
    customerAuthTitle.textContent = t("emailUpdateTitle");
    customerAuthSubtitle.textContent = t("emailUpdateHelp");
  }
  setEmailAuthStatus("");
}

function setEmailAuthStatus(message) {
  if (emailAuthStatus) emailAuthStatus.textContent = message || "";
}

function setEmailAuthBusy(isBusy) {
  emailAuthSubmit.disabled = isBusy;
  emailAuthTabs.forEach((button) => {
    button.disabled = isBusy;
  });
}

function isUsablePassword(password) {
  return String(password || "").length >= 6;
}

function setCustomerSession(session) {
  authSession = session;
  const email = session?.user?.email || "";
  customerLoginButton.hidden = Boolean(session?.user);
  customerLogoutButton.hidden = !session?.user;
  if (customerAuthActions) customerAuthActions.hidden = Boolean(session?.user && emailAuthMode !== "update");
  if (customerTurnstileWrap && customerTurnstileGate?.enabled) {
    if (session?.user) customerTurnstileGate.hide();
    customerTurnstileWrap.hidden = true;
  }

  if (session?.user) {
    closeEmailAuthModal();
    customerAuthTitle.textContent = `${t("authReady")} ${email}`;
    form.elements.email.value = email;
    form.elements.email.readOnly = true;
    if (!isEmailVerified(session.user)) {
      customerAuthSubtitle.textContent = t("authUnverified");
      usageState = null;
      historyLeads = [];
      quotaPanel.hidden = true;
      historyPanel.hidden = true;
      setFormDisabled(true);
      return;
    }
    customerAuthSubtitle.textContent = t("authReadyHelp");
    setFormDisabled(false);
    void loadUsage();
    void loadHistory();
  } else {
    customerAuthTitle.textContent = t("authRequired");
    customerAuthSubtitle.textContent = t("authRequired");
    emailAuthForm.hidden = false;
    form.elements.email.value = "";
    form.elements.email.readOnly = false;
    usageState = null;
    historyLeads = [];
    quotaPanel.hidden = true;
    historyPanel.hidden = true;
    historyList.replaceChildren();
    historyStatus.textContent = "";
    setFormDisabled(false);
  }
}

function setLanguage(nextLanguage) {
  language = nextLanguage;
  document.documentElement.lang = language === "fr" ? "fr-CA" : "en-CA";
  languageToggle.textContent = language === "en" ? "FR" : "EN";

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    if (text[language][key]) node.textContent = text[language][key];
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.dataset.i18nPlaceholder;
    if (text[language][key]) node.placeholder = text[language][key];
  });
  updateSelectPlaceholder(makeSelect, t("makePlaceholder"));
  updateSelectPlaceholder(modelSelect, t("modelPlaceholder"));
  updatePhotoStatusText();

  setCustomerSession(authSession);
  setEmailAuthMode(emailAuthMode);
}

function updateSelectPlaceholder(select, label) {
  const option = select?.querySelector("option[value='']");
  if (option) option.textContent = label;
}

function updateMode() {
  const mode = form.elements.mode.value;
  document.querySelectorAll(".mode-panel").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== mode;
  });
  selectedVehicle = null;
  pendingInput = null;
  choiceSection.hidden = true;
  vehicleReviewSection.hidden = true;
}

async function handleSubmit(event) {
  event.preventDefault();
  if (authSession?.user && !isEmailVerified(authSession.user)) {
    statusEl.textContent = t("pleaseVerifyEmail");
    return;
  }
  selectedVehicle = null;
  vehicleReviewSection.hidden = true;
  resultSection.hidden = true;

  const input = collectInput();
  pendingInput = input;

  if (!validateInput(input)) return;

  setBusy(true, t("searching"));
  try {
    const choices = await searchVehicles(input);
    if (!choices.length) {
      statusEl.textContent = t("noMatches");
      choiceSection.hidden = true;
      return;
    }

    if (choices.length === 1) {
      renderVehicleReview(choices[0], input);
      return;
    }

    renderChoices(choices, input);
    statusEl.textContent = t("chooseRequired");
  } catch (error) {
    statusEl.textContent = error.message || t("noMatches");
  } finally {
    setBusy(false);
  }
}

function collectInput() {
  const formData = new FormData(form);
  const input = Object.fromEntries(formData.entries());
  const vin = cleanVin(input.vin);
  const postalCode = String(input.postalCode || "").trim().toUpperCase();
  return {
    mode: input.mode,
    year: String(input.year || "").trim(),
    make: String(input.make || "").trim(),
    model: String(input.model || "").trim(),
    vin,
    postalCode,
    kilometers: normalizeKilometers(input.kilometers),
    email: authSession?.user?.email || String(input.email || "").trim(),
    phone: String(input.phone || "").trim(),
    region: provinceFromPostal(postalCode),
    country: "C",
    language: language === "fr" ? "fr" : "en",
    ownershipType: String(input.ownershipType || "").trim(),
    ownsVehicle: input.ownershipType === "Owned"
  };
}

function validateInput(input) {
  const hasBasics = input.postalCode && input.kilometers;
  const hasVehicle = input.mode === "vin"
    ? input.vin.length >= 10
    : input.year && input.make && input.model;

  if (input.mode === "vin" && input.vin && input.vin.length < 10) {
    statusEl.textContent = t("invalidVin");
    return false;
  }

  if (input.kilometers <= 500) {
    statusEl.textContent = t("odometerTooLow");
    form.elements.kilometers.focus();
    return false;
  }

  if (!input.ownershipType) {
    statusEl.textContent = t("ownershipRequired");
    form.elements.ownershipType[0]?.focus();
    return false;
  }

  if (!hasBasics || !hasVehicle) {
    statusEl.textContent = t("required");
    return false;
  }

  return true;
}

async function searchVehicles(input) {
  if (input.mode === "drilldown") {
    const query = new URLSearchParams({
      year: input.year,
      make: input.make,
      model: input.model,
      country: input.country || "C"
    });
    const response = await fetch(`/api/drilldown?${query.toString()}`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || t("noMatches"));
    return (data.vehicles || [])
      .filter((item) => item.title || item.uvc)
      .slice(0, 20);
  }

  const searchText = input.mode === "vin"
    ? input.vin
    : [input.year, input.make, input.model].filter(Boolean).join(" ");
  const response = await fetch(`/api/autocomplete?searchText=${encodeURIComponent(searchText)}`);
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || t("noMatches"));
  return (data.items || []).filter((item) => item.title || item.uvc).slice(0, 8);
}

function renderChoices(choices, input) {
  choiceList.replaceChildren(...choices.map((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.innerHTML = `
      <strong>${escapeHtml(choice.title || vehicleTitle(choice))}</strong>
      <span>UVC ${escapeHtml(choice.uvc || "-")} · ${escapeHtml(choice.year || "")} ${escapeHtml(choice.make || "")} ${escapeHtml(choice.model || "")}</span>
      <span>${t("selectText")}</span>
    `;
    button.addEventListener("click", () => renderVehicleReview(choice, input));
    return button;
  }));
  choiceSection.hidden = false;
  vehicleReviewSection.hidden = true;
  choiceSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderVehicleReview(vehicle, input) {
  selectedVehicle = vehicle;
  pendingInput = input;
  clearSelectedPhotos();
  reviewForm.reset();

  choiceSection.hidden = true;
  resultSection.hidden = true;
  vehicleReviewSection.hidden = false;

  const title = vehicle.title || vehicleTitle({
    year: vehicle.year || input.year,
    make: vehicle.make || input.make,
    model: vehicle.model || input.model,
    series: vehicle.series,
    style: vehicle.style
  });

  setText("#review-vehicle-title", title || "Vehicle");
  setText("#review-vin", input.vin || vehicle.vin || "-");
  setText("#review-uvc", vehicle.uvc || "-");
  setText("#review-year", vehicle.year || input.year || "-");
  setText("#review-make", vehicle.make || input.make || "-");
  setText("#review-model", vehicle.model || input.model || "-");
  setText("#review-kilometers", input.kilometers ? `${formatNumber(input.kilometers)} km` : "-");
  setText("#review-region", regionName(input.region));
  setText("#review-postal", input.postalCode || "-");
  setText("#review-ownership", ownershipLabel(input.ownershipType));
  const inferred = inferVehicleDetails(vehicle);
  populateReviewSummary(inferred);
  populateReviewSelects(vehicle, inferred);
  populateColorOptions(input.color || vehicle.color || "");

  statusEl.textContent = t("vehicleReady");
  vehicleReviewSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function populateReviewSummary(inferred = {}) {
  setOptionalSummaryValue("series", uniqueReviewValues(inferred.series)[0]);
  setOptionalSummaryValue("style", uniqueReviewValues(inferred.style)[0]);
  setOptionalSummaryValue("engine", uniqueReviewValues(inferred.engine)[0]);
  setOptionalSummaryValue("drivetrain", uniqueReviewValues(inferred.drivetrain)[0]);
  setOptionalSummaryValue("transmission", uniqueReviewValues(inferred.transmission)[0]);
}

function setOptionalSummaryValue(name, value) {
  const row = document.querySelector(`[data-review-summary-row="${cssEscape(name)}"]`);
  const output = document.querySelector(`#review-summary-${cssEscape(name)}`);
  const displayValue = String(value || "").trim();
  if (row) row.hidden = !displayValue;
  if (output) output.textContent = displayValue || "-";
}

function populateReviewSelects(vehicle = {}, inferred = inferVehicleDetails(vehicle)) {
  const visible = [
    setReviewFieldOptions("series", inferred.series),
    setReviewFieldOptions("engine", inferred.engine),
    setReviewFieldOptions("drivetrain", inferred.drivetrain),
    setTransmissionOptions(inferred.transmission),
    setReviewFieldOptions("style", inferred.style)
  ].some(Boolean);
  if (blackbookOptions) blackbookOptions.hidden = !visible;
}

function ownershipLabel(value) {
  const key = {
    Owned: "ownershipOwned",
    Financed: "ownershipFinanced",
    Leased: "ownershipLeased"
  }[value];
  return key ? t(key) : "-";
}

function setReviewFieldOptions(name, values) {
  const field = reviewForm.elements[name];
  const datalist = document.querySelector(`#${name}-options`);
  const wrapper = document.querySelector(`[data-review-option="${cssEscape(name)}"]`);
  if (!field) return;

  const uniqueValues = uniqueReviewValues(values);
  const shouldShow = uniqueValues.length > 1;
  if (wrapper) wrapper.hidden = !shouldShow;
  field.value = uniqueValues[0] || "";

  if (datalist) {
    datalist.innerHTML = uniqueValues
      .map((value) => `<option value="${escapeHtml(value)}"></option>`)
      .join("");
  }
  return shouldShow;
}

function setTransmissionOptions(values = []) {
  const select = reviewForm.elements.transmission;
  const wrapper = document.querySelector('[data-review-option="transmission"]');
  if (!select) return;
  const inferred = uniqueReviewValues(values);
  const shouldShow = inferred.length > 1;
  if (wrapper) wrapper.hidden = !shouldShow;
  const matched = inferred.find((value) => /manual/i.test(value))
    ? "Manual"
    : inferred.find((value) => /auto|automatic|cvt/i.test(value))
      ? "Automatic"
      : inferred[0] || "";

  if (!inferred.length) {
    select.innerHTML = "";
    return false;
  }

  select.innerHTML = uniqueReviewValues([matched, ...inferred])
    .map((value) => `<option value="${escapeHtml(value)}"${value === matched ? " selected" : ""}>${escapeHtml(value)}</option>`)
    .join("");
  return true;
}

function uniqueReviewValues(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function inferVehicleDetails(vehicle = {}) {
  const title = String(vehicle.title || "");
  return {
    series: [vehicle.series, vehicle.trim, vehicle.series_description].filter(Boolean),
    engine: [
      vehicle.engine,
      vehicle.engine_description,
      vehicle.engine_size,
      findTitleDetail(title, /\b\d(?:\.\d)?L\b[^,]*/i),
      findTitleDetail(title, /\b(?:V6|V8|I4|Hybrid|Electric|Turbo|Supercharged)[^,]*/i)
    ].filter(Boolean),
    drivetrain: [
      vehicle.drivetrain,
      vehicle.drive_train,
      vehicle.drive,
      findTitleDetail(title, /\b(?:AWD|FWD|RWD|4WD|4X4)\b/i)
    ].filter(Boolean),
    transmission: [
      vehicle.transmission,
      vehicle.transmission_description,
      findTitleDetail(title, /\b(?:Automatic|Manual|CVT)\b/i)
    ].filter(Boolean),
    style: [vehicle.style, vehicle.body_style, vehicle.body].filter(Boolean)
  };
}

function populateColorOptions(selectedColor = "") {
  const field = reviewForm.elements.color;
  const datalist = document.querySelector("#color-options");
  if (!field) return;
  const selected = String(selectedColor || "").trim();
  field.value = selected;

  if (datalist) {
    datalist.innerHTML = commonColors
      .map((value) => `<option value="${escapeHtml(value)}"></option>`)
      .join("");
  }
}

function findTitleDetail(title, pattern) {
  const match = String(title || "").match(pattern);
  return match?.[0]?.trim() || "";
}

async function handleReviewSubmit(event) {
  event.preventDefault();
  if (!selectedVehicle || !pendingInput) {
    statusEl.textContent = t("chooseRequired");
    return;
  }

  const extraInput = collectReviewInput();
  setBusy(true, t("valuing"));
  try {
    await generateForVehicle(selectedVehicle, { ...pendingInput, ...extraInput });
  } catch (error) {
    statusEl.textContent = error.message || t("noMatches");
  } finally {
    setBusy(false);
  }
}

function collectReviewInput() {
  const formData = new FormData(reviewForm);
  const photos = [...selectedPhotos.values()];
  return {
    series: cleanReviewValue(formData.get("series")),
    engine: cleanReviewValue(formData.get("engine")),
    drivetrain: cleanReviewValue(formData.get("drivetrain")),
    transmission: cleanReviewValue(formData.get("transmission")),
    style: cleanReviewValue(formData.get("style")),
    color: String(formData.get("color") || "").trim(),
    conditionNotes: String(formData.get("conditionNotes") || "").trim(),
    website: String(formData.get("website") || "").trim(),
    photoCount: photos.length,
    photoNames: photos.map((photo) => photo.name),
    photoMetadata: photos.map(({ base64, ...photo }) => photo),
    photoFiles: photos
  };
}

function cleanReviewValue(value) {
  const text = String(value || "").trim();
  return text.startsWith("- Select ") || text === "Not sure" ? "" : text;
}

async function renderPhotoPreview(event) {
  const input = event.currentTarget;
  const role = input.dataset.photoRole || "vehicle-photo";
  const label = input.dataset.photoLabel || role;
  const file = Array.from(input.files || []).find((item) => /^image\//.test(item.type));
  const preview = document.querySelector(`[data-photo-preview="${cssEscape(role)}"]`);

  selectedPhotos.delete(role);
  if (preview) preview.replaceChildren();
  if (!file) return;

  const photo = await compressPhoto(file, { role, label });
  selectedPhotos.set(role, photo);
  updatePhotoStatusText(role, photo.name);

  if (preview) {
    const image = document.createElement("img");
    const caption = document.createElement("figcaption");
    image.alt = photo.name;
    image.src = `data:${photo.mimeType};base64,${photo.base64}`;
    caption.textContent = `${label}: ${photo.name}`;
    preview.append(image, caption);
  }
}

function compressPhoto(file, photoRole = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read photo"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Unable to process photo"));
      image.onload = () => {
        const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY);
        const base64 = dataUrl.split(",")[1] || "";
        resolve({
          name: normalizePhotoName(file.name, photoRole.role),
          originalName: file.name,
          angle: photoRole.label || photoRole.role || "",
          role: photoRole.role || "",
          mimeType: "image/jpeg",
          size: Math.round(base64.length * 0.75),
          width: canvas.width,
          height: canvas.height,
          base64
        });
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function normalizePhotoName(name, role = "") {
  const prefix = String(role || "vehicle-photo")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "vehicle-photo";
  const base = String(name || "vehicle-photo")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70) || "photo";
  return `${prefix}-${base}.jpg`;
}

function clearSelectedPhotos() {
  selectedPhotos.clear();
  photoInputs.forEach((input) => {
    input.value = "";
    const role = input.dataset.photoRole || "";
    const preview = document.querySelector(`[data-photo-preview="${cssEscape(role)}"]`);
    if (preview) preview.replaceChildren();
    updatePhotoStatusText(role);
  });
}

function updatePhotoStatusText(role = "", fileName = "") {
  const statuses = role
    ? [document.querySelector(`[data-photo-status="${cssEscape(role)}"]`)].filter(Boolean)
    : [...document.querySelectorAll("[data-photo-status]")];

  statuses.forEach((status) => {
    const statusRole = status.dataset.photoStatus || "";
    const selected = fileName || selectedPhotos.get(statusRole)?.name || "";
    status.textContent = selected || t("noPhotoSelected");
  });
}

function cssEscape(value) {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value || "").replace(/["\\]/g, "\\$&");
}

async function generateForVehicle(vehicle, baseInput) {
  if (!authSession?.user) {
    statusEl.textContent = t("pleaseLogin");
    customerAuthTitle.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (!isEmailVerified(authSession.user)) {
    statusEl.textContent = t("pleaseVerifyEmail");
    customerAuthTitle.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (!usageState) await loadUsage();
  if (!canUseValuation()) return;

  selectedVehicle = vehicle;
  const payload = {
    ...baseInput,
    vin: baseInput.vin,
    uvc: vehicle.uvc || "",
    year: vehicle.year || baseInput.year,
    make: vehicle.make || baseInput.make,
    model: vehicle.model || baseInput.model,
    series: baseInput.series || vehicle.series || "",
    engine: baseInput.engine || vehicle.engine || "",
    drivetrain: baseInput.drivetrain || vehicle.drivetrain || vehicle.drive_train || "",
    transmission: baseInput.transmission || vehicle.transmission || "",
    style: baseInput.style || vehicle.style || ""
  };

  statusEl.textContent = t("valuing");
  const response = await fetch("/api/valuation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const valuation = await response.json();
  if (!valuation.ok) throw new Error(valuation.error || t("noMatches"));

  if (valuation.choices?.length > 1 && !payload.uvc) {
    renderChoices(valuation.choices, baseInput);
    return;
  }

  renderResult(valuation, payload);
  statusEl.textContent = t("saving");
  const capture = await captureLead(payload, valuation);
  statusEl.textContent = capture?.captured || capture?.webhook?.submitted || capture?.googleForm?.submitted
    ? t("saved")
    : t("saveIssue");
  choiceSection.hidden = true;
  vehicleReviewSection.hidden = true;
  await loadUsage();
  await loadHistory();
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
          email: authSession?.user?.email || input.email,
          name: authSession?.user?.user_metadata?.full_name || authSession?.user?.user_metadata?.name || ""
        }
      })
    });
    return response.json();
  } catch (error) {
    console.warn(error);
    return { ok: false, captured: false };
  }
}

async function loadUsage() {
  if (!authSession?.user) return null;

  const userId = encodeURIComponent(authSession.user.id || "");
  const email = encodeURIComponent(authSession.user.email || "");
  quotaPanel.hidden = false;
  quotaTitle.textContent = t("quotaChecking");
  quotaSubtitle.textContent = "";

  try {
    const response = await fetch(`/api/usage?userId=${userId}&email=${email}`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || t("quotaUnavailable"));

    usageState = data;
    if (data.unlimited || Number(data.annualLimit) < 0) {
      quotaTitle.textContent = "Unlimited";
      quotaSubtitle.textContent = `${data.used} ${t("quotaSummary")} unlimited in ${data.year}`;
    } else {
      quotaTitle.textContent = `${data.remaining} ${t("quotaLeft")}`;
      quotaSubtitle.textContent = `${data.used} ${t("quotaSummary")} ${data.annualLimit} in ${data.year}`;
    }
    if (!data.unlimited && data.remaining <= 0) {
      statusEl.textContent = `${data.year} ${t("limitReached")} ${data.contact || "Please contact the website owner for more valuations."}`;
    }
  } catch (error) {
    usageState = null;
    quotaTitle.textContent = t("quotaUnavailable");
    quotaSubtitle.textContent = error.message || t("quotaUnavailable");
  }

  return usageState;
}

async function loadHistory() {
  if (!authSession?.access_token) return;

  historyPanel.hidden = false;
  historyStatus.textContent = t("historyLoading");

  try {
    const response = await fetch("/api/my-leads", {
      headers: {
        Authorization: `Bearer ${authSession.access_token}`
      }
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || t("historyEmpty"));

    historyLeads = data.leads || [];
    renderHistory(historyLeads);
  } catch (error) {
    historyLeads = [];
    historyStatus.textContent = error.message || t("historyEmpty");
    historyList.replaceChildren();
  }
}

function renderHistory(leads) {
  if (!leads.length) {
    historyStatus.textContent = t("historyEmpty");
    historyList.replaceChildren();
    return;
  }

  historyStatus.textContent = `${leads.length} ${t("historySaved")}${leads.length === 1 ? "" : "s"}.`;
  historyList.innerHTML = leads.map((lead, index) => {
    const input = lead.input || {};
    const valuation = lead.valuation || {};
    const title = valuation.title || vehicleTitle(input) || "Vehicle valuation";
    const wholesaleRange = marketRange(valuation, "wholesale");
    const retailRange = marketRange(valuation, "retail");
    const wholesaleAvg = marketAverage(valuation, "wholesale");
    const retailAvg = marketAverage(valuation, "retail");

    return `
      <article class="history-card">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <time>${escapeHtml(formatDateTime(lead.created_at))}</time>
        </div>
        <dl class="history-meta">
          <div><dt>VIN</dt><dd>${escapeHtml(valuation.vin || input.vin || "-")}</dd></div>
          <div><dt>UVC</dt><dd>${escapeHtml(input.uvc || "-")}</dd></div>
          <div><dt>${escapeHtml(t("odometerLabel"))}</dt><dd>${input.kilometers ? formatNumber(input.kilometers) : "-"}</dd></div>
          <div><dt>${escapeHtml(t("postalLabel"))}</dt><dd>${escapeHtml(valuation.region || input.region || "-")}</dd></div>
          <div><dt>${escapeHtml(t("colorLabel"))}</dt><dd>${escapeHtml(input.color || "Not provided")}</dd></div>
          <div><dt>Status</dt><dd>${escapeHtml(lead.status || "new")}</dd></div>
        </dl>
        <div class="history-values">
          <span><b>${escapeHtml(t("dealerPurchaseRange"))}</b>${escapeHtml(moneyRangeOrDash(wholesaleRange))}<small>${escapeHtml(t("averageLabel"))}: ${escapeHtml(moneyOrDash(wholesaleAvg))}</small></span>
          <span><b>${escapeHtml(t("privateSaleRange"))}</b>${escapeHtml(moneyRangeOrDash(retailRange))}<small>${escapeHtml(t("averageLabel"))}: ${escapeHtml(moneyOrDash(retailAvg))}</small></span>
        </div>
        <div class="history-actions">
          <button type="button" data-history-index="${index}">${escapeHtml(t("historyView"))}</button>
          <button class="danger" type="button" data-delete-lead-id="${escapeHtml(lead.id || "")}">${escapeHtml(t("historyDelete"))}</button>
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
  if (!id || !authSession?.access_token) return;

  const confirmed = window.confirm(t("historyDeleteConfirm"));
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = t("historyDeleting");
  historyStatus.textContent = t("historyDeleting");

  try {
    const response = await fetch(`/api/my-leads?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authSession.access_token}`
      }
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || t("historyDeleteError"));

    historyLeads = historyLeads.filter((lead) => lead.id !== id);
    renderHistory(historyLeads);
    historyStatus.textContent = t("historyDeleted");
    await loadUsage();
  } catch (error) {
    button.disabled = false;
    button.textContent = t("historyDelete");
    historyStatus.textContent = error.message || t("historyDeleteError");
  }
}

function showHistoryResult(lead) {
  if (!lead) return;
  const input = lead.input || {};
  const valuation = lead.valuation || {};
  selectedVehicle = {
    title: valuation.title || vehicleTitle(input),
    uvc: input.uvc || "",
    year: input.year || "",
    make: input.make || "",
    model: input.model || "",
    series: input.series || "",
    style: input.style || ""
  };
  renderResult({
    ok: true,
    title: valuation.title || vehicleTitle(input) || "Vehicle",
    vin: valuation.vin || input.vin || "",
    kilometers: input.kilometers || valuation.kilometers || 0,
    region: valuation.region || input.region || "",
    country: valuation.country || input.country || "C",
    values: valuation.values || {},
    loanValue: valuation.loanValue || null,
    thresholds: valuation.thresholds || null
  }, input);
}

function renderResult(valuation, input) {
  const wholesale = marketRange(valuation, "wholesale");
  const retail = marketRange(valuation, "retail");
  const wholesaleAvg = marketAverage(valuation, "wholesale");
  const retailAvg = marketAverage(valuation, "retail");
  resultTitle.textContent = valuation.title || selectedVehicle?.title || vehicleTitle(input);
  resultMeta.textContent = [
    [input.style, input.engine, input.transmission, input.drivetrain].filter(Boolean).join(", "),
    input.kilometers ? `${formatNumber(input.kilometers)} km` : "",
    regionName(input.region)
  ].filter(Boolean).join(" · ");
  resultMeta.textContent = resultMeta.textContent.replace(/\s+[^\w\s.,-]+\s+/g, " | ");
  wholesaleValue.textContent = moneyRangeOrDash(wholesale);
  retailValue.textContent = moneyRangeOrDash(retail);
  if (wholesaleAverage) wholesaleAverage.textContent = `${t("averageLabel")}: ${moneyOrDash(wholesaleAvg)}`;
  if (retailAverage) retailAverage.textContent = `${t("averageLabel")}: ${moneyOrDash(retailAvg)}`;
  resultSection.hidden = false;
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function marketAverage(valuation, market) {
  const values = valuation?.values?.[market] || {};
  return positiveNumber(values.adjusted?.avg) ?? positiveNumber(values.base?.avg) ?? null;
}

function marketRange(valuation, market) {
  const values = valuation?.values?.[market] || {};
  const row = values.adjusted || values.base || {};
  const numbers = ["rough", "avg", "clean", "xclean"]
    .map((key) => row[key])
    .filter((value) => positiveNumber(value) !== null)
    .map(Number);
  if (!numbers.length) return null;
  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers)
  };
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function moneyRangeOrDash(range) {
  if (!range) return t("valueUnavailable");
  if (range.min === range.max) return moneyOrDash(range.min);
  return `${moneyOrDash(range.min)} - ${moneyOrDash(range.max)}`;
}

function moneyOrDash(value) {
  if (value === null || value === undefined || value === "") return t("valueUnavailable");
  return new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0
  }).format(Number(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
    maximumFractionDigits: 0
  }).format(Number(value));
}

function formatHistoryValue(value) {
  return value === null || value === undefined ? "-" : formatNumber(value);
}

function formatDateTime(value) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-CA", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function vehicleTitle(vehicle = {}) {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.series, vehicle.style]
    .filter(Boolean)
    .join(" ") || "Vehicle";
}

function canUseValuation() {
  if (usageState?.unlimited || Number(usageState?.annualLimit) < 0) return true;
  if (!usageState || usageState.remaining > 0) return true;
  const message = `${usageState.year} ${t("limitReached")} ${usageState.contact || "Please contact the website owner for more valuations."}`;
  statusEl.textContent = message;
  return false;
}

function resetCustomerFlow() {
  selectedVehicle = null;
  pendingInput = null;
  clearSelectedPhotos();
  choiceSection.hidden = true;
  vehicleReviewSection.hidden = true;
  resultSection.hidden = true;
  reviewForm.reset();
  statusEl.textContent = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setBusy(isBusy, message = "") {
  const button = document.querySelector("#continue-button");
  const reviewButton = document.querySelector("#generate-review");
  button.disabled = isBusy;
  if (reviewButton) reviewButton.disabled = isBusy;
  if (message) statusEl.textContent = message;
}

function setFormDisabled(disabled) {
  form.querySelectorAll("input, select, button").forEach((control) => {
    if (control.id === "postal-help") return;
    control.disabled = disabled;
  });
  reviewForm.querySelectorAll("input, textarea, button").forEach((control) => {
    control.disabled = disabled;
  });
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function isEmailVerified(user) {
  if (!user) return false;
  if (user.email_confirmed_at || user.confirmed_at) return true;
  const metadata = user.user_metadata || {};
  if (metadata.email_verified === true) return true;
  if (metadata.email_verified === "true") return true;
  return false;
}

function provinceFromPostal(postalCode) {
  const first = String(postalCode || "").trim().charAt(0).toUpperCase();
  return {
    A: "NL",
    B: "NS",
    C: "PE",
    E: "NB",
    G: "QC",
    H: "QC",
    J: "QC",
    K: "ON",
    L: "ON",
    M: "ON",
    N: "ON",
    P: "ON",
    R: "MB",
    S: "SK",
    T: "AB",
    V: "BC",
    X: "NT",
    Y: "YT"
  }[first] || "ON";
}

function regionName(code) {
  const names = {
    AB: language === "fr" ? "Alberta" : "Alberta",
    BC: language === "fr" ? "Colombie-Britannique" : "British Columbia",
    MB: "Manitoba",
    NB: language === "fr" ? "Nouveau-Brunswick" : "New Brunswick",
    NL: language === "fr" ? "Terre-Neuve-et-Labrador" : "Newfoundland and Labrador",
    NS: language === "fr" ? "Nouvelle-Écosse" : "Nova Scotia",
    NT: language === "fr" ? "Territoires du Nord-Ouest" : "Northwest Territories",
    NU: "Nunavut",
    ON: "Ontario",
    PE: language === "fr" ? "Île-du-Prince-Édouard" : "Prince Edward Island",
    QC: language === "fr" ? "Québec" : "Quebec",
    SK: "Saskatchewan",
    YT: "Yukon"
  };
  return names[code] || code || "Ontario";
}

function normalizeKilometers(value) {
  const number = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function cleanVin(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
}

function openModal() {
  modal.hidden = false;
}

function closeModal() {
  modal.hidden = true;
}

function openVinGuide() {
  vinGuide.hidden = false;
}

function closeVinGuide() {
  vinGuide.hidden = true;
}

function t(key) {
  return text[language][key] || text.en[key] || key;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
