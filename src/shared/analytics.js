// Vercel Web Analytics (sans cookie). On ne remonte jamais de donnée client :
// - query string et hash retirés (codes OAuth, filtres, jetons) ;
// - identifiants des documents de l'Espace masqués (/app/chargements/:code → /app/chargements/[id]).
const DOC_ROUTE = /^(\/app\/(?:chargements|palettisations|outils))\/[^/]+/;

export function scrubUrl(raw) {
  try {
    const u = new URL(raw);
    const path = u.pathname.replace(DOC_ROUTE, '$1/[id]');
    return `${u.origin}${path}`;
  } catch {
    return raw;
  }
}

export function beforeSend(event) {
  return { ...event, url: scrubUrl(event.url) };
}
