/** Normalise un libellé pour comparaison : minuscules, sans accents, espaces simples. */
export function normalizeLabel(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\-./]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convertit un texte en nombre, formats français et anglais :
 * « 1 234,5 », « 1.234,5 », « 1,234.5 », « 12 kg », « 1 200 mm ». NaN si illisible.
 */
export function parseNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  let s = String(v ?? '').replace(/ | /g, ' ').trim();
  if (!s) return NaN;
  s = s.replace(/[^0-9,.\-\s]/g, '').replace(/\s+/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Le dernier séparateur est le séparateur décimal.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

const FALSE_WORDS = ['non', 'no', 'n', 'false', 'faux', '0', 'f'];
const TRUE_WORDS = ['oui', 'yes', 'o', 'y', 'true', 'vrai', '1', 'x'];

/** Booléen tolérant ; null si non reconnu. */
export function parseBoolean(v: unknown): boolean | null {
  const k = normalizeLabel(v);
  if (TRUE_WORDS.includes(k)) return true;
  if (FALSE_WORDS.includes(k)) return false;
  return null;
}
