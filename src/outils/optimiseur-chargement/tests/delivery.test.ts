import { describe, it, expect } from 'vitest';
import { optimize } from '../engine/optimizer';
import { blocks, findBlockedItems, normalizeStop } from '../engine/delivery';
import { boxesIntersect } from '../engine/collision';
import type { Box, ContainerDefinition, ItemDefinition, PlacedItem } from '../engine/types';

const container = (length: number, width: number, height: number, maxWeight: number | null = null): ContainerDefinition =>
  ({ id: 'c', label: 'c', length, width, height, maxWeight });

const item = (over: Partial<ItemDefinition>): ItemDefinition => ({
  id: 'i', reference: 'R', quantity: 1,
  length: 100, width: 100, height: 100, weight: 1,
  rotationMode: 'FULL', stackable: true,
  ...over,
});

const box = (x: number, y: number, z: number, length = 100, width = 100, height = 100): Box =>
  ({ x, y, z, length, width, height });

const toBox = (p: PlacedItem): Box => ({ x: p.x, y: p.y, z: p.z, length: p.length, width: p.width, height: p.height });

function assertNoOverlap(placed: PlacedItem[]) {
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      expect(boxesIntersect(toBox(placed[i]), toBox(placed[j]))).toBe(false);
    }
  }
}

describe('blocks() — règle d\'accessibilité', () => {
  it('un colis devant (côté portes) sur la même section bloque', () => {
    expect(blocks(box(100, 0, 0), box(0, 0, 0))).toBe(true);
  });
  it('un colis derrière (côté cabine) ne bloque pas', () => {
    expect(blocks(box(0, 0, 0), box(100, 0, 0))).toBe(false);
  });
  it('un colis devant mais sur une autre bande de largeur ne bloque pas', () => {
    expect(blocks(box(100, 100, 0), box(0, 0, 0))).toBe(false);
  });
  it('un colis posé dessus bloque', () => {
    expect(blocks(box(0, 0, 100), box(0, 0, 0))).toBe(true);
  });
  it('un colis dessous ne bloque pas', () => {
    expect(blocks(box(0, 0, 0), box(0, 0, 100))).toBe(false);
  });
});

describe('normalizeStop', () => {
  it('valeurs invalides → arrêt 1', () => {
    expect(normalizeStop(undefined)).toBe(1);
    expect(normalizeStop(0)).toBe(1);
    expect(normalizeStop('abc')).toBe(1);
    expect(normalizeStop('3')).toBe(3);
  });
});

describe('Mono-destination — comportement inchangé', () => {
  it('sans arrêt renseigné, résultat identique à arrêt = 1 partout', () => {
    const cont = container(6000, 2400, 2400, 24000);
    const defs = [
      item({ id: 'a', quantity: 40, length: 600, width: 400, height: 400, weight: 12 }),
      item({ id: 'b', quantity: 20, length: 800, width: 600, height: 500, weight: 18 }),
    ];
    const r1 = optimize(cont, defs);
    const r2 = optimize(cont, defs.map((d) => ({ ...d, stop: 1 })));
    expect(r1.packedItems).toBe(r2.packedItems);
    expect(r1.placedItems.map(toBox)).toEqual(r2.placedItems.map(toBox));
    expect(r1.stops).toHaveLength(1);
    expect(r1.blockedItemIds).toHaveLength(0);
  });
});

describe('Tournée multi-arrêts — mode strict', () => {
  const cont = container(6000, 2400, 2400);
  const defs = [
    item({ id: 's1', reference: 'S1', quantity: 12, length: 1200, width: 800, height: 1000, stop: 1, destination: 'Client A' }),
    item({ id: 's2', reference: 'S2', quantity: 12, length: 1200, width: 800, height: 1000, stop: 2, destination: 'Client B' }),
    item({ id: 's3', reference: 'S3', quantity: 6, length: 600, width: 400, height: 400, stop: 3 }),
  ];
  const r = optimize(cont, defs);

  it('tout rentre, aucun colis bloqué, aucun chevauchement', () => {
    expect(r.unpackedCount).toBe(0);
    expect(r.blockedItemIds).toHaveLength(0);
    expect(findBlockedItems(r.placedItems)).toHaveLength(0);
    assertNoOverlap(r.placedItems);
  });

  it('le 1er arrêt est côté portes, le dernier au fond', () => {
    const avgX = (stop: number) => {
      const ps = r.placedItems.filter((p) => p.stop === stop);
      return ps.reduce((s, p) => s + p.x, 0) / ps.length;
    };
    expect(avgX(1)).toBeGreaterThan(avgX(2));
    expect(avgX(2)).toBeGreaterThan(avgX(3));
  });

  it('synthèse par arrêt, avec libellés de destination', () => {
    expect(r.stops.map((s) => s.stop)).toEqual([1, 2, 3]);
    expect(r.stops[0].destination).toBe('Client A');
    expect(r.stops[0].packedItems).toBe(12);
    expect(r.stops[2].totalItems).toBe(6);
  });
});

describe('Tournée — dépassement de capacité', () => {
  // 10 palettes au sol possibles (5 × 2), on en demande 12.
  const cont = container(6000, 1600, 1200);
  const pal = (id: string, stop: number, quantity: number) =>
    item({ id, reference: id, quantity, length: 1200, width: 800, height: 1000, stackable: false, rotationMode: 'NONE', stop });

  it('en strict, les colis en excès sont listés par arrêt et aucun colis placé n\'est bloqué', () => {
    const r = optimize(cont, [pal('A', 1, 6), pal('B', 2, 6)]);
    expect(r.packedItems).toBe(10);
    expect(r.unpackedCount).toBe(2);
    expect(r.blockedItemIds).toHaveLength(0);
    const total = r.stops.reduce((s, x) => s + x.unpackedItems, 0);
    expect(total).toBe(2);
  });

  it('retirer un arrêt entier libère la place pour les autres', () => {
    const r = optimize(cont, [pal('A', 1, 6), pal('C', 3, 4)]);
    expect(r.unpackedCount).toBe(0);
  });

  it('le mode souple charge au moins autant que le strict', () => {
    const defs = [pal('A', 1, 3), pal('B', 2, 3), item({ id: 'c', quantity: 30, length: 400, width: 400, height: 300, stop: 3 })];
    const strict = optimize(container(3600, 1600, 1200), defs, { deliveryMode: 'STRICT' });
    const soft = optimize(container(3600, 1600, 1200), defs, { deliveryMode: 'SOFT' });
    expect(soft.packedItems).toBeGreaterThanOrEqual(strict.packedItems);
    expect(strict.blockedItemIds).toHaveLength(0);
    assertNoOverlap(soft.placedItems);
  });
});
