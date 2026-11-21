// Traduction « gettext » : la clé est le texte français lui-même.
//   t('Optimiser le chargement')              → 'Optimise the load' en anglais
//   t('{n} colis chargés', { n: 12 })         → '12 cases loaded'
// En français, la clé est renvoyée telle quelle : l'interface française ne change pas et un
// texte non traduit reste lisible (en français) plutôt que de casser l'écran.
//
// Fonctions pures, sans React : utilisables dans les workers, les exports CSV et les PDF.

export type Lang = 'fr' | 'en';
export type Dict = Record<string, string>;
export type Vars = Record<string, string | number | null | undefined>;

export const LANGS: Lang[] = ['fr', 'en'];
export const DEFAULT_LANG: Lang = 'fr';

const dictionaries: Record<Lang, Dict> = { fr: {}, en: {} };
// Motifs compilés pour retraduire un texte déjà rempli (messages produits par le moteur).
let patterns: { re: RegExp; names: string[]; target: string }[] | null = null;

/** Ajoute des traductions (chaque module apporte son dictionnaire). */
export function registerDictionary(lang: Lang, dict: Dict): void {
  Object.assign(dictionaries[lang], dict);
  patterns = null;
}

export function hasTranslation(lang: Lang, key: string): boolean {
  return lang === 'fr' || Object.prototype.hasOwnProperty.call(dictionaries[lang], key);
}

/** Remplace {nom} par vars.nom. */
export function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}

export function translate(lang: Lang, key: string, vars?: Vars): string {
  const text = lang === 'fr' ? key : (dictionaries[lang][key] ?? key);
  return interpolate(text, vars);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Traduit un texte déjà rempli, par exemple « EUR : 2 palettes » renvoyé par le moteur
 * (calculé en français, parfois dans un worker). Essaie la clé exacte, puis les clés à
 * variables ({x}) comme motifs. Les morceaux séparés par « · » sont traduits un à un.
 */
export function translateText(lang: Lang, text: string): string {
  if (lang === 'fr' || !text) return text;
  const dict = dictionaries[lang];
  if (dict[text] !== undefined) return dict[text];
  if (text.includes(' · ')) {
    const parts = text.split(' · ');
    if (parts.length > 1) return parts.map((p) => translateText(lang, p)).join(' · ');
  }
  if (!patterns) {
    patterns = Object.entries(dict).filter(([k]) => /\{\w+\}/.test(k)).map(([k, target]) => {
      const names: string[] = [];
      const src = k.split(/(\{\w+\})/).map((part) => {
        const m = /^\{(\w+)\}$/.exec(part);
        if (m) { names.push(m[1]); return '(.+?)'; }
        return escapeRe(part);
      }).join('');
      return { re: new RegExp(`^${src}$`), names, target };
    });
  }
  for (const p of patterns) {
    const m = p.re.exec(text);
    if (m) {
      const vars: Vars = {};
      p.names.forEach((n, i) => { vars[n] = translateText(lang, m[i + 1]); });
      return interpolate(p.target, vars);
    }
  }
  return text;
}

// Langue courante de l'application (une seule langue affichée à la fois). Sert aux fonctions
// appelées hors des composants (exports, PDF) ; les composants passent par useT().
let current: Lang = DEFAULT_LANG;
export const setCurrentLang = (lang: Lang) => { current = lang; };
export const getCurrentLang = (): Lang => current;

/** Traduction dans la langue courante (hors composants). */
export const t = (key: string, vars?: Vars) => translate(current, key, vars);
/** Marque un texte à traduire plus tard (listes de constantes) : renvoie la clé telle quelle. */
export const N_ = (key: string) => key;

/** Format des nombres selon la langue (1 234,5 / 1,234.5). */
export const locale = (lang: Lang) => (lang === 'en' ? 'en-GB' : 'fr-FR');
/** Locale de formatage de la langue courante (toLocaleString, dates). */
export const numLocale = () => locale(current);
/** Traduit un texte déjà rempli dans la langue courante (messages du moteur, libellés de schéma). */
export const tText = (s: string) => translateText(current, s);
