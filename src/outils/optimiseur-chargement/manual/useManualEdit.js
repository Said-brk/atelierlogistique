// État du mode « modifier à la main » : plan modifié, zone d'attente, annuler / rétablir.
// Repart du plan calculé à chaque nouveau calcul. Réutilisable par tout outil qui affiche un plan
// (camion, palette) : il suffit du contenant, des colis placés et des règles par colis.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { moveItem, dropAt, settleItem, rotateItem, removeItem, findSpot, checkPlan, DEFAULT_RULES } from './editPlan';

const MAX_HISTORY = 100;
const fresh = (placed) => ({ placed: placed ?? [], staged: [], touched: new Set() });

export default function useManualEdit(container, basePlaced, rulesOf = () => DEFAULT_RULES) {
  // h.cur = plan affiché ; h.past / h.future = historique (annuler / rétablir).
  const [h, setH] = useState(() => ({ cur: fresh(basePlaced), past: [], future: [] }));
  const [selectedId, setSelectedId] = useState(null);

  // Nouveau calcul : on oublie les modifications.
  useEffect(() => { setH({ cur: fresh(basePlaced), past: [], future: [] }); setSelectedId(null); }, [basePlaced]);

  const commit = useCallback((fn) => setH((s) => {
    const next = fn(s.cur);
    if (!next || next === s.cur) return s;
    return { cur: next, past: [...s.past.slice(-MAX_HISTORY + 1), s.cur], future: [] };
  }), []);

  const touch = (c, id, placed, extra = {}) => ({ ...c, placed, touched: new Set([...c.touched, id]), ...extra });

  const actions = useMemo(() => ({
    move: (id, dx, dy, dz) => commit((c) => touch(c, id, moveItem(container, c.placed, id, dx, dy, dz))),
    dropAt: (id, x, y) => commit((c) => touch(c, id, dropAt(container, c.placed, id, x, y))),
    settle: (id) => commit((c) => touch(c, id, settleItem(c.placed, id))),
    rotate: (id) => commit((c) => {
      const it = c.placed.find((p) => p.id === id);
      if (!it || !rulesOf(it).canRotate) return c;
      return touch(c, id, rotateItem(container, c.placed, id));
    }),
    remove: (id) => commit((c) => {
      const { placed, removed } = removeItem(c.placed, id);
      return removed ? { ...c, placed, staged: [...c.staged, removed] } : c;
    }),
    undo: () => setH((s) => (s.past.length ? { cur: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.cur, ...s.future] } : s)),
    redo: () => setH((s) => (s.future.length ? { cur: s.future[0], past: [...s.past, s.cur], future: s.future.slice(1) } : s)),
    reset: () => { setH({ cur: fresh(basePlaced), past: [], future: [] }); setSelectedId(null); },
    /** Recharge des retouches enregistrées ({ placed, staged, touched[] }) ; « Annuler » revient au plan calculé. */
    load: (saved) => {
      if (!saved?.placed) return;
      setH({ cur: { placed: saved.placed, staged: saved.staged ?? [], touched: new Set(saved.touched ?? []) }, past: [fresh(basePlaced)], future: [] });
      setSelectedId(null);
    },
  }), [commit, container, rulesOf, basePlaced]);

  /** Replace un colis de la zone d'attente à la première place libre. Renvoie false s'il n'y en a pas. */
  const restore = useCallback((id) => {
    const it = h.cur.staged.find((s) => s.id === id); if (!it) return false;
    const spot = findSpot(container, h.cur.placed, it, rulesOf(it));
    if (!spot) return false;
    commit((c) => touch(c, id, [...c.placed, spot], { staged: c.staged.filter((s) => s.id !== id) }));
    setSelectedId(id);
    return true;
  }, [h.cur, container, rulesOf, commit]);

  const edited = h.past.length > 0;
  const snapshot = useMemo(
    () => (edited ? { placed: h.cur.placed, staged: h.cur.staged, touched: [...h.cur.touched] } : null),
    [edited, h.cur],
  );

  const issues = useMemo(() => checkPlan(container, h.cur.placed, rulesOf), [container, h.cur.placed, rulesOf]);

  return {
    edited: h.past.length > 0,
    placed: h.cur.placed,
    staged: h.cur.staged,
    touched: h.cur.touched,
    issues,
    selectedId,
    select: setSelectedId,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
    /** Retouches à enregistrer (null si le plan calculé n'a pas été modifié). */
    snapshot,
    restore,
    ...actions,
  };
}
