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
  /** Surcharge gazole (%) par défaut. */
  fuelPct?: number | null;
  /** Surcharge gazole publiée chaque mois par le transporteur : { "2026-11": 12.4 } (%). */
  fuelByMonth?: Record<string, number | null> | null;
  /** Grille par zone (département ou zone tarifaire des agences) : remplace le tarif de base. */
  zones?: { zone: string; rate: number | null }[] | null;
  /** Frais par arrêt supplémentaire (€), au-delà du premier. */
  stopFee?: number | null;
}

/** Ce qu'il faut savoir du chargement (résumé du plan). */
export interface LoadFacts {
  ldm: number | null;
  weightKg: number;
  volumeM3: number;
  units: number;
  vehicles: { code: string; label: string; count: number }[];
  /** Zones tarifaires des destinations (agences) ; vide = inconnues. */
  zones?: string[];
  /** Nombre d'arrêts (destinations distinctes). */
  stops?: number;
  /** Mois de départ (AAAA-MM) : surcharge gazole du mois. */
  month?: string | null;
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
  /** Tarif retenu et zone qui le fixe (grille par zone). */
  rate?: number;
  zone?: string | null;
  /** Frais d'arrêts supplémentaires. */
  stopsFee?: number;
  /** Surcharge gazole appliquée (%) et son mois. */
  fuelPct?: number;
  fuelMonth?: string | null;
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

/** Tarif applicable : zone la plus chère parmi les destinations (grille), sinon tarif de base. */
export function rateFor(c: CarrierData, zones: string[] = []): { rate: number; zone: string | null } | { error: string } {
  const grid = new Map((c.zones ?? []).filter((z) => z.zone && z.rate != null).map((z) => [z.zone.trim().toUpperCase(), Number(z.rate)]));
  const base = c.rate == null || (c.rate as unknown) === '' ? null : Number(c.rate);
  if (!grid.size) return base == null ? { error: 'Tarif manquant pour ce transporteur.' } : { rate: base, zone: null };
  let best: { rate: number; zone: string | null } | null = null;
  const known = [...new Set(zones.map((z) => z.trim().toUpperCase()).filter(Boolean))];
  for (const z of known) {
    const r = grid.get(z) ?? base;
    if (r == null) return { error: `Zone ${z} absente de la grille de ce transporteur.` };
    if (!best || r > best.rate) best = { rate: r, zone: grid.has(z) ? z : null };
  }
  if (best) return best;
  return base == null ? { error: 'Destinations sans zone tarifaire (Paramètres › Agences).' } : { rate: base, zone: null };
}

/** Surcharge gazole du mois (ou du dernier mois publié avant), sinon le taux par défaut. */
export function fuelFor(c: CarrierData, month?: string | null): { pct: number; month: string | null } {
  const table = Object.entries(c.fuelByMonth ?? {}).filter(([, v]) => v != null && Number.isFinite(Number(v))).sort(([a], [b]) => a.localeCompare(b));
  if (table.length && month) {
    const past = table.filter(([m]) => m <= month);
    if (past.length) { const [m, v] = past[past.length - 1]; return { pct: Number(v), month: m }; }
  }
  return { pct: num(c.fuelPct), month: null };
}

export function quote(facts: LoadFacts, c: CarrierData): QuoteResult {
  let rate = 0; let zone: string | null = null;
  if (c.billing !== 'ftl') {
    const rf = rateFor(c, facts.zones);
    if ('error' in rf) return rf;
    ({ rate, zone } = rf);
  }
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
  const stopsFee = r2(Math.max(0, (facts.stops ?? 1) - 1) * num(c.stopFee));
  base += stopsFee;
  const min = num(c.minCharge);
  const minApplied = min > 0 && base < min;
  const transport = minApplied ? min : base;
  const f = fuelFor(c, facts.month);
  const fuel = r2(transport * f.pct / 100);
  return {
    basis: c.billing, qty, unit, base: r2(base), minApplied, fuel, amount: r2(transport + fuel), taxable, lines,
    ...(c.billing !== 'ftl' ? { rate, zone } : {}), stopsFee, fuelPct: f.pct, fuelMonth: f.month,
  };
}

/** Faits du chargement à partir du résumé enregistré (result.summary). */
export function factsOf(summary: Record<string, unknown> | null | undefined, extra: Partial<LoadFacts> = {}): LoadFacts | null {
  if (!summary) return null;
  return {
    ...extra,
    ldm: summary.ldm == null ? null : num(summary.ldm),
    weightKg: num(summary.weight),
    volumeM3: num(summary.volume),
    units: num(summary.packed),
    vehicles: Array.isArray(summary.vehicles) ? (summary.vehicles as LoadFacts['vehicles']) : [],
    zones: extra.zones ?? [], stops: extra.stops ?? 1, month: extra.month ?? null,
  };
}

/** Zones et arrêts d'un chargement d'après ses lignes (destination = code agence). */
export function routeOf(rows: { destination?: string | null; quantity?: number }[] | null | undefined, agencies: { code: string; zone?: string | null }[]) {
  const dests = [...new Set((rows ?? []).filter((r) => (r.quantity ?? 1) > 0).map((r) => String(r.destination ?? '').trim()).filter(Boolean))];
  const by = new Map(agencies.map((a) => [a.code.toUpperCase(), a]));
  const zones = dests.map((d) => by.get(d.toUpperCase())?.zone ?? '').filter(Boolean) as string[];
  return { zones, stops: Math.max(1, dests.length) };
}

/** Devis de tous les transporteurs, du moins cher au plus cher (erreurs en dernier). */
export function rankCarriers(facts: LoadFacts, carriers: { code: string; label: string; data: CarrierData }[]) {
  return carriers.map((c) => ({ code: c.code, label: c.label, q: quote(facts, c.data) }))
    .sort((a, b) => ('error' in a.q ? 1 : 0) - ('error' in b.q ? 1 : 0) || (('amount' in a.q ? a.q.amount : 0) - ('amount' in b.q ? b.q.amount : 0)));
}
