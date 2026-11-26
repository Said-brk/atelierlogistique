// /app/transport : contrôle des factures transport, par mois.
//   Synthèse par transporteur (MPL réalisés / facturés, coût théorique vs facturé, écart, coût au MPL, remplissage),
//   détail par chargement avec saisie du montant facturé, import d'une facture (CSV / Excel copié) et export.
// Coût théorique = grille du transporteur (Paramètres › Transporteurs), figé à l'envoi au quai.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ChevronLeft, ChevronRight, Upload, Download, Receipt, X, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useEspace } from '../useEspace';
import useReferences from '../useReferences';
import { controlShipments, saveInvoice } from '../data';
import { PageHeader, Btn, ReferencesError } from '../ui';
import ResizableTable from '../ResizableTable';
import { controlRows, carrierStats, parseInvoiceCsv, matchInvoice, tolerance, TOLERANCE_KEY as TOL_KEY } from '../transport/control';

const eur = (v, d = 0) => (v == null ? '—' : `${Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: 2 })} €`);
const num1 = (v) => (v == null ? '—' : Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const pctTxt = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`);
const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const shiftMonth = (k, by) => { const [y, m] = k.split('-').map(Number); return monthKey(new Date(y, m - 1 + by, 1)); };
const monthLabel = (k) => { const [y, m] = k.split('-').map(Number); const s = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); return s[0].toUpperCase() + s.slice(1); };
const dayTxt = (s) => new Date(s.departure_at ?? s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
const parseAmount = (s) => { const t = String(s).replace(/[€\s ]/g, '').replace(',', '.'); if (t === '') return null; const v = Number(t); return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : undefined; };

const FLAG = {
  over: { cls: 'bg-red-50 text-red-700', label: 'Surfacturé' },
  under: { cls: 'bg-amber-50 text-amber-700', label: 'Sous le devis' },
  ok: { cls: 'bg-emerald-50 text-emerald-700', label: 'Conforme' },
  missing: { cls: 'bg-slate-100 text-slate-600', label: 'À facturer' },
  no_quote: { cls: 'bg-slate-100 text-slate-500', label: 'Sans devis' },
};

/** Cellule « montant facturé » éditable : enregistre à la sortie du champ. */
function AmountCell({ row, onSaved }) {
  const [v, setV] = useState(row.invoiced == null ? '' : String(row.invoiced).replace('.', ','));
  const [state, setState] = useState('');
  useEffect(() => { setV(row.invoiced == null ? '' : String(row.invoiced).replace('.', ',')); }, [row.invoiced]);
  const commit = async () => {
    const a = parseAmount(v);
    if (a === undefined) { setState('err'); return; }
    if (a === row.invoiced) return;
    setState('busy');
    try { onSaved(await saveInvoice(row.id, { invoiced_amount: a })); setState(''); } catch { setState('err'); }
  };
  return (
    <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input value={v} onChange={(e) => { setV(e.target.value); setState(''); }} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        inputMode="decimal" placeholder="—" aria-label={`Montant facturé ${row.code}`}
        className={`w-24 rounded-md border px-2 py-1 text-right font-jetbrains text-xs ${state === 'err' ? 'border-red-400' : 'border-slate-200'} focus:border-blue-400 outline-none`} />
      {state === 'busy' && <Loader2 size={12} className="animate-spin text-slate-400" />}
    </span>
  );
}

function ImportDialog({ list, onClose, onDone }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);
  const parsed = useMemo(() => (text.trim() ? parseInvoiceCsv(text) : null), [text]);
  const match = useMemo(() => (parsed ? matchInvoice(parsed.lines, list) : null), [parsed, list]);
  const apply = async () => {
    setBusy(true); setMsg('');
    let ok = 0;
    for (const { line, shipment } of match.matched) {
      try { await saveInvoice(shipment.id, { invoiced_amount: line.amount, ...(line.qty != null ? { invoiced_qty: line.qty } : {}), ...(line.invoice ? { invoice_ref: line.invoice } : {}) }); ok += 1; } catch (e) { setMsg(e.message); }
    }
    setBusy(false);
    onDone(ok);
  };
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <Upload size={18} className="text-blue-700" /><div className="font-semibold text-slate-900 flex-1">Importer une facture transporteur</div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <p className="text-slate-600">Fichier CSV ou lignes copiées depuis Excel, avec un en-tête. Colonnes reconnues : <b>Référence</b> (n° de chargement CH-… ou réf. WMS / ERP), <b>Montant</b>, et si présents <b>Quantité / MPL</b> et <b>N° facture</b>.</p>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={() => fileRef.current?.click()}><Upload size={15} /> Choisir un fichier</Btn>
            <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden"
              onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={'Référence;Montant;MPL;N° facture\nCH-0012;685,40;6,8;F-2026-118'}
            className="w-full rounded-lg border border-slate-200 p-2 font-jetbrains text-xs" />
          {parsed?.errors.map((e) => <div key={e} className="text-xs text-red-700">{e}</div>)}
          {match && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-700"><CheckCircle2 size={15} /> {match.matched.length} ligne(s) rapprochée(s) d’un chargement du mois</div>
              {match.unmatched.length > 0 && <div className="flex items-start gap-1.5 text-amber-700"><AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>{match.unmatched.length} référence(s) inconnue(s) ce mois-ci : {match.unmatched.slice(0, 8).map((l) => l.ref).join(', ')}{match.unmatched.length > 8 ? '…' : ''}</span></div>}
            </div>
          )}
          {msg && <div className="text-xs text-red-700">{msg}</div>}
        </div>
        <div className="sticky bottom-0 bg-white px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
          <Btn onClick={apply} disabled={busy || !match?.matched.length}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Receipt size={15} />} Enregistrer {match?.matched.length || ''} montant(s)</Btn>
        </div>
      </div>
    </div>
  );
}

function exportCsv(rows, month) {
  const head = ['Chargement', 'Réf. WMS / ERP', 'Départ', 'Tournée', 'Transporteur', 'MPL réalisés', 'Qté facturée', 'Coût théorique', 'Facturé', 'Écart', 'Écart %', 'N° facture', 'Contrôle'];
  const f = (v) => (v == null ? '' : String(v).replace('.', ','));
  const lines = rows.map((r) => [r.code, r.external_id ?? '', dayTxt(r), r.tour ?? '', r.carrier ?? '', f(r.ldm), f(r.qtyBilled), f(r.theoretical), f(r.invoiced), f(r.gap),
    r.gapPct == null ? '' : r.gapPct.toFixed(1).replace('.', ','), r.invoice_ref ?? '', FLAG[r.flag].label]);
  const csv = '﻿' + [head, ...lines].map((l) => l.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(';')).join('\r\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: `controle-transport-${month}.csv` });
  a.click(); URL.revokeObjectURL(a.href);
}

export default function TransportControlPage() {
  const { org } = useEspace();
  const refs = useReferences();
  const navigate = useNavigate();
  const [month, setMonth] = useState(monthKey());
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [carrier, setCarrier] = useState('');
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [tol, setTol] = useState(tolerance);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState('');

  const load = () => { setList(null); setError(''); controlShipments(org.id, month).then(setList).catch((e) => { setError(e.message); setList([]); }); };
  useEffect(load, [org.id, month]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem(TOL_KEY, String(tol)); } catch { /* stockage indisponible */ } }, [tol]);

  const names = useMemo(() => Object.fromEntries((refs.items ?? []).filter((i) => i.kind === 'carrier').map((c) => [c.code, c.label])), [refs.items]);
  const rows = useMemo(() => controlRows(list ?? [], tol), [list, tol]);
  const stats = useMemo(() => carrierStats(rows), [rows]);
  const shown = rows.filter((r) => (!carrier || r.carrier === carrier) && (!onlyFlagged || r.flag === 'over' || r.flag === 'under'));
  const total = stats.reduce((t, s) => ({ th: t.th + s.theoretical, inv: t.inv + s.invoiced, gap: t.gap + s.gap, flagged: t.flagged + s.flagged }), { th: 0, inv: 0, gap: 0, flagged: 0 });
  const onSaved = (d) => setList((l) => l.map((x) => (x.id === d.id ? { ...x, ...d } : x)));

  const nw = (x) => <span className="whitespace-nowrap">{x}</span>;
  const statCols = [
    { key: 'carrier', h: 'Transporteur', min: 120, cell: (s) => <span className="font-medium text-slate-900">{names[s.carrier] ?? s.carrier}</span> },
    { key: 'n', h: 'Chargements', cell: (s) => <span className="whitespace-nowrap">{s.shipments}<span className="text-slate-400"> · {s.invoicedCount} facturé{s.invoicedCount > 1 ? 's' : ''}</span></span> },
    { key: 'ldm', h: 'MPL réalisés', cell: (s) => <span className="font-jetbrains text-xs">{num1(s.ldm)}</span> },
    { key: 'ldmb', h: 'MPL facturés', cell: (s) => <span className={`font-jetbrains text-xs ${s.ldmBilled != null && s.ldmBilled > s.ldm * 1.02 ? 'text-red-700 font-semibold' : ''}`}>{num1(s.ldmBilled)}</span> },
    { key: 'th', h: 'Coût théorique', cell: (s) => nw(eur(s.theoretical)) },
    { key: 'inv', h: 'Facturé', cell: (s) => <b className="whitespace-nowrap">{eur(s.invoiced)}</b> },
    { key: 'gap', h: 'Écart', cell: (s) => <span className={`whitespace-nowrap ${s.gap > 0 ? 'text-red-700 font-semibold' : s.gap < 0 ? 'text-emerald-700' : ''}`}>{s.invoicedCount ? `${eur(s.gap)} (${pctTxt(s.gapPct)})` : '—'}</span> },
    { key: 'cpl', h: '€ / MPL', cell: (s) => nw(eur(s.costPerLdm, 2)) },
    { key: 'cpp', h: '€ / palette', cell: (s) => nw(eur(s.costPerPallet, 2)) },
    { key: 'fill', h: 'Remplissage', cell: (s) => (s.fill == null ? '—' : `${Math.round(s.fill * 100)} %`) },
    { key: 'fl', h: 'Écarts', cell: (s) => (s.flagged ? <span className="rounded-full bg-red-50 text-red-700 text-xs font-semibold px-2 py-0.5">{s.flagged}</span> : '0') },
  ];
  const rowCols = [
    { key: 'code', h: 'Chargement', cell: (r) => <span className="font-jetbrains text-xs text-blue-700">{r.code}</span> },
    { key: 'day', h: 'Départ', cell: (r) => dayTxt(r) },
    { key: 'label', h: 'Libellé', min: 120, cell: (r) => <span className="text-slate-700">{r.label || r.external_id || '—'}</span> },
    { key: 'carrier', h: 'Transporteur', cell: (r) => names[r.carrier] ?? r.carrier },
    { key: 'ldm', h: 'MPL', cell: (r) => <span className="font-jetbrains text-xs">{num1(r.ldm)}</span> },
    { key: 'th', h: 'Théorique', cell: (r) => <span title={r.carrier_quote?.error ?? ''}>{eur(r.theoretical, 0)}</span> },
    { key: 'inv', h: 'Facturé', cell: (r) => <AmountCell row={r} onSaved={onSaved} /> },
    { key: 'gap', h: 'Écart', cell: (r) => (r.gap == null ? '—' : <span className={`whitespace-nowrap ${r.flag === 'over' ? 'text-red-700 font-semibold' : r.flag === 'under' ? 'text-amber-700' : ''}`}>{eur(r.gap)} ({pctTxt(r.gapPct)})</span>) },
    { key: 'ref', h: 'N° facture', cell: (r) => <span className="font-jetbrains text-xs">{r.invoice_ref ?? '—'}</span> },
    { key: 'flag', h: 'Contrôle', cell: (r) => <span className={`rounded-full text-xs font-medium px-2 py-0.5 whitespace-nowrap ${FLAG[r.flag].cls}`}>{FLAG[r.flag].label}</span> },
  ];

  return (
    <>
      <PageHeader title="Contrôle transport" subtitle="Coût théorique (grille du transporteur) face au montant facturé, par mois."
        actions={<>
          <Btn variant="ghost" onClick={() => setImporting(true)} disabled={!list?.length}><Upload size={15} /> Importer une facture</Btn>
          <Btn variant="ghost" onClick={() => exportCsv(shown, month)} disabled={!shown.length}><Download size={15} /> Export</Btn>
        </>} />
      <div className="px-5 sm:px-8 py-5 space-y-4">
        {refs.error && <ReferencesError error={refs.error} onRetry={refs.reload} />}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
            <button onClick={() => setMonth(shiftMonth(month, -1))} className="p-2 text-slate-500 hover:text-slate-900" aria-label="Mois précédent"><ChevronLeft size={16} /></button>
            <span className="px-2 text-sm font-medium text-slate-800 min-w-[9rem] text-center">{monthLabel(month)}</span>
            <button onClick={() => setMonth(shiftMonth(month, 1))} className="p-2 text-slate-500 hover:text-slate-900" aria-label="Mois suivant"><ChevronRight size={16} /></button>
          </div>
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="">Tous les transporteurs</option>
            {stats.map((s) => <option key={s.carrier} value={s.carrier}>{names[s.carrier] ?? s.carrier}</option>)}
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} /> Écarts seulement</label>
          <label className="inline-flex items-center gap-1.5 text-sm text-slate-600 ml-auto">Tolérance
            <input value={tol} onChange={(e) => setTol(Math.max(0, Number(e.target.value.replace(',', '.')) || 0))} inputMode="decimal" className="w-14 rounded-md border border-slate-200 px-2 py-1 text-right font-jetbrains text-xs" /> %</label>
        </div>
        {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 flex items-center gap-2"><CheckCircle2 size={16} /> <span className="flex-1">{notice}</span><button onClick={() => setNotice('')} aria-label="Fermer"><X size={15} /></button></div>}
        {error && <div className="text-sm text-red-700">{error}</div>}
        {list === null ? <div className="p-10 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div> : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Aucun chargement avec transporteur en {monthLabel(month).toLowerCase()}.<br />
            Choisissez un transporteur sur vos chargements (Paramètres › Tables de référence › Transporteurs pour en créer).
          </div>
        ) : (<>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { l: 'Coût théorique', v: eur(total.th) },
              { l: 'Facturé', v: eur(total.inv) },
              { l: 'Écart (chargements facturés)', v: eur(total.gap), cls: total.gap > 0 ? 'text-red-700' : total.gap < 0 ? 'text-emerald-700' : '' },
              { l: `Écarts > ${tol} %`, v: total.flagged, cls: total.flagged ? 'text-red-700' : '' },
            ].map((k) => (
              <div key={k.l} className="rounded-xl bg-white border border-slate-200 p-4">
                <div className="font-jetbrains text-[10px] uppercase text-slate-400">{k.l}</div>
                <div className={`font-bricolage font-bold text-2xl mt-1 ${k.cls ?? 'text-slate-900'}`}>{k.v}</div>
              </div>
            ))}
          </div>
          <section className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-900 text-sm">Par transporteur</div>
            <ResizableTable id="transport-carriers" rows={stats} rowKey={(s) => s.carrier} columns={statCols} onRowClick={(s) => setCarrier(s.carrier === carrier ? '' : s.carrier)}
              theadClass="bg-slate-50 text-left text-xs text-slate-500" thClass="px-4 py-2 font-medium" />
          </section>
          <section className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-900 text-sm">Chargements <span className="text-slate-400 font-normal">· {shown.length}</span></div>
            <ResizableTable id="transport-rows" rows={shown} columns={rowCols} onRowClick={(r) => navigate(`/app/chargements/${r.code}`)}
              theadClass="bg-slate-50 text-left text-xs text-slate-500" thClass="px-4 py-2 font-medium" />
          </section>
          <p className="text-xs text-slate-400 flex gap-1.5"><Info size={14} className="shrink-0" />
            Le coût théorique est calculé avec la grille du transporteur à l’enregistrement du chargement, puis figé à l’envoi au quai. « Sans devis » : transporteur choisi mais plan non calculé (relancez le calcul).</p>
        </>)}
      </div>
      {importing && <ImportDialog list={list ?? []} onClose={() => setImporting(false)}
        onDone={(n) => { setImporting(false); setNotice(`${n} montant(s) facturé(s) enregistré(s).`); load(); }} />}
    </>
  );
}
