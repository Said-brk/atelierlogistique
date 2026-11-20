// Palettisation 3D : des colis aux palettes, puis envoi en un clic vers l'optimiseur de chargement.
// Réutilise : le tableau colis, l'assistant d'import et le moteur 3D de l'optimiseur.

import { useState, useMemo, useEffect, lazy, Suspense, Component } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, Download, Boxes, Loader2, Truck, Printer, AlertCircle, Check, ArrowRight, Layers,
} from 'lucide-react';
import ColisTable from '../optimiseur-chargement/components/ColisTable';
import {
  emptyRow, coerceField, stackingFields, rowsToDefinitions, rowsAreValid, refColor, newRowId,
  formatKg,
} from '../optimiseur-chargement/uiHelpers';
import { track } from '../optimiseur-chargement/analytics';
import { createLocalProfileStore, toCsv, downloadText } from '../../shared/import';
import { sendHandoff } from '../../shared/handoff';
import { COLIS_SCHEMA, STANDARD_HEADERS, STANDARD_SAMPLE, recordsToColisRows } from '../optimiseur-chargement/import/colisSchema';
import { palletizeMulti } from './engine/palletize';
import SupportsPanel from './SupportsPanel';
import { loadSupports, saveSupports, matchSupport } from './supportsStore';
import { palletsToLoadRecords, palletLabel, palletStackingLabel, HEAVY_PALLET_KG } from './engine/toLoad';

const LoadView3D = lazy(() => import('../optimiseur-chargement/LoadView3D.jsx'));
const ImportWizard = lazy(() => import('../../shared/import/ImportWizard.jsx'));

const BLUE = '#2563EB';
const BLUE_LIGHT = '#EFF6FF';
const AMBER = '#F59E0B';
const importProfiles = createLocalProfileStore();
const IMPORT_EXTRA_OPTIONS = [
  { id: 'stopsFromDestination', label: 'Un arrêt par destination', help: 'sans colonne Arrêt, chaque client devient un arrêt, dans l’ordre du fichier.' },
];

class ViewBoundary extends Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

// Tournée de démonstration : 3 magasins, cartons de tailles courantes.
function exampleRows() {
  const r = (reference, quantity, length, width, height, weight, stop, destination, extra = {}) => ({
    id: newRowId(), reference, quantity, length, width, height, weight, rotationMode: 'HORIZONTAL',
    stackable: true, floorOnly: false, stop, destination, ...extra,
  });
  return [
    r('CARTON-40x30', 110, 40, 30, 25, 8, 1, 'Nanterre'),
    r('CARTON-60x40', 45, 60, 40, 30, 14, 1, 'Nanterre'),
    r('SAC-25KG', 30, 60, 40, 15, 25, 2, 'Massy'),
    r('VERRERIE', 20, 40, 30, 30, 6, 2, 'Massy', { stackable: false }),
    r('CARTON-30x20', 70, 30, 20, 20, 4, 3, 'Créteil'),
  ];
}

const mmToCm = (v) => Math.round(v) / 10;
const fmtCm = (mm) => mmToCm(mm).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const pct = (r) => `${Math.round(r * 100)} %`;
/** Type affiché : complète (couches pleines), mono-référence incomplète, ou mixte. */
const kindLabel = (p) => (p.kind === 'FULL' ? 'complète' : p.contents.length === 1 ? 'mono-référence' : 'mixte');
const isMixed = (p) => p.contents.length > 1;

function Toggle({ checked, onChange, label, help }) {
  return (
    <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
      <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}{help && <span className="block text-[11px] text-slate-500">{help}</span>}</span>
    </label>
  );
}

function Kpi({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="font-jetbrains text-[10px] text-slate-500">{label}</div>
      <div className="font-bricolage font-bold text-xl text-slate-900">{value}</div>
      {sub && <div className="font-jetbrains text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}

/** Vue de dessus d'une palette (SVG) : utilisée dans la fiche imprimable et en repli 2D. */
function TopView({ pallet, spec, colorOf, size = 220 }) {
  const scale = size / Math.max(spec.length, spec.width);
  const w = spec.length * scale;
  const h = spec.width * scale;
  // On dessine du bas vers le haut : les colis du dessus recouvrent ceux du dessous.
  const items = [...pallet.placed].sort((a, b) => a.z - b.z);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <rect x={0} y={0} width={w} height={h} fill="#E7D3B1" stroke="#8B6B3E" />
      {items.map((p) => (
        <rect key={p.id} x={p.x * scale} y={p.y * scale} width={p.length * scale} height={p.width * scale}
          fill={colorOf(p).solid} stroke={colorOf(p).dark} strokeWidth={0.6} opacity={0.9} />
      ))}
    </svg>
  );
}

const PRINT_CSS = `
.pz-print-sheet { display: none; }
@media print {
  @page { size: A4; margin: 12mm; }
  html, body { background: #fff !important; height: auto !important; min-height: 0 !important; }
  body > *:not(.pz-print-root) { display: none !important; }
  .pz-print-root, .pz-print-sheet { display: block !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pz-pallet { break-inside: avoid; page-break-inside: avoid; }
}
`;

function PrintSheet({ result, colorOf }) {
  const specOf = (p) => result.specs.find((s) => s.id === p.specId) ?? result.specs[0];
  const used = [...new Set(result.pallets.map((p) => specOf(p).label))].join(', ');
  const date = new Date().toLocaleDateString('fr-FR');
  return (
    <div className="pz-print-sheet" style={{ fontFamily: "'DM Sans', system-ui, sans-serif", color: '#0F172A' }}>
      <style>{PRINT_CSS}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #0F172A', paddingBottom: 6, marginBottom: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Plan de palettisation</div>
        <div style={{ fontSize: 10, color: '#475569' }}>{date} · {used} · atelierlogistique.com</div>
      </div>
      <div style={{ fontSize: 11, marginBottom: 10 }}>
        {result.pallets.length} palette(s) · {result.palletizedItems} colis · {formatKg(result.pallets.reduce((s, p) => s + p.totalWeight, 0))} kg (tare incluse)
        {result.unplaced.length > 0 && <span style={{ color: '#B91C1C' }}> · {result.unplaced.reduce((s, u) => s + u.quantity, 0)} colis non palettisés</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {result.pallets.map((p) => (
          <div key={p.id} className="pz-pallet" style={{ border: '1px solid #CBD5E1', borderRadius: 6, padding: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
              <span>{p.id} · {kindLabel(p)} · {specOf(p).label}</span>
              <span>Arrêt {p.stop}{p.destination ? ` · ${p.destination}` : ''}</span>
            </div>
            <div style={{ fontSize: 10, color: '#475569', margin: '2px 0 6px' }}>
              H {fmtCm(p.totalHeight)} cm · {formatKg(p.totalWeight)} kg{p.kind === 'FULL' ? ` · ${p.layers} couches × ${p.perLayer} (alternées)` : ''} · {p.stackable ? 'gerbable' : 'non gerbable'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <TopView pallet={p} spec={specOf(p)} colorOf={colorOf} size={130} />
              <table style={{ fontSize: 10, borderCollapse: 'collapse', flex: 1 }}>
                <tbody>
                  {p.contents.map((c) => (
                    <tr key={c.definitionId} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '2px 4px' }}>{c.reference}</td>
                      <td style={{ padding: '2px 4px', textAlign: 'right', fontWeight: 700 }}>×{c.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Palletizer({ onBack }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState(exampleRows);
  const [supports, setSupports] = useState(loadSupports);
  const [fullFirst, setFullFirst] = useState(true);
  const [separateStops, setSeparateStops] = useState(true);
  const [formatMode, setFormatMode] = useState('stop'); // 'stop' | 'shipment' | 'free'
  const [forcedStops, setForcedStops] = useState({});
  const [stacking, setStacking] = useState('AUTO');
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Palettisation 3D en ligne : plan de palette et palettes mixtes | Atelier Logistique';
    return () => { document.title = prev; };
  }, []);

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 7000); };
  const invalidate = () => { setResult(null); setActive(0); };

  const updateRow = (id, field, value) => { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: coerceField(field, value) } : r))); invalidate(); };
  const updateStacking = (id, value) => { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...stackingFields(value) } : r))); invalidate(); };
  const removeRow = (id) => { setRows((rs) => rs.filter((r) => r.id !== id)); invalidate(); };
  const addRow = () => setRows((rs) => [...rs, { ...emptyRow(), rotationMode: 'HORIZONTAL' }]);

  const changeSupports = (next) => { setSupports(next); saveSupports(next); invalidate(); };
  const available = useMemo(() => supports.filter((s) => s.available && s.length > 0 && s.width > 0), [supports]);
  const stops = useMemo(() => {
    const m = new Map();
    for (const r of rows) { const st = r.stop ?? 1; if (!m.has(st)) m.set(st, r.destination || ''); }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [rows]);
  const supportSelect = useMemo(() => ({
    field: 'support', label: 'Support', title: 'Support imposé pour cette ligne (vide = automatique)',
    options: [{ value: '', label: 'Auto' }, ...available.map((s) => ({ value: s.id, label: s.label.split(' ')[0] }))],
  }), [available]);

  const colorIndex = useMemo(() => Object.fromEntries(rows.map((r, i) => [r.id, i])), [rows]);
  const colorOf = (item) => refColor(colorIndex[item.definitionId] ?? 0);
  const valid = rowsAreValid(rows) && available.length > 0;
  const specOf = (p) => result?.specs.find((s) => s.id === p.specId) ?? available[0];

  const run = () => {
    if (!valid) return;
    setRunning(true);
    // Laisse le navigateur afficher l'indicateur avant le calcul.
    setTimeout(() => {
      // Support imposé par ligne : saisi dans le tableau ou importé (EUR, EUR3, 120x100…).
      const forcedByDefinition = {};
      for (const row of rows) {
        const sp = matchSupport(row.support, available);
        if (sp) forcedByDefinition[row.id] = sp.id;
      }
      const forcedByStop = Object.fromEntries(Object.entries(forcedStops).filter(([, v]) => available.some((s) => s.id === v)));
      const r = palletizeMulti(rowsToDefinitions(rows), available, {
        fullPalletsFirst: fullFirst, separateStops, oneFormatPerStop: formatMode !== 'free', oneFormatPerShipment: formatMode === 'shipment', forcedByDefinition, forcedByStop,
      });
      setResult(r);
      setActive(0);
      setRunning(false);
      track('pallet_calculated', { pallets: r.pallets.length, items: r.totalItems });
      setTimeout(() => document.getElementById('pz-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }, 30);
  };

  const onImported = ({ records, options, mode, source }) => {
    const mapped = recordsToColisRows(records, { stopsFromDestination: !!options.stopsFromDestination }).map((r) => ({ id: newRowId(), ...r }));
    if (mapped.length === 0) return;
    setRows((rs) => (mode === 'append' ? [...rs.filter((r) => r.reference || r.length), ...mapped] : mapped));
    setImportOpen(false);
    invalidate();
    flash('success', `${mapped.length} ligne(s) importée(s)${source ? ` depuis « ${source} »` : ''}.`);
  };

  const downloadStandardCsv = () => downloadText('atelier-logistique-colis-format-standard.csv', toCsv(STANDARD_HEADERS, STANDARD_SAMPLE));

  const exportCsv = () => {
    if (!result) return;
    const headers = ['Palette', 'Type', 'Support', 'Arrêt', 'Destination', 'Référence', 'Quantité', 'Couches', 'Colis par couche',
      'Longueur (cm)', 'Largeur (cm)', 'Hauteur totale (cm)', 'Poids total (kg)', 'Remplissage (%)', 'Gerbage'];
    const lines = result.pallets.flatMap((p) => p.contents.map((c) => [
      p.id, kindLabel(p), specOf(p).label, p.stop, p.destination, c.reference, c.quantity,
      p.layers || '', p.perLayer || '', mmToCm(specOf(p).length), mmToCm(specOf(p).width), mmToCm(p.totalHeight),
      Math.round(p.totalWeight * 10) / 10, Math.round(p.volumeFill * 100), palletStackingLabel(p, stacking),
    ]));
    downloadText(`palettisation-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(headers, lines));
    track('pallet_export_csv');
  };

  const sendToTruck = () => {
    if (!result || result.pallets.length === 0) return;
    sendHandoff('optimiseur-chargement', {
      schemaId: COLIS_SCHEMA.id,
      schemaVersion: COLIS_SCHEMA.version,
      source: { tool: 'pallet', label: 'Palettisation 3D' },
      records: palletsToLoadRecords(result.pallets, result.specs, stacking),
      extra: { unitLabel: 'palette(s)' },
    });
    track('pallet_sent_to_load_optimizer', { pallets: result.pallets.length });
    navigate('/outils/optimiseur-chargement');
  };

  const pallet = result?.pallets[active] ?? null;
  const spec = pallet ? specOf(pallet) : null;
  const palletContainer = spec ? { id: 'pal', label: spec.label, length: spec.length, width: spec.width, height: Math.max(1, spec.maxTotalHeight - spec.deckHeight), maxWeight: spec.maxLoad } : null;
  const totals = useMemo(() => {
    if (!result) return null;
    const ps = result.pallets;
    return {
      full: ps.filter((p) => p.kind === 'FULL').length,
      mixed: ps.filter(isMixed).length,
      weight: ps.reduce((s, p) => s + p.totalWeight, 0),
      maxH: ps.reduce((m, p) => Math.max(m, p.totalHeight), 0),
      fill: ps.length ? ps.reduce((s, p) => s + p.volumeFill, 0) / ps.length : 0,
      stops: new Set(ps.map((p) => p.stop)).size,
      unplaced: result.unplaced.reduce((s, u) => s + u.quantity, 0),
      bySupport: Object.entries(ps.reduce((m, p) => { const l = (result.specs.find((x) => x.id === p.specId)?.label ?? p.specId).split(' ')[0]; m[l] = (m[l] ?? 0) + 1; return m; }, {})),
      cost: ps.reduce((s, p) => s + (result.specs.find((x) => x.id === p.specId)?.cost ?? 0), 0),
    };
  }, [result]);

  return (
    <div className="min-h-screen text-slate-900" style={{ background: '#F8FAFC', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-20 print:hidden">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-jetbrains text-xs">
              <ArrowLeft size={14} /> RETOUR
            </button>
            <div className="w-px h-5 bg-slate-200 hidden sm:block" />
            <div className="hidden sm:block">
              <div className="font-bricolage font-semibold text-sm leading-tight text-slate-900">Palettisation 3D</div>
              <div className="font-jetbrains text-[10px] text-slate-500">ATELIER / PALETTISATION</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 font-jetbrains text-[10px] text-slate-500 tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} /> CALCUL DANS LE NAVIGATEUR
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-5 sm:pt-8 pb-1 sm:pb-2">
        <h1 className="font-bricolage font-bold text-2xl md:text-3xl text-slate-900">Palettisation 3D</h1>
        <p className="text-slate-600 mt-1 text-sm sm:text-base">Préparez vos palettes complètes et mixtes, puis chargez-les dans le camion en un clic.</p>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 space-y-4 sm:space-y-5">
        {/* 1. Colis */}
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="font-jetbrains text-xs text-slate-600 flex items-center gap-2"><Boxes size={13} /> 1 · QUE SOUHAITEZ-VOUS PALETTISER ?</div>
            <div className="grid grid-cols-4 sm:flex sm:items-center gap-1.5">
              <button onClick={() => setImportOpen(true)} className="col-span-2 flex items-center justify-center gap-1 font-jetbrains text-[11px] px-2.5 py-2 sm:py-1.5 rounded-md" style={{ background: BLUE, color: '#fff' }}><Upload size={11} /> Importer / coller</button>
              <button onClick={downloadStandardCsv} className="flex items-center justify-center gap-1 font-jetbrains text-[11px] px-2.5 py-2 sm:py-1.5 rounded-md" style={{ background: '#F1F5F9', color: '#475569' }}><Download size={11} /> Modèle</button>
              <button onClick={() => { setRows(exampleRows()); invalidate(); }} className="flex items-center justify-center font-jetbrains text-[11px] px-2.5 py-2 sm:py-1.5 rounded-md" style={{ background: BLUE_LIGHT, color: BLUE }}>Exemple</button>
            </div>
          </div>
          {importOpen && (
            <Suspense fallback={null}>
              <ImportWizard schema={COLIS_SCHEMA} store={importProfiles} onImport={onImported} onClose={() => setImportOpen(false)}
                extraOptions={IMPORT_EXTRA_OPTIONS} footerLinks={[{ label: 'Format standard (CSV)', onClick: downloadStandardCsv }]} />
            </Suspense>
          )}
          {msg && (
            <div className="mx-4 mt-3 text-[11px] font-jetbrains px-3 py-2 rounded-md" style={msg.type === 'error'
              ? { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }
              : { background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>{msg.text}</div>
          )}
          <ColisTable rows={rows} updateRow={updateRow} updateStacking={updateStacking} removeRow={removeRow} addRow={addRow}
            extraSelect={available.length > 1 ? supportSelect : null}
            footerHint="dimensions en cm · poids en kg · un arrêt = des palettes séparées" />
        </div>

        {/* 2. Palette + options */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-5 items-start">
          <div className="xl:col-span-3">
            <SupportsPanel supports={supports} onChange={changeSupports} />
          </div>

          <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="font-jetbrains text-xs text-slate-600 flex items-center gap-2"><Layers size={13} /> 3 · RÈGLES DE PALETTISATION</div>
            <Toggle checked={fullFirst} onChange={(v) => { setFullFirst(v); invalidate(); }} label="Palettes complètes mono-référence d’abord"
              help="Plan de couche optimisé et couches alternées ; seuls les reliquats partent en palettes mixtes." />
            <Toggle checked={separateStops} onChange={(v) => { setSeparateStops(v); invalidate(); }} label="Une palette = un seul arrêt"
              help="Aucune palette ne mélange deux destinations (déchargement sans dépalettiser)." />
            {available.length > 1 && (
              <label className="block text-xs text-slate-700">
                <span className="block mb-1">Format de palette</span>
                <select value={formatMode} onChange={(e) => { setFormatMode(e.target.value); invalidate(); }}
                  className="w-full text-base sm:text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white">
                  <option value="stop">Un format par destination (recommandé)</option>
                  <option value="shipment">Un seul format pour tout l’envoi (même camion)</option>
                  <option value="free">Libre : le meilleur support par référence</option>
                </select>
                <span className="block text-[11px] text-slate-500 mt-0.5">Mélanger 80 et 100 cm de large dans un camion désaligne les rangées et fait perdre de la place.</span>
              </label>
            )}
            {separateStops && available.length > 1 && stops.length > 0 && (
              <div className="rounded-lg border border-slate-200 px-3 py-2 space-y-1.5">
                <div className="font-jetbrains text-[10px] text-slate-500">SUPPORT EXIGÉ PAR LE DESTINATAIRE</div>
                {stops.map(([st, dest]) => (
                  <label key={st} className="flex items-center gap-2 text-xs text-slate-700">
                    <span className="flex-1 truncate">Arrêt {st}{dest ? ` · ${dest}` : ''}</span>
                    <select value={forcedStops[st] ?? ''} onChange={(e) => { setForcedStops((f) => ({ ...f, [st]: e.target.value })); invalidate(); }}
                      className="text-base sm:text-xs border border-slate-200 rounded-md px-2 py-1 bg-white">
                      <option value="">Automatique</option>
                      {available.map((sp) => <option key={sp.id} value={sp.id}>{sp.label}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div><div className="font-jetbrains text-[10px] text-slate-500">Colis</div><div className="font-bricolage font-bold text-xl" style={{ color: BLUE }}>{rows.reduce((s, r) => s + (r.quantity || 0), 0)}</div></div>
              <div><div className="font-jetbrains text-[10px] text-slate-500">Références</div><div className="font-bricolage font-bold text-xl text-slate-800">{rows.length}</div></div>
              <div><div className="font-jetbrains text-[10px] text-slate-500">Arrêts</div><div className="font-bricolage font-bold text-xl text-slate-800">{new Set(rows.map((r) => r.stop ?? 1)).size}</div></div>
            </div>
            <button onClick={run} disabled={!valid || running}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-jetbrains text-sm font-medium text-white"
              style={{ background: valid ? BLUE : '#CBD5E1' }}>
              {running ? <><Loader2 size={15} className="animate-spin" /> Calcul…</> : <>Calculer la palettisation <ArrowRight size={15} /></>}
            </button>
            {!valid && <div className="text-[11px] text-red-600 flex items-center gap-1"><AlertCircle size={12} /> {available.length === 0 ? 'Cochez au moins un support disponible.' : 'Complétez les lignes du tableau.'}</div>}
          </div>
        </div>

        {/* Résultats */}
        {result && totals && (
          <div id="pz-result" className="grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-5 items-start scroll-mt-20">
            <div className="xl:col-span-3 rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-1.5">
                {result.pallets.map((p, i) => (
                  <button key={p.id} onClick={() => setActive(i)} className="font-jetbrains text-[11px] px-2 py-1 rounded-md"
                    style={i === active ? { background: BLUE, color: '#fff' } : { background: isMixed(p) ? '#FFFBEB' : '#F1F5F9', color: '#475569' }}
                    title={palletLabel(p)}>
                    {p.id.replace('PAL-', '')}{isMixed(p) ? ' ·M' : ''}
                  </button>
                ))}
              </div>
              {pallet ? (
                <>
                  <ViewBoundary fallback={<div className="p-6 flex justify-center"><TopView pallet={pallet} spec={spec} colorOf={colorOf} size={320} /></div>}>
                    <Suspense fallback={<div className="h-[340px] flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>}>
                      <LoadView3D key={`${pallet.id}-${spec.length}-${spec.width}`} container={palletContainer} placed={pallet.placed} colorOf={colorOf}
                        isDimmed={() => false} blockedIds={null} onHover={() => {}} variant="pallet" deckHeight={spec.deckHeight} />
                    </Suspense>
                  </ViewBoundary>
                  <div className="px-4 py-3 border-t border-slate-100 grid sm:grid-cols-2 gap-3">
                    <div>
                      <div className="font-bricolage font-semibold text-slate-900">{pallet.id} · palette {kindLabel(pallet)} · {spec.label}</div>
                      <div className="font-jetbrains text-[11px] text-slate-500">
                        Arrêt {pallet.stop}{pallet.destination ? ` · ${pallet.destination}` : ''} · H {fmtCm(pallet.totalHeight)} cm · {formatKg(pallet.totalWeight)} kg · remplissage {pct(pallet.volumeFill)}
                      </div>
                      {pallet.kind === 'FULL' && <div className="font-jetbrains text-[11px] text-slate-500">{pallet.layers} couche(s) × {pallet.perLayer} colis · couches alternées à 180°</div>}
                      <div className="font-jetbrains text-[11px]" style={{ color: pallet.stackable ? '#15803D' : '#B45309' }}>{pallet.stackable ? 'Gerbable (tous les colis acceptent une charge)' : 'Non gerbable (colis fragiles)'}{pallet.totalWeight > HEAVY_PALLET_KG ? ` · plus de ${HEAVY_PALLET_KG} kg : reste au sol du camion` : ''}</div>
                    </div>
                    <div className="space-y-1">
                      {pallet.contents.map((c) => (
                        <div key={c.definitionId} className="flex items-center gap-2 text-xs">
                          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: refColor(colorIndex[c.definitionId] ?? 0).solid }} />
                          <span className="flex-1 truncate text-slate-700">{c.reference}</span>
                          <span className="font-jetbrains text-slate-900">×{c.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : <div className="p-6 text-sm text-slate-500">Aucune palette constituée.</div>}
            </div>

            <div className="xl:col-span-2 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="font-jetbrains text-xs text-slate-600">RÉSULTAT</div>
                <div className="grid grid-cols-2 gap-2">
                  <Kpi label="Palettes" value={result.pallets.length} sub={`${totals.bySupport.map(([l, n]) => `${n} ${l}`).join(' · ')}${totals.cost ? ` · ${totals.cost.toLocaleString('fr-FR')} €` : ''}`} />
                  <Kpi label="Colis palettisés" value={`${result.palletizedItems}/${result.totalItems}`} sub={totals.unplaced ? `${totals.unplaced} non palettisé(s)` : 'tout est palettisé'} />
                  <Kpi label="Poids total" value={`${formatKg(totals.weight)} kg`} sub="tare incluse" />
                  <Kpi label="Remplissage moyen" value={pct(totals.fill)} sub={`hauteur maxi ${fmtCm(totals.maxH)} cm`} />
                </div>
                {result.choices.length > 0 && result.specs.length > 1 && (
                  <div className="rounded-md px-3 py-2 space-y-1" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div className="font-jetbrains text-[10px] text-slate-500">CHOIX DES SUPPORTS</div>
                    {result.choices.map((c) => (
                      <div key={c.stop} className="text-[11px] text-slate-700">
                        <span className="font-jetbrains text-slate-500">{separateStops && c.stop > 0 ? `Arrêt ${c.stop}${c.destination ? ` · ${c.destination}` : ''}` : 'Envoi'} → </span>{c.reason}
                      </div>
                    ))}
                  </div>
                )}
                {result.unplaced.length > 0 && (
                  <div className="rounded-md px-3 py-2 text-[11px]" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
                    {result.unplaced.map((u) => <div key={u.definitionId + u.reason}>{u.reference} ×{u.quantity} : {u.reason}</div>)}
                  </div>
                )}
                <div className="rounded-lg p-3 space-y-2" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                  <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5"><Truck size={13} /> Charger ces palettes dans un camion</div>
                  <label className="flex items-center gap-2 text-[11px] text-slate-600">
                    Gerbage au camion
                    <select value={stacking} onChange={(e) => setStacking(e.target.value)} className="flex-1 text-base sm:text-xs border border-slate-200 rounded-md px-2 py-1 bg-white">
                      <option value="AUTO">Automatique (colis + palettes lourdes au sol)</option>
                      <option value="FREE">Toutes gerbables</option>
                      <option value="TOP_ONLY">Rien dessus</option>
                      <option value="FLOOR_NO_TOP">Au sol, rien dessus</option>
                    </select>
                  </label>
                  <button onClick={sendToTruck} disabled={result.pallets.length === 0}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-jetbrains text-sm font-semibold"
                    style={{ background: AMBER, color: '#0F172A' }}>
                    Charger le camion <ArrowRight size={15} />
                  </button>
                  <div className="font-jetbrains text-[10px] text-slate-500">Les palettes (dimensions, poids, gerbage, arrêt, n° PAL) sont envoyées à l’optimiseur de chargement.</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { track('pallet_print'); window.print(); }} className="flex items-center justify-center gap-1.5 py-2 rounded-lg font-jetbrains text-xs" style={{ background: BLUE_LIGHT, color: BLUE }}><Printer size={13} /> Fiche PDF</button>
                  <button onClick={exportCsv} className="flex items-center justify-center gap-1.5 py-2 rounded-lg font-jetbrains text-xs" style={{ background: BLUE_LIGHT, color: BLUE }}><Download size={13} /> CSV</button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 font-jetbrains text-[11px] text-slate-600">PALETTES</div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {result.pallets.map((p, i) => (
                    <button key={p.id} onClick={() => setActive(i)} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-3"
                      style={i === active ? { background: BLUE_LIGHT } : undefined}>
                      <span className="font-jetbrains text-[11px] text-slate-500 w-14 shrink-0">{p.id}</span>
                      <span className="flex-1 min-w-0 text-xs text-slate-800 truncate">{palletLabel(p)}{p.destination ? ` · ${p.destination}` : ''}</span>
                      <span className="font-jetbrains text-[10px] text-slate-500 shrink-0">{fmtCm(p.totalHeight)} cm · {formatKg(p.totalWeight)} kg</span>
                      {p.stackable ? <Check size={12} className="text-green-600 shrink-0" /> : <span className="w-3 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {result && createPortal(
        <div className="pz-print-root"><PrintSheet result={result} colorOf={colorOf} /></div>,
        document.body,
      )}
    </div>
  );
}
