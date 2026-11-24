// « Charger le camion » depuis une palettisation : nouveau chargement, ou ajout des palettes à un chargement
// existant encore modifiable (Nouveau / En cours). Les palettes s'ajoutent aux lignes déjà présentes ;
// renvoyer la même palettisation remplace ses propres palettes, sans toucher aux autres.

import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Truck, Search, Loader2, ArrowRight, Lock } from 'lucide-react';
import { openShipments, OPEN_STATUSES, STATUS } from './data';
import { StatusBadge, fmtDate, fmtDateTime, pct } from './ui';

export default function LoadTruckDialog({ orgId, pz, onNew, onExisting, onClose }) {
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const linked = pz.shipments ?? null; // { code, label, status? }

  useEffect(() => { openShipments(orgId).then(setList).catch((e) => { setError(e.message); setList([]); }); }, [orgId]);
  const linkedOpen = linked && (list ?? []).some((s) => s.code === linked.code);
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (list ?? []).filter((s) => s.code !== linked?.code && (!k || [s.code, s.label, s.external_id].some((v) => v?.toLowerCase().includes(k))));
  }, [list, q, linked]);

  const pick = async (fn, key) => { setBusy(key); setError(''); try { await fn(); } catch (e) { setError(e.message); setBusy(null); } };
  const Row = ({ s, accent = false }) => (
    <button type="button" disabled={!!busy} onClick={() => pick(() => onExisting(s), s.code)}
      className={`w-full text-left rounded-xl border px-4 py-3 flex items-center gap-3 hover:border-blue-400 hover:bg-blue-50/40 disabled:opacity-60 ${accent ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200'}`}>
      <Truck size={18} className="text-slate-400 shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-jetbrains text-xs font-semibold text-blue-700">{s.code}</span>
          <span className="font-medium text-slate-900 truncate">{s.label ?? 'Sans libellé'}</span>
          <StatusBadge status={s.status} />
        </span>
        <span className="block text-xs text-slate-500 mt-0.5">
          {s.external_id && <>Réf. {s.external_id} · </>}
          {s.departure_at ? `départ ${fmtDate(s.departure_at)}` : `modifié ${fmtDateTime(s.updated_at)}`}
          {s.result?.summary && <> · {s.result.summary.packed} colis · {pct(s.result.summary.fill)}</>}
          {s.palletizations?.length > 0 && <> · palettes de {s.palletizations.map((p) => p.code).join(', ')}</>}
        </span>
      </span>
      {busy === s.code ? <Loader2 size={16} className="animate-spin text-blue-600" /> : <ArrowRight size={16} className="text-slate-400" />}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <div className="w-full sm:max-w-xl max-h-[90vh] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center">
          <div>
            <div className="font-bricolage font-semibold text-lg text-slate-900">Charger le camion</div>
            <div className="text-xs text-slate-500">Les palettes de {pz.code} partent dans un nouveau chargement ou s’ajoutent à un chargement en cours.</div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <button type="button" disabled={!!busy} onClick={() => pick(onNew, 'new')}
            className="w-full rounded-xl px-4 py-3 flex items-center gap-3 text-white font-semibold disabled:opacity-60" style={{ background: '#2563EB' }}>
            {busy === 'new' ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Nouveau chargement
          </button>

          {linked && (linkedOpen
            ? <div><div className="text-xs font-jetbrains text-slate-400 mb-1.5">DÉJÀ RELIÉ — METTRE À JOUR SES PALETTES</div><Row s={list.find((s) => s.code === linked.code)} accent /></div>
            : list && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800 flex gap-2">
                <Lock size={15} className="shrink-0 mt-0.5" />
                <span>{linked.code} est déjà validé, envoyé au quai ou annulé : il ne sera pas modifié. Choisissez un nouveau chargement ou un chargement en cours.</span>
              </div>
            ))}

          <div>
            <div className="text-xs font-jetbrains text-slate-400 mb-1.5">AJOUTER À UN CHARGEMENT EN COURS ({OPEN_STATUSES.map((s) => STATUS[s].label.toLowerCase()).join(' ou ')})</div>
            <label className="relative block mb-2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N°, libellé ou réf. WMS…"
                className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </label>
            {list === null ? <div className="py-6 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>
              : shown.length === 0 ? <div className="py-4 text-sm text-slate-500 text-center">{q ? 'Aucun chargement en cours ne correspond.' : 'Aucun autre chargement en cours.'}</div>
                : <div className="space-y-2">{shown.map((s) => <Row key={s.code} s={s} />)}</div>}
          </div>
          {linked && linkedOpen && <p className="text-xs text-slate-400">Si vous choisissez un autre chargement, les palettes de {pz.code} sont retirées de {linked.code}.</p>}
          {error && <div className="text-sm text-red-700">{error}</div>}
        </div>
      </div>
    </div>
  );
}
