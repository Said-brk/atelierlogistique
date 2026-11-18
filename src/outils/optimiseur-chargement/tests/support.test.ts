import { describe, it, expect } from 'vitest';
import { supportRatio, isStable, hasNonStackableBelow, overlapAreaXY } from '../engine/support';
import { MIN_SUPPORT_RATIO } from '../constants/engine-config';
import type { Box, PlacedItem } from '../engine/types';

const box = (x: number, y: number, z: number, length: number, width: number, height: number): Box =>
  ({ x, y, z, length, width, height });

const placed = (over: Partial<PlacedItem>): PlacedItem => ({
  id: 'p', definitionId: 'd', reference: 'R',
  x: 0, y: 0, z: 0, length: 100, width: 100, height: 100,
  originalLength: 100, originalWidth: 100, originalHeight: 100,
  rotation: { x: 0, y: 0, z: 0 }, weight: 1, stackable: true, stop: 1, destination: '', sequence: 1, wall: 0,
  ...over,
});

describe('overlapAreaXY', () => {
  it('recouvrement partiel', () => {
    expect(overlapAreaXY(box(0, 0, 0, 100, 100, 10), box(50, 0, 0, 100, 100, 10))).toBe(50 * 100);
  });
  it('aucun recouvrement', () => {
    expect(overlapAreaXY(box(0, 0, 0, 100, 100, 10), box(200, 0, 0, 100, 100, 10))).toBe(0);
  });
});

describe('isStable', () => {
  it('objet au sol → stable', () => {
    expect(isStable(box(0, 0, 0, 50, 50, 50), [], MIN_SUPPORT_RATIO)).toBe(true);
  });

  it('objet en l’air sans rien dessous → instable (ne flotte pas)', () => {
    expect(isStable(box(0, 0, 200, 50, 50, 50), [], MIN_SUPPORT_RATIO)).toBe(false);
  });

  it('objet entièrement supporté → stable', () => {
    const base = placed({ z: 0, length: 100, width: 100, height: 100 });
    const b = box(0, 0, 100, 50, 50, 50);
    expect(supportRatio(b, [base])).toBe(1);
    expect(isStable(b, [base], MIN_SUPPORT_RATIO)).toBe(true);
  });

  it('support insuffisant (< 80 %) → instable', () => {
    const base = placed({ z: 0, length: 100, width: 100, height: 100 });
    const b = box(80, 0, 100, 100, 100, 100); // 20 % de recouvrement en X
    expect(supportRatio(b, [base])).toBeCloseTo(0.2, 5);
    expect(isStable(b, [base], MIN_SUPPORT_RATIO)).toBe(false);
  });

  it('rien ne peut être posé sur une unité non empilable', () => {
    const base = placed({ z: 0, length: 100, width: 100, height: 100, stackable: false });
    const b = box(0, 0, 100, 50, 50, 50);
    expect(hasNonStackableBelow(b, [base])).toBe(true);
    expect(isStable(b, [base], MIN_SUPPORT_RATIO)).toBe(false);
  });
});
