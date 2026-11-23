// Brouillon local des outils publics (sans compte) : la saisie et le dernier calcul sont gardés dans
// CE navigateur (localStorage), pour retrouver son chargement en revenant sur la page. Rien n'est envoyé.
// Même contrat que l'espace connecté : { initial, onChange(snapshot) } (cf. prop `workspace` des outils).

import { useCallback, useEffect, useMemo, useRef } from 'react';

const MAX_AGE_MS = 30 * 864e5; // un brouillon de plus de 30 jours est oublié

function read(key) {
  try {
    const d = JSON.parse(localStorage.getItem(key) ?? 'null');
    return d && Date.now() - (d.savedAt ?? 0) < MAX_AGE_MS ? d : {};
  } catch { return {}; }
}

function write(key, snap) {
  if (!snap) return;
  const { summary, ...rest } = snap; // le résumé se recalcule
  try { localStorage.setItem(key, JSON.stringify({ ...rest, savedAt: Date.now() })); } catch {
    // Stockage plein (gros plan) : on garde au moins la saisie.
    try { const { plan, ...input } = rest; localStorage.setItem(key, JSON.stringify({ ...input, savedAt: Date.now() })); } catch { /* indisponible */ }
  }
}

/** enabled = false : pas de brouillon (outil intégré à l'espace, qui enregistre en base). */
export default function useLocalDraft(key, enabled = true) {
  const initial = useMemo(() => (enabled ? read(key) : null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const last = useRef(null);
  const timer = useRef(null);
  const flush = useCallback(() => { clearTimeout(timer.current); timer.current = null; write(key, last.current); }, [key]);
  const onChange = useCallback((snap) => {
    last.current = snap;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  }, [flush]);
  // En quittant la page ou l'outil : on écrit tout de suite ce qui restait en attente.
  useEffect(() => {
    if (!enabled) return undefined;
    const onHide = () => { if (timer.current) flush(); };
    window.addEventListener('pagehide', onHide);
    return () => { window.removeEventListener('pagehide', onHide); onHide(); };
  }, [enabled, flush]);
  return enabled ? { initial, onChange } : null;
}
