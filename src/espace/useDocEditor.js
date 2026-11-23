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

export default function useDocEditor({ code, load, update, titleOf }) {
  const [doc, setDoc] = useState(undefined);
  const [meta, setMetaState] = useState({ label: '', external_id: '', departure_at: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [summary, setSummary] = useState(null);
  const snapshot = useRef(null);
  const savedInput = useRef('');
  const savedPlan = useRef('');
  const savedGuide = useRef(false); // le plan enregistré a-t-il son guide cariste (calculé après coup) ?

  const apply = (d) => {
    setDoc(d);
    if (!d) return;
    setMetaState({ label: d.label ?? '', external_id: d.external_id ?? '', departure_at: toDateInput(d.departure_at) });
    savedInput.current = stable(d.input ?? {});
    savedPlan.current = planSig(d.result?.plan);
    savedGuide.current = hasGuide(d.result?.plan);
    setSummary(d.result?.summary ?? null);
    document.title = `${d.code} · ${titleOf(d)} | Atelier Logistique`;
  };

  useEffect(() => {
    setDoc(undefined);
    load(code).then(apply).catch((e) => { setError(e.message); setDoc(null); });
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
    setDirty((d) => d || planChanged || inputChanged);
  }, []);

  const setMeta = (m) => { setMetaState(m); setDirty(true); };

  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  /** Enregistre (statut : inchangé, sauf Nouveau → En cours ; ou celui demandé). Renvoie le document. */
  const save = async (nextStatus, extra = {}) => {
    if (!doc) return null;
    setSaving(true); setError('');
    try {
      const { summary: sum, plan, ...input } = snapshot.current ?? { ...(doc.input ?? {}) };
      const patch = {
        label: meta.label.trim() || null,
        external_id: meta.external_id.trim() || null,
        input,
        // Plan 3D gardé tant que la saisie n'a pas changé ; sinon seul le résumé (le plan sera recalculé).
        result: sum ? { summary: sum, ...(plan ? { plan } : {}) } : stable(input) === savedInput.current ? doc.result : null,
        status: nextStatus ?? (doc.status === 'new' ? 'in_progress' : doc.status),
        ...extra,
      };
      if ('departure_at' in doc) patch.departure_at = meta.departure_at ? new Date(meta.departure_at).toISOString() : null;
      const d = await update(doc.id, patch);
      apply(d);
      setDirty(false);
      setSaving(false);
      return d;
    } catch (e) {
      setError(/duplicate key|unique/i.test(e.message) ? 'Cette référence WMS / ERP existe déjà sur un autre document.' : e.message);
      setSaving(false);
      return null;
    }
  };

  return { doc, meta, setMeta, saving, error, dirty, summary, onChange, save };
}
