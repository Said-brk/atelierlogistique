// Calendrier des chargements (Chargements › vue Calendrier) : semaine ou mois, chargements rangés par tournée.
// - Tournées prévues ce jour-là (jours de préparation / expédition des tables de référence), même sans chargement :
//   case « + Chargement » pour le créer à la bonne date.
// - Glisser-déposer : changer la date d'un chargement, ou dater un chargement « sans date » (colonne de droite).
// - Tournée d'un chargement = celle de toutes ses destinations (agences) ; sinon « Autres ».

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Loader2, CalendarDays, CalendarRange, Inbox, GripVertical } from 'lucide-react';
import { useEspace } from '../useEspace';
import useReferences from '../useReferences';
import { calendarShipments, setDeparture, createShipment, STATUS, DOCK_STATUSES } from '../data';
import { tourOf } from '../consolidation/engine';
import { tourTitle } from '../tourCheck';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const TOUR_COLORS = ['#7C3AED', '#0891B2', '#DB2777', '#EA580C', '#16A34A', '#2563EB', '#CA8A04', '#9333EA'];

// Jours en UTC (clé AAAA-MM-JJ) : même convention que la date de départ enregistrée.
const keyOf = (d) => d.toISOString().slice(0, 10);
const fromKey = (k) => new Date(`${k}T00:00:00Z`);
const addDays = (k, n) => { const d = fromKey(k); d.setUTCDate(d.getUTCDate() + n); return keyOf(d); };
const isoDow = (k) => ((fromKey(k).getUTCDay() + 6) % 7) + 1; // 1 = lundi
const mondayOf = (k) => addDays(k, 1 - isoDow(k));
const todayKey = () => { const d = new Date(); return keyOf(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))); };
const fmt = (k, o) => fromKey(k).toLocaleDateString('fr-FR', { timeZone: 'UTC', ...o });
const VIEW_KEY = 'al.espace.calendar.mode';

function Card({ s, tourColor, onOpen, compact = false }) {
  const st = STATUS[s.status];
  const fixed = s.status === 'loaded';
  const sum = s.summary;
  return (
    <div draggable={!fixed} onDragStart={(e) => { e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move'; }}
      onClick={() => onOpen(s)} title={`${s.code} · ${s.label ?? ''} — ${st?.label ?? s.status}${fixed ? ' (chargé : date figée)' : ' · glisser pour changer la date'}`}
      className={`group rounded-md bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm cursor-pointer ${compact ? 'px-1.5 py-1' : 'px-2 py-1.5'}`}
      style={{ borderLeft: `3px solid ${tourColor ?? '#CBD5E1'}` }}>
      <div className="flex items-center gap-1.5 min-w-0">
        {!fixed && !compact && <GripVertical size={12} className="text-slate-300 shrink-0 hidden lg:block" />}
        <span className="font-jetbrains text-[10px] text-blue-700 shrink-0">{s.code}</span>
        <span className="ml-auto w-2 h-2 rounded-full shrink-0" style={{ background: st?.color }} title={st?.label} />
      </div>
      {!compact && <div className="text-xs text-slate-800 truncate">{s.label || '—'}</div>}
      {!compact && sum?.vehicle && <div className="text-[10px] text-slate-500 truncate">{sum.vehicle}{sum.fill != null ? ` · ${Math.round(sum.fill * 100)} %` : ''}</div>}
    </div>
  );
}

export default function ShipmentsCalendar() {
  const { org } = useEspace();
  const navigate = useNavigate();
  const refs = useReferences();
  const [mode, setModeState] = useState(() => { try { return localStorage.getItem(VIEW_KEY) || 'week'; } catch { return 'week'; } });
  const setMode = (m) => { setModeState(m); try { localStorage.setItem(VIEW_KEY, m); } catch { /* indisponible */ } };
  const [anchor, setAnchor] = useState(todayKey);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [over, setOver] = useState(null); // jour survolé pendant un glisser
  const [busy, setBusy] = useState(false);

  // Plage affichée : la semaine (lun → dim) ou les semaines entières du mois.
  const days = useMemo(() => {
    if (mode === 'week') { const m = mondayOf(anchor); return Array.from({ length: 7 }, (_, i) => addDays(m, i)); }
    const first = `${anchor.slice(0, 7)}-01`;
    const start = mondayOf(first);
    const next = fromKey(first); next.setUTCMonth(next.getUTCMonth() + 1);
    const end = addDays(mondayOf(addDays(keyOf(next), -1)), 6);
    const out = []; for (let k = start; k <= end; k = addDays(k, 1)) out.push(k);
    return out;
  }, [mode, anchor]);

  const load = useCallback(() => {
    calendarShipments(org.id, days[0], days[days.length - 1]).then(setData).catch((e) => setError(e.message));
  }, [org.id, days]);
  useEffect(() => { setData(null); load(); }, [load]);

  const tools = refs.tools;
  const tours = tools?.tours ?? [];
  const tourColor = useMemo(() => Object.fromEntries(tours.map((t, i) => [t.code, TOUR_COLORS[i % TOUR_COLORS.length]])), [tours]);
  const agencyMap = useMemo(() => new Map((tools?.agencies ?? []).map((a) => [a.code, a])), [tools]);
  const withTour = useCallback((s) => {
    const t = tourOf({ tour: s.tour, input: { rows: s.rows ?? [] } }, agencyMap);
    return { ...s, tour: t && t !== '*' ? t : null };
  }, [agencyMap]);
  const byDay = useMemo(() => {
    const m = new Map();
    for (const s of data?.dated ?? []) { const k = String(s.departure_at).slice(0, 10); m.set(k, [...(m.get(k) ?? []), withTour(s)]); }
    return m;
  }, [data, withTour]);
  const undated = useMemo(() => (data?.undated ?? []).map(withTour), [data, withTour]);

  const open = (s) => navigate(`/app/chargements/${s.code}`);
  const move = async (id, day) => {
    const s = [...(data?.dated ?? []), ...(data?.undated ?? [])].find((x) => x.id === id);
    if (!s || String(s.departure_at ?? '').slice(0, 10) === day) return;
    if (s.status === 'loaded') return;
    if (DOCK_STATUSES.includes(s.status) && !window.confirm(`${s.code} est déjà au quai. Changer quand même sa date de départ ?`)) return;
    setBusy(true); setError('');
    try { await setDeparture(id, day); load(); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const createFor = async (day, tour) => {
    setBusy(true);
    try {
      const code = await createShipment(org.id, { label: tourTitle(tour ? [tour.code] : [], day) ?? `Chargement du ${fmt(day, { day: 'numeric', month: 'long' })}`, departure_at: `${day}T00:00:00.000Z`, ...(tour ? { tour: tour.code } : {}) });
      navigate(`/app/chargements/${code}`);
    } catch (e) { setError(e.message); setBusy(false); }
  };
  const dropProps = (day) => ({
    onDragOver: (e) => { e.preventDefault(); setOver(day); },
    onDragLeave: () => setOver((o) => (o === day ? null : o)),
    onDrop: (e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/plain'); if (id) move(id, day); },
  });

  const shift = (n) => {
    if (mode === 'week') setAnchor(addDays(anchor, 7 * n));
    else { const d = fromKey(`${anchor.slice(0, 7)}-01`); d.setUTCMonth(d.getUTCMonth() + n); setAnchor(keyOf(d)); }
  };
  const title = mode === 'week'
    ? `${fmt(days[0], { day: 'numeric', month: 'short' })} – ${fmt(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}`
    : fmt(`${anchor.slice(0, 7)}-01`, { month: 'long', year: 'numeric' });
  const today = todayKey();
  const month = anchor.slice(0, 7);

  /** Contenu d'un jour : tournées prévues ou présentes, puis « Autres ». */
  const dayGroups = (day) => {
    const list = byDay.get(day) ?? [];
    const dow = isoDow(day);
    const groups = tours.filter((t) => t.days.includes(dow) || list.some((s) => s.tour === t.code))
      .map((t) => ({ tour: t, items: list.filter((s) => s.tour === t.code), planned: t.days.includes(dow) }));
    const others = list.filter((s) => !s.tour || !tours.some((t) => t.code === s.tour));
    return { groups, others, count: list.length };
  };

  return (
    <div className="px-5 sm:px-8 py-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-slate-200 bg-white">
          <button onClick={() => shift(-1)} className="p-2 text-slate-500 hover:text-slate-900" aria-label="Précédent"><ChevronLeft size={16} /></button>
          <button onClick={() => setAnchor(todayKey())} className="px-2.5 py-1.5 text-sm text-slate-700 border-x border-slate-200 hover:bg-slate-50">Aujourd’hui</button>
          <button onClick={() => shift(1)} className="p-2 text-slate-500 hover:text-slate-900" aria-label="Suivant"><ChevronRight size={16} /></button>
        </div>
        <div className="font-semibold text-slate-900 capitalize">{title}</div>
        {(busy || !data) && <Loader2 size={15} className="animate-spin text-slate-400" />}
        <span className="flex-1" />
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white border border-slate-200 text-sm">
          {[['week', 'Semaine', CalendarRange], ['month', 'Mois', CalendarDays]].map(([m, l, Icon]) => (
            <button key={m} onClick={() => setMode(m)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md ${mode === m ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}><Icon size={14} /> {l}</button>
          ))}
        </div>
      </div>
      {tours.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
          {tours.map((t) => <span key={t.code} className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: tourColor[t.code] }} />{t.label}
            <span className="text-slate-400">{t.days.length ? `(${t.days.map((d) => WEEKDAYS[d - 1]).join(', ')})` : '(jours non renseignés)'}</span></span>)}
          {mode === 'month' && <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-slate-400" /> tournée prévue, sans chargement</span>}
        </div>
      )}
      {error && <div className="text-sm text-red-700">{error}</div>}

      <div className="flex flex-col xl:flex-row gap-3 items-start">
        {mode === 'week' ? (
          <div className="flex-1 min-w-0 w-full grid grid-cols-1 md:grid-cols-7 gap-2">
            {days.map((day) => {
              const { groups, others, count } = dayGroups(day);
              return (
                <div key={day} {...dropProps(day)}
                  className={`rounded-xl border min-h-[120px] md:min-h-[420px] flex flex-col ${over === day ? 'border-blue-400 bg-blue-50/60' : day === today ? 'border-blue-200 bg-white' : 'border-slate-200 bg-white'}`}>
                  <div className={`px-2.5 py-2 border-b border-slate-100 flex items-baseline gap-1.5 ${day === today ? 'text-blue-700' : 'text-slate-700'}`}>
                    <span className="text-xs font-semibold uppercase">{WEEKDAYS[isoDow(day) - 1]}</span>
                    <span className="text-lg font-bold leading-none">{fmt(day, { day: 'numeric' })}</span>
                    <span className="ml-auto text-[11px] text-slate-400">{count || ''}</span>
                  </div>
                  <div className="p-1.5 space-y-2 flex-1">
                    {groups.map(({ tour, items, planned }) => (
                      <div key={tour.code} className="rounded-lg p-1 space-y-1" style={{ background: `${tourColor[tour.code]}0F` }}>
                        <div className="px-1 text-[10px] font-semibold truncate" style={{ color: tourColor[tour.code] }} title={tour.label}>{tour.label}{!planned && <span className="font-normal text-slate-400"> · hors jour prévu</span>}</div>
                        {items.map((s) => <Card key={s.id} s={s} tourColor={tourColor[tour.code]} onOpen={open} />)}
                        {items.length === 0 && (
                          <button onClick={() => createFor(day, tour)} className="w-full rounded-md border border-dashed px-2 py-1.5 text-[11px] text-slate-500 hover:text-blue-700 hover:border-blue-300 inline-flex items-center justify-center gap-1"
                            style={{ borderColor: `${tourColor[tour.code]}66` }}><Plus size={12} /> Chargement</button>
                        )}
                      </div>
                    ))}
                    {others.length > 0 && (
                      <div className="space-y-1">
                        {groups.length > 0 && <div className="px-1 text-[10px] font-semibold text-slate-400">Autres</div>}
                        {others.map((s) => <Card key={s.id} s={s} onOpen={open} />)}
                      </div>
                    )}
                    {count === 0 && groups.length === 0 && <button onClick={() => createFor(day, null)} className="hidden md:flex w-full h-full min-h-[60px] items-center justify-center text-slate-300 hover:text-blue-600"><Plus size={16} /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 min-w-0 w-full rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
              {WEEKDAYS.map((d) => <div key={d} className="px-2 py-1.5">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const { groups, others, count } = dayGroups(day);
                const items = [...groups.flatMap((g) => g.items.map((s) => [s, tourColor[g.tour.code]])), ...others.map((s) => [s, null])];
                const empty = groups.filter((g) => g.planned && g.items.length === 0);
                return (
                  <div key={day} {...dropProps(day)}
                    className={`min-h-[96px] border-b border-r border-slate-100 p-1 space-y-1 ${over === day ? 'bg-blue-50' : day.slice(0, 7) !== month ? 'bg-slate-50/70' : ''}`}>
                    <button onClick={() => { setAnchor(day); setMode('week'); }} className={`text-xs font-semibold px-1 rounded ${day === today ? 'bg-blue-600 text-white' : day.slice(0, 7) !== month ? 'text-slate-300' : 'text-slate-600 hover:text-blue-700'}`}>{fmt(day, { day: 'numeric' })}</button>
                    {items.slice(0, 4).map(([s, c]) => <Card key={s.id} s={s} tourColor={c} onOpen={open} compact />)}
                    {items.length > 4 && <button onClick={() => { setAnchor(day); setMode('week'); }} className="text-[10px] text-slate-500 hover:text-blue-700 px-1">+{items.length - 4} autre(s)</button>}
                    {empty.length > 0 && count === 0 && <div className="flex flex-wrap gap-0.5">{empty.map((g) => <span key={g.tour.code} title={`${g.tour.label} : aucun chargement`} className="w-2 h-2 rounded-full border" style={{ borderColor: tourColor[g.tour.code] }} />)}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <aside onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/plain'); if (id) move(id, null); }}
          className="w-full xl:w-56 shrink-0 rounded-xl border border-slate-200 bg-white">
          <div className="px-3 py-2 border-b border-slate-100 text-sm font-semibold text-slate-800 flex items-center gap-1.5"><Inbox size={15} /> Sans date <span className="text-slate-400 font-normal">· {undated.length}</span></div>
          <div className="p-1.5 space-y-1 max-h-[60vh] overflow-y-auto">
            {undated.length === 0 ? <div className="px-2 py-3 text-xs text-slate-400">Tous vos chargements à faire sont datés.</div>
              : undated.map((s) => <Card key={s.id} s={s} tourColor={s.tour ? tourColor[s.tour] : null} onOpen={open} />)}
          </div>
          <p className="px-3 pb-2 text-[11px] text-slate-400 hidden lg:block">Glissez un chargement sur un jour pour fixer sa date de départ.</p>
        </aside>
      </div>
    </div>
  );
}
