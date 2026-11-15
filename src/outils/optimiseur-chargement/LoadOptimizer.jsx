import { useState, useMemo, useEffect, useCallback, lazy, Suspense, Component } from 'react';
import {
  ArrowLeft, Plus, Trash2, Truck, Box, Loader2, AlertCircle,
  RotateCcw, Check, ArrowRight, Boxes,
} from 'lucide-react';

const LoadView3D = lazy(() => import('./LoadView3D.jsx'));

// Error boundary : si Three.js échoue, on retombe sur le schéma 2D (CDC §53).
class ThreeErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { if (import.meta.env?.DEV) console.error('Vue 3D indisponible :', err); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
import { CONTAINER_PRESETS } from './constants/containers';
import { useOptimizer } from './useOptimizer';
import {
  emptyRow, exampleRows, validateRow, rowsAreValid, coerceField,
  rowsToDefinitions, cmToMm, refColor, ROTATION_OPTIONS,
  formatM3, formatKg, formatPct, mm3ToM3,
} from './uiHelpers';

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
function Th({ children, className = '' }) {
  return <th className={`font-normal text-slate-400 px-2 py-2 text-[10px] tracking-wider ${className}`}>{children}</th>;
}

function NumCell({ value, onChange, error, width = 'w-14', step = '1' }) {
  return (
    <div className={width}>
      <input
        type="number" value={value} min="0" step={step}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 bg-white border rounded-md outline-none font-jetbrains text-xs text-center text-slate-800 focus:border-slate-400"
        style={{ borderColor: error ? '#FCA5A5' : '#E2E8F0' }}
      />
      {error && <div className="text-[9px] text-red-500 mt-0.5 leading-tight">{error}</div>}
    </div>
  );
}

// ---- Schéma 2D (vue de dessus + vue de côté) — étape intermédiaire avant la 3D ----
function Schematic2D({ container, placed, colorOf, highlight }) {
  const target = 520;
  const scale = target / container.length;
  const topH = container.width * scale;
  const sideH = container.height * scale;
  const W = container.length * scale;

  const rects = (project) => placed.map((p, i) => {
    const r = project(p);
    const c = colorOf(p.definitionId);
    const dim = highlight && highlight !== p.definitionId;
    return (
      <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h}
        fill={c.light} stroke={c.dark} strokeWidth="0.7"
        opacity={dim ? 0.18 : 0.92} />
    );
  });

  return (
    <div className="space-y-4">
      <div>
        <div className="font-jetbrains text-[10px] text-slate-400 mb-1 tracking-wider">VUE DE DESSUS — X × Y</div>
        <svg viewBox={`-2 -2 ${W + 4} ${topH + 4}`} className="w-full h-auto" style={{ maxHeight: 220 }}>
          <rect x="0" y="0" width={W} height={topH} fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
          {rects((p) => ({ x: p.x * scale, y: p.y * scale, w: p.length * scale, h: p.width * scale }))}
        </svg>
      </div>
      <div>
        <div className="font-jetbrains text-[10px] text-slate-400 mb-1 tracking-wider">VUE DE CÔTÉ — X × Z</div>
        <svg viewBox={`-2 -2 ${W + 4} ${sideH + 4}`} className="w-full h-auto" style={{ maxHeight: 220 }}>
          <rect x="0" y="0" width={W} height={sideH} fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
          {rects((p) => ({ x: p.x * scale, y: (container.height - (p.z + p.height)) * scale, w: p.length * scale, h: p.height * scale }))}
        </svg>
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
  useDocumentMeta(
    'Optimiseur de chargement 3D camion et conteneur | Atelier Logistique',
    'Optimisez gratuitement le chargement de vos cartons et palettes dans un camion ou un conteneur. Visualisez automatiquement votre plan de chargement en 3D.',
  );

  const [rows, setRows] = useState(exampleRows);
  const [containerId, setContainerId] = useState('semi');
  const [custom, setCustom] = useState({ label: 'Mon contenant', length: 600, width: 240, height: 240, maxWeight: '' });
  const [highlight, setHighlight] = useState(null);
  const [view3d, setView3d] = useState(true);
  const [hovered, setHovered] = useState(null);
  const { run, reset, result, status } = useOptimizer();

  // Index couleur stable par référence (ordre des lignes)
  const colorIndex = useMemo(() => {
    const map = {};
    rows.forEach((r, i) => { map[r.id] = i; });
    return map;
  }, [rows]);
  const colorOf = useCallback((definitionId) => refColor(colorIndex[definitionId] ?? 0), [colorIndex]);

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

  const valid = rowsAreValid(rows);

  const totals = useMemo(() => {
    const units = rows.reduce((s, r) => s + (r.quantity || 0), 0);
    const volume = rows.reduce((s, r) => s + (r.quantity || 0) * cmToMm(r.length) * cmToMm(r.width) * cmToMm(r.height), 0);
    const weight = rows.reduce((s, r) => s + (r.quantity || 0) * (r.weight || 0), 0);
    return { units, volume, weight };
  }, [rows]);

  const containerVolume = container.length * container.width * container.height;
  const overweight = container.maxWeight != null && totals.weight > container.maxWeight;

  const updateRow = (id, field, value) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: coerceField(field, value) } : r)));
    if (status !== 'idle') reset();
  };
  const removeRow = (id) => { setRows((rs) => rs.filter((r) => r.id !== id)); if (status !== 'idle') reset(); };
  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const loadExample = () => { setRows(exampleRows()); reset(); };

  const optimize = () => {
    if (!valid) return;
    setHighlight(null);
    run(container, rowsToDefinitions(rows));
  };

  return (
    <div className="min-h-screen text-slate-900" style={{ background: '#F8FAFC', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-jetbrains text-xs">
              <ArrowLeft size={14} /> RETOUR
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <div>
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
      <div className="max-w-[1600px] mx-auto px-6 pt-8 pb-2">
        <h1 className="font-bricolage font-bold text-2xl md:text-3xl text-slate-900">Optimiseur de chargement 3D</h1>
        <p className="text-slate-600 mt-1">Optimisez le remplissage de vos camions et conteneurs en quelques secondes.</p>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* GAUCHE : saisie */}
          <div className="lg:col-span-3 space-y-4">

            {/* 1. Marchandises */}
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="font-jetbrains text-xs text-slate-600 flex items-center gap-2"><Boxes size={13} /> 1 · QUE SOUHAITEZ-VOUS CHARGER ?</div>
                <button onClick={loadExample} className="font-jetbrains text-[11px] px-2.5 py-1.5 rounded-md" style={{ background: BLUE_LIGHT, color: BLUE }}>Charger un exemple</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <Th className="text-left">Référence</Th>
                      <Th>Qté</Th><Th>L</Th><Th>l</Th><Th>H</Th><Th>Poids</Th>
                      <Th>Rotation</Th><Th>Empil.</Th><Th></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const err = validateRow(r);
                      return (
                        <tr key={r.id} className="border-b border-slate-50 align-top">
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-sm shrink-0 mt-1" style={{ background: refColor(i).solid }} />
                              <div className="flex-1 min-w-[90px]">
                                <input value={r.reference} onChange={(e) => updateRow(r.id, 'reference', e.target.value)}
                                  placeholder="Réf."
                                  className="w-full px-2 py-1.5 bg-white border rounded-md outline-none font-jetbrains text-xs text-slate-800 focus:border-slate-400"
                                  style={{ borderColor: err.reference ? '#FCA5A5' : '#E2E8F0' }} />
                                {err.reference && <div className="text-[9px] text-red-500 mt-0.5">{err.reference}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-1 py-1.5"><NumCell value={r.quantity} onChange={(v) => updateRow(r.id, 'quantity', v)} error={err.quantity} width="w-12" /></td>
                          <td className="px-1 py-1.5"><NumCell value={r.length} onChange={(v) => updateRow(r.id, 'length', v)} error={err.length} /></td>
                          <td className="px-1 py-1.5"><NumCell value={r.width} onChange={(v) => updateRow(r.id, 'width', v)} error={err.width} /></td>
                          <td className="px-1 py-1.5"><NumCell value={r.height} onChange={(v) => updateRow(r.id, 'height', v)} error={err.height} /></td>
                          <td className="px-1 py-1.5"><NumCell value={r.weight} onChange={(v) => updateRow(r.id, 'weight', v)} error={err.weight} step="0.1" /></td>
                          <td className="px-1 py-1.5">
                            <select value={r.rotationMode} onChange={(e) => updateRow(r.id, 'rotationMode', e.target.value)}
                              className="px-1.5 py-1.5 bg-white border border-slate-200 rounded-md outline-none font-jetbrains text-[11px] text-slate-700">
                              {ROTATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <button onClick={() => updateRow(r.id, 'stackable', !r.stackable)}
                              className="w-7 h-7 rounded-md flex items-center justify-center mx-auto"
                              style={r.stackable ? { background: BLUE_LIGHT, color: BLUE } : { background: '#F1F5F9', color: '#94A3B8' }}
                              title={r.stackable ? 'Empilable' : 'Non empilable'}>
                              {r.stackable ? <Check size={13} /> : '—'}
                            </button>
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <button onClick={() => removeRow(r.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={13} /></button>
                          </td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr><td colSpan={9} className="text-center text-slate-400 py-6 text-sm">Aucune marchandise — ajoutez une référence ou chargez l'exemple.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                <button onClick={addRow} className="flex items-center gap-1.5 font-jetbrains text-xs px-3 py-2 rounded-md" style={{ background: '#F1F5F9', color: '#475569' }}>
                  <Plus size={13} /> Ajouter une référence
                </button>
                <span className="font-jetbrains text-[10px] text-slate-400">dimensions en cm · poids en kg</span>
              </div>
            </div>

            {/* 2. Contenant */}
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600 flex items-center gap-2"><Truck size={13} /> 2 · CHOISISSEZ VOTRE VÉHICULE OU CONTENANT</div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                {CONTAINER_PRESETS.map((c) => (
                  <button key={c.id} onClick={() => { setContainerId(c.id); reset(); }}
                    className="text-left px-3 py-2.5 rounded-lg font-jetbrains transition-all"
                    style={containerId === c.id ? { background: BLUE, color: '#fff' } : { background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
                    <div className="text-[11px] font-semibold leading-tight">{c.label}</div>
                    <div className="text-[9px] opacity-80 mt-1">{(c.length / 1000).toFixed(2)}×{(c.width / 1000).toFixed(2)}×{(c.height / 1000).toFixed(2)} m</div>
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
            </div>

            {/* Récap + CTA */}
            <div className="rounded-xl border p-4 bg-white" style={{ borderColor: BLUE, background: BLUE_LIGHT }}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div><div className="font-jetbrains text-[10px] text-slate-500">Unités</div><div className="font-bricolage font-bold text-xl" style={{ color: BLUE }}>{totals.units}</div></div>
                <div><div className="font-jetbrains text-[10px] text-slate-500">Volume march.</div><div className="font-bricolage font-bold text-xl text-slate-800">{formatM3(totals.volume)} m³</div></div>
                <div><div className="font-jetbrains text-[10px] text-slate-500">Poids total</div><div className="font-bricolage font-bold text-xl text-slate-800">{formatKg(totals.weight)} kg</div></div>
                <div><div className="font-jetbrains text-[10px] text-slate-500">Contenant</div><div className="font-bricolage font-bold text-xl text-slate-800">{formatM3(containerVolume)} m³</div></div>
              </div>
              {overweight && (
                <div className="flex items-start gap-2 text-[11px] mb-3 px-3 py-2 rounded-md" style={{ background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A' }}>
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  Le poids total ({formatKg(totals.weight)} kg) dépasse le poids utile du contenant ({formatKg(container.maxWeight)} kg). Le moteur chargera ce qui est admissible.
                </div>
              )}
              <button onClick={optimize} disabled={!valid || status === 'running'}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bricolage font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: BLUE }}>
                {status === 'running' ? <><Loader2 size={16} className="animate-spin" /> Optimisation du chargement…</> : <>Optimiser le chargement <ArrowRight size={16} /></>}
              </button>
              {!valid && <div className="text-[11px] text-slate-500 mt-2 text-center">Complétez les références (dimensions et quantités valides) pour lancer le calcul.</div>}
            </div>
          </div>

          {/* DROITE : résultat */}
          <div className="lg:col-span-2 space-y-4">
            {status === 'done' && result ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Kpi label="Taux de remplissage" value={`${formatPct(result.volumeUtilization)} %`} sub="volume placé / contenant" />
                  <Kpi label="Articles chargés" value={`${result.packedItems} / ${result.totalItems}`} sub={result.unpackedCount > 0 ? `${result.unpackedCount} non chargé(s)` : 'tout rentre'} />
                </div>

                <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-4">
                  <Bar label="Poids utilisé" value={result.usedWeight} max={result.maxWeight ?? result.usedWeight} unit="kg" format={formatKg} />
                  <Bar label="Volume utilisé" value={mm3ToM3(result.usedVolume)} max={mm3ToM3(result.containerVolume)} unit="m³" format={(v) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} />
                </div>

                <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                  <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2"><Box size={13} /> PLAN DE CHARGEMENT</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5 p-0.5 rounded-md" style={{ background: '#F1F5F9' }}>
                        <button onClick={() => setView3d(true)} className="px-2 py-1 rounded text-[10px]" style={view3d ? { background: '#fff', color: BLUE, fontWeight: 600 } : { color: '#64748B' }}>3D</button>
                        <button onClick={() => setView3d(false)} className="px-2 py-1 rounded text-[10px]" style={!view3d ? { background: '#fff', color: BLUE, fontWeight: 600 } : { color: '#64748B' }}>Schéma</button>
                      </div>
                      <span className="text-[10px] text-slate-400">{result.computationTimeMs} ms</span>
                    </div>
                  </div>
                  <div className="p-4 relative">
                    {view3d ? (
                      <ThreeErrorBoundary fallback={<Schematic2D container={container} placed={result.placedItems} colorOf={colorOf} highlight={highlight} />}>
                        <Suspense fallback={<div className="flex items-center justify-center text-slate-400 font-jetbrains text-xs" style={{ height: 460 }}><Loader2 size={18} className="animate-spin mr-2" /> Chargement de la vue 3D…</div>}>
                          <LoadView3D container={container} placed={result.placedItems} colorOf={colorOf} highlight={highlight} onHover={setHovered} />
                        </Suspense>
                      </ThreeErrorBoundary>
                    ) : (
                      <Schematic2D container={container} placed={result.placedItems} colorOf={colorOf} highlight={highlight} />
                    )}
                    {hovered && (
                      <div className="absolute bottom-3 left-3 bg-white/95 border border-slate-200 rounded-lg px-3 py-2 font-jetbrains text-[11px] shadow-sm pointer-events-none">
                        <div className="font-semibold text-slate-800">{hovered.reference}</div>
                        <div className="text-slate-500">{Math.round(hovered.originalLength / 10)} × {Math.round(hovered.originalWidth / 10)} × {Math.round(hovered.originalHeight / 10)} cm · {hovered.weight} kg</div>
                      </div>
                    )}
                  </div>
                  {/* Légende */}
                  <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1.5">
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
                </div>

                {result.unpackedCount > 0 && (
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

                <button onClick={optimize} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg font-jetbrains text-xs text-slate-500 hover:text-slate-800 border border-slate-200 bg-white">
                  <RotateCcw size={13} /> Relancer le calcul
                </button>
              </>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-8 flex flex-col items-center justify-center text-center" style={{ minHeight: 360 }}>
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
    </div>
  );
}
