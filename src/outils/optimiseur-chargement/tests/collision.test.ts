import { describe, it, expect } from 'vitest';
import { boxesIntersect, isWithinContainer } from '../engine/collision';
import type { Box, ContainerDefinition } from '../engine/types';

const box = (x: number, y: number, z: number, length: number, width: number, height: number): Box =>
  ({ x, y, z, length, width, height });

describe('boxesIntersect', () => {
  it('objets séparés → pas de collision', () => {
    expect(boxesIntersect(box(0, 0, 0, 100, 100, 100), box(200, 0, 0, 100, 100, 100))).toBe(false);
  });

  it('objets qui se chevauchent → collision', () => {
    expect(boxesIntersect(box(0, 0, 0, 100, 100, 100), box(50, 50, 50, 100, 100, 100))).toBe(true);
  });

  it('faces exactement jointives → pas de collision', () => {
    expect(boxesIntersect(box(0, 0, 0, 100, 100, 100), box(100, 0, 0, 100, 100, 100))).toBe(false);
  });

  it('empilés (contact par le dessus) → pas de collision', () => {
    expect(boxesIntersect(box(0, 0, 0, 100, 100, 100), box(0, 0, 100, 100, 100, 100))).toBe(false);
  });
});

describe('isWithinContainer', () => {
  const container = (length: number, width: number, height: number): ContainerDefinition =>
    ({ id: 't', label: 't', length, width, height, maxWeight: null });

  it('carton 100×100×100 n’entre pas dans un contenant 90×100×100', () => {
    expect(isWithinContainer(box(0, 0, 0, 100, 100, 100), container(90, 100, 100))).toBe(false);
  });

  it('carton 60×60×60 entre dans un contenant 100×100×100', () => {
    expect(isWithinContainer(box(0, 0, 0, 60, 60, 60), container(100, 100, 100))).toBe(true);
  });

  it('objet qui dépasse une paroi → refusé', () => {
    expect(isWithinContainer(box(60, 0, 0, 60, 60, 60), container(100, 100, 100))).toBe(false);
  });
});
