// Liste générique de documents de l'espace (chargements, palettisations) : onglets par statut,
// recherche, tableau cliquable aux colonnes redimensionnables. Les colonnes sont fournies par la page.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Loader2, Inbox } from 'lucide-react';
import { STATUS } from './data';
import { t as tr, N_ } from '../shared/i18n/core';
import { PageHeader, StatusBadge, Btn, fmtDateTime } from './ui';
import ResizableTable from './ResizableTable';

const TABS = [['', N_('Tous')], ['new', N_('Nouveaux')], ['in_progress', N_('En cours')], ['validated', N_('Validés')], ['sent', N_('Envoyés')], ['partially_loaded', N_('En partie')], ['loaded', N_('Chargés')]];

export default function DocList({ title, subtitle, newLabel, newPath, basePath, fetch, columns, docTitle, searchFields = ['code', 'label', 'external_id'], headerExtra = null }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('statut') ?? '';
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { document.title = `${docTitle} | Atelier Logistique`; }, [docTitle]);
  useEffect(() => { fetch().then(setRows).catch((e) => { setError(e.message); setRows([]); }); }, [fetch]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => (!status || r.status === status)
      && (!s || searchFields.some((f) => String(r[f] ?? '').toLowerCase().includes(s))));
  }, [rows, status, q, searchFields]);

  const cols = [
    { h: N_('N°'), cell: (r) => <span className="font-jetbrains text-xs text-blue-700 whitespace-nowrap">{r.code}</span> },
    { h: N_('Libellé'), cell: (r) => <span className="font-medium text-slate-900 block truncate">{r.label || '—'}</span> },
    { h: N_('Réf. WMS / ERP'), cell: (r) => r.external_id || '—' },
    ...columns,
    { h: N_('Mis à jour'), cell: (r) => <span className="text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(r.updated_at)}</span> },
    { h: N_('Statut'), cell: (r) => <StatusBadge status={r.status} /> },
  ].map((c) => ({ key: c.key ?? c.h, ...c, h: tr(c.h) })); // clé = libellé français : largeurs mémorisées quelle que soit la langue

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={<>{headerExtra}<Btn onClick={() => navigate(newPath)}><Plus size={15} /> {newLabel}</Btn></>}>
        <div className="px-5 sm:px-8 flex gap-1 overflow-x-auto">
          {TABS.map(([v, l]) => {
            const n = v ? rows?.filter((r) => r.status === v).length : rows?.length;
            return (
              <button key={v} onClick={() => setParams(v ? { statut: v } : {})}
                className={`px-3 py-2.5 text-sm border-b-2 whitespace-nowrap ${status === v ? 'border-blue-600 text-blue-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                {tr(l)} {rows && <span className="text-xs text-slate-400 ml-0.5">{n}</span>}
              </button>
            );
          })}
        </div>
      </PageHeader>
      <div className="px-5 sm:px-8 py-5 space-y-4">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Rechercher n°, libellé, réf. WMS…')}
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          {rows === null ? <div className="p-10 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>
            : shown.length === 0 ? (
              <div className="p-10 text-center text-slate-500"><Inbox className="mx-auto text-slate-300" size={32} />
                <div className="mt-2 text-sm">{status ? tr('Rien en « {s} »', { s: STATUS[status].label }) : tr('Rien pour l’instant')}</div></div>
            ) : (
              <ResizableTable id={basePath} columns={cols} rows={shown} onRowClick={(r) => navigate(`${basePath}/${r.code}`)} />
            )}
          {error && <div className="px-5 py-3 text-sm text-red-700">{error}</div>}
        </div>
      </div>
    </>
  );
}
