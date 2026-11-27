// Chargements : vue Liste (tableau, filtres par statut) ou Calendrier (semaine / mois, par tournée).
// Choix mémorisé dans ce navigateur ; ?vue=calendrier pour un lien direct.
import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { List, CalendarDays, Plus } from 'lucide-react';
import { useEspace } from '../useEspace';
import { listShipments, SOURCE } from '../data';
import DocList from '../DocList';
import { DocChip, fmtDate, pct, PageHeader, Btn } from '../ui';
import ShipmentsCalendar from './ShipmentsCalendar';
import { t as tr, N_, numLocale } from '../../shared/i18n/core';
import { fmtMoney } from '../../shared/units/units';

const VIEW_KEY = 'al.espace.shipments.view';

function ViewSwitch({ view, onChange }) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 text-sm">
      {[['liste', tr('Liste'), List], ['calendrier', tr('Calendrier'), CalendarDays]].map(([v, l, Icon]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md ${view === v ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-800'}`}>
          <Icon size={15} /> {l}
        </button>
      ))}
    </div>
  );
}

export default function Shipments() {
  const { org } = useEspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const stored = (() => { try { return localStorage.getItem(VIEW_KEY); } catch { return null; } })();
  const view = params.get('vue') ?? stored ?? 'liste';
  const setView = (v) => { try { localStorage.setItem(VIEW_KEY, v); } catch { /* indisponible */ } setParams(v === 'calendrier' ? { vue: v } : {}); };
  const fetch = useCallback(() => listShipments(org.id), [org.id]);
  useEffect(() => { if (view === 'calendrier') document.title = `${tr('Calendrier des chargements')} | Atelier Logistique`; }, [view]);
  const switcher = <ViewSwitch view={view} onChange={setView} />;

  if (view === 'calendrier') {
    return (
      <>
        <PageHeader title={tr('Chargements')} subtitle={tr('Calendrier des départs, par tournée')}
          actions={<>{switcher}<Btn onClick={() => navigate('/app/chargements/nouveau')}><Plus size={15} /> {tr('Nouveau chargement')}</Btn></>} />
        <ShipmentsCalendar />
      </>
    );
  }
  return (
    <DocList title={tr('Chargements')} subtitle={tr('Arrivés de votre WMS / ERP, d’un fichier, ou créés ici')} docTitle={tr('Chargements')} headerExtra={switcher}
      newLabel={tr('Nouveau chargement')} newPath="/app/chargements/nouveau" basePath="/app/chargements" fetch={fetch}
      columns={[
        { h: N_('Origine'), cell: (r) => SOURCE[r.source] ?? r.source },
        { h: N_('Départ'), cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.departure_at)}</span> },
        { h: N_('Tournée'), cell: (r) => r.tour ?? '—' },
        { h: N_('Transporteur'), cell: (r) => r.carrier ?? '—' },
        { h: N_('Coût théorique'), cell: (r) => (r.carrier_cost == null ? '—' : <span className="font-jetbrains text-xs whitespace-nowrap">{fmtMoney(r.carrier_cost)}</span>) },
        { h: N_('Véhicule'), cell: (r) => <span className="whitespace-nowrap">{r.result?.summary?.vehicle ?? '—'}</span> },
        { h: N_('Remplissage'), cell: (r) => pct(r.result?.summary?.fill) },
        { h: N_('Palettes de'), cell: (r) => (r.palletizations?.length
          ? <span className="flex flex-wrap gap-1">{r.palletizations.map((p) => <DocChip key={p.code} kind="pallet" to={`/app/palettisations/${p.code}`} code={p.code} />)}</span> : '—') },
      ]} />
  );
}
