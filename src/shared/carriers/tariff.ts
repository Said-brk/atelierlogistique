// Grille tarifaire « zones × tranches » d'un transporteur (messagerie, groupage, affrètement).
//
//  • Zones : celles de Paramètres › Zones (table de référence, comme les tournées). Chaque agence a sa zone ;
//    à défaut, la zone choisie sur le chargement. (Anciennes grilles : motifs de départements / codes
//    postaux encore reconnus.)
//  • Tranches : selon la base de facturation du transporteur — poids taxable (kg), palettes ou MPL.
//    Prix d'une case : aux 100 kg / à la palette / au MPL, ou forfait de la tranche.
//  • Minimum de perception par zone.
//  • Calcul : par destination (messagerie : chaque destination facturée à part, puis additionnée)
//    ou sur le chargement entier (affrètement : zone la plus chère des destinations).

import { t as tr } from '../i18n/core';

export type TariffMode = 'per_dest' | 'whole';
export interface TariffZone { code: string; match: string }
export interface TariffBand { upTo: number | null; prices: (number | null)[]; flat?: boolean }
export interface Tariff { mode: TariffMode; zones: TariffZone[]; bands: TariffBand[]; min?: (number | null)[] }

export const usableTariff = (t: Tariff | null | undefined): t is Tariff => !!t && Array.isArray(t.zones) && t.zones.length > 0 && Array.isArray(t.bands) && t.bands.length > 0;

// ---------------------------------------------------------------- Départements et régions (France)
const R: Record<string, string> = {
  'ile-de-france': '75 77 78 91 92 93 94 95',
  'centre-val de loire': '18 28 36 37 41 45',
  'bourgogne-franche-comte': '21 25 39 58 70 71 89 90',
  normandie: '14 27 50 61 76',
  'hauts-de-france': '02 59 60 62 80',
  'grand est': '08 10 51 52 54 55 57 67 68 88',
  'pays de la loire': '44 49 53 72 85',
  bretagne: '22 29 35 56',
  'nouvelle-aquitaine': '16 17 19 23 24 33 40 47 64 79 86 87',
  occitanie: '09 11 12 30 31 32 34 46 48 65 66 81 82',
  'auvergne-rhone-alpes': '01 03 07 15 26 38 42 43 63 69 73 74',
  "provence-alpes-cote d'azur": '04 05 06 13 83 84',
  corse: '2A 2B',
};
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-').trim();
const REGIONS = new Map(Object.entries(R).map(([k, v]) => [norm(k), v.split(' ')]));
export const REGION_NAMES = Object.keys(R);

/** Code postal → département (« 69100 » → « 69 », « 20200 » → « 2B », « 97400 » → « 974 »). */
export function deptOf(postal: string | null | undefined): string | null {
  const p = String(postal ?? '').replace(/\s/g, '').toUpperCase();
  if (/^2[AB]/.test(p)) return p.slice(0, 2);
  if (!/^\d{5}$/.test(p)) return null;
  if (p.startsWith('20')) return Number(p.slice(0, 3)) < 202 ? '2A' : '2B';
  if (p.startsWith('97') || p.startsWith('98')) return p.slice(0, 3);
  return p.slice(0, 2);
}

/** Motifs d'une zone, régions remplacées par leurs départements. */
export function tokensOf(match: string): string[] {
  const out: string[] = [];
  for (const raw of String(match ?? '').split(/[,;\n]+/)) {
    const t = raw.trim();
    if (!t) continue;
    const reg = REGIONS.get(norm(t));
    if (reg) out.push(...reg);
    else out.push(...t.split(/\s+/).filter(Boolean).map((x) => x.toUpperCase()));
  }
  return out;
}

/** Précision du motif pour ce code postal (0 = ne correspond pas ; « * » = 0,5). */
function score(token: string, postal: string, dept: string | null): number {
  if (token === '*') return 0.5;
  const range = /^(\d+)-(\d+)$/.exec(token);
  if (range) {
    const [a, b] = [range[1], range[2]];
    if (a.length !== b.length) return 0;
    const v = Number(postal.slice(0, a.length));
    return /^\d+$/.test(postal) && v >= Number(a) && v <= Number(b) ? a.length : 0;
  }
  if (/^2[AB]$/.test(token)) return dept === token ? 2 : 0;
  if (!/^\d+$/.test(token)) return 0;
  return postal.startsWith(token) ? token.length : 0;
}

/** Zone (index) d'une destination : zone forcée sur l'agence, sinon d'après son code postal. */
export function zoneIndex(t: Tariff, postal: string | null | undefined, forced?: string | null): number {
  const f = String(forced ?? '').trim().toUpperCase();
  if (f) { const i = t.zones.findIndex((z) => z.code.trim().toUpperCase() === f); if (i >= 0) return i; }
  const p = String(postal ?? '').replace(/\s/g, '').toUpperCase();
  if (!p) return t.zones.findIndex((z) => tokensOf(z.match).includes('*'));
  const dept = deptOf(p);
  let best = -1; let bestScore = 0;
  t.zones.forEach((z, i) => {
    for (const tok of tokensOf(z.match)) { const s = score(tok, p, dept); if (s > bestScore) { bestScore = s; best = i; } }
  });
  return best;
}

export type TariffBasis = 'weight' | 'pallet' | 'ldm';
/** Prix d'une quantité dans une zone (qty en kg taxables, palettes ou MPL ; units = nombre d'unités facturées). */
export function tariffPrice(t: Tariff, zone: number, qty: number, units: number, basis: TariffBasis):
  { price: number; band: number; perUnit: number | null } | { error: string } {
  const band = t.bands.findIndex((b) => b.upTo == null || qty <= Number(b.upTo) + 1e-9);
  if (band < 0) {
    const max = Math.max(...t.bands.map((b) => Number(b.upTo) || 0));
    const u = basis === 'weight' ? 'kg' : basis === 'pallet' ? tr('palettes') : tr('MPL');
    return { error: tr('Au-delà de la grille ({max} {u} au plus).', { max, u }) };
  }
  const p = t.bands[band].prices?.[zone];
  if (p == null || !Number.isFinite(Number(p))) return { error: tr('Pas de tarif dans la grille pour la zone {zone}, tranche {n}.', { zone: t.zones[zone]?.code ?? '?', n: band + 1 }) };
  const flat = !!t.bands[band].flat;
  return { price: flat ? Number(p) : Number(p) * units, band, perUnit: flat ? null : Number(p) };
}

// ---------------------------------------------------------------- Collage depuis Excel / tableau
const numIn = (s: string) => {
  const m = /-?\d+(?:[.,]\d+)?/.exec(s.replace(/(\d)[\s  ](?=\d{3}\b)/g, '$1'));
  return m ? Number(m[0].replace(',', '.')) : null;
};
/** Bornes d'une tranche écrite « 0–99 kg », « 1 000 à 1 999 », « jusqu'à 300 », « plus de 3 000 ». */
export function upperBoundOf(label: string): number | null {
  const s = label.replace(/(\d)[\s  ](?=\d{3}\b)/g, '$1');
  if (/plus de|au-del|>|over|above|\+\s*$/i.test(s)) return null;
  const nums = [...s.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(',', '.')));
  return nums.length ? nums[nums.length - 1] : null;
}

export interface PastedTariff { zones: string[]; bands: TariffBand[]; min: (number | null)[] | null; fuelPct: number | null }
/**
 * Tableau collé (Excel, Google Sheets, CSV « ; » ou tableau Markdown) : 1re ligne = zones,
 * lignes suivantes = tranches ; lignes « Minimum » et « Gazole » reconnues.
 */
export function parseTariffTable(text: string): PastedTariff | { error: string } {
  const lines = String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .filter((l) => !/^\|?\s*:?-{2,}/.test(l)); // séparateur Markdown
  const cells = lines.map((l) => {
    const sep = l.includes('\t') ? '\t' : l.includes('|') ? '|' : l.includes(';') ? ';' : null;
    let c = sep ? l.split(sep) : l.split(/\s{2,}/);
    if (sep === '|') c = c.slice(l.startsWith('|') ? 1 : 0, l.endsWith('|') ? -1 : undefined);
    return c.map((x) => x.trim());
  });
  if (cells.length < 2 || cells[0].length < 2) return { error: tr('Collez au moins une ligne d’en-tête (zones) et une ligne de tranche.') };
  const zones = cells[0].slice(1).filter(Boolean);
  const bands: TariffBand[] = []; let min: (number | null)[] | null = null; let fuelPct: number | null = null;
  for (const row of cells.slice(1)) {
    const label = row[0] ?? '';
    const vals = zones.map((_, i) => numIn(row[i + 1] ?? ''));
    if (/minimum|mini\b|min\.|perception/i.test(label)) { min = vals; continue; }
    if (/gazole|gasoil|fuel|carburant/i.test(label)) { fuelPct = vals.find((v) => v != null) ?? null; continue; }
    bands.push({ upTo: upperBoundOf(label), prices: vals, flat: /forfait|flat/i.test(label) });
  }
  if (!bands.length) return { error: tr('Aucune tranche reconnue dans le tableau collé.') };
  // Une seule tranche sans borne au milieu : seule la dernière peut être « au-delà ».
  for (let i = 0; i < bands.length - 1; i += 1) if (bands[i].upTo == null) return { error: tr('Tranche {n} sans borne : seule la dernière peut être « au-delà ».', { n: i + 1 }) };
  return { zones, bands, min, fuelPct };
}
