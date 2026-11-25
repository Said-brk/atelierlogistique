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

describe('grille par zone, gazole mensuel, arrêts, comparaison', () => {
  it('zone la plus chère des destinations, sinon tarif de base', async () => {
    const { quote } = await import('./pricing');
    const c = { billing: 'ldm' as const, rate: 90, zones: [{ zone: '69', rate: 100 }, { zone: '13', rate: 130 }] };
    expect((quote({ ...facts, ldm: 5, zones: ['69'] }, c) as any).amount).toBe(500);
    expect((quote({ ...facts, ldm: 5, zones: ['69', '13'] }, c) as any)).toMatchObject({ amount: 650, zone: 'Zone 13' });
    expect((quote({ ...facts, ldm: 5, zones: ['75'] }, c) as any).amount).toBe(450);
    expect(quote({ ...facts, ldm: 5, zones: ['75'] }, { ...c, rate: null })).toHaveProperty('error');
  });
  it('surcharge gazole du mois (ou dernier mois publié) et frais d’arrêts', async () => {
    const { quote } = await import('./pricing');
    const c = { billing: 'pallet' as const, rate: 10, fuelPct: 5, fuelByMonth: { '2026-10': 10, '2026-11': 12 }, stopFee: 20 };
    expect((quote({ ...facts, units: 10, month: '2026-11', stops: 3 }, c) as any)).toMatchObject({ stopsFee: 40, fuelPct: 12, amount: 156.8 });
    expect((quote({ ...facts, units: 10, month: '2026-12' }, c) as any).fuelPct).toBe(12);
    expect((quote({ ...facts, units: 10, month: '2026-01' }, c) as any).fuelPct).toBe(5);
  });
  it('classement des transporteurs', async () => {
    const { rankCarriers, routeOf } = await import('./pricing');
    const r = rankCarriers({ ...facts, ldm: 5 }, [
      { code: 'A', label: 'A', data: { billing: 'ldm', rate: 120 } },
      { code: 'B', label: 'B', data: { billing: 'ftl', prices: {} } },
      { code: 'C', label: 'C', data: { billing: 'ldm', rate: 100 } },
    ]);
    expect(r.map((x) => x.code)).toEqual(['C', 'A', 'B']);
    expect(routeOf([{ destination: 'LYO', quantity: 2 }, { destination: 'mar', quantity: 1 }, { destination: 'LYO' }], [{ code: 'LYO', zone: '69', tour: 'T1' }, { code: 'MAR', zone: '13' }]))
      .toEqual({ dests: [{ agency: 'LYO', tour: 'T1', zone: '69' }, { agency: 'MAR', tour: null, zone: '13' }], stops: 2 });
  });
});

describe('grille par agence / tournée / zone', () => {
  it('priorité agence > tournée > zone > base, puis destination la plus chère', async () => {
    const { quote } = await import('./pricing');
    const c = { billing: 'ldm' as const, rate: 90, zones: [
      { scope: 'zone' as const, key: '69', rate: 100 }, { scope: 'tour' as const, key: 'T1', rate: 120 }, { scope: 'agency' as const, key: 'LYO', rate: 105 },
    ] };
    const f = (dests: any[]) => ({ ...facts, ldm: 10, dests });
    expect(quote(f([{ agency: 'LYO', tour: 'T1', zone: '69' }]), c)).toMatchObject({ rate: 105, zone: 'Agence LYO' });
    expect(quote(f([{ agency: 'VIL', tour: 'T1', zone: '69' }]), c)).toMatchObject({ rate: 120, zone: 'Tournée T1' });
    expect(quote(f([{ agency: 'VIL', tour: null, zone: '69' }]), c)).toMatchObject({ rate: 100, zone: 'Zone 69' });
    expect(quote(f([{ agency: 'X', tour: null, zone: null }]), c)).toMatchObject({ rate: 90, zone: null });
    expect(quote(f([{ agency: 'LYO', tour: 'T1', zone: '69' }, { agency: 'VIL', tour: 'T1', zone: null }]), c)).toMatchObject({ rate: 120 });
    expect(quote(f([{ agency: 'X', tour: null, zone: null }]), { ...c, rate: null })).toHaveProperty('error');
  });
});
