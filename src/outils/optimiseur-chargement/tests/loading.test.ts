import { describe, it, expect } from 'vitest';
import { optimize, optimizeWithInsights } from '../engine/optimizer';
import { findLoadingViolations, isInFront, heightCap, resolveLoading } from '../engine/loading';
import { boxesIntersect } from '../engine/collision';
import type { ContainerDefinition, ItemDefinition, LoadingOptions, PlacedItem } from '../engine/types';

const container = (length: number, width: number, height: number, maxWeight: number | null = null): ContainerDefinition =>
  ({ id: 'c', label: 'c', length, width, height, maxWeight });

const item = (over: Partial<ItemDefinition>): ItemDefinition => ({
  id: 'i', reference: 'R', quantity: 1,
  length: 100, width: 100, height: 100, weight: 1,
  rotationMode: 'FULL', stackable: true,
  ...over,
});

const RULES: LoadingOptions = {
  mode: 'WALLS', wallDepth: null,
  manualMaxHeight: 1800, heavyMaxHeight: 1500, heavyThresholdKg: 15, mechanizedAboveKg: 25,
};

const semi = container(13600, 2450, 2700, 24000);
const mixed = [
  item({ id: 'a', reference: 'A', quantity: 120, length: 600, width: 400, height: 400, weight: 12 }),
  item({ id: 'b', reference: 'B', quantity: 60, length: 800, width: 600, height: 500, weight: 18 }),
  item({ id: 'p', reference: 'P', quantity: 8, length: 1200, width: 800, height: 1400, weight: 450, rotationMode: 'HORIZONTAL', stackable: false }),
];

function assertNoOverlap(placed: PlacedItem[]) {
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      expect(boxesIntersect(placed[i], placed[j])).toBe(false);
    }
  }
}

describe('Règle de chargeabilité', () => {
  it('un colis déjà chargé devant (côté portes) sur la même section gêne', () => {
    const box = { x: 0, y: 0, z: 0, length: 100, width: 100, height: 100 };
    expect(isInFront({ x: 100, y: 0, z: 0, length: 100, width: 100, height: 100 }, box)).toBe(true);
    expect(isInFront({ x: 100, y: 0, z: 100, length: 100, width: 100, height: 100 }, box)).toBe(false);
    expect(isInFront({ x: 0, y: 100, z: 0, length: 100, width: 100, height: 100 }, box)).toBe(false);
  });

  it('détecte une séquence où il faut passer par-dessus', () => {
    const mk = (id: string, x: number, sequence: number): PlacedItem => ({
      id, definitionId: 'd', reference: 'R', x, y: 0, z: 0, length: 100, width: 100, height: 100,
      originalLength: 100, originalWidth: 100, originalHeight: 100, rotation: { x: 0, y: 0, z: 0 },
      weight: 1, stackable: true, stop: 1, destination: '', sequence, wall: 0,
    });
    expect(findLoadingViolations([mk('front', 100, 1), mk('back', 0, 2)])).toEqual(['back']);
    expect(findLoadingViolations([mk('back', 0, 1), mk('front', 100, 2)])).toEqual([]);
  });
});

describe('Hauteurs de manutention', () => {
  const cfg = resolveLoading(RULES, []);
  it('plafonne les colis manuels, plus bas pour les lourds, pas pour les colis à l\'engin', () => {
    expect(heightCap({ weight: 10 }, cfg, semi)).toBe(1800);
    expect(heightCap({ weight: 20 }, cfg, semi)).toBe(1500);
    expect(heightCap({ weight: 450 }, cfg, semi)).toBe(2700);
  });

  it('aucun colis manuel ne dépasse sa hauteur maxi', () => {
    const r = optimize(semi, mixed, { loading: RULES });
    for (const p of r.placedItems) {
      const top = p.z + p.height;
      if (p.weight > 25) continue;
      expect(top).toBeLessThanOrEqual(p.weight > 15 ? 1500 : 1800);
    }
  });
});

describe('Chargement par murs', () => {
  const r = optimize(semi, mixed, { loading: { mode: 'WALLS' } });

  it('aucun colis à poser par-dessus un autre, aucun chevauchement', () => {
    expect(r.loadingMode).toBe('WALLS');
    expect(r.loadingViolationIds).toHaveLength(0);
    assertNoOverlap(r.placedItems);
  });

  it('séquence 1..n et murs numérotés de la cabine vers les portes', () => {
    const seq = r.placedItems.map((p) => p.sequence).sort((a, b) => a - b);
    expect(seq).toEqual(seq.map((_, i) => i + 1));
    const walls = r.walls.map((w) => w.wall);
    expect(walls).toEqual([...walls].sort((a, b) => a - b));
    for (let i = 1; i < r.walls.length; i++) expect(r.walls[i].xEnd).toBeGreaterThanOrEqual(r.walls[i - 1].xEnd);
    // la séquence ne revient jamais vers un mur précédent
    const bySeq = [...r.placedItems].sort((a, b) => a.sequence - b.sequence);
    for (let i = 1; i < bySeq.length; i++) expect(bySeq[i].wall).toBeGreaterThanOrEqual(bySeq[i - 1].wall);
  });

  it('profondeur de mur fixe respectée', () => {
    const d = 1200;
    const rr = optimize(semi, [item({ id: 'a', quantity: 200, length: 600, width: 400, height: 400 })], { loading: { mode: 'WALLS', wallDepth: d } });
    for (const p of rr.placedItems) expect(p.x + p.length).toBeLessThanOrEqual(p.wall * d + 1e-6);
  });

  it('compatible tournée : ni colis bloqué à la livraison, ni colis inaccessible au chargement', () => {
    const defs = [
      item({ id: 's1', quantity: 80, length: 600, width: 400, height: 400, weight: 10, stop: 1 }),
      item({ id: 's2', quantity: 80, length: 600, width: 400, height: 400, weight: 10, stop: 2 }),
      item({ id: 's3', quantity: 6, length: 1200, width: 800, height: 1200, weight: 300, stop: 3, stackable: false }),
    ];
    const t = optimize(semi, defs, { loading: RULES });
    expect(t.loadingViolationIds).toHaveLength(0);
    expect(t.blockedItemIds).toHaveLength(0);
  });
});

describe('Compatibilité et indicateurs', () => {
  it('sans options : chargement libre historique, sans murs', () => {
    const r = optimize(container(6000, 2400, 2400), [item({ quantity: 20, length: 600, width: 400, height: 400 })]);
    expect(r.loadingMode).toBe('FREE');
    expect(r.walls).toHaveLength(0);
  });

  it('chiffre le coût de la limite de hauteur quand tout ne rentre pas', () => {
    const defs = [item({ id: 'a', quantity: 400, length: 600, width: 400, height: 400, weight: 8 })];
    const r = optimizeWithInsights(container(6000, 2400, 2400), defs, { loading: RULES });
    expect(r.unpackedCount).toBeGreaterThan(0);
    expect(r.heightLimitCost).not.toBeNull();
    expect(r.heightLimitCost!.packedItems).toBeGreaterThan(r.packedItems);
  });

  it('pas de coût affiché si tout rentre', () => {
    const r = optimizeWithInsights(semi, [item({ quantity: 10, length: 600, width: 400, height: 400 })], { loading: RULES });
    expect(r.heightLimitCost).toBeNull();
  });
});

describe('Empilage : colis au sol', () => {
  it('un colis « au sol » n\'est jamais posé sur un autre', () => {
    const defs = [
      item({ id: 'f', quantity: 60, length: 600, width: 400, height: 400, floorOnly: true }),
      item({ id: 'c', quantity: 60, length: 600, width: 400, height: 400 }),
    ];
    const r = optimize(container(3000, 2400, 2400), defs, { loading: { mode: 'WALLS' } });
    for (const p of r.placedItems.filter((x) => x.definitionId === 'f')) expect(p.z).toBe(0);
    expect(r.placedItems.some((p) => p.definitionId === 'c' && p.z > 0)).toBe(true);
  });

  it('« dessus uniquement » : peut monter sur un autre, mais rien dessus', () => {
    const defs = [
      item({ id: 'base', quantity: 4, length: 1200, width: 800, height: 500, floorOnly: true, rotationMode: 'NONE' }),
      item({ id: 'top', quantity: 4, length: 1200, width: 800, height: 500, stackable: false, rotationMode: 'NONE' }),
    ];
    const r = optimize(container(2400, 1600, 2000), defs, { loading: { mode: 'WALLS' } });
    expect(r.unpackedCount).toBe(0);
    const tops = r.placedItems.filter((p) => p.definitionId === 'top');
    expect(tops.every((p) => p.z === 500)).toBe(true);
  });
});
