// Palettes → colis à charger (schéma « atelier-logistique/colis », valeurs canoniques mm / kg).
// C'est ce contrat qui relie la palettisation à l'optimiseur de chargement ; il servira
// tel quel pour un envoi vers un TMS / WMS (niveaux 2 et 3).

import type { CanonicalRecord } from '../../../shared/import';
import type { PalletPlan, PalletSpec } from './types';

/**
 * Gerbage des palettes dans le camion.
 * AUTO : une palette reçoit une autre palette si tous ses colis acceptent une charge ;
 * une palette lourde reste au sol (on ne gerbe pas une palette lourde en hauteur).
 */
export type PalletStacking = 'AUTO' | 'FREE' | 'TOP_ONLY' | 'FLOOR_NO_TOP';

/** Au-delà de ce poids total (kg), une palette n'est jamais posée sur une autre en mode AUTO. */
export const HEAVY_PALLET_KG = 500;

const STACKING_LABEL = {
  FREE: 'Libre',
  TOP_ONLY: 'Dessus uniquement',
  FLOOR: 'Au sol',
  FLOOR_NO_TOP: 'Au sol, rien dessus',
} as const;

export function palletStackingLabel(p: PalletPlan, policy: PalletStacking): string {
  if (policy !== 'AUTO') return STACKING_LABEL[policy];
  const heavy = p.totalWeight > HEAVY_PALLET_KG;
  if (p.stackable) return heavy ? STACKING_LABEL.FLOOR : STACKING_LABEL.FREE;
  return heavy ? STACKING_LABEL.FLOOR_NO_TOP : STACKING_LABEL.TOP_ONLY;
}

/** Libellé lisible d'une palette : « PAL CARTON-A ×40 » ou « PAL mixte (3 réf.) ». */
export function palletLabel(p: PalletPlan): string {
  if (p.contents.length === 1) return `PAL ${p.contents[0].reference} ×${p.contents[0].quantity}`;
  return `PAL mixte (${p.contents.length} réf.)`;
}

/**
 * Une ligne par type de palette (mêmes contenu, hauteur, poids et arrêt) :
 * quantité = nombre de palettes, identifiants PAL-xxx conservés (unités).
 */
export function palletsToLoadRecords(
  pallets: PalletPlan[], specs: PalletSpec | readonly PalletSpec[], stacking: PalletStacking = 'AUTO',
): CanonicalRecord[] {
  const list = Array.isArray(specs) ? specs : [specs as PalletSpec];
  const specOf = (p: PalletPlan) => list.find((s) => s.id === p.specId) ?? list[0];
  const map = new Map<string, CanonicalRecord>();
  for (const p of pallets) {
    const spec = specOf(p);
    const sig = [
      p.specId,
      p.contents.map((c) => `${c.definitionId}:${c.quantity}`).join(','),
      Math.round(p.totalHeight), Math.round(p.totalWeight), p.stop, p.destination,
      palletStackingLabel(p, stacking),
    ].join('|');
    const prev = map.get(sig);
    if (prev) {
      prev.quantity = (prev.quantity as number) + 1;
      (prev.__units as string[]).push(p.id);
      continue;
    }
    map.set(sig, {
      // Plusieurs formats possibles : le format figure dans le libellé (« … · 120×100 »).
      reference: list.length > 1 ? `${palletLabel(p)} · ${spec.length / 10}×${spec.width / 10}` : palletLabel(p),
      quantity: 1,
      length: spec.length,
      width: spec.width,
      height: Math.round(p.totalHeight),
      weight: Math.round(p.totalWeight * 10) / 10,
      rotation: 'Horizontale',
      stacking: palletStackingLabel(p, stacking),
      stop: String(p.stop),
      destination: p.destination,
      __units: [p.id],
    });
  }
  return [...map.values()];
}
