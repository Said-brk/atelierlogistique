// Logique commune des éditeurs de l'espace (chargement, palettisation) : chargement du document,
// suivi des modifications (outil intégré + champs d'en-tête), enregistrement, alerte avant de quitter.

import { useCallback, useEffect, useRef, useState } from 'react';

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
// Empreinte du plan 3D (calcul + retouches) pour savoir s'il a changé depuis l'enregistrement.
// Clés triées : la base (jsonb) ne rend pas les clés dans l'ordre d'origine (saisie et plan).
const stable = (v) => (Array.isArray(v) ? `[${v.map(stable).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${k}:${stable(v[k])}`).join(',')}}` : JSON.stringify(v ?? null));
const hasGuide = (p) => !!(p?.guide || p?.guides?.length);
const planSig = (p) => (p?.base || p?.fleet ? stable({ base: p.base ?? null, manual: p.manual ?? null, fleet: p.fleet ?? null }) : '');

/** initialOf(doc) : état de départ de l'outil intégré (saisie + plan enregistré). */
export const initialOf = (d) => ({ rows: [], ...(d.input ?? {}), plan: d.result?.plan ?? null });

export default function useDocEditor({ code, load, update, titleOf, autosaveMs = 2000 }) {
  const [doc, setDoc] = useState(undefined);
  const [meta, setMetaState] = useState({ label: '', external_id: '', departure_at: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [summary, setSummary] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [rev, setRev] = useState(0); // +1 à chaque modification : relance le minuteur d'enregistrement auto
  const snapshot = useRef(null);
  const savedInput = useRef('');
  const savedPlan = useRef('');
  const savedGuide = useRef(false); // le plan enregistré a-t-il son guide cariste (calculé après coup) ?
  const metaRef = useRef(meta); metaRef.current = meta;
  const docRef = useRef(doc); docRef.current = doc;
  const dirtyRef = useRef(false); dirtyRef.current = dirty;
  const inFlight = useRef(null);
  const saveRef = useRef(null);

  /** Document reçu de la base. keepMeta : après un enregistrement, on garde ce qui a été tapé entre-temps. */
  const apply = (d, keepMeta = false) => {
    setDoc(d);
    if (!d) return;
    if (!keepMeta) setMetaState({ label: d.label ?? '', external_id: d.external_id ?? '', departure_at: toDateInput(d.departure_at) });
    savedInput.current = stable(d.input ?? {});
    savedPlan.current = planSig(d.result?.plan);
    savedGuide.current = hasGuide(d.result?.plan);
    setSummary(d.result?.summary ?? null);
    document.title = `${d.code} · ${titleOf(d)} | Atelier Logistique`;
  };

  useEffect(() => {
    // Passage direct à un autre document : on enregistre d'abord celui qu'on quitte.
    if (dirtyRef.current) saveRef.current?.();
    snapshot.current = null; setDirty(false);
    setDoc(undefined);
    load(code).then((d) => apply(d)).catch((e) => { setError(e.message); setDoc(null); });
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  /** À passer à l'outil intégré (workspace.onChange). */
  const onChange = useCallback((snap) => {
    snapshot.current = snap;
    const { summary: sum, plan, ...input } = snap;
    const inputChanged = stable(input) !== savedInput.current;
    // Saisie modifiée sans nouveau calcul : l'ancien plan ne correspond plus.
    if (sum) setSummary(sum); else if (inputChanged) setSummary(null);
    // Un plan absent (calcul pas encore relancé) ne compte pas comme une modification.
    const planChanged = !!plan && (planSig(plan) !== savedPlan.current || (hasGuide(plan) && !savedGuide.current));
    if (planChanged || inputChanged) { setDirty(true); setRev((r) => r + 1); }
  }, []);

  const setMeta = (m) => { setMetaState(m); setDirty(true); setRev((r) => r + 1); };

  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  /** Enregistre (statut : inchangé, sauf Nouveau → En cours ; ou celui demandé). Renvoie le document. */
  const save = async (nextStatus, extra = {}) => {
    const current = docRef.current;
    if (!current) return null;
    if (inFlight.current) await inFlight.current.catch(() => {}); // un enregistrement à la fois
    const base = docRef.current;
    const usedSnap = snapshot.current;
    const usedMeta = metaRef.current;
    setSaving(true); setError('');
    const run = (async () => {
      const { summary: sum, plan, ...input } = usedSnap ?? { ...(base.input ?? {}) };
      const patch = {
        label: usedMeta.label.trim() || null,
        external_id: usedMeta.external_id.trim() || null,
        input,
        // Plan 3D gardé tant que la saisie n'a pas changé ; sinon seul le résumé (le plan sera recalculé).
        result: sum ? { summary: sum, ...(plan ? { plan } : {}) } : stable(input) === savedInput.current ? base.result : null,
        // Statut envoyé seulement s'il change : le cariste a pu passer le chargement « Chargé » entre-temps.
        ...(nextStatus ? { status: nextStatus } : base.status === 'new' ? { status: 'in_progress' } : {}),
        ...extra,
      };
      if ('departure_at' in base) patch.departure_at = usedMeta.departure_at ? new Date(usedMeta.departure_at).toISOString() : null;
      return update(base.id, patch);
    })();
    inFlight.current = run;
    try {
      const d = await run;
      apply(d, true);
      // Modifié pendant l'enregistrement ? On reste « à enregistrer » (l'enregistrement auto repassera).
      const changedMeanwhile = snapshot.current !== usedSnap || metaRef.current !== usedMeta;
      setDirty(changedMeanwhile);
      if (changedMeanwhile) setRev((r) => r + 1);
      setSavedAt(new Date());
      return d;
    } catch (e) {
      setError(/duplicate key|unique/i.test(e.message) ? 'Cette référence WMS / ERP existe déjà sur un autre document.' : e.message);
      return null;
    } finally {
      inFlight.current = null;
      setSaving(false);
    }
  };
  saveRef.current = save;

  // Enregistrement automatique : quelques secondes après la dernière modification.
  useEffect(() => {
    if (!autosaveMs || !dirtyRef.current) return undefined;
    const t = setTimeout(() => { if (dirtyRef.current) saveRef.current(); }, autosaveMs);
    return () => clearTimeout(t);
  }, [rev, autosaveMs]);
  // En quittant l'éditeur (autre page de l'espace) : on enregistre ce qui restait.
  useEffect(() => () => { if (dirtyRef.current) saveRef.current(); }, []);

  /** Met à jour le statut seul (fetchStatus → { status, loaded_at, version, updated_at }), sans toucher à la saisie. */
  const refreshStatus = useCallback(async (fetchStatus) => {
    if (inFlight.current) return;
    const st = await fetchStatus().catch(() => null);
    if (st && docRef.current && st.status !== docRef.current.status) setDoc((d) => (d ? { ...d, ...st } : d));
  }, []);

  return { doc, meta, setMeta, saving, error, dirty, savedAt, summary, onChange, save, refreshStatus };
}
