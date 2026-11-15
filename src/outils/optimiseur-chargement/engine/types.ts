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
  // Réservé V2 : fragile, maxStackWeight, mustStayUpright, priority, group, etc.
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
}

export interface OptimizeOptions {
  iterations?: number;
  seed?: number;
}
