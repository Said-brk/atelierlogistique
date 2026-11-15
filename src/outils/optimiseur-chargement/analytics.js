// Suivi analytics minimal et anonyme. S'appuie sur un système déjà présent
// (gtag ou Plausible) s'il existe ; sinon no-op. On n'envoie jamais les
// références ni les dimensions saisies — uniquement des métriques agrégées.
export function track(event, payload = {}) {
  try {
    if (typeof window === 'undefined') return;
    if (typeof window.gtag === 'function') {
      window.gtag('event', event, payload);
    } else if (typeof window.plausible === 'function') {
      window.plausible(event, { props: payload });
    }
  } catch {
    /* le suivi ne doit jamais casser l'outil */
  }
}
