// Langue de l'utilisateur (Espace et pages de compte).
//   1. compte connecté : user_metadata.lang (choisie à l'inscription ou dans Paramètres › Mon compte) ;
//   2. sinon le choix fait dans ce navigateur (sélecteur FR / EN de la page de connexion) ;
//   3. sinon le français (comptes existants : rien ne change sans choix explicite).
// La langue du navigateur sert seulement à pré-sélectionner la page de connexion / inscription.
import { LANGS, DEFAULT_LANG, type Lang } from './core';

const KEY = 'al.lang';
export const LANG_LABELS: Record<Lang, string> = { fr: 'Français', en: 'English' };

const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as string[]).includes(v);

export function browserLang(nav: { language?: string } | undefined = typeof navigator !== 'undefined' ? navigator : undefined): Lang {
  const l = nav?.language?.toLowerCase() ?? '';
  if (!l) return DEFAULT_LANG;
  return l.startsWith('fr') ? 'fr' : 'en';
}

export function storedLang(): Lang | null {
  try { const v = localStorage.getItem(KEY); return isLang(v) ? v : null; } catch { return null; }
}

export function rememberLang(lang: Lang): void {
  try { localStorage.setItem(KEY, lang); } catch { /* stockage indisponible */ }
}

/** Langue à afficher avant connexion (page de connexion / inscription). */
export const guestLang = (): Lang => storedLang() ?? browserLang();

/** Langue enregistrée sur le compte, ou null. */
export function accountLang(user: { user_metadata?: { lang?: unknown } } | null | undefined): Lang | null {
  const v = user?.user_metadata?.lang;
  return isLang(v) ? v : null;
}

/** Langue de l'interface pour un utilisateur connecté. */
export const userLang = (user: { user_metadata?: { lang?: unknown } } | null | undefined): Lang => accountLang(user) ?? storedLang() ?? DEFAULT_LANG;
