// Modèles métier du moteur d'optimisation de chargement 3D.
// Unités internes : millimètres pour les dimensions, kilogrammes pour les poids.
// Repère : X = longueur du contenant, Y = largeur, Z = hauteur.
// Origine (0,0,0) = angle inférieur avant gauche du contenant.

export type RotationMode = 'NONE' | 'HORIZONTAL' | 'FULL';

export interface Dimensions {
  length: number; // X (mm)
  width: number;  // Y (mm)
  height: number; // Z (mm)
}

/** Définition d'une référence saisie par l'utilisateur (indépendante du formulaire UI). */
export interface ItemDefinition {
  id: string;         // identifiant interne unique, indépendant du libellé
  reference: string;  // libellé utilisateur
  quantity: number;
  length: number;     // mm
  width: number;      // mm
  height: number;     // mm
  weight: number;     // kg
  rotationMode: RotationMode;
  stackable: boolean;
  /** Ordre de livraison (1 = livré en premier). Absent = 1 (mono-destination). */
  stop?: number;
  /** Libellé facultatif de la destination (client, ville…). */
  destination?: string;
  // Réservé V2 : fragile, maxStackWeight, mustStayUpright, group, etc.
}

/** Une unité physique à placer (une par quantité). */
export interface ItemInstance {
  id: string;
  definitionId: string;
  reference: string;
  dimensions: Dimensions;
  weight: number;
  rotationMode: RotationMode;
  stackable: boolean;
  stop: number;
  destination: string;
}

/** Boîte alignée sur les axes, utilisée pour la géométrie (collision, support). */
export interface Box {
  x: number;
  y: number;
  z: number;
  length: number;
  width: number;
  height: number;
}

/** Une unité effectivement placée dans le contenant. */
export interface PlacedItem {
  id: string;
  definitionId: string;
  reference: string;

  x: number;
  y: number;
  z: number;

  length: number; // dimensions après rotation
  width: number;
  height: number;

  originalLength: number; // dimensions d'origine (avant rotation)
  originalWidth: number;
  originalHeight: number;

  rotation: { x: number; y: number; z: number }; // degrés, pour la visualisation

  weight: number;
  stackable: boolean;
  stop: number;
  destination: string;
}

/** Contenant cible (camion ou conteneur). */
export interface ContainerDefinition {
  id: string;
  label: string;
  length: number;          // mm
  width: number;           // mm
  height: number;          // mm
  maxWeight: number | null; // kg, null = non contraint
}

export interface OptimizationResult {
  placedItems: PlacedItem[];
  unpackedItems: ItemInstance[];

  totalItems: number;
  packedItems: number;
  unpackedCount: number;

  usedVolume: number;        // mm³
  containerVolume: number;   // mm³
  volumeUtilization: number; // 0..1

  usedWeight: number;        // kg
  maxWeight: number | null;  // kg
  weightUtilization: number | null; // 0..1

  computationTimeMs: number;

  /** Synthèse par arrêt de livraison (un seul élément en mono-destination). */
  stops: DeliveryStopSummary[];
  /** Colis placés dont l'accès est bloqué par un arrêt ultérieur (mode souple). */
  blockedItemIds: string[];
  deliveryMode: DeliveryMode;
}

/**
 * STRICT : chaque arrêt est accessible sans manipuler un colis d'un arrêt
 * ultérieur ; ce qui ne peut pas respecter la règle reste non chargé.
 * SOUPLE : la règle devient une pénalité ; les colis bloqués sont signalés.
 */
export type DeliveryMode = 'STRICT' | 'SOFT';

export interface DeliveryStopSummary {
  stop: number;
  destination: string;
  totalItems: number;
  packedItems: number;
  unpackedItems: number;
  packedWeight: number;  // kg
  packedVolume: number;  // mm³
}

export interface OptimizeOptions {
  iterations?: number;
  seed?: number;
  deliveryMode?: DeliveryMode;
}
