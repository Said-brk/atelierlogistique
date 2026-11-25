// /app/regrouper : chargements d'un même jour qui coûtent moins cher ensemble que séparément.
// Les deux montants sont calculés par l'outil (même moteur, véhicules et coûts des tables de référence).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Combine, Loader2, ArrowRight, Truck, CalendarDays, Info, X } from 'lucide-react';
import { useEspace } from '../useEspace';
import useReferences from '../useReferences';
import { datedShipments, consolidateShipments, STATUS } from '../data';
import { toToolReferences, defaultReferences } from '../../shared/references/defaults';
import { PageHeader, Btn, StatusBadge, ReferencesError } from '../ui';
import ResizableTable from '../ResizableTable';

const eur = (v) => `${Math.round(v).toLocaleString('fr-FR')} €`;
const dayKey = (d) => String(d).slice(0, 10);
const todayKey = () => new Date().toISOString().slice(0, 10);
const dayLabel = (k) => {
  const t = todayKey();
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const base = new Date(`${k}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  return k === t ? `Aujourd’hui · ${base}` : k === tomorrow ? `Demain · ${base}` : base;
};
const rowsOf = (s) => s.input?.rows ?? [];
const m3 = (s) => rowsOf(s).reduce((t, r) => t + ((r.length * r.width * r.height) / 1e6) * r.quantity, 0);
const kg = (s) => rowsOf(s).reduce((t, r) => t + (Number(r.weight) || 0) * r.quantity, 0);
const dests = (s) => [...new Set(rowsOf(s).map((r) => String(r.destination ?? '').trim()).filter(Boolean))];
const trucksText = (ev) => {
  const n = ev.trucks.reduce((m, t) => { m[t.label] = (m[t.label] ?? 0) + 1; return m; }, {});
  return Object.entries(n).map(([l, c]) => `${c} × ${l}`).join(' + ');
};

function SuggestionCard({ s, byCode, onMerge, onIgnore, busy, tour, destLabel }) {
  const [a, b] = s.codes.map((c) => byCode[c]);
  const fill = s.together.trucks.reduce((t, x) => t + x.fill, 0) / s.together.trucks.length;
  return (
    <div className="rounded-xl bg-white border border-emerald-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex flex-wrap items-center gap-2 border-b border-slate-100">
        {[a, b].map((x, i) => (
          <span key={x.code} className="flex items-center gap-2">
            {i > 0 && <span className="text-slate-400">+</span>}
            <Link to={`/app/chargements/${x.code}`} className="font-jetbrains text-xs text-blue-700 hover:underline">{x.code}</Link>
            <span className="text-sm text-slate-700">{x.label || '—'}</span>
          </span>
        ))}
        <span className="flex-1" />
        {tour && <span className="rounded-full bg-violet-50 text-violet-700 text-xs font-medium px-2.5 py-1">{tour}</span>}
        <span className="rounded-full bg-emerald-50 text-emerald-700 text-sm font-semibold px-3 py-1">−{eur(s.saving)}</span>
      </div>
      <div className="px-4 py-3 grid sm:grid-cols-[1fr_auto_1fr] gap-3 items-center text-sm">
        <div>
          <div className="text-[11px] font-jetbrains text-slate-400 uppercase">Séparément</div>
          <div className="text-slate-700">{s.trucksBefore} véhicule{s.trucksBefore > 1 ? 's' : ''} · <b>{eur(s.separate)}</b></div>
        </div>
        <ArrowRight size={18} className="hidden sm:block text-slate-300" />
        <div>
          <div className="text-[11px] font-jetbrains text-slate-400 uppercase">Ensemble</div>
          <div className="text-slate-900">{trucksText(s.together)} · <b>{eur(s.together.cost)}</b> <span className="text-slate-500">· rempli à {Math.round(fill * 100)} %</span></div>
        </div>
      </div>
      <div className="px-4 py-2.5 bg-slate-50 text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex-1 min-w-[200px]">Arrêts : {[...new Map([...s.rows].sort((x, y) => x.stop - y.stop).map((r) => [r.stop, destLabel(r.destination)])).values()].join(' → ') || 'destinations non renseignées'}</span>
        <button onClick={onIgnore} className="inline-flex items-center gap-1 hover:text-slate-800"><X size={13} /> Ignorer</button>
        <Btn onClick={onMerge} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Combine size={15} />} Regrouper</Btn>
      </div>
    </div>
  );
}

export default function ConsolidationPage() {
  const { org } = useEspace();
  const navigate = useNavigate();
  const refs = useReferences();
  const [ships, setShips] = useState(null);
  const [error, setError] = useState('');
  const [day, setDay] = useState(null);
  const [run, setRun] = useState({ status: 'idle', progress: [0, 0], analysis: null });
  const [ignored, setIgnored] = useState(() => new Set());
  const [busy, setBusy] = useState(null);
  const worker = useRef(null);
  useEffect(() => { document.title = 'Regrouper des chargements | Atelier Logistique'; }, []);
  useEffect(() => { datedShipments(org.id).then(setShips).catch((e) => { setError(e.message); setShips([]); }); }, [org.id]);

  const mode = refs.tools?.consolidation.mode ?? 'free';
  const agencies = useMemo(() => (refs.tools?.agencies ?? []).map(({ code, tour, order }) => ({ code, tour, order })), [refs.tools]);
  const tourName = useMemo(() => Object.fromEntries((refs.tools?.tours ?? []).map((t) => [t.code, t.label])), [refs.tools]);
  const agencyLabel = useMemo(() => Object.fromEntries((refs.tools?.agencies ?? []).map((a) => [a.code, a.label])), [refs.tools]);
  const vehicles = useMemo(() => {
    if (refs.items === undefined) return null;
    return (refs.tools ?? toToolReferences(defaultReferences())).vehicles.filter((v) => v.active).map((v) => ({ container: v.container, cost: v.cost }));
  }, [refs.items, refs.tools]);

  const days = useMemo(() => {
    const m = new Map();
    for (const s of ships ?? []) { const k = dayKey(s.departure_at); m.set(k, [...(m.get(k) ?? []), s]); }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [ships]);
  useEffect(() => {
    if (!days.length || (day && days.some(([k]) => k === day))) return;
    const t = todayKey();
    setDay((days.find(([k]) => k >= t) ?? days[days.length - 1])[0]);
  }, [days, day]);
  const list = useMemo(() => days.find(([k]) => k === day)?.[1] ?? [], [days, day]);
  const byCode = useMemo(() => Object.fromEntries(list.map((s) => [s.code, s])), [list]);

  // Analyse du jour choisi dans un worker (relancée au changement de jour).
  useEffect(() => {
    worker.current?.terminate();
    if (!vehicles || list.length < 2) { setRun({ status: 'idle', progress: [0, 0], analysis: null }); return undefined; }
    setRun({ status: 'running', progress: [0, 0], analysis: null });
    const w = new Worker(new URL('../consolidation/consolidation.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = (e) => {
      if (e.data.progress) setRun((r) => ({ ...r, progress: e.data.progress }));
      else if (e.data.ok) setRun({ status: 'done', progress: [1, 1], analysis: e.data.analysis });
      else setRun({ status: 'error', progress: [0, 0], analysis: null, error: e.data.error });
    };
    w.postMessage({ shipments: list.map(({ id, code, label, status, departure_at, input }) => ({ id, code, label, status, departure_at, input })), vehicles, mode, agencies });
    return () => w.terminate();
  }, [list, vehicles, mode, agencies]);
  const tourText = (code) => { const t = run.analysis?.tours?.[code]; return t === '*' ? 'plusieurs tournées' : t ? (tourName[t] ?? t) : null; };

  const suggestions = (run.analysis?.suggestions ?? []).filter((s) => !ignored.has(s.codes.join('+')));
  const totalSaving = suggestions.reduce((t, s) => t + s.saving, 0);

  const merge = async (s) => {
    const items = s.codes.map((c) => byCode[c]);
    const api = items.filter((x) => x.external_id);
    const msg = `Créer un chargement avec les lignes de ${s.codes.join(' et ')} (tournée : ${s.codes.join(' puis ')}, flotte déjà calculée), `
      + `y rattacher leurs palettisations et annuler ${s.codes.join(' et ')} ?`
      + (api.length ? `\n\n${api.map((x) => x.external_id).join(', ')} vien${api.length > 1 ? 'nent' : 't'} de votre WMS / ERP : il sera prévenu de l’annulation (webhook).` : '')
      + (items.some((x) => x.status === 'validated') ? '\n\nAttention : un des chargements est déjà validé (camion peut-être réservé).' : '');
    if (!window.confirm(msg)) return;
    setBusy(s.codes.join('+')); setError('');
    try {
      const t = s.plan.trucks;
      const byVehicle = Object.entries(t.reduce((m, x) => { m[x.container.label] = (m[x.container.label] ?? 0) + 1; return m; }, {}));
      const summary = {
        vehicle: byVehicle.map(([l, n]) => `${n} × ${l}`).join(' + '), fleet: t.length,
        packed: t.reduce((a, x) => a + x.units, 0), unpacked: 0,
        fill: t.reduce((a, x) => a + x.volumeUtilization, 0) / t.length, weight: t.reduce((a, x) => a + x.weight, 0), edited: false,
      };
      const code = await consolidateShipments(org.id, items, { rows: s.rows, plan: s.plan, summary, fleetVehicles: vehicles.map((v) => ({ ...v, enabled: true })) });
      navigate(`/app/chargements/${code}`);
    } catch (e) {
      setError(e.message); setBusy(null);
      // Un chargement a changé depuis l'analyse : on relit la liste (l'analyse repart sur les données à jour).
      if (/Relancez l.analyse/.test(e.message)) datedShipments(org.id).then(setShips).catch(() => {});
    }
  };

  const columns = [
    { key: 'code', h: 'N°', cell: (s) => <Link to={`/app/chargements/${s.code}`} onClick={(e) => e.stopPropagation()} className="font-jetbrains text-xs text-blue-700 hover:underline">{s.code}</Link> },
    { key: 'label', h: 'Libellé', min: 120, cell: (s) => <span className="text-slate-900">{s.label || '—'}</span> },
    { key: 'dest', h: 'Destinations', cell: (s) => <span className="text-xs">{dests(s).join(', ') || '—'}</span> },
    { key: 'tour', h: 'Tournée', cell: (s) => { const t = tourText(s.code); return t ? <span className="text-xs">{t}</span> : <span className="text-xs text-slate-400">{run.analysis ? 'hors tournée' : '…'}</span>; } },
    { key: 'vol', h: 'Volume', cell: (s) => `${m3(s).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} m³` },
    { key: 'kg', h: 'Poids', cell: (s) => `${Math.round(kg(s)).toLocaleString('fr-FR')} kg` },
    { key: 'sep', h: 'Seul (calcul)', cell: (s) => { const ev = run.analysis?.separate?.[s.code]; return ev?.ok ? <span className="text-xs">{trucksText(ev)} · {eur(ev.cost)}</span> : <span className="text-xs text-slate-400">{run.status === 'running' ? '…' : rowsOf(s).length ? 'trop gros pour un regroupement' : 'aucune ligne'}</span>; } },
    { key: 'status', h: 'Statut', cell: (s) => <StatusBadge status={s.status} /> },
  ];

  return (
    <>
      <PageHeader title="Regrouper des chargements"
        subtitle="Les chargements d’un même jour qui coûtent moins cher dans les mêmes véhicules." />
      <div className="px-5 sm:px-8 py-5 space-y-4">
        {refs.error ? <ReferencesError error={refs.error} onRetry={refs.reload} /> : ships === null || vehicles === null ? <div className="p-10 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div> : days.length === 0 ? (
          <div className="rounded-xl bg-white border border-slate-200 p-8 text-center text-slate-500">
            <CalendarDays className="mx-auto text-slate-300" size={32} />
            <div className="mt-2 text-sm">Aucun chargement daté à venir. Renseignez la date de départ de vos chargements : ceux du même jour sont comparés ici.</div>
          </div>
        ) : (<>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {days.map(([k, l]) => (
              <button key={k} onClick={() => setDay(k)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm border ${day === k ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                {dayLabel(k)} <span className="text-xs text-slate-400">{l.length}</span>
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500">Regroupement : <b>{mode === 'tour' ? 'par tournée' : 'libre'}</b>
            {mode === 'tour' ? ' — seuls les chargements dont toutes les destinations sont dans la même tournée sont comparés.' : ' — tous les chargements du jour sont comparés.'}
            {' '}<Link to="/app/parametres/references/regroupement" className="text-blue-700 hover:underline">Modifier</Link></div>
          {list.length < 2 ? <div className="rounded-xl bg-white border border-slate-200 p-5 text-sm text-slate-500">Un seul chargement ce jour-là : rien à regrouper.</div>
            : run.status === 'running' ? (
              <div className="rounded-xl bg-white border border-slate-200 p-5 text-sm text-slate-600 space-y-2">
                <div className="flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Calcul des combinaisons ({run.progress[0]}/{run.progress[1] || '…'})…</div>
                <div className="h-1.5 rounded bg-slate-100 overflow-hidden"><div className="h-full bg-blue-600 transition-all" style={{ width: `${run.progress[1] ? (run.progress[0] / run.progress[1]) * 100 : 5}%` }} /></div>
              </div>
            ) : run.status === 'error' ? <div className="text-sm text-red-700">{run.error}</div>
              : suggestions.length === 0 ? (
                <div className="rounded-xl bg-white border border-slate-200 p-5 text-sm text-slate-600 flex items-center gap-2"><Truck size={16} className="text-slate-400" /> Aucun regroupement moins cher : vos chargements de ce jour sont déjà bien répartis.</div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-slate-700"><b>{suggestions.length} regroupement{suggestions.length > 1 ? 's' : ''} possible{suggestions.length > 1 ? 's' : ''}</b> · jusqu’à <b className="text-emerald-700">{eur(totalSaving)}</b> de transport en moins ce jour-là</div>
                  {suggestions.map((s) => (
                    <SuggestionCard key={s.codes.join('+')} s={s} byCode={byCode} busy={busy === s.codes.join('+')}
                      tour={mode === 'tour' || run.analysis?.tours?.[s.codes[0]] === run.analysis?.tours?.[s.codes[1]] ? tourText(s.codes[0]) : null}
                      destLabel={(d) => (agencyLabel[d] ? `${d} · ${agencyLabel[d]}` : d)}
                      onMerge={() => merge(s)} onIgnore={() => setIgnored((x) => new Set([...x, s.codes.join('+')]))} />
                  ))}
                </div>
              )}
          {error && <div className="text-sm text-red-700">{error}</div>}

          <section className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Chargements du jour <span className="text-slate-400 font-normal">· {list.length}</span></div>
            <ResizableTable id="consolidation-day" rows={list} columns={columns} onRowClick={(s) => navigate(`/app/chargements/${s.code}`)}
              theadClass="bg-slate-50 text-left text-xs text-slate-500" thClass="px-4 py-2 font-medium" />
          </section>
          <p className="text-xs text-slate-400 flex gap-1.5"><Info size={14} className="shrink-0" />
            Les deux montants sont calculés par l’outil (même moteur 3D, véhicules et coûts de vos tables de référence), pour les chargements {Object.values(STATUS).slice(0, 3).map((x) => x.label.toLowerCase()).join(', ')}.
            Ordre des arrêts : celui des agences dans la tournée (Paramètres › Tables de référence) quand toutes les destinations en font partie, sinon le premier chargement puis le second ; modifiable ensuite.</p>
        </>)}
      </div>
    </>
  );
}
