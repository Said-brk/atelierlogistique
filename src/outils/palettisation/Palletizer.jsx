// Palettisation 3D : des colis aux palettes, puis envoi en un clic vers l'optimiseur de chargement.
// Réutilise : le tableau colis, l'assistant d'import et le moteur 3D de l'optimiseur.

import SeoFold from '../../shared/ui/SeoFold';
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
import { PALLET_FAQ, toolSeo } from '../../seo/pages';
import { PALLET_FAQ_EN, toolSeoEn } from '../../seo/pages-en';
import { toolHref } from '../../shared/i18n/paths';
import { createLocalProfileStore, toCsv, downloadText } from '../../shared/import';
import { sendHandoff } from '../../shared/handoff';
import useLocalDraft from '../../shared/draft/useLocalDraft';
import { COLIS_SCHEMA, STANDARD_HEADERS, STANDARD_SAMPLE, recordsToColisRows } from '../optimiseur-chargement/import/colisSchema';
import { palletizeMulti } from './engine/palletize';
import SupportsPanel from './SupportsPanel';
import { loadSupports, saveSupports, matchSupport } from './supportsStore';
import { palletsToLoadRecords, palletLabel, palletStackingLabel, HEAVY_PALLET_KG } from './engine/toLoad';
import { t, tText, numLocale, getCurrentLang, N_ } from '../../shared/i18n/core';
import { dimUnit, weightUnit, cmToDim, fmtMoney } from '../../shared/units/units';
import { wU, lU, dU, vU } from '../optimiseur-chargement/uiHelpers';

const LoadView3D = lazy(() => import('../optimiseur-chargement/LoadView3D.jsx'));
const ImportWizard = lazy(() => import('../../shared/import/ImportWizard.jsx'));

const BLUE = '#2563EB';
const BLUE_LIGHT = '#EFF6FF';
const AMBER = '#F59E0B';
const importProfiles = createLocalProfileStore();
const IMPORT_EXTRA_OPTIONS = [
  { id: 'stopsFromDestination', label: N_('Un arrêt par destination'), help: N_('sans colonne Arrêt, chaque client devient un arrêt, dans l’ordre du fichier.') },
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
const fmtCm = (mm) => cmToDim(mmToCm(mm)).toLocaleString(numLocale(), { maximumFractionDigits: 1 }); // cm ou pouces
const pct = (r) => `${Math.round(r * 100)} %`;
/** Type affiché : complète (couches pleines), mono-référence incomplète, ou mixte. */
const kindLabel = (p) => (p.kind === 'FULL' ? t('complète') : p.contents.length === 1 ? t('mono-référence') : t('mixte'));
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
  const used = [...new Set(result.pallets.map((p) => tText(specOf(p).label)))].join(', ');
  const date = new Date().toLocaleDateString(numLocale());
  return (
    <div className="pz-print-sheet" style={{ fontFamily: "'DM Sans', system-ui, sans-serif", color: '#0F172A' }}>
      <style>{PRINT_CSS}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #0F172A', paddingBottom: 6, marginBottom: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{t('Plan de palettisation')}</div>
        <div style={{ fontSize: 10, color: '#475569' }}>{t('{date} · {used} · atelierlogistique.com', { date: date, used: used })}</div>
      </div>
      <div style={{ fontSize: 11, marginBottom: 10 }}>{t('{length} palette(s) · {palletizedItems} colis · {v1} {wu} (tare incluse)', { wu: wU(), lu: lU(), du: dU(), vu: vU(),  length: result.pallets.length, palletizedItems: result.palletizedItems, v1: formatKg(result.pallets.reduce((s, p) => s + p.totalWeight, 0)) })}{result.unplaced.length > 0 && <span style={{ color: '#B91C1C' }}>{' '}{t('· {v1} colis non palettisés', { v1: result.unplaced.reduce((s, u) => s + u.quantity, 0) })}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {result.pallets.map((p) => (
          <div key={p.id} className="pz-pallet" style={{ border: '1px solid #CBD5E1', borderRadius: 6, padding: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
              <span>{p.id} · {kindLabel(p)} · {tText(specOf(p).label)}</span>
              <span>{t('Arrêt {stop}{v1}', { stop: p.stop, v1: p.destination ? ` · ${p.destination}` : '' })}</span>
            </div>
            <div style={{ fontSize: 10, color: '#475569', margin: '2px 0 6px' }}>
              H {fmtCm(p.totalHeight)} {dU()} · {formatKg(p.totalWeight)} {wU()}{p.kind === 'FULL' ? t(' · {layers} couches × {perLayer} (alternées)', { layers: p.layers, perLayer: p.perLayer }) : ''} · {p.stackable ? t('gerbable') : t('non gerbable')}
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

/** embedded : intégré à l'espace connecté (pas de barre d'outil ni de contenu SEO) ;
 *  onLoadTruck : où aller après « Charger le camion » (par défaut l'optimiseur public) ;
 *  workspace : { initial, onChange, origin, references } — palettisation enregistrée dans l'espace (pré-remplissage,
 *  état courant + résumé renvoyés à chaque changement pour l'enregistrement par la page). */
export default function Palletizer({ onBack, embedded: embeddedProp = false, onLoadTruck = null, workspace = null }) {
  const embedded = embeddedProp || !!workspace;
  // Sans compte : brouillon dans ce navigateur (saisie + dernières palettes), retrouvé en revenant sur la page.
  const draft = useLocalDraft('al.draft.palettisation', !workspace);
  const init = (workspace ?? draft)?.initial ?? {};
  const navigate = useNavigate();
  const [rows, setRows] = useState(() => (Array.isArray(init.rows) ? init.rows : exampleRows()));
  // Espace : supports de l'entreprise (Paramètres › Tables de référence) ; site public : ceux du navigateur.
  const refPallets = workspace?.references?.pallets;
  const [supports, setSupports] = useState(() => (Array.isArray(init.supports) && init.supports.length ? init.supports
    : refPallets?.length ? refPallets.map((p) => ({ ...p })) : loadSupports()));
  const [fullFirst, setFullFirst] = useState(init.fullFirst ?? true);
  const [separateStops, setSeparateStops] = useState(init.separateStops ?? true);
  const [formatMode, setFormatMode] = useState(init.formatMode ?? 'stop'); // 'stop' | 'shipment' | 'free'
  const [forcedStops, setForcedStops] = useState(init.forcedStops ?? {});
  const [stacking, setStacking] = useState(init.stacking ?? 'AUTO');
  const [result, setResult] = useState(() => init.plan?.base ?? null); // espace : palettes enregistrées, sans recalcul
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (embedded) return undefined; // intégré à l'espace connecté : la page gère son titre
    const seo = getCurrentLang() === 'en' ? toolSeoEn('pallet') : toolSeo('pallet');
    const prev = document.title;
    document.title = seo.title;
    return () => { document.title = prev; };
  }, []);

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 7000); };
  const invalidate = () => { setResult(null); setActive(0); };

  const updateRow = (id, field, value) => { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: coerceField(field, value) } : r))); invalidate(); };
  const updateStacking = (id, value) => { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...stackingFields(value) } : r))); invalidate(); };
  const removeRow = (id) => { setRows((rs) => rs.filter((r) => r.id !== id)); invalidate(); };
  const addRow = () => setRows((rs) => [...rs, { ...emptyRow(), rotationMode: 'HORIZONTAL' }]);

  const changeSupports = (next) => { setSupports(next); if (!workspace) saveSupports(next); invalidate(); };
  const available = useMemo(() => supports.filter((s) => s.available && s.length > 0 && s.width > 0), [supports]);
  const stops = useMemo(() => {
    const m = new Map();
    for (const r of rows) { const st = r.stop ?? 1; if (!m.has(st)) m.set(st, r.destination || ''); }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [rows]);
  const supportSelect = useMemo(() => ({
    field: 'support', label: t('Support'), title: t('Support imposé pour cette ligne (vide = automatique)'),
    options: [{ value: '', label: t('Auto') }, ...available.map((s) => ({ value: s.id, label: s.label.split(' ')[0] }))],
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
    flash('success', t('{length} ligne(s) importée(s){v1}.', { length: mapped.length, v1: source ? t(' depuis « {source} »', { source: source }) : '' }));
  };

  const downloadStandardCsv = () => downloadText(t('atelier-logistique-colis-format-standard.csv'), toCsv(STANDARD_HEADERS.map((h) => t(h)), STANDARD_SAMPLE.map((r) => r.map((v) => (typeof v === 'string' ? tText(v) : v)))));

  const exportCsv = () => {
    if (!result) return;
    const headers = [N_('Palette'), N_('Type'), N_('Support'), N_('Arrêt'), N_('Destination'), N_('Référence'), N_('Quantité'), N_('Couches'), N_('Colis par couche'),
      N_('Longueur (cm)'), N_('Largeur (cm)'), N_('Hauteur totale (cm)'), N_('Poids total (kg)'), N_('Remplissage (%)'), N_('Gerbage')].map((h) => t(h));
    const lines = result.pallets.flatMap((p) => p.contents.map((c) => [
      p.id, kindLabel(p), tText(specOf(p).label), p.stop, p.destination, c.reference, c.quantity,
      p.layers || '', p.perLayer || '', mmToCm(specOf(p).length), mmToCm(specOf(p).width), mmToCm(p.totalHeight),
      Math.round(p.totalWeight * 10) / 10, Math.round(p.volumeFill * 100), palletStackingLabel(p, stacking),
    ]));
    downloadText(t('palettisation-{v1}.csv', { v1: new Date().toISOString().slice(0, 10) }), toCsv(headers, lines));
    track('pallet_export_csv');
  };

  const sendToTruck = () => {
    if (!result || result.pallets.length === 0) return;
    const records = palletsToLoadRecords(result.pallets, result.specs, stacking);
    track('pallet_sent_to_load_optimizer', { pallets: result.pallets.length });
    // Espace : les palettes sont remises à l'éditeur, qui les écrit dans le chargement choisi (en base).
    // Rien n'est mis en attente dans le navigateur (sinon elles finiraient dans le prochain chargement ouvert).
    if (workspace && onLoadTruck) { onLoadTruck({ records }); return; }
    sendHandoff('optimiseur-chargement', {
      schemaId: COLIS_SCHEMA.id,
      schemaVersion: COLIS_SCHEMA.version,
      source: { tool: 'pallet', label: t('Palettisation 3D') },
      records,
      extra: { unitLabel: t('palette(s)'), ...(workspace?.origin ? { origin: workspace.origin } : {}) },
    });
    if (onLoadTruck) onLoadTruck(); else navigate(toolHref('optimiseur-chargement', getCurrentLang()));
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

  // Espace connecté : état courant + résumé du calcul, pour l'enregistrement par la page.
  const onWorkspaceChange = (workspace ?? draft)?.onChange;
  useEffect(() => {
    onWorkspaceChange?.({
      rows, supports, fullFirst, separateStops, formatMode, forcedStops, stacking,
      summary: result && totals ? {
        pallets: result.pallets.length, full: totals.full, mixed: totals.mixed, weight: totals.weight,
        stops: totals.stops, unplaced: totals.unplaced, bySupport: totals.bySupport, fill: totals.fill,
      } : null,
      plan: result ? { base: result } : null,
    });
  }, [rows, supports, fullFirst, separateStops, formatMode, forcedStops, stacking, result, totals, onWorkspaceChange]);

  return (
    <div className={`${embedded ? '' : 'min-h-screen'} text-slate-900`} style={{ background: '#F8FAFC', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {!embedded && (<>
      <nav className="tool-nav border-b border-slate-200 bg-white sticky top-0 z-20 print:hidden">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-jetbrains text-xs">
              <ArrowLeft size={14} />{' '}{t('RETOUR')}</button>
            <div className="w-px h-5 bg-slate-200 hidden sm:block" />
            <div className="hidden sm:block">
              <div className="font-bricolage font-semibold text-sm leading-tight text-slate-900">{t('Palettisation 3D')}</div>
              <div className="font-jetbrains text-[10px] text-slate-500">{t('ATELIER / PALETTISATION')}</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 font-jetbrains text-[10px] text-slate-500 tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} />{' '}{t('CALCUL DANS LE NAVIGATEUR')}</div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-5 sm:pt-8 pb-1 sm:pb-2">
        <h1 className="font-bricolage font-bold text-2xl md:text-3xl text-slate-900">{t('Palettisation 3D')}</h1>
        <p className="text-slate-600 mt-1 text-sm sm:text-base">{t('Préparez vos palettes complètes et mixtes, puis chargez-les dans le camion en un clic.')}</p>
      </div>
      </>)}

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 space-y-4 sm:space-y-5">
        {/* 1. Colis */}
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="font-jetbrains text-xs text-slate-600 flex items-center gap-2"><Boxes size={13} />{' '}{t('1 · QUE SOUHAITEZ-VOUS PALETTISER ?')}</div>
            <div className="grid grid-cols-4 sm:flex sm:items-center gap-1.5">
              <button onClick={() => setImportOpen(true)} className="col-span-2 flex items-center justify-center gap-1 font-jetbrains text-[11px] px-2.5 py-2 sm:py-1.5 rounded-md" style={{ background: BLUE, color: '#fff' }}><Upload size={11} />{' '}{t('Importer / coller')}</button>
              <button onClick={downloadStandardCsv} className="flex items-center justify-center gap-1 font-jetbrains text-[11px] px-2.5 py-2 sm:py-1.5 rounded-md" style={{ background: '#F1F5F9', color: '#475569' }}><Download size={11} />{' '}{t('Modèle')}</button>
              <button onClick={() => { setRows(exampleRows()); invalidate(); }} className="flex items-center justify-center font-jetbrains text-[11px] px-2.5 py-2 sm:py-1.5 rounded-md" style={{ background: BLUE_LIGHT, color: BLUE }}>{t('Exemple')}</button>
            </div>
          </div>
          {importOpen && (
            <Suspense fallback={null}>
              <ImportWizard schema={COLIS_SCHEMA} store={importProfiles} onImport={onImported} onClose={() => setImportOpen(false)}
                extraOptions={IMPORT_EXTRA_OPTIONS} footerLinks={[{ label: t('Format standard (CSV)'), onClick: downloadStandardCsv }]} />
            </Suspense>
          )}
          {msg && (
            <div className="mx-4 mt-3 text-[11px] font-jetbrains px-3 py-2 rounded-md" style={msg.type === 'error'
              ? { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }
              : { background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>{msg.text}</div>
          )}
          <ColisTable rows={rows} updateRow={updateRow} updateStacking={updateStacking} removeRow={removeRow} addRow={addRow}
            extraSelect={available.length > 1 ? supportSelect : null} agencies={workspace?.references?.agencies}
            footerHint={t('dimensions en {d} · poids en {w} · un arrêt = des palettes séparées', { d: dimUnit(), w: weightUnit() })} />
        </div>

        {/* 2. Palette + options */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-5 items-start">
          <div className="xl:col-span-3">
            <SupportsPanel supports={supports} onChange={changeSupports}
              note={refPallets ? t('Choix : moins de palettes, puis moins de place au sol, puis coût. Valeurs proposées : Paramètres › Tables de référence.') : null} />
          </div>

          <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="font-jetbrains text-xs text-slate-600 flex items-center gap-2"><Layers size={13} />{' '}{t('3 · RÈGLES DE PALETTISATION')}</div>
            <Toggle checked={fullFirst} onChange={(v) => { setFullFirst(v); invalidate(); }} label={t('Palettes complètes mono-référence d’abord')}
              help={t('Plan de couche optimisé et couches alternées ; seuls les reliquats partent en palettes mixtes.')} />
            <Toggle checked={separateStops} onChange={(v) => { setSeparateStops(v); invalidate(); }} label={t('Une palette = un seul arrêt')}
              help={t('Aucune palette ne mélange deux destinations (déchargement sans dépalettiser).')} />
            {available.length > 1 && (
              <label className="block text-xs text-slate-700">
                <span className="block mb-1">{t('Format de palette')}</span>
                <select value={formatMode} onChange={(e) => { setFormatMode(e.target.value); invalidate(); }}
                  className="w-full text-base sm:text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white">
                  <option value="stop">{t('Un format par destination (recommandé)')}</option>
                  <option value="shipment">{t('Un seul format pour tout l’envoi (même camion)')}</option>
                  <option value="free">{t('Libre : le meilleur support par référence')}</option>
                </select>
                <span className="block text-[11px] text-slate-500 mt-0.5">{t('Mélanger 80 et 100 cm de large dans un camion désaligne les rangées et fait perdre de la place.')}</span>
              </label>
            )}
            {separateStops && available.length > 1 && stops.length > 0 && (
              <div className="rounded-lg border border-slate-200 px-3 py-2 space-y-1.5">
                <div className="font-jetbrains text-[10px] text-slate-500">{t('SUPPORT EXIGÉ PAR LE DESTINATAIRE')}</div>
                {stops.map(([st, dest]) => (
                  <label key={st} className="flex items-center gap-2 text-xs text-slate-700">
                    <span className="flex-1 truncate">{t('Arrêt {st}{v1}', { st: st, v1: dest ? ` · ${dest}` : '' })}</span>
                    <select value={forcedStops[st] ?? ''} onChange={(e) => { setForcedStops((f) => ({ ...f, [st]: e.target.value })); invalidate(); }}
                      className="text-base sm:text-xs border border-slate-200 rounded-md px-2 py-1 bg-white">
                      <option value="">{t('Automatique')}</option>
                      {available.map((sp) => <option key={sp.id} value={sp.id}>{tText(sp.label)}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div><div className="font-jetbrains text-[10px] text-slate-500">{t('Colis')}</div><div className="font-bricolage font-bold text-xl" style={{ color: BLUE }}>{rows.reduce((s, r) => s + (r.quantity || 0), 0)}</div></div>
              <div><div className="font-jetbrains text-[10px] text-slate-500">{t('Références')}</div><div className="font-bricolage font-bold text-xl text-slate-800">{rows.length}</div></div>
              <div><div className="font-jetbrains text-[10px] text-slate-500">{t('Arrêts')}</div><div className="font-bricolage font-bold text-xl text-slate-800">{new Set(rows.map((r) => r.stop ?? 1)).size}</div></div>
            </div>
            <button onClick={run} disabled={!valid || running}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-jetbrains text-sm font-medium text-white"
              style={{ background: valid ? BLUE : '#CBD5E1' }}>
              {running ? <><Loader2 size={15} className="animate-spin" />{' '}{t('Calcul…')}</> : <>{t('Calculer la palettisation')}{' '}<ArrowRight size={15} /></>}
            </button>
            {!valid && <div className="text-[11px] text-red-600 flex items-center gap-1"><AlertCircle size={12} /> {available.length === 0 ? t('Cochez au moins un support disponible.') : t('Complétez les lignes du tableau.')}</div>}
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
                      <div className="font-bricolage font-semibold text-slate-900">{t('{id} · palette {v1} · {label}', { id: pallet.id, v1: kindLabel(pallet), label: tText(spec.label) })}</div>
                      <div className="font-jetbrains text-[11px] text-slate-500">{t('Arrêt {stop}{v1} · H {v2} {du} · {v3} {wu} · remplissage {v4}', { wu: wU(), lu: lU(), du: dU(), vu: vU(),  stop: pallet.stop, v1: pallet.destination ? ` · ${pallet.destination}` : '', v2: fmtCm(pallet.totalHeight), v3: formatKg(pallet.totalWeight), v4: pct(pallet.volumeFill) })}</div>
                      {pallet.kind === 'FULL' && <div className="font-jetbrains text-[11px] text-slate-500">{t('{layers} couche(s) × {perLayer} colis · couches alternées à 180°', { layers: pallet.layers, perLayer: pallet.perLayer })}</div>}
                      <div className="font-jetbrains text-[11px]" style={{ color: pallet.stackable ? '#15803D' : '#B45309' }}>{pallet.stackable ? t('Gerbable (tous les colis acceptent une charge)') : t('Non gerbable (colis fragiles)')}{pallet.totalWeight > HEAVY_PALLET_KG ? t(' · plus de {HEAVY_PALLET_KG} {wu} : reste au sol du camion', { wu: wU(), lu: lU(), du: dU(), vu: vU(),  HEAVY_PALLET_KG: formatKg(HEAVY_PALLET_KG) }) : ''}</div>
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
              ) : <div className="p-6 text-sm text-slate-500">{t('Aucune palette constituée.')}</div>}
            </div>

            <div className="xl:col-span-2 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="font-jetbrains text-xs text-slate-600">{t('RÉSULTAT')}</div>
                <div className="grid grid-cols-2 gap-2">
                  <Kpi label={t('Palettes')} value={result.pallets.length} sub={`${totals.bySupport.map(([l, n]) => `${n} ${l}`).join(' · ')}${totals.cost ? ` · ${fmtMoney(totals.cost)}` : ''}`} />
                  <Kpi label={t('Colis palettisés')} value={`${result.palletizedItems}/${result.totalItems}`} sub={totals.unplaced ? t('{unplaced} non palettisé(s)', { unplaced: totals.unplaced }) : t('tout est palettisé')} />
                  <Kpi label={t('Poids total')} value={`${formatKg(totals.weight)} ${wU()}`} sub={t('tare incluse')} />
                  <Kpi label={t('Remplissage moyen')} value={pct(totals.fill)} sub={t('hauteur maxi {v1} {du}', { wu: wU(), lu: lU(), du: dU(), vu: vU(),  v1: fmtCm(totals.maxH) })} />
                </div>
                {result.choices.length > 0 && result.specs.length > 1 && (
                  <div className="rounded-md px-3 py-2 space-y-1" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div className="font-jetbrains text-[10px] text-slate-500">{t('CHOIX DES SUPPORTS')}</div>
                    {result.choices.map((c) => (
                      <div key={c.stop} className="text-[11px] text-slate-700">
                        <span className="font-jetbrains text-slate-500">{separateStops && c.stop > 0 ? t('Arrêt {stop}{v1}', { stop: c.stop, v1: c.destination ? ` · ${c.destination}` : '' }) : t('Envoi')} → </span>{tText(c.reason)}
                      </div>
                    ))}
                  </div>
                )}
                {result.unplaced.length > 0 && (
                  <div className="rounded-md px-3 py-2 text-[11px]" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
                    {result.unplaced.map((u) => <div key={u.definitionId + u.reason}>{u.reference} ×{u.quantity} : {tText(u.reason)}</div>)}
                  </div>
                )}
                <div className="rounded-lg p-3 space-y-2" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                  <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5"><Truck size={13} />{' '}{t('Charger ces palettes dans un camion')}</div>
                  <label className="flex items-center gap-2 text-[11px] text-slate-600">{t('Gerbage au camion')}<select value={stacking} onChange={(e) => setStacking(e.target.value)} className="flex-1 text-base sm:text-xs border border-slate-200 rounded-md px-2 py-1 bg-white">
                      <option value="AUTO">{t('Automatique (colis + palettes lourdes au sol)')}</option>
                      <option value="FREE">{t('Toutes gerbables')}</option>
                      <option value="TOP_ONLY">{t('Rien dessus')}</option>
                      <option value="FLOOR_NO_TOP">{t('Au sol, rien dessus')}</option>
                    </select>
                  </label>
                  <button onClick={sendToTruck} disabled={result.pallets.length === 0}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-jetbrains text-sm font-semibold"
                    style={{ background: AMBER, color: '#0F172A' }}>{t('Charger le camion')}{' '}<ArrowRight size={15} />
                  </button>
                  <div className="font-jetbrains text-[10px] text-slate-500">{t('Les palettes (dimensions, poids, gerbage, arrêt, n° PAL) sont envoyées à l’optimiseur de chargement.')}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { track('pallet_print'); window.print(); }} className="flex items-center justify-center gap-1.5 py-2 rounded-lg font-jetbrains text-xs" style={{ background: BLUE_LIGHT, color: BLUE }}><Printer size={13} />{' '}{t('Fiche PDF')}</button>
                  <button onClick={exportCsv} className="flex items-center justify-center gap-1.5 py-2 rounded-lg font-jetbrains text-xs" style={{ background: BLUE_LIGHT, color: BLUE }}><Download size={13} /> CSV</button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 font-jetbrains text-[11px] text-slate-600">{t('PALETTES')}</div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {result.pallets.map((p, i) => (
                    <button key={p.id} onClick={() => setActive(i)} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-3"
                      style={i === active ? { background: BLUE_LIGHT } : undefined}>
                      <span className="font-jetbrains text-[11px] text-slate-500 w-14 shrink-0">{p.id}</span>
                      <span className="flex-1 min-w-0 text-xs text-slate-800 truncate">{palletLabel(p)}{p.destination ? ` · ${p.destination}` : ''}</span>
                      <span className="font-jetbrains text-[10px] text-slate-500 shrink-0">{fmtCm(p.totalHeight)} {dU()} · {formatKg(p.totalWeight)} {wU()}</span>
                      {p.stackable ? <Check size={12} className="text-green-600 shrink-0" /> : <span className="w-3 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contenu SEO (aussi pré-rendu en HTML : src/seo/pages.js) */}
      {!embedded && <SeoFold>
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{t('Une fois les palettes prêtes, calculez le')}{' '}<a href={toolHref('optimiseur-chargement', getCurrentLang())} className="font-medium underline underline-offset-2" style={{ color: BLUE }}>{t('plan de chargement du camion ou du conteneur')}</a>{t('. Méthode complète :')}{' '}<a href="/ressources/plan-de-chargement-camion" className="font-medium underline underline-offset-2" style={{ color: BLUE }}>{t('comment faire un plan de chargement')}</a>.
        </p>
        <section>
          <h2 className="font-bricolage font-bold text-xl text-slate-900 mb-2">{t('Comment fonctionne le calcul de palettisation ?')}</h2>
          <p className="text-slate-600 leading-relaxed">{t('Vous saisissez ou importez vos colis (dimensions, poids, quantité, rotation, empilage, destination) et cochez les palettes dont vous disposez. L’outil prépare d’abord des palettes complètes mono-référence avec le meilleur plan de couche, puis regroupe les reliquats sur des palettes mixtes calculées en 3D. Il choisit le support le plus adapté et respecte la hauteur et la charge maximales de chaque palette.')}</p>
        </section>
        <section>
          <h2 className="font-bricolage font-bold text-xl text-slate-900 mb-3">{t('Questions fréquentes')}</h2>
          <div className="space-y-3">
            {(getCurrentLang() === 'en' ? PALLET_FAQ_EN : PALLET_FAQ).map((f) => (
              <details key={f.q} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <summary className="font-jetbrains text-sm text-slate-800 cursor-pointer">{f.q}</summary>
                <p className="text-slate-600 text-sm mt-2 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </SeoFold>}

      {result && createPortal(
        <div className="pz-print-root"><PrintSheet result={result} colorOf={colorOf} /></div>,
        document.body,
      )}
    </div>
  );
}
