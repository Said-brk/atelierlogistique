// Cas limites : tarification transporteur, contrôle des factures, mètres plancher.
import { describe, it, expect } from 'vitest';
import { quote, factsOf, routeOf, rateFor, fuelFor } from './pricing';
import { controlRows, carrierStats, parseInvoiceCsv, matchInvoice } from '../../espace/transport/control';
import { floorMeters, taxableWeight } from '../../outils/optimiseur-chargement/engine/floorMeters';

const F = { ldm: 6.7, weightKg: 1000, volumeM3: 10, units: 0, vehicles: [] as any[] };

describe('tarification : arrondis et bornes', () => {
  it('6,7 MPL reste 6,7 (pas d’arrondi parasite à 6,8)', () => {
    expect((quote(F, { billing: 'ldm', rate: 100 }) as any).qty).toBe(6.7);
    expect((quote({ ...F, ldm: 0.3 }, { billing: 'ldm', rate: 100 }) as any).qty).toBe(0.3);
    expect((quote({ ...F, ldm: 0.31 }, { billing: 'ldm', rate: 100 }) as any).qty).toBe(0.4);
  });
  it('0 palette : le minimum de perception s’applique', () => {
    expect(quote(F, { billing: 'pallet', rate: 40, minCharge: 90 })).toMatchObject({ amount: 90, minApplied: true });
  });
  it('aux 100 kg : 1 001 kg = 11 tranches ; sans MPL le plancher est ignoré', () => {
    expect((quote({ ...F, weightKg: 1001, volumeM3: 0, ldm: null }, { billing: 'weight', rate: 10, kgPerM3: 333, kgPerLdm: 1750 }) as any).qty).toBe(11);
  });
  it('tarif « 0 » est un vrai tarif (gratuit), pas une absence', () => {
    expect(quote(F, { billing: 'ldm', rate: 0 })).toMatchObject({ amount: 0 });
  });
  it('tarif saisi en texte (formulaire) accepté', () => {
    expect((quote(F, { billing: 'ldm', rate: '100' as any }) as any).amount).toBe(670);
  });
  it('gazole : mois antérieur au barème → taux par défaut ; sans mois → défaut', () => {
    const c = { billing: 'ldm' as const, rate: 1, fuelPct: 5, fuelByMonth: { '2026-11': 12 } };
    expect(fuelFor(c, '2026-10').pct).toBe(5);
    expect(fuelFor(c, null).pct).toBe(5);
    expect(fuelFor({ ...c, fuelByMonth: { '2026-11': null } }, '2026-11').pct).toBe(5);
  });
  it('grille sans tarif de base : destination sans zone → erreur explicite', () => {
    expect(rateFor({ billing: 'ldm', rate: null, zones: [{ scope: 'zone', key: '69', rate: 100 }] }, [{ agency: 'X', tour: null, zone: null }])).toHaveProperty('error');
  });
  it('résumé d’un ancien chargement (sans MPL ni véhicules) : erreur au MPL, prix à la palette', () => {
    const f = factsOf({ vehicle: 'Semi', packed: 12, weight: 5000, fill: 0.4 })!;
    expect(f.ldm).toBeNull();
    expect(quote(f, { billing: 'ldm', rate: 100 })).toHaveProperty('error');
    expect((quote(f, { billing: 'pallet', rate: 10 }) as any).amount).toBe(120);
    expect(quote(f, { billing: 'ftl', prices: { semi: 600 } })).toHaveProperty('error');
  });
  it('destinations : agence inconnue gardée telle quelle, lignes à quantité 0 ignorées', () => {
    expect(routeOf([{ destination: 'ZZZ', quantity: 1 }, { destination: 'LYO', quantity: 0 }], [{ code: 'LYO', zone: '69' }]))
      .toMatchObject({ dests: [{ agency: 'ZZZ', tour: null, zone: null }], stops: 1 });
  });
});

describe('contrôle des factures : bornes', () => {
  const base = { label: null, external_id: null, departure_at: null, tour: null, status: 'loaded', carrier: 'GEO', invoice_ref: null, invoiced_qty: null, carrier_quote: null, summary: null } as any;
  it('écart pile à la tolérance = conforme ; coût théorique 0 = pas de %', () => {
    const r = controlRows([{ ...base, id: '1', code: 'A', carrier_cost: 100, invoiced_amount: 103 }, { ...base, id: '2', code: 'B', carrier_cost: 0, invoiced_amount: 50 }], 3);
    expect(r[0].flag).toBe('ok');
    expect(r[1].gapPct).toBeNull();
  });
  it('montants renvoyés en texte par la base (numeric) bien lus', () => {
    const r = controlRows([{ ...base, id: '1', code: 'A', carrier_cost: '100.00', invoiced_amount: '110.50' }], 3);
    expect(r[0]).toMatchObject({ gap: 10.5, flag: 'over' });
    expect(carrierStats(r)[0].invoiced).toBe(110.5);
  });
  it('CSV : séparateur virgule, montant « 1,100.50 », champs entre guillemets', () => {
    const { lines } = parseInvoiceCsv('Reference,Amount,Invoice\nCH-1,"1,100.50",F-9\n"CH-2",250,F-9');
    expect(lines.map((l) => l.amount)).toEqual([1100.5, 250]);
  });
  it('CSV : tabulations (copier-coller Excel) et montant « 1 100,50 € »', () => {
    const { lines } = parseInvoiceCsv('Référence\tMontant HT\nCH-1\t1 100,50 €');
    expect(lines[0]).toMatchObject({ ref: 'CH-1', amount: 1100.5 });
  });
  it('CSV : point-virgule dans une valeur entre guillemets', () => {
    const { lines } = parseInvoiceCsv('Référence;Montant;N° facture\nCH-1;100;"F;1"');
    expect(lines[0].invoice).toBe('F;1');
  });
  it('rapprochement insensible à la casse et aux espaces', () => {
    const { matched } = matchInvoice([{ ref: ' ch-1 ', amount: 1, qty: null, invoice: null, line: 2 }], [{ id: '1', code: 'CH-1', external_id: null }]);
    expect(matched).toHaveLength(1);
  });
});

describe('mètres plancher : cas limites', () => {
  const semi = { id: 'semi', label: 'Semi', length: 13600, width: 2450, height: 2700, maxWeight: 24000 } as any;
  it('aucun colis : 0 MPL', () => { expect(floorMeters([], semi)).toMatchObject({ ldm: 0, floorItems: 0 }); });
  it('poids taxable : valeurs négatives ou nulles ramenées à 0', () => {
    expect(taxableWeight({ weightKg: -5, volumeM3: 0, ldm: 0 }).taxable).toBe(0);
  });
});
