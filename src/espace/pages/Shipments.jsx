import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Loader2, Inbox } from 'lucide-react';
import { useEspace } from '../useEspace';
import { listShipments, STATUS, SOURCE } from '../data';
import { PageHeader, StatusBadge, Btn, fmtDate, fmtDateTime, pct } from '../ui';

const TABS = [['', 'Tous'], ['new', 'Nouveaux'], ['in_progress', 'En cours'], ['validated', 'Validés'], ['sent', 'Envoyés']];

export default function Shipments() {
  const { org } = useEspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('statut') ?? '';
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { document.title = 'Chargements | Atelier Logistique'; }, []);
  useEffect(() => { listShipments(org.id).then(setRows).catch((e) => { setError(e.message); setRows([]); }); }, [org.id]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => (!status || r.status === status)
      && (!s || [r.code, r.label, r.external_id].some((v) => v?.toLowerCase().includes(s))));
  }, [rows, status, q]);

  return (
    <>
      <PageHeader title="Chargements" subtitle="Arrivés de votre WMS / ERP, d’un fichier, ou créés ici"
        actions={<Btn onClick={() => navigate('/app/chargements/nouveau')}><Plus size={15} /> Nouveau chargement</Btn>}>
        <div className="px-5 sm:px-8 flex gap-1 overflow-x-auto">
          {TABS.map(([v, l]) => {
            const n = v ? rows?.filter((r) => r.status === v).length : rows?.length;
            const on = status === v;
            return (
              <button key={v} onClick={() => setParams(v ? { statut: v } : {})}
                className={`px-3 py-2.5 text-sm border-b-2 whitespace-nowrap ${on ? 'border-blue-600 text-blue-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                {l} {rows && <span className="text-xs text-slate-400 ml-0.5">{n}</span>}
              </button>
            );
          })}
        </div>
      </PageHeader>

      <div className="px-5 sm:px-8 py-5 space-y-4">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher n° PL, libellé, n° d’expédition…"
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>

        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          {rows === null ? <div className="p-10 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>
            : shown.length === 0 ? (
              <div className="p-10 text-center text-slate-500"><Inbox className="mx-auto text-slate-300" size={32} /><div className="mt-2 text-sm">Aucun chargement {status ? `« ${STATUS[status].label} »` : ''}</div></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] font-jetbrains text-slate-500 uppercase">
                    <tr>{['N°', 'Libellé', 'Réf. WMS / ERP', 'Origine', 'Départ', 'Véhicule', 'Remplissage', 'Mis à jour', 'Statut'].map((h) => <th key={h} className="px-4 py-2.5 font-medium whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shown.map((r) => (
                      <tr key={r.id} className="hover:bg-blue-50/40 cursor-pointer" onClick={() => navigate(`/app/chargements/${r.code}`)}>
                        <td className="px-4 py-3 font-jetbrains text-xs text-blue-700 whitespace-nowrap"><Link to={`/app/chargements/${r.code}`} onClick={(e) => e.stopPropagation()}>{r.code}</Link></td>
                        <td className="px-4 py-3 font-medium text-slate-900 max-w-[240px] truncate">{r.label || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.external_id || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{SOURCE[r.source] ?? r.source}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(r.departure_at)}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.result?.summary?.vehicle ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{pct(r.result?.summary?.fill)}</td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{fmtDateTime(r.updated_at)}</td>
                        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          {error && <div className="px-5 py-3 text-sm text-red-700">{error}</div>}
        </div>
      </div>
    </>
  );
}
