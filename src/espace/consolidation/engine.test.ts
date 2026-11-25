import { describe, it, expect } from 'vitest';
import { analyzeDay, mergeRows, type DayShipment } from './engine';
import { toToolReferences, defaultReferences } from '../../shared/references/defaults';

const vehicles = toToolReferences(defaultReferences()).vehicles.filter((v) => v.active && v.container.id !== '20ft' && !v.container.id.startsWith('40'))
  .map((v) => ({ container: v.container, cost: v.cost }));
const pal = (id: string, n: number, dest: string, stop = 1) => ({ id, reference: `PAL-${id}`, quantity: n, length: 120, width: 80, height: 150, weight: 300, stop, destination: dest, rotationMode: 'HORIZONTAL', stackable: false });
const ship = (code: string, rows: any[]): DayShipment => ({ id: code, code, label: code, status: 'in_progress', departure_at: '2026-11-25', input: { rows } });

describe('regroupement de chargements', () => {
  it('fusionne en une tournée : ids préfixés, arrêts à la suite', () => {
    const rows = mergeRows([ship('PL-A', [pal('1', 2, 'Lyon', 1), pal('2', 1, 'Mâcon', 3)]), ship('PL-B', [pal('1', 2, 'Dijon', 1)])]);
    expect(rows.map((r) => [r.id, r.stop])).toEqual([['PL-A:1', 1], ['PL-A:2', 2], ['PL-B:1', 3]]);
    expect(rows[2].fromShipment).toBe('PL-B');
  });

  it('propose un regroupement seulement quand le calcul ensemble coûte moins cher', () => {
    const day = [ship('PL-A', [pal('1', 5, 'Lyon')]), ship('PL-B', [pal('1', 5, 'Villefranche')]), ship('PL-C', [pal('1', 30, 'Paris')])];
    const a = analyzeDay(day, vehicles);
    expect(a.suggestions).toHaveLength(1);
    const s = a.suggestions[0];
    expect(s.codes).toEqual(['PL-A', 'PL-B']);
    expect(s.separate).toBe(a.separate['PL-A'].cost + a.separate['PL-B'].cost);
    expect(s.saving).toBeCloseTo(s.separate - s.together.cost);
    expect(s.together.trucks).toHaveLength(1);
    expect(s.saving).toBeGreaterThan(0);
  }, 60000);

  it('rien à proposer quand chaque chargement remplit déjà son camion', () => {
    const a = analyzeDay([ship('PL-A', [pal('1', 30, 'Lyon')]), ship('PL-B', [pal('1', 30, 'Paris')])], vehicles);
    expect(a.suggestions).toHaveLength(0);
  }, 60000);

  it('par tournée : seulement des chargements de la même tournée, arrêts dans l’ordre des agences', () => {
    const agencies = [{ code: 'LYO', tour: 'NORD', order: 2 }, { code: 'VIL', tour: 'NORD', order: 1 }, { code: 'GRE', tour: 'SUD', order: 1 }];
    const day = [ship('PL-A', [pal('1', 5, 'LYO')]), ship('PL-B', [pal('1', 5, 'VIL')]), ship('PL-C', [pal('1', 5, 'GRE')])];
    const a = analyzeDay(day, vehicles, { mode: 'tour', agencies });
    expect(a.tours).toEqual({ 'PL-A': 'NORD', 'PL-B': 'NORD', 'PL-C': 'SUD' });
    expect(a.suggestions.map((s) => s.codes)).toEqual([['PL-A', 'PL-B']]);
    // Villefranche (rang 1) livrée avant Lyon (rang 2), même si PL-A est le premier chargement.
    expect(a.suggestions[0].rows.map((r) => [r.destination, r.stop])).toEqual([['LYO', 2], ['VIL', 1]]);
    // Libre : C peut aussi être regroupé avec un autre.
    expect(analyzeDay(day, vehicles, { mode: 'free', agencies }).suggestions.length).toBeGreaterThanOrEqual(1);
  }, 60000);

  it('même agence dans deux chargements = un seul arrêt', () => {
    const rows = mergeRows([ship('PL-A', [pal('1', 2, 'LYO')]), ship('PL-B', [pal('1', 2, 'LYO')])], new Map([['LYO', { code: 'LYO', tour: 'NORD', order: 1 }]]));
    expect(rows.map((r) => r.stop)).toEqual([1, 1]);
  });
});

describe('tourOf', () => {
  it('la tournée choisie sur le chargement prime sur celle déduite des destinations', async () => {
    const { tourOf } = await import('./engine');
    const agencies = new Map([['A1', { code: 'A1', label: 'A1', tour: 'T01', order: 1 }]]) as any;
    const s = { input: { rows: [{ reference: 'X', quantity: 1, length: 1, width: 1, height: 1, destination: 'A1' }] } } as any;
    expect(tourOf(s, agencies)).toBe('T01');
    expect(tourOf({ ...s, tour: 'T09' }, agencies)).toBe('T09');
  });
});
