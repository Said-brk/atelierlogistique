import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense, Component } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  ArrowLeft, Truck, Box, Loader2, AlertCircle,
  RotateCcw, Check, ArrowRight, Boxes, Upload, Download,
  MapPin, Undo2, Printer, Scale, ChevronDown,
} from 'lucide-react';

const LoadView3D = lazy(() => import('./LoadView3D.jsx'));
const ImportWizard = lazy(() => import('../../shared/import/ImportWizard.jsx'));

// Error boundary : si Three.js échoue, on retombe sur le schéma 2D (CDC §53).
class ThreeErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { if (import.meta.env?.DEV) console.error('Vue 3D indisponible :', err); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
import { CONTAINER_PRESETS } from './constants/containers';
import { LOADING_DEFAULTS } from './constants/engine-config';
import { analyzeBalance, defaultAxleProfile, DEFAULT_LASHING, shiftPlaced, suggestShift } from './engine/balance';
import { useOptimizer } from './useOptimizer';
import {
  emptyRow, exampleRows, rowsAreValid, coerceField,
  rowsToDefinitions, cmToMm, refColor,
  formatM3, formatKg, formatPct, mm3ToM3,
  newRowId,
  DELIVERY_MODES, distinctStops, stopLabel, stopColor,
  stackingFields,
} from './uiHelpers';
import { track } from './analytics';
import { OPTIMIZER_FAQ, toolSeo } from '../../seo/pages';
import ColisTable from './components/ColisTable';
import { createLocalProfileStore, toCsv, downloadText } from '../../shared/import';
import { consumeHandoff } from '../../shared/handoff';
import { COLIS_SCHEMA, STANDARD_HEADERS, STANDARD_SAMPLE, recordsToColisRows } from './import/colisSchema';
import { SEQUENCE_HEADERS, sequenceRows } from './import/exportSequence';

const importProfiles = createLocalProfileStore();
const IMPORT_EXTRA_OPTIONS = [
  { id: 'stopsFromDestination', label: 'Un arrêt par destination', help: 'sans colonne Arrêt, chaque client devient un arrêt, dans l’ordre du fichier.' },
];

// FAQ : source unique dans src/seo/pages.js (aussi pré-rendue en HTML et en données structurées).
const FAQ = OPTIMIZER_FAQ;

const BLUE = '#2563EB';
const BLUE_LIGHT = '#EFF6FF';

function useDocumentMeta(title, description) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute('content');
    if (meta && description) meta.setAttribute('content', description);
    return () => {
      document.title = prevTitle;
      if (meta && prevDesc != null) meta.setAttribute('content', prevDesc);
    };
  }, [title, description]);
}

// ---- Petits composants d'interface ----
const BAL_COLORS = { ok: '#15803D', warn: '#B45309', over: '#B91C1C' };
const BAL_BG = { ok: '#F0FDF4', warn: '#FFFBEB', over: '#FEF2F2' };
const BAL_LABEL = { ok: 'Conforme', warn: 'À surveiller', over: 'Hors limites' };
const fmtM = (mm) => (mm / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function BalanceField({ label, unit, value, onChange, step = '1' }) {
  return (
    <label className="block min-w-0">
      <span className="block font-jetbrains text-[10px] text-slate-500 mb-0.5">{label}</span>
      <span className="flex items-center gap-1.5">
        <input type="number" inputMode="decimal" min="0" step={step} value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 px-2 py-1.5 bg-white border border-slate-200 rounded-md outline-none font-jetbrains text-base sm:text-xs text-slate-800 focus:border-slate-400" />
        <span className="font-jetbrains text-[10px] text-slate-400">{unit}</span>
      </span>
    </label>
  );
}

function LoadBar({ label, value, max }) {
  const pct = max > 0 ? value / max : 0;
  const st = pct > 1 ? 'over' : pct > 0.9 ? 'warn' : 'ok';
  return (
    <div>
      <div className="flex items-center justify-between font-jetbrains text-[11px] mb-1">
        <span className="text-slate-600">{label}</span>
        <span style={{ color: BAL_COLORS[st] }}>{formatKg(Math.max(0, value))} / {formatKg(max)} kg · {Math.round(pct * 100)} %</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%`, background: BAL_COLORS[st] }} />
      </div>
    </div>
  );
}

function Schematic2D({ container, placed, colorOf, isDimmed, blockedIds }) {
  const target = 520;
  const scale = target / container.length;
  const topH = container.width * scale;
  const sideH = container.height * scale;
  const W = container.length * scale;

  const rects = (project) => placed.map((p, i) => {
    const r = project(p);
    const c = colorOf(p);
    const dim = isDimmed(p);
    const blocked = blockedIds?.has(p.id);
    return (
      <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h}
        fill={c.light} stroke={blocked ? '#DC2626' : (c.edge ?? c.dark)} strokeWidth={blocked ? 1.6 : c.combined ? 1.6 : 0.7}
        opacity={dim ? 0.18 : 0.92} />
    );
  });
  const doors = (h) => <line x1={W} y1={0} x2={W} y2={h} stroke="#F59E0B" strokeWidth="3" />;

  return (
    <div className="space-y-4">
      <div>
        <div className="font-jetbrains text-[10px] text-slate-400 mb-1 tracking-wider">VUE DE DESSUS — X × Y · <span className="text-amber-600">portes à droite</span></div>
        <svg viewBox={`-2 -2 ${W + 4} ${topH + 4}`} className="w-full h-auto" style={{ maxHeight: 220 }}>
          <rect x="0" y="0" width={W} height={topH} fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
          {rects((p) => ({ x: p.x * scale, y: p.y * scale, w: p.length * scale, h: p.width * scale }))}
          {doors(topH)}
        </svg>
      </div>
      <div>
        <div className="font-jetbrains text-[10px] text-slate-400 mb-1 tracking-wider">VUE DE CÔTÉ — X × Z</div>
        <svg viewBox={`-2 -2 ${W + 4} ${sideH + 4}`} className="w-full h-auto" style={{ maxHeight: 220 }}>
          <rect x="0" y="0" width={W} height={sideH} fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
          {rects((p) => ({ x: p.x * scale, y: (container.height - (p.z + p.height)) * scale, w: p.length * scale, h: p.height * scale }))}
          {doors(sideH)}
        </svg>
      </div>
    </div>
  );
}

// ---- Fiche de chargement imprimable (bon de quai, arrêt par arrêt) ----
const PRINT_CSS = `
.lo-print-sheet { display: none; }
@media print {
  @page { size: A4; margin: 14mm; }
  html, body { background: #fff !important; height: auto !important; min-height: 0 !important; }
  /* On retire réellement la page du flux (display:none) : avec visibility:hidden,
     sa hauteur restait imprimée et produisait des pages blanches. */
  body > *:not(.lo-print-root) { display: none !important; }
  .lo-print-root { display: block !important; }
  .lo-print-sheet {
    display: block !important;
    position: static; width: 100%;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .lo-stop { break-inside: avoid; page-break-inside: avoid; }
  .lo-sheet-head { break-after: avoid; }
}
`;

function groupByReference(items) {
  const m = new Map();
  for (const p of items) {
    const g = m.get(p.definitionId) || {
      definitionId: p.definitionId, reference: p.reference, count: 0,
      l: Math.round(p.originalLength / 10), w: Math.round(p.originalWidth / 10), h: Math.round(p.originalHeight / 10),
      total: 0,
    };
    g.count += 1; g.total += p.weight;
    m.set(p.definitionId, g);
  }
  return [...m.values()];
}

// Vue de dessus compacte : ce arrêt en couleur, le reste du chargement en gris (repère de zone).
function StopMiniPlan({ container, placed, stop, color }) {
  const scale = 460 / container.length;
  const W = container.length * scale;
  const H = container.width * scale;
  return (
    <svg viewBox={`-2 -2 ${W + 4} ${H + 4}`} style={{ width: '100%', maxWidth: 460, height: 'auto' }}>
      <rect x="0" y="0" width={W} height={H} fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
      {placed.map((p, i) => {
        const here = (p.stop ?? 1) === stop;
        return (
          <rect key={i} x={p.x * scale} y={p.y * scale} width={p.length * scale} height={p.width * scale}
            fill={here ? color.light : '#F1F5F9'} stroke={here ? color.dark : '#E2E8F0'} strokeWidth={here ? 0.9 : 0.5}
            opacity={here ? 1 : 0.45} />
        );
      })}
      <line x1={W} y1="0" x2={W} y2={H} stroke="#F59E0B" strokeWidth="2.5" />
    </svg>
  );
}

function PrintSheet({ container, result, rows, colorIndex, multiStopResult, leftovers, balance, shiftMm = 0 }) {
  const refColorOf = (defId) => refColor(colorIndex[defId] ?? 0);
  const blocked = new Set(result.blockedItemIds ?? []);
  const canDrawPlan = result.placedItems.length <= 400;
  // Ordre de chargement = inverse de l'ordre de livraison (dernier arrêt chargé au fond).
  const ordered = multiStopResult ? [...result.stops].sort((a, b) => b.stop - a.stop) : result.stops;
  const n = ordered.filter((s) => s.packedItems > 0).length;
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const td = { padding: '4px 8px', borderBottom: '1px solid #E2E8F0', fontSize: 11 };
  const th = { padding: '5px 8px', textAlign: 'left', fontSize: 9, letterSpacing: '0.05em', color: '#64748B', borderBottom: '2px solid #CBD5E1', textTransform: 'uppercase' };
  const m = (x) => (x / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 });

  return (
    <div className="lo-print-sheet" style={{ fontFamily: "'DM Sans', system-ui, sans-serif", color: '#0F172A', padding: 4 }}>
      <style>{PRINT_CSS}</style>

      <div className="lo-sheet-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0F172A', paddingBottom: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Fiche de chargement</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
            {container.label} · {m(container.length)}×{m(container.width)}×{m(container.height)} m
            {result.loadingMode === 'WALLS' ? ' · chargement par murs' : ''}
            {multiStopResult && result.deliveryMode ? ` · tournée ${result.deliveryMode === 'SOFT' ? 'souple' : 'stricte'}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#475569' }}>
          <div>{today}</div>
          <div style={{ marginTop: 2 }}>atelierlogistique.com</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 18, marginBottom: 14, fontSize: 11, flexWrap: 'wrap' }}>
        <div><strong style={{ fontSize: 15 }}>{result.packedItems}/{result.totalItems}</strong> colis chargés</div>
        <div><strong style={{ fontSize: 15 }}>{formatKg(result.usedWeight)}</strong> kg</div>
        <div><strong style={{ fontSize: 15 }}>{formatM3(result.usedVolume)}</strong> m³</div>
        <div><strong style={{ fontSize: 15 }}>{formatPct(result.volumeUtilization)} %</strong> de remplissage</div>
      </div>

      {multiStopResult && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309', borderRadius: 6, padding: '8px 10px', fontSize: 11, marginBottom: 16 }}>
          <strong>Ordre de chargement :</strong> chargez du fond vers les portes — commencez par l'arrêt {ordered.find((s) => s.packedItems > 0)?.stop} (livré en dernier), terminez par l'arrêt 1 (livré en premier, côté portes, repère ▮).
        </div>
      )}

      {balance && balance.cog && (
        <div className="lo-stop" style={{ marginBottom: 14, padding: '8px 10px', border: `1px solid ${BAL_COLORS[balance.status]}`, borderRadius: 6, background: BAL_BG[balance.status] }}>
          <strong style={{ fontSize: 12 }}>Répartition des charges : {BAL_LABEL[balance.status].toLowerCase()}</strong>
          <div style={{ fontSize: 11, marginTop: 3 }}>
            Centre de gravité à {fmtM(balance.cog.x)} m de la face avant, {fmtM(balance.cog.z)} m de haut.
            {balance.supports
              ? ` ${balance.profile.frontLabel} : ${formatKg(Math.max(0, balance.supports.front))} / ${formatKg(balance.profile.frontMax)} kg · ${balance.profile.rearLabel} : ${formatKg(Math.max(0, balance.supports.rear))} / ${formatKg(balance.profile.rearMax)} kg.`
              : ` Excentricité ${balance.longitudinalPct >= 0 ? '+' : ''}${formatPct(balance.longitudinalPct)} % (tolérance ±5 %).`}
            {' '}Arrimage : {balance.lashing.total} sangle(s) par-dessus (STF {balance.lashing.params.stfDaN} daN, µ {String(balance.lashing.params.mu).replace('.', ',')}).
          </div>
          {shiftMm > 0 && (
            <div style={{ fontSize: 11, marginTop: 4, fontWeight: 700 }}>
              ⚠ Chargement décalé : laisser {fmtM(shiftMm)} m libres contre la face avant et poser une barre de calage avant le premier mur.
            </div>
          )}
          <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>Estimation indicative (EN 12195-1, CTU Code) : ne remplace pas le plan d'arrimage ni les données du constructeur.</div>
        </div>
      )}

      {result.loadingMode === 'WALLS' && result.walls?.length > 0 && (
        <div className="lo-stop" style={{ marginBottom: 18 }}>
          <strong style={{ fontSize: 14 }}>Séquence de chargement par murs</strong>
          <div style={{ fontSize: 10, color: '#64748B', margin: '2px 0 6px' }}>
            Remplir chaque mur sur toute la largeur et la hauteur avant de passer au suivant. Mur 1 = côté cabine.
          </div>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr>
              <th style={th}>Mur</th>
              <th style={th}>Depuis la cabine</th>
              <th style={th}>Contenu</th>
              <th style={{ ...th, textAlign: 'right' }}>Colis</th>
              <th style={{ ...th, textAlign: 'right' }}>Poids</th>
              {balance && <th style={{ ...th, textAlign: 'right' }}>Sangles</th>}
            </tr></thead>
            <tbody>
              {result.walls.map((w) => {
                const content = groupByReference(result.placedItems.filter((p) => p.wall === w.wall))
                  .map((g) => `${g.reference || 'réf.'} ×${g.count}`).join(', ');
                return (
                  <tr key={w.wall} style={{ breakInside: 'avoid' }}>
                    <td style={{ ...td, fontWeight: 700 }}>{w.wall}</td>
                    <td style={td}>{m(w.xStart)} → {m(w.xEnd)} m</td>
                    <td style={td}>{content}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{w.items}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{formatKg(w.weight)} kg</td>
                    {balance && <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{balance.lashing.walls.find((x) => x.wall === w.wall)?.straps ?? 1}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {ordered.filter((s) => s.packedItems > 0).map((s, idx) => {
        const items = result.placedItems.filter((p) => (p.stop ?? 1) === s.stop);
        const groups = groupByReference(items);
        const color = stopColor(s.stop);
        const blockedHere = items.filter((p) => blocked.has(p.id)).length;
        return (
          <div key={s.stop} className="lo-stop" style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              {multiStopResult && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#0F172A', borderRadius: 4, padding: '2px 7px' }}>
                  CHARGEMENT {idx + 1}/{n}
                </span>
              )}
              {multiStopResult && <span style={{ width: 13, height: 13, borderRadius: 3, background: color.solid, display: 'inline-block' }} />}
              <strong style={{ fontSize: 14 }}>{multiStopResult ? stopLabel(s.stop, rows) : 'Colis à charger'}</strong>
              {multiStopResult && <span style={{ fontSize: 11, color: '#64748B' }}>· livré en position {s.stop}</span>}
            </div>

            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <table style={{ borderCollapse: 'collapse', flex: 1 }}>
                <thead><tr>
                  <th style={th}>Référence</th>
                  <th style={{ ...th, textAlign: 'right' }}>Qté</th>
                  <th style={{ ...th, textAlign: 'right' }}>Dim. (L×l×h cm)</th>
                  <th style={{ ...th, textAlign: 'right' }}>Poids tot.</th>
                </tr></thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.definitionId}>
                      <td style={td}>
                        <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: refColorOf(g.definitionId).solid, marginRight: 6, verticalAlign: 'middle' }} />
                        {g.reference || 'réf.'}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>{g.count}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{g.l}×{g.w}×{g.h}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{formatKg(g.total)} kg</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>Total</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, borderBottom: 'none' }}>{s.packedItems}</td>
                    <td style={{ ...td, borderBottom: 'none' }} />
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, borderBottom: 'none' }}>{formatKg(s.packedWeight)} kg</td>
                  </tr>
                </tbody>
              </table>
              {canDrawPlan && (
                <div style={{ width: 220 }}>
                  <div style={{ fontSize: 8, letterSpacing: '0.05em', color: '#94A3B8', marginBottom: 2, textTransform: 'uppercase' }}>Vue de dessus · portes ▮ à droite</div>
                  <StopMiniPlan container={container} placed={result.placedItems} stop={s.stop} color={color} />
                </div>
              )}
            </div>
            {blockedHere > 0 && (
              <div style={{ fontSize: 10, color: '#B91C1C', marginTop: 4 }}>⚠ {blockedHere} colis à déplacer pour accéder à cet arrêt.</div>
            )}
          </div>
        );
      })}

      {leftovers && leftovers.length > 0 && (
        <div className="lo-stop" style={{ marginTop: 10, marginBottom: 14 }}>
          <strong style={{ fontSize: 13, color: '#B45309' }}>À reporter sur un autre véhicule</strong>
          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 6 }}>
            <thead><tr>
              <th style={th}>Arrêt</th><th style={th}>Destination</th><th style={th}>Référence</th>
              <th style={{ ...th, textAlign: 'right' }}>Qté</th><th style={th}>Motif</th>
            </tr></thead>
            <tbody>
              {leftovers.map((l, i) => (
                <tr key={i}>
                  <td style={td}>{l.stop}</td><td style={td}>{l.destination}</td><td style={td}>{l.reference || 'réf.'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{l.quantity}</td><td style={td}>{l.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 18, paddingTop: 8, borderTop: '1px solid #E2E8F0', fontSize: 9, color: '#94A3B8' }}>
        Généré sur atelierlogistique.com — l'optimiseur de chargement fonctionne dans le navigateur, sans envoi de données.
      </div>
    </div>
  );
}

function Bar({ label, value, max, unit, format }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const pct = ratio * 100;
  const level = pct >= 95 ? 'fort' : pct >= 80 ? 'leger' : 'ok';
  const color = level === 'fort' ? '#DC2626' : level === 'leger' ? '#D97706' : BLUE;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-jetbrains text-[11px] text-slate-600">{label}</span>
        <span className="font-jetbrains text-[11px] text-slate-800">
          {format(value)} / {format(max)} {unit} · <span style={{ color }}>{formatPct(ratio)} %</span>
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      {level !== 'ok' && (
        <div className="text-[10px] mt-1" style={{ color }}>
          {level === 'fort' ? 'Limite quasi atteinte.' : 'Remplissage élevé.'}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 bg-white">
      <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-2">{label}</div>
      <div className="font-bricolage font-bold text-2xl text-slate-900">{value}</div>
      {sub && <div className="font-jetbrains text-[10px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function LoadOptimizer({ onBack }) {
  const seo = toolSeo('optimiseur-chargement');
  useDocumentMeta(seo.title, seo.description);

  const [rows, setRows] = useState(exampleRows);
  const [containerId, setContainerId] = useState('semi');
  const [custom, setCustom] = useState({ label: 'Mon contenant', length: 600, width: 240, height: 240, maxWeight: '' });
  const [highlight, setHighlight] = useState(null);
  const [view3d, setView3d] = useState(true);
  const [hovered, setHovered] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const resultRef = useRef(null);
  const ctaRef = useRef(null);
  const [ctaVisible, setCtaVisible] = useState(true);
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setCtaVisible(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const { run, reset, result, status } = useOptimizer();

  // Chargement physique : toujours par murs, de la cabine vers les portes
  // (aucun colis posé en passant par-dessus un autre). Pas de réglage exposé.
  const [loadedUpToWall, setLoadedUpToWall] = useState(null); // null = chargement complet

  // Tournée multi-arrêts
  const [deliveryMode, setDeliveryMode] = useState('STRICT');
  const [colorBy, setColorBy] = useState('auto'); // 'auto' | 'ref' | 'stop' | 'both'
  const [unloadedUpTo, setUnloadedUpTo] = useState(0); // 0 = chargement complet
  const [excludedStops, setExcludedStops] = useState([]); // arrêts retirés du camion
  const [deferredExcess, setDeferredExcess] = useState([]); // arrêts dont l'excédent est reporté

  const stops = useMemo(() => distinctStops(rows), [rows]);
  const multiStop = stops.length > 1;
  useEffect(() => { setExcludedStops((ex) => ex.filter((s) => stops.includes(s))); }, [stops]);

  const resultStops = result?.stops ?? [];
  const multiStopResult = resultStops.length > 1;
  const effColorBy = colorBy === 'auto' ? (multiStopResult ? 'both' : 'ref') : colorBy;

  // Index couleur stable par référence (ordre des lignes)
  const colorIndex = useMemo(() => {
    const map = {};
    rows.forEach((r, i) => { map[r.id] = i; });
    return map;
  }, [rows]);
  const colorOf = useCallback(
    (item) => {
      const ref = refColor(colorIndex[item.definitionId] ?? 0);
      const stp = stopColor(item.stop ?? 1);
      if (effColorBy === 'stop') return stp;
      // Mode combiné : remplissage = référence (colis), contour = arrêt (destination).
      if (effColorBy === 'both') return { solid: ref.solid, light: ref.light, dark: stp.dark, edge: stp.solid, combined: true };
      return ref;
    },
    [colorIndex, effColorBy],
  );
  const isDimmed = useCallback((item) => {
    if (!highlight) return false;
    if (highlight.startsWith('stop:')) return `stop:${item.stop}` !== highlight;
    return item.definitionId !== highlight;
  }, [highlight]);
  const blockedIds = useMemo(() => new Set(result?.blockedItemIds ?? []), [result]);
  // Décalage du chargement vers les portes (translation de tout le bloc : positions relatives inchangées).
  const [shiftMm, setShiftMm] = useState(0);
  const planResult = useMemo(() => (result && shiftMm > 0
    ? {
      ...result,
      placedItems: shiftPlaced(result.placedItems, shiftMm),
      walls: (result.walls ?? []).map((w) => ({ ...w, xStart: w.xStart + shiftMm, xEnd: w.xEnd + shiftMm })),
    }
    : result), [result, shiftMm]);
  const visiblePlaced = useMemo(
    () => (planResult
      ? planResult.placedItems.filter((p) => (p.stop ?? 1) > unloadedUpTo && (loadedUpToWall === null || p.wall <= loadedUpToWall))
      : []),
    [planResult, unloadedUpTo, loadedUpToWall],
  );

  // Répartition des charges & arrimage : réglages pré-remplis par véhicule, mémorisés.
  const BAL_KEY = 'al_balance_v1';
  const [balanceCfg, setBalanceCfg] = useState(() => {
    try { return JSON.parse(localStorage.getItem(BAL_KEY) || '{}'); } catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem(BAL_KEY, JSON.stringify(balanceCfg)); } catch { /* stockage indisponible */ } }, [balanceCfg]);
  const [balanceOpen, setBalanceOpen] = useState(false);

  const container = useMemo(() => {
    if (containerId === 'custom') {
      return {
        id: 'custom', label: custom.label || 'Mon contenant',
        length: cmToMm(custom.length), width: cmToMm(custom.width), height: cmToMm(custom.height),
        maxWeight: custom.maxWeight === '' ? null : Math.max(0, Number(custom.maxWeight) || 0),
      };
    }
    return CONTAINER_PRESETS.find((c) => c.id === containerId);
  }, [containerId, custom]);

  const axleProfile = useMemo(() => ({ ...defaultAxleProfile(container), ...(balanceCfg.axles?.[container.id] ?? {}) }), [container, balanceCfg]);
  const lashingParams = useMemo(() => ({ ...DEFAULT_LASHING, ...(balanceCfg.lashing ?? {}) }), [balanceCfg]);
  const setAxle = (key, value) => setBalanceCfg((c) => ({
    ...c, axles: { ...(c.axles ?? {}), [container.id]: { ...(c.axles?.[container.id] ?? {}), [key]: value } },
  }));
  const setLashing = (key, value) => setBalanceCfg((c) => ({ ...c, lashing: { ...(c.lashing ?? {}), [key]: value } }));
  const resetBalance = () => setBalanceCfg((c) => {
    const axles = { ...(c.axles ?? {}) }; delete axles[container.id];
    return { ...c, axles, lashing: {} };
  });
  const balance = useMemo(
    () => (planResult && planResult.placedItems.length > 0 ? analyzeBalance(container, planResult.placedItems, axleProfile, lashingParams) : null),
    [planResult, container, axleProfile, lashingParams],
  );
  const shiftSuggestion = useMemo(
    () => (planResult && shiftMm === 0 && planResult.placedItems.length > 0 ? suggestShift(container, planResult.placedItems, axleProfile) : null),
    [planResult, shiftMm, container, axleProfile],
  );


  const valid = rowsAreValid(rows);

  const activeRows = useMemo(() => rows.filter((r) => !excludedStops.includes(r.stop ?? 1)), [rows, excludedStops]);

  const totals = useMemo(() => {
    const units = activeRows.reduce((s, r) => s + (r.quantity || 0), 0);
    const volume = activeRows.reduce((s, r) => s + (r.quantity || 0) * cmToMm(r.length) * cmToMm(r.width) * cmToMm(r.height), 0);
    const weight = activeRows.reduce((s, r) => s + (r.quantity || 0) * (r.weight || 0), 0);
    return { units, volume, weight };
  }, [activeRows]);

  const containerVolume = container.length * container.width * container.height;
  const overweight = container.maxWeight != null && totals.weight > container.maxWeight;

  // Analytics anonyme (uniquement si un système existe sur le site)
  useEffect(() => { track('load_optimizer_view'); }, []);
  useEffect(() => {
    if (status === 'done' && result) {
      track('load_optimizer_calculation_success');
      track('load_optimizer_result', {
        references: rows.length,
        units: totals.units,
        container: containerId,
        fill_rate: Math.round(result.volumeUtilization * 100),
      });
    } else if (status === 'error') {
      track('load_optimizer_calculation_failed');
    }
  }, [status, result, rows.length, totals.units, containerId]);

  // Données structurées FAQ / logiciel : injectées dans le HTML pré-rendu au build (scripts/prerender.mjs).

  // À la fin du calcul, on amène le résultat (camion + KPI) dans la vue.
  useEffect(() => {
    if (status === 'done' && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [status]);

  const updateRow = (id, field, value) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: coerceField(field, value) } : r)));
    if (status !== 'idle') reset();
  };
  const updateStacking = (id, value) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...stackingFields(value) } : r)));
    if (status !== 'idle') reset();
  };
  const removeRow = (id) => { setRows((rs) => rs.filter((r) => r.id !== id)); if (status !== 'idle') reset(); };
  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const loadExample = () => { setRows(exampleRows()); setExcludedStops([]); reset(); track('load_optimizer_example_clicked'); };

  const flashImport = (type, text, ms = 6000) => { setImportMsg({ type, text }); setTimeout(() => setImportMsg(null), ms); };

  // Données envoyées par un autre outil (ex. palettes de la palettisation 3D).
  useEffect(() => {
    const env = consumeHandoff('optimiseur-chargement', COLIS_SCHEMA.id);
    if (!env) return;
    const received = recordsToColisRows(env.records).map((r) => ({ id: newRowId(), ...r }));
    if (received.length === 0) return;
    setRows(received);
    setExcludedStops([]);
    const units = received.reduce((s, r) => s + r.quantity, 0);
    const unitLabel = typeof env.extra?.unitLabel === 'string' ? env.extra.unitLabel : 'unité(s)';
    flashImport('success', `${units} ${unitLabel} reçue(s) de « ${env.source.label} ». Choisissez le véhicule puis lancez l’optimisation.`, 12000);
    track('load_optimizer_handoff_received', { from: env.source.tool, units });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Import via l'assistant (module partagé src/shared/import). */
  const onImported = ({ records, options, mode, source }) => {
    const mapped = recordsToColisRows(records, { stopsFromDestination: !!options.stopsFromDestination })
      .map((r) => ({ id: newRowId(), ...r }));
    if (mapped.length === 0) return;
    setRows((rs) => (mode === 'append' ? [...rs.filter((r) => r.reference || r.length), ...mapped] : mapped));
    setExcludedStops([]);
    reset();
    setImportOpen(false);
    track('load_optimizer_import', { mode, lines: mapped.length });
    flashImport('success', `${mapped.length} ligne(s) importée(s)${source ? ` depuis « ${source} »` : ''}.`);
  };

  const downloadStandardCsv = () => {
    downloadText('atelier-logistique-colis-format-standard.csv', toCsv(STANDARD_HEADERS, STANDARD_SAMPLE));
    track('load_optimizer_standard_csv');
  };

  const exportSequence = () => {
    if (!planResult) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const unitIds = Object.fromEntries(rows.filter((r) => r.unitIds?.length).map((r) => [r.id, r.unitIds]));
    downloadText(`sequence-chargement-${stamp}.csv`, toCsv(SEQUENCE_HEADERS, sequenceRows(planResult, unitIds)));
    track('load_optimizer_export_sequence');
  };

  const downloadTemplate = () => {
    const sample = [
      { 'Référence': 'CARTON-A', 'Quantité': 40, 'Longueur (cm)': 60, 'Largeur (cm)': 40, 'Hauteur (cm)': 40, 'Poids (kg)': 12, 'Rotation': 'Libre', 'Empilage': 'Libre', 'Arrêt': 1, 'Destination': 'Client A' },
      { 'Référence': 'PALETTE-EURO', 'Quantité': 4, 'Longueur (cm)': 120, 'Largeur (cm)': 80, 'Hauteur (cm)': 140, 'Poids (kg)': 450, 'Rotation': 'Horizontale', 'Empilage': 'Au sol, rien dessus', 'Arrêt': 2, 'Destination': 'Client B' },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Marchandises');
    XLSX.writeFile(wb, 'atelier-chargement-modele.xlsx');
  };

  const runWith = (excluded, mode = deliveryMode) => {
    const defs = rowsToDefinitions(rows.filter((r) => !excluded.includes(r.stop ?? 1)));
    setHighlight(null);
    setUnloadedUpTo(0);
    setLoadedUpToWall(null);
    setShiftMm(0);
    setDeferredExcess([]);
    if (defs.length === 0) { reset(); return; }
    run(container, defs, { deliveryMode: mode, loading: { mode: LOADING_DEFAULTS.mode } });
  };

  const optimize = () => {
    if (!valid) return;
    track('load_optimizer_calculation_started', { references: rows.length, units: totals.units, container: containerId, stops: stops.length });
    runWith(excludedStops);
  };

  const changeDeliveryMode = (mode) => { setDeliveryMode(mode); if (status !== 'idle') reset(); };
  const trySoft = () => { setDeliveryMode('SOFT'); runWith(excludedStops, 'SOFT'); };

  // Dépassement : retirer un arrêt entier (re-calcul) ou reporter seulement l'excédent.
  const excludeStop = (stop) => {
    const next = [...new Set([...excludedStops, stop])];
    setExcludedStops(next);
    track('load_optimizer_stop_removed');
    runWith(next);
  };
  const restoreStop = (stop) => {
    const next = excludedStops.filter((s) => s !== stop);
    setExcludedStops(next);
    runWith(next);
  };
  const deferExcess = (stop) => { setDeferredExcess((d) => [...new Set([...d, stop])]); track('load_optimizer_excess_deferred'); };
  const undoDefer = (stop) => setDeferredExcess((d) => d.filter((s) => s !== stop));

  /** Lignes à reporter sur un autre véhicule : arrêts retirés + excédents acceptés. */
  const leftovers = useMemo(() => {
    const out = [];
    for (const stop of excludedStops) {
      for (const r of rows.filter((x) => (x.stop ?? 1) === stop)) {
        out.push({ stop, destination: r.destination || '', reference: r.reference, quantity: r.quantity, reason: 'Arrêt retiré' });
      }
    }
    if (result) {
      for (const stop of deferredExcess) {
        const byRef = {};
        for (const u of result.unpackedItems.filter((x) => x.stop === stop)) {
          byRef[u.reference] = byRef[u.reference] || { stop, destination: u.destination || '', reference: u.reference, quantity: 0, reason: 'Colis en excès' };
          byRef[u.reference].quantity++;
        }
        out.push(...Object.values(byRef));
      }
    }
    return out.sort((a, b) => a.stop - b.stop);
  }, [excludedStops, deferredExcess, rows, result]);

  // Onglets d'analyse : statut par onglet ; le premier onglet en alerte s'ouvre à chaque nouveau calcul.
  const tabsRef = useRef(null);
  const [activeTab, setActiveTab] = useState('synth');
  const analysisTabs = useMemo(() => {
    if (!result) return [];
    const t = [{ id: 'synth', label: 'Synthèse', status: result.loadingViolationIds.length > 0 ? 'over' : 'ok' }];
    if (balance && balance.cog) t.push({ id: 'charges', label: 'Charges', status: shiftMm > 0 && balance.status !== 'over' ? balance.status : balance.status });
    if (multiStopResult) t.push({ id: 'tour', label: 'Tournée', status: result.blockedItemIds.length > 0 ? 'warn' : 'ok' });
    const leftQty = leftovers.reduce((n, l) => n + (Number(l.quantity) || 0), 0);
    if (result.unpackedCount > 0 || leftovers.length > 0) {
      t.push({ id: 'reliquats', label: 'Reliquats', status: result.unpackedCount > 0 && deferredExcess.length === 0 ? 'over' : 'warn', count: Math.max(result.unpackedCount, leftQty) });
    }
    return t;
  }, [result, balance, multiStopResult, leftovers, deferredExcess, shiftMm]);
  const currentTab = analysisTabs.some((t) => t.id === activeTab) ? activeTab : 'synth';
  useEffect(() => {
    if (!result) return;
    const tabs = analysisTabs;
    const pick = tabs.find((t) => t.status === 'over') ?? tabs.find((t) => t.status === 'warn') ?? tabs[0];
    if (pick) setActiveTab(pick.id);
    // uniquement à chaque nouveau résultat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);
  const openTab = (id) => {
    setActiveTab(id);
    tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const exportLeftovers = () => {
    const ws = XLSX.utils.json_to_sheet(leftovers.map((l) => ({
      'Arrêt': l.stop, 'Destination': l.destination, 'Référence': l.reference, 'Quantité': l.quantity, 'Motif': l.reason,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'A reporter');
    XLSX.writeFile(wb, 'atelier-chargement-reliquats.xlsx');
  };

  const printSheet = () => { track('load_optimizer_print_sheet'); window.print(); };

  return (
    <div className="min-h-screen text-slate-900" style={{ background: '#F8FAFC', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-jetbrains text-xs">
              <ArrowLeft size={14} /> RETOUR
            </button>
            <div className="w-px h-5 bg-slate-200 hidden sm:block" />
            <div className="hidden sm:block">
              <div className="font-bricolage font-semibold text-sm leading-tight text-slate-900">Optimiseur de chargement 3D</div>
              <div className="font-jetbrains text-[10px] text-slate-500">ATELIER / CHARGEMENT</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 font-jetbrains text-[10px] text-slate-500 tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} /> CALCUL DANS LE NAVIGATEUR
          </div>
        </div>
      </nav>

      {/* En-tête SEO */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-5 sm:pt-8 pb-1 sm:pb-2">
        <h1 className="font-bricolage font-bold text-2xl md:text-3xl text-slate-900">Optimiseur de chargement 3D</h1>
        <p className="text-slate-600 mt-1 text-sm sm:text-base">Optimisez le remplissage de vos camions et conteneurs en quelques secondes.</p>
      </div>

      <div className={`max-w-[1600px] mx-auto px-4 sm:px-6 py-4 ${status !== 'done' ? 'pb-24 xl:pb-4' : ''}`}>
        <div className="space-y-4 sm:space-y-5">

          {/* 1. Marchandises : pleine largeur */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="font-jetbrains text-xs text-slate-600 flex items-center gap-2"><Boxes size={13} /> 1 · QUE SOUHAITEZ-VOUS CHARGER ?</div>
              <div className="grid grid-cols-4 sm:flex sm:items-center gap-1.5">
                <button onClick={() => setImportOpen(true)} className="col-span-2 flex items-center justify-center gap-1 font-jetbrains text-[11px] px-2.5 py-2 sm:py-1.5 rounded-md" style={{ background: BLUE, color: '#fff' }} title="Fichier Excel / CSV (ERP, WMS) ou copier-coller"><Upload size={11} /> Importer / coller</button>
                <button onClick={downloadTemplate} className="flex items-center justify-center gap-1 font-jetbrains text-[11px] px-2.5 py-2 sm:py-1.5 rounded-md" style={{ background: '#F1F5F9', color: '#475569' }}><Download size={11} /> Modèle</button>
                <button onClick={loadExample} className="flex items-center justify-center font-jetbrains text-[11px] px-2.5 py-2 sm:py-1.5 rounded-md" style={{ background: BLUE_LIGHT, color: BLUE }}>Exemple</button>
              </div>
            </div>
            {importOpen && (
              <Suspense fallback={null}>
                <ImportWizard schema={COLIS_SCHEMA} store={importProfiles} onImport={onImported} onClose={() => setImportOpen(false)}
                  extraOptions={IMPORT_EXTRA_OPTIONS}
                  footerLinks={[{ label: 'Format standard (CSV)', onClick: downloadStandardCsv }, { label: 'Modèle Excel', onClick: downloadTemplate }]} />
              </Suspense>
            )}
            {importMsg && (
              <div className="mx-4 mt-3 text-[11px] font-jetbrains px-3 py-2 rounded-md" style={importMsg.type === 'error'
                ? { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }
                : { background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>
                {importMsg.text}
              </div>
            )}
            <ColisTable rows={rows} updateRow={updateRow} updateStacking={updateStacking} removeRow={removeRow} addRow={addRow} />
          </div>


          {/* 2. Véhicule + récapitulatif / action */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-5 items-start">
            <div className="xl:col-span-3">
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600 flex items-center gap-2"><Truck size={13} /> 2 · CHOISISSEZ VOTRE VÉHICULE OU CONTENANT</div>
                <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                  {CONTAINER_PRESETS.map((c) => (
                    <button key={c.id} onClick={() => { setContainerId(c.id); reset(); }}
                      className="text-left px-3 py-2.5 rounded-lg font-jetbrains transition-all"
                      style={containerId === c.id ? { background: BLUE, color: '#fff' } : { background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
                      <div className="text-[11px] font-semibold leading-tight">{c.label}</div>
                      <div className="text-[10px] opacity-80 mt-1">{(c.length / 1000).toFixed(2)}×{(c.width / 1000).toFixed(2)}×{(c.height / 1000).toFixed(2)} m</div>
                      <div className="text-[9px] opacity-80">{formatKg(c.maxWeight)} kg</div>
                    </button>
                  ))}
                  <button onClick={() => { setContainerId('custom'); reset(); }}
                    className="text-left px-3 py-2.5 rounded-lg font-jetbrains transition-all"
                    style={containerId === 'custom' ? { background: BLUE, color: '#fff' } : { background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
                    <div className="text-[11px] font-semibold leading-tight">Dimensions personnalisées</div>
                    <div className="text-[9px] opacity-80 mt-1">sur mesure (cm)</div>
                  </button>
                </div>
                {containerId === 'custom' && (
                  <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div className="col-span-2 md:col-span-1">
                      <label className="font-jetbrains text-[10px] text-slate-500 block mb-1">Nom</label>
                      <input value={custom.label} onChange={(e) => setCustom((c) => ({ ...c, label: e.target.value }))} className="w-full px-2 py-1.5 border border-slate-200 rounded-md outline-none font-jetbrains text-xs" />
                    </div>
                    {[['length', 'Long. (cm)'], ['width', 'Larg. (cm)'], ['height', 'Haut. (cm)'], ['maxWeight', 'Poids max (kg)']].map(([k, lbl]) => (
                      <div key={k}>
                        <label className="font-jetbrains text-[10px] text-slate-500 block mb-1">{lbl}</label>
                        <input type="number" min="0" value={custom[k]} onChange={(e) => { setCustom((c) => ({ ...c, [k]: e.target.value })); reset(); }}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md outline-none font-jetbrains text-xs" />
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-slate-100">
                  <button onClick={() => setBalanceOpen((o) => !o)} className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left font-jetbrains text-[11px] text-slate-600 hover:text-slate-900">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Scale size={12} className="shrink-0" />
                      <span className="truncate">
                        Essieux et arrimage · {axleProfile.kind === 'TWO_SUPPORTS'
                          ? `sellette ≤ ${formatKg(axleProfile.frontMax)} kg · essieux ≤ ${formatKg(axleProfile.rearMax)} kg`
                          : 'centre de gravité ±5 %'} · µ {String(lashingParams.mu).replace('.', ',')} · {lashingParams.stfDaN} daN
                      </span>
                    </span>
                    <ChevronDown size={12} className={`shrink-0 transition-transform ${balanceOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {balanceOpen && (
                    <div className="px-4 pb-4 space-y-3">
                      {axleProfile.kind === 'TWO_SUPPORTS' ? (
                        <>
                          <div className="grid grid-cols-2 gap-2.5">
                            <BalanceField label="Position sellette (depuis l'avant)" unit="m" step="0.1" value={axleProfile.frontPos / 1000} onChange={(v) => setAxle('frontPos', Number(v) * 1000)} />
                            <BalanceField label="Position essieux (centre du groupe)" unit="m" step="0.1" value={axleProfile.rearPos / 1000} onChange={(v) => setAxle('rearPos', Number(v) * 1000)} />
                            <BalanceField label="Charge utile max sellette" unit="kg" value={axleProfile.frontMax} onChange={(v) => setAxle('frontMax', Number(v))} />
                            <BalanceField label="Charge utile max essieux" unit="kg" value={axleProfile.rearMax} onChange={(v) => setAxle('rearMax', Number(v))} />
                          </div>
                          <div className="text-[10px] text-slate-400">Valeurs indicatives : reportez celles du plan de répartition de charge ou de la notice de votre véhicule.</div>
                        </>
                      ) : (
                        <div className="text-[10px] text-slate-500">Conteneur : contrôle du centre de gravité, tolérance de ±5 % de la longueur (CTU Code).</div>
                      )}
                      <div className="grid grid-cols-2 gap-2.5 items-end">
                        <label className="block min-w-0">
                          <span className="block font-jetbrains text-[10px] text-slate-500 mb-0.5">Plancher / frottement µ</span>
                          <select value={[0.3, 0.6].includes(Number(lashingParams.mu)) ? String(lashingParams.mu) : 'other'}
                            onChange={(e) => e.target.value !== 'other' && setLashing('mu', Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-md outline-none font-jetbrains text-base sm:text-xs text-slate-700">
                            <option value="0.3">Bois / contreplaqué (0,30)</option>
                            <option value="0.6">Tapis antiglisse (0,60)</option>
                            <option value="other">Autre valeur…</option>
                          </select>
                        </label>
                        <BalanceField label="Tension des sangles (STF)" unit="daN" value={lashingParams.stfDaN} onChange={(v) => setLashing('stfDaN', Number(v))} />
                        {![0.3, 0.6].includes(Number(lashingParams.mu)) && (
                          <BalanceField label="µ (autre)" unit="" step="0.05" value={lashingParams.mu} onChange={(v) => setLashing('mu', Number(v))} />
                        )}
                      </div>
                      <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={lashingParams.forwardBlocked} onChange={(e) => setLashing('forwardBlocked', e.target.checked)} />
                        Chargement bloqué vers l'avant (contre la face avant)
                      </label>
                      <button onClick={resetBalance} className="font-jetbrains text-[10px] text-slate-400 hover:text-slate-700 underline underline-offset-2">Revenir aux valeurs par défaut</button>
                    </div>
                  )}
                </div>
              </div>

            </div>
            <div className="xl:col-span-2">
              <div className="rounded-xl border p-4 bg-white" style={{ borderColor: BLUE, background: BLUE_LIGHT }}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div><div className="font-jetbrains text-[10px] text-slate-500">Unités</div><div className="font-bricolage font-bold text-xl" style={{ color: BLUE }}>{totals.units}</div></div>
                  <div><div className="font-jetbrains text-[10px] text-slate-500">Volume march.</div><div className="font-bricolage font-bold text-xl text-slate-800">{formatM3(totals.volume)} m³</div></div>
                  <div><div className="font-jetbrains text-[10px] text-slate-500">Poids total</div><div className="font-bricolage font-bold text-xl text-slate-800">{formatKg(totals.weight)} kg</div></div>
                  <div><div className="font-jetbrains text-[10px] text-slate-500">Contenant</div><div className="font-bricolage font-bold text-xl text-slate-800">{formatM3(containerVolume)} m³</div></div>
                </div>
                {multiStop && (
                  <div className="mb-3 px-3 py-2.5 rounded-md bg-white border border-slate-200">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="font-jetbrains text-[11px] text-slate-700 flex items-center gap-1.5">
                        <MapPin size={12} style={{ color: BLUE }} /> Tournée : {stops.length} arrêts · arrêt 1 chargé côté portes
                      </div>
                      <div className="flex items-center gap-0.5 p-0.5 rounded-md" style={{ background: '#F1F5F9' }}>
                        {DELIVERY_MODES.map((m) => (
                          <button key={m.value} onClick={() => changeDeliveryMode(m.value)} className="px-2 py-1 rounded text-[10px] font-jetbrains"
                            style={deliveryMode === m.value ? { background: '#fff', color: BLUE, fontWeight: 600 } : { color: '#64748B' }}>{m.label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">{DELIVERY_MODES.find((m) => m.value === deliveryMode)?.hint}</div>
                    {excludedStops.length > 0 && (
                      <div className="text-[10px] mt-1" style={{ color: '#B45309' }}>
                        Retiré(s) du camion : {excludedStops.map((s) => stopLabel(s, rows)).join(', ')}
                      </div>
                    )}
                  </div>
                )}
                {overweight && (
                  <div className="flex items-start gap-2 text-[11px] mb-3 px-3 py-2 rounded-md" style={{ background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A' }}>
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    Le poids total ({formatKg(totals.weight)} kg) dépasse le poids utile du contenant ({formatKg(container.maxWeight)} kg). Le moteur chargera ce qui est admissible.
                  </div>
                )}
                <button ref={ctaRef} onClick={optimize} disabled={!valid || status === 'running'}
                  className="w-full flex items-center justify-center gap-2 py-3.5 sm:py-3 rounded-lg font-bricolage font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: BLUE }}>
                  {status === 'running' ? <><Loader2 size={16} className="animate-spin" /> Optimisation du chargement…</> : <>Optimiser le chargement <ArrowRight size={16} /></>}
                </button>
                {!valid && <div className="text-[11px] text-slate-500 mt-2 text-center">Complétez les références (dimensions et quantités valides) pour lancer le calcul.</div>}
              </div>

            </div>
          </div>

          {/* 3. Résultat : plan 3D + analyse */}
          <div ref={resultRef} className="grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-5 items-start scroll-mt-20">
            {status === 'done' && result ? (
              <>
                <div className="xl:col-span-3">
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2 shrink-0"><Box size={13} /> PLAN<span className="hidden sm:inline"> DE CHARGEMENT</span></span>
                      <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                        <button onClick={printSheet} className="flex items-center gap-1 font-jetbrains text-[10px] px-2 py-1 rounded-md" style={{ background: BLUE_LIGHT, color: BLUE }} title="Imprimer ou enregistrer en PDF la fiche de chargement (ordre de chargement, arrêt par arrêt)"><Printer size={11} /> Fiche</button>
                        {multiStopResult && (
                          <div className="flex items-center gap-0.5 p-0.5 rounded-md" style={{ background: '#F1F5F9' }} title="Couleur des colis — Réf. : par produit · Arrêt : par destination · Les 2 : remplissage = produit, contour = destination">
                            <button onClick={() => { setColorBy('ref'); setHighlight(null); }} className="px-2 py-1.5 sm:py-1 rounded text-[10px]" style={effColorBy === 'ref' ? { background: '#fff', color: BLUE, fontWeight: 600 } : { color: '#64748B' }}>Réf.</button>
                            <button onClick={() => { setColorBy('stop'); setHighlight(null); }} className="px-2 py-1.5 sm:py-1 rounded text-[10px]" style={effColorBy === 'stop' ? { background: '#fff', color: BLUE, fontWeight: 600 } : { color: '#64748B' }}>Arrêt</button>
                            <button onClick={() => { setColorBy('both'); setHighlight(null); }} className="px-2 py-1.5 sm:py-1 rounded text-[10px]" style={effColorBy === 'both' ? { background: '#fff', color: BLUE, fontWeight: 600 } : { color: '#64748B' }}>Les 2</button>
                          </div>
                        )}
                        <div className="flex items-center gap-0.5 p-0.5 rounded-md" style={{ background: '#F1F5F9' }}>
                          <button onClick={() => setView3d(true)} className="px-2 py-1.5 sm:py-1 rounded text-[10px]" style={view3d ? { background: '#fff', color: BLUE, fontWeight: 600 } : { color: '#64748B' }}>3D</button>
                          <button onClick={() => setView3d(false)} className="px-2 py-1.5 sm:py-1 rounded text-[10px]" style={!view3d ? { background: '#fff', color: BLUE, fontWeight: 600 } : { color: '#64748B' }}>Schéma</button>
                        </div>
                        <span className="hidden xl:inline text-[10px] text-slate-400">{result.computationTimeMs} ms</span>
                      </div>
                    </div>
                    <div className="p-2 sm:p-4 relative">
                      {view3d ? (
                        <ThreeErrorBoundary fallback={<Schematic2D container={container} placed={visiblePlaced} colorOf={colorOf} isDimmed={isDimmed} blockedIds={blockedIds} />}>
                          <Suspense fallback={<div className="flex items-center justify-center text-slate-400 font-jetbrains text-xs h-[340px] sm:h-[420px] lg:h-[460px]"><Loader2 size={18} className="animate-spin mr-2" /> Chargement de la vue 3D…</div>}>
                            <LoadView3D container={container} placed={visiblePlaced} colorOf={colorOf} isDimmed={isDimmed} blockedIds={blockedIds} onHover={setHovered} cog={loadedUpToWall === null && unloadedUpTo === 0 ? balance?.cog : null} />
                          </Suspense>
                        </ThreeErrorBoundary>
                      ) : (
                        <Schematic2D container={container} placed={visiblePlaced} colorOf={colorOf} isDimmed={isDimmed} blockedIds={blockedIds} />
                      )}
                      {hovered && (
                        <div className="absolute bottom-3 left-3 bg-white/95 border border-slate-200 rounded-lg px-3 py-2 font-jetbrains text-[11px] shadow-sm pointer-events-none">
                          <div className="font-semibold text-slate-800">{hovered.reference}</div>
                          <div className="text-slate-500">{Math.round(hovered.originalLength / 10)} × {Math.round(hovered.originalWidth / 10)} × {Math.round(hovered.originalHeight / 10)} cm · {hovered.weight} kg</div>
                          {multiStopResult && <div className="text-slate-500">{stopLabel(hovered.stop ?? 1, rows)}</div>}
                          {blockedIds.has(hovered.id) && <div style={{ color: '#DC2626' }}>À déplacer pour livrer cet arrêt</div>}
                        </div>
                      )}
                    </div>
                    {/* Légende */}
                    {result.loadingMode === 'WALLS' && result.walls?.length > 1 && (
                      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                        <span className="font-jetbrains text-[10px] text-slate-500">CHARGEMENT</span>
                        <input type="range" min={1} max={result.walls.length + 1} step={1}
                          value={loadedUpToWall === null ? result.walls.length + 1 : loadedUpToWall}
                          onChange={(e) => { const v = Number(e.target.value); setLoadedUpToWall(v > result.walls.length ? null : v); }}
                          className="flex-1 min-w-[140px] accent-blue-600" aria-label="Progression du chargement par mur" />
                        <span className="font-jetbrains text-[10px] text-slate-700 w-24 text-right">
                          {loadedUpToWall === null ? `${result.walls.length} murs` : `Mur ${loadedUpToWall} / ${result.walls.length}`}
                        </span>
                      </div>
                    )}
                    {multiStopResult && (
                      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                        <span className="font-jetbrains text-[10px] text-slate-500 mr-1">DÉCHARGEMENT</span>
                        <button onClick={() => setUnloadedUpTo(0)} className="px-2 py-1 rounded text-[10px] font-jetbrains"
                          style={unloadedUpTo === 0 ? { background: BLUE, color: '#fff' } : { background: '#F1F5F9', color: '#475569' }}>Complet</button>
                        {resultStops.slice(0, -1).map((s) => (
                          <button key={s.stop} onClick={() => setUnloadedUpTo(s.stop)} className="px-2 py-1 rounded text-[10px] font-jetbrains"
                            style={unloadedUpTo === s.stop ? { background: BLUE, color: '#fff' } : { background: '#F1F5F9', color: '#475569' }}>
                            Après arrêt {s.stop}
                          </button>
                        ))}
                      </div>
                    )}
                    {(effColorBy === 'stop' || effColorBy === 'both') && (
                      <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                        {effColorBy === 'both' && (
                          <span className="font-jetbrains text-[9px] tracking-wider text-slate-400 mr-1 w-full sm:w-auto">CONTOUR · ARRÊT</span>
                        )}
                        {resultStops.filter((s) => s.packedItems > 0).map((s) => {
                          const key = `stop:${s.stop}`;
                          const swatch = effColorBy === 'both'
                            ? { background: '#fff', border: `2px solid ${stopColor(s.stop).solid}` }
                            : { background: stopColor(s.stop).solid };
                          return (
                            <button key={key} onClick={() => setHighlight((h) => (h === key ? null : key))}
                              className="flex items-center gap-1.5 text-[11px] font-jetbrains"
                              style={{ opacity: (highlight && highlight !== key) || s.stop <= unloadedUpTo ? 0.4 : 1 }}>
                              <span className="w-3 h-3 rounded-sm" style={swatch} />
                              {stopLabel(s.stop, rows)} <span className="text-slate-400">· {s.packedItems}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {(effColorBy === 'ref' || effColorBy === 'both') && (
                      <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                        {effColorBy === 'both' && (
                          <span className="font-jetbrains text-[9px] tracking-wider text-slate-400 mr-1 w-full sm:w-auto">REMPLISSAGE · RÉFÉRENCE</span>
                        )}
                        {rows.map((r, i) => {
                          const count = result.placedItems.filter((p) => p.definitionId === r.id).length;
                          if (count === 0) return null;
                          return (
                            <button key={r.id} onClick={() => setHighlight((h) => (h === r.id ? null : r.id))}
                              className="flex items-center gap-1.5 text-[11px] font-jetbrains"
                              style={{ opacity: highlight && highlight !== r.id ? 0.4 : 1 }}>
                              <span className="w-3 h-3 rounded-sm" style={{ background: refColor(i).solid }} />
                              {r.reference || 'réf.'} <span className="text-slate-400">· {count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="xl:col-span-2 flex flex-col gap-4">
                  {/* Résultat express : l'essentiel du calcul et les actions */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="font-jetbrains text-[10px] tracking-wider text-slate-500 mb-3">RÉSULTAT</div>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div><div className="font-jetbrains text-[10px] text-slate-500">Colis chargés</div><div className="font-bricolage font-bold text-xl" style={{ color: result.unpackedCount > 0 ? '#B91C1C' : BLUE }}>{result.packedItems} / {result.totalItems}</div></div>
                        <div><div className="font-jetbrains text-[10px] text-slate-500">Remplissage</div><div className="font-bricolage font-bold text-xl text-slate-800">{formatPct(result.volumeUtilization)} %</div></div>
                        <div><div className="font-jetbrains text-[10px] text-slate-500">Poids</div><div className="font-bricolage font-bold text-xl text-slate-800">{formatKg(result.usedWeight)} kg</div></div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {analysisTabs.map((t) => (
                          <button key={t.id} onClick={() => openTab(t.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-jetbrains text-[11px]"
                            style={{ background: BAL_BG[t.status], color: BAL_COLORS[t.status] }}>
                            {t.status === 'ok' ? <Check size={12} /> : <AlertCircle size={12} />}
                            {t.id === 'synth' ? 'Accès' : t.label}{t.count ? ` · ${t.count}` : ''}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={exportSequence} title="Séquence de chargement colis par colis, à réimporter dans votre WMS / ERP" className="flex items-center justify-center gap-1.5 py-2 rounded-lg font-jetbrains text-xs" style={{ background: BLUE_LIGHT, color: BLUE }}>
                          <Download size={13} /> CSV
                        </button>
                        <button onClick={printSheet} className="flex items-center justify-center gap-1.5 py-2 rounded-lg font-jetbrains text-xs" style={{ background: BLUE_LIGHT, color: BLUE }}>
                          <Printer size={13} /> Fiche PDF
                        </button>
                        <button onClick={optimize} className="flex items-center justify-center gap-1.5 py-2 rounded-lg font-jetbrains text-xs text-slate-600 border border-slate-200 bg-white hover:text-slate-900">
                          <RotateCcw size={13} /> Relancer
                        </button>
                      </div>
                    </div>
                  {/* Analyse : onglets (le premier onglet en alerte s'ouvre automatiquement) */}
                  <div ref={tabsRef} className="rounded-xl border border-slate-200 bg-white overflow-hidden scroll-mt-20">
                    <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50" role="tablist">
                      {analysisTabs.map((t) => (
                        <button key={t.id} role="tab" aria-selected={currentTab === t.id} onClick={() => setActiveTab(t.id)}
                          className="flex items-center gap-1.5 px-4 py-2.5 font-jetbrains text-[11px] whitespace-nowrap border-b-2 -mb-px"
                          style={currentTab === t.id ? { borderColor: BLUE, color: BLUE, background: '#fff', fontWeight: 600 } : { borderColor: 'transparent', color: '#64748B' }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: BAL_COLORS[t.status] }} />
                          {t.label}{t.count ? <span className="text-[10px] px-1.5 rounded-full" style={{ background: BAL_BG[t.status], color: BAL_COLORS[t.status] }}>{t.count}</span> : null}
                        </button>
                      ))}
                    </div>
                    <div className="p-3 sm:p-4 flex flex-col gap-4 bg-slate-50/50">
                      {currentTab === 'synth' && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <Kpi label="Taux de remplissage" value={`${formatPct(result.volumeUtilization)} %`} sub="volume placé / contenant" />
                            <Kpi label="Articles chargés" value={`${result.packedItems} / ${result.totalItems}`} sub={result.unpackedCount > 0 ? `${result.unpackedCount} non chargé(s)` : 'tout rentre'} />
                          </div>

                          <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-4">
                            <Bar label="Poids utilisé" value={result.usedWeight} max={result.maxWeight ?? result.usedWeight} unit="kg" format={formatKg} />
                            <Bar label="Volume utilisé" value={mm3ToM3(result.usedVolume)} max={mm3ToM3(result.containerVolume)} unit="m³" format={(v) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} />
                          </div>

                          {result.loadingViolationIds.length === 0 ? (
                            <div className="rounded-xl border px-4 py-3 text-[11px] flex items-start gap-1.5" style={{ color: '#15803D', background: '#F0FDF4', borderColor: '#BBF7D0' }}>
                              <Check size={13} className="mt-0.5 shrink-0" />
                              Chargement par murs, de la cabine vers les portes : chaque colis est accessible sans monter sur la marchandise.
                            </div>
                          ) : (
                            <div className="rounded-xl border px-4 py-3 text-[11px] flex items-start gap-1.5" style={{ color: '#B91C1C', background: '#FEF2F2', borderColor: '#FECACA' }}>
                              <AlertCircle size={13} className="mt-0.5 shrink-0" />
                              {result.loadingViolationIds.length} colis devront être posés en passant par-dessus d'autres colis.
                            </div>
                          )}

                        </>
                      )}
                      {currentTab === 'charges' && (
                        <>
                          {balance && balance.cog && (
                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                              <div className="px-4 py-2.5 border-b border-slate-100 font-jetbrains text-[10px] tracking-wider text-slate-500 flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5"><Scale size={12} /> RÉPARTITION DES CHARGES</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color: BAL_COLORS[balance.status], background: BAL_BG[balance.status] }}>{BAL_LABEL[balance.status]}</span>
                              </div>
                              <div className="px-4 py-3 space-y-3">
                                <div className="text-[11px] text-slate-600">
                                  Centre de gravité : <strong className="text-slate-900">{fmtM(balance.cog.x)} m</strong> de la face avant
                                  {' · '}{Math.abs(balance.lateralPct) < 0.005 ? 'centré en largeur' : `${Math.round(Math.abs(balance.cog.y - container.width / 2) / 10)} cm à ${balance.cog.y > container.width / 2 ? 'droite' : 'gauche'} de l'axe`}
                                  {' · '}{fmtM(balance.cog.z)} m de haut
                                </div>
                                {balance.supports ? (
                                  <>
                                    <LoadBar label={axleProfile.frontLabel} value={balance.supports.front} max={axleProfile.frontMax} />
                                    <LoadBar label={axleProfile.rearLabel} value={balance.supports.rear} max={axleProfile.rearMax} />
                                    <div className="text-[10px] text-slate-500">
                                      {balance.supports.zone
                                        ? <>Zone conseillée du centre de gravité pour {formatKg(balance.weight)} kg : <strong>{fmtM(Math.max(0, balance.supports.zone.from))} – {fmtM(Math.min(container.length, balance.supports.zone.to))} m</strong> de la face avant.</>
                                        : 'Charge trop lourde pour respecter les deux appuis, quelle que soit la position.'}
                                      {balance.supports.status === 'over' && (balance.supports.frontPct > 1
                                        ? ' Trop de poids vers l’avant : reculez les colis lourds vers le milieu de la remorque.'
                                        : ' Trop de poids vers l’arrière : avancez les colis lourds vers le milieu de la remorque.')}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-[11px]" style={{ color: BAL_COLORS[balance.status] }}>
                                    Excentricité longitudinale : {balance.longitudinalPct >= 0 ? '+' : ''}{formatPct(balance.longitudinalPct)} % (tolérance ±5 %).
                                  </div>
                                )}
                                {Math.abs(balance.lateralPct) > 0.05 && (
                                  <div className="text-[10px]" style={{ color: BAL_COLORS.warn }}>Charge décentrée en largeur : équilibrez les colis lourds entre les deux côtés.</div>
                                )}
                                {balance.afterStops.length > 0 && (
                                  <div className="pt-2 border-t border-slate-100">
                                    <div className="font-jetbrains text-[10px] text-slate-500 mb-1">PENDANT LA TOURNÉE</div>
                                    <div className="space-y-0.5">
                                      {balance.afterStops.map((a) => (
                                        <div key={a.stop} className="flex items-center justify-between gap-2 font-jetbrains text-[10px] text-slate-600">
                                          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: BAL_COLORS[a.status] }} />Après l'arrêt {a.stop}</span>
                                          <span style={{ color: BAL_COLORS[a.status] }}>
                                            {a.supports ? `${formatKg(Math.max(0, a.supports.front))} / ${formatKg(Math.max(0, a.supports.rear))} kg` : `${a.longitudinalPct >= 0 ? '+' : ''}${formatPct(a.longitudinalPct)} %`} · {BAL_LABEL[a.status]}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {shiftMm > 0 ? (
                                  <div className="rounded-lg px-3 py-2.5 text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{ background: BLUE_LIGHT, color: BLUE }}>
                                    <span>
                                      <Check size={12} className="inline -mt-0.5 mr-1" />
                                      Chargement décalé de <strong>{fmtM(shiftMm)} m</strong> vers l'arrière. Laissez cet espace libre contre la face avant et posez une <strong>barre de calage</strong>.
                                    </span>
                                    <button onClick={() => setShiftMm(0)} className="shrink-0 flex items-center gap-1 font-jetbrains text-[10px] text-slate-500 hover:text-slate-800"><Undo2 size={11} /> Annuler</button>
                                  </div>
                                ) : shiftSuggestion && (
                                  <div className="rounded-lg px-3 py-2.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{ borderColor: '#FDE68A', background: '#FFFBEB' }}>
                                    <span className="text-[11px] text-slate-700">
                                      Correction possible sans toucher au plan :{' '}
                                      {shiftSuggestion.after.supports
                                        ? <>{axleProfile.frontLabel.toLowerCase()} à <strong style={{ color: BAL_COLORS[shiftSuggestion.after.status] }}>{Math.round(shiftSuggestion.after.supports.frontPct * 100)} %</strong></>
                                        : <>excentricité à <strong style={{ color: BAL_COLORS[shiftSuggestion.after.status] }}>{shiftSuggestion.after.longitudinalPct >= 0 ? '+' : ''}{formatPct(shiftSuggestion.after.longitudinalPct)} %</strong></>}
                                      {shiftSuggestion.partial ? ' (amélioration partielle, faute de place côté portes).' : '.'}
                                    </span>
                                    <button onClick={() => { setShiftMm(shiftSuggestion.shift); track('load_optimizer_shift_applied'); }}
                                      className="shrink-0 px-3 py-2 rounded-md font-jetbrains text-[10px] font-semibold text-white" style={{ background: BLUE }}>
                                      Décaler de {fmtM(shiftSuggestion.shift)} m vers l'arrière
                                    </button>
                                  </div>
                                )}
                                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                                  Arrimage : <strong className="text-slate-900">{balance.lashing.total} sangle{balance.lashing.total > 1 ? 's' : ''}</strong> par-dessus
                                  ({balance.lashing.walls.length} mur{balance.lashing.walls.length > 1 ? 's' : ''}, STF {lashingParams.stfDaN} daN, µ {String(lashingParams.mu).replace('.', ',')})
                                  {balance.lashing.perStrapKg === null ? ' : le frottement suffit, 1 sangle par mur minimum.' : `, soit ${formatKg(Math.floor(balance.lashing.perStrapKg))} kg retenus par sangle.`}
                                  <span className="text-slate-400"> Détail par mur sur la fiche.</span>
                                </div>
                                <div className="text-[9px] text-slate-400 leading-snug">
                                  Estimation indicative (bras de levier, arrimage par friction EN 12195-1, CTU Code). Ne remplace pas le plan d'arrimage ni les données du constructeur.
                                </div>
                              </div>
                            </div>
                          )}

                        </>
                      )}
                      {currentTab === 'tour' && (
                        <>
                          {multiStopResult && (
                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                              <div className="px-4 py-2.5 border-b border-slate-100 font-jetbrains text-[10px] tracking-wider text-slate-500 flex items-center gap-1.5">
                                <MapPin size={12} /> TOURNÉE · {result.deliveryMode === 'SOFT' ? 'MODE SOUPLE' : 'MODE STRICT'}
                              </div>
                              <div className="divide-y divide-slate-50">
                                {resultStops.map((s) => (
                                  <div key={s.stop} className="px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 sm:gap-2 text-[11px] font-jetbrains">
                                    <span className="flex items-center gap-1.5 text-slate-800 min-w-0">
                                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: stopColor(s.stop).solid }} />{stopLabel(s.stop, rows)}
                                    </span>
                                    <span className="text-slate-500 pl-4 sm:pl-0 whitespace-nowrap">
                                      <span style={{ color: s.unpackedItems > 0 ? '#B91C1C' : undefined }}>{s.packedItems}/{s.totalItems}</span> · {formatKg(s.packedWeight)} kg · {formatM3(s.packedVolume)} m³
                                    </span>
                                  </div>
                                ))}
                              </div>
                              {result.blockedItemIds.length > 0 ? (
                                <div className="px-4 py-2.5 border-t border-slate-100 text-[11px] flex items-start gap-1.5" style={{ color: '#B91C1C', background: '#FEF2F2' }}>
                                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                                  {result.blockedItemIds.length} colis devront être déplacés pour accéder à leur arrêt (bordure rouge sur le plan).
                                </div>
                              ) : (
                                <div className="px-4 py-2.5 border-t border-slate-100 text-[11px] flex items-center gap-1.5" style={{ color: '#15803D', background: '#F0FDF4' }}>
                                  <Check size={13} /> Chaque arrêt est accessible sans déplacer de colis.
                                </div>
                              )}
                            </div>
                          )}

                        </>
                      )}
                      {currentTab === 'reliquats' && (
                        <>
                          {result.unpackedCount > 0 && multiStopResult && (
                            <div className="rounded-xl border p-4 bg-white space-y-3" style={{ borderColor: '#FECACA' }}>
                              <div className="font-jetbrains text-[10px] tracking-wider flex items-center gap-1.5" style={{ color: '#B91C1C' }}>
                                <AlertCircle size={12} /> TOUT NE RENTRE PAS — QUE FAIRE ?
                              </div>
                              {resultStops.filter((s) => s.unpackedItems > 0).map((s) => {
                                const refs = Object.entries(result.unpackedItems.filter((u) => u.stop === s.stop)
                                  .reduce((acc, u) => { acc[u.reference] = (acc[u.reference] || 0) + 1; return acc; }, {}));
                                const deferred = deferredExcess.includes(s.stop);
                                return (
                                  <div key={s.stop} className="rounded-lg border border-slate-200 p-3">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <span className="font-jetbrains text-xs font-medium text-slate-800 flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: stopColor(s.stop).solid }} />{stopLabel(s.stop, rows)}
                                      </span>
                                      <span className="font-jetbrains text-[11px]" style={{ color: '#B91C1C' }}>{s.unpackedItems} colis en excès sur {s.totalItems}</span>
                                    </div>
                                    <div className="font-jetbrains text-[11px] text-slate-500 mt-1">{refs.map(([ref, q]) => `${ref} ×${q}`).join(' · ')}</div>
                                    {deferred ? (
                                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-jetbrains" style={{ color: '#15803D' }}>
                                        <span className="flex items-center gap-1"><Check size={12} /> Excédent reporté, le reste de l'arrêt est chargé.</span>
                                        <button onClick={() => undoDefer(s.stop)} className="text-slate-400 hover:text-slate-700 flex items-center gap-1"><Undo2 size={11} /> Annuler</button>
                                      </div>
                                    ) : (
                                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        <button onClick={() => deferExcess(s.stop)} className="px-2.5 py-2 rounded-md text-[11px] font-jetbrains text-left" style={{ background: BLUE_LIGHT, color: BLUE }}>
                                          Reporter seulement les {s.unpackedItems} colis en excès
                                        </button>
                                        <button onClick={() => excludeStop(s.stop)} className="px-2.5 py-2 rounded-md text-[11px] font-jetbrains text-left" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
                                          Retirer tout l'arrêt ({s.totalItems} colis) et recalculer
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {result.deliveryMode === 'STRICT' && (
                                <button onClick={trySoft} className="w-full text-[11px] font-jetbrains text-slate-500 hover:text-slate-800 underline underline-offset-2">
                                  Ou essayer le mode souple (charge plus, avec des colis à déplacer en livraison)
                                </button>
                              )}
                            </div>
                          )}

                          {leftovers.length > 0 && (
                            <div className="rounded-xl border p-4 bg-white" style={{ borderColor: '#FDE68A' }}>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="font-jetbrains text-[10px] tracking-wider" style={{ color: '#B45309' }}>À REPORTER SUR UN AUTRE VÉHICULE</div>
                                <button onClick={exportLeftovers} className="flex items-center gap-1 font-jetbrains text-[10px] px-2 py-1 rounded-md" style={{ background: '#FFFBEB', color: '#B45309' }}>
                                  <Download size={11} /> Excel
                                </button>
                              </div>
                              <div className="space-y-1">
                                {leftovers.map((l, i) => (
                                  <div key={i} className="flex items-center gap-2 text-[11px] font-jetbrains text-slate-600">
                                    <span className="text-slate-800">{stopLabel(l.stop, rows)}</span>
                                    <span>{l.reference} ×{l.quantity}</span>
                                    <span className="text-slate-400">· {l.reason}</span>
                                  </div>
                                ))}
                              </div>
                              {excludedStops.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {excludedStops.map((s) => (
                                    <button key={s} onClick={() => restoreStop(s)} className="flex items-center gap-1 font-jetbrains text-[10px] px-2 py-1 rounded-md" style={{ background: '#F1F5F9', color: '#475569' }}>
                                      <Undo2 size={11} /> Réintégrer l'arrêt {s}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {result.unpackedCount > 0 && !multiStopResult && (
                            <div className="rounded-xl border p-4 bg-white" style={{ borderColor: '#FECACA' }}>
                              <div className="font-jetbrains text-[10px] tracking-wider mb-2 flex items-center gap-1.5" style={{ color: '#B91C1C' }}>
                                <AlertCircle size={12} /> MARCHANDISES NON CHARGÉES
                              </div>
                              <div className="space-y-1">
                                {Object.entries(result.unpackedItems.reduce((acc, u) => { acc[u.reference] = (acc[u.reference] || 0) + 1; return acc; }, {})).map(([ref, qty]) => (
                                  <div key={ref} className="flex items-center gap-2 text-xs font-jetbrains text-slate-600">
                                    <span className="font-medium text-slate-800">{ref}</span>
                                    <span className="text-slate-500">{qty} u.</span>
                                    <span className="text-slate-300">·</span>
                                    <span style={{ color: '#B91C1C' }}>Aucun emplacement compatible trouvé.</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        </>
                      )}
                    </div>
                  </div>

                </div>
              </>
            ) : (
              <div className={`rounded-xl border border-slate-200 bg-white p-8 flex-col items-center justify-center text-center xl:col-span-5 ${status === 'running' ? 'flex' : 'hidden'}`}>
                {status === 'running' ? (
                  <><Loader2 size={28} className="animate-spin text-slate-400 mb-3" /><div className="font-jetbrains text-sm text-slate-500">Optimisation du chargement…</div></>
                ) : (
                  <><div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: BLUE_LIGHT }}><Truck size={22} style={{ color: BLUE }} /></div>
                    <div className="font-bricolage text-lg text-slate-800 mb-1">Votre plan de chargement</div>
                    <div className="text-sm text-slate-500 max-w-xs">Renseignez vos marchandises, choisissez un contenant, puis lancez l'optimisation.</div></>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile / tablette : action principale toujours accessible tant que le plan n'est pas calculé */}
      {status !== 'done' && !ctaVisible && rows.length > 0 && (
        <div className="xl:hidden fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-3 print:hidden"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="max-w-xl mx-auto flex items-center gap-3">
            <div className="font-jetbrains text-[10px] text-slate-500 leading-tight shrink-0">
              <div><span className="text-slate-900 font-medium">{totals.units}</span> unités</div>
              <div>{formatM3(totals.volume)} m³ · {formatKg(totals.weight)} kg</div>
            </div>
            <button onClick={optimize} disabled={!valid || status === 'running'}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bricolage font-semibold text-white disabled:opacity-50"
              style={{ background: BLUE }}>
              {status === 'running' ? <><Loader2 size={16} className="animate-spin" /> Calcul…</> : <>Optimiser <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>
      )}

      {/* Contenu SEO */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Guide complet : <a href="/ressources/plan-de-chargement-camion" className="font-medium underline underline-offset-2" style={{ color: BLUE }}>comment faire un plan de chargement de camion ou de conteneur</a> (dimensions utiles, palettes, tournées multi-arrêts) et <a href="/ressources/arrimage-des-charges" className="font-medium underline underline-offset-2" style={{ color: BLUE }}>combien de sangles poser pour l'arrimage</a>.
        </p>
        <section>
          <h2 className="font-bricolage font-bold text-xl text-slate-900 mb-2">Comment fonctionne l'optimiseur de chargement ?</h2>
          <p className="text-slate-600 leading-relaxed">
            Vous saisissez vos marchandises (dimensions, poids, quantité, rotation et empilabilité), vous choisissez un camion
            ou un conteneur, puis l'outil calcule un plan de chargement en 3D. Un moteur de <em>bin packing</em> place les unités
            une à une en respectant les parois du contenant, le poids maximal, les orientations autorisées, l'empilabilité et la
            stabilité de chaque colis. Le calcul s'exécute dans votre navigateur, en quelques instants.
          </p>
        </section>
        <section>
          <h2 className="font-bricolage font-bold text-xl text-slate-900 mb-2">Pourquoi optimiser le chargement d'un camion ou conteneur ?</h2>
          <p className="text-slate-600 leading-relaxed">
            Mieux remplir un véhicule, c'est moins de trajets, un meilleur taux de remplissage et des coûts de transport réduits.
            C'est aussi moins d'émissions de CO₂ par unité transportée et un gain de productivité à la préparation : un plan clair
            évite les reprises et les palettes mal réparties.
          </p>
        </section>
        <section>
          <h2 className="font-bricolage font-bold text-xl text-slate-900 mb-2">Quels types de chargements sont pris en charge ?</h2>
          <p className="text-slate-600 leading-relaxed">
            Cartons, colis et palettes de forme rectangulaire, dans une semi-remorque ou des conteneurs maritimes 20', 40' et 40' High Cube,
            ou un contenant aux dimensions personnalisées.
          </p>
        </section>
        <section>
          <h2 className="font-bricolage font-bold text-xl text-slate-900 mb-3">Questions fréquentes</h2>
          <div className="space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <summary className="font-jetbrains text-sm text-slate-800 cursor-pointer">{f.q}</summary>
                <p className="text-slate-600 text-sm mt-2 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA vers les autres outils */}
        <section className="rounded-xl border border-slate-200 p-6 text-center" style={{ background: BLUE_LIGHT, borderColor: '#BFDBFE' }}>
          <h2 className="font-bricolage font-bold text-lg text-slate-900 mb-1">Vous souhaitez aller plus loin dans l'optimisation de vos flux logistiques ?</h2>
          <p className="text-slate-600 text-sm mb-4 max-w-xl mx-auto">
            Atelier Logistique vous propose également des outils pour analyser vos stocks, vos approvisionnements et votre performance Supply Chain.
          </p>
          <a href="/#tools" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-jetbrains text-sm font-medium text-white" style={{ background: BLUE }}>
            Découvrir les autres outils <ArrowRight size={15} />
          </a>
        </section>
      </div>

      {result && status === 'done' && (
        createPortal(
          <div className="lo-print-root">
            <PrintSheet container={container} result={planResult} shiftMm={shiftMm} rows={rows} colorIndex={colorIndex} multiStopResult={multiStopResult} leftovers={leftovers} balance={balance} />
          </div>,
          document.body,
        )
      )}
    </div>
  );
}
