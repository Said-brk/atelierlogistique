import { describe, it, expect } from 'vitest';
import { optimize, expandInstances } from '../engine/optimizer';
import { boxesIntersect, isWithinContainer } from '../engine/collision';
import { supportRatio } from '../engine/support';
import { MIN_SUPPORT_RATIO } from '../constants/engine-config';
import type { ContainerDefinition, ItemDefinition, PlacedItem, Box } from '../engine/types';

const container = (length: number, width: number, height: number, maxWeight: number | null = null): ContainerDefinition =>
  ({ id: 'c', label: 'c', length, width, height, maxWeight });

const item = (over: Partial<ItemDefinition>): ItemDefinition => ({
  id: 'i', reference: 'R', quantity: 1,
  length: 100, width: 100, height: 100, weight: 1,
  rotationMode: 'FULL', stackable: true,
  ...over,
});

const toBox = (p: PlacedItem): Box => ({ x: p.x, y: p.y, z: p.z, length: p.length, width: p.width, height: p.height });

// Invariants structurels valables pour TOUT résultat.
function assertSoundResult(result: ReturnType<typeof optimize>, cont: ContainerDefinition) {
  // aucun chevauchement, tout dans le contenant, rien ne flotte
  for (let i = 0; i < result.placedItems.length; i++) {
    const a = result.placedItems[i];
    expect(isWithinContainer(toBox(a), cont)).toBe(true);
    if (a.z > 1e-6) {
      const others = result.placedItems.filter((_, j) => j !== i);
      expect(supportRatio(toBox(a), others)).toBeGreaterThanOrEqual(MIN_SUPPORT_RATIO - 1e-6);
    }
    for (let j = i + 1; j < result.placedItems.length; j++) {
      expect(boxesIntersect(toBox(a), toBox(result.placedItems[j]))).toBe(false);
    }
  }
  // conservation des quantités
  expect(result.packedItems + result.unpackedCount).toBe(result.totalItems);
}

describe('Scénario A — tout rentre largement', () => {
  it('10 cartons 600×400×400 dans 6000×2400×2400 → 10 placés', () => {
    const cont = container(6000, 2400, 2400);
    const result = optimize(cont, [item({ id: 'A', length: 600, width: 400, height: 400, quantity: 10 })]);
    expect(result.packedItems).toBe(10);
    expect(result.unpackedCount).toBe(0);
    assertSoundResult(result, cont);
  });
});

describe('Scénario B — deux gros cubes, un seul rentre', () => {
  it('2 cubes 600 dans 1000³ → 1 placé', () => {
    const cont = container(1000, 1000, 1000);
    const result = optimize(cont, [item({ id: 'B', length: 600, width: 600, height: 600, quantity: 2 })]);
    expect(result.packedItems).toBe(1);
    expect(result.unpackedCount).toBe(1);
    assertSoundResult(result, cont);
  });
});

describe('Scénario C — rotation horizontale nécessaire', () => {
  it('800×1200×1000 dans 1200×800×1000 avec rotation horizontale → placé', () => {
    const cont = container(1200, 800, 1000);
    const result = optimize(cont, [item({ id: 'C', length: 800, width: 1200, height: 1000, rotationMode: 'HORIZONTAL' })]);
    expect(result.packedItems).toBe(1);
    assertSoundResult(result, cont);
  });
});

describe('Scénario D — rotation interdite', () => {
  it('800×1200×1000 dans 1200×800×1000 sans rotation → non placé (pas de rotation cachée)', () => {
    const cont = container(1200, 800, 1000);
    const result = optimize(cont, [item({ id: 'D', length: 800, width: 1200, height: 1000, rotationMode: 'NONE' })]);
    expect(result.packedItems).toBe(0);
    expect(result.unpackedCount).toBe(1);
  });
});

describe('Contrainte de poids (§40)', () => {
  it('un véhicule limité à 1000 kg ne dépasse jamais 1000 kg', () => {
    const cont = container(5000, 2000, 2000, 1000);
    const result = optimize(cont, [item({ id: 'W', length: 300, width: 300, height: 300, weight: 600, quantity: 3 })]);
    expect(result.usedWeight).toBeLessThanOrEqual(1000);
    expect(result.packedItems).toBe(1); // 2×600 = 1200 > 1000
    assertSoundResult(result, cont);
  });
});

describe('Empilabilité (§40)', () => {
  it('aucune unité au-dessus d’une unité non empilable', () => {
    const cont = container(1000, 1000, 1000);
    const result = optimize(cont, [
      item({ id: 'base', length: 1000, width: 1000, height: 500, weight: 10, stackable: false, rotationMode: 'NONE' }),
      item({ id: 'top', length: 1000, width: 1000, height: 400, weight: 10, stackable: true, rotationMode: 'NONE' }),
    ]);
    const nonStackable = result.placedItems.filter((p) => !p.stackable);
    for (const p of result.placedItems) {
      if (p.z <= 1e-6) continue;
      for (const base of nonStackable) {
        const above = Math.abs(base.z + base.height - p.z) <= 1e-6;
        const overlaps = !(p.x + p.length <= base.x || base.x + base.length <= p.x
          || p.y + p.width <= base.y || base.y + base.width <= p.y);
        expect(above && overlaps).toBe(false);
      }
    }
    assertSoundResult(result, cont);
  });
});

describe('Conservation des quantités (§40)', () => {
  it('placed + unpacked = total pour 10 unités', () => {
    const cont = container(1500, 1000, 1000);
    const defs: ItemDefinition[] = [
      item({ id: 'x', length: 400, width: 400, height: 400, quantity: 6 }),
      item({ id: 'y', length: 300, width: 300, height: 300, quantity: 4 }),
    ];
    expect(expandInstances(defs)).toHaveLength(10);
    const result = optimize(cont, defs);
    expect(result.packedItems + result.unpackedCount).toBe(10);
    expect(result.totalItems).toBe(10);
    assertSoundResult(result, cont);
  });
});

describe('Déterminisme (§54)', () => {
  it('mêmes entrées → même nombre de placés et même volume', () => {
    const cont = container(2400, 1200, 1200);
    const defs = [item({ id: 'z', length: 400, width: 300, height: 300, quantity: 20 })];
    const a = optimize(cont, defs);
    const b = optimize(cont, defs);
    expect(a.packedItems).toBe(b.packedItems);
    expect(a.usedVolume).toBe(b.usedVolume);
  });
});
