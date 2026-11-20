import type { PalletSpec } from './types';

// Supports courants. Tares indicatives (bois sec) ; hauteur totale et charge
// par défaut = valeurs usuelles en transport routier, modifiables dans l'outil.
export const PALLET_PRESETS: PalletSpec[] = [
  { id: 'eur', label: 'EUR / EPAL 120×80', length: 1200, width: 800, deckHeight: 144, tare: 25, maxTotalHeight: 1800, maxLoad: 1000 },
  { id: 'eur3', label: 'EUR3 / ISO 120×100', length: 1200, width: 1000, deckHeight: 144, tare: 30, maxTotalHeight: 1800, maxLoad: 1000 },
  { id: 'half', label: 'Demi-palette 80×60', length: 800, width: 600, deckHeight: 144, tare: 10, maxTotalHeight: 1200, maxLoad: 500 },
  { id: 'gma', label: 'US GMA 48×40 in', length: 1219, width: 1016, deckHeight: 140, tare: 23, maxTotalHeight: 1800, maxLoad: 1000 },
  { id: 'asia', label: 'Asie 110×110', length: 1100, width: 1100, deckHeight: 144, tare: 25, maxTotalHeight: 1800, maxLoad: 1000 },
];

export const DEFAULT_PALLET = PALLET_PRESETS[0];
