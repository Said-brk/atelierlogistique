// Éditeur d'un chargement : en-tête (n°, libellé, réf. WMS, départ, statut, enregistrer / valider)
// + l'optimiseur de chargement intégré, pré-rempli avec les données enregistrées.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle2, Loader2, RotateCcw, AlertTriangle } from 'lucide-react';
import LoadOptimizer from '../../outils/optimiseur-chargement/LoadOptimizer.jsx';
import { useEspace } from '../useEspace';
import { getShipment, createShipment, updateShipment, SOURCE } from '../data';
import { Btn, StatusBadge, fmtDateTime, pct } from '../ui';

/** /app/chargements/nouveau : crée un chargement vide puis ouvre l'éditeur. */
export function NewShipment() {
  const { org } = useEspace();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createShipment(org.id).then((code) => navigate(`/app/chargements/${code}`, { replace: true })).catch((e) => setError(e.message));
  }, [org.id, navigate]);
  return <div className="p-10 flex justify-center text-slate-400">{error ? <span className="text-red-700 text-sm">{error}</span> : <Loader2 className="animate-spin" />}</div>;
}

const inputCls = 'rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200';
const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export default function ShipmentEditor() {
  const { code } = useParams();
  const [ship, setShip] = useState(undefined);
  const [meta, setMeta] = useState({ label: '', external_id: '', departure_at: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const snapshot = useRef(null);
  const savedInput = useRef('');

  useEffect(() => {
    setShip(undefined);
    getShipment(code).then((s) => {
      setShip(s);
      if (s) {
        setMeta({ label: s.label ?? '', external_id: s.external_id ?? '', departure_at: toDateInput(s.departure_at) });
        savedInput.current = JSON.stringify(s.input ?? {});
        document.title = `${s.code} · ${s.label ?? 'Chargement'} | Atelier Logistique`;
      }
    }).catch((e) => { setError(e.message); setShip(null); });
  }, [code]);

  // L'optimiseur nous envoie son état à chaque changement.
  const onChange = useCallback((snap) => {
    snapshot.current = snap;
    const { summary, ...input } = snap;
    setDirty(JSON.stringify(input) !== savedInput.current);
  }, []);

  // Alerte si on quitte la page avec des modifications non enregistrées.
  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const save = async (nextStatus) => {
    if (!ship) return;
    setSaving(true); setError('');
    try {
      const snap = snapshot.current ?? {};
      const { summary, ...input } = snap;
      const patch = {
        label: meta.label.trim() || null,
        external_id: meta.external_id.trim() || null,
        departure_at: meta.departure_at ? new Date(meta.departure_at).toISOString() : null,
        input,
        result: summary ? { summary } : ship.result,
        status: nextStatus ?? (ship.status === 'new' ? 'in_progress' : ship.status),
      };
      const s = await updateShipment(ship.id, patch);
      setShip(s);
      savedInput.current = JSON.stringify(s.input ?? {});
      setDirty(false);
    } catch (e) {
      setError(/duplicate key|unique/i.test(e.message) ? 'Cette référence WMS / ERP existe déjà sur un autre chargement.' : e.message);
    }
    setSaving(false);
  };

  if (ship === undefined) return <div className="p-10 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;
  if (ship === null) return <div className="p-10 text-center text-slate-500">Chargement introuvable. <Link to="/app/chargements" className="text-blue-700">Retour à la liste</Link></div>;

  const summary = snapshot.current?.summary ?? ship.result?.summary;
  const validated = ship.status === 'validated' || ship.status === 'sent';
  return (
    <>
      <div className="bg-white border-b border-slate-200 sticky top-0 lg:top-0 z-20 print:hidden">
        <div className="px-5 sm:px-8 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link to="/app/chargements" className="text-slate-400 hover:text-slate-700" title="Retour aux chargements"><ArrowLeft size={18} /></Link>
          <span className="font-jetbrains text-xs text-blue-700 bg-blue-50 rounded px-2 py-1">{ship.code}</span>
          <input value={meta.label} onChange={(e) => { setMeta({ ...meta, label: e.target.value }); setDirty(true); }} placeholder="Libellé du chargement"
            className="font-bricolage font-bold text-lg text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-400 focus:outline-none min-w-0 flex-1 sm:flex-none sm:w-72" />
          <StatusBadge status={ship.status} />
          <span className="text-xs text-slate-400 hidden md:inline">v{ship.version} · {SOURCE[ship.source]} · {fmtDateTime(ship.updated_at)}</span>
          <div className="ml-auto flex items-center gap-2">
            {dirty && <span className="text-xs text-amber-700 hidden sm:inline">Modifications non enregistrées</span>}
            <Btn variant="ghost" onClick={() => save()} disabled={saving}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer</Btn>
            {validated
              ? <Btn variant="ghost" onClick={() => save('in_progress')} disabled={saving}><RotateCcw size={15} /> Rouvrir</Btn>
              : <Btn variant="success" onClick={() => save('validated')} disabled={saving || !summary} title={summary ? '' : 'Lancez d’abord l’optimisation'}><CheckCircle2 size={15} /> Valider</Btn>}
          </div>
        </div>
        <div className="px-5 sm:px-8 pb-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-slate-500">Réf. WMS / ERP
            <input value={meta.external_id} onChange={(e) => { setMeta({ ...meta, external_id: e.target.value }); setDirty(true); }} placeholder="EXP-…" className={`${inputCls} w-36`} /></label>
          <label className="flex items-center gap-2 text-slate-500">Départ
            <input type="date" value={meta.departure_at} onChange={(e) => { setMeta({ ...meta, departure_at: e.target.value }); setDirty(true); }} className={inputCls} /></label>
          {summary && <span className="text-xs text-slate-500 font-jetbrains">Dernier plan : {summary.vehicle} · {summary.packed} colis · {pct(summary.fill)}{summary.unpacked ? ` · ${summary.unpacked} non chargé(s)` : ''}{summary.edited ? ' · modifié à la main' : ''}</span>}
          {error && <span className="text-sm text-red-700 inline-flex items-center gap-1"><AlertTriangle size={14} /> {error}</span>}
        </div>
      </div>
      <LoadOptimizer key={ship.id} workspace={{ initial: { rows: [], ...(ship.input ?? {}) }, onChange }} />
    </>
  );
}
