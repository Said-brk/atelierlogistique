// Mètres plancher (MPL / LDM) et poids taxable, tels que les transporteurs routiers les calculent.
//
//  • Mètres plancher = surface au sol de la marchandise ÷ 2,4 m (largeur de référence d'une remorque) :
//    1 palette Europe 120 × 80 = 0,4 MPL. Seuls les colis posés au sol comptent : un colis gerbé ne prend
//    pas de plancher en plus.
//  • Longueur de plancher occupée = profondeur atteinte par le chargement depuis la face avant : ce qu'on
//    réserve pour un lot partiel (« 6,4 m de plancher »).
//  • Poids taxable = le plus élevé de : poids réel, volume × kg/m³, mètres plancher × kg/MPL. Facteurs
//    courants en routier : 330 kg/m³ et 1 750 kg/MPL (ils varient d'un transporteur à l'autre).

import type { ContainerDefinition, PlacedItem } from './types';

export const REFERENCE_WIDTH_MM = 2400;
export const DEFAULT_TAXABLE = { kgPerM3: 330, kgPerLdm: 1750 };
export type TaxableFactors = typeof DEFAULT_TAXABLE;

const FLOOR_TOLERANCE_MM = 5;

export interface FloorMeters {
  /** Surface au sol de la marchandise (m²). */
  floorArea: number;
  /** Mètres plancher facturables (surface au sol ÷ 2,4 m). */
  ldm: number;
  /** Longueur de plancher occupée depuis la face avant (m). */
  occupiedLength: number;
  /** Longueur de plancher du contenant (m) : 13,6 pour une semi standard. */
  containerLength: number;
  /** Colis posés au sol / gerbés. */
  floorItems: number;
  stackedItems: number;
}

export function floorMeters(placed: PlacedItem[], container: ContainerDefinition): FloorMeters {
  let area = 0; let occupied = 0; let floorItems = 0;
  for (const p of placed) {
    occupied = Math.max(occupied, p.x + p.length);
    if (p.z <= FLOOR_TOLERANCE_MM) { area += p.length * p.width; floorItems++; }
  }
  const floorArea = area / 1e6;
  return {
    floorArea,
    ldm: floorArea / (REFERENCE_WIDTH_MM / 1000),
    occupiedLength: occupied / 1000,
    containerLength: container.length / 1000,
    floorItems,
    stackedItems: placed.length - floorItems,
  };
}

export type TaxableBasis = 'real' | 'volume' | 'floor';
export interface TaxableWeight { real: number; volumetric: number; floor: number; taxable: number; basis: TaxableBasis }

/** Poids taxable : le plus élevé des trois poids (à égalité, le poids réel l'emporte). */
export function taxableWeight(
  { weightKg, volumeM3, ldm }: { weightKg: number; volumeM3: number; ldm: number },
  factors: TaxableFactors = DEFAULT_TAXABLE,
): TaxableWeight {
  const real = Math.max(0, weightKg);
  const volumetric = Math.max(0, volumeM3) * factors.kgPerM3;
  const floor = Math.max(0, ldm) * factors.kgPerLdm;
  const taxable = Math.max(real, volumetric, floor);
  const basis: TaxableBasis = taxable === real ? 'real' : taxable === floor ? 'floor' : 'volume';
  return { real, volumetric, floor, taxable, basis };
}

// ---------------------------------------------------------------- Faits de tarification (résumé du plan)
/** Surface au sol à partir de laquelle un colis est compté comme une palette (0,3 m² : demi-palette 80 × 60 incluse). */
export const PALLET_MIN_AREA_MM2 = 300_000;

/**
 * Volume (m³) et nombre de palettes des colis chargés (dimensions en mm ; quantity = nombre d'unités, 1 par défaut).
 * Palette = colis d'au moins 0,3 m² au sol (les cartons ne sont pas comptés comme des palettes).
 */
export function goodsFacts(items: { length: number; width: number; height: number; quantity?: number; floorOnly?: boolean }[]) {
  let volume = 0; let pallets = 0;
  for (const it of items) {
    const q = it.quantity ?? 1;
    volume += (it.length * it.width * it.height * q) / 1e9;
    if (it.length * it.width >= PALLET_MIN_AREA_MM2 || it.floorOnly) pallets += q;
  }
  return { volume: Math.round(volume * 1000) / 1000, pallets };
}

/** Véhicules utilisés, regroupés par code (forfait par véhicule). */
export function vehiclesOf(list: { id?: string; label: string }[]) {
  const m = new Map<string, { code: string; label: string; count: number }>();
  for (const c of list) { const k = c.id ?? c.label; const v = m.get(k) ?? { code: k, label: c.label, count: 0 }; v.count += 1; m.set(k, v); }
  return [...m.values()];
}
