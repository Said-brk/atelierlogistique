import { describe, it, expect } from 'vitest';
import { quote, factsOf } from './pricing';

const facts = { ldm: 6.73, weightKg: 7200, volumeM3: 30, units: 16, vehicles: [{ code: 'semi', label: 'Semi', count: 1 }] };

describe('coût théorique transporteur', () => {
  it('au MPL : arrondi au 0,1 supérieur', () => {
    const q = quote(facts, { billing: 'ldm', rate: 100 }) as any;
    expect(q.qty).toBe(6.8); expect(q.amount).toBe(680);
  });
  it('à la palette, avec minimum et gazole', () => {
    expect((quote(facts, { billing: 'pallet', rate: 40 }) as any).amount).toBe(640);
    const q = quote({ ...facts, units: 2 }, { billing: 'pallet', rate: 40, minCharge: 150, fuelPct: 10 }) as any;
    expect(q.minApplied).toBe(true); expect(q.fuel).toBe(15); expect(q.amount).toBe(165);
  });
  it('aux 100 kg taxables : max(réel, volume, plancher)', () => {
    const q = quote(facts, { billing: 'weight', rate: 8, kgPerM3: 333, kgPerLdm: 1750 }) as any;
    expect(q.taxable).toEqual({ kg: 11778, by: 'floor' });
    expect(q.qty).toBe(118); expect(q.amount).toBe(944);
    const r = quote({ ...facts, ldm: 1, volumeM3: 1 }, { billing: 'weight', rate: 8, kgPerM3: 333, kgPerLdm: 1750 }) as any;
    expect(r.taxable.by).toBe('real');
  });
  it('forfait par véhicule', () => {
    const q = quote({ ...facts, vehicles: [{ code: 'semi', label: 'Semi', count: 2 }, { code: 'p19', label: 'Porteur 19 t', count: 1 }] },
      { billing: 'ftl', prices: { semi: 650, p19: 480 } }) as any;
    expect(q.amount).toBe(1780); expect(q.qty).toBe(3);
    expect(quote(facts, { billing: 'ftl', prices: {} })).toHaveProperty('error');
  });
  it('sans plan calculé : erreur explicite', () => {
    expect(quote({ ...facts, ldm: null }, { billing: 'ldm', rate: 100 })).toHaveProperty('error');
    expect(factsOf(null)).toBeNull();
  });
});
