// Bannière phare de l'accueil : palettisation 3D + chargement 3D.
// Message court pour un dirigeant (moins de camions, moins de casse, quai plus rapide) et
// animation qui montre le parcours en 5 secondes : cartons → palette → camion plein.
// Animation en CSS pur (aucune librairie), en boucle ; figée si l'utilisateur réduit les animations.

import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const AMBER = '#F59E0B';
const T = 10; // durée d'une boucle (s)

// Cartons de la palette (gauche) : 3 couches × 3, posés un à un.
const CARTONS = Array.from({ length: 9 }, (_, i) => ({ col: i % 3, row: Math.floor(i / 3), d: 0.25 + i * 0.22 }));
// Palettes dans la semi-remorque (vue de côté) : 11 rangées, de la cabine vers les portes.
const PALLETS = Array.from({ length: 11 }, (_, i) => ({ i, d: 2.6 + i * 0.42 }));
const COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444', '#06B6D4'];

const pct = (s) => `${((s / T) * 100).toFixed(2)}%`;
// Chaque élément apparaît à son tour, reste jusqu'à 90 % de la boucle, puis tout s'efface ensemble.
function keyframes(name, delay, from) {
  return `@keyframes ${name}{0%,${pct(delay)}{opacity:0;transform:${from}}${pct(delay + 0.5)},90%{opacity:1;transform:none}97%,100%{opacity:0;transform:none}}`;
}

function Scene() {
  const css = [
    ...CARTONS.map((c, i) => keyframes(`alc${i}`, c.d, 'translateY(-60px)')),
    ...PALLETS.map((p) => keyframes(`alp${p.i}`, p.d, `translateX(${(10 - p.i) * 24 + 70}px)`)),
    `@keyframes algauge{0%,${pct(2.6)}{transform:scaleX(0)}${pct(2.6 + 11 * 0.42 + 0.3)},90%{transform:scaleX(1)}97%,100%{transform:scaleX(0)}}`,
    keyframes('aldone', 2.6 + 11 * 0.42 + 0.4, 'translateY(6px)'),
    '.al-anim{transform-box:fill-box;transform-origin:left center}',
    '@media (prefers-reduced-motion: reduce){.al-anim{animation:none!important;opacity:1!important;transform:none!important}}',
  ].join('');
  const anim = (name) => ({ animation: `${name} ${T}s ease-out infinite` });

  return (
    <svg viewBox="0 0 540 290" className="w-full h-auto" role="img" aria-label="Des cartons forment une palette, puis les palettes remplissent une semi-remorque">
      <style>{css}</style>
      {/* sol */}
      <line x1="10" y1="236" x2="530" y2="236" stroke="rgba(148,163,184,0.35)" strokeWidth="1.5" />

      {/* 1 · Palette en construction */}
      <text x="18" y="40" fill="#94A3B8" fontSize="11" fontFamily="JetBrains Mono, monospace">① CARTONS → PALETTE</text>
      <g>
        <rect x="22" y="222" width="108" height="8" rx="1" fill="#A16207" />
        <rect x="26" y="230" width="12" height="6" fill="#854D0E" /><rect x="70" y="230" width="12" height="6" fill="#854D0E" /><rect x="114" y="230" width="12" height="6" fill="#854D0E" />
        {CARTONS.map((c, i) => (
          <rect key={i} className="al-anim" style={anim(`alc${i}`)}
            x={24 + c.col * 35} y={190 - c.row * 33} width="33" height="31" rx="2"
            fill={['#C08A4A', '#D19A57', '#B97E3E'][(c.col + c.row) % 3]} stroke="#7C4A1E" strokeWidth="0.8" />
        ))}
      </g>

      {/* flèche */}
      <path d="M148 170 h28 m-8 -7 l8 7 l-8 7" stroke={AMBER} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* 2 · Semi-remorque, vue de côté (cabine à gauche, portes à droite) */}
      <text x="196" y="40" fill="#94A3B8" fontSize="11" fontFamily="JetBrains Mono, monospace">② PLAN 3D → CAMION PLEIN</text>
      <g>
        {/* cabine */}
        <path d="M188 236 V172 q0 -8 8 -8 h22 l10 22 v50 z" fill="#1E3A8A" stroke="#3B82F6" strokeWidth="1.2" />
        <path d="M200 172 h16 l7 15 h-23 z" fill="#93C5FD" opacity="0.7" />
        {/* caisse */}
        <rect x="232" y="118" width="290" height="110" rx="3" fill="rgba(15,23,42,0.6)" stroke="#60A5FA" strokeWidth="1.5" />
        <line x1="521" y1="120" x2="521" y2="226" stroke="#60A5FA" strokeWidth="3" strokeDasharray="4 3" />
        {PALLETS.map((p) => (
          <g key={p.i} className="al-anim" style={anim(`alp${p.i}`)}>
            <rect x={236 + p.i * 25.6} y="214" width="24" height="5" fill="#A16207" />
            <rect x={236 + p.i * 25.6} y={150 + (p.i % 3) * 6} width="24" height={64 - (p.i % 3) * 6} rx="1.5"
              fill={COLORS[p.i % COLORS.length]} opacity="0.9" />
            <line x1={236 + p.i * 25.6} x2={260 + p.i * 25.6} y1={182 + (p.i % 3) * 3} y2={182 + (p.i % 3) * 3} stroke="rgba(15,23,42,0.35)" />
          </g>
        ))}
        {/* roues */}
        {[214, 420, 450, 480].map((x) => <circle key={x} cx={x} cy="238" r="11" fill="#0F172A" stroke="#64748B" strokeWidth="3" />)}
      </g>

      {/* jauge de remplissage */}
      <text x="232" y="268" fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono, monospace">REMPLISSAGE</text>
      <rect x="310" y="260" width="212" height="8" rx="4" fill="rgba(148,163,184,0.25)" />
      <rect className="al-anim" style={anim('algauge')} x="310" y="260" width="212" height="8" rx="4" fill={AMBER} />
      <g className="al-anim" style={anim('aldone')}>
        <rect x="356" y="78" width="166" height="28" rx="14" fill="#10B981" />
        <text x="439" y="96" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700" fontFamily="DM Sans, sans-serif">✓ 33 palettes EUR chargées</text>
      </g>
    </svg>
  );
}

const BENEFITS = [
  { v: 'Moins de camions', l: 'chaque m³ utilisé, palette et camion' },
  { v: 'Moins de casse', l: 'gerbage, essieux et sangles contrôlés' },
  { v: 'Quai plus rapide', l: 'plan imprimé + QR code cariste' },
  { v: '0 € · sans compte', l: 'vos données restent chez vous' },
];

export default function LoadHeroBanner({ onLaunch }) {
  return (
    <section className="border-t border-slate-200 overflow-hidden" style={{ background: 'radial-gradient(120% 140% at 85% 20%, #1D4ED8 0%, #0F172A 55%, #020617 100%)' }}>
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-14 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-jetbrains tracking-widest mb-5"
              style={{ background: 'rgba(245,158,11,0.15)', color: AMBER, border: '1px solid rgba(245,158,11,0.35)' }}>
              ★ PALETTISATION + CHARGEMENT 3D · GRATUIT
            </div>
            <h2 className="font-bricolage font-bold text-4xl md:text-5xl lg:text-6xl text-white leading-[1.02] tracking-tight mb-5">
              Vos camions partent<br />à moitié vides&nbsp;?
              <span className="block mt-2" style={{ color: AMBER }}>Remplissez-les en 2&nbsp;clics.</span>
            </h2>
            <p className="text-slate-300 text-base md:text-lg leading-relaxed mb-7 max-w-xl">
              Vos cartons deviennent des palettes optimisées, puis un plan de chargement 3D du camion ou du conteneur.
              Ce que votre ERP et votre WMS ne savent pas faire, en quelques secondes.
            </p>

            <ol className="flex flex-wrap items-center gap-2 mb-8 font-jetbrains text-[11px]">
              {['Vos cartons', 'Palettes optimisées', 'Camion chargé'].map((s, i) => (
                <li key={s} className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-full text-white" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                    <b style={{ color: AMBER }}>{i + 1}</b>&nbsp; {s}
                  </span>
                  {i < 2 && <ArrowRight size={13} className="text-slate-500" />}
                </li>
              ))}
            </ol>

            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => onLaunch('pallet')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg font-jetbrains text-sm font-semibold shadow-xl transition-all hover:-translate-y-0.5"
                style={{ background: AMBER, color: '#0F172A' }}>
                PALETTISER MES CARTONS <ArrowRight size={15} />
              </button>
              <button onClick={() => onLaunch('optimiseur-chargement')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg font-jetbrains text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-white/10"
                style={{ border: '1px solid rgba(255,255,255,0.4)' }}>
                CHARGER MON CAMION <ArrowRight size={15} />
              </button>
            </div>
            <Link to="/chargement-palettisation" className="inline-flex items-center gap-1.5 mt-5 font-jetbrains text-xs font-semibold hover:underline" style={{ color: AMBER }}>
              DÉCOUVRIR TOUT LE MODULE : SIMULATEUR, MÈTRES PLANCHER, FACTURES <ArrowRight size={13} />
            </Link>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-2xl p-4 md:p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(96,165,250,0.25)', boxShadow: '0 30px 80px -30px rgba(37,99,235,0.6)' }}>
              <Scene />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-12 pt-8 border-t border-white/10">
          {BENEFITS.map((b) => (
            <div key={b.v}>
              <div className="font-bricolage font-bold text-lg md:text-xl text-white">{b.v}</div>
              <div className="font-jetbrains text-[11px] text-slate-400 mt-1">{b.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
