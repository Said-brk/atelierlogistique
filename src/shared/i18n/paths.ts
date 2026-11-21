// Adresses des pages selon la langue. Les URL anglaises sont celles déjà déclarées à Google.
import type { Lang } from './core';

export const TOOL_PATHS: Record<string, Record<Lang, string>> = {
  'optimiseur-chargement': { fr: '/outils/optimiseur-chargement', en: '/en/truck-load-planner' },
  pallet: { fr: '/outils/pallet', en: '/en/palletizing-calculator' },
};

/** Adresse d'un outil dans une langue (les outils non traduits restent en français). */
export const toolHref = (id: string, lang: Lang): string => TOOL_PATHS[id]?.[lang] ?? `/outils/${id}`;
/** Outil et langue d'une adresse anglaise (/en/truck-load-planner → optimiseur-chargement). */
export const toolFromEnPath = (page: string): string | null =>
  Object.entries(TOOL_PATHS).find(([, p]) => p.en === `/en/${page}`)?.[0] ?? null;
export const homeHref = (lang: Lang) => (lang === 'en' ? '/en' : '/');
