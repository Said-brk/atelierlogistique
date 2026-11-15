import { describe, it, expect } from 'vitest';
import { getOrientations } from '../engine/rotations';
import type { Dimensions } from '../engine/types';

const palette: Dimensions = { length: 120, width: 80, height: 150 };

describe('getOrientations', () => {
  it('NONE → une seule orientation', () => {
    expect(getOrientations(palette, 'NONE')).toHaveLength(1);
  });

  it('HORIZONTAL → 2 orientations, hauteur conservée', () => {
    const o = getOrientations(palette, 'HORIZONTAL');
    expect(o).toHaveLength(2);
    expect(o.every((d) => d.height === 150)).toBe(true);
    // jamais couchée
    expect(o.some((d) => d.height === 120 || d.height === 80)).toBe(false);
    expect(o).toContainEqual({ length: 120, width: 80, height: 150 });
    expect(o).toContainEqual({ length: 80, width: 120, height: 150 });
  });

  it('FULL → 6 orientations distinctes', () => {
    expect(getOrientations(palette, 'FULL')).toHaveLength(6);
  });

  it('cube → une orientation unique quel que soit le mode', () => {
    const cube: Dimensions = { length: 50, width: 50, height: 50 };
    expect(getOrientations(cube, 'FULL')).toHaveLength(1);
    expect(getOrientations(cube, 'HORIZONTAL')).toHaveLength(1);
  });

  it('base carrée → doublons éliminés en FULL', () => {
    // 100×100×200 : les permutations ne donnent que 3 formes distinctes
    const d: Dimensions = { length: 100, width: 100, height: 200 };
    expect(getOrientations(d, 'FULL')).toHaveLength(3);
  });
});
