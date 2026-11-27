// Page d'accueil dédiée : palettisation 3D + chargement camion + transport (mètres plancher, transporteurs, factures).
// Contenu seul (l'en-tête et le pied de page du site sont fournis par App.jsx). Animations en CSS pur,
// figées si l'utilisateur réduit les animations ; simulateurs calculés dans le navigateur.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Package, Truck, Ruler, Receipt, ScanLine, Route as RouteIcon, Plug, ShieldCheck, Layers, CheckCircle2,
  AlertTriangle, Sparkles, ChevronDown, CalendarDays,
} from 'lucide-react';
import { defaultReferences } from '../../shared/references/defaults';
import { t as tr, tText, numLocale, getCurrentLang } from '../../shared/i18n/core';

// Liens selon la langue de la page (/chargement-palettisation ou /en).
const isEn = () => getCurrentLang() === 'en';
const LOAD_HREF = () => (isEn() ? '/en/truck-load-planner' : '/outils/optimiseur-chargement');
const PALLET_HREF = () => (isEn() ? '/en/palletizing-calculator' : '/outils/pallet');

const BLUE = '#2563EB';
const AMBER = '#F59E0B';
const NAVY = '#0F172A';
const GREEN = '#10B981';
const VIOLET = '#8B5CF6';
const ROSE = '#F43F5E';
const CYAN = '#06B6D4';

const fmt = (v, d = 0) => Number(v).toLocaleString(numLocale(), { minimumFractionDigits: d, maximumFractionDigits: d });

// Véhicules et palettes : mêmes valeurs par défaut que l'espace (Paramètres › Tables de référence).
const REFS = defaultReferences();
const VEH = ['fourgon20', 'porteur12', 'porteur19', 'semi'].map((c) => REFS.find((r) => r.kind === 'vehicle' && r.code === c)).filter(Boolean)
  .map((r) => ({ code: r.code, label: r.label, ...r.data }));
const PALLETS = ['eur', 'eur3', 'half'].map((c) => REFS.find((r) => r.kind === 'pallet' && r.code === c)).filter(Boolean)
  .map((r) => ({ code: r.code, label: r.label, ...r.data }));

// ---------------------------------------------------------------- Styles partagés (animations)
const CSS = `
@keyframes ll-road{to{stroke-dashoffset:-80}}
@keyframes ll-drive{0%{transform:translateX(-340px)}100%{transform:translateX(1340px)}}
@keyframes ll-drive-back{0%{transform:translateX(1340px) scaleX(-1)}100%{transform:translateX(-340px) scaleX(-1)}}
@keyframes ll-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}
@keyframes ll-spin{to{transform:rotate(360deg)}}
@keyframes ll-city{to{transform:translateX(-600px)}}
@keyframes ll-float{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-14px) rotate(3deg)}}
@keyframes ll-pop{0%{opacity:0;transform:translateY(-14px) scale(.85)}100%{opacity:1;transform:none}}
@keyframes ll-in{0%{opacity:0;transform:translateY(18px)}100%{opacity:1;transform:none}}
@keyframes ll-glow{0%,100%{opacity:.35}50%{opacity:.8}}
@keyframes ll-scan{0%{transform:translateY(0)}100%{transform:translateY(150px)}}
@keyframes ll-arrive{0%{transform:translateX(-120%)}70%{transform:translateX(3%)}100%{transform:none}}
.ll-wheel{transform-box:fill-box;transform-origin:center;animation:ll-spin .6s linear infinite}
.ll-pop{animation:ll-pop .45s cubic-bezier(.2,.9,.3,1.3) both}
.ll-in{animation:ll-in .7s ease-out both}
.ll-reveal{opacity:0;transform:translateY(24px);transition:opacity .7s ease,transform .7s ease}
.ll-reveal.ll-on{opacity:1;transform:none}
input[type=range].ll-range{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:999px;background:linear-gradient(90deg,var(--c) var(--p),#E2E8F0 var(--p));outline:none}
input[type=range].ll-range::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#fff;border:3px solid var(--c);box-shadow:0 2px 8px rgba(15,23,42,.25);cursor:grab}
input[type=range].ll-range::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#fff;border:3px solid var(--c);cursor:grab}
@media (prefers-reduced-motion: reduce){.ll-anim,.ll-wheel,.ll-pop,.ll-in{animation:none!important}.ll-reveal{opacity:1;transform:none;transition:none}}
`;

/** Apparition au défilement. */
function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setOn(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`ll-reveal ${on ? 'll-on' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

/** Compteur qui défile jusqu'à sa valeur quand il devient visible. */
function CountUp({ to, suffix = '', decimals = 0, duration = 1400 }) {
  const ref = useRef(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const el = ref.current;
    let raf; let started = false;
    const run = () => {
      const t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / duration); setV(to * (1 - (1 - k) ** 3)); if (k < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    };
    if (!el || typeof IntersectionObserver === 'undefined') { setV(to); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) { started = true; run(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, duration]);
  return <span ref={ref}>{fmt(v, decimals)}{suffix}</span>;
}

// ---------------------------------------------------------------- Camion (SVG)
function TruckSvg({ color = BLUE, cargo = [AMBER, GREEN, VIOLET], scale = 1, cab = NAVY, label }) {
  return (
    <g transform={`scale(${scale})`}>
      {/* remorque */}
      <rect x="0" y="0" width="210" height="78" rx="5" fill="#F8FAFC" stroke={color} strokeWidth="2.5" />
      <rect x="0" y="0" width="210" height="12" rx="5" fill={color} />
      {cargo.map((c, i) => <rect key={i} x={12 + i * 64} y="24" width="56" height="44" rx="3" fill={c} opacity="0.9" />)}
      {label && <text x="105" y="9" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff" fontFamily="JetBrains Mono, monospace">{label}</text>}
      {/* cabine */}
      <path d="M214 78 V30 q0 -8 8 -8 h26 q8 0 12 8 l12 22 v26 z" fill={cab} />
      <path d="M226 30 h20 l10 20 h-30 z" fill="#93C5FD" opacity="0.85" />
      <rect x="262" y="60" width="10" height="6" rx="2" fill={AMBER} />
      {/* châssis + roues */}
      <rect x="0" y="78" width="272" height="6" fill="#334155" />
      {[30, 58, 150, 236].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="90" r="11" fill="#0F172A" />
          <g className="ll-wheel"><circle cx={cx} cy="90" r="5" fill="#94A3B8" /><rect x={cx - 1} y="81" width="2" height="18" fill="#475569" /></g>
        </g>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- 1. Hero : la route
function HeroScene() {
  return (
    <svg viewBox="0 0 1000 300" className="w-full h-auto" preserveAspectRatio="xMidYMax slice" role="img" aria-label={tr('Des camions chargés roulent sur la route')}>
      {/* ville en arrière-plan, qui défile lentement */}
      <g className="ll-anim" style={{ animation: 'll-city 40s linear infinite' }} opacity="0.35">
        {Array.from({ length: 2 }).map((_, k) => (
          <g key={k} transform={`translate(${k * 600} 0)`}>
            {[[0, 120], [40, 90], [70, 140], [120, 100], [160, 160], [210, 110], [250, 130], [300, 80], [340, 150], [400, 120], [450, 95], [500, 140], [550, 105]].map(([x, h]) => (
              <rect key={x} x={x} y={200 - h} width="36" height={h} fill="#1E3A8A" />
            ))}
          </g>
        ))}
      </g>
      {/* entrepôt */}
      <g opacity="0.9">
        <path d="M790 200 V120 l70 -30 l70 30 V200 z" fill="#1E293B" stroke="#334155" />
        {[0, 1, 2].map((i) => <rect key={i} x={808 + i * 40} y="150" width="30" height="50" rx="2" fill="#0F172A" stroke={AMBER} strokeOpacity="0.5" />)}
        <text x="860" y="138" textAnchor="middle" fontSize="11" fill={AMBER} fontFamily="JetBrains Mono, monospace" fontWeight="700">{tr('QUAI')}</text>
      </g>
      {/* route */}
      <rect x="0" y="200" width="1000" height="100" fill="#0B1222" />
      <line x1="0" y1="250" x2="1000" y2="250" stroke="#FACC15" strokeWidth="4" strokeDasharray="40 40" className="ll-anim" style={{ animation: 'll-road 1s linear infinite' }} />
      <line x1="0" y1="203" x2="1000" y2="203" stroke="#334155" strokeWidth="3" />
      {/* camions */}
      <g className="ll-anim" style={{ animation: 'll-drive 11s linear infinite' }}>
        <g transform="translate(0 112)"><g className="ll-anim" style={{ animation: 'll-bob .5s ease-in-out infinite' }}><TruckSvg color={BLUE} cargo={[AMBER, GREEN, VIOLET]} label={tr('100 % REMPLI')} /></g></g>
      </g>
      <g className="ll-anim" style={{ animation: 'll-drive 11s linear infinite', animationDelay: '-5.5s' }}>
        <g transform="translate(0 112)"><g className="ll-anim" style={{ animation: 'll-bob .55s ease-in-out infinite' }}><TruckSvg color={AMBER} cab="#7C2D12" cargo={[CYAN, ROSE, BLUE]} label={tr('6,8 MPL')} /></g></g>
      </g>
      <g className="ll-anim" style={{ animation: 'll-drive-back 14s linear infinite', animationDelay: '-3s' }}>
        <g transform="translate(0 196) scale(0.6)"><TruckSvg color={GREEN} cab="#064E3B" cargo={[AMBER, VIOLET, CYAN]} /></g>
      </g>
    </svg>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden" style={{ background: 'radial-gradient(120% 120% at 80% 0%, #1D4ED8 0%, #0F172A 55%, #020617 100%)' }}>
      {/* palettes flottantes */}
      {[[8, 18, AMBER, 0], [88, 24, GREEN, 1.2], [70, 8, VIOLET, 2.1], [22, 6, CYAN, 0.6]].map(([l, t, c, d], i) => (
        <div key={i} aria-hidden className="ll-anim absolute hidden md:block w-10 h-10 rounded-md" style={{ left: `${l}%`, top: `${t}%`, background: c, opacity: 0.25, animation: `ll-float 6s ease-in-out ${d}s infinite` }} />
      ))}
      <div className="relative max-w-7xl mx-auto px-6 md:px-10 pt-16 md:pt-24 pb-6 text-center">
        <div className="ll-in inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-jetbrains tracking-widest mb-6"
          style={{ background: 'rgba(245,158,11,0.15)', color: AMBER, border: '1px solid rgba(245,158,11,0.35)' }}>
          <Sparkles size={12} /> {tr('PALETTISATION · CHARGEMENT 3D · COÛTS TRANSPORT')}
        </div>
        <h1 className="ll-in font-bricolage font-bold text-white text-4xl md:text-6xl lg:text-7xl leading-[1.0] tracking-tight max-w-5xl mx-auto" style={{ animationDelay: '.1s' }}>
          {tr('Palettisez. Chargez.')}
          <span className="block mt-2"><span style={{ color: AMBER }}>{tr('Payez le juste prix')}</span> {tr('du transport.')}</span>
        </h1>
        <p className="ll-in text-slate-300 text-base md:text-xl leading-relaxed max-w-3xl mx-auto mt-6" style={{ animationDelay: '.2s' }}>
          {tr('Des cartons au camion plein, puis jusqu’à la facture du transporteur : palettes optimisées, plan de chargement 3D, mètres plancher, transporteur le moins cher et contrôle des factures. Dans votre navigateur.')}
        </p>
        <div className="ll-in flex flex-col sm:flex-row items-center justify-center gap-3 mt-9" style={{ animationDelay: '.3s' }}>
          <Link to={LOAD_HREF()} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg font-jetbrains text-sm font-semibold shadow-xl transition-all hover:-translate-y-0.5" style={{ background: AMBER, color: NAVY }}>
            {tr('CHARGER MON CAMION')} <ArrowRight size={15} />
          </Link>
          <Link to={PALLET_HREF()} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg font-jetbrains text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-white/10" style={{ border: '1px solid rgba(255,255,255,0.4)' }}>
            {tr('PALETTISER MES CARTONS')} <ArrowRight size={15} />
          </Link>
        </div>
        <p className="ll-in font-jetbrains text-[11px] text-slate-400 mt-4" style={{ animationDelay: '.4s' }}>{tr('Gratuit · sans installation · outils utilisables sans compte')}</p>
      </div>
      <div className="relative mt-4"><HeroScene /></div>
    </section>
  );
}

// ---------------------------------------------------------------- 2. Simulateur camion
const range = (c, v, min, max) => ({ '--c': c, '--p': `${((v - min) / (max - min)) * 100}%` });

function Slider({ label, value, min, max, step = 1, onChange, color = BLUE, unit = '', display }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="font-jetbrains text-sm font-semibold" style={{ color }}>{display ?? fmt(value)}{unit}</span>
      </span>
      <input type="range" className="ll-range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={range(color, value, min, max)} aria-label={label} />
    </label>
  );
}

/** Places au sol d'un véhicule pour un type de palette (meilleure des deux orientations). */
function slotsOf(v, p) {
  const a = Math.floor(v.width / p.width) * Math.floor(v.length / p.length);
  const b = Math.floor(v.width / p.length) * Math.floor(v.length / p.width);
  return a >= b ? { n: a, across: Math.floor(v.width / p.width), along: Math.floor(v.length / p.length), pl: p.length, pw: p.width } : { n: b, across: Math.floor(v.width / p.length), along: Math.floor(v.length / p.width), pl: p.width, pw: p.length };
}

function TruckSimulator() {
  const [count, setCount] = useState(16);
  const [palletCode, setPalletCode] = useState('eur');
  const [weight, setWeight] = useState(450);
  const [height, setHeight] = useState(120);
  const [stack, setStack] = useState(false);
  const [rate, setRate] = useState(95);
  const pallet = PALLETS.find((p) => p.code === palletCode) ?? PALLETS[0];

  const plan = useMemo(() => {
    const layers = stack ? 2 : 1;
    const positions = Math.ceil(count / layers);
    const total = count * weight;
    const ok = (v) => slotsOf(v, pallet).n >= positions && v.maxWeight >= total && (!stack || height * 10 * 2 + 288 <= v.height);
    const v = VEH.find(ok);
    const semi = VEH.find((x) => x.code === 'semi');
    const trucks = v ? 1 : Math.ceil(positions / slotsOf(semi, pallet).n);
    const veh = v ?? semi;
    const slots = slotsOf(veh, pallet);
    const ldm = (positions * pallet.length * pallet.width) / 1e6 / 2.4;
    const ldmBilled = Math.ceil(Math.round(ldm * 10 * 1e6) / 1e6) / 10;
    const volume = (count * pallet.length * pallet.width * (height * 10 + 144)) / 1e9;
    const taxable = Math.max(total, volume * 330, ldm * 1750);
    const groupage = ldmBilled * rate;
    const ftl = veh.cost * trucks;
    return { veh, trucks, slots, positions, ldm, ldmBilled, total, taxable, groupage, ftl, fill: Math.min(1, positions / (slots.n * trucks)) };
  }, [count, pallet, weight, height, stack, rate]);

  // Vue de dessus : remorque à l'échelle, palettes posées une à une.
  const W = 560; const scale = W / plan.veh.length; const H = plan.veh.width * scale;
  const shown = Math.min(plan.positions, plan.slots.n);
  const cells = Array.from({ length: shown }, (_, i) => ({ i, row: i % plan.slots.across, col: Math.floor(i / plan.slots.across) }));
  const cheaper = plan.groupage <= plan.ftl ? 'groupage' : 'ftl';

  return (
    <section id="simulateur" className="bg-slate-50 border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-16 md:py-24">
        <Reveal>
          <div className="font-jetbrains text-xs tracking-wider mb-3" style={{ color: BLUE }}>{tr('01 / SIMULATEUR')}</div>
          <h2 className="font-bricolage font-bold text-3xl md:text-5xl tracking-tight text-slate-900 max-w-3xl">{tr('Quel camion pour vos palettes ?')} <span style={{ color: BLUE }}>{tr('Combien ça coûte ?')}</span></h2>
          <p className="text-slate-600 mt-4 max-w-2xl">{tr('Bougez les curseurs : le véhicule, les mètres plancher, le poids taxable et le prix se recalculent en direct.')}</p>
        </Reveal>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-10">
          <Reveal className="lg:col-span-4">
            <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-6 shadow-sm">
              <div>
                <div className="text-sm font-medium text-slate-700 mb-2">{tr('Type de palette')}</div>
                <div className="grid grid-cols-3 gap-2">
                  {PALLETS.map((p) => (
                    <button key={p.code} type="button" onClick={() => setPalletCode(p.code)}
                      className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-all ${palletCode === p.code ? 'text-white shadow-md' : 'text-slate-700 bg-white hover:border-slate-400'}`}
                      style={palletCode === p.code ? { background: BLUE, borderColor: BLUE } : { borderColor: '#E2E8F0' }}>
                      {tText(p.label).split(' ')[0]}<span className="block font-jetbrains font-normal opacity-80">{p.length / 10}×{p.width / 10}</span>
                    </button>
                  ))}
                </div>
              </div>
              <Slider label={tr('Nombre de palettes')} value={count} min={1} max={66} onChange={setCount} color={BLUE} />
              <Slider label={tr('Poids par palette')} value={weight} min={50} max={1000} step={10} onChange={setWeight} color={VIOLET} unit=" kg" />
              <Slider label={tr('Hauteur de charge')} value={height} min={40} max={200} step={5} onChange={setHeight} color={CYAN} unit=" cm" />
              <label className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5 cursor-pointer">
                <span className="text-sm font-medium text-slate-700">{tr('Palettes gerbables (2 niveaux)')}</span>
                <button type="button" role="switch" aria-checked={stack} onClick={() => setStack((s) => !s)}
                  className="relative w-11 h-6 rounded-full transition-colors" style={{ background: stack ? GREEN : '#CBD5E1' }}>
                  <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: stack ? 22 : 2 }} />
                </button>
              </label>
              <Slider label={tr('Tarif groupage du transporteur')} value={rate} min={40} max={200} step={5} onChange={setRate} color={AMBER} unit={` €/${tr('MPL')}`} />
            </div>
          </Reveal>

          <Reveal className="lg:col-span-8" delay={100}>
            <div className="rounded-2xl p-5 md:p-7 h-full" style={{ background: 'linear-gradient(160deg, #0F172A 0%, #1E3A8A 100%)' }}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 text-white">
                  <Truck size={20} style={{ color: AMBER }} />
                  <span className="font-bricolage font-bold text-xl">{plan.trucks > 1 ? `${plan.trucks} × ` : ''}{tText(plan.veh.label)}</span>
                </div>
                <span className="font-jetbrains text-[11px] px-2.5 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.35)' }}>
                  {plan.trucks > 1 ? tr('plusieurs camions nécessaires') : tr('le plus petit véhicule qui suffit')}
                </span>
              </div>
              {/* remorque vue de dessus */}
              <div key={plan.veh.code} className="ll-anim overflow-x-auto" style={{ animation: 'll-arrive .7s ease-out' }}>
                <svg viewBox={`-6 -6 ${W + 80} ${H + 12}`} className="w-full h-auto min-w-[420px]" role="img" aria-label={tr('Vue de dessus : {n} palettes au sol', { n: shown })}>
                  <rect x="0" y="0" width={W} height={H} rx="6" fill="rgba(255,255,255,0.05)" stroke="#60A5FA" strokeWidth="2" />
                  {Array.from({ length: Math.ceil(plan.veh.length / 1000) }).map((_, i) => (
                    <line key={i} x1={i * 1000 * scale} y1="0" x2={i * 1000 * scale} y2={H} stroke="rgba(148,163,184,0.15)" />
                  ))}
                  <path d={`M${W + 4} 6 h40 q18 0 22 20 v${H - 52} q-4 20 -22 20 h-40 z`} fill="#1E293B" stroke="#60A5FA" strokeWidth="2" />
                  <rect x={W + 30} y={H * 0.2} width="22" height={H * 0.6} rx="4" fill="#93C5FD" opacity="0.6" />
                  {cells.map((c) => (
                    <g key={`${plan.veh.code}-${palletCode}-${c.i}`} className="ll-pop" style={{ animationDelay: `${c.i * 35}ms` }}>
                      <rect x={c.col * plan.slots.pl * scale + 2} y={c.row * plan.slots.pw * scale + 2} width={plan.slots.pl * scale - 4} height={plan.slots.pw * scale - 4} rx="3"
                        fill={[AMBER, GREEN, VIOLET, CYAN, ROSE, BLUE][c.col % 6]} opacity="0.92" />
                      {stack && <rect x={c.col * plan.slots.pl * scale + 6} y={c.row * plan.slots.pw * scale + 6} width={plan.slots.pl * scale - 12} height={plan.slots.pw * scale - 12} rx="2" fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.8" />}
                    </g>
                  ))}
                </svg>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${plan.fill * 100}%`, background: `linear-gradient(90deg, ${GREEN}, ${AMBER})` }} />
              </div>
              <div className="flex justify-between font-jetbrains text-[11px] text-slate-400 mt-1.5">
                <span>{tr('{n} place(s) au sol sur {m}', { n: plan.positions, m: plan.slots.n * plan.trucks })}</span><span>{tr('remplissage {p} %', { p: Math.round(plan.fill * 100) })}</span>
              </div>
              {/* chiffres */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                {[
                  { k: tr('Mètres plancher'), v: `${fmt(plan.ldm, 1)} ${tr('MPL')}`, c: AMBER, icon: Ruler },
                  { k: tr('Poids réel'), v: `${fmt(plan.total)} kg`, c: VIOLET, icon: Package },
                  { k: tr('Poids taxable'), v: `${fmt(plan.taxable)} kg`, c: CYAN, icon: Layers },
                  { k: tr('Facturé au MPL'), v: `${fmt(plan.ldmBilled, 1)} ${tr('MPL')}`, c: GREEN, icon: Receipt },
                ].map(({ k, v, c, icon: Icon }) => (
                  <div key={k} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="flex items-center gap-1.5 font-jetbrains text-[10px] uppercase text-slate-400"><Icon size={12} style={{ color: c }} />{k}</div>
                    <div className="font-bricolage font-bold text-lg md:text-xl text-white mt-1">{v}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {[
                  { id: 'groupage', l: `${tr('Groupage')} · ${fmt(plan.ldmBilled, 1)} ${tr('MPL')} × ${rate} €`, v: plan.groupage },
                  { id: 'ftl', l: `${tr('Camion complet')} · ${plan.trucks > 1 ? `${plan.trucks} × ` : ''}${tText(plan.veh.label)}`, v: plan.ftl },
                ].map((o) => (
                  <div key={o.id} className="rounded-xl p-4 transition-all" style={cheaper === o.id ? { background: 'rgba(16,185,129,0.15)', border: `1.5px solid ${GREEN}` } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300">{o.l}</span>
                      {cheaper === o.id && <span className="font-jetbrains text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: GREEN, color: '#fff' }}>{tr('MOINS CHER')}</span>}
                    </div>
                    <div className="font-bricolage font-bold text-2xl text-white mt-1">{fmt(o.v)} €</div>
                  </div>
                ))}
              </div>
              <p className="font-jetbrains text-[10px] text-slate-500 mt-3">{tr('Calcul simplifié (palettes identiques, rangées complètes). Tarifs d’exemple : dans votre espace, ce sont vos véhicules et les grilles de vos transporteurs qui s’appliquent.')}</p>
            </div>
          </Reveal>
        </div>
        <Reveal className="text-center mt-10">
          <Link to={LOAD_HREF()} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg font-jetbrains text-sm font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5" style={{ background: BLUE }}>
            {tr('CALCULER MON VRAI CHARGEMENT EN 3D')} <ArrowRight size={15} />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- 3. Simulateur palette
function PalletSimulator() {
  const [l, setL] = useState(40);
  const [w, setW] = useState(30);
  const [h, setH] = useState(25);
  const [maxH, setMaxH] = useState(180);
  const P = { l: 120, w: 80 };
  const calc = useMemo(() => {
    const a = Math.floor(P.l / l) * Math.floor(P.w / w);
    const b = Math.floor(P.l / w) * Math.floor(P.w / l);
    const rot = b > a;
    const nx = rot ? Math.floor(P.l / w) : Math.floor(P.l / l);
    const ny = rot ? Math.floor(P.w / l) : Math.floor(P.w / w);
    const perLayer = nx * ny;
    const layers = Math.max(0, Math.floor((maxH - 14.4) / h));
    const total = perLayer * layers;
    const fill = (total * l * w * h) / (P.l * P.w * Math.max(1, maxH - 14.4));
    return { perLayer, layers, total, fill, nx, ny, cl: rot ? w : l, cw: rot ? l : w };
  }, [l, w, h, maxH]);

  // Isométrie : x → droite-bas, y → gauche-bas, z → haut.
  const S = 2.1;
  const iso = (x, y, z) => [200 + (x - y) * S * 0.87, 260 + (x + y) * S * 0.5 - z * S];
  const box = (x, y, z, dx, dy, dz, color, key, delay) => {
    const p = (a, b, c) => iso(a, b, c).join(',');
    return (
      <g key={key} className="ll-pop" style={{ animationDelay: `${delay}ms` }}>
        <polygon points={`${p(x, y, z + dz)} ${p(x + dx, y, z + dz)} ${p(x + dx, y + dy, z + dz)} ${p(x, y + dy, z + dz)}`} fill={color} />
        <polygon points={`${p(x + dx, y, z)} ${p(x + dx, y + dy, z)} ${p(x + dx, y + dy, z + dz)} ${p(x + dx, y, z + dz)}`} fill={color} style={{ filter: 'brightness(.82)' }} />
        <polygon points={`${p(x, y + dy, z)} ${p(x + dx, y + dy, z)} ${p(x + dx, y + dy, z + dz)} ${p(x, y + dy, z + dz)}`} fill={color} style={{ filter: 'brightness(.68)' }} />
        <polygon points={`${p(x, y, z + dz)} ${p(x + dx, y, z + dz)} ${p(x + dx, y + dy, z + dz)} ${p(x, y + dy, z + dz)}`} fill="none" stroke="rgba(120,53,15,.45)" strokeWidth=".6" />
      </g>
    );
  };
  const shownLayers = Math.min(calc.layers, 8);
  const cartons = [];
  for (let z = 0; z < shownLayers; z += 1) {
    for (let j = 0; j < calc.ny; j += 1) for (let i = 0; i < calc.nx; i += 1) cartons.push({ i, j, z });
  }
  cartons.sort((a, b) => a.z - b.z || (a.i + a.j) - (b.i + b.j));
  const k = Math.min(1, 150 / Math.max(1, shownLayers * h));
  const colors = ['#D19A57', '#C08A4A', '#E0AE6E'];

  return (
    <section className="bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <Reveal className="lg:col-span-5">
          <div className="font-jetbrains text-xs tracking-wider mb-3" style={{ color: AMBER }}>{tr('02 / PALETTISATION')}</div>
          <h2 className="font-bricolage font-bold text-3xl md:text-5xl tracking-tight text-slate-900">{tr('Combien de cartons')} <span style={{ color: AMBER }}>{tr('par palette ?')}</span></h2>
          <p className="text-slate-600 mt-4">{tr('Réglez votre carton : la palette se monte sous vos yeux. L’outil complet gère les cartons mixtes, le poids, le gerbage et l’export du plan.')}</p>
          <div className="rounded-2xl border border-slate-200 p-6 mt-8 space-y-5 bg-white shadow-sm">
            <Slider label={tr('Longueur du carton')} value={l} min={15} max={80} onChange={setL} color={AMBER} unit=" cm" />
            <Slider label={tr('Largeur du carton')} value={w} min={15} max={80} onChange={setW} color={AMBER} unit=" cm" />
            <Slider label={tr('Hauteur du carton')} value={h} min={10} max={60} onChange={setH} color={AMBER} unit=" cm" />
            <Slider label={tr('Hauteur maximale de la palette')} value={maxH} min={80} max={220} step={5} onChange={setMaxH} color={BLUE} unit=" cm" />
          </div>
        </Reveal>
        <Reveal className="lg:col-span-7" delay={100}>
          <div className="rounded-2xl p-6" style={{ background: 'linear-gradient(160deg, #FFFBEB 0%, #FEF3C7 100%)', border: '1px solid #FDE68A' }}>
            <svg viewBox="0 0 400 330" className="w-full h-auto max-h-[380px]" role="img" aria-label={tr('Palette de {n} cartons', { n: calc.total })}>
              {/* palette bois */}
              {(() => { const p = (a, b, c) => iso(a, b, c).join(','); return (
                <g>
                  <polygon points={`${p(0, 0, 0)} ${p(P.l, 0, 0)} ${p(P.l, P.w, 0)} ${p(0, P.w, 0)}`} fill="#A16207" />
                  <polygon points={`${p(P.l, 0, -6)} ${p(P.l, P.w, -6)} ${p(P.l, P.w, 0)} ${p(P.l, 0, 0)}`} fill="#854D0E" />
                  <polygon points={`${p(0, P.w, -6)} ${p(P.l, P.w, -6)} ${p(P.l, P.w, 0)} ${p(0, P.w, 0)}`} fill="#713F12" />
                </g>
              ); })()}
              <g transform={`translate(0 ${(1 - k) * 60})`}>
                {cartons.map((c, idx) => box(c.i * calc.cl, c.j * calc.cw, c.z * h * k, calc.cl - 0.8, calc.cw - 0.8, h * k - 0.8, colors[(c.i + c.j + c.z) % 3], `${l}-${w}-${h}-${maxH}-${idx}`, Math.min(idx, 60) * 25))}
              </g>
            </svg>
            <div className="grid grid-cols-3 gap-3 mt-2">
              {[{ k: tr('Par couche'), v: calc.perLayer }, { k: tr('Couches'), v: calc.layers }, { k: tr('Cartons / palette'), v: calc.total, big: true }].map((x) => (
                <div key={x.k} className="rounded-xl bg-white/80 p-3 text-center">
                  <div className="font-jetbrains text-[10px] uppercase text-slate-500">{x.k}</div>
                  <div className={`font-bricolage font-bold ${x.big ? 'text-3xl' : 'text-2xl'}`} style={{ color: x.big ? '#B45309' : NAVY }}>{x.v}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-center font-jetbrains text-xs text-slate-600">{tr('Remplissage du volume :')} <b style={{ color: calc.fill > 0.85 ? '#047857' : '#B45309' }}>{Math.round(calc.fill * 100)} %</b></div>
          </div>
          <div className="text-center mt-6">
            <Link to={PALLET_HREF()} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg font-jetbrains text-sm font-semibold shadow-lg transition-all hover:-translate-y-0.5" style={{ background: AMBER, color: NAVY }}>
              {tr('OUVRIR LA PALETTISATION 3D')} <ArrowRight size={15} />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- 4. Facturation transport (démo animée)
const INVOICE = [
  { c: 'CH-0412', t: 'T01 · Lille', th: 612.7, f: 612.7 },
  { c: 'CH-0413', t: 'T02 · Lyon', th: 845.0, f: 921.3 },
  { c: 'CH-0415', t: 'T01 · Amiens', th: 438.9, f: 441.2 },
  { c: 'CH-0418', t: 'T03 · Nantes', th: 1210.0, f: 1310.0 },
  { c: 'CH-0421', t: 'T02 · Mâcon', th: 377.5, f: 377.5 },
];

function BillingShowcase() {
  const [step, setStep] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    let id;
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { id = setInterval(() => setStep((s) => (s >= INVOICE.length + 2 ? 0 : s + 1)), 900); io.disconnect(); }
    }, { threshold: 0.3 }) : null;
    if (io && ref.current) io.observe(ref.current); else setStep(INVOICE.length);
    return () => { clearInterval(id); io?.disconnect(); };
  }, []);
  const done = INVOICE.slice(0, Math.min(step, INVOICE.length));
  const gap = done.reduce((s, r) => s + Math.max(0, r.f - r.th), 0);

  const features = [
    { icon: Receipt, c: AMBER, t: tr('Vos transporteurs, vos grilles'), d: tr('Au mètre plancher, à la palette, aux 100 kg taxables ou au forfait par véhicule. Tarifs par agence, par tournée ou par zone, minimum de perception, frais d’arrêt.') },
    { icon: Sparkles, c: GREEN, t: tr('Le transporteur le moins cher'), d: tr('Sur chaque plan de chargement, toutes les grilles sont comparées : un clic pour choisir le moins cher.') },
    { icon: CalendarDays, c: VIOLET, t: tr('Surcharge gazole du mois'), d: tr('Le taux publié par chaque transporteur pour le mois de départ s’applique automatiquement.') },
    { icon: ShieldCheck, c: ROSE, t: tr('Contrôle des factures'), d: tr('Importez la facture (CSV ou Excel) : chaque ligne est rapprochée, les écarts au-delà de votre tolérance sont signalés.') },
  ];

  return (
    <section style={{ background: 'radial-gradient(120% 140% at 10% 0%, #312E81 0%, #0F172A 60%)' }}>
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <Reveal className="lg:col-span-5">
          <div className="font-jetbrains text-xs tracking-wider mb-3" style={{ color: '#A5B4FC' }}>{tr('03 / COÛTS TRANSPORT')}</div>
          <h2 className="font-bricolage font-bold text-3xl md:text-5xl tracking-tight text-white">{tr('Le camion est parti.')}<br /><span style={{ color: AMBER }}>{tr('La facture est vérifiée.')}</span></h2>
          <div className="space-y-4 mt-8">
            {features.map(({ icon: Icon, c, t, d }) => (
              <div key={t} className="flex gap-3">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${c}26`, color: c }}><Icon size={18} /></span>
                <div><div className="font-semibold text-white">{t}</div><div className="text-sm text-slate-400 leading-relaxed">{d}</div></div>
              </div>
            ))}
          </div>
          {!isEn() && (
            <Link to="/ressources/controle-factures-transport" className="inline-flex items-center gap-1.5 mt-7 text-sm font-semibold" style={{ color: '#A5B4FC' }}>
              La méthode de pré-facturation <ArrowRight size={14} />
            </Link>
          )}
        </Reveal>
        <Reveal className="lg:col-span-7" delay={100}>
          <div ref={ref} className="rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" /><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="ml-2 font-jetbrains text-[11px] text-slate-500">{tr('Contrôle transport · facture F-2026-118')}</span>
            </div>
            <div className="relative">
              <div className="ll-anim absolute left-0 right-0 h-10 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(37,99,235,0), rgba(37,99,235,.12), rgba(37,99,235,0))', animation: 'll-scan 2.4s ease-in-out infinite alternate' }} />
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] text-slate-500 font-jetbrains uppercase"><th className="px-4 py-2">{tr('Chargement')}</th><th className="px-2 py-2 hidden sm:table-cell">{tr('Tournée')}</th><th className="px-2 py-2 text-right">{tr('Théorique')}</th><th className="px-2 py-2 text-right">{tr('Facturé')}</th><th className="px-4 py-2">{tr('Contrôle')}</th></tr></thead>
                <tbody>
                  {INVOICE.map((r, i) => {
                    const seen = i < step;
                    const over = r.f - r.th > r.th * 0.03;
                    return (
                      <tr key={r.c} className="border-t border-slate-100 transition-colors duration-500" style={{ background: seen && over ? '#FFF1F2' : 'transparent' }}>
                        <td className="px-4 py-2.5 font-jetbrains text-xs text-blue-700">{r.c}</td>
                        <td className="px-2 py-2.5 text-slate-600 hidden sm:table-cell">{r.t}</td>
                        <td className="px-2 py-2.5 text-right font-jetbrains text-xs">{fmt(r.th, 2)} €</td>
                        <td className="px-2 py-2.5 text-right font-jetbrains text-xs font-semibold">{seen ? `${fmt(r.f, 2)} €` : '…'}</td>
                        <td className="px-4 py-2.5">
                          {seen ? (over
                            ? <span className="ll-pop inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold px-2 py-0.5"><AlertTriangle size={12} />+{fmt(((r.f - r.th) / r.th) * 100, 1)} %</span>
                            : <span className="ll-pop inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold px-2 py-0.5"><CheckCircle2 size={12} />{tr('Conforme')}</span>)
                            : <span className="text-xs text-slate-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100" style={{ background: gap > 0 ? '#FFF7ED' : '#F8FAFC' }}>
              <span className="text-sm text-slate-600">{tr('Écarts à réclamer')}</span>
              <span className="font-bricolage font-bold text-2xl" style={{ color: gap > 0 ? '#C2410C' : NAVY }}>{fmt(gap, 2)} €</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- 5. Fonctionnalités
const features = () => [
  { icon: Package, c: AMBER, t: tr('Palettisation 3D'), d: tr('Cartons identiques ou mixtes, poids et gerbage, plan par couche exportable.') },
  { icon: Truck, c: BLUE, t: tr('Plan de chargement 3D'), d: tr('Camion ou conteneur, multi-arrêts (dernier livré chargé en premier), charge par essieu.') },
  { icon: Layers, c: VIOLET, t: tr('Flotte automatique'), d: tr('Le bon mélange de véhicules quand un seul ne suffit pas, au coût le plus bas.') },
  { icon: Ruler, c: GREEN, t: tr('Mètres plancher & poids taxable'), d: tr('MPL réels, colis gerbés exclus, poids taxable au volume et au plancher.') },
  { icon: RouteIcon, c: CYAN, t: tr('Tournées & calendrier'), d: tr('Destinations par tournée, titre automatique, calendrier et regroupement des chargements.') },
  { icon: ScanLine, c: ROSE, t: tr('Quai & QR code cariste'), d: tr('Plan imprimé, guide pas à pas sur mobile, preuve de chargement en photo.') },
  { icon: Plug, c: '#64748B', t: tr('Import ERP / WMS & API'), d: tr('Collez un export Excel ou envoyez vos chargements par API : plan et coût calculés.') },
  { icon: Receipt, c: '#B45309', t: tr('Transporteurs & factures'), d: tr('Coût théorique, transporteur le moins cher, contrôle mensuel des écarts.') },
];

function Features() {
  return (
    <section className="bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-16 md:py-24">
        <Reveal className="text-center max-w-3xl mx-auto">
          <div className="font-jetbrains text-xs tracking-wider mb-3" style={{ color: BLUE }}>{tr('04 / TOUT CE QU’IL FAUT')}</div>
          <h2 className="font-bricolage font-bold text-3xl md:text-5xl tracking-tight text-slate-900">{tr('Du carton à la facture,')} <span style={{ color: BLUE }}>{tr('un seul outil.')}</span></h2>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
          {features().map(({ icon: Icon, c, t, d }, i) => (
            <Reveal key={t} delay={i * 60}>
              <div className="group h-full rounded-2xl border border-slate-200 p-5 bg-white transition-all hover:-translate-y-1 hover:shadow-xl" style={{ borderTop: `4px solid ${c}` }}>
                <span className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 group-hover:-rotate-6" style={{ background: `${c}1A`, color: c }}><Icon size={22} /></span>
                <div className="font-bricolage font-semibold text-lg text-slate-900">{t}</div>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- 6. Chiffres + parcours
function Journey() {
  const steps = [
    { n: '1', t: tr('Collez vos colis'), d: tr('Depuis Excel, votre ERP ou votre WMS.'), c: AMBER },
    { n: '2', t: tr('Palettes et plan 3D'), d: tr('Palettes optimisées, camion au bon gabarit.'), c: BLUE },
    { n: '3', t: tr('Quai guidé'), d: tr('Plan imprimé et QR code pour le cariste.'), c: GREEN },
    { n: '4', t: tr('Facture contrôlée'), d: tr('Coût théorique face au montant facturé.'), c: ROSE },
  ];
  return (
    <section className="bg-slate-50 border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-16 md:py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { v: 33, s: '', l: tr('palettes EUR dans une semi'), c: BLUE },
            { v: 2.4, s: ' m', l: tr('largeur de référence du MPL'), c: AMBER, d: 1 },
            { v: 20000, s: ' €', l: tr('par an : un semi au lieu d’un 19 t, 3 fois par semaine'), c: GREEN },
            { v: 0, s: ' €', l: tr('pour essayer, sans compte'), c: VIOLET },
          ].map((x) => (
            <Reveal key={x.l}>
              <div className="font-bricolage font-bold text-4xl md:text-5xl" style={{ color: x.c }}><CountUp to={x.v} suffix={x.s} decimals={x.d ?? 0} /></div>
              <div className="font-jetbrains text-[11px] text-slate-500 mt-2 max-w-[14rem] mx-auto">{x.l}</div>
            </Reveal>
          ))}
        </div>
        <div className="relative mt-16">
          <div className="hidden md:block absolute top-6 left-[12%] right-[12%] h-1 rounded-full" style={{ background: `linear-gradient(90deg, ${AMBER}, ${BLUE}, ${GREEN}, ${ROSE})` }} />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 120} className="text-center relative">
                <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center font-bricolage font-bold text-lg text-white shadow-lg ring-4 ring-slate-50" style={{ background: s.c }}>{s.n}</div>
                <div className="font-bricolage font-semibold text-lg text-slate-900 mt-4">{s.t}</div>
                <div className="text-sm text-slate-600 mt-1">{s.d}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- 7. FAQ + appel final
const faq = () => [
  [tr('Les outils sont-ils vraiment gratuits ?'), tr('Oui. La palettisation 3D et l’optimiseur de chargement s’utilisent gratuitement, sans compte. L’espace (chargements enregistrés, transporteurs, contrôle des factures) est gratuit pendant la phase pilote.')],
  [tr('Qu’est-ce qu’un mètre plancher ?'), tr('La surface au sol occupée divisée par 2,4 m, la largeur d’une remorque. Les colis gerbés ne comptent pas. C’est l’unité de facturation la plus courante en groupage.')],
  [tr('Puis-je utiliser mes propres véhicules et tarifs ?'), tr('Oui. Dans votre espace, vous paramétrez vos véhicules, palettes, agences, tournées et transporteurs (grilles par agence, tournée ou zone, surcharge gazole mensuelle).')],
  [tr('Comment importer mes données ?'), tr('Collez un export Excel de votre ERP ou WMS, ou envoyez vos chargements par l’API : le plan et le coût théorique sont calculés automatiquement.')],
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section className="bg-white">
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-16 md:py-20">
        <Reveal><h2 className="font-bricolage font-bold text-3xl md:text-4xl tracking-tight text-slate-900 text-center mb-8">{tr('Questions fréquentes')}</h2></Reveal>
        <div className="space-y-3">
          {faq().map(([q, a], i) => (
            <div key={q} className="rounded-xl border border-slate-200 overflow-hidden">
              <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left font-bricolage font-semibold text-slate-900 hover:bg-slate-50">
                {q}<ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${open === i ? 'rotate-180' : ''}`} />
              </button>
              <div className="grid transition-all duration-300" style={{ gridTemplateRows: open === i ? '1fr' : '0fr' }}>
                <div className="overflow-hidden"><p className="px-5 pb-4 text-sm text-slate-600 leading-relaxed">{a}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden" style={{ background: `linear-gradient(120deg, ${BLUE} 0%, #1E3A8A 55%, ${NAVY} 100%)` }}>
      <div className="ll-anim absolute -right-10 bottom-0 opacity-30 w-[520px] hidden md:block" style={{ animation: 'll-glow 4s ease-in-out infinite' }}>
        <svg viewBox="0 0 300 110"><TruckSvg color="#fff" cab="#93C5FD" cargo={[AMBER, AMBER, AMBER]} /></svg>
      </div>
      <div className="relative max-w-4xl mx-auto px-6 md:px-10 py-16 md:py-20 text-center">
        <h2 className="font-bricolage font-bold text-3xl md:text-5xl tracking-tight text-white">{tr('Prêt à remplir vos camions ?')}</h2>
        <p className="text-blue-100 mt-4 max-w-xl mx-auto">{tr('Essayez les outils tout de suite, ou créez votre espace pour enregistrer vos chargements, vos transporteurs et contrôler vos factures.')}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <Link to={isEn() ? '/connexion?mode=inscription&lang=en' : '/connexion'} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg font-jetbrains text-sm font-semibold shadow-xl transition-all hover:-translate-y-0.5" style={{ background: AMBER, color: NAVY }}>
            {tr('CRÉER MON ESPACE GRATUIT')} <ArrowRight size={15} />
          </Link>
          <Link to={LOAD_HREF()} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg font-jetbrains text-sm font-semibold text-white transition-all hover:bg-white/10" style={{ border: '1px solid rgba(255,255,255,0.5)' }}>
            {tr('ESSAYER SANS COMPTE')}
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function LoadLanding() {
  return (
    <>
      <style>{CSS}</style>
      <Hero />
      <TruckSimulator />
      <PalletSimulator />
      <BillingShowcase />
      <Features />
      <Journey />
      <Faq />
      <FinalCta />
    </>
  );
}
