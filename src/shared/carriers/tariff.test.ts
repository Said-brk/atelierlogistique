import { describe, it, expect } from 'vitest';
import { deptOf, tokensOf, zoneIndex, parseTariffTable, upperBoundOf, type Tariff } from './tariff';
import { quote, routeOf, factsOf } from './pricing';

// Exemple de grille messagerie (fictive) : 4 zones au départ de Rungis, prix aux 100 kg, minimum par zone.
const PASTE = `| Poids taxable         | Zone 1 | Zone 2 | Zone 3 | Zone 4 |
| --------------------- | ------ | ------ | ------ | ------ |
| 0–99 kg               | 22 €   | 28 €   | 35 €   | 42 €   |
| 100–299 kg            | 18 €   | 23 €   | 29 €   | 35 €   |
| 300–499 kg            | 14 €   | 18 €   | 23 €   | 28 €   |
| 500–999 kg            | 10 €   | 14 €   | 18 €   | 22 €   |
| 1 000–1 999 kg        | 8 €    | 11 €   | 14 €   | 18 €   |
| 2 000–3 000 kg        | 7 €    | 9 €    | 12 €   | 15 €   |
| Minimum de perception | 35 €   | 45 €   | 55 €   | 65 €   |
| Surcharge gazole      | 22 %   | 22 %   | 22 %   | 22 %   |`;

const grid = (mode: Tariff['mode'] = 'per_dest'): Tariff => {
  const p = parseTariffTable(PASTE) as Exclude<ReturnType<typeof parseTariffTable>, { error: string }>;
  return {
    mode,
    zones: [
      { code: 'Zone 1', match: 'Île-de-France, 28, 60' },
      { code: 'Zone 2', match: '59 62 80 02 76 27 14 51 45 37 21' },
      { code: 'Zone 3', match: 'Auvergne-Rhône-Alpes, 44, 35, 33, 67' },
      { code: 'Zone 4', match: '*' },
    ],
    bands: p.bands, min: p.min ?? undefined,
  };
};

describe('grille zones × tranches', () => {
  it('codes postaux → département (Corse, DOM)', () => {
    expect(deptOf('69100')).toBe('69'); expect(deptOf('20000')).toBe('2A'); expect(deptOf('20200')).toBe('2B');
    expect(deptOf('97400')).toBe('974'); expect(deptOf('abc')).toBeNull();
  });
  it('régions remplacées par leurs départements ; motif le plus précis', () => {
    expect(tokensOf('Île-de-France, 28')).toEqual(['75', '77', '78', '91', '92', '93', '94', '95', '28']);
    const t = grid();
    expect(zoneIndex(t, '94150')).toBe(0); // Rungis
    expect(zoneIndex(t, '59000')).toBe(1); // Lille
    expect(zoneIndex(t, '69007')).toBe(2); // Lyon (région)
    expect(zoneIndex(t, '13001')).toBe(3); // Marseille : « * »
    expect(zoneIndex({ ...t, zones: [...t.zones, { code: 'Lyon centre', match: '69001-69009' }] }, '69007')).toBe(4); // plage plus précise
    expect(zoneIndex(t, '13001', 'zone 1')).toBe(0); // zone forcée sur l'agence
  });
  it('collage d’un tableau Markdown / Excel : tranches, minimum, gazole', () => {
    const p = parseTariffTable(PASTE) as any;
    expect(p.zones).toEqual(['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4']);
    expect(p.bands.map((b: any) => b.upTo)).toEqual([99, 299, 499, 999, 1999, 3000]);
    expect(p.bands[4].prices).toEqual([8, 11, 14, 18]);
    expect(p.min).toEqual([35, 45, 55, 65]); expect(p.fuelPct).toBe(22);
    const x = parseTariffTable('Tranche\tZ1\tZ2\nForfait 0-5 palettes\t120\t150\nPlus de 5\t20\t25') as any;
    expect(x.bands).toEqual([{ upTo: 5, prices: [120, 150], flat: true }, { upTo: null, prices: [20, 25], flat: false }]);
    expect(upperBoundOf('2 000 à 3 000 kg')).toBe(3000);
    expect(parseTariffTable('rien')).toHaveProperty('error');
  });
  it('par destination (messagerie) : chaque destination à son tarif et son minimum, puis somme', () => {
    const agencies = [{ code: 'PAR', postalCode: '75012' }, { code: 'LYO', postalCode: '69007' }, { code: 'MRS', postalCode: '13001' }];
    const rows = [
      { destination: 'PAR', quantity: 1, length: 120, width: 80, height: 100, weight: 450 },
      { destination: 'LYO', quantity: 2, length: 120, width: 80, height: 100, weight: 600 },
      { destination: 'MRS', quantity: 1, length: 40, width: 30, height: 30, weight: 40 },
    ];
    const f = factsOf({ ldm: 2.4, weight: 1690, volume: 2.92, packed: 4, pallets: 3 }, { ...routeOf(rows, agencies), month: '2026-11' })!;
    const q = quote(f, { billing: 'weight', kgPerM3: 0, kgPerLdm: 0, fuelPct: 22, tariff: grid() }) as any;
    // PAR 450 kg → 300–499, Z1 14 €/100 kg × 5 = 70 ; LYO 1 200 kg → Z3 14 € × 12 = 168 ; MRS 40 kg → Z4 42 € × 1 = 42 → minimum 65.
    expect(q.byDest.map((d: any) => [d.agency, d.zone, d.qty, d.price, d.minApplied])).toEqual([
      ['PAR', 'Zone 1', 450, 70, false], ['LYO', 'Zone 3', 1200, 168, false], ['MRS', 'Zone 4', 40, 65, true]]);
    expect(q.base).toBe(303); expect(q.fuel).toBe(66.66); expect(q.amount).toBe(369.66);
  });
  it('chargement entier (affrètement) : zone la plus chère ; au-delà de la grille : erreur', () => {
    const agencies = [{ code: 'PAR', postalCode: '75012' }, { code: 'LIL', postalCode: '59000' }];
    const rows = [{ destination: 'PAR', quantity: 1, weight: 900 }, { destination: 'LIL', quantity: 1, weight: 600 }];
    const f = factsOf({ ldm: 1, weight: 1500, volume: 2, packed: 2 }, routeOf(rows, agencies))!;
    const q = quote(f, { billing: 'weight', tariff: grid('whole') }) as any;
    expect(q.byDest[0]).toMatchObject({ zone: 'Zone 2', qty: 1500, price: 165 }); // 11 € × 15
    expect(quote({ ...f, weightKg: 3500 }, { billing: 'weight', tariff: grid('whole') })).toHaveProperty('error');
  });
  it('agence sans code postal ni zone « * » : message clair', () => {
    const t = { ...grid(), zones: grid().zones.slice(0, 3) };
    const f = factsOf({ ldm: 1, weight: 100, volume: 1, packed: 1 }, routeOf([{ destination: 'X', quantity: 1, weight: 100 }], [{ code: 'X' }]))!;
    expect((quote(f, { billing: 'weight', tariff: t }) as any).error).toMatch(/code postal manquant/);
  });
});

describe('sélection des départements', () => {
  it('motifs ↔ départements cochés, reste de la France, codes postaux ; départements sans zone', async () => {
    const { splitMatch, joinMatch, uncoveredDepts } = await import('./tariff');
    expect(splitMatch('Île-de-France, 28 69001-69009 *')).toEqual({ depts: ['75', '77', '78', '91', '92', '93', '94', '95', '28'], rest: true, other: ['69001-69009'] });
    expect(joinMatch({ depts: ['75', '2A'], rest: false, other: ['13100'] })).toBe('75 2A 13100');
    expect(splitMatch('1 2a').depts).toEqual(['01', '2A']);
    expect(uncoveredDepts([{ code: 'Z1', match: '*' }])).toEqual([]);
    const miss = uncoveredDepts([{ code: 'Z1', match: 'Île-de-France' }]);
    expect(miss.length).toBe(96 - 8); expect(miss).not.toContain('974');
  });
});
