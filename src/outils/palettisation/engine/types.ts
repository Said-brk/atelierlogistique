// Modèles du moteur de palettisation. Unités : mm et kg (comme le moteur de chargement).

import type { ItemDefinition, PlacedItem } from '../../optimiseur-chargement/engine/types';

export type { ItemDefinition, PlacedItem };

export interface PalletSpec {
  id: string;
  label: string;
  length: number;        // mm
  width: number;         // mm
  deckHeight: number;    // mm, hauteur du support vide
  tare: number;          // kg, poids du support vide
  /** Hauteur totale maximale (support + charge), mm. */
  maxTotalHeight: number;
  /** Charge maximale (hors tare), kg. */
  maxLoad: number;
  /** Coût unitaire facultatif (€) : départage deux supports équivalents. */
  cost?: number;
}

export interface PalletizeOptions {
  /** Palettes complètes mono-référence d'abord, reliquats en palettes mixtes (défaut : oui). */
  fullPalletsFirst?: boolean;
  /** Ne jamais mélanger deux arrêts / destinations sur une palette (défaut : oui). */
  separateStops?: boolean;
  /** Autoriser les palettes mixtes (sinon les reliquats restent non palettisés). */
  allowMixed?: boolean;
  /**
   * Un seul format de support par arrêt (défaut : oui). Mélanger EUR (80 cm) et EUR3 (100 cm)
   * dans un camion casse l'alignement des rangées et fait perdre de la place.
   */
  oneFormatPerStop?: boolean;
  /**
   * Un seul format pour tout l'envoi (tous arrêts) : à privilégier quand toutes les palettes
   * partent dans le même camion. Prioritaire sur oneFormatPerStop.
   */
  oneFormatPerShipment?: boolean;
  /** Support imposé par ligne (definitionId → id du support). Prioritaire sur l'arrêt. */
  forcedByDefinition?: Record<string, string>;
  /** Support imposé par arrêt (n° d'arrêt → id du support), ex. exigence du client. */
  forcedByStop?: Record<number, string>;
}

/** Choix de support pour un groupe (un arrêt) et sa justification. */
export interface SupportChoice {
  stop: number;
  destination: string;
  specIds: string[];
  reason: string;
}

export type PalletKind = 'FULL' | 'MIXED';

export interface PalletContent { definitionId: string; reference: string; quantity: number; }

export interface PalletPlan {
  index: number;          // 1-based
  id: string;             // PAL-001
  /** Support utilisé (PalletSpec.id). */
  specId: string;
  kind: PalletKind;
  stop: number;
  destination: string;
  /** Colis posés sur le plateau ; z = 0 au-dessus du plateau. */
  placed: PlacedItem[];
  contents: PalletContent[];
  layers: number;         // nb de couches (palette complète), 0 sinon
  perLayer: number;       // colis par couche (palette complète), 0 sinon
  loadHeight: number;     // mm
  totalHeight: number;    // mm (support inclus)
  loadWeight: number;     // kg
  totalWeight: number;    // kg (tare incluse)
  volumeFill: number;     // 0..1, volume colis / volume utile jusqu'à la hauteur réelle
  areaFill: number;       // 0..1, emprise au sol / surface du plateau
  /** Tous les colis acceptent une charge : la palette peut être gerbée. */
  stackable: boolean;
  /** Dépassement de la hauteur ou du poids maxi (ne devrait pas arriver). */
  overLimit: boolean;
}

export interface UnplacedLine { definitionId: string; reference: string; quantity: number; reason: string; }

export interface PalletizeResult {
  pallets: PalletPlan[];
  /** Supports utilisables pendant le calcul (pour retrouver un PalletSpec par id). */
  specs: PalletSpec[];
  choices: SupportChoice[];
  unplaced: UnplacedLine[];
  totalItems: number;
  palletizedItems: number;
  computationTimeMs: number;
}
