import { describe, it, expect } from 'vitest';
import { tourWarning } from './tourCheck';

const refs = { tours: [{ code: 'N', label: 'Nord' }, { code: 'S', label: 'Sud' }], agencies: [{ code: 'LYO', tour: 'N' }, { code: 'VIL', tour: 'N' }, { code: 'GRE', tour: 'S' }, { code: 'PAR', tour: null }] };

describe('alerte tournée', () => {
  it('rien si même tournée, sans tournée paramétrée, ou rien de rattaché', () => {
    expect(tourWarning(['LYO', 'VIL', ''], refs)).toBeNull();
    expect(tourWarning(['LYO', 'GRE'], { tours: [], agencies: [] })).toBeNull();
    expect(tourWarning(['PAR', 'Client X'], refs)).toBeNull();
  });
  it('plusieurs tournées ou une destination hors tournée : alerte détaillée', () => {
    expect(tourWarning(['LYO', 'GRE'], refs)).toMatch(/Nord \(N\) : LYO[\s\S]*Sud \(S\) : GRE/);
    expect(tourWarning(['LYO', 'PAR'], refs)).toMatch(/hors tournée : PAR/);
  });
});
