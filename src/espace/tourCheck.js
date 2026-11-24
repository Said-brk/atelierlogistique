// Alerte « tournée » (palettisation → chargement) : jamais bloquante, seulement un avertissement quand les
// destinations ne sont pas toutes dans la même tournée. Sans tournée paramétrée : aucune alerte.

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
  const parts = [...byTour.entries()].map(([t, ds]) => `${t ? `${name[t] ?? t} (${t})` : 'hors tournée'} : ${ds.join(', ')}`);
  return `Les destinations ne font pas partie d’une même tournée :\n• ${parts.join('\n• ')}\n\nVoulez-vous quand même continuer ?`;
}
