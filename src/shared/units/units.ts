// Devise et système d'unités de l'entreprise (Paramètres › Entreprise).
// Les données restent stockées en métrique (mm, cm, kg, m³, mètres plancher) et en montants bruts :
// seules la saisie et l'affichage changent. Comme la langue, l'état est global (setUnits au rendu de
// l'Espace) pour servir aussi hors composants (exports CSV, messages).
import { numLocale, type Lang } from '../i18n/core';

export type UnitSystem = 'metric' | 'imperial';
export type UnitsPrefs = { units: UnitSystem; currency: string };

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CAD', 'CHF', 'MAD'] as const;
export const UNIT_SYSTEMS: UnitSystem[] = ['metric', 'imperial'];

/** Réglages par défaut selon la langue : anglais → unités US et dollar ; français → métrique et euro. */
export const defaultUnits = (lang: Lang): UnitsPrefs => (lang === 'en' ? { units: 'imperial', currency: 'USD' } : { units: 'metric', currency: 'EUR' });

let current: UnitsPrefs = { units: 'metric', currency: 'EUR' };
const isSystem = (v: unknown): v is UnitSystem => v === 'metric' || v === 'imperial';
const isCurrency = (v: unknown): v is string => typeof v === 'string' && /^[A-Z]{3}$/.test(v);

/** Réglages d'une entreprise (colonnes absentes : valeurs par défaut de la langue). */
export function prefsOf(org: { units?: unknown; currency?: unknown } | null | undefined, lang: Lang): UnitsPrefs {
  const d = defaultUnits(lang);
  return { units: isSystem(org?.units) ? org!.units as UnitSystem : d.units, currency: isCurrency(org?.currency) ? org!.currency as string : d.currency };
}
export const setUnits = (p: UnitsPrefs) => { current = p; };
export const getUnits = (): UnitsPrefs => current;
export const imperial = () => current.units === 'imperial';

// ---------------------------------------------------------------- Conversions
const IN_PER_CM = 1 / 2.54;
const LB_PER_KG = 2.20462262;
const FT_PER_M = 3.2808399;
const FT3_PER_M3 = 35.3146667;

const round = (v: number, d: number) => { const p = 10 ** d; return Math.round(v * p) / p; };

/** Dimensions de colis / palettes : saisies en cm (métrique) ou en pouces (US). */
export const dimUnit = () => (imperial() ? 'in' : 'cm');
export const cmToDim = (cm: number) => (imperial() ? round(cm * IN_PER_CM, 2) : cm);
export const dimToCm = (v: number) => (imperial() ? round(v / IN_PER_CM, 3) : v);

/** Poids : kg ou livres. */
export const weightUnit = () => (imperial() ? 'lb' : 'kg');
export const kgToW = (kg: number) => (imperial() ? kg * LB_PER_KG : kg);
export const wToKg = (v: number) => (imperial() ? v / LB_PER_KG : v);

/** Grandes longueurs (véhicules, plancher) : mètres ou pieds. */
export const lengthUnit = () => (imperial() ? 'ft' : 'm');
export const mToL = (m: number) => (imperial() ? m * FT_PER_M : m);

/** Volumes : m³ ou pieds cubes. */
export const volumeUnit = () => (imperial() ? 'ft³' : 'm³');
export const m3ToV = (m3: number) => (imperial() ? m3 * FT3_PER_M3 : m3);

// ---------------------------------------------------------------- Formats (nombre + unité)
const n = (v: number, d = 0, min = 0) => v.toLocaleString(numLocale(), { minimumFractionDigits: min, maximumFractionDigits: d });
const sp = ' ';

export const fmtWeight = (kg: number | null | undefined, d = 0) => (kg == null || !Number.isFinite(Number(kg)) ? '—' : `${n(kgToW(Number(kg)), d)}${sp}${weightUnit()}`);
export const fmtVolume = (m3: number | null | undefined, d = 1) => (m3 == null || !Number.isFinite(Number(m3)) ? '—' : `${n(m3ToV(Number(m3)), d)}${sp}${volumeUnit()}`);
export const fmtLength = (m: number | null | undefined, d = 2) => (m == null || !Number.isFinite(Number(m)) ? '—' : `${n(mToL(Number(m)), d)}${sp}${lengthUnit()}`);
/** Dimension (cm stockés) avec l'unité de saisie. */
export const fmtDim = (cm: number | null | undefined, d = 1) => (cm == null || !Number.isFinite(Number(cm)) ? '—' : `${n(cmToDim(Number(cm)), d)}${sp}${dimUnit()}`);

/** Montant dans la devise de l'entreprise (2 décimales max., 0 si entier par défaut). */
export function fmtMoney(v: number | null | undefined, opts: { min?: number; max?: number } = {}): string {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const { min = 0, max = 2 } = opts;
  try {
    return new Intl.NumberFormat(numLocale(), { style: 'currency', currency: current.currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: min, maximumFractionDigits: max }).format(Number(v));
  } catch {
    return `${n(Number(v), max, min)}${sp}${current.currency}`;
  }
}

/** Symbole de la devise (€, $, £…). */
export function currencySymbol(code = current.currency): string {
  try {
    return new Intl.NumberFormat(numLocale(), { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? code;
  } catch { return code; }
}

/** Lit un nombre saisi (montant, mesure) : « 1 234,50 », « 1,234.50 », « 685,4 € », « $685.40 ». null si vide. */
export function parseNumber(raw: unknown): number | null {
  let s = String(raw ?? '').replace(/[^\d,.-]/g, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else s = s.replace(',', '.');
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
}

/** Plancher occupé : mètres plancher (MPL) ou pieds linéaires (US). */
export const ldmUnit = () => (imperial() ? 'lin. ft' : 'MPL');
export const ldmToU = (ldm: number) => (imperial() ? ldm * FT_PER_M : ldm);
