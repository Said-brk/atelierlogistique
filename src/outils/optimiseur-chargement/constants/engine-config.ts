// Constantes de configuration du moteur. Aucune valeur métier magique
// ne doit être dispersée ailleurs dans le code : tout est centralisé ici.

/** Fraction minimale de la surface inférieure devant être supportée (objet non au sol). */
export const MIN_SUPPORT_RATIO = 0.8;

/** Nombre d'itérations / stratégies de tri essayées par défaut. */
export const DEFAULT_ITERATIONS = 20;

/** Tolérance géométrique (mm) pour les comparaisons de bords. */
export const EPS = 1e-6;

/**
 * Coefficients de la fonction de score d'un emplacement.
 * Un score plus BAS est meilleur (pénalités additionnées, bonus soustraits).
 * Ajustés empiriquement à l'étape moteur ; regroupés ici pour rester lisibles.
 */
export const SCORING = {
  floorPenalty: 1,          // privilégie les emplacements proches du sol (z faible)
  originDistancePenalty: 1, // privilégie la proximité de l'origine (x, y faibles)
  wastedSpacePenalty: 2,    // pénalise l'espace perdu créé sous/autour de l'objet
  contactBonus: 1.5,        // récompense le contact avec parois et autres objets
} as const;

/**
 * Livraisons multi-arrêts. En mode SOUPLE, chaque colis d'un arrêt ultérieur
 * qui bloquerait l'unité ajoute cette pénalité au score de l'emplacement
 * (à comparer aux autres coefficients, de l'ordre de 1).
 */
export const DELIVERY = {
  blockedPenalty: 10,
} as const;
