// Données SEO du site : une seule source pour
//  - le pré-rendu HTML au build (scripts/prerender.mjs) : titre, description, contenu lisible par Google ;
//  - les pages React (titre de l'onglet, FAQ affichée) ;
//  - le sitemap.
// Fichier sans JSX ni dépendance : importable depuis Node.
// Règle : tout texte pré-rendu doit aussi être visible dans la page React (pas de contenu caché).

export const SITE = 'https://atelierlogistique.com';
export const SITE_NAME = 'Atelier Logistique';

export const OPTIMIZER_FAQ = [
  { q: 'L’outil est-il gratuit et sans compte ?', a: 'Oui. L’optimiseur fonctionne entièrement dans votre navigateur, sans inscription. Vos données ne sont ni enregistrées ni transmises à un service externe.' },
  { q: 'Quelles marchandises puis-je charger ?', a: 'Des cartons, colis ou palettes de forme rectangulaire. Vous indiquez pour chaque référence ses dimensions, son poids, sa quantité, si la rotation est autorisée et son empilage : libre, dessus uniquement (rien par-dessus), au sol, ou au sol sans rien dessus. Le camion est chargé par murs, de la cabine vers les portes, pour que chaque colis reste accessible.' },
  { q: 'Quels véhicules et conteneurs sont pris en charge ?', a: 'Une semi-remorque standard, les conteneurs maritimes 20 pieds, 40 pieds et 40 pieds High Cube, ainsi que des dimensions personnalisées.' },
  { q: 'Comment est calculé le plan de chargement ?', a: 'Un moteur de bin packing 3D place les unités une à une en respectant les parois, le poids maximal, les rotations autorisées, l’empilabilité et la stabilité (chaque objet est supporté). Plusieurs ordres de placement sont testés et le meilleur résultat est conservé.' },
  { q: 'Puis-je préparer un camion pour plusieurs livraisons (tournée) ?', a: 'Oui. Indiquez pour chaque référence son numéro d’arrêt (1 = livré en premier) et, si vous le souhaitez, la destination. Le dernier arrêt est chargé au fond, le premier côté portes, et aucun colis d’un arrêt ultérieur ne bloque l’accès à un arrêt précédent. Si tout ne rentre pas, vous choisissez de retirer un arrêt entier ou seulement les colis en excès.' },
  { q: 'Le taux de remplissage de 100 % est-il atteignable ?', a: 'Rarement. Un taux volumétrique ne signifie pas que l’espace restant est exploitable d’un seul tenant. L’objectif est un chargement dense, stable et réaliste à préparer.' },
];

export const PALLET_FAQ = [
  { q: 'Combien de cartons tiennent sur une palette EUR ?', a: 'On multiplie le nombre de cartons par couche par le nombre de couches. Exemple : des cartons de 40 × 30 × 25 cm sur une palette EUR 120 × 80 cm donnent 8 cartons par couche ; avec une hauteur totale de 1,80 m (plateau de 14,4 cm compris), on pose 6 couches, soit 48 cartons. L’outil teste aussi les motifs croisés qui mélangent les deux orientations pour gagner des cartons par couche.' },
  { q: 'Quelle hauteur maximale pour une palette ?', a: 'Elle dépend du transport et du client : souvent 1,80 m en messagerie, jusqu’à la hauteur utile du véhicule en lot complet. La charge maximale dépend du support (souvent 1 000 kg pour une palette EUR en usage courant). Ces valeurs sont modifiables pour chaque support dans l’outil.' },
  { q: 'Palette EUR ou EUR3 : laquelle choisir ?', a: 'Cochez les supports dont vous disposez : l’outil choisit automatiquement celui qui donne le moins de palettes, puis le moins de place au sol, puis le coût le plus bas, et explique son choix. Vous pouvez aussi imposer un support par ligne ou par destination, par exemple quand un client exige de l’EUR.' },
  { q: 'Qu’est-ce qu’une palette mixte ?', a: 'Une palette qui regroupe plusieurs références. L’outil prépare d’abord des palettes complètes mono-référence (plus simples à préparer et à contrôler), puis place les reliquats sur des palettes mixtes calculées en 3D, avec les colis lourds en bas et rien sur un colis non gerbable.' },
  { q: 'Puis-je importer mes articles depuis mon ERP ou mon WMS ?', a: 'Oui. Importez un fichier Excel ou CSV, ou collez des lignes copiées depuis un tableur. L’assistant reconnaît les colonnes, les unités (mm, cm, g, kg) et mémorise la correspondance pour vos prochains imports.' },
  { q: 'Comment charger ensuite les palettes dans un camion ?', a: 'Un clic sur « Charger le camion » envoie les palettes (dimensions, poids, gerbage, arrêt) dans l’optimiseur de chargement 3D, qui calcule le plan de chargement de la semi-remorque ou du conteneur.' },
  { q: 'L’outil est-il gratuit ?', a: 'Oui, gratuit et sans inscription. Le calcul se fait dans votre navigateur : vos données ne sont envoyées à aucun serveur.' },
];

/** Pages outils. `path` = URL ; `related` = outils liés ; `articles` = guides liés (slugs). */
export const TOOL_PAGES = [
  {
    id: 'optimiseur-chargement',
    ownH1: true, // la page React affiche déjà son <h1>
    name: 'Optimiseur de chargement 3D',
    title: 'Optimiseur de chargement camion et conteneur 3D gratuit | Atelier Logistique',
    description: 'Calculez gratuitement le plan de chargement d’une semi-remorque ou d’un conteneur 20’/40’ : palettes et colis, tournées multi-arrêts, empilage, essieux, vue 3D.',
    h1: 'Optimiseur de chargement 3D',
    intro: 'Optimisez le remplissage de vos camions et conteneurs en quelques secondes.',
    features: [
      'Plan de chargement 3D d’une semi-remorque, d’un conteneur 20’, 40’ ou 40’ High Cube, ou de dimensions personnalisées.',
      'Tournées multi-arrêts : le premier livré est chargé côté portes, aucun colis ne bloque un arrêt précédent.',
      'Empilage, rotation, poids maxi, répartition des charges sur les essieux et nombre de sangles d’arrimage.',
      'Import Excel / CSV depuis votre ERP ou WMS et export de la séquence de chargement.',
    ],
    faq: OPTIMIZER_FAQ,
    related: ['pallet', 'units', 'cmr'],
    articles: ['plan-de-chargement-camion', 'repartition-des-charges-camion', 'arrimage-des-charges'],
  },
  {
    id: 'pallet',
    ownH1: true, // la page React affiche déjà son <h1>
    name: 'Palettisation 3D',
    title: 'Calcul de palettisation 3D gratuit : plan de palette EUR | Atelier Logistique',
    description: 'Combien de cartons par palette ? Calculez votre plan de palettisation EUR, EUR3 ou sur mesure : palettes complètes et mixtes en 3D, puis chargement du camion en un clic.',
    h1: 'Palettisation 3D',
    intro: 'Préparez vos palettes complètes et mixtes, puis chargez-les dans le camion en un clic.',
    features: [
      'Palettes complètes mono-référence : plan de couche optimisé, couches alternées, charge centrée.',
      'Reliquats en palettes mixtes calculées en 3D, sans jamais mélanger deux destinations.',
      'Choix automatique du support (EUR, EUR3, demi-palette, US, sur mesure) avec son explication.',
      'Fiche PDF, export CSV et envoi des palettes dans l’optimiseur de chargement.',
    ],
    faq: PALLET_FAQ,
    related: ['optimiseur-chargement', 'units', 'barcode'],
    articles: ['plan-de-chargement-camion'],
  },
  {
    id: 'audit',
    ownH1: true, // la page React affiche déjà son <h1>
    name: 'Audit Supply Chain',
    title: 'Audit supply chain gratuit : ABC XYZ, stock dormant, OTIF | Atelier Logistique',
    description: 'Diagnostic supply chain en 5 minutes à partir de vos fichiers : classification ABC × XYZ, stock dormant chiffré, OTIF, couverture et Health Score, avec rapport PDF.',
    h1: 'Audit Supply Chain',
    intro: 'Diagnostic de vos stocks et de votre performance en 5 minutes, à partir de vos propres fichiers.',
    features: [
      'Classification ABC × XYZ de vos articles.',
      'Stock dormant chiffré, couverture et OTIF.',
      'Health Score de 0 à 100 et rapport PDF.',
    ],
    related: ['safety', 'ddmrp', 'sla'],
    articles: ['audit-supply-chain'],
  },
  {
    id: 'zpl',
    name: 'ZPL Viewer',
    title: 'Visualiseur ZPL en ligne gratuit : aperçu d’étiquette Zebra | Atelier Logistique',
    description: 'Collez votre code ZPL et visualisez l’étiquette Zebra instantanément, puis exportez-la en PNG ou en PDF. Gratuit, sans installation.',
    h1: 'ZPL Viewer',
    intro: 'Visualisez et exportez vos étiquettes ZPL en PNG ou PDF.',
    features: ['Aperçu immédiat du code ZPL.', 'Export PNG ou PDF de l’étiquette.', 'Sans installation ni imprimante.'],
    related: ['barcode', 'pallet'],
    articles: [],
  },
  {
    id: 'barcode',
    name: 'Codes-barres',
    title: 'Générateur de codes-barres gratuit : EAN-13, GS1-128, QR, Data Matrix | Atelier Logistique',
    description: 'Générez gratuitement vos codes-barres : EAN-13, UPC, Code 128, GTIN-14 / ITF-14, QR Code, Data Matrix, PDF417. 10 symbologies, sans inscription.',
    h1: 'Générateur de codes-barres',
    intro: '10 symbologies : EAN, UPC, Code 128, GTIN-14, QR, Data Matrix, PDF417.',
    features: ['Codes linéaires EAN, UPC, Code 128, ITF-14.', 'Codes 2D QR, Data Matrix, PDF417.', 'Calcul de la clé de contrôle GTIN.'],
    related: ['zpl', 'pallet'],
    articles: [],
  },
  {
    id: 'safety',
    name: 'Stock de sécurité',
    title: 'Calcul du stock de sécurité en ligne : formule et point de commande | Atelier Logistique',
    description: 'Calculez votre stock de sécurité selon le taux de service, la variabilité de la demande et du délai, et le point de commande. Courbe de distribution incluse.',
    h1: 'Calcul du stock de sécurité',
    intro: 'Calcul σL, taux de service et point de commande, avec la courbe de distribution.',
    features: ['Variabilité de la demande et du délai d’approvisionnement.', 'Taux de service cible.', 'Point de commande (ROP).'],
    related: ['ddmrp', 'audit'],
    articles: ['ddmrp'],
  },
  {
    id: 'ddmrp',
    name: 'Buffers DDMRP',
    title: 'Calcul des buffers DDMRP en ligne : zones rouge, jaune, verte | Atelier Logistique',
    description: 'Dimensionnez vos buffers DDMRP à partir de la consommation moyenne (ADU), du délai découplé et de la variabilité : zones rouge, jaune et verte.',
    h1: 'Buffers DDMRP',
    intro: 'Dimensionnement des buffers stratégiques (zones rouge, jaune, verte) à partir de l’ADU, du délai et de la variabilité.',
    features: ['Calcul des zones rouge, jaune et verte.', 'Facteurs de délai et de variabilité.', 'Méthode Demand Driven MRP.'],
    related: ['safety', 'audit'],
    articles: ['ddmrp', 'ia-et-ddmrp'],
  },
  {
    id: 'incoterms',
    name: 'Incoterms 2020',
    title: 'Comparateur Incoterms 2020 : transfert des coûts et des risques | Atelier Logistique',
    description: 'Comparez visuellement les 11 Incoterms 2020 (EXW, FCA, FOB, CIF, DAP, DDP…) : qui paie quoi et où se transfère le risque sur la chaîne logistique.',
    h1: 'Comparateur Incoterms 2020',
    intro: 'Comparateur visuel des 11 Incoterms : transferts des coûts et des risques sur la chaîne logistique.',
    features: ['Les 11 règles Incoterms 2020.', 'Transfert des coûts et des risques étape par étape.', 'Comparaison côte à côte.'],
    related: ['cmr', 'optimiseur-chargement'],
    articles: ['incoterms-2020'],
  },
  {
    id: 'cmr',
    name: 'CMR / eCMR',
    title: 'Lettre de voiture CMR / eCMR en ligne : modèle à remplir | Atelier Logistique',
    description: 'Remplissez votre lettre de voiture internationale CMR aux normes de la convention de Genève, en version papier ou électronique (eCMR), et exportez-la en PDF.',
    h1: 'Lettre de voiture CMR / eCMR',
    intro: 'Lettre de voiture internationale aux normes européennes, mode papier ou électronique.',
    features: ['Cases de la convention CMR.', 'Mode papier ou eCMR.', 'Export PDF.'],
    related: ['incoterms', 'optimiseur-chargement'],
    articles: [],
  },
  {
    id: 'sla',
    name: 'OTIF / SLA',
    title: 'Calcul OTIF en ligne : taux On Time In Full et SLA | Atelier Logistique',
    description: 'Calculez votre taux OTIF (On Time In Full), analysez les écarts au SLA et décomposez la performance de livraison par client et par article.',
    h1: 'OTIF / SLA',
    intro: 'Taux On-Time In-Full, analyse des écarts au SLA, décomposition par client et article.',
    features: ['Taux OTIF, à l’heure et complet.', 'Écarts au niveau de service contractuel.', 'Analyse par client et par article.'],
    related: ['audit', 'safety'],
    articles: ['audit-supply-chain'],
  },
  {
    id: 'units',
    name: 'Convertisseur logistique',
    title: 'Convertisseur logistique : cartons par palette, palettes par camion | Atelier Logistique',
    description: 'Cascade carton → palette → conteneur → camion : combien d’unités tiennent dans chaque contenant. Gratuit, dans votre navigateur.',
    h1: 'Convertisseur logistique',
    intro: 'Cascade carton → palette → conteneur → camion : combien d’unités tiennent dans chaque contenant.',
    features: ['Cartons par palette.', 'Palettes par conteneur et par camion.', 'Unités par contenant.'],
    related: ['pallet', 'optimiseur-chargement'],
    articles: ['plan-de-chargement-camion'],
  },
];

/** Guides statiques (public/ressources/*.html) : pour les liens et le sitemap. */
export const ARTICLE_PAGES = [
  { slug: 'audit-supply-chain', title: 'Audit Supply Chain gratuit : diagnostic en 5 minutes' },
  { slug: 'plan-de-chargement-camion', title: 'Plan de chargement camion : méthode et tournées multi-arrêts' },
  { slug: 'repartition-des-charges-camion', title: 'Répartition des charges d’un camion : charge à l’essieu et calcul' },
  { slug: 'arrimage-des-charges', title: 'Arrimage des charges : combien de sangles et qui est responsable' },
  { slug: 'ddmrp', title: 'DDMRP : méthode complète et calcul des buffers' },
  { slug: 'incoterms-2020', title: 'Incoterms 2020 : les 11 règles expliquées' },
  { slug: 'ia-et-ddmrp', title: 'IA et DDMRP : deux réponses à la volatilité' },
];

export const HOME_PAGE = {
  path: '/',
  title: 'Atelier Logistique : optimiseur de chargement et palettisation 3D gratuits',
  description: 'Plan de chargement 3D camion et conteneur, palettisation 3D, mètres plancher : outils logistiques gratuits, sans compte. Et aussi codes-barres GS1, ZPL, stock de sécurité, DDMRP, CMR.',
  h1: 'La boîte à outils des pros de la supply chain',
  intro: 'Des outils web gratuits, sans installation ni compte : vos données restent dans votre navigateur.',
};

/** Page « Tous les outils » : cible du lien Outils (menu, fil d'Ariane) et des liens annexes Google. */
export const ALL_TOOLS_PAGE = {
  path: '/outils',
  title: 'Tous les outils logistiques gratuits | Atelier Logistique',
  description: 'Les outils gratuits d’Atelier Logistique : optimiseur de chargement 3D, palettisation 3D, codes-barres GS1, étiquettes ZPL, stock de sécurité, DDMRP, Incoterms, CMR, OTIF.',
  h1: 'Tous les outils',
  intro: 'Des outils web gratuits pour la logistique et le transport, sans installation ni compte.',
};

/** Outils mis en avant (accueil, liens annexes Google). */
export const FEATURED_TOOLS = ['optimiseur-chargement', 'pallet'];

export const RESSOURCES_PAGE = {
  path: '/ressources',
  title: 'Ressources supply chain : guides et méthodes | Atelier Logistique',
  description: 'Guides pratiques : plan de chargement camion, arrimage des charges, DDMRP, Incoterms 2020, audit supply chain.',
  h1: 'Ressources',
  intro: 'Guides et méthodes pour la logistique et la supply chain.',
};

export const toolPath = (id) => `/outils/${id}`;
export const toolSeo = (id) => TOOL_PAGES.find((t) => t.id === id) ?? null;
