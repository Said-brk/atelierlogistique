import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Boxes, Truck, ArrowRight, Loader2, Inbox, Combine } from 'lucide-react';
import { useEspace } from '../useEspace';
import { listShipments, STATUS } from '../data';
import { PageHeader, StatusBadge, Btn, fmtDateTime, pct } from '../ui';

export default function Dashboard() {
  const { org, user } = useEspace();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { document.title = 'Tableau de bord | Atelier Logistique'; }, []);
  useEffect(() => { listShipments(org.id, { limit: 500 }).then(setRows).catch((e) => { setError(e.message); setRows([]); }); }, [org.id]);

  const count = (st) => rows?.filter((r) => r.status === st).length ?? 0;
  const firstName = user?.email?.split('@')[0]?.split('.')[0] ?? '';
  const kpis = [
    { st: 'new', hint: 'arrivés, à traiter' },
    { st: 'in_progress', hint: 'en préparation' },
    { st: 'validated', hint: 'prêts pour le quai' },
    { st: 'sent', hint: 'envoyés au quai' },
  ];
  return (
    <>
      <PageHeader title={`Bonjour ${firstName.charAt(0).toUpperCase() + firstName.slice(1)} 👋`} subtitle={org.name}
        actions={<><Btn variant="ghost" onClick={() => navigate('/app/palettisations/nouveau')}><Boxes size={15} /> Nouvelle palettisation</Btn>
          <Btn onClick={() => navigate('/app/chargements/nouveau')}><Plus size={15} /> Nouveau chargement</Btn></>} />
      <div className="px-5 sm:px-8 py-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {kpis.map((k) => (
            <Link key={k.st} to={`/app/chargements?statut=${k.st}`} className="rounded-xl bg-white border border-slate-200 p-4 sm:p-5 hover:shadow-md transition">
              <div className="flex items-center justify-between"><StatusBadge status={k.st} /></div>
              <div className="font-bricolage font-bold text-3xl text-slate-900 mt-3">{rows ? count(k.st) : '·'}</div>
              <div className="text-xs text-slate-500">{k.hint}</div>
            </Link>
          ))}
        </div>

        <div className="rounded-xl bg-white border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="font-semibold text-slate-900">Derniers chargements</div>
            <Link to="/app/chargements" className="text-sm text-blue-700 inline-flex items-center gap-1">Tout voir <ArrowRight size={14} /></Link>
          </div>
          {rows === null ? <div className="p-8 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>
            : rows.length === 0 ? (
              <div className="p-10 text-center">
                <Inbox className="mx-auto text-slate-300" size={36} />
                <div className="font-semibold text-slate-800 mt-3">Aucun chargement pour l’instant</div>
                <p className="text-sm text-slate-500 mt-1 mb-5">Créez votre premier chargement, ou palettisez des colis puis chargez-les.</p>
                <Btn onClick={() => navigate('/app/chargements/nouveau')}><Plus size={15} /> Nouveau chargement</Btn>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {rows.slice(0, 6).map((r) => (
                  <li key={r.id}>
                    <Link to={`/app/chargements/${r.code}`} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50">
                      <Truck size={16} className="text-slate-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900 truncate">{r.label || r.code}</div>
                        <div className="text-xs text-slate-500 font-jetbrains">{r.code}{r.external_id ? ` · ${r.external_id}` : ''} · {fmtDateTime(r.updated_at)}</div>
                      </div>
                      <div className="hidden sm:block text-xs text-slate-500 text-right w-28">{r.result?.summary ? `${r.result.summary.vehicle} · ${pct(r.result.summary.fill)}` : ''}</div>
                      <StatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          {error && <div className="px-5 py-3 text-sm text-red-700">{error}</div>}
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {[[Boxes, 'Palettiser des colis', 'Colis → palettes complètes et mixtes, puis « Charger le camion ».', '/app/palettisations/nouveau'],
            [Truck, 'Préparer un camion', 'Plan 3D, tournée, essieux, sangles, fiche et QR cariste.', '/app/chargements/nouveau'],
            [Combine, 'Regrouper des chargements', 'Ceux du même jour qui coûtent moins cher dans les mêmes véhicules.', '/app/regrouper']].map(([Icon, t, d, to]) => (
            <Link key={t} to={to} className="rounded-xl border border-slate-200 bg-white p-5 flex gap-4 hover:shadow-md transition">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0"><Icon size={20} /></div>
              <div><div className="font-semibold text-slate-900">{t}</div><div className="text-sm text-slate-500">{d}</div></div>
            </Link>
          ))}
        </div>
        <p className="text-[11px] text-slate-400">Statuts : {Object.values(STATUS).map((s) => s.label).join(' → ')}</p>
      </div>
    </>
  );
}
