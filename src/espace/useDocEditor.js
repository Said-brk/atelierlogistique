// Logique commune des éditeurs de l'espace (chargement, palettisation) : chargement du document,
// suivi des modifications (outil intégré + champs d'en-tête), enregistrement, alerte avant de quitter.

import { useCallback, useEffect, useRef, useState } from 'react';

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export default function useDocEditor({ code, load, update, titleOf }) {
  const [doc, setDoc] = useState(undefined);
  const [meta, setMetaState] = useState({ label: '', external_id: '', departure_at: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [summary, setSummary] = useState(null);
  const snapshot = useRef(null);
  const savedInput = useRef('');

  const apply = (d) => {
    setDoc(d);
    if (!d) return;
    setMetaState({ label: d.label ?? '', external_id: d.external_id ?? '', departure_at: toDateInput(d.departure_at) });
    savedInput.current = JSON.stringify(d.input ?? {});
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
    const { summary: sum, ...input } = snap;
    if (sum) setSummary(sum);
    setDirty((d) => d || JSON.stringify(input) !== savedInput.current);
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
      const { summary: sum, ...input } = snapshot.current ?? { ...(doc.input ?? {}) };
      const patch = {
        label: meta.label.trim() || null,
        external_id: meta.external_id.trim() || null,
        input,
        result: sum ? { summary: sum } : doc.result,
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
