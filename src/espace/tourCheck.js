// Alerte « tournée » (palettisation → chargement) : jamais bloquante, seulement un avertissement quand les
// destinations ne sont pas toutes dans la même tournée. Sans tournée paramétrée : aucune alerte.
import { t as tr, numLocale } from '../shared/i18n/core';

/** Message d'alerte, ou null si tout est dans une même tournée (ou si aucune tournée n'est paramétrée). */
export function tourWarning(destinations, refs) {
  const tours = refs?.tours ?? [];
  if (!tours.length) return null;
  const agency = new Map((refs.agencies ?? []).map((a) => [a.code, a]));
  const name = Object.fromEntries(tours.map((t) => [t.code, t.label]));
  const byTour = new Map(); // tour (ou '') → destinations
  for (const d of new Set(destinations.map((x) => String(x ?? '').trim()).filter(Boolean))) {
    const t = agency.get(d)?.tour ?? '';
    byTour.set(t, [...(byTour.get(t) ?? []), d]);
  }
  if (byTour.size <= 1 && !byTour.has('')) return null;
  if (byTour.size === 1 && byTour.has('')) return null; // aucune destination rattachée à une tournée : rien à signaler
  const parts = [...byTour.entries()].map(([t, ds]) => `${t ? `${name[t] ?? t} (${t})` : tr('hors tournée')} : ${ds.join(', ')}`);
  return `${tr('Les destinations ne font pas partie d’une même tournée :')}\n• ${parts.join('\n• ')}\n\n${tr('Voulez-vous quand même continuer ?')}`;
}

// ---------------------------------------------------------------- Titre d'un chargement d'après sa tournée
const fmtDay = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString(numLocale(), { timeZone: 'UTC' }) : '');

/** « Tournée T01 – 25/11/2026 » ; plusieurs tournées : « Tournée T01/T02 – … ». null sans tournée. */
export function tourTitle(codes, day) {
  const c = [...new Set((codes ?? []).map((x) => String(x ?? '').trim()).filter(Boolean))];
  if (!c.length) return null;
  return `${tr('Tournée {codes}', { codes: c.join('/') })}${day ? ` – ${fmtDay(day)}` : ''}`;
}

/** Titre généré (vide, par défaut ou déjà « Tournée … ») : on peut le remplacer sans écraser une saisie. */
export const isAutoTitle = (label) => !String(label ?? '').trim() || /^(Tournée |Chargement du |Chargement — |Regroupement |Route |Load of |Load — |Consolidation )/.test(label);
