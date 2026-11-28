import { t as tr } from '../i18n/core';
import { currencySymbol } from '../units/units';
import { usableTariff, zoneIndex, tariffPrice, type Tariff, type TariffBasis } from './tariff';
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
  /**
   * Grille : chaque ligne vise une agence, une tournée ou une zone tarifaire (choisies dans les listes) et remplace
   * le tarif de base. Priorité pour une destination : agence > tournée > zone > tarif de base.
   * (Anciennes lignes { zone, rate } = portée « zone ».)
   */
  zones?: GridLine[] | null;
  /** Frais par arrêt supplémentaire (€), au-delà du premier. */
  stopFee?: number | null;
  /** Grille zones × tranches (src/shared/carriers/tariff.ts) : remplace tarif de base et lignes de grille. */
  tariff?: Tariff | null;
}

export type Scope = 'agency' | 'tour' | 'zone';
export interface GridLine { scope?: Scope; key?: string; zone?: string; rate: number | null }
export const SCOPE_LABELS: Record<Scope, string> = { get agency() { return tr('Agence'); }, get tour() { return tr('Tournée'); }, get zone() { return tr('Zone'); } };

/** Une destination du chargement : agence, sa tournée et sa zone tarifaire. */
export interface Dest {
  agency: string; tour: string | null; zone: string | null;
  /** Code postal de l'agence (zone de la grille zones × tranches). */
  postal?: string | null;
  /** Marchandises de cette destination (d'après les lignes) : poids kg, volume m³, surface au sol m², palettes. */
  load?: { weightKg: number; volumeM3: number; floorM2: number; pallets: number; units: number };
}

/** Ce qu'il faut savoir du chargement (résumé du plan). */
export interface LoadFacts {
  ldm: number | null;
  weightKg: number;
  volumeM3: number;
  units: number;
  /** Palettes chargées (colis ≥ 0,3 m² au sol) ; null = résumé ancien (avant comptage). */
  pallets?: number | null;
  vehicles: { code: string; label: string; count: number }[];
  /** Destinations (agences) avec tournée et zone ; vide = inconnues. */
  dests?: Dest[];
  /** Zones seules (compatibilité). */
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
  /** Tarif retenu et ligne de grille qui le fixe (« Tournée T01 », « Zone 69 »…). */
  rate?: number;
  zone?: string | null;
  /** Frais d'arrêts supplémentaires. */
  stopsFee?: number;
  /** Surcharge gazole appliquée (%) et son mois. */
  fuelPct?: number;
  fuelMonth?: string | null;
  /** Grille zones × tranches : détail par destination (ou une ligne pour le chargement entier). */
  byDest?: { agency: string; zone: string; qty: number; unit: string; price: number; minApplied: boolean }[];
  /** Grille zones × tranches : par destination (messagerie) ou chargement entier (affrètement). */
  mode?: 'per_dest' | 'whole';
}

export type QuoteResult = Quote | { error: string };

// Libellés traduits à la lecture (langue de l'interface).
export const BILLING_LABELS: Record<Billing, string> = {
  get ldm() { return tr('Au mètre plancher (MPL)'); },
  get pallet() { return tr('À la palette / unité'); },
  get weight() { return tr('Aux 100 kg taxables'); },
  get ftl() { return tr('Forfait par véhicule (lot complet)'); },
};
// Unités des tarifs, avec le symbole de la devise de l'entreprise (la facturation reste au MPL, à la palette ou aux 100 kg).
export const RATE_UNIT: Record<Billing, string> = { get ldm() { return `${currencySymbol()}/${tr('MPL')}`; }, get pallet() { return `${currencySymbol()}/${tr('palette')}`; }, get weight() { return `${currencySymbol()}/100 kg`; }, ftl: '' };

const num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const r2 = (v: number) => Math.round(v * 100) / 100;
/** Arrondi supérieur au pas (évite 2,1000000001 → 2,2). */
const ceilTo = (v: number, step: number) => Math.ceil(Math.round((v / step) * 1e6) / 1e6) * step;

const up = (v: unknown) => String(v ?? '').trim().toUpperCase();
const lineOf = (l: GridLine): { scope: Scope; key: string } => ({ scope: l.scope ?? 'zone', key: up(l.key ?? l.zone) });

/** Tarif d'une destination : agence > tournée > zone > tarif de base. */
function destRate(grid: Map<string, number>, base: number | null, d: Dest): { rate: number; via: string | null } | null {
  for (const [scope, key] of [['agency', d.agency], ['tour', d.tour], ['zone', d.zone]] as [Scope, string | null][]) {
    const r = key ? grid.get(`${scope}:${up(key)}`) : undefined;
    if (r != null) return { rate: r, via: `${SCOPE_LABELS[scope]} ${up(key)}` };
  }
  return base == null ? null : { rate: base, via: null };
}

/** Tarif applicable : la destination la plus chère (grille), sinon tarif de base. */
export function rateFor(c: CarrierData, dests: Dest[] = []): { rate: number; zone: string | null } | { error: string } {
  const grid = new Map<string, number>();
  for (const l of c.zones ?? []) { const { scope, key } = lineOf(l); if (key && l.rate != null && Number.isFinite(Number(l.rate))) grid.set(`${scope}:${key}`, Number(l.rate)); }
  const base = c.rate == null || (c.rate as unknown) === '' ? null : Number(c.rate);
  if (!grid.size) return base == null ? { error: tr('Tarif manquant pour ce transporteur.') } : { rate: base, zone: null };
  let best: { rate: number; zone: string | null } | null = null;
  for (const d of dests) {
    const r = destRate(grid, base, d);
    if (!r) return { error: tr('{agency} : ni agence, ni tournée, ni zone dans la grille de ce transporteur.', { agency: d.agency }) };
    if (!best || r.rate > best.rate) best = { rate: r.rate, zone: r.via };
  }
  if (best) return best;
  return base == null ? { error: tr('Destinations inconnues : choisissez les agences dans les lignes.') } : { rate: base, zone: null };
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

/** Quantité facturée d'une charge selon la base : kg taxables (tranche), unités facturées, libellé. */
function basisQty(basis: TariffBasis, l: { weightKg: number; volumeM3: number; ldm: number | null; pallets: number | null; units: number }, c: CarrierData) {
  if (basis === 'weight') {
    const kg = Math.max(l.weightKg, l.volumeM3 * num(c.kgPerM3, 0), l.ldm == null ? 0 : l.ldm * num(c.kgPerLdm, 0));
    const kgR = Math.round(kg);
    return { qty: kgR, units: Math.ceil(kgR / 100), unit: 'kg', by: (kg === l.weightKg ? 'real' : l.ldm != null && kg === l.ldm * num(c.kgPerLdm, 0) ? 'floor' : 'volume') as 'real' | 'floor' | 'volume' };
  }
  if (basis === 'pallet') {
    const n = l.pallets == null ? l.units : l.pallets > 0 ? l.pallets : (l.ldm ? Math.ceil(Math.round((l.ldm / 0.4) * 1e6) / 1e6) : 0);
    return { qty: n, units: n, unit: n > 1 ? tr('palettes') : tr('palette') };
  }
  if (l.ldm == null) return null;
  const q = r2(ceilTo(l.ldm, 0.1));
  return { qty: q, units: q, unit: tr('MPL') };
}

/** Part de chaque destination dans le chargement (lignes), ramenée aux totaux du plan. */
function destLoads(facts: LoadFacts, dests: Dest[]) {
  const tot = { weightKg: facts.weightKg, volumeM3: facts.volumeM3, ldm: facts.ldm, pallets: facts.pallets ?? null, units: facts.units };
  if (dests.length <= 1) return dests.map(() => tot);
  const sum = (k: 'weightKg' | 'volumeM3' | 'floorM2' | 'pallets' | 'units') => dests.reduce((a, d) => a + (d.load?.[k] ?? 0), 0);
  const S = { weightKg: sum('weightKg'), volumeM3: sum('volumeM3'), floorM2: sum('floorM2'), pallets: sum('pallets'), units: sum('units') };
  const share = (d: Dest, k: keyof typeof S) => (S[k] > 0 ? (d.load?.[k] ?? 0) / S[k] : 1 / dests.length);
  return dests.map((d) => ({
    weightKg: tot.weightKg * share(d, 'weightKg'),
    volumeM3: tot.volumeM3 * share(d, 'volumeM3'),
    ldm: tot.ldm == null ? null : tot.ldm * share(d, 'floorM2'),
    pallets: tot.pallets == null ? null : Math.round(tot.pallets * share(d, 'pallets')),
    units: Math.round(tot.units * share(d, 'units')),
  }));
}

/** Devis avec une grille zones × tranches. */
function tariffQuote(facts: LoadFacts, c: CarrierData, t: Tariff): QuoteResult {
  const basis = c.billing as TariffBasis;
  const dests = facts.dests ?? [];
  if (!dests.length) return { error: tr('Destinations inconnues : choisissez les agences dans les lignes.') };
  const zoneOf = (d: Dest) => zoneIndex(t, d.postal, d.zone);
  for (const d of dests) {
    if (zoneOf(d) < 0) {
      const who = d.agency || d.tour || tr('Chargement');
      return { error: d.zone
        ? tr('{agency} : zone {z} absente de la grille de ce transporteur.', { agency: who, z: d.zone })
        : tr('{agency} : pas de zone. Choisissez la zone de l’agence (Paramètres › Agences) ou celle du chargement.', { agency: who }) };
    }
  }
  const minOf = (z: number) => { const m = t.min?.[z]; return m != null && Number.isFinite(Number(m)) ? Number(m) : num(c.minCharge); };
  const byDest: NonNullable<Quote['byDest']> = [];
  let base = 0; let qty = 0; let unit = ''; let taxable: Quote['taxable'];
  if (t.mode === 'whole') {
    const b = basisQty(basis, { ...facts, pallets: facts.pallets ?? null }, c);
    if (!b) return { error: tr('Mètres plancher non calculés : lancez le calcul du plan.') };
    let best: { z: number; price: number; min: boolean } | null = null;
    for (const d of dests) {
      const z = zoneOf(d);
      const p = tariffPrice(t, z, b.qty, b.units, basis);
      if ('error' in p) return p;
      const m = minOf(z); const price = Math.max(p.price, m);
      if (!best || price > best.price) best = { z, price, min: m > p.price };
    }
    base = best!.price; qty = b.qty; unit = b.unit;
    if (basis === 'weight') taxable = { kg: b.qty, by: (b as { by: 'real' | 'floor' | 'volume' }).by };
    byDest.push({ agency: dests.length > 1 ? tr('{n} destinations', { n: dests.length }) : (dests[0].agency || dests[0].tour || ''), zone: t.zones[best!.z].code, qty: b.qty, unit: b.unit, price: r2(best!.price), minApplied: best!.min });
  } else {
    const loads = destLoads(facts, dests);
    for (let i = 0; i < dests.length; i += 1) {
      const d = dests[i]; const z = zoneOf(d);
      const b = basisQty(basis, loads[i], c);
      if (!b) return { error: tr('Mètres plancher non calculés : lancez le calcul du plan.') };
      const p = tariffPrice(t, z, b.qty, b.units, basis);
      if ('error' in p) return { error: `${d.agency || d.tour || ''} : ${p.error}` };
      const m = minOf(z); const price = Math.max(p.price, m);
      byDest.push({ agency: d.agency || d.tour || '', zone: t.zones[z].code, qty: b.qty, unit: b.unit, price: r2(price), minApplied: m > p.price });
      base += price; qty += b.qty; unit = b.unit;
    }
    if (basis === 'weight') taxable = { kg: qty, by: 'real' };
  }
  const stopsFee = t.mode === 'whole' ? r2(Math.max(0, (facts.stops ?? 1) - 1) * num(c.stopFee)) : 0;
  base = r2(base + stopsFee);
  const f = fuelFor(c, facts.month);
  const fuel = r2(base * f.pct / 100);
  const zones = [...new Set(byDest.map((x) => x.zone))];
  return {
    basis: c.billing, qty: r2(qty), unit, base, minApplied: byDest.some((x) => x.minApplied), fuel, amount: r2(base + fuel), taxable,
    zone: zones.length === 1 ? zones[0] : tr('{n} zones', { n: zones.length }), stopsFee, fuelPct: f.pct, fuelMonth: f.month, byDest, mode: t.mode,
  };
}

export function quote(facts: LoadFacts, c: CarrierData): QuoteResult {
  if (c.billing !== 'ftl' && usableTariff(c.tariff)) return tariffQuote(facts, c, c.tariff);
  let rate = 0; let zone: string | null = null;
  if (c.billing !== 'ftl') {
    const rf = rateFor(c, facts.dests ?? (facts.zones ?? []).map((z) => ({ agency: z, tour: null, zone: z })));
    if ('error' in rf) return rf;
    ({ rate, zone } = rf);
  }
  let qty = 0; let unit = ''; let base = 0;
  let taxable: Quote['taxable']; let lines: Quote['lines'];
  switch (c.billing) {
    case 'ldm': {
      if (facts.ldm == null) return { error: tr('Mètres plancher non calculés : lancez le calcul du plan.') };
      qty = r2(ceilTo(facts.ldm, 0.1)); unit = tr('MPL'); base = qty * rate; break;
    }
    case 'pallet': {
      // Palettes chargées ; sans palette (cartons seuls) : équivalent palettes au sol (MPL ÷ 0,4) ; ancien résumé : unités.
      if (facts.pallets == null) { qty = facts.units; unit = qty > 1 ? tr('palettes') : tr('palette'); }
      else if (facts.pallets > 0) { qty = facts.pallets; unit = qty > 1 ? tr('palettes') : tr('palette'); }
      else { qty = facts.ldm ? Math.ceil(Math.round((facts.ldm / 0.4) * 1e6) / 1e6) : 0; unit = tr('équiv. palettes'); }
      base = qty * rate; break;
    }
    case 'weight': {
      const real = facts.weightKg;
      const vol = facts.volumeM3 * num(c.kgPerM3, 0);
      const floor = facts.ldm == null ? 0 : facts.ldm * num(c.kgPerLdm, 0);
      const kg = Math.max(real, vol, floor);
      taxable = { kg: Math.round(kg), by: kg === real ? 'real' : kg === floor ? 'floor' : 'volume' };
      qty = Math.ceil(Math.round(kg) / 100); unit = tr('× 100 kg'); base = qty * rate; break;
    }
    case 'ftl': {
      if (!facts.vehicles.length) return { error: tr('Aucun véhicule : lancez le calcul du plan.') };
      lines = [];
      for (const v of facts.vehicles) {
        const p = c.prices?.[v.code];
        if (p == null || !Number.isFinite(Number(p))) return { error: tr('Pas de forfait pour « {v} » chez ce transporteur.', { v: v.label }) };
        lines.push({ label: v.label, count: v.count, price: Number(p) });
      }
      qty = lines.reduce((s, l) => s + l.count, 0); unit = qty > 1 ? tr('véhicules') : tr('véhicule');
      base = lines.reduce((s, l) => s + l.count * l.price, 0); break;
    }
    default: return { error: tr('Mode de facturation inconnu.') };
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
    pallets: summary.pallets == null ? null : num(summary.pallets),
    vehicles: Array.isArray(summary.vehicles) ? (summary.vehicles as LoadFacts['vehicles']) : [],
    dests: extra.dests ?? [], stops: extra.stops ?? 1, month: extra.month ?? null,
  };
}

/** Zones et arrêts d'un chargement d'après ses lignes (destination = code agence). */
type RouteRow = { destination?: string | null; quantity?: number; length?: number; width?: number; height?: number; weight?: number };
export function routeOf(rows: RouteRow[] | null | undefined, agencies: { code: string; zone?: string | null; tour?: string | null; postalCode?: string | null }[]) {
  const live = (rows ?? []).filter((r) => (r.quantity ?? 1) > 0);
  const codes = [...new Set(live.map((r) => String(r.destination ?? '').trim()).filter(Boolean))];
  const by = new Map(agencies.map((a) => [a.code.toUpperCase(), a]));
  // Marchandises par destination (cm, kg) : pour facturer chaque destination à part (grille zones × tranches).
  const loads = new Map<string, NonNullable<Dest['load']>>();
  for (const r of live) {
    const k = String(r.destination ?? '').trim().toUpperCase();
    if (!k) continue;
    const q = r.quantity ?? 1; const L = num(r.length); const W = num(r.width); const H = num(r.height);
    const l = loads.get(k) ?? { weightKg: 0, volumeM3: 0, floorM2: 0, pallets: 0, units: 0 };
    l.weightKg += q * num(r.weight); l.volumeM3 += (q * L * W * H) / 1e6; l.floorM2 += (q * L * W) / 1e4; l.units += q;
    if ((L * W) / 1e4 >= 0.3) l.pallets += q;
    loads.set(k, l);
  }
  const dests: Dest[] = codes.map((c) => {
    const a = by.get(c.toUpperCase());
    return { agency: a?.code ?? c, tour: a?.tour ?? null, zone: a?.zone ?? null, postal: a?.postalCode ?? null, load: loads.get(c.toUpperCase()) };
  });
  return { dests, stops: Math.max(1, codes.length) };
}

/** Devis de tous les transporteurs, du moins cher au plus cher (erreurs en dernier). */
export function rankCarriers(facts: LoadFacts, carriers: { code: string; label: string; data: CarrierData }[]) {
  return carriers.map((c) => ({ code: c.code, label: c.label, q: quote(facts, c.data) }))
    .sort((a, b) => ('error' in a.q ? 1 : 0) - ('error' in b.q ? 1 : 0) || (('amount' in a.q ? a.q.amount : 0) - ('amount' in b.q ? b.q.amount : 0)));
}
