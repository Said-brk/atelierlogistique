// Coût théorique d'un chargement d'après la grille d'un transporteur (tables de référence, kind = 'carrier').
// Modes de facturation courants en transport routier :
//  - ldm    : au mètre plancher (MPL), arrondi au 0,1 MPL supérieur ;
//  - pallet : à la palette / à l'unité chargée ;
//  - weight : aux 100 kg taxables, taxable = max(poids réel, m³ × kg/m³, MPL × kg/MPL) ;
//  - ftl    : forfait par véhicule (lot complet), prix par type de véhicule.
// + minimum de perception et surcharge gazole (% du transport).

export type Billing = 'ldm' | 'pallet' | 'weight' | 'ftl';

export interface CarrierData {
  billing: Billing;
  /** €/MPL, €/palette ou €/100 kg selon le mode (inutile en forfait). */
  rate?: number | null;
  /** Minimum facturé (€), avant surcharge gazole. */
  minCharge?: number | null;
  /** Mode « weight » : équivalences de taxation. */
  kgPerM3?: number | null;
  kgPerLdm?: number | null;
  /** Mode « ftl » : prix par code véhicule. */
  prices?: Record<string, number | null> | null;
  /** Surcharge gazole (%). */
  fuelPct?: number | null;
}

/** Ce qu'il faut savoir du chargement (résumé du plan). */
export interface LoadFacts {
  ldm: number | null;
  weightKg: number;
  volumeM3: number;
  units: number;
  vehicles: { code: string; label: string; count: number }[];
}

export interface Quote {
  basis: Billing;
  qty: number;
  unit: string;
  /** Montant transport avant minimum et gazole. */
  base: number;
  minApplied: boolean;
  fuel: number;
  amount: number;
  /** Mode « weight » : poids taxable retenu et sa base. */
  taxable?: { kg: number; by: 'real' | 'volume' | 'floor' };
  /** Mode « ftl » : détail par véhicule. */
  lines?: { label: string; count: number; price: number }[];
}

export type QuoteResult = Quote | { error: string };

export const BILLING_LABELS: Record<Billing, string> = {
  ldm: 'Au mètre plancher (MPL)',
  pallet: 'À la palette / unité',
  weight: 'Aux 100 kg taxables',
  ftl: 'Forfait par véhicule (lot complet)',
};
export const RATE_UNIT: Record<Billing, string> = { ldm: '€/MPL', pallet: '€/palette', weight: '€/100 kg', ftl: '' };

const num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const r2 = (v: number) => Math.round(v * 100) / 100;
/** Arrondi supérieur au pas (évite 2,1000000001 → 2,2). */
const ceilTo = (v: number, step: number) => Math.ceil(Math.round((v / step) * 1e6) / 1e6) * step;

export function quote(facts: LoadFacts, c: CarrierData): QuoteResult {
  const rate = num(c.rate);
  let qty = 0; let unit = ''; let base = 0;
  let taxable: Quote['taxable']; let lines: Quote['lines'];
  switch (c.billing) {
    case 'ldm': {
      if (facts.ldm == null) return { error: 'Mètres plancher non calculés : lancez le calcul du plan.' };
      qty = r2(ceilTo(facts.ldm, 0.1)); unit = 'MPL'; base = qty * rate; break;
    }
    case 'pallet': {
      qty = facts.units; unit = qty > 1 ? 'palettes' : 'palette'; base = qty * rate; break;
    }
    case 'weight': {
      const real = facts.weightKg;
      const vol = facts.volumeM3 * num(c.kgPerM3, 0);
      const floor = facts.ldm == null ? 0 : facts.ldm * num(c.kgPerLdm, 0);
      const kg = Math.max(real, vol, floor);
      taxable = { kg: Math.round(kg), by: kg === real ? 'real' : kg === floor ? 'floor' : 'volume' };
      qty = Math.ceil(Math.round(kg) / 100); unit = '× 100 kg'; base = qty * rate; break;
    }
    case 'ftl': {
      if (!facts.vehicles.length) return { error: 'Aucun véhicule : lancez le calcul du plan.' };
      lines = [];
      for (const v of facts.vehicles) {
        const p = c.prices?.[v.code];
        if (p == null || !Number.isFinite(Number(p))) return { error: `Pas de forfait pour « ${v.label} » chez ce transporteur.` };
        lines.push({ label: v.label, count: v.count, price: Number(p) });
      }
      qty = lines.reduce((s, l) => s + l.count, 0); unit = qty > 1 ? 'véhicules' : 'véhicule';
      base = lines.reduce((s, l) => s + l.count * l.price, 0); break;
    }
    default: return { error: 'Mode de facturation inconnu.' };
  }
  const min = num(c.minCharge);
  const minApplied = min > 0 && base < min;
  const transport = minApplied ? min : base;
  const fuel = r2(transport * num(c.fuelPct) / 100);
  return { basis: c.billing, qty, unit, base: r2(base), minApplied, fuel, amount: r2(transport + fuel), taxable, lines };
}

/** Faits du chargement à partir du résumé enregistré (result.summary). */
export function factsOf(summary: Record<string, unknown> | null | undefined): LoadFacts | null {
  if (!summary) return null;
  return {
    ldm: summary.ldm == null ? null : num(summary.ldm),
    weightKg: num(summary.weight),
    volumeM3: num(summary.volume),
    units: num(summary.packed),
    vehicles: Array.isArray(summary.vehicles) ? (summary.vehicles as LoadFacts['vehicles']) : [],
  };
}
