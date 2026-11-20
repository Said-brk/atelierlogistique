import { describe, expect, it } from 'vitest';
import { bestLayerPattern } from '../engine/layerPattern';
import { bestFullPallet, palletize } from '../engine/palletize';
import { palletsToLoadRecords } from '../engine/toLoad';
import { DEFAULT_PALLET } from '../engine/presets';
import type { ItemDefinition } from '../engine/types';
import { recordsToColisRows } from '../../optimiseur-chargement/import/colisSchema';

const carton = (o: Partial<ItemDefinition> = {}): ItemDefinition => ({
  id: 'a', reference: 'CARTON-A', quantity: 1, length: 400, width: 300, height: 250, weight: 8,
  rotationMode: 'HORIZONTAL', stackable: true, ...o,
});

const overlap = (a: { x: number; y: number; z: number; length: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.length - 1e-6 && b.x < a.x + a.length - 1e-6 &&
  a.y < b.y + b.width - 1e-6 && b.y < a.y + a.width - 1e-6 &&
  a.z < b.z + b.height - 1e-6 && b.z < a.z + a.height - 1e-6;

describe('plan de couche', () => {
  it('400×300 sur EUR : 8 par couche', () => {
    expect(bestLayerPattern(1200, 800, 400, 300).count).toBe(8);
  });
  it('motif croisé meilleur que le bloc (500×300 sur 1200×800 → 6)', () => {
    expect(bestLayerPattern(1200, 800, 500, 300).count).toBeGreaterThanOrEqual(6);
  });
});

describe('palettisation', () => {
  it('palette complète : couches limitées par la hauteur (1800 - 144 → 6 couches de 250)', () => {
    const plan = bestFullPallet(carton(), DEFAULT_PALLET)!;
    expect(plan.layers).toBe(6);
    expect(plan.capacity).toBe(48);
  });

  it('colis non gerbable : une seule couche', () => {
    expect(bestFullPallet(carton({ stackable: false }), DEFAULT_PALLET)!.layers).toBe(1);
  });

  it('charge maxi limite le nombre de couches', () => {
    const plan = bestFullPallet(carton({ weight: 40 }), DEFAULT_PALLET)!; // 8×40 = 320 kg / couche
    expect(plan.layers).toBe(3);
  });

  it('100 colis → 2 palettes complètes + 1 mixte avec le reliquat, sans chevauchement', () => {
    const r = palletize([carton({ quantity: 100 })], DEFAULT_PALLET);
    expect(r.pallets.map((p) => p.kind)).toEqual(['FULL', 'FULL', 'MIXED']);
    expect(r.palletizedItems).toBe(100);
    expect(r.unplaced).toHaveLength(0);
    for (const p of r.pallets) {
      expect(p.totalHeight).toBeLessThanOrEqual(DEFAULT_PALLET.maxTotalHeight);
      for (let i = 0; i < p.placed.length; i++) for (let j = i + 1; j < p.placed.length; j++) {
        expect(overlap(p.placed[i], p.placed[j])).toBe(false);
      }
      for (const it of p.placed) {
        expect(it.x).toBeGreaterThanOrEqual(-1e-6);
        expect(it.x + it.length).toBeLessThanOrEqual(1200 + 1e-6);
      }
    }
    expect(r.pallets[0].totalWeight).toBe(48 * 8 + 25);
  });

  it('ne mélange pas deux arrêts', () => {
    const r = palletize([
      carton({ id: 'a', quantity: 5, stop: 1, destination: 'Nanterre' }),
      carton({ id: 'b', reference: 'B', quantity: 5, stop: 2, destination: 'Massy' }),
    ], DEFAULT_PALLET);
    expect(r.pallets).toHaveLength(2);
    expect(r.pallets.map((p) => p.destination)).toEqual(['Nanterre', 'Massy']);
    const merged = palletize([
      carton({ id: 'a', quantity: 5, stop: 1 }), carton({ id: 'b', reference: 'B', quantity: 5, stop: 2 }),
    ], DEFAULT_PALLET, { separateStops: false });
    expect(merged.pallets).toHaveLength(1);
  });

  it('signale ce qui ne tient pas', () => {
    const r = palletize([carton({ length: 1500, width: 1300, rotationMode: 'NONE' })], DEFAULT_PALLET);
    expect(r.unplaced[0].reason).toMatch(/grand/);
  });
});

describe('vers l’optimiseur de chargement', () => {
  it('palettes identiques regroupées, dimensions et gerbage repris', () => {
    const r = palletize([carton({ quantity: 100, stop: 2, destination: 'Massy' })], DEFAULT_PALLET);
    const rows = recordsToColisRows(palletsToLoadRecords(r.pallets, DEFAULT_PALLET));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ reference: 'PAL CARTON-A ×48', quantity: 2, length: 120, width: 80, height: 164.4, weight: 409, rotationMode: 'HORIZONTAL', stackable: true, floorOnly: false, stop: 2, destination: 'Massy' });
    expect(rows[0].unitIds).toEqual(['PAL-001', 'PAL-002']);
    const fragile = palletize([carton({ quantity: 10, stackable: false })], DEFAULT_PALLET);
    expect(recordsToColisRows(palletsToLoadRecords(fragile.pallets, DEFAULT_PALLET))[0].stackable).toBe(false);
    // Palette lourde : reste au sol.
    const heavy = palletize([carton({ quantity: 48, weight: 15 })], DEFAULT_PALLET); // 48×15 + 25 = 745 kg
    expect(recordsToColisRows(palletsToLoadRecords(heavy.pallets, DEFAULT_PALLET))[0]).toMatchObject({ stackable: true, floorOnly: true });
  });
});

import { palletizeMulti } from '../engine/palletize';
import { PALLET_PRESETS } from '../engine/presets';

describe('plusieurs supports', () => {
  const EUR = PALLET_PRESETS.find((p) => p.id === 'eur')!;
  const EUR3 = PALLET_PRESETS.find((p) => p.id === 'eur3')!;

  it('choisit le support qui donne le moins de palettes et l’explique', () => {
    // 500×500 : 2 par couche sur EUR (1200×800), 4 sur EUR3 (1200×1000).
    const defs = [carton({ length: 500, width: 500, height: 300, weight: 5, quantity: 80 })];
    const r = palletizeMulti(defs, [EUR, EUR3]);
    expect(new Set(r.pallets.map((p) => p.specId))).toEqual(new Set(['eur3']));
    expect(r.choices[0].reason).toMatch(/EUR3.*au lieu de/);
    const onlyEur = palletizeMulti(defs, [EUR]);
    expect(r.pallets.length).toBeLessThan(onlyEur.pallets.length);
  });

  it('à nombre égal de palettes, préfère la plus petite emprise au sol', () => {
    const r = palletizeMulti([carton({ quantity: 10 })], [EUR3, EUR]);
    expect(r.pallets[0].specId).toBe('eur');
    expect(r.choices[0].reason).toMatch(/m²/);
  });

  it('un format par arrêt par défaut, support imposé respecté', () => {
    const defs = [
      carton({ id: 'a', quantity: 60, stop: 1 }),
      carton({ id: 'b', reference: 'B', length: 500, width: 500, quantity: 40, stop: 1 }),
      carton({ id: 'c', reference: 'C', quantity: 20, stop: 2 }),
    ];
    const r = palletizeMulti(defs, [EUR, EUR3]);
    for (const stop of [1, 2]) expect(new Set(r.pallets.filter((p) => p.stop === stop).map((p) => p.specId)).size).toBe(1);
    const forced = palletizeMulti(defs, [EUR, EUR3], { forcedByStop: { 2: 'eur3' }, forcedByDefinition: { a: 'eur' } });
    expect(forced.pallets.filter((p) => p.stop === 2).every((p) => p.specId === 'eur3')).toBe(true);
    expect(forced.pallets.filter((p) => p.contents.some((c) => c.definitionId === 'a')).every((p) => p.specId === 'eur')).toBe(true);
    expect(forced.palletizedItems).toBe(120);
  });

  it('mélange autorisé : chaque référence sur son support le plus dense', () => {
    const defs = [carton({ id: 'a', quantity: 96 }), carton({ id: 'b', reference: 'B', length: 500, width: 500, height: 300, quantity: 48 })];
    const r = palletizeMulti(defs, [EUR, EUR3], { oneFormatPerStop: false });
    expect(r.pallets.filter((p) => p.kind === 'FULL' && p.contents[0].definitionId === 'b').map((p) => p.specId)).toEqual(['eur3', 'eur3']);
    expect(r.palletizedItems).toBe(144);
  });

  it('vers le camion : dimensions du support de chaque palette', () => {
    const r = palletizeMulti([carton({ length: 500, width: 500, quantity: 40 })], [EUR, EUR3]);
    const rows = recordsToColisRows(palletsToLoadRecords(r.pallets, [EUR, EUR3]));
    expect(rows[0]).toMatchObject({ length: 120, width: 100 });
    expect(rows[0].reference).toMatch(/120×100/);
  });
});

describe('un format pour tout l’envoi', () => {
  it('impose le même support à tous les arrêts', () => {
    const EUR = PALLET_PRESETS.find((p) => p.id === 'eur')!;
    const EUR3 = PALLET_PRESETS.find((p) => p.id === 'eur3')!;
    const defs = [
      carton({ id: 'a', length: 500, width: 500, height: 300, weight: 5, quantity: 80, stop: 1 }),
      carton({ id: 'b', reference: 'B', quantity: 10, stop: 2 }),
    ];
    const perStop = palletizeMulti(defs, [EUR, EUR3]);
    expect(new Set(perStop.pallets.map((p) => p.specId)).size).toBe(2);
    const shipment = palletizeMulti(defs, [EUR, EUR3], { oneFormatPerShipment: true });
    expect(new Set(shipment.pallets.map((p) => p.specId)).size).toBe(1);
    expect(shipment.choices[0].reason).toMatch(/tout l'envoi/);
  });
});
