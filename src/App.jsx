import { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Package, FileCode2, Download, Upload, ArrowLeft,
  Loader2, Box, Barcode, Calculator, TrendingUp,
  FileText, Truck, Shuffle, AlertCircle, Image as ImageIcon,
  Copy, Check, RotateCw, FileDown, ArrowRight, Zap,
  Tag, Map, Wrench, AlertTriangle,
  ChevronLeft, ChevronRight, Files,
  FileArchive, ChevronDown,
  Factory, Warehouse, Ship, Plane, Anchor, Info,
  Shield, ShieldCheck, X
} from 'lucide-react';

const BLUE = '#2563EB';
const BLUE_DARK = '#1D4ED8';
const BLUE_LIGHT = '#EFF6FF';

const EXAMPLE_ZPL = `^XA
^CF0,55
^FO40,40^FDATELIER^FS
^CF0,28
^FO40,125^FDColis n AT-2023-0001^FS
^FO40,170^FDExpediteur : WALYCONSEIL^FS
^FO40,215^FDDestinataire : Client SAS^FS
^FO40,270^GB720,2,2^FS
^BY3,2,100
^FO40,300^BCN,100,Y,N,N
^FD1234567890128^FS
^FO40,460^FDPoids : 12.5 kg^FS
^FO40,505^FDDim : 40 x 30 x 20 cm^FS
^XZ`;

const EXAMPLE_ZPL_MULTI = `^XA
^CF0,55
^FO40,40^FDATELIER^FS
^CF0,28
^FO40,125^FDColis 1/3 - AT-2023-001^FS
^FO40,170^FDDestinataire : Client A^FS
^FO40,215^FDAdresse : Casablanca^FS
^FO40,270^GB720,2,2^FS
^BY3,2,100
^FO40,300^BCN,100,Y,N,N
^FD1234567890001^FS
^FO40,460^FDPoids : 5.0 kg^FS
^XZ
^XA
^CF0,55
^FO40,40^FDATELIER^FS
^CF0,28
^FO40,125^FDColis 2/3 - AT-2023-002^FS
^FO40,170^FDDestinataire : Client B^FS
^FO40,215^FDAdresse : Rabat^FS
^FO40,270^GB720,2,2^FS
^BY3,2,100
^FO40,300^BCN,100,Y,N,N
^FD1234567890002^FS
^FO40,460^FDPoids : 12.0 kg^FS
^XZ
^XA
^CF0,55
^FO40,40^FDATELIER^FS
^CF0,28
^FO40,125^FDColis 3/3 - AT-2023-003^FS
^FO40,170^FDDestinataire : Client C^FS
^FO40,215^FDAdresse : Tanger^FS
^FO40,270^GB720,2,2^FS
^BY3,2,100
^FO40,300^BCN,100,Y,N,N
^FD1234567890003^FS
^FO40,460^FDPoids : 8.5 kg^FS
^XZ`;

const TOOLS = [
  { id: 'zpl', cat: 'etiquettes', name: 'ZPL Viewer', icon: FileCode2, desc: 'Visualisez et exportez vos étiquettes ZPL en PNG ou PDF.', status: 'live' },
  { id: 'barcode', cat: 'etiquettes', name: 'Codes-barres', icon: Barcode, desc: '10 symbologies : EAN, UPC, Code 128, GTIN-14, QR, Data Matrix, PDF417.', status: 'live' },
  { id: 'pallet', cat: 'planification', name: 'Palettisation', icon: Package, desc: 'Calcul du plan optimal · EUR, US, ISO, custom · vue 3D isométrique.', status: 'live' },
  { id: 'safety', cat: 'planification', name: 'Stock de sécurité', icon: TrendingUp, desc: 'Calcul σL, taux de service, ROP · courbe de distribution.', status: 'live' },
  { id: 'ddmrp', cat: 'planification', name: 'Buffers DDMRP', icon: Box, desc: 'Dimensionnement des buffers stratégiques (zones rouge/jaune/vert) à partir de l\'ADU, du délai et de la variabilité.', status: 'live' },
  { id: 'incoterms', cat: 'transport', name: 'Incoterms 2020', icon: Map, desc: 'Comparateur visuel des 11 incoterms, transferts coûts/risques sur la chaîne logistique.', status: 'live' },
  { id: 'cmr', cat: 'transport', name: 'CMR / eCMR', icon: FileText, desc: 'Lettre de voiture internationale aux normes européennes, mode papier ou électronique.', status: 'live' },
  { id: 'sla', cat: 'transport', name: 'OTIF / SLA', icon: Calculator, desc: 'Taux On-Time In-Full, analyse des écarts au SLA, décomposition par client et article.', status: 'live' },
  { id: 'units', cat: 'utilitaires', name: 'Convertisseur logistique', icon: Shuffle, desc: 'Cascade carton → palette → conteneur → camion. Combien d\'unités tiennent dans chaque contenant.', status: 'live' },
];

const CATEGORIES = [
  { id: 'etiquettes', label: 'Étiquetage & marquage', icon: Tag, num: '01' },
  { id: 'planification', label: 'Planification & stocks', icon: TrendingUp, num: '02' },
  { id: 'transport', label: 'Transport & documents', icon: Truck, num: '03' },
  { id: 'utilitaires', label: 'Utilitaires', icon: Wrench, num: '04' },
];

export default function App() {
  const [active, setActive] = useState(null);
  if (active === 'zpl') return <ZplViewer onBack={() => setActive(null)} />;
  if (active === 'barcode') return <BarcodeGenerator onBack={() => setActive(null)} />;
  if (active === 'pallet') return <PalletCalculator onBack={() => setActive(null)} />;
  if (active === 'safety') return <SafetyStockCalculator onBack={() => setActive(null)} />;
  if (active === 'incoterms') return <IncotermsComparator onBack={() => setActive(null)} />;
  if (active === 'cmr') return <CmrGenerator onBack={() => setActive(null)} />;
  if (active === 'units') return <LogisticsConverter onBack={() => setActive(null)} />;
  if (active === 'sla') return <OtifAnalyzer onBack={() => setActive(null)} />;
  if (active === 'audit') return <AuditFlash onBack={() => setActive(null)} />;
  if (active === 'ddmrp') return <DdmrpBuffers onBack={() => setActive(null)} />;
  return <Landing onLaunch={setActive} />;
}

// ============================================================
// LANDING (inchangé)
// ============================================================
function Landing({ onLaunch }) {
  return (
    <div className="min-h-screen text-slate-900" style={{ background: '#FFFFFF', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <FontsAndStyles />

      <nav className="border-b border-slate-200 sticky top-0 z-20 bg-white/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <div className="font-bricolage font-bold text-lg tracking-tight">ATELIER LOGISTIQUE</div>
              <div className="font-jetbrains text-[10px] text-slate-500 -mt-1 tracking-wider">SUITE D'OUTILS · v0.2 · WALYCONSEIL</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-5 font-jetbrains text-xs text-slate-500">
            <a href="#tools" className="hover:text-slate-900 transition-colors">L'établi</a>
            <a href="#how" className="hover:text-slate-900 transition-colors">Comment ça marche</a>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-2" style={{ color: BLUE }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: BLUE }} />
              EN LIGNE
            </span>
          </div>
        </div>
      </nav>

      <section className="relative max-w-7xl mx-auto px-6 md:px-10 pt-20 md:pt-28 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-8">
            <div className="font-jetbrains text-xs mb-6 flex items-center gap-2 tracking-wider" style={{ color: BLUE }}>
              <span>●</span>
              <span>L'OUTILLAGE LOGISTIQUE — ÉDITION 2023</span>
            </div>
            <h1 className="font-bricolage font-bold text-5xl md:text-7xl lg:text-[5.5rem] leading-[0.95] mb-8 tracking-tight">
              Des outils <em className="italic font-normal text-slate-400">précis</em>
              <br />pour la supply <span style={{ color: BLUE }}>chain.</span>
            </h1>
            <p className="text-slate-600 text-lg md:text-xl max-w-2xl leading-relaxed">
              Une boîte à outils web pour les professionnels de la logistique. Étiquettes ZPL, codes-barres, palettisation, stock de sécurité, Incoterms — tout dans votre navigateur, sans installation, sans compte.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-10 font-jetbrains text-xs">
              <a
                href="#tools"
                className="px-5 py-3 rounded-md font-medium transition-all hover:translate-y-[-1px] flex items-center gap-2 text-white"
                style={{ background: BLUE }}
              >
                VOIR L'ÉTABLI
                <ArrowRight size={13} />
              </a>
              <a href="#how" className="px-5 py-3 rounded-md font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all">
                COMMENT ÇA MARCHE
              </a>
            </div>
          </div>

          <div className="lg:col-span-4 hidden lg:block">
            <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm">
              <div className="font-jetbrains text-[10px] text-slate-400 tracking-wider mb-4">ÉTAT DE L'ATELIER</div>
              <div className="space-y-3">
                {[
                  { l: 'Outils actifs', v: '9 / 9' },
                  { l: 'Mode', v: 'navigateur' },
                  { l: 'Confidentialité', v: '100% local' },
                  { l: 'Version', v: '0.2' },
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between font-jetbrains text-xs">
                    <span className="text-slate-500">{r.l}</span>
                    <span className="flex items-center gap-2 text-slate-800">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: BLUE }} />
                      {r.v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 border-y border-slate-200">
          {[
            { k: '09', v: 'outils opérationnels', d: 'toute la chaîne logistique' },
            { k: '04', v: 'familles métiers', d: 'marquage, stocks, transport...' },
            { k: '100%', v: 'navigateur', d: 'aucune installation requise' },
            { k: '∞', v: 'usages', d: 'sans compte, sans envoi cloud' },
          ].map((s, i) => (
            <div key={i} className={`p-6 ${i > 0 ? 'md:border-l border-slate-200' : ''} ${i === 2 || i === 3 ? 'border-t md:border-t-0 border-slate-200' : ''} ${i === 1 ? 'border-l border-slate-200' : ''}`}>
              <div className="font-bricolage text-3xl md:text-4xl font-bold mb-1" style={{ color: BLUE }}>{s.k}</div>
              <div className="font-bricolage text-base text-slate-800">{s.v}</div>
              <div className="font-jetbrains text-[10px] text-slate-500 mt-1">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* BANNIÈRE LEAD MAGNET — Audit Flash */}
      <section className="border-t border-slate-200" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #78350F 100%)' }}>
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
            <div className="lg:col-span-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-jetbrains tracking-widest mb-5" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                ★ NOUVEAU · LEAD MAGNET WALYCONSEIL
              </div>
              <h2 className="font-bricolage font-bold text-3xl md:text-4xl lg:text-5xl text-white leading-tight mb-4">
                Auditez votre supply chain<br />
                <span style={{ color: '#F59E0B' }}>en 30 secondes.</span>
              </h2>
              <p className="text-slate-300 text-base md:text-lg leading-relaxed mb-6 max-w-2xl">
                Importez votre historique de ventes 12 mois et votre stock actuel.
                L'outil sort automatiquement votre classification ABC × XYZ, votre stock dormant chiffré en valeur,
                vos couvertures critiques, et les chantiers prioritaires à traiter par votre approvisionneur.
              </p>
              <div className="flex flex-wrap items-center gap-3 mb-7">
                <button
                  onClick={() => onLaunch('audit')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-jetbrains text-sm font-semibold shadow-xl transition-all hover:translate-y-[-2px] hover:shadow-2xl"
                  style={{ background: '#F59E0B', color: '#0F172A' }}
                >
                  DÉMARRER MON AUDIT GRATUIT
                  <ArrowRight size={15} />
                </button>
                <div className="text-xs text-slate-400 font-jetbrains">Aucun compte requis · données traitées en local</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-slate-700">
                {[
                  { v: 'ABC × XYZ', l: 'classification automatique' },
                  { v: 'Multi-magasin', l: 'détection déséquilibres' },
                  { v: 'Dormants €', l: 'chiffré en valeur' },
                  { v: '8 KPIs', l: 'analysés en 30 sec' },
                ].map((s, i) => (
                  <div key={i}>
                    <div className="font-bricolage font-bold text-base" style={{ color: '#F59E0B' }}>{s.v}</div>
                    <div className="font-jetbrains text-[10px] text-slate-400 mt-0.5">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-2xl p-6 backdrop-blur" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <div className="font-jetbrains text-[10px] tracking-widest mb-4" style={{ color: '#F59E0B' }}>EXEMPLE DE DIAGNOSTIC</div>
                <div className="space-y-3">
                  {[
                    { icon: '◉', text: '47 % du stock dormant (1.2 M MAD immobilisés)', color: '#DC2626' },
                    { icon: '◉', text: '12 articles en risque de rupture sous 14 jours', color: '#D97706' },
                    { icon: '◉', text: '23 articles déséquilibrés inter-magasins', color: '#D97706' },
                    { icon: '◉', text: '8 articles "AZ" — stratégie stock à revoir', color: '#2563EB' },
                    { icon: '✓', text: 'Top 5 chantiers chiffrés prioritaires', color: '#10B981' },
                  ].map((line, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span style={{ color: line.color }} className="text-base leading-none mt-0.5">{line.icon}</span>
                      <span className="text-sm text-slate-200 leading-relaxed">{line.text}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-slate-700 text-[10px] text-slate-400 font-jetbrains leading-relaxed">
                  Le diagnostic se base sur 2 fichiers Excel (ventes 12 mois + stock actuel). Templates fournis pour démarrer.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-20">
          <div className="text-center md:text-left max-w-3xl mx-auto md:mx-0 mb-12">
            <div className="font-jetbrains text-xs text-slate-500 mb-3 tracking-wider">02 / PARCOURS LOGISTIQUE</div>
            <h2 className="font-bricolage font-semibold text-3xl md:text-4xl tracking-tight mb-4">
              Toute la chaîne logistique,<br /><span style={{ color: BLUE }}>dans votre navigateur.</span>
            </h2>
            <p className="text-slate-600 leading-relaxed">
              De la conception du conditionnement jusqu'à la mesure de la performance livraison, chaque maillon de votre supply chain dispose de son outil dédié. Sans installation, sans création de compte, sans envoi de données vers un cloud tiers — vos paramètres restent dans votre navigateur.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
            {[
              {
                num: '01', icon: Box,
                title: 'Conditionner',
                description: 'Dimensionnez le packaging et l\'optimisation du chargement, du carton au camion.',
                color: '#F59E0B', colorLight: '#FEF3C7', colorBorder: '#FDE68A',
                tools: [
                  { name: 'Palettisation 3D', id: 'pallet' },
                  { name: 'Convertisseur cascade', id: 'units' },
                ],
              },
              {
                num: '02', icon: Tag,
                title: 'Marquer',
                description: 'Générez étiquettes Zebra, codes-barres et QR codes aux normes industrielles.',
                color: BLUE, colorLight: BLUE_LIGHT, colorBorder: '#BFDBFE',
                tools: [
                  { name: 'ZPL Viewer', id: 'zpl' },
                  { name: 'Codes-barres GS1', id: 'barcode' },
                ],
              },
              {
                num: '03', icon: Warehouse,
                title: 'Planifier',
                description: 'Dimensionnez vos buffers à partir de vos historiques de ventes ERP.',
                color: '#0D9488', colorLight: '#CCFBF1', colorBorder: '#99F6E4',
                tools: [
                  { name: 'Stock de sécurité', id: 'safety' },
                  { name: 'Buffers DDMRP', id: 'ddmrp' },
                ],
              },
              {
                num: '04', icon: Truck,
                title: 'Expédier',
                description: 'Préparez vos documents de transport routier international.',
                color: '#7C3AED', colorLight: '#EDE9FE', colorBorder: '#DDD6FE',
                tools: [
                  { name: 'Incoterms 2020', id: 'incoterms' },
                  { name: 'CMR / eCMR', id: 'cmr' },
                ],
              },
              {
                num: '05', icon: Calculator,
                title: 'Mesurer',
                description: 'Analysez vos performances de livraison avec les KPIs de référence.',
                color: '#E11D48', colorLight: '#FFE4E6', colorBorder: '#FECDD3',
                tools: [
                  { name: 'OTIF / SLA', id: 'sla' },
                ],
              },
            ].map((step, idx, arr) => {
              const Icon = step.icon;
              return (
                <div key={step.num} className="relative">
                  <article
                    className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-lg transition-all group h-full flex flex-col"
                    style={{ transition: 'border-color 0.2s, box-shadow 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = step.colorBorder; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; }}
                  >
                    <div className="w-10 h-10 rounded-lg mb-4 flex items-center justify-center" style={{ background: step.colorLight, transition: 'transform 0.2s' }}>
                      <Icon size={18} style={{ color: step.color }} strokeWidth={2} />
                    </div>
                    <div className="font-jetbrains text-[10px] mb-2 tracking-wider" style={{ color: step.color, opacity: 0.7 }}>{step.num}</div>
                    <h3 className="font-bricolage font-semibold text-base mb-2 text-slate-900">{step.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed mb-3 flex-1">{step.description}</p>
                    <ul className="space-y-1 pt-3 border-t border-slate-100">
                      {step.tools.map(t => (
                        <li key={t.id}>
                          <button
                            onClick={() => onLaunch(t.id)}
                            className="w-full text-left text-[11px] text-slate-700 flex items-center gap-1.5 py-0.5 group/tool transition-colors"
                            onMouseEnter={e => { e.currentTarget.style.color = step.color; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#334155'; }}
                          >
                            <span className="font-jetbrains text-[10px]" style={{ color: step.color }}>›</span>
                            <span className="group-hover/tool:underline underline-offset-2">{t.name}</span>
                            <ArrowRight size={10} className="text-slate-300 group-hover/tool:translate-x-0.5 transition-all ml-auto" style={{ color: step.color, opacity: 0.4 }} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </article>
                  {idx < arr.length - 1 && (
                    <div className="hidden md:flex absolute top-9 -right-2.5 z-10 w-5 h-5 items-center justify-center bg-slate-50 rounded-full pointer-events-none">
                      <ArrowRight size={12} className="text-slate-300" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-14 pt-8 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-2.5">CONÇU POUR</div>
              <h4 className="font-bricolage font-semibold text-base mb-2 text-slate-900">Les professionnels de la supply chain</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Responsables logistique, planificateurs, consultants ERP, opérationnels d'entrepôt et chargés d'expédition. Pensé pour le travail terrain : ouvert en un clic, résultat en quelques secondes, exportable vers Excel ou PDF.
              </p>
            </div>
            <div>
              <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-2.5">CONFORME AUX STANDARDS</div>
              <h4 className="font-bricolage font-semibold text-base mb-2 text-slate-900">Normes internationales respectées</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Codes-barres <strong>GS1</strong> (Code 128, GS1-128, ITF-14, GTIN, QR, DataMatrix), méthodologie <strong>DDMRP</strong> Demand Driven Institute, <strong>Incoterms 2020</strong> ICC, lettre de voiture <strong>CMR Genève 1956</strong> et eCMR (règlement européen <strong>eFTI 2026</strong>), palettes <strong>EUR / GMA / ISO</strong>, conteneurs maritimes 20'/40'/HC.
              </p>
            </div>
            <div>
              <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-2.5">CONFIDENTIALITÉ</div>
              <h4 className="font-bricolage font-semibold text-base mb-2 text-slate-900">Données 100 % en local</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Tous les traitements s'exécutent dans votre navigateur : aucun fichier n'est envoyé sur un serveur, aucune donnée client ne transite via une API tierce. Idéal pour les missions de conseil chez des donneurs d'ordre exigeants en matière de confidentialité.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="tools" className="border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-20">
          <div className="flex items-baseline justify-between mb-12">
            <div>
              <div className="font-jetbrains text-xs text-slate-500 mb-3 tracking-wider">03 / L'ÉTABLI</div>
              <h2 className="font-bricolage font-semibold text-3xl md:text-4xl tracking-tight">
                {TOOLS.length} outils, <span style={{ color: BLUE }}>4 familles</span>
              </h2>
            </div>
            <div className="hidden md:block font-jetbrains text-xs text-slate-500 text-right">
              <span style={{ color: BLUE }} className="font-medium">{TOOLS.filter(t => t.status === 'live').length}</span> disponible<br />
              {TOOLS.filter(t => t.status === 'soon').length} en préparation
            </div>
          </div>

          <div className="space-y-12">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const tools = TOOLS.filter(t => t.cat === cat.id);
              return (
                <div key={cat.id}>
                  <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-200">
                    <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: BLUE_LIGHT }}>
                      <Icon size={15} style={{ color: BLUE }} strokeWidth={2} />
                    </div>
                    <span className="font-jetbrains text-xs text-slate-400">{cat.num}</span>
                    <h3 className="font-bricolage font-semibold text-lg text-slate-900">{cat.label}</h3>
                    <span className="font-jetbrains text-[10px] text-slate-400 ml-auto">{tools.length} outil{tools.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tools.map((tool) => (
                      <ToolCard key={tool.id} tool={tool} onLaunch={() => tool.status === 'live' && onLaunch(tool.id)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-jetbrains text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <Logo small />
            <span>ATELIER LOGISTIQUE © 2023 — Outillage par WALYCONSEIL</span>
          </div>
          <span>Contactez-nous sur <a href="mailto:contact@walyconseil.com" className="hover:text-slate-800 transition-colors underline-offset-2 hover:underline">contact@walyconseil.com</a></span>
        </div>
      </footer>
    </div>
  );
}

function ToolCard({ tool, onLaunch }) {
  const isLive = tool.status === 'live';
  const Icon = tool.icon;
  const catColors = {
    etiquettes:    { color: BLUE,      light: BLUE_LIGHT, border: '#BFDBFE' },
    planification: { color: '#0D9488', light: '#CCFBF1',  border: '#99F6E4' },
    transport:     { color: '#7C3AED', light: '#EDE9FE',  border: '#DDD6FE' },
    utilitaires:   { color: '#F59E0B', light: '#FEF3C7',  border: '#FDE68A' },
  };
  const c = catColors[tool.cat] || catColors.etiquettes;
  return (
    <button
      onClick={onLaunch}
      disabled={!isLive}
      className={`group relative p-6 text-left transition-all rounded-xl border ${
        isLive
          ? 'cursor-pointer bg-white border-slate-200 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5'
          : 'cursor-not-allowed bg-slate-50 border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between mb-6">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center transition-all"
          style={{
            background: isLive ? c.light : '#F1F5F9',
            border: `1px solid ${isLive ? c.border : '#E2E8F0'}`,
          }}
        >
          <Icon size={17} style={{ color: isLive ? c.color : '#94A3B8' }} strokeWidth={1.75} />
        </div>
        {isLive ? (
          <span className="font-jetbrains text-[10px] tracking-widest px-2 py-1 rounded-md" style={{ background: c.light, color: c.color }}>
            ● LIVE
          </span>
        ) : (
          <span className="font-jetbrains text-[10px] tracking-widest px-2 py-1 rounded-md bg-slate-100 text-slate-400">
            BIENTÔT
          </span>
        )}
      </div>
      <div className="font-bricolage font-semibold text-lg mb-1.5" style={{ color: isLive ? '#0F172A' : '#94A3B8' }}>
        {tool.name}
      </div>
      <div className="text-sm text-slate-500 leading-relaxed mb-5 min-h-[2.5rem]">
        {tool.desc}
      </div>
      {isLive && (
        <div className="font-jetbrains text-xs flex items-center gap-1.5 transition-transform group-hover:translate-x-1" style={{ color: c.color }}>
          OUVRIR L'OUTIL
          <ArrowRight size={12} />
        </div>
      )}
    </button>
  );
}

function Logo({ small }) {
  const size = small ? 'w-6 h-6' : 'w-9 h-9';
  return (
    <div className={`${size} rounded-md flex items-center justify-center relative overflow-hidden`} style={{ background: BLUE }}>
      <svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" className="w-[78%] h-[78%]">
        {/* plateau haut (2 planches) */}
        <rect x="5" y="11" width="26" height="2.5" rx="0.5" fill="white" />
        <rect x="5" y="14.5" width="26" height="2.5" rx="0.5" fill="white" />
        {/* 3 pieds (blocs) */}
        <rect x="6" y="17.5" width="4.5" height="5" rx="0.3" fill="white" opacity="0.82" />
        <rect x="15.75" y="17.5" width="4.5" height="5" rx="0.3" fill="white" opacity="0.82" />
        <rect x="25.5" y="17.5" width="4.5" height="5" rx="0.3" fill="white" opacity="0.82" />
        {/* plateau bas */}
        <rect x="5" y="23" width="26" height="2.5" rx="0.5" fill="white" />
      </svg>
    </div>
  );
}

function FontsAndStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
      .font-bricolage { font-family: 'Bricolage Grotesque', sans-serif; letter-spacing: -0.02em; }
      .font-jetbrains { font-family: 'JetBrains Mono', monospace; }
      input, textarea, select, button { font-family: inherit; }
      textarea::-webkit-scrollbar { width: 8px; }
      textarea::-webkit-scrollbar-track { background: transparent; }
      textarea::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
      textarea::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
    `}</style>
  );
}

// ============================================================
// ZPL VIEWER avec rendu 100% local
// ============================================================
const SIZES = [
  { label: '4 × 6', value: '4x6' },
  { label: '4 × 4', value: '4x4' },
  { label: '4 × 3', value: '4x3' },
  { label: '3 × 2', value: '3x2' },
  { label: '2 × 1', value: '2x1' },
];

const DPMM = [
  { label: '6 dpmm', sub: '152 dpi' },
  { label: '8 dpmm', sub: '203 dpi' },
  { label: '12 dpmm', sub: '300 dpi' },
  { label: '24 dpmm', sub: '600 dpi' },
];

// --- Découpage multi-étiquettes : on isole chaque bloc ^XA...^XZ ---
function splitZPL(zpl) {
  const labels = [];
  const regex = /\^XA[\s\S]*?\^XZ/g;
  let match;
  while ((match = regex.exec(zpl)) !== null) {
    labels.push(match[0]);
  }
  // Si aucun marqueur trouvé, on traite le ZPL entier comme une étiquette unique
  return labels.length > 0 ? labels : [zpl];
}

// --- Chargement des libs externes (bwip-js pour barcodes, jsPDF pour export PDF, JSZip pour ZIP) ---
const loadScript = (src) => new Promise((resolve, reject) => {
  if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
  const script = document.createElement('script');
  script.src = src;
  script.crossOrigin = 'anonymous';
  script.onload = () => resolve();
  script.onerror = () => reject(new Error(`Échec du chargement : ${src}`));
  document.head.appendChild(script);
});

// Tente plusieurs CDN à la suite. Renvoie l'URL qui a marché ou rejette si tout échoue.
async function loadScriptWithFallback(urls, globalCheck) {
  for (const url of urls) {
    try {
      await loadScript(url);
      // Vérifie que la lib a bien exposé son objet global (sinon URL inutile)
      if (!globalCheck || globalCheck()) return url;
    } catch (e) { /* try next */ }
  }
  throw new Error('Toutes les sources CDN ont échoué pour : ' + urls[0]);
}

// CDN multiples pour chaque lib (jsdelivr → unpkg → cdnjs)
const CDN_BWIP = [
  'https://cdn.jsdelivr.net/npm/bwip-js@4.5.2/dist/bwip-js-min.js',
  'https://unpkg.com/bwip-js@4.5.2/dist/bwip-js-min.js',
  'https://cdn.jsdelivr.net/npm/bwip-js/dist/bwip-js-min.js',
];
const CDN_JSPDF = [
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
];
const CDN_JSZIP = [
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
];

function ZplViewer({ onBack }) {
  const [zpl, setZpl] = useState(EXAMPLE_ZPL);
  const [size, setSize] = useState('4x6');
  const [dpmm, setDpmm] = useState('8');
  const [labels, setLabels] = useState([]); // array of { dataUrl, blob, dims, warnings, overflow }
  const [currentLabel, setCurrentLabel] = useState(0);
  const [preview, setPreview] = useState(null);
  const [pngBlob, setPngBlob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [dims, setDims] = useState(null);
  const [overflow, setOverflow] = useState(null);
  const [libsReady, setLibsReady] = useState(false);
  const [pdfAvailable, setPdfAvailable] = useState(false);
  const [zipAvailable, setZipAvailable] = useState(false);
  const [zipMenuOpen, setZipMenuOpen] = useState(false);
  const [libsError, setLibsError] = useState(null);
  const fileRef = useRef(null);

  // Comptage en temps réel pour le statut éditeur
  const labelCountInZpl = Math.max(1, (zpl.match(/\^XA/gi) || []).length);

  // Charger les libs au montage avec fallback CDN (résilient : si jsPDF échoue, PNG reste dispo)
  useEffect(() => {
    Promise.allSettled([
      loadScriptWithFallback(CDN_BWIP, () => !!window.bwipjs),
      loadScriptWithFallback(CDN_JSPDF, () => !!window.jspdf),
      loadScriptWithFallback(CDN_JSZIP, () => !!window.JSZip),
    ]).then((results) => {
      const bwipOk = results[0].status === 'fulfilled' && window.bwipjs;
      const pdfOk = results[1].status === 'fulfilled' && window.jspdf;
      const zipOk = results[2].status === 'fulfilled' && window.JSZip;
      if (!bwipOk) {
        const reason = results[0].status === 'rejected'
          ? ' (tous les CDN ont échoué — vérifiez votre connexion ou un éventuel bloqueur de scripts)'
          : ' (script chargé mais variable globale absente — version incompatible)';
        setLibsError("Le module de rendu des codes-barres n'a pas pu être chargé." + reason);
        return;
      }
      setLibsReady(true);
      setPdfAvailable(pdfOk);
      setZipAvailable(zipOk);
    });
  }, []);

  // Rendu automatique une fois que les libs sont prêtes
  useEffect(() => {
    if (libsReady && !preview && !error) {
      render();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libsReady]);

  // Sync : quand on change d'étiquette dans la pagination, on met à jour ce qui est affiché
  useEffect(() => {
    if (labels.length > 0 && labels[currentLabel]) {
      const lbl = labels[currentLabel];
      setPreview(lbl.dataUrl);
      setPngBlob(lbl.blob);
      setDims(lbl.dims);
      setOverflow(lbl.overflow);
      setWarnings(lbl.warnings);
    }
  }, [currentLabel, labels]);

  const render = async () => {
    if (!zpl.trim()) { setError('Le code ZPL est vide.'); return; }
    if (!libsReady) { setError('Les modules de rendu ne sont pas encore chargés.'); return; }
    setLoading(true); setError(null);
    try {
      const [w, h] = size.split('x').map(Number);
      const labelBlocks = splitZPL(zpl);
      const rendered = [];

      for (const block of labelBlocks) {
        const result = renderZPL(block, {
          dpmm: parseInt(dpmm),
          widthInches: w,
          heightInches: h,
        });
        const dataUrl = result.canvas.toDataURL('image/png');
        const blob = await new Promise(res => result.canvas.toBlob(res, 'image/png'));
        rendered.push({
          dataUrl, blob,
          warnings: result.warnings,
          dims: result.dims,
          overflow: result.overflow,
        });
      }

      setLabels(rendered);
      setCurrentLabel(0);
      // L'effet ci-dessus s'occupe de mettre à jour preview/pngBlob/dims/etc.
    } catch (e) {
      setError(e.message);
      setLabels([]);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const downloadPNG = () => {
    if (!pngBlob) return;
    setDownloading('png');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(pngBlob);
    link.download = `atelier-label-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => { URL.revokeObjectURL(link.href); setDownloading(null); }, 500);
  };

  const downloadPDF = () => {
    if (!labels.length) return;
    setDownloading('pdf');
    try {
      const { jsPDF } = window.jspdf;
      const [w, h] = size.split('x').map(Number);
      const orientation = h > w ? 'portrait' : 'landscape';
      const pdf = new jsPDF({ orientation, unit: 'in', format: [w, h] });

      labels.forEach((lbl, i) => {
        if (i > 0) pdf.addPage([w, h], orientation);
        pdf.addImage(lbl.dataUrl, 'PNG', 0, 0, w, h, undefined, 'FAST');
      });

      const fname = labels.length > 1
        ? `atelier-labels-${labels.length}p-${Date.now()}.pdf`
        : `atelier-label-${Date.now()}.pdf`;
      pdf.save(fname);
    } catch (e) {
      setError('Erreur PDF : ' + e.message);
    } finally {
      setTimeout(() => setDownloading(null), 300);
    }
  };

  // Télécharger toutes les étiquettes dans un ZIP (format = 'png' ou 'pdf')
  const downloadZip = async (format) => {
    if (!labels.length || !window.JSZip) return;
    setZipMenuOpen(false);
    setDownloading('zip-' + format);
    setError(null);
    try {
      const zip = new window.JSZip();
      const [w, h] = size.split('x').map(Number);
      const pad = (n) => String(n).padStart(3, '0');

      if (format === 'png') {
        for (let i = 0; i < labels.length; i++) {
          zip.file(`label-${pad(i + 1)}.png`, labels[i].blob);
        }
      } else if (format === 'pdf') {
        if (!window.jspdf) throw new Error('Module PDF non chargé');
        const { jsPDF } = window.jspdf;
        const orientation = h > w ? 'portrait' : 'landscape';
        for (let i = 0; i < labels.length; i++) {
          const pdf = new jsPDF({ orientation, unit: 'in', format: [w, h] });
          pdf.addImage(labels[i].dataUrl, 'PNG', 0, 0, w, h, undefined, 'FAST');
          const pdfBlob = pdf.output('blob');
          zip.file(`label-${pad(i + 1)}.pdf`, pdfBlob);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `atelier-labels-${labels.length}-${format}-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (e) {
      setError('Erreur ZIP : ' + e.message);
    } finally {
      setTimeout(() => setDownloading(null), 300);
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setZpl(ev.target.result);
    reader.readAsText(file);
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(zpl);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="min-h-screen text-slate-900" style={{ background: '#F8FAFC', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <FontsAndStyles />

      <nav className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-jetbrains text-xs">
              <ArrowLeft size={14} />
              RETOUR
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-3">
              <Logo small />
              <div>
                <div className="font-bricolage font-semibold text-sm leading-tight text-slate-900">ZPL Viewer</div>
                <div className="font-jetbrains text-[10px] text-slate-500">ATELIER / 01</div>
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 font-jetbrains text-[10px] text-slate-500 tracking-wider">
            <span className={`w-1.5 h-1.5 rounded-full ${libsReady ? '' : 'animate-pulse'}`} style={{ background: libsError ? '#DC2626' : libsReady ? '#10B981' : '#F59E0B' }} />
            {libsError
              ? 'ERREUR MODULES'
              : !libsReady
                ? 'CHARGEMENT DES MODULES…'
                : pdfAvailable
                  ? 'RENDU LOCAL · 100% NAVIGATEUR'
                  : 'RENDU LOCAL · PDF INDISPONIBLE'}
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* LEFT - Input */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2 font-jetbrains text-xs text-slate-600">
                  <FileCode2 size={13} />
                  CODE ZPL
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={copy} className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-white transition-colors" title="Copier">
                    {copied ? <Check size={13} style={{ color: BLUE }} /> : <Copy size={13} />}
                  </button>
                  <button onClick={() => fileRef.current?.click()} className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-white transition-colors" title="Importer un .zpl">
                    <Upload size={13} />
                  </button>
                  <button onClick={() => setZpl(EXAMPLE_ZPL)} className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-white transition-colors" title="Exemple — étiquette unique">
                    <RotateCw size={13} />
                  </button>
                  <button onClick={() => setZpl(EXAMPLE_ZPL_MULTI)} className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-white transition-colors" title="Exemple — multi-étiquettes (3 colis)">
                    <Files size={13} />
                  </button>
                  <input ref={fileRef} type="file" accept=".zpl,.txt,.prn,.lbl" onChange={(e) => handleFile(e.target.files[0])} className="hidden" />
                </div>
              </div>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className="relative"
              >
                {dragOver && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(37,99,235,0.06)', border: `2px dashed ${BLUE}` }}>
                    <div className="font-jetbrains text-sm tracking-wider" style={{ color: BLUE }}>↓ DÉPOSEZ LE FICHIER ZPL</div>
                  </div>
                )}
                <textarea
                  value={zpl}
                  onChange={(e) => setZpl(e.target.value)}
                  spellCheck={false}
                  className="w-full px-4 py-4 bg-white outline-none resize-none font-jetbrains text-xs text-slate-800 leading-relaxed"
                  style={{ minHeight: '380px' }}
                  placeholder="^XA ... ^XZ"
                />
              </div>
              <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between font-jetbrains text-[10px] text-slate-500">
                <span>{zpl.length} car. · {zpl.split('\n').length} lignes</span>
                <span className="flex items-center gap-3">
                  <span style={{ color: labelCountInZpl > 1 ? BLUE : undefined }} className={labelCountInZpl > 1 ? 'font-medium' : ''}>
                    {labelCountInZpl} étiquette{labelCountInZpl > 1 ? 's' : ''}
                  </span>
                  <span>UTF-8</span>
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600">
                PARAMÈTRES
              </div>
              <div className="p-4 space-y-5">
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <label className="font-jetbrains text-[10px] text-slate-500 tracking-wider">FORMAT PHYSIQUE</label>
                    <span className="font-jetbrains text-[10px] text-slate-400">pouces</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mb-2 leading-snug">
                    Taille réelle du support papier (largeur × hauteur)
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {SIZES.map(s => (
                      <button
                        key={s.value}
                        onClick={() => setSize(s.value)}
                        className="px-1 py-2.5 rounded-md text-xs font-jetbrains transition-all"
                        style={size === s.value
                          ? { background: BLUE, color: '#FFFFFF', fontWeight: 600 }
                          : { background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <label className="font-jetbrains text-[10px] text-slate-500 tracking-wider">RÉSOLUTION DE L'IMPRIMANTE</label>
                    <span className="font-jetbrains text-[10px] text-slate-400">dpmm</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mb-2 leading-snug">
                    DPI de votre modèle Zebra — doit correspondre à celui pour lequel le ZPL a été conçu
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {DPMM.map(d => {
                      const val = d.label.split(' ')[0];
                      const isActive = dpmm === val;
                      return (
                        <button
                          key={val}
                          onClick={() => setDpmm(val)}
                          className="px-1 py-2 rounded-md font-jetbrains transition-all"
                          style={isActive
                            ? { background: BLUE, color: '#FFFFFF' }
                            : { background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}
                        >
                          <div className="text-xs" style={{ fontWeight: isActive ? 600 : 400 }}>{d.label}</div>
                          <div className="text-[9px] opacity-80 mt-0.5">{d.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Récap dimensions calculées */}
                <div className="pt-3 border-t border-slate-100 font-jetbrains text-[10px] text-slate-500 flex items-center justify-between">
                  <span>CANVAS GÉNÉRÉ</span>
                  <span className="text-slate-700 font-medium">
                    {Math.round(parseFloat(size.split('x')[0]) * parseInt(dpmm) * 25.4)} × {Math.round(parseFloat(size.split('x')[1]) * parseInt(dpmm) * 25.4)} dots
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={render}
              disabled={loading || !libsReady}
              className="w-full py-3.5 rounded-xl font-jetbrains text-sm font-semibold tracking-wider transition-all hover:translate-y-[-1px] disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-2 text-white shadow-sm"
              style={{ background: loading ? BLUE_DARK : BLUE }}
            >
              {!libsReady
                ? <><Loader2 size={15} className="animate-spin" /> CHARGEMENT MODULES…</>
                : loading
                  ? <><Loader2 size={15} className="animate-spin" /> RENDU EN COURS…</>
                  : <><Zap size={14} /> GÉNÉRER L'APERÇU</>}
            </button>
          </div>

          {/* RIGHT - Preview */}
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 font-jetbrains text-xs text-slate-600 flex-wrap">
                  <ImageIcon size={13} />
                  APERÇU
                  <span className="text-slate-300">·</span>
                  <span style={{ color: BLUE }} className="font-medium">{size} in</span>
                  <span className="text-slate-300">·</span>
                  <span style={{ color: BLUE }} className="font-medium">{dpmm} dpmm</span>
                  {dims && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500">{dims.widthDots}×{dims.heightDots} dots</span>
                    </>
                  )}
                </div>
                {preview && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={downloadPNG}
                      disabled={downloading !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-jetbrains text-xs text-slate-700 border border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                      {downloading === 'png' ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                      PNG
                    </button>

                    {/* Bouton ZIP avec menu (visible uniquement en multi) */}
                    {labels.length > 1 && zipAvailable && (
                      <div className="relative">
                        <button
                          onClick={() => setZipMenuOpen(!zipMenuOpen)}
                          disabled={downloading !== null}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-jetbrains text-xs text-slate-700 border border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-all disabled:opacity-50"
                        >
                          {downloading?.startsWith('zip-') ? <Loader2 size={11} className="animate-spin" /> : <FileArchive size={11} />}
                          ZIP
                          <ChevronDown size={10} className={`transition-transform ${zipMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {zipMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setZipMenuOpen(false)} />
                            <div className="absolute top-full right-0 mt-1 z-20 w-56 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
                              <div className="px-3 py-2 border-b border-slate-100 font-jetbrains text-[10px] text-slate-500 tracking-wider">
                                FORMAT DU ZIP
                              </div>
                              <button
                                onClick={() => downloadZip('png')}
                                className="w-full px-3 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center justify-between group"
                              >
                                <div>
                                  <div className="font-jetbrains text-xs font-medium text-slate-800">PNG</div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">{labels.length} fichiers .png</div>
                                </div>
                                <ArrowRight size={12} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
                              </button>
                              <button
                                onClick={() => downloadZip('pdf')}
                                disabled={!pdfAvailable}
                                className="w-full px-3 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center justify-between group disabled:opacity-40 disabled:cursor-not-allowed"
                                title={!pdfAvailable ? 'Module PDF non chargé' : ''}
                              >
                                <div>
                                  <div className="font-jetbrains text-xs font-medium text-slate-800">PDF</div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">{labels.length} fichiers .pdf (1 page chacun)</div>
                                </div>
                                <ArrowRight size={12} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <button
                      onClick={downloadPDF}
                      disabled={downloading !== null || !pdfAvailable}
                      title={!pdfAvailable ? 'Module PDF non chargé' : ''}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-jetbrains text-xs font-semibold transition-all hover:translate-y-[-1px] disabled:opacity-40 disabled:translate-y-0 disabled:cursor-not-allowed text-white shadow-sm"
                      style={{ background: BLUE }}
                    >
                      {downloading === 'pdf' ? <Loader2 size={11} className="animate-spin" /> : <FileDown size={11} />}
                      PDF {labels.length > 1 ? `· ${labels.length} PAGES` : ''}
                    </button>
                  </div>
                )}
              </div>

              {/* Pagination multi-étiquettes */}
              {labels.length > 1 && (
                <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-center gap-4" style={{ background: BLUE_LIGHT }}>
                  <button
                    onClick={() => setCurrentLabel(Math.max(0, currentLabel - 1))}
                    disabled={currentLabel === 0}
                    className="flex items-center justify-center w-7 h-7 rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white"
                    style={{ color: BLUE }}
                    title="Étiquette précédente"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <div className="font-jetbrains text-xs flex items-center gap-2">
                    <span className="text-slate-500">ÉTIQUETTE</span>
                    <span className="font-semibold" style={{ color: BLUE }}>{currentLabel + 1}</span>
                    <span className="text-slate-400">/</span>
                    <span className="text-slate-700 font-medium">{labels.length}</span>
                  </div>
                  <button
                    onClick={() => setCurrentLabel(Math.min(labels.length - 1, currentLabel + 1))}
                    disabled={currentLabel === labels.length - 1}
                    className="flex items-center justify-center w-7 h-7 rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white"
                    style={{ color: BLUE }}
                    title="Étiquette suivante"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}

              <div
                className="p-8 md:p-12 flex items-center justify-center"
                style={{
                  minHeight: '600px',
                  background: 'repeating-linear-gradient(45deg, #F8FAFC 0, #F8FAFC 14px, #F1F5F9 14px, #F1F5F9 15px)',
                }}
              >
                {error || libsError ? (
                  <div className="max-w-md text-center">
                    <div
                      className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
                      style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}
                    >
                      <AlertCircle size={20} className="text-red-500" />
                    </div>
                    <div className="font-bricolage text-lg mb-2 text-red-600">Erreur</div>
                    <div className="text-sm text-slate-600 font-jetbrains break-words">{error || libsError}</div>
                  </div>
                ) : preview ? (
                  <div className="relative" style={{ filter: 'drop-shadow(0 25px 50px rgba(15,23,42,0.15))' }}>
                    <img
                      src={preview}
                      alt="Étiquette ZPL rendue"
                      className="max-w-full block bg-white"
                      style={{ maxHeight: '560px' }}
                    />
                  </div>
                ) : (
                  <div className="text-center max-w-sm">
                    <div
                      className="w-14 h-14 rounded-xl mx-auto mb-5 flex items-center justify-center"
                      style={{ background: BLUE_LIGHT, border: `1px solid #BFDBFE` }}
                    >
                      <ImageIcon size={22} style={{ color: BLUE }} strokeWidth={1.75} />
                    </div>
                    <div className="font-bricolage text-xl mb-2 text-slate-800">
                      {libsReady ? 'Aperçu en attente' : 'Préparation du moteur…'}
                    </div>
                    <div className="text-sm text-slate-500 leading-relaxed">
                      {libsReady
                        ? <>Cliquez sur <span style={{ color: BLUE }} className="font-medium">Générer l'aperçu</span> pour visualiser votre étiquette.</>
                        : <>Chargement de bwip-js et jsPDF (une seule fois)…</>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Overflow warning */}
            {overflow && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-red-900 leading-relaxed">
                  <div className="font-semibold mb-1 font-jetbrains">Contenu rogné</div>
                  <div className="text-red-800">
                    Le ZPL dessine jusqu'à <span className="font-jetbrains font-medium">({overflow.maxX}, {overflow.maxY}) dots</span> mais le canvas ne fait que <span className="font-jetbrains font-medium">{overflow.canvasW} × {overflow.canvasH} dots</span>. Le contenu hors-canvas est invisible.
                  </div>
                  <div className="mt-1.5 text-red-700 text-[11px]">
                    → Passez à un format plus grand, ou augmentez la résolution si votre ZPL était conçu pour un dpmm supérieur.
                  </div>
                </div>
              </div>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 font-jetbrains leading-relaxed">
                  <div className="font-semibold mb-1">Commandes ZPL ignorées :</div>
                  <div className="text-amber-700">{warnings.map(w => `^${w}`).join(' · ')}</div>
                  <div className="mt-2 text-amber-600 text-[10px]">Le rendu fonctionne mais certaines commandes ne sont pas encore supportées par le moteur local.</div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 p-5 bg-white">
              <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-3">COMMENT LIRE LES PARAMÈTRES</div>
              <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                <div>
                  <span className="font-jetbrains font-medium text-slate-800">Format</span> = la taille physique du papier. Si vous changez de 4×6 à 2×1, tout ce qui dépasse de la nouvelle zone est rogné.
                </div>
                <div>
                  <span className="font-jetbrains font-medium text-slate-800">Résolution</span> = le DPI de votre imprimante. Le ZPL utilise des coordonnées en <span className="font-jetbrains">dots</span> ; ces dots changent de taille selon le DPI. Un ZPL conçu pour 8 dpmm rendra plus compact si affiché à 12 dpmm.
                </div>
                <div className="pt-2 mt-2 border-t border-slate-100 text-slate-500">
                  <span className="font-jetbrains font-medium">Référence Zebra :</span> ZD220/GK420d/ZT230 = <span className="font-jetbrains">8 dpmm</span> · ZD420d/ZT411 = <span className="font-jetbrains">12 dpmm</span> · ZT411 600dpi = <span className="font-jetbrains">24 dpmm</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MOTEUR DE RENDU ZPL LOCAL
// ============================================================
function parseZPL(zpl) {
  const commands = [];
  let i = 0;
  while (i < zpl.length) {
    // Skip jusqu'au prochain ^ ou ~
    while (i < zpl.length && zpl[i] !== '^' && zpl[i] !== '~') i++;
    if (i >= zpl.length) break;
    i++; // saute ^ ou ~

    // Lit 2 caractères alphanumériques pour le nom de commande
    let cmd = '';
    while (i < zpl.length && /[A-Z0-9]/i.test(zpl[i]) && cmd.length < 2) {
      cmd += zpl[i].toUpperCase();
      i++;
    }

    // Cas spécial ^FD : tout jusqu'au prochain ^
    let params;
    if (cmd === 'FD') {
      const end = zpl.indexOf('^', i);
      params = end === -1 ? zpl.slice(i) : zpl.slice(i, end);
      i = end === -1 ? zpl.length : end;
    } else {
      let end = i;
      while (end < zpl.length && zpl[end] !== '^' && zpl[end] !== '~') end++;
      params = zpl.slice(i, end).trim();
      i = end;
    }

    commands.push({ cmd, params });
  }
  return commands;
}

function renderZPL(zpl, { dpmm, widthInches, heightInches }) {
  const dpi = dpmm * 25.4;
  const widthDots = Math.round(widthInches * dpi);
  const heightDots = Math.round(heightInches * dpi);

  const canvas = document.createElement('canvas');
  canvas.width = widthDots;
  canvas.height = heightDots;
  const ctx = canvas.getContext('2d');

  // Fond blanc
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, widthDots, heightDots);
  ctx.fillStyle = '#000000';

  const commands = parseZPL(zpl);

  const state = {
    x: 0, y: 0,
    fontHeight: 15, fontWidth: 0,
    defaultFontHeight: 15, defaultFontWidth: 0,
    currentFont: '0',
    defaultFont: '0',
    bcModuleWidth: 2, bcRatio: 3, bcHeight: 100,
    labelOffsetX: 0, labelOffsetY: 0,
    fontInverse: false,
    pendingBarcode: null,
    dpmm,
    warnings: new Set(),
    maxX: 0, maxY: 0,
  };

  for (const c of commands) {
    executeCommand(ctx, c, state);
  }

  const overflow = (state.maxX > widthDots + 1 || state.maxY > heightDots + 1)
    ? { maxX: Math.round(state.maxX), maxY: Math.round(state.maxY), canvasW: widthDots, canvasH: heightDots }
    : null;

  return {
    canvas,
    warnings: Array.from(state.warnings),
    dims: { widthDots, heightDots, dpi: Math.round(dpi) },
    overflow,
  };
}

function executeCommand(ctx, { cmd, params }, state) {
  // Police : ^A0, ^AD, ^AA, etc. → 2 chars, premier = 'A'
  if (cmd.length === 2 && cmd[0] === 'A') {
    const parts = params.split(',');
    // parts[0] = orientation (N/R/I/B), parts[1] = height, parts[2] = width
    const h = parseInt(parts[1]);
    const w = parseInt(parts[2]);
    state.currentFont = cmd[1];
    state.fontHeight = !isNaN(h) && h > 0 ? h : state.defaultFontHeight;
    state.fontWidth = !isNaN(w) ? w : 0;
    return;
  }

  switch (cmd) {
    case 'XA':
    case 'XZ':
      // Début / fin d'étiquette
      break;

    case 'FS':
      state.fontInverse = false;
      break;

    case 'FO':
    case 'FT': { // FT = Field Typeset (approx. comme FO)
      const [x, y] = params.split(',').map(s => parseFloat(s) || 0);
      state.x = x;
      state.y = y;
      break;
    }

    case 'LH': {
      const [x, y] = params.split(',').map(s => parseFloat(s) || 0);
      state.labelOffsetX = x;
      state.labelOffsetY = y;
      break;
    }

    case 'CF': {
      const parts = params.split(',');
      if (parts[0]) state.defaultFont = parts[0];
      if (parts[1]) {
        const h = parseInt(parts[1]);
        if (!isNaN(h) && h > 0) state.defaultFontHeight = h;
      }
      if (parts[2]) {
        const w = parseInt(parts[2]);
        if (!isNaN(w)) state.defaultFontWidth = w;
      }
      state.fontHeight = state.defaultFontHeight;
      state.fontWidth = state.defaultFontWidth;
      state.currentFont = state.defaultFont;
      break;
    }

    case 'GB': {
      const parts = params.split(',');
      const w = parseFloat(parts[0]) || 0;
      const h = parseFloat(parts[1]) || 0;
      const t = parseFloat(parts[2]) || 1;
      let colorChar = (parts[3] || 'B').toUpperCase();
      // ^FR inverse la couleur sur la prochaine commande de dessin (texte ET graphique)
      if (state.fontInverse) {
        colorChar = colorChar === 'B' ? 'W' : 'B';
      }
      drawGraphicBox(ctx, state, w, h, t, colorChar === 'W' ? '#FFFFFF' : '#000000');
      break;
    }

    case 'BY': {
      const parts = params.split(',');
      const m = parseFloat(parts[0]);
      const r = parseFloat(parts[1]);
      const h = parseFloat(parts[2]);
      if (!isNaN(m) && m > 0) state.bcModuleWidth = m;
      if (!isNaN(r) && r > 0) state.bcRatio = r;
      if (!isNaN(h) && h > 0) state.bcHeight = h;
      break;
    }

    case 'BC':
      state.pendingBarcode = { type: 'code128', params: params.split(',') };
      break;

    case 'B3':
      state.pendingBarcode = { type: 'code39', params: params.split(',') };
      break;

    case 'BQ':
      state.pendingBarcode = { type: 'qrcode', params: params.split(',') };
      break;

    case 'BE':
      state.pendingBarcode = { type: 'ean13', params: params.split(',') };
      break;

    case 'BU':
      state.pendingBarcode = { type: 'upca', params: params.split(',') };
      break;

    case 'FR':
      state.fontInverse = true;
      break;

    case 'FD':
      if (state.pendingBarcode) {
        drawBarcode(ctx, state, state.pendingBarcode, params);
        state.pendingBarcode = null;
      } else {
        drawText(ctx, state, params);
      }
      break;

    case 'FX':
      break; // commentaire

    // Commandes silencieusement ignorées (config imprimante, sans impact visuel)
    case 'PR': case 'PW': case 'PQ': case 'MD': case 'MN': case 'MM':
    case 'JM': case 'JZ': case 'LL': case 'LS': case 'LT': case 'CI':
    case 'PO': case 'SS':
      break;

    default:
      if (cmd) state.warnings.add(cmd);
      break;
  }
}

function drawText(ctx, state, text) {
  const fontSize = state.fontHeight || 15;
  // ZPL utilise des polices bitmap où le haut de la majuscule = coordonnée FO.
  // Arial a ~10% de padding entre le haut de l'em-box et le haut des capitales.
  // On compense en remontant la position de ~10% pour aligner cap-top sur la coord FO.
  const capPadding = fontSize * 0.1;
  // Police 0 ZPL = CG Triumvirate Bold Condensed → bold. Autres polices (A, D, etc.) = regular.
  const isBold = (state.currentFont || '0') === '0';
  const weight = isBold ? 'bold' : 'normal';
  ctx.font = `${weight} ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = state.fontInverse ? '#FFFFFF' : '#000000';
  const drawX = state.x + state.labelOffsetX;
  const drawY = state.y + state.labelOffsetY - capPadding;
  ctx.fillText(text, drawX, drawY);
  // Tracking pour overflow (en utilisant la mesure réelle)
  const m = ctx.measureText(text);
  state.maxX = Math.max(state.maxX, drawX + m.width);
  state.maxY = Math.max(state.maxY, state.y + state.labelOffsetY + fontSize);
  ctx.fillStyle = '#000000';
}

function drawGraphicBox(ctx, state, w, h, t, color) {
  const x = state.x + state.labelOffsetX;
  const y = state.y + state.labelOffsetY;
  ctx.fillStyle = color;

  // Si dimensions ≤ épaisseur → ligne pleine
  if (h <= t || w <= t) {
    ctx.fillRect(x, y, Math.max(w, 1), Math.max(h, 1));
  } else {
    // Boîte : 4 traits de l'épaisseur t
    ctx.fillRect(x, y, w, t);                  // haut
    ctx.fillRect(x, y + h - t, w, t);          // bas
    ctx.fillRect(x, y, t, h);                  // gauche
    ctx.fillRect(x + w - t, y, t, h);          // droite
  }
  state.maxX = Math.max(state.maxX, x + w);
  state.maxY = Math.max(state.maxY, y + h);
  ctx.fillStyle = '#000000';
}

function drawBarcode(ctx, state, bc, data) {
  if (!window.bwipjs) {
    ctx.fillStyle = '#DC2626';
    ctx.font = '14px monospace';
    ctx.fillText('[bwip-js non chargé]', state.x, state.y);
    ctx.fillStyle = '#000000';
    return;
  }

  const bcidMap = {
    code128: 'code128',
    code39: 'code39',
    qrcode: 'qrcode',
    ean13: 'ean13',
    upca: 'upca',
  };
  const bcid = bcidMap[bc.type] || 'code128';

  // params ZPL BC : [orientation, height, printText, textAbove, checkDigit]
  const orientation = (bc.params[0] || 'N').toUpperCase();
  const heightOverride = parseFloat(bc.params[1]);
  const showText = (bc.params[2] || 'Y').toUpperCase() === 'Y';

  const heightDots = !isNaN(heightOverride) && heightOverride > 0 ? heightOverride : state.bcHeight;
  // bwip-js : output_height_px = height_mm × 2.835 × scaleY
  // On veut output = heightDots pixels avec scale = bcModuleWidth
  // → height_mm = heightDots / (2.835 × bcModuleWidth)
  const BWIP_PX_PER_MM = 2.83465;
  const heightMM = heightDots / (BWIP_PX_PER_MM * state.bcModuleWidth);

  try {
    const bcCanvas = document.createElement('canvas');
    const opts = {
      bcid: bcid,
      text: data,
      scale: state.bcModuleWidth,
      includetext: showText,
      textxalign: 'center',
      paddingwidth: 0,
      paddingheight: 0,
      backgroundcolor: 'FFFFFF',
    };
    // QR code n'utilise pas height (carré, déterminé par scale)
    if (bcid !== 'qrcode') opts.height = heightMM;

    window.bwipjs.toCanvas(bcCanvas, opts);

    // Rotation si orientation R/I/B
    const x = state.x + state.labelOffsetX;
    const y = state.y + state.labelOffsetY;
    if (orientation === 'N') {
      ctx.drawImage(bcCanvas, x, y);
    } else {
      ctx.save();
      ctx.translate(x, y);
      const rot = { R: -Math.PI / 2, I: Math.PI, B: Math.PI / 2 }[orientation] || 0;
      ctx.rotate(rot);
      ctx.drawImage(bcCanvas, 0, 0);
      ctx.restore();
    }
    state.maxX = Math.max(state.maxX, x + bcCanvas.width);
    state.maxY = Math.max(state.maxY, y + bcCanvas.height);
  } catch (e) {
    ctx.fillStyle = '#DC2626';
    ctx.font = '14px monospace';
    ctx.fillText(`[Code-barres : ${e.message}]`, state.x + state.labelOffsetX, state.y + state.labelOffsetY);
    ctx.fillStyle = '#000000';
  }
}

// ============================================================
// GÉNÉRATEUR DE CODES-BARRES (Outil 02)
// ============================================================
// Helpers GS1 : calcul et vérification des check digits (algorithme mod-10 standard)
function gs1CheckDigit(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = parseInt(digits[digits.length - 1 - i], 10);
    sum += d * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

function gs1CheckDigitValid(fullDigits) {
  if (!/^\d+$/.test(fullDigits)) return false;
  const data = fullDigits.slice(0, -1);
  const expected = parseInt(fullDigits.slice(-1), 10);
  return gs1CheckDigit(data) === expected;
}

// Auto-complète les check digits manquants dans un payload GS1 (avant envoi à bwip-js)
// Ex : '(00)37350000123456789' → '(00)373500001234567895'
function autoCompleteGs1Payload(payload) {
  return payload
    // AI 00 = SSCC (18 chiffres)
    .replace(/\((00)\)(\d{17})(?!\d)/g, (_, ai, data) => `(${ai})${data}${gs1CheckDigit(data)}`)
    // AI 01 = GTIN (14 chiffres)
    .replace(/\((01)\)(\d{13})(?!\d)/g, (_, ai, data) => `(${ai})${data}${gs1CheckDigit(data)}`)
    // AI 02 = GTIN contenu (14 chiffres)
    .replace(/\((02)\)(\d{13})(?!\d)/g, (_, ai, data) => `(${ai})${data}${gs1CheckDigit(data)}`);
}

const BARCODE_TYPES = [
  // 1D · Produits (GS1)
  {
    id: 'ean13', label: 'EAN-13', bcid: 'ean13', cat: 'product',
    desc: 'Produits grand public · 13 chiffres (12 + check). Standard mondial GS1.',
    example: '1234567890128',
    placeholder: '12 ou 13 chiffres',
    validate: (d) => {
      if (!/^\d*$/.test(d)) return { ok: false, msg: 'Chiffres uniquement' };
      if (d.length === 12) return { ok: true, msg: 'OK · check digit calculé automatiquement' };
      if (d.length === 13) return { ok: true, msg: 'OK · 13 chiffres' };
      return { ok: false, msg: `12 ou 13 chiffres requis (actuel : ${d.length})` };
    },
  },
  {
    id: 'ean8', label: 'EAN-8', bcid: 'ean8', cat: 'product',
    desc: 'Petits produits · 8 chiffres (7 + check). Pour articles à surface réduite.',
    example: '12345670',
    placeholder: '7 ou 8 chiffres',
    validate: (d) => {
      if (!/^\d*$/.test(d)) return { ok: false, msg: 'Chiffres uniquement' };
      if (d.length === 7) return { ok: true, msg: 'OK · check digit calculé' };
      if (d.length === 8) return { ok: true, msg: 'OK · 8 chiffres' };
      return { ok: false, msg: `7 ou 8 chiffres requis (actuel : ${d.length})` };
    },
  },
  {
    id: 'upca', label: 'UPC-A', bcid: 'upca', cat: 'product',
    desc: 'Produits Amérique du Nord · 12 chiffres (11 + check).',
    example: '123456789012',
    placeholder: '11 ou 12 chiffres',
    validate: (d) => {
      if (!/^\d*$/.test(d)) return { ok: false, msg: 'Chiffres uniquement' };
      if (d.length === 11) return { ok: true, msg: 'OK · check digit calculé' };
      if (d.length === 12) return { ok: true, msg: 'OK · 12 chiffres' };
      return { ok: false, msg: `11 ou 12 chiffres requis (actuel : ${d.length})` };
    },
  },
  // 1D · Universels
  {
    id: 'code128', label: 'Code 128', bcid: 'code128', cat: 'universal',
    desc: 'Alphanumérique · standard universel. Auto-bascule entre sous-types A/B/C.',
    example: 'ATELIER-2023-001',
    placeholder: 'Caractères ASCII',
    validate: (d) => d.length > 0
      ? { ok: true, msg: `OK · ${d.length} caractères` }
      : { ok: false, msg: 'Données requises' },
  },
  {
    id: 'code39', label: 'Code 39', bcid: 'code39', cat: 'universal',
    desc: 'Alphanumérique restreint · A-Z 0-9 et quelques symboles. Standard historique.',
    example: 'ATELIER 123',
    placeholder: 'A-Z, 0-9, espace, - . $ / + %',
    validate: (d) => {
      if (!/^[A-Z0-9 \-.$/+%]*$/.test(d)) return { ok: false, msg: 'Autorisés : A-Z, 0-9, espace, - . $ / + %' };
      return d.length > 0 ? { ok: true, msg: `OK · ${d.length} caractères` } : { ok: false, msg: 'Données requises' };
    },
  },
  // 1D · Logistique
  {
    id: 'itf14', label: 'GTIN-14 / ITF-14', bcid: 'itf14', cat: 'logistics',
    desc: 'Carton / palette · 14 chiffres (13 + check). Norme GS1 pour unités logistiques.',
    example: '12345678901231',
    placeholder: '13 ou 14 chiffres',
    validate: (d) => {
      if (!/^\d*$/.test(d)) return { ok: false, msg: 'Chiffres uniquement' };
      if (d.length === 13) return { ok: true, msg: 'OK · check digit calculé' };
      if (d.length === 14) return { ok: true, msg: 'OK · 14 chiffres' };
      return { ok: false, msg: `13 ou 14 chiffres requis (actuel : ${d.length})` };
    },
  },
  {
    id: 'gs1-128', label: 'GS1-128', bcid: 'gs1-128', cat: 'logistics',
    desc: "Code 128 avec Application Identifiers · SSCC, n° lot, dates. Pour expédition.",
    example: '(00)373500001234567895',
    placeholder: '(00)... (01)... (10)... etc.',
    validate: (d) => {
      if (d.length === 0) return { ok: false, msg: 'Données requises' };
      if (!/\(\d{2,4}\)/.test(d)) return { ok: false, msg: 'Format attendu : (AI)valeur, ex : (00)373500001234567895' };

      // Vérifier AI 00 (SSCC)
      const sscc = d.match(/\(00\)(\d+?)(?=\(|$)/);
      if (sscc) {
        const data = sscc[1];
        if (data.length === 17) {
          const cd = gs1CheckDigit(data);
          return { ok: true, msg: `SSCC à 17 chiffres · check digit ${cd} ajouté automatiquement` };
        }
        if (data.length !== 18) return { ok: false, msg: `SSCC doit faire 17 ou 18 chiffres (actuel : ${data.length})` };
        if (!gs1CheckDigitValid(data)) {
          const correct = gs1CheckDigit(data.slice(0, -1));
          return { ok: false, msg: `Check digit SSCC invalide. Attendu : ${correct}, fourni : ${data.slice(-1)}` };
        }
      }

      // Vérifier AI 01 / 02 (GTIN-14)
      for (const ai of ['01', '02']) {
        const m = d.match(new RegExp(`\\(${ai}\\)(\\d+?)(?=\\(|$)`));
        if (m) {
          const data = m[1];
          if (data.length === 13) {
            const cd = gs1CheckDigit(data);
            return { ok: true, msg: `GTIN à 13 chiffres · check digit ${cd} ajouté automatiquement` };
          }
          if (data.length !== 14) return { ok: false, msg: `GTIN (AI ${ai}) doit faire 13 ou 14 chiffres (actuel : ${data.length})` };
          if (!gs1CheckDigitValid(data)) {
            const correct = gs1CheckDigit(data.slice(0, -1));
            return { ok: false, msg: `Check digit GTIN invalide. Attendu : ${correct}` };
          }
        }
      }

      return { ok: true, msg: 'OK · syntaxe GS1 valide' };
    },
  },
  // 2D
  {
    id: 'qrcode', label: 'QR Code', bcid: 'qrcode', cat: '2d',
    desc: 'Universel · URLs, vCards, jusqu\'à ~4000 caractères. Lecture smartphone.',
    example: 'https://atelier.walyconseil.com/colis/AT-2023-001',
    placeholder: 'URL, texte, ou données structurées',
    validate: (d) => d.length > 0
      ? { ok: true, msg: `OK · ${d.length} caractères` }
      : { ok: false, msg: 'Données requises' },
  },
  {
    id: 'datamatrix', label: 'Data Matrix', bcid: 'datamatrix', cat: '2d',
    desc: 'Compact 2D · industrie, pharma (GS1 DataMatrix), pièces marquées laser.',
    example: 'AT-2023-001-LOT-A',
    placeholder: 'Données alphanumériques',
    validate: (d) => d.length > 0
      ? { ok: true, msg: `OK · ${d.length} caractères` }
      : { ok: false, msg: 'Données requises' },
  },
  {
    id: 'pdf417', label: 'PDF417', bcid: 'pdf417', cat: '2d',
    desc: 'Étiquettes complexes 2D linéaire · expédition (UPS), permis de conduire.',
    example: 'ATELIER LOGISTIQUE - COLIS AT-2023-001 - CASABLANCA',
    placeholder: 'Texte long, données structurées',
    validate: (d) => d.length > 0
      ? { ok: true, msg: `OK · ${d.length} caractères` }
      : { ok: false, msg: 'Données requises' },
  },
];

const BARCODE_CATEGORIES = [
  { id: 'product', label: '1D · Identification produit', num: '01' },
  { id: 'universal', label: '1D · Universels', num: '02' },
  { id: 'logistics', label: '1D · Logistique', num: '03' },
  { id: '2d', label: '2D · Deux dimensions', num: '04' },
];

function BarcodeGenerator({ onBack }) {
  const [typeId, setTypeId] = useState('code128');
  const [data, setData] = useState(BARCODE_TYPES.find(t => t.id === 'code128').example);
  const [scale, setScale] = useState(3);
  const [heightMM, setHeightMM] = useState(15);
  const [includeText, setIncludeText] = useState(true);
  const [rotation, setRotation] = useState(0);

  // Multi-codes : results stocke tous les codes générés, currentIdx pointe sur celui affiché
  const [results, setResults] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [preview, setPreview] = useState(null);
  const [pngBlob, setPngBlob] = useState(null);
  const [svgString, setSvgString] = useState(null);
  const [previewDims, setPreviewDims] = useState(null);

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState(null);

  const [libsReady, setLibsReady] = useState(false);
  const [pdfAvailable, setPdfAvailable] = useState(false);
  const [zipAvailable, setZipAvailable] = useState(false);
  const [zipMenuOpen, setZipMenuOpen] = useState(false);
  const [libsError, setLibsError] = useState(null);

  const currentType = BARCODE_TYPES.find(t => t.id === typeId);

  // Détection multi-codes : split sur sauts de ligne, ignore lignes vides
  const codes = useMemo(() =>
    data.split('\n').map(s => s.trim()).filter(Boolean),
    [data]
  );
  const isMulti = codes.length > 1;

  // Validation : mono = sur la ligne unique, multi = synthèse des validations individuelles
  const validation = useMemo(() => {
    if (codes.length === 0) return { ok: false, msg: 'Saisissez au moins un code' };
    if (codes.length === 1) return currentType.validate(codes[0]);
    const perCode = codes.map(c => currentType.validate(c));
    const invalid = perCode.filter(v => !v.ok).length;
    if (invalid === 0) return { ok: true, msg: `${codes.length} codes détectés, tous valides — prêts à générer` };
    return { ok: false, msg: `${invalid} code(s) invalide(s) sur ${codes.length} — corrigez ou les codes invalides seront ignorés` };
  }, [codes, currentType]);

  // Chargement des libs avec fallback CDN (bwip-js requis, jsPDF et JSZip optionnels)
  useEffect(() => {
    Promise.allSettled([
      loadScriptWithFallback(CDN_BWIP, () => !!window.bwipjs),
      loadScriptWithFallback(CDN_JSPDF, () => !!window.jspdf),
      loadScriptWithFallback(CDN_JSZIP, () => !!window.JSZip),
    ]).then((results) => {
      const bwipOk = results[0].status === 'fulfilled' && window.bwipjs;
      const pdfOk = results[1].status === 'fulfilled' && window.jspdf;
      const zipOk = results[2].status === 'fulfilled' && window.JSZip;
      if (!bwipOk) {
        const reason = results[0].status === 'rejected'
          ? ' (tous les CDN ont échoué — vérifiez votre connexion ou un éventuel bloqueur)'
          : ' (script chargé mais variable globale absente)';
        setLibsError("Le module de rendu des codes-barres n'a pas pu être chargé." + reason);
        return;
      }
      setLibsReady(true);
      setPdfAvailable(pdfOk);
      setZipAvailable(zipOk);
    });
  }, []);

  // Sync les états d'affichage avec le code courant dans results
  useEffect(() => {
    const cur = results[currentIdx];
    if (cur && cur.dataUrl) {
      setPreview(cur.dataUrl);
      setPngBlob(cur.blob);
      setSvgString(cur.svg);
      setPreviewDims(cur.dims);
      setError(null);
    } else if (cur && cur.error) {
      setPreview(null);
      setPngBlob(null);
      setSvgString(null);
      setPreviewDims(null);
      setError(cur.error);
    } else {
      setPreview(null);
      setPngBlob(null);
      setSvgString(null);
      setPreviewDims(null);
    }
  }, [results, currentIdx]);

  // Quand on change de type, pré-remplir l'exemple
  useEffect(() => {
    setData(currentType.example);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId]);

  // Auto-rendu avec debounce 250ms
  useEffect(() => {
    if (!libsReady) return;
    const t = setTimeout(() => { render(); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libsReady, typeId, data, scale, heightMM, includeText, rotation]);

  const render = async () => {
    if (!libsReady) return;
    if (codes.length === 0) { setResults([]); return; }
    setLoading(true);
    try {
      const newResults = [];
      for (const code of codes) {
        const valid = currentType.validate(code);
        if (!valid.ok) {
          newResults.push({ code, error: valid.msg, dataUrl: null, blob: null, svg: null, dims: null });
          continue;
        }
        try {
          const canvas = document.createElement('canvas');
          // Pour GS1-128, auto-compléter les check digits manquants
          const codeToRender = currentType.bcid === 'gs1-128' ? autoCompleteGs1Payload(code) : code;
          const opts = {
            bcid: currentType.bcid,
            text: codeToRender,
            scale: scale,
            includetext: includeText,
            textxalign: 'center',
            backgroundcolor: 'FFFFFF',
          };
          if (!['qrcode', 'datamatrix'].includes(currentType.bcid)) opts.height = heightMM;
          if (rotation === 90) opts.rotate = 'R';
          else if (rotation === 180) opts.rotate = 'I';
          else if (rotation === 270) opts.rotate = 'L';

          window.bwipjs.toCanvas(canvas, opts);
          const dataUrl = canvas.toDataURL('image/png');
          const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
          const svg = window.bwipjs.toSVG ? window.bwipjs.toSVG(opts) : null;
          newResults.push({ code, dataUrl, blob, svg, dims: { w: canvas.width, h: canvas.height } });
        } catch (e) {
          newResults.push({ code, error: 'Erreur de génération : ' + (e.message || 'données invalides'), dataUrl: null, blob: null, svg: null, dims: null });
        }
      }
      setResults(newResults);
      // Garder l'index courant si valide, sinon revenir à 0
      setCurrentIdx(idx => Math.min(idx, Math.max(0, newResults.length - 1)));
    } finally {
      setLoading(false);
    }
  };

  const downloadPNG = () => {
    if (!pngBlob) return;
    setDownloading('png');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(pngBlob);
    link.download = `atelier-${currentType.id}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => { URL.revokeObjectURL(link.href); setDownloading(null); }, 500);
  };

  const downloadSVG = () => {
    if (!svgString) return;
    setDownloading('svg');
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `atelier-${currentType.id}-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => { URL.revokeObjectURL(link.href); setDownloading(null); }, 500);
  };

  const downloadPDF = () => {
    if (!preview || !previewDims) return;
    setDownloading('pdf');
    try {
      const { jsPDF } = window.jspdf;
      // Marge de 0.3 inch autour
      const margin = 0.3;
      const widthIn = previewDims.w / 96 + margin * 2;
      const heightIn = previewDims.h / 96 + margin * 2;
      const orientation = widthIn > heightIn ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'in', format: [widthIn, heightIn] });
      pdf.addImage(preview, 'PNG', margin, margin, widthIn - margin * 2, heightIn - margin * 2, undefined, 'FAST');
      pdf.save(`atelier-${currentType.id}-${Date.now()}.pdf`);
    } catch (e) {
      setError('Erreur PDF : ' + e.message);
    } finally {
      setTimeout(() => setDownloading(null), 300);
    }
  };

  // Helper : nom de fichier sain pour ZIP
  const safeFilename = (code, idx) => {
    const sanitized = (code || '').replace(/[^\w-]/g, '_').slice(0, 40);
    return `${String(idx + 1).padStart(3, '0')}_${sanitized || 'code'}`;
  };

  const downloadZipPng = async () => {
    if (!window.JSZip) return;
    const valid = results.filter(r => r.blob);
    if (valid.length === 0) return;
    setDownloading('zip-png');
    setZipMenuOpen(false);
    try {
      const zip = new window.JSZip();
      valid.forEach((r, i) => zip.file(`${safeFilename(r.code, i)}.png`, r.blob));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `atelier-${currentType.id}-${valid.length}codes-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 500);
    } catch (e) {
      setError('Erreur ZIP : ' + e.message);
    } finally {
      setTimeout(() => setDownloading(null), 300);
    }
  };

  const downloadZipSvg = async () => {
    if (!window.JSZip) return;
    const valid = results.filter(r => r.svg);
    if (valid.length === 0) return;
    setDownloading('zip-svg');
    setZipMenuOpen(false);
    try {
      const zip = new window.JSZip();
      valid.forEach((r, i) => zip.file(`${safeFilename(r.code, i)}.svg`, r.svg));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `atelier-${currentType.id}-${valid.length}codes-svg-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 500);
    } catch (e) {
      setError('Erreur ZIP SVG : ' + e.message);
    } finally {
      setTimeout(() => setDownloading(null), 300);
    }
  };

  const downloadPdfMulti = () => {
    if (!window.jspdf) return;
    const valid = results.filter(r => r.dataUrl && r.dims);
    if (valid.length === 0) return;
    setDownloading('pdf-multi');
    setZipMenuOpen(false);
    try {
      const { jsPDF } = window.jspdf;
      // A4 portrait, 1 code par page, code centré, label en dessous
      const pageW = 8.27, pageH = 11.69;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'a4' });
      valid.forEach((r, idx) => {
        if (idx > 0) pdf.addPage();
        const margin = 1;
        const maxW = pageW - margin * 2;
        const maxH = pageH - margin * 3;
        const wIn = r.dims.w / 96;
        const hIn = r.dims.h / 96;
        const fit = Math.min(maxW / wIn, maxH / hIn, 1);
        const finalW = wIn * fit;
        const finalH = hIn * fit;
        const x = (pageW - finalW) / 2;
        const y = margin + 0.5;
        pdf.addImage(r.dataUrl, 'PNG', x, y, finalW, finalH, undefined, 'FAST');
        // Label code
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(String(r.code).slice(0, 100), pageW / 2, y + finalH + 0.4, { align: 'center' });
        // Pied de page : type et numéro
        pdf.setFontSize(8);
        pdf.setTextColor(140);
        pdf.text(`${currentType.label}  ·  ${idx + 1} / ${valid.length}`, pageW / 2, pageH - 0.4, { align: 'center' });
        pdf.setTextColor(0);
      });
      pdf.save(`atelier-${currentType.id}-${valid.length}codes-${Date.now()}.pdf`);
    } catch (e) {
      setError('Erreur PDF multi : ' + e.message);
    } finally {
      setTimeout(() => setDownloading(null), 300);
    }
  };

  const is2D = ['qrcode', 'datamatrix'].includes(currentType.bcid);

  return (
    <div className="min-h-screen text-slate-900" style={{ background: '#F8FAFC', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <FontsAndStyles />

      <nav className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-jetbrains text-xs">
              <ArrowLeft size={14} />
              RETOUR
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-3">
              <Logo small />
              <div>
                <div className="font-bricolage font-semibold text-sm leading-tight text-slate-900">Générateur de codes-barres</div>
                <div className="font-jetbrains text-[10px] text-slate-500">ATELIER / 02</div>
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 font-jetbrains text-[10px] text-slate-500 tracking-wider">
            <span className={`w-1.5 h-1.5 rounded-full ${libsReady ? '' : 'animate-pulse'}`} style={{ background: libsError ? '#DC2626' : libsReady ? '#10B981' : '#F59E0B' }} />
            {libsError ? 'ERREUR MODULES' : libsReady ? `RENDU LOCAL · ${BARCODE_TYPES.length} SYMBOLOGIES` : 'CHARGEMENT…'}
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* LEFT : Configuration */}
          <div className="lg:col-span-2 space-y-4">

            {/* Type selector */}
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600">
                TYPE DE CODE-BARRES
              </div>
              <div className="p-4 space-y-4">
                {BARCODE_CATEGORIES.map(cat => {
                  const types = BARCODE_TYPES.filter(t => t.cat === cat.id);
                  return (
                    <div key={cat.id}>
                      <div className="font-jetbrains text-[10px] text-slate-400 tracking-wider mb-2 flex items-center gap-2">
                        <span className="text-slate-300">{cat.num}</span>
                        {cat.label}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {types.map(t => (
                          <button
                            key={t.id}
                            onClick={() => setTypeId(t.id)}
                            className="px-2.5 py-2 rounded-md text-xs font-jetbrains transition-all text-left"
                            style={typeId === t.id
                              ? { background: BLUE, color: '#FFFFFF', fontWeight: 600 }
                              : { background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Data input */}
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="font-jetbrains text-xs text-slate-600">DONNÉES</div>
                <button
                  onClick={() => setData(currentType.example)}
                  className="text-[10px] font-jetbrains text-slate-500 hover:text-slate-900 transition-colors tracking-wider"
                  title="Charger l'exemple par défaut"
                >
                  ↻ EXEMPLE
                </button>
              </div>
              <div className="p-4">
                <textarea
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  rows={isMulti ? 6 : 3}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md outline-none resize-none font-jetbrains text-sm text-slate-800 focus:border-slate-400 transition-colors"
                  placeholder={`${currentType.placeholder}\n\nAstuce : un code par ligne pour générer plusieurs codes-barres d'un coup`}
                  spellCheck={false}
                />
                <div
                  className={`mt-2.5 text-xs font-jetbrains flex items-start gap-1.5 ${validation.ok ? 'text-emerald-600' : 'text-red-500'}`}
                >
                  {validation.ok ? <Check size={12} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />}
                  <span>{validation.msg}</span>
                </div>
                {isMulti && (
                  <div className="mt-2 px-2.5 py-1.5 rounded-md font-jetbrains text-[10px] flex items-center justify-between" style={{ background: BLUE_LIGHT, color: BLUE }}>
                    <span className="tracking-wider">MODE MULTI-CODES</span>
                    <span className="font-semibold">{codes.length} codes</span>
                  </div>
                )}
              </div>
            </div>

            {/* Options */}
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600">
                OPTIONS DE RENDU
              </div>
              <div className="p-4 space-y-5">
                {/* Scale */}
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <label className="font-jetbrains text-[10px] text-slate-500 tracking-wider">TAILLE DES MODULES</label>
                    <span className="font-jetbrains text-xs font-medium text-slate-700">{scale}×</span>
                  </div>
                  <input
                    type="range" min="1" max="10" value={scale}
                    onChange={e => setScale(parseInt(e.target.value))}
                    className="w-full accent-blue-600"
                    style={{ accentColor: BLUE }}
                  />
                </div>

                {/* Height (1D only) */}
                {!is2D && (
                  <div>
                    <div className="flex items-baseline justify-between mb-2">
                      <label className="font-jetbrains text-[10px] text-slate-500 tracking-wider">HAUTEUR DES BARRES</label>
                      <span className="font-jetbrains text-xs font-medium text-slate-700">{heightMM} mm</span>
                    </div>
                    <input
                      type="range" min="5" max="50" step="1" value={heightMM}
                      onChange={e => setHeightMM(parseInt(e.target.value))}
                      className="w-full"
                      style={{ accentColor: BLUE }}
                    />
                  </div>
                )}

                {/* Include text */}
                <div className="flex items-center justify-between">
                  <label className="font-jetbrains text-[10px] text-slate-500 tracking-wider">VALEUR LISIBLE SOUS LE CODE</label>
                  <button
                    onClick={() => setIncludeText(!includeText)}
                    className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
                    style={{ background: includeText ? BLUE : '#CBD5E1' }}
                  >
                    <span
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all"
                      style={{ left: includeText ? '22px' : '2px' }}
                    />
                  </button>
                </div>

                {/* Rotation */}
                <div>
                  <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-2">ROTATION</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[0, 90, 180, 270].map(r => (
                      <button
                        key={r}
                        onClick={() => setRotation(r)}
                        className="px-1 py-2 rounded-md font-jetbrains text-xs transition-all"
                        style={rotation === r
                          ? { background: BLUE, color: '#FFFFFF', fontWeight: 600 }
                          : { background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}
                      >
                        {r}°
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT : Preview */}
          <div className="lg:col-span-3 space-y-4">

            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 font-jetbrains text-xs text-slate-600 flex-wrap">
                  <Barcode size={13} />
                  APERÇU
                  <span className="text-slate-300">·</span>
                  <span style={{ color: BLUE }} className="font-medium">{currentType.label}</span>
                  {isMulti && results.length > 0 && (
                    <>
                      <span className="text-slate-300">·</span>
                      <div className="flex items-center gap-1.5 bg-white rounded-md border border-slate-200 px-1 py-0.5">
                        <button
                          onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                          disabled={currentIdx === 0}
                          className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                          title="Code précédent"
                        >
                          <ChevronLeft size={12} className="text-slate-600" />
                        </button>
                        <span className="font-jetbrains text-[10px] text-slate-700 px-1 min-w-[60px] text-center">
                          {currentIdx + 1} / {results.length}
                        </span>
                        <button
                          onClick={() => setCurrentIdx(i => Math.min(results.length - 1, i + 1))}
                          disabled={currentIdx >= results.length - 1}
                          className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                          title="Code suivant"
                        >
                          <ChevronRight size={12} className="text-slate-600" />
                        </button>
                      </div>
                    </>
                  )}
                  {!isMulti && previewDims && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500">{previewDims.w} × {previewDims.h} px</span>
                    </>
                  )}
                  {loading && <Loader2 size={11} className="animate-spin text-slate-400" />}
                </div>
                {preview && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={downloadPNG}
                      disabled={downloading !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-jetbrains text-xs text-slate-700 border border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                      {downloading === 'png' ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                      PNG
                    </button>
                    {svgString && (
                      <button
                        onClick={downloadSVG}
                        disabled={downloading !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-jetbrains text-xs text-slate-700 border border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-all disabled:opacity-50"
                        title="Format vectoriel · qualité d'impression illimitée"
                      >
                        {downloading === 'svg' ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                        SVG
                      </button>
                    )}
                    <button
                      onClick={downloadPDF}
                      disabled={downloading !== null || !pdfAvailable}
                      title={!pdfAvailable ? 'Module PDF non chargé' : ''}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-jetbrains text-xs font-semibold transition-all hover:translate-y-[-1px] disabled:opacity-40 disabled:translate-y-0 disabled:cursor-not-allowed text-white shadow-sm"
                      style={{ background: BLUE }}
                    >
                      {downloading === 'pdf' ? <Loader2 size={11} className="animate-spin" /> : <FileDown size={11} />}
                      PDF
                    </button>
                    {isMulti && results.filter(r => r.dataUrl).length > 1 && (
                      <div className="relative">
                        <button
                          onClick={() => setZipMenuOpen(o => !o)}
                          disabled={downloading !== null}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-jetbrains text-xs font-semibold transition-all hover:translate-y-[-1px] disabled:opacity-40 text-white shadow-sm"
                          style={{ background: '#0F172A' }}
                          title={`Exporter les ${results.filter(r => r.dataUrl).length} codes générés`}
                        >
                          {downloading?.startsWith('zip') || downloading === 'pdf-multi'
                            ? <Loader2 size={11} className="animate-spin" />
                            : <FileArchive size={11} />}
                          TOUS ({results.filter(r => r.dataUrl).length})
                          <ChevronDown size={10} />
                        </button>
                        {zipMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setZipMenuOpen(false)} />
                            <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden min-w-[220px]">
                              <button
                                onClick={downloadZipPng}
                                disabled={!zipAvailable}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors font-jetbrains text-xs text-slate-700 disabled:opacity-40 disabled:hover:bg-transparent"
                                title={!zipAvailable ? 'Module ZIP non chargé' : ''}
                              >
                                <div className="font-semibold">ZIP · PNG</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">Un fichier .png par code</div>
                              </button>
                              <button
                                onClick={downloadZipSvg}
                                disabled={!zipAvailable || !results.some(r => r.svg)}
                                className="w-full text-left px-3 py-2 border-t border-slate-100 hover:bg-slate-50 transition-colors font-jetbrains text-xs text-slate-700 disabled:opacity-40 disabled:hover:bg-transparent"
                                title={!zipAvailable ? 'Module ZIP non chargé' : ''}
                              >
                                <div className="font-semibold">ZIP · SVG</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">Vectoriel · qualité illimitée</div>
                              </button>
                              <button
                                onClick={downloadPdfMulti}
                                disabled={!pdfAvailable}
                                className="w-full text-left px-3 py-2 border-t border-slate-100 hover:bg-slate-50 transition-colors font-jetbrains text-xs text-slate-700 disabled:opacity-40 disabled:hover:bg-transparent"
                                title={!pdfAvailable ? 'Module PDF non chargé' : ''}
                              >
                                <div className="font-semibold">PDF · multi-pages</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">1 code par page A4, labellisé</div>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div
                className="p-8 md:p-16 flex items-center justify-center"
                style={{
                  minHeight: '440px',
                  background: 'repeating-linear-gradient(45deg, #F8FAFC 0, #F8FAFC 14px, #F1F5F9 14px, #F1F5F9 15px)',
                }}
              >
                {error || libsError ? (
                  <div className="max-w-md text-center">
                    <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                      <AlertCircle size={20} className="text-red-500" />
                    </div>
                    <div className="font-bricolage text-lg mb-2 text-red-600">Erreur</div>
                    <div className="text-sm text-slate-600 font-jetbrains break-words">{error || libsError}</div>
                  </div>
                ) : preview ? (
                  <div className="relative" style={{ filter: 'drop-shadow(0 20px 40px rgba(15,23,42,0.12))' }}>
                    <img
                      src={preview}
                      alt={`Code-barres ${currentType.label}`}
                      className="max-w-full block bg-white"
                      style={{ maxHeight: '380px', imageRendering: 'pixelated' }}
                    />
                  </div>
                ) : (
                  <div className="text-center max-w-sm">
                    <div className="w-14 h-14 rounded-xl mx-auto mb-5 flex items-center justify-center" style={{ background: BLUE_LIGHT, border: '1px solid #BFDBFE' }}>
                      <Barcode size={22} style={{ color: BLUE }} strokeWidth={1.75} />
                    </div>
                    <div className="font-bricolage text-xl mb-2 text-slate-800">
                      {libsReady ? 'Préparation de l\'aperçu…' : 'Chargement…'}
                    </div>
                    <div className="text-sm text-slate-500 leading-relaxed">
                      Modifiez les données ou les options pour générer un nouveau code-barres en temps réel.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Info card */}
            <div className="rounded-xl border border-slate-200 p-5 bg-white">
              <div className="flex items-baseline justify-between mb-3">
                <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider">À PROPOS DE</div>
                <div className="font-bricolage font-semibold text-sm" style={{ color: BLUE }}>{currentType.label}</div>
              </div>
              <div className="text-sm text-slate-600 leading-relaxed">
                {currentType.desc}
              </div>
            </div>

            {/* SVG tip */}
            <div className="rounded-xl border border-blue-200 p-4 flex items-start gap-3" style={{ background: BLUE_LIGHT }}>
              <div className="text-xs text-blue-900 leading-relaxed">
                <div className="font-jetbrains font-semibold mb-1" style={{ color: BLUE }}>💡 Astuce impression</div>
                <div className="text-blue-800">
                  Utilisez l'export <span className="font-jetbrains font-medium">SVG</span> (vectoriel) pour une qualité d'impression parfaite à n'importe quelle taille. Le PNG est rastérisé à la taille générée.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CALCULATEUR DE PALETTISATION (Outil 03)
// ============================================================
const PALLET_PRESETS = [
  { id: 'eur',  label: 'EUR / EPAL', length: 120, width: 80,  height: 14.4, desc: 'Europe — standard' },
  { id: 'eur2', label: 'EUR2',       length: 120, width: 100, height: 14.4, desc: 'Europe — industriel' },
  { id: 'us',   label: 'GMA / US',   length: 122, width: 102, height: 14.4, desc: 'Amérique du Nord (48×40 in)' },
  { id: 'asia', label: 'ISO Asie',   length: 110, width: 110, height: 14.4, desc: 'Asie / Pacifique' },
  { id: 'eur6', label: 'EUR6',       length: 80,  width: 60,  height: 14.4, desc: 'Demi-palette' },
  { id: 'custom', label: 'Personnalisée', length: 0, width: 0, height: 14.4, desc: 'Dimensions sur mesure' },
];

function calculatePalletization({ pallet, carton, maxHeight, maxWeight }) {
  const palL = pallet.length, palW = pallet.width, palH = pallet.height;
  const carL = carton.length, carW = carton.width, carH = carton.height, carWt = carton.weight;

  if (palL <= 0 || palW <= 0 || carL <= 0 || carW <= 0 || carH <= 0) {
    return { valid: false, reason: 'Dimensions invalides' };
  }
  if (carL > Math.max(palL, palW) || carW > Math.max(palL, palW)) {
    return { valid: false, reason: 'Le carton est plus grand que la palette' };
  }

  // Tester les 2 orientations à plat
  const orientations = [
    { l: carL, w: carW, key: 'lw' }, // L parallèle à L palette
    { l: carW, w: carL, key: 'wl' }, // L perpendiculaire
  ];

  let best = { perLayer: 0 };
  for (const o of orientations) {
    const nx = Math.floor(palL / o.l);
    const ny = Math.floor(palW / o.w);
    const perLayer = nx * ny;
    if (perLayer > best.perLayer) {
      best = { perLayer, nx, ny, cartonL: o.l, cartonW: o.w, key: o.key };
    }
  }

  if (best.perLayer === 0) {
    return { valid: false, reason: 'Aucun carton ne tient sur la palette' };
  }

  const availableHeight = Math.max(0, maxHeight - palH);
  const maxLayersByHeight = Math.floor(availableHeight / carH);
  const weightPerLayer = best.perLayer * carWt;
  const maxLayersByWeight = weightPerLayer > 0
    ? Math.floor(maxWeight / weightPerLayer)
    : 999;

  const layers = Math.max(0, Math.min(maxLayersByHeight, maxLayersByWeight));
  const totalCartons = best.perLayer * layers;
  const totalWeight = totalCartons * carWt;
  const totalHeight = palH + layers * carH;

  const cartonVol = carL * carW * carH;
  const usedVol = totalCartons * cartonVol;
  const availableVolume = palL * palW * (layers * carH);
  const fillRate = availableVolume > 0 ? usedVol / availableVolume : 0;

  const usedAreaPerLayer = best.perLayer * best.cartonL * best.cartonW;
  const surfaceFillRate = (palL * palW) > 0 ? usedAreaPerLayer / (palL * palW) : 0;

  const limiter = maxLayersByHeight <= maxLayersByWeight ? 'height' : 'weight';

  return {
    valid: true,
    perLayer: best.perLayer,
    layout: { nx: best.nx, ny: best.ny, cartonL: best.cartonL, cartonW: best.cartonW, key: best.key },
    layers,
    totalCartons,
    totalWeight,
    totalHeight,
    fillRate,
    surfaceFillRate,
    limiter,
    maxLayersByHeight,
    maxLayersByWeight,
    weightRemaining: Math.max(0, maxWeight - totalWeight),
  };
}

// Projection isométrique
const ISO_COS = Math.cos(Math.PI / 6); // ~0.866
const ISO_SIN = Math.sin(Math.PI / 6); // 0.5
function iso(x, y, z) {
  return {
    x: (x - y) * ISO_COS,
    y: (x + y) * ISO_SIN - z,
  };
}

function PalletDiagram({ pallet, carton, result }) {
  if (!result.valid) {
    return (
      <div className="flex items-center justify-center min-h-[460px]">
        <div className="max-w-md text-center">
          <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
            <AlertCircle size={20} className="text-red-500" />
          </div>
          <div className="font-bricolage text-lg mb-2 text-red-600">Calcul impossible</div>
          <div className="text-sm text-slate-600 font-jetbrains">{result.reason}</div>
        </div>
      </div>
    );
  }

  const { layout, layers } = result;
  const palL = pallet.length, palW = pallet.width, palH = pallet.height;
  const carH = carton.height;
  const totalH = palH + layers * carH;

  // Bounding box en coordonnées iso
  const corners = [
    iso(0, 0, 0), iso(palL, 0, 0), iso(palL, palW, 0), iso(0, palW, 0),
    iso(0, 0, totalH), iso(palL, 0, totalH), iso(palL, palW, totalH), iso(0, palW, totalH),
  ];
  const minX = Math.min(...corners.map(p => p.x));
  const maxX = Math.max(...corners.map(p => p.x));
  const minY = Math.min(...corners.map(p => p.y));
  const maxY = Math.max(...corners.map(p => p.y));

  const padding = 25;
  const naturalW = maxX - minX;
  const naturalH = maxY - minY;
  const scale = Math.min(560 / naturalW, 460 / naturalH); // taille cible
  const viewW = naturalW * scale + padding * 2;
  const viewH = naturalH * scale + padding * 2;

  // Transformation finale en coordonnées SVG
  const t = (p) => ({
    x: (p.x - minX) * scale + padding,
    y: (p.y - minY) * scale + padding,
  });

  // Couleurs
  const PALLET_COLORS = { top: '#D9B279', front: '#B58A52', side: '#8E6738', stroke: '#5A4220' };
  const CARTON_COLORS_A = { top: '#E8D2A8', front: '#C9A876', side: '#9A7E4E', stroke: '#6B502B' };
  const CARTON_COLORS_B = { top: '#DCC597', front: '#B89A66', side: '#8B7044', stroke: '#5C4321' };

  // Helper : dessiner une boîte 3D iso (3 faces visibles)
  const drawBox = (x, y, z, w, d, h, c, key) => {
    // 8 sommets
    const v = {
      A: t(iso(x, y, z)),         // bas arrière-gauche
      B: t(iso(x + w, y, z)),     // bas arrière-droit
      C: t(iso(x + w, y + d, z)), // bas avant-droit
      D: t(iso(x, y + d, z)),     // bas avant-gauche
      E: t(iso(x, y, z + h)),     // haut arrière-gauche
      F: t(iso(x + w, y, z + h)), // haut arrière-droit
      G: t(iso(x + w, y + d, z + h)), // haut avant-droit
      H: t(iso(x, y + d, z + h)), // haut avant-gauche
    };
    return (
      <g key={key}>
        {/* Face droite (x+w) — c'est le côté qui regarde vers droite-arrière en iso */}
        <polygon
          points={`${v.B.x},${v.B.y} ${v.C.x},${v.C.y} ${v.G.x},${v.G.y} ${v.F.x},${v.F.y}`}
          fill={c.side} stroke={c.stroke} strokeWidth="0.8"
        />
        {/* Face avant (y+d) */}
        <polygon
          points={`${v.D.x},${v.D.y} ${v.C.x},${v.C.y} ${v.G.x},${v.G.y} ${v.H.x},${v.H.y}`}
          fill={c.front} stroke={c.stroke} strokeWidth="0.8"
        />
        {/* Face dessus */}
        <polygon
          points={`${v.E.x},${v.E.y} ${v.F.x},${v.F.y} ${v.G.x},${v.G.y} ${v.H.x},${v.H.y}`}
          fill={c.top} stroke={c.stroke} strokeWidth="0.8"
        />
      </g>
    );
  };

  const elements = [];

  // 1. Palette
  elements.push(drawBox(0, 0, 0, palL, palW, palH, PALLET_COLORS, 'pallet'));

  // 2. Cartons : du bas vers le haut, et à l'intérieur de chaque couche
  //    on dessine de l'arrière (y max) vers l'avant (y=0) et de gauche à droite
  for (let layer = 0; layer < layers; layer++) {
    const z = palH + layer * carH;
    const c = layer % 2 === 0 ? CARTON_COLORS_A : CARTON_COLORS_B;
    for (let row = layout.ny - 1; row >= 0; row--) {
      for (let col = 0; col < layout.nx; col++) {
        const x = col * layout.cartonL;
        const y = row * layout.cartonW;
        elements.push(drawBox(x, y, z, layout.cartonL, layout.cartonW, carH, c, `c-${layer}-${row}-${col}`));
      }
    }
  }

  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} className="w-full h-auto" style={{ maxHeight: '500px' }} preserveAspectRatio="xMidYMid meet">
      {elements}
    </svg>
  );
}

function PalletCalculator({ onBack }) {
  const [palletPresetId, setPalletPresetId] = useState('eur');
  const [customPallet, setCustomPallet] = useState({ length: 120, width: 80, height: 14.4 });
  const [carton, setCarton] = useState({ length: 40, width: 30, height: 25, weight: 5 });
  const [maxHeight, setMaxHeight] = useState(180);
  const [maxWeight, setMaxWeight] = useState(1000);

  const pallet = useMemo(() => {
    if (palletPresetId === 'custom') return customPallet;
    return PALLET_PRESETS.find(p => p.id === palletPresetId);
  }, [palletPresetId, customPallet]);

  const result = useMemo(
    () => calculatePalletization({ pallet, carton, maxHeight, maxWeight }),
    [pallet, carton, maxHeight, maxWeight]
  );

  const updateCarton = (key, val) => setCarton(c => ({ ...c, [key]: Math.max(0, parseFloat(val) || 0) }));
  const updateCustomPallet = (key, val) => setCustomPallet(p => ({ ...p, [key]: Math.max(0, parseFloat(val) || 0) }));

  return (
    <div className="min-h-screen text-slate-900" style={{ background: '#F8FAFC', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <FontsAndStyles />

      <nav className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-jetbrains text-xs">
              <ArrowLeft size={14} />
              RETOUR
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-3">
              <Logo small />
              <div>
                <div className="font-bricolage font-semibold text-sm leading-tight text-slate-900">Calculateur de palettisation</div>
                <div className="font-jetbrains text-[10px] text-slate-500">ATELIER / 03</div>
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 font-jetbrains text-[10px] text-slate-500 tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} />
            CALCUL EN TEMPS RÉEL
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* LEFT : Inputs */}
          <div className="lg:col-span-2 space-y-4">

            {/* Pallet */}
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600">
                PALETTE
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-1.5">
                  {PALLET_PRESETS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPalletPresetId(p.id)}
                      className="px-2.5 py-2 rounded-md text-xs font-jetbrains transition-all text-left"
                      style={palletPresetId === p.id
                        ? { background: BLUE, color: '#FFFFFF', fontWeight: 600 }
                        : { background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}
                    >
                      <div>{p.label}</div>
                      <div className="text-[9px] opacity-80 mt-0.5">
                        {p.id === 'custom' ? p.desc : `${p.length}×${p.width}`}
                      </div>
                    </button>
                  ))}
                </div>
                {palletPresetId === 'custom' && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                    <NumberField label="Long. (cm)" value={customPallet.length} onChange={v => updateCustomPallet('length', v)} />
                    <NumberField label="Larg. (cm)" value={customPallet.width} onChange={v => updateCustomPallet('width', v)} />
                    <NumberField label="Haut. (cm)" value={customPallet.height} onChange={v => updateCustomPallet('height', v)} step="0.1" />
                  </div>
                )}
              </div>
            </div>

            {/* Carton */}
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600">
                CARTON
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <NumberField label="Longueur (cm)" value={carton.length} onChange={v => updateCarton('length', v)} />
                <NumberField label="Largeur (cm)" value={carton.width} onChange={v => updateCarton('width', v)} />
                <NumberField label="Hauteur (cm)" value={carton.height} onChange={v => updateCarton('height', v)} />
                <NumberField label="Poids (kg)" value={carton.weight} onChange={v => updateCarton('weight', v)} step="0.1" />
              </div>
            </div>

            {/* Contraintes */}
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600">
                CONTRAINTES DE TRANSPORT
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <NumberField label="Hauteur max gerbage (cm)" value={maxHeight} onChange={v => setMaxHeight(Math.max(0, parseFloat(v) || 0))} />
                <NumberField label="Charge max palette (kg)" value={maxWeight} onChange={v => setMaxWeight(Math.max(0, parseFloat(v) || 0))} />
              </div>
            </div>

            {/* Récap rapide */}
            {result.valid && (
              <div className="rounded-xl border p-4 bg-white" style={{ borderColor: BLUE, background: BLUE_LIGHT }}>
                <div className="font-jetbrains text-[10px] tracking-wider mb-1" style={{ color: BLUE }}>RÉSULTAT</div>
                <div className="font-bricolage text-3xl font-bold mb-1" style={{ color: BLUE }}>
                  {result.totalCartons} cartons
                </div>
                <div className="font-jetbrains text-xs text-slate-700">
                  {result.perLayer} par couche · {result.layers} couches
                </div>
              </div>
            )}
          </div>

          {/* RIGHT : Diagram + Stats */}
          <div className="lg:col-span-3 space-y-4">

            {/* 3D Diagram */}
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 font-jetbrains text-xs text-slate-600 flex-wrap">
                  <Box size={13} />
                  VUE ISOMÉTRIQUE
                  {result.valid && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span style={{ color: BLUE }} className="font-medium">{pallet.length}×{pallet.width} cm</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500">H {Math.round(result.totalHeight)} cm</span>
                    </>
                  )}
                </div>
              </div>
              <div className="p-6 md:p-8 flex items-center justify-center" style={{
                minHeight: '500px',
                background: 'repeating-linear-gradient(45deg, #F8FAFC 0, #F8FAFC 14px, #F1F5F9 14px, #F1F5F9 15px)',
              }}>
                <PalletDiagram pallet={pallet} carton={carton} result={result} />
              </div>
            </div>

            {/* Stats */}
            {result.valid && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Par couche" value={result.perLayer} sub={`${result.layout.nx} × ${result.layout.ny}`} />
                <StatCard label="Couches" value={result.layers} sub={`${result.totalCartons} cartons`} />
                <StatCard
                  label="Poids total"
                  value={`${result.totalWeight.toFixed(1)} kg`}
                  sub={`reste ${result.weightRemaining.toFixed(0)} kg`}
                />
                <StatCard
                  label="Remplissage"
                  value={`${Math.round(result.surfaceFillRate * 100)}%`}
                  sub="surface palette"
                />
              </div>
            )}

            {/* Détails techniques */}
            {result.valid && (
              <div className="rounded-xl border border-slate-200 p-5 bg-white">
                <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-3">DÉTAILS TECHNIQUES</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <DetailRow label="Orientation carton" value={result.layout.key === 'lw' ? 'L parallèle à la palette' : 'L perpendiculaire à la palette'} />
                  <DetailRow label="Cartons par couche" value={`${result.perLayer} (${result.layout.nx} × ${result.layout.ny})`} />
                  <DetailRow label="Hauteur empilée" value={`${result.totalHeight.toFixed(1)} cm`} />
                  <DetailRow label="Volume utilisé" value={`${(result.totalCartons * carton.length * carton.width * carton.height / 1e6).toFixed(3)} m³`} />
                  <DetailRow label="Charge totale" value={`${result.totalWeight.toFixed(1)} kg / ${maxWeight} kg`} />
                  <DetailRow label="Taux volumique" value={`${Math.round(result.fillRate * 100)}%`} />
                </div>

                {/* Indicateur de facteur limitant */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-start gap-2 text-xs">
                  <div className="font-jetbrains font-medium text-slate-700">FACTEUR LIMITANT</div>
                  <div className="flex-1">
                    {result.limiter === 'height' ? (
                      <span className="text-slate-600">
                        Limité par la <span className="font-medium" style={{ color: BLUE }}>hauteur de gerbage</span> ({result.maxLayersByHeight} couches max).
                        {result.weightRemaining > carton.weight * result.perLayer && ' Le poids permet encore une couche supplémentaire.'}
                      </span>
                    ) : (
                      <span className="text-slate-600">
                        Limité par la <span className="font-medium" style={{ color: BLUE }}>charge max</span> ({result.maxLayersByWeight} couches max).
                        Réduisez le poids du carton ou augmentez la charge admissible pour empiler plus.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, step = '1' }) {
  return (
    <div>
      <label className="font-jetbrains text-[10px] text-slate-500 tracking-wider block mb-1.5">{label}</label>
      <input
        type="number"
        value={value}
        min="0"
        step={step}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md outline-none font-jetbrains text-sm text-slate-800 focus:border-slate-400 transition-colors"
      />
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 bg-white">
      <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-2">{label}</div>
      <div className="font-bricolage font-bold text-2xl text-slate-900">{value}</div>
      {sub && <div className="font-jetbrains text-[10px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className="font-jetbrains text-xs font-medium text-slate-800 text-right">{value}</span>
    </div>
  );
}

// ============================================================
// CALCULATEUR DE STOCK DE SÉCURITÉ (Outil 04)
// ============================================================

// Fonction quantile inverse de la loi normale standard (Φ⁻¹)
// Approximation d'Acklam — précision ~1e-9, suffit pour le SS
function invNormalCDF(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e+1, 2.209460984245205e+2, -2.759285104469687e+2, 1.383577518672690e+2, -3.066479806614716e+1, 2.506628277459239];
  const b = [-5.447609879822406e+1, 1.615858368580409e+2, -1.556989798598866e+2, 6.680131188771972e+1, -1.328068155288572e+1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q, r;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  if (p <= pHigh) {
    q = p - 0.5; r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5]) * q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
}

// Densité de la loi normale standard
function normalPDF(x) {
  return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
}

function computeSafetyStock({ demandMean, demandStd, leadTimeMean, leadTimeStd, serviceLevel }) {
  if (demandMean <= 0 || leadTimeMean <= 0) {
    return { valid: false, reason: 'Demande et délai doivent être > 0' };
  }
  // p clampé pour éviter z infini
  const p = Math.max(0.5, Math.min(0.9999, serviceLevel / 100));
  const z = invNormalCDF(p);

  // μL = D × L
  const muL = demandMean * leadTimeMean;
  // σL = √(L × σD² + D² × σL_time²)
  const sigmaL = Math.sqrt(leadTimeMean * demandStd ** 2 + demandMean ** 2 * leadTimeStd ** 2);
  const ss = z * sigmaL;
  const rop = muL + ss;
  const coverageDays = demandMean > 0 ? ss / demandMean : 0;

  return { valid: true, z, muL, sigmaL, ss, rop, coverageDays, serviceLevel: p * 100 };
}

const SERVICE_PRESETS = [
  { value: 80, label: '80%', desc: 'basique' },
  { value: 90, label: '90%', desc: 'standard' },
  { value: 95, label: '95%', desc: 'recommandé' },
  { value: 97.5, label: '97.5%', desc: 'élevé' },
  { value: 99, label: '99%', desc: 'critique' },
  { value: 99.5, label: '99.5%', desc: 'très critique' },
];

function NormalDistChart({ muL, sigmaL, z, ss, rop, serviceLevel }) {
  const W = 720, H = 320;
  const margin = { top: 36, right: 30, bottom: 50, left: 50 };
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top - margin.bottom;

  if (sigmaL <= 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <text x={W/2} y={H/2} textAnchor="middle" fontSize="13" fill="#94A3B8" fontFamily="JetBrains Mono">
          Variabilité nulle → pas besoin de stock de sécurité
        </text>
      </svg>
    );
  }

  // Domaine : on s'étend pour bien voir le ROP même à 99.99%
  const xMin = Math.max(0, muL - 4 * sigmaL);
  const xMax = Math.max(muL + 4 * sigmaL, rop + 0.5 * sigmaL);

  const xToPx = (x) => margin.left + ((x - xMin) / (xMax - xMin)) * innerW;
  const N = 180;
  const pts = [];
  let maxY = 0;
  for (let i = 0; i <= N; i++) {
    const x = xMin + (xMax - xMin) * i / N;
    const std = (x - muL) / sigmaL;
    const y = normalPDF(std) / sigmaL;
    pts.push({ x, y });
    if (y > maxY) maxY = y;
  }
  const yToPx = (y) => margin.top + innerH - (y / maxY) * innerH;

  const baselineY = margin.top + innerH;
  const curvePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xToPx(p.x)},${yToPx(p.y)}`).join(' ');

  // Aire à gauche du ROP = taux de service visualisé
  const slPts = pts.filter(p => p.x <= rop);
  const slPath = slPts.length > 1
    ? `M ${xToPx(slPts[0].x)},${baselineY} ` + slPts.map(p => `L ${xToPx(p.x)},${yToPx(p.y)}`).join(' ') + ` L ${xToPx(rop)},${baselineY} Z`
    : '';

  // Aire entre μL et ROP = stock de sécurité
  const ssPts = pts.filter(p => p.x >= muL && p.x <= rop);
  const ssPath = ssPts.length > 1
    ? `M ${xToPx(muL)},${baselineY} ` + ssPts.map(p => `L ${xToPx(p.x)},${yToPx(p.y)}`).join(' ') + ` L ${xToPx(rop)},${baselineY} Z`
    : '';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* Grille horizontale légère */}
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} x1={margin.left} y1={margin.top + innerH * f} x2={margin.left + innerW} y2={margin.top + innerH * f} stroke="#F1F5F9" strokeWidth="1" />
      ))}

      {/* Aire taux de service */}
      <path d={slPath} fill={BLUE_LIGHT} opacity="0.7" />
      {/* Aire stock de sécurité */}
      <path d={ssPath} fill={BLUE} opacity="0.28" />
      {/* Courbe */}
      <path d={curvePath} stroke={BLUE} strokeWidth="2" fill="none" />

      {/* Axe horizontal */}
      <line x1={margin.left} y1={baselineY} x2={margin.left + innerW} y2={baselineY} stroke="#94A3B8" strokeWidth="1" />

      {/* μL */}
      <line x1={xToPx(muL)} y1={margin.top} x2={xToPx(muL)} y2={baselineY} stroke="#94A3B8" strokeWidth="1" strokeDasharray="3 3" />
      <text x={xToPx(muL)} y={margin.top - 8} textAnchor="middle" fontSize="11" fill="#64748B" fontFamily="JetBrains Mono">
        μL = {Math.round(muL)}
      </text>

      {/* ROP */}
      <line x1={xToPx(rop)} y1={margin.top} x2={xToPx(rop)} y2={baselineY} stroke={BLUE} strokeWidth="2" />
      <text x={xToPx(rop)} y={margin.top - 8} textAnchor="middle" fontSize="11" fill={BLUE} fontFamily="JetBrains Mono" fontWeight="600">
        ROP = {Math.round(rop)}
      </text>

      {/* Flèche SS entre μL et ROP */}
      {ss > 0 && (
        <>
          <line x1={xToPx(muL) + 2} y1={baselineY + 16} x2={xToPx(rop) - 2} y2={baselineY + 16} stroke={BLUE} strokeWidth="1.5" />
          <polygon points={`${xToPx(muL)+2},${baselineY+16} ${xToPx(muL)+8},${baselineY+13} ${xToPx(muL)+8},${baselineY+19}`} fill={BLUE} />
          <polygon points={`${xToPx(rop)-2},${baselineY+16} ${xToPx(rop)-8},${baselineY+13} ${xToPx(rop)-8},${baselineY+19}`} fill={BLUE} />
          <text x={(xToPx(muL) + xToPx(rop)) / 2} y={baselineY + 34} textAnchor="middle" fontSize="11" fill={BLUE} fontFamily="JetBrains Mono" fontWeight="600">
            SS = {Math.round(ss)}
          </text>
        </>
      )}

      {/* Légende */}
      <g transform={`translate(${margin.left}, ${H - 12})`}>
        <rect width="10" height="10" fill={BLUE_LIGHT} opacity="0.7" />
        <text x="14" y="9" fontSize="10" fill="#64748B" fontFamily="JetBrains Mono">Taux de service {serviceLevel.toFixed(1)}%</text>
        <rect x="170" width="10" height="10" fill={BLUE} opacity="0.28" />
        <text x="184" y="9" fontSize="10" fill="#64748B" fontFamily="JetBrains Mono">Stock de sécurité</text>
      </g>
    </svg>
  );
}

// ============================================================
// SAFETY STOCK · helpers communs aux modes single & batch
// ============================================================
const COLUMN_ALIASES = {
  ref:   ['ref', 'reference', 'référence', 'sku', 'code', 'article', 'item'],
  label: ['libelle', 'libellé', 'nom', 'description', 'designation', 'désignation', 'name'],
  D:     ['d', 'demande', 'demande moyenne', 'demande moy', 'demande/jour', 'demande / jour', 'demande moyenne / jour', 'demande moyenne jour', 'demande par jour', 'demand', 'mean demand'],
  sD:    ['sd', 'σd', 'sigma d', 'ecart-type demande', 'écart-type demande', 'std demande', 'std', 'sigma demand', 'variabilité demande', 'variabilite demande', 'variabilité demande (écart-type)'],
  L:     ['l', 'lead time', 'délai', 'delai', 'lt', 'leadtime', 'délai approvisionnement', 'délai approvisionnement (jours)', 'délai (jours)'],
  sL:    ['sl', 'σl', 'sigma l', 'ecart-type lt', 'écart-type lt', 'std lt', 'écart-type délai', 'sigma lead time', 'variabilité délai', 'variabilité délai (écart-type)', 'variabilite delai'],
  sl:    ['taux de service', 'taux de service cible', 'taux de service cible (%)', 'service level', 'service', 'taux de service %', 'taux service', 'sl%', 'taux de service (%)'],
};

// Aliases pour fichier d'historique de ventes
const SALES_COLUMN_ALIASES = {
  ref:   ['ref', 'reference', 'référence', 'sku', 'code', 'article', 'item'],
  label: ['libelle', 'libellé', 'nom', 'description', 'designation', 'désignation', 'name'],
  store: ['magasin', 'agence', 'entrepôt', 'entrepot', 'store', 'location', 'site', 'depot', 'dépôt', 'warehouse'],
  L:     ['lead time', 'délai', 'delai', 'lt', 'leadtime', 'délai approvisionnement', 'délai appro', 'délai d approvisionnement'],
  qty:   ['qte', 'qté', 'qty', 'quantite', 'quantité', 'qte vendu', 'qté vendue', 'quantity', 'sold', 'vendu', 'qte vendue', 'qty sold'],
  date:  ['date', 'jour', 'day', 'date vente', 'date_vente'],
};

const normalizeKey = (k) => String(k || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

function findField(row, aliases) {
  const normAliases = aliases.map(normalizeKey).filter(Boolean);
  const wanted = new Set(normAliases);
  // Phase 1 : match strictement égal (rapide, priorité)
  for (const key of Object.keys(row)) {
    if (wanted.has(normalizeKey(key))) return row[key];
  }
  // Phase 2 : match par sous-chaîne sur les alias longs (≥ 4 caractères, évite les faux positifs)
  // Permet de matcher "Prix Moyen Pondéré (MAD)" avec l'alias "prix moyen pondéré"
  const longAliases = normAliases.filter(a => a.length >= 4);
  if (longAliases.length === 0) return undefined;
  for (const key of Object.keys(row)) {
    const nk = normalizeKey(key);
    for (const alias of longAliases) {
      if (nk.includes(alias)) return row[key];
    }
  }
  return undefined;
}

function mapImportedRow(raw, idx) {
  const refRaw = findField(raw, COLUMN_ALIASES.ref);
  const labelRaw = findField(raw, COLUMN_ALIASES.label);
  return {
    id: `imp-${Date.now()}-${idx}`,
    ref: refRaw != null ? String(refRaw) : `A${String(idx + 1).padStart(3, '0')}`,
    label: labelRaw != null ? String(labelRaw) : '',
    D:  parseFloat(findField(raw, COLUMN_ALIASES.D))  || 0,
    sD: parseFloat(findField(raw, COLUMN_ALIASES.sD)) || 0,
    L:  parseFloat(findField(raw, COLUMN_ALIASES.L))  || 0,
    sL: parseFloat(findField(raw, COLUMN_ALIASES.sL)) || 0,
    sl: parseFloat(findField(raw, COLUMN_ALIASES.sl)) || 95,
  };
}

// Parser robuste pour les dates (Excel serial, ISO, FR, etc.)
function parseDate(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    // Excel serial date (jours depuis 1900-01-01 avec bug année bissextile)
    const ms = Math.round((val - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    const s = val.trim();
    // Format ISO YYYY-MM-DD ou YYYY-MM-DDTHH...
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
    }
    // Format FR DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
    const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
    if (m) {
      let year = parseInt(m[3]);
      if (year < 100) year = 2000 + year;
      const d = new Date(year, parseInt(m[2]) - 1, parseInt(m[1]));
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// Détecte si le fichier importé est paramètres ou historique
function detectFileType(json) {
  if (json.length === 0) return 'unknown';
  const firstRow = json[0];
  const hasDate = findField(firstRow, SALES_COLUMN_ALIASES.date) !== undefined;
  const hasQty = findField(firstRow, SALES_COLUMN_ALIASES.qty) !== undefined;
  return (hasDate && hasQty) ? 'sales' : 'parameters';
}

// Agrégation historique : pour chaque (ref, magasin), calcule D, σD, fiabilité
function aggregateSalesHistory(json, aggregation = 'daily') {
  // 1. Parsing et validation
  const valid = [];
  let errorCount = 0;
  for (const raw of json) {
    const ref = String(findField(raw, SALES_COLUMN_ALIASES.ref) || '').trim();
    const label = String(findField(raw, SALES_COLUMN_ALIASES.label) || '').trim();
    const store = String(findField(raw, SALES_COLUMN_ALIASES.store) || '').trim();
    const L = parseFloat(findField(raw, SALES_COLUMN_ALIASES.L));
    const qty = parseFloat(findField(raw, SALES_COLUMN_ALIASES.qty));
    const date = parseDate(findField(raw, SALES_COLUMN_ALIASES.date));

    if (!ref || !date || isNaN(qty)) {
      errorCount++;
      continue;
    }
    valid.push({ ref, label, store: store || '—', L: isNaN(L) ? 0 : L, qty, date });
  }

  if (valid.length === 0) {
    throw new Error('Aucune ligne valide après parsing (vérifiez les colonnes Référence, Date, Quantité)');
  }

  // 2. Regroupement par (ref, magasin)
  const groups = {};
  for (const row of valid) {
    const key = `${row.ref}|${row.store}`;
    if (!groups[key]) {
      groups[key] = { ref: row.ref, label: row.label, store: row.store, L: row.L, sales: [] };
    }
    groups[key].sales.push({ date: row.date, qty: row.qty });
    // Le dernier L non-nul gagne (au cas où le fichier serait incohérent)
    if (row.L > 0) groups[key].L = row.L;
    if (row.label && !groups[key].label) groups[key].label = row.label;
  }

  // 3. Pour chaque groupe : calcul D, σD, fiabilité
  const binSize = aggregation === 'weekly' ? 7 * 86400000 : 86400000;
  const results = [];
  let idx = 0;
  for (const key in groups) {
    const g = groups[key];
    const times = g.sales.map(s => s.date.getTime());
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const minBin = Math.floor(minT / binSize);
    const maxBin = Math.floor(maxT / binSize);
    const totalBins = maxBin - minBin + 1;

    const binnedQty = new Array(totalBins).fill(0);
    for (const s of g.sales) {
      const bin = Math.floor(s.date.getTime() / binSize) - minBin;
      binnedQty[bin] += s.qty;
    }

    const totalQty = binnedQty.reduce((a, b) => a + b, 0);
    const activeBins = binnedQty.filter(q => q > 0).length;
    const D = totalBins > 0 ? totalQty / totalBins : 0;
    // Écart-type d'échantillon (N-1)
    const variance = totalBins > 1
      ? binnedQty.reduce((acc, q) => acc + (q - D) ** 2, 0) / (totalBins - 1)
      : 0;
    const sD = Math.sqrt(variance);

    let reliability = 'low';
    if (totalBins >= 90) reliability = 'high';
    else if (totalBins >= 30) reliability = 'medium';

    results.push({
      id: `sales-${Date.now()}-${idx++}`,
      ref: g.ref,
      label: g.label,
      store: g.store,
      L: g.L,
      sL: 0,   // sera écrasé par paramètre global
      sl: 95,  // sera écrasé par paramètre global
      D: Number(D.toFixed(2)),
      sD: Number(sD.toFixed(2)),
      // métadonnées historique
      activeBins,
      totalBins,
      reliability,
      periodStart: new Date(minT),
      periodEnd: new Date(maxT),
    });
  }

  // Tri : par référence puis magasin
  results.sort((a, b) => a.ref.localeCompare(b.ref) || a.store.localeCompare(b.store));

  return { rows: results, errorCount, validLines: valid.length };
}

const TEMPLATE_ROWS = [
  { 'Référence': 'A001', 'Libellé': 'Article exemple 1', 'Demande moyenne / jour': 100, 'Variabilité demande (écart-type)': 20, 'Délai approvisionnement (jours)': 5, 'Variabilité délai (écart-type)': 1, 'Taux de service cible (%)': 95 },
  { 'Référence': 'A002', 'Libellé': 'Article exemple 2', 'Demande moyenne / jour': 50,  'Variabilité demande (écart-type)': 10, 'Délai approvisionnement (jours)': 7, 'Variabilité délai (écart-type)': 2, 'Taux de service cible (%)': 99 },
  { 'Référence': 'A003', 'Libellé': 'Article exemple 3', 'Demande moyenne / jour': 200, 'Variabilité demande (écart-type)': 30, 'Délai approvisionnement (jours)': 3, 'Variabilité délai (écart-type)': 0.5, 'Taux de service cible (%)': 90 },
];

// Génère un template historique de ventes (90 jours, 2 articles × 2 magasins)
function generateSalesTemplate() {
  const today = new Date();
  const articles = [
    { ref: 'A001', label: 'Article exemple 1', L: 5, baseMean: 12, variance: 4 },
    { ref: 'A002', label: 'Article exemple 2', L: 7, baseMean: 8, variance: 3 },
  ];
  const stores = ['Casablanca', 'Rabat'];
  const rows = [];
  const NB_DAYS = 90;
  for (const art of articles) {
    for (const store of stores) {
      for (let d = NB_DAYS - 1; d >= 0; d--) {
        const date = new Date(today);
        date.setDate(date.getDate() - d);
        if (date.getDay() === 0) continue; // pas de vente le dimanche
        const qty = Math.max(0, Math.round(art.baseMean + (Math.random() - 0.5) * art.variance * 2));
        if (qty === 0) continue;
        rows.push({
          'Référence': art.ref,
          'Libellé': art.label,
          'Lead time': art.L,
          'Magasin': store,
          'Qté vendue': qty,
          'Date': date.toISOString().slice(0, 10),
        });
      }
    }
  }
  return rows;
}

const EMPTY_ROW = () => ({
  id: 'row-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
  ref: '', label: '', D: 0, sD: 0, L: 0, sL: 0, sl: 95,
});

// ============================================================
// SafetyStockCalculator (wrapper avec toggle de mode)
// ============================================================
function SafetyStockCalculator({ onBack }) {
  const [mode, setMode] = useState('single');

  // ----- States MODE SINGLE -----
  const [demandMean, setDemandMean] = useState(100);
  const [demandStd, setDemandStd] = useState(20);
  const [leadTimeMean, setLeadTimeMean] = useState(5);
  const [leadTimeStd, setLeadTimeStd] = useState(1);
  const [serviceLevel, setServiceLevel] = useState(95);

  const singleResult = useMemo(
    () => computeSafetyStock({ demandMean, demandStd, leadTimeMean, leadTimeStd, serviceLevel }),
    [demandMean, demandStd, leadTimeMean, leadTimeStd, serviceLevel]
  );

  // ----- States MODE BATCH -----
  const [rows, setRows] = useState([
    { id: 'row-init-1', ref: 'A001', label: 'Article exemple 1', D: 100, sD: 20, L: 5, sL: 1, sl: 95 },
    { id: 'row-init-2', ref: 'A002', label: 'Article exemple 2', D: 50,  sD: 10, L: 7, sL: 2, sl: 99 },
    { id: 'row-init-3', ref: 'A003', label: 'Article exemple 3', D: 200, sD: 30, L: 3, sL: 0.5, sl: 90 },
  ]);
  const [selectedRowId, setSelectedRowId] = useState('row-init-1');
  const [importMsg, setImportMsg] = useState(null);
  const fileInputRef = useRef(null);

  // Mode d'origine des données : 'manual' (params) ou 'sales' (historique agrégé)
  const [dataSource, setDataSource] = useState('manual');
  // Données brutes du fichier d'historique, conservées pour recalcul si on change l'agrégation
  const [rawSalesData, setRawSalesData] = useState(null);

  // Paramètres globaux appliqués en mode 'sales'
  const [globalServiceLevel, setGlobalServiceLevel] = useState(95);
  const [globalLeadTimeStd, setGlobalLeadTimeStd] = useState(0);
  const [aggregation, setAggregation] = useState('daily'); // 'daily' | 'weekly'

  // Si l'agrégation change après un import historique, on ré-agrège
  useEffect(() => {
    if (dataSource === 'sales' && rawSalesData) {
      try {
        const { rows: aggregated } = aggregateSalesHistory(rawSalesData, aggregation);
        setRows(aggregated);
        if (aggregated.length > 0 && !aggregated.find(r => r.id === selectedRowId)) {
          setSelectedRowId(aggregated[0].id);
        }
      } catch (e) { /* silent */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aggregation]);

  // Lignes effectives : en mode sales, on applique les paramètres globaux
  const effectiveRows = useMemo(() => {
    if (dataSource === 'sales') {
      return rows.map(r => ({ ...r, sL: globalLeadTimeStd, sl: globalServiceLevel }));
    }
    return rows;
  }, [rows, dataSource, globalLeadTimeStd, globalServiceLevel]);

  const computedRows = useMemo(() => effectiveRows.map(r => ({
    ...r,
    result: computeSafetyStock({
      demandMean: r.D, demandStd: r.sD,
      leadTimeMean: r.L, leadTimeStd: r.sL,
      serviceLevel: r.sl,
    }),
  })), [effectiveRows]);

  const batchStats = useMemo(() => {
    const valid = computedRows.filter(r => r.result.valid);
    if (valid.length === 0) return { count: 0, totalSS: 0, totalROP: 0, avgCoverage: 0, atRisk: 0, lowReliability: 0 };
    const totalSS = valid.reduce((s, r) => s + r.result.ss, 0);
    const totalROP = valid.reduce((s, r) => s + r.result.rop, 0);
    const avgCoverage = valid.reduce((s, r) => s + r.result.coverageDays, 0) / valid.length;
    const atRisk = valid.filter(r => r.result.coverageDays < 1).length;
    const lowReliability = dataSource === 'sales' ? valid.filter(r => r.reliability === 'low').length : 0;
    return { count: valid.length, totalSS, totalROP, avgCoverage, atRisk, lowReliability };
  }, [computedRows, dataSource]);

  // Actions
  const addRow = () => {
    const r = EMPTY_ROW();
    setRows(rs => [...rs, r]);
    setSelectedRowId(r.id);
  };
  const removeRow = (id) => {
    setRows(rs => rs.filter(r => r.id !== id));
    if (selectedRowId === id) setSelectedRowId(null);
  };
  const updateRow = (id, key, val) => {
    setRows(rs => rs.map(r => {
      if (r.id !== id) return r;
      if (['ref', 'label', 'store'].includes(key)) return { ...r, [key]: val };
      return { ...r, [key]: Math.max(0, parseFloat(val) || 0) };
    }));
  };
  const clearRows = () => {
    if (window.confirm('Vider toutes les lignes ?')) {
      setRows([]);
      setSelectedRowId(null);
      setDataSource('manual');
      setRawSalesData(null);
    }
  };

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error('Fichier vide');
      const sheet = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (json.length === 0) throw new Error('Aucune ligne de données détectée');

      const fileType = detectFileType(json);

      if (fileType === 'sales') {
        const { rows: aggregated, errorCount, validLines } = aggregateSalesHistory(json, aggregation);
        setRawSalesData(json);
        setRows(aggregated);
        setSelectedRowId(aggregated[0]?.id || null);
        setDataSource('sales');
        const skipMsg = errorCount > 0 ? ` · ${errorCount} ligne(s) ignorée(s)` : '';
        setImportMsg({
          type: 'success',
          text: `${aggregated.length} couple(s) Réf×Magasin agrégé(s) depuis ${validLines} ligne(s) de ventes${skipMsg}`
        });
      } else {
        const mapped = json.map(mapImportedRow);
        setRawSalesData(null);
        setRows(mapped);
        setSelectedRowId(mapped[0]?.id || null);
        setDataSource('manual');
        setImportMsg({ type: 'success', text: `${mapped.length} article(s) importé(s) depuis « ${file.name} »` });
      }
      setTimeout(() => setImportMsg(null), 5500);
    } catch (err) {
      setImportMsg({ type: 'error', text: 'Erreur d\'import : ' + err.message });
      setTimeout(() => setImportMsg(null), 6000);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const exportXlsx = () => {
    const data = computedRows.map(r => {
      const base = {
        'Référence': r.ref,
        'Libellé': r.label,
        ...(dataSource === 'sales' ? { 'Magasin': r.store } : {}),
        'Lead time (j)': r.L,
        'Demande moyenne (D)': r.D,
        'Ecart-type demande (σD)': r.sD,
        ...(dataSource === 'sales' ? {
          'Période bins': r.totalBins,
          'Bins actifs': r.activeBins,
          'Fiabilité': r.reliability === 'high' ? 'Élevée' : r.reliability === 'medium' ? 'Moyenne' : 'Faible',
        } : {
          'Ecart-type LT (σL_t)': r.sL,
          'Taux service (%)': r.sl,
        }),
        'z': r.result.valid ? Number(r.result.z.toFixed(3)) : '',
        'μL (demande × délai)': r.result.valid ? Number(r.result.muL.toFixed(1)) : '',
        'σL combiné': r.result.valid ? Number(r.result.sigmaL.toFixed(2)) : '',
        'Stock de sécurité': r.result.valid ? Math.round(r.result.ss) : '',
        'Point de commande (ROP)': r.result.valid ? Math.round(r.result.rop) : '',
        'Couverture SS (jours)': r.result.valid ? Number(r.result.coverageDays.toFixed(2)) : '',
      };
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock de sécurité');

    // Ajout d'une feuille "Paramètres" en mode sales pour traçabilité
    if (dataSource === 'sales') {
      const params = [
        { 'Paramètre': 'Taux de service global (%)', 'Valeur': globalServiceLevel },
        { 'Paramètre': 'Écart-type LT global (jours)', 'Valeur': globalLeadTimeStd },
        { 'Paramètre': 'Granularité d\'agrégation', 'Valeur': aggregation === 'daily' ? 'Quotidienne' : 'Hebdomadaire' },
        { 'Paramètre': 'Date du calcul', 'Valeur': new Date().toLocaleString('fr-FR') },
      ];
      const wsParams = XLSX.utils.json_to_sheet(params);
      XLSX.utils.book_append_sheet(wb, wsParams, 'Paramètres');
    }

    XLSX.writeFile(wb, `atelier-stock-securite-${Date.now()}.xlsx`);
  };

  const downloadTemplate = (kind) => {
    if (kind === 'params') {
      const ws = XLSX.utils.json_to_sheet(TEMPLATE_ROWS);
      ws['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 20 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      XLSX.writeFile(wb, 'atelier-template-parametres.xlsx');
    } else {
      const ws = XLSX.utils.json_to_sheet(generateSalesTemplate());
      ws['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Historique de ventes');
      XLSX.writeFile(wb, 'atelier-template-historique-ventes.xlsx');
    }
  };

  const examineRow = (row) => {
    setDemandMean(row.D); setDemandStd(row.sD);
    setLeadTimeMean(row.L); setLeadTimeStd(row.sL);
    setServiceLevel(row.sl);
    setMode('single');
  };

  const selectedRow = computedRows.find(r => r.id === selectedRowId);
  const isSalesMode = dataSource === 'sales';

  return (
    <div className="min-h-screen text-slate-900" style={{ background: '#F8FAFC', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <FontsAndStyles />

      <nav className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-5">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-jetbrains text-xs">
              <ArrowLeft size={14} />
              RETOUR
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-3">
              <Logo small />
              <div>
                <div className="font-bricolage font-semibold text-sm leading-tight text-slate-900">Calculateur de stock de sécurité</div>
                <div className="font-jetbrains text-[10px] text-slate-500">ATELIER / 04</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg border border-slate-200 bg-slate-50">
            <button
              onClick={() => setMode('single')}
              className="px-3 py-1.5 rounded-md font-jetbrains text-xs transition-all"
              style={mode === 'single'
                ? { background: '#FFFFFF', color: BLUE, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
                : { color: '#64748B' }}
            >
              ARTICLE UNIQUE
            </button>
            <button
              onClick={() => setMode('batch')}
              className="px-3 py-1.5 rounded-md font-jetbrains text-xs transition-all flex items-center gap-1.5"
              style={mode === 'batch'
                ? { background: '#FFFFFF', color: BLUE, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
                : { color: '#64748B' }}
            >
              MULTI-ARTICLES
              {mode !== 'batch' && rows.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium" style={{ background: BLUE_LIGHT, color: BLUE }}>{rows.length}</span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* ============ MODE SINGLE ============ */}
      {mode === 'single' && (
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600">DEMANDE QUOTIDIENNE</div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  <NumberField label="Moyenne (D)" value={demandMean} onChange={v => setDemandMean(Math.max(0, parseFloat(v) || 0))} />
                  <NumberField label="Écart-type (σD)" value={demandStd} onChange={v => setDemandStd(Math.max(0, parseFloat(v) || 0))} step="0.1" />
                </div>
                <div className="px-4 pb-3 text-[10px] text-slate-500 leading-relaxed">
                  σD = mesure de variabilité de la demande au jour le jour.
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600">DÉLAI DE RÉAPPROVISIONNEMENT</div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  <NumberField label="Moyen (L, jours)" value={leadTimeMean} onChange={v => setLeadTimeMean(Math.max(0, parseFloat(v) || 0))} step="0.5" />
                  <NumberField label="Écart-type (σL)" value={leadTimeStd} onChange={v => setLeadTimeStd(Math.max(0, parseFloat(v) || 0))} step="0.1" />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="font-jetbrains text-xs text-slate-600">TAUX DE SERVICE CIBLE</div>
                  <div className="font-jetbrains text-xs font-semibold" style={{ color: BLUE }}>{serviceLevel.toFixed(1)}%</div>
                </div>
                <div className="p-4 space-y-3">
                  <input type="range" min="50" max="99.9" step="0.1" value={serviceLevel} onChange={e => setServiceLevel(parseFloat(e.target.value))} className="w-full" style={{ accentColor: BLUE }} />
                  <div className="grid grid-cols-3 gap-1.5">
                    {SERVICE_PRESETS.map(p => (
                      <button key={p.value} onClick={() => setServiceLevel(p.value)} className="px-1 py-1.5 rounded-md font-jetbrains transition-all text-xs"
                        style={Math.abs(serviceLevel - p.value) < 0.01 ? { background: BLUE, color: '#FFFFFF', fontWeight: 600 } : { background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
                        <div>{p.label}</div>
                        <div className="text-[9px] opacity-80 mt-0.5">{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {singleResult.valid && (
                <div className="rounded-xl border p-4" style={{ borderColor: BLUE, background: BLUE_LIGHT }}>
                  <div className="font-jetbrains text-[10px] tracking-wider mb-1" style={{ color: BLUE }}>STOCK DE SÉCURITÉ</div>
                  <div className="font-bricolage text-3xl font-bold mb-1" style={{ color: BLUE }}>{Math.round(singleResult.ss)} unités</div>
                  <div className="font-jetbrains text-xs text-slate-700">soit ~{singleResult.coverageDays.toFixed(1)} jours de couverture</div>
                </div>
              )}
            </div>

            <div className="lg:col-span-3 space-y-4">
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 font-jetbrains text-xs text-slate-600 flex-wrap">
                    <TrendingUp size={13} />
                    DISTRIBUTION DE LA DEMANDE PENDANT LE DÉLAI
                    {singleResult.valid && (<><span className="text-slate-300">·</span><span style={{ color: BLUE }} className="font-medium">z = {singleResult.z.toFixed(3)}</span></>)}
                  </div>
                </div>
                <div className="p-6 md:p-8" style={{ background: 'repeating-linear-gradient(45deg, #F8FAFC 0, #F8FAFC 14px, #F1F5F9 14px, #F1F5F9 15px)' }}>
                  {singleResult.valid ? <NormalDistChart {...singleResult} /> : <div className="text-center py-12"><div className="font-jetbrains text-sm text-red-500">{singleResult.reason}</div></div>}
                </div>
              </div>

              {singleResult.valid && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="Stock de sécurité" value={Math.round(singleResult.ss)} sub="unités" />
                  <StatCard label="Point de commande" value={Math.round(singleResult.rop)} sub="ROP en unités" />
                  <StatCard label="Demande pdt L" value={Math.round(singleResult.muL)} sub="moyenne μL" />
                  <StatCard label="Variabilité σL" value={singleResult.sigmaL.toFixed(1)} sub="écart-type combiné" />
                </div>
              )}

              {singleResult.valid && (
                <div className="rounded-xl border border-slate-200 p-5 bg-white">
                  <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-3">DÉTAILS DU CALCUL</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <DetailRow label="Facteur de service z" value={singleResult.z.toFixed(3)} />
                    <DetailRow label="Demande moyenne pdt L" value={`${singleResult.muL.toFixed(1)} unités`} />
                    <DetailRow label="Écart-type combiné σL" value={`${singleResult.sigmaL.toFixed(2)} unités`} />
                    <DetailRow label="Stock de sécurité (z × σL)" value={`${singleResult.ss.toFixed(1)} unités`} />
                    <DetailRow label="Point de commande (μL + SS)" value={`${singleResult.rop.toFixed(1)} unités`} />
                    <DetailRow label="Couverture du SS" value={`${singleResult.coverageDays.toFixed(2)} jours`} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ MODE BATCH ============ */}
      {mode === 'batch' && (
        <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-5">

          {/* Barre d'actions */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileImport} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-md font-jetbrains text-xs font-semibold text-white shadow-sm transition-all hover:translate-y-[-1px]" style={{ background: BLUE }}>
                <Upload size={13} />
                IMPORTER (.xlsx / .csv)
              </button>
              <button onClick={() => downloadTemplate('params')} className="flex items-center gap-1.5 px-3 py-2 rounded-md font-jetbrains text-xs text-slate-700 border border-slate-300 hover:bg-slate-50 transition-all" title="Format avec D et σD pré-calculés">
                <FileDown size={13} />
                TEMPLATE PARAM.
              </button>
              <button onClick={() => downloadTemplate('sales')} className="flex items-center gap-1.5 px-3 py-2 rounded-md font-jetbrains text-xs text-slate-700 border border-slate-300 hover:bg-slate-50 transition-all" title="Format historique de ventes brut">
                <FileDown size={13} />
                TEMPLATE HISTO.
              </button>
              <button onClick={exportXlsx} disabled={rows.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-md font-jetbrains text-xs text-slate-700 border border-slate-300 hover:bg-slate-50 transition-all disabled:opacity-40">
                <Download size={13} />
                EXPORTER (.xlsx)
              </button>
              <div className="w-px h-5 bg-slate-200 mx-1" />
              <button onClick={addRow} disabled={isSalesMode} className="flex items-center gap-1.5 px-3 py-2 rounded-md font-jetbrains text-xs text-slate-700 border border-slate-300 hover:bg-slate-50 transition-all disabled:opacity-40" title={isSalesMode ? 'Désactivé en mode historique' : ''}>
                + LIGNE
              </button>
              <button onClick={clearRows} disabled={rows.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-md font-jetbrains text-xs text-red-600 border border-red-200 hover:bg-red-50 transition-all disabled:opacity-40">
                VIDER
              </button>
            </div>
            <div className="font-jetbrains text-xs text-slate-500 flex items-center gap-3">
              {isSalesMode && (
                <span className="px-2 py-1 rounded-md text-[10px] tracking-wider font-medium" style={{ background: BLUE_LIGHT, color: BLUE }}>
                  ◆ MODE HISTORIQUE
                </span>
              )}
              <span>{rows.length} ligne{rows.length > 1 ? 's' : ''} · {batchStats.count} calcul{batchStats.count > 1 ? 's' : ''} valide{batchStats.count > 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Message d'import */}
          {importMsg && (
            <div className="rounded-lg p-3 font-jetbrains text-xs"
              style={
                importMsg.type === 'success' ? { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }
                : importMsg.type === 'warning' ? { background: '#FFFBEB', color: '#92400E', border: '1px solid #FCD34D' }
                : { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }
              }>
              {importMsg.text}
            </div>
          )}

          {/* Paramètres globaux (mode historique uniquement) */}
          {isSalesMode && (
            <div className="rounded-xl border p-5" style={{ borderColor: '#BFDBFE', background: BLUE_LIGHT }}>
              <div className="flex items-center justify-between mb-4">
                <div className="font-jetbrains text-xs tracking-wider font-semibold" style={{ color: BLUE }}>
                  PARAMÈTRES GLOBAUX
                </div>
                <div className="font-jetbrains text-[10px] text-blue-700">appliqués à toutes les lignes</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <label className="font-jetbrains text-[10px] tracking-wider" style={{ color: BLUE }}>TAUX DE SERVICE</label>
                    <span className="font-jetbrains text-sm font-semibold" style={{ color: BLUE }}>{globalServiceLevel.toFixed(1)}%</span>
                  </div>
                  <input type="range" min="50" max="99.9" step="0.1" value={globalServiceLevel} onChange={e => setGlobalServiceLevel(parseFloat(e.target.value))} className="w-full" style={{ accentColor: BLUE }} />
                  <div className="flex gap-1 mt-1.5">
                    {[90, 95, 97.5, 99].map(p => (
                      <button key={p} onClick={() => setGlobalServiceLevel(p)} className="px-2 py-0.5 rounded font-jetbrains text-[10px] transition-colors"
                        style={Math.abs(globalServiceLevel - p) < 0.01 ? { background: BLUE, color: '#FFFFFF' } : { background: 'rgba(255,255,255,0.6)', color: BLUE, border: '1px solid #BFDBFE' }}>
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="font-jetbrains text-[10px] tracking-wider mb-2 block" style={{ color: BLUE }}>ÉCART-TYPE LEAD TIME (jours)</label>
                  <input type="number" min="0" step="0.1" value={globalLeadTimeStd} onChange={e => setGlobalLeadTimeStd(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-white border border-blue-200 rounded-md outline-none font-jetbrains text-sm focus:border-blue-400 transition-colors" />
                  <div className="text-[10px] text-blue-700 mt-1.5">0 si le délai fournisseur est totalement fiable</div>
                </div>
                <div>
                  <label className="font-jetbrains text-[10px] tracking-wider mb-2 block" style={{ color: BLUE }}>GRANULARITÉ D'AGRÉGATION</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button onClick={() => setAggregation('daily')} className="px-2 py-2 rounded-md font-jetbrains text-xs transition-all"
                      style={aggregation === 'daily' ? { background: BLUE, color: '#FFFFFF', fontWeight: 600 } : { background: 'rgba(255,255,255,0.6)', color: BLUE, border: '1px solid #BFDBFE' }}>
                      Quotidienne
                    </button>
                    <button onClick={() => setAggregation('weekly')} className="px-2 py-2 rounded-md font-jetbrains text-xs transition-all"
                      style={aggregation === 'weekly' ? { background: BLUE, color: '#FFFFFF', fontWeight: 600 } : { background: 'rgba(255,255,255,0.6)', color: BLUE, border: '1px solid #BFDBFE' }}>
                      Hebdomadaire
                    </button>
                  </div>
                  <div className="text-[10px] text-blue-700 mt-1.5">le recalcul est instantané</div>
                </div>
              </div>
            </div>
          )}

          {/* Stats globales */}
          {batchStats.count > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Articles calculés" value={batchStats.count} sub={`sur ${rows.length} lignes`} />
              <StatCard label="SS cumulé" value={Math.round(batchStats.totalSS).toLocaleString('fr-FR')} sub="unités" />
              <StatCard label="ROP cumulé" value={Math.round(batchStats.totalROP).toLocaleString('fr-FR')} sub="unités" />
              <StatCard
                label={isSalesMode ? 'Fiabilité' : 'Couverture moy.'}
                value={isSalesMode ? `${batchStats.count - batchStats.lowReliability}/${batchStats.count}` : `${batchStats.avgCoverage.toFixed(1)} j`}
                sub={isSalesMode
                  ? (batchStats.lowReliability > 0 ? `⚠ ${batchStats.lowReliability} faible` : 'tous fiables')
                  : (batchStats.atRisk > 0 ? `⚠ ${batchStats.atRisk} sous 1j` : 'tous au-dessus 1j')}
              />
            </div>
          )}

          {/* Tableau */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="font-jetbrains text-xs text-slate-600">TABLEAU DES ARTICLES</div>
              <div className="font-jetbrains text-[10px] text-slate-400">cliquez sur une ligne pour la visualiser</div>
            </div>

            {rows.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-14 h-14 rounded-xl mx-auto mb-5 flex items-center justify-center" style={{ background: BLUE_LIGHT, border: '1px solid #BFDBFE' }}>
                  <FileText size={22} style={{ color: BLUE }} strokeWidth={1.75} />
                </div>
                <div className="font-bricolage text-xl mb-2 text-slate-800">Aucun article</div>
                <div className="text-sm text-slate-500 mb-5 max-w-md mx-auto">Importez un fichier Excel/CSV (paramètres préparés OU historique de ventes — le format est détecté automatiquement).</div>
                <div className="flex justify-center gap-2 flex-wrap">
                  <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-md font-jetbrains text-xs font-semibold text-white" style={{ background: BLUE }}>
                    IMPORTER UN FICHIER
                  </button>
                  <button onClick={() => downloadTemplate('sales')} className="px-4 py-2 rounded-md font-jetbrains text-xs text-slate-700 border border-slate-300">
                    TEMPLATE HISTORIQUE
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <Th>Réf.</Th>
                      <Th>Libellé</Th>
                      {isSalesMode && <Th>Magasin</Th>}
                      <Th className="text-right">L</Th>
                      <Th className="text-right">D</Th>
                      <Th className="text-right">σD</Th>
                      {!isSalesMode && <Th className="text-right">σL_t</Th>}
                      {!isSalesMode && <Th className="text-right">SL %</Th>}
                      {isSalesMode && <Th className="text-center">Fiab.</Th>}
                      <Th className="text-right" highlight>SS</Th>
                      <Th className="text-right" highlight>ROP</Th>
                      <Th className="text-right" highlight>Cov.</Th>
                      <Th></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedRows.map(r => {
                      const isSelected = r.id === selectedRowId;
                      const valid = r.result.valid;
                      return (
                        <tr key={r.id} onClick={() => setSelectedRowId(r.id)} className="border-b border-slate-100 cursor-pointer transition-colors" style={isSelected ? { background: BLUE_LIGHT } : {}}>
                          <Td><CellInput value={r.ref} onChange={v => updateRow(r.id, 'ref', v)} mono /></Td>
                          <Td><CellInput value={r.label} onChange={v => updateRow(r.id, 'label', v)} /></Td>
                          {isSalesMode && <Td><CellInput value={r.store} onChange={v => updateRow(r.id, 'store', v)} /></Td>}
                          <Td><CellInput value={r.L} onChange={v => updateRow(r.id, 'L', v)} type="number" align="right" mono step="0.5" /></Td>
                          {isSalesMode ? (
                            <>
                              <Td className="text-right font-jetbrains text-slate-700">{r.D.toFixed(1)}</Td>
                              <Td className="text-right font-jetbrains text-slate-700">{r.sD.toFixed(1)}</Td>
                            </>
                          ) : (
                            <>
                              <Td><CellInput value={r.D} onChange={v => updateRow(r.id, 'D', v)} type="number" align="right" mono /></Td>
                              <Td><CellInput value={r.sD} onChange={v => updateRow(r.id, 'sD', v)} type="number" align="right" mono step="0.1" /></Td>
                            </>
                          )}
                          {!isSalesMode && <Td><CellInput value={r.sL} onChange={v => updateRow(r.id, 'sL', v)} type="number" align="right" mono step="0.1" /></Td>}
                          {!isSalesMode && <Td><CellInput value={r.sl} onChange={v => updateRow(r.id, 'sl', v)} type="number" align="right" mono step="0.1" /></Td>}
                          {isSalesMode && (
                            <Td className="text-center">
                              <ReliabilityBadge level={r.reliability} dataPoints={r.totalBins} />
                            </Td>
                          )}
                          <Td className="text-right font-jetbrains font-semibold" style={{ color: valid ? BLUE : '#94A3B8' }}>{valid ? Math.round(r.result.ss) : '—'}</Td>
                          <Td className="text-right font-jetbrains font-semibold text-slate-800">{valid ? Math.round(r.result.rop) : '—'}</Td>
                          <Td className="text-right font-jetbrains">
                            {valid ? <span style={{ color: r.result.coverageDays < 1 ? '#DC2626' : '#64748B' }}>{r.result.coverageDays.toFixed(1)}j</span> : '—'}
                          </Td>
                          <Td>
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={(e) => { e.stopPropagation(); examineRow(r); }} className="p-1 text-slate-400 hover:text-blue-600 transition-colors" title="Examiner en mode article unique">
                                <Zap size={12} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); removeRow(r.id); }} className="p-1 text-slate-400 hover:text-red-600 transition-colors" title="Supprimer">×</button>
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Chart de la ligne sélectionnée */}
          {selectedRow && selectedRow.result.valid && (
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 font-jetbrains text-xs text-slate-600 flex-wrap">
                  <TrendingUp size={13} />
                  COURBE — <span style={{ color: BLUE }} className="font-medium">{selectedRow.ref || 'sans ref'}</span>
                  {selectedRow.store && <><span className="text-slate-300">·</span><span className="text-slate-500">{selectedRow.store}</span></>}
                  {selectedRow.label && <><span className="text-slate-300">·</span><span className="text-slate-500">{selectedRow.label}</span></>}
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-500">z = {selectedRow.result.z.toFixed(3)}</span>
                  {isSalesMode && selectedRow.totalBins != null && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500">{selectedRow.totalBins} {aggregation === 'daily' ? 'jours' : 'semaines'} · {selectedRow.activeBins} actif{selectedRow.activeBins > 1 ? 's' : ''}</span>
                    </>
                  )}
                </div>
                <button onClick={() => examineRow(selectedRow)} className="flex items-center gap-1.5 px-2.5 py-1 rounded font-jetbrains text-[10px] text-slate-600 border border-slate-300 hover:bg-slate-50 transition-all">
                  <Zap size={10} />
                  EXAMINER EN DÉTAIL
                </button>
              </div>
              <div className="p-6" style={{ background: 'repeating-linear-gradient(45deg, #F8FAFC 0, #F8FAFC 14px, #F1F5F9 14px, #F1F5F9 15px)' }}>
                <NormalDistChart {...selectedRow.result} />
              </div>
            </div>
          )}

          {/* Tip import (en empty state ou si pas en mode sales) */}
          {!isSalesMode && rows.length > 0 && (
            <div className="rounded-xl border border-blue-200 p-4" style={{ background: BLUE_LIGHT }}>
              <div className="text-xs text-blue-900 leading-relaxed">
                <div className="font-jetbrains font-semibold mb-1.5" style={{ color: BLUE }}>📥 Importez plutôt un historique de ventes</div>
                <div className="text-blue-800 mb-2">
                  Si vous avez vos ventes brutes (Réf | Libellé | Lead time | Magasin | Qté | Date), l'outil calcule lui-même D et σD avec un flag de fiabilité par couple Réf×Magasin. Plus juste que des paramètres saisis à la main.
                </div>
                <button onClick={() => downloadTemplate('sales')} className="font-jetbrains text-[11px] underline hover:no-underline" style={{ color: BLUE }}>
                  → Télécharger le template historique
                </button>
              </div>
            </div>
          )}

          {/* Doc sur les colonnes acceptées (en mode sales) */}
          {isSalesMode && (
            <div className="rounded-xl border border-slate-200 p-5 bg-white">
              <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-3">À PROPOS DU CALCUL AUTOMATIQUE</div>
              <div className="text-sm text-slate-600 leading-relaxed mb-3">
                Pour chaque couple <span className="font-jetbrains">Référence × Magasin</span>, l'outil agrège les ventes par {aggregation === 'daily' ? 'jour' : 'semaine'} entre la date min et la date max détectées, puis calcule la demande moyenne <span className="font-jetbrains">D</span> et l'écart-type d'échantillon <span className="font-jetbrains">σD</span>. Les bins sans vente comptent comme zéros — ce qui reflète correctement la variabilité réelle.
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-start gap-2">
                  <ReliabilityBadge level="high" />
                  <div className="text-[11px] text-slate-600 leading-tight"><span className="font-medium">≥ 90 bins</span><br />statistiquement robuste</div>
                </div>
                <div className="flex items-start gap-2">
                  <ReliabilityBadge level="medium" />
                  <div className="text-[11px] text-slate-600 leading-tight"><span className="font-medium">30 à 90 bins</span><br />acceptable, surveiller</div>
                </div>
                <div className="flex items-start gap-2">
                  <ReliabilityBadge level="low" />
                  <div className="text-[11px] text-slate-600 leading-tight"><span className="font-medium">&lt; 30 bins</span><br />indicatif, peu fiable</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helpers de tableau
function Th({ children, className = '', highlight }) {
  return (
    <th className={`px-3 py-2.5 text-left font-jetbrains text-[10px] tracking-wider whitespace-nowrap ${className}`}
        style={{ color: highlight ? BLUE : '#64748B', background: highlight ? BLUE_LIGHT : 'transparent' }}>
      {children}
    </th>
  );
}

function Td({ children, className = '', style = {} }) {
  return <td className={`px-3 py-1.5 ${className}`} style={style}>{children}</td>;
}

function CellInput({ value, onChange, type = 'text', align = 'left', mono = false, step, placeholder }) {
  // En type number : afficher vide si valeur 0 et vide initialement, pour ne pas afficher "0" partout
  const displayValue = value === undefined || value === null ? '' : value;
  return (
    <input
      type={type}
      value={displayValue}
      step={step}
      placeholder={placeholder || (type === 'number' ? '0' : '')}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      onFocus={e => e.target.select()}
      className={`w-full bg-transparent outline-none px-1.5 py-1 rounded focus:bg-white focus:ring-2 focus:ring-blue-300 focus:ring-offset-0 transition-all border border-transparent hover:border-slate-200 hover:bg-slate-50/50 ${align === 'right' ? 'text-right' : ''} ${mono ? 'font-jetbrains' : ''} text-slate-900`}
    />
  );
}

function ReliabilityBadge({ level, dataPoints }) {
  const config = {
    high:   { color: '#059669', bg: '#D1FAE5', label: 'Élevée' },
    medium: { color: '#D97706', bg: '#FEF3C7', label: 'Moyenne' },
    low:    { color: '#DC2626', bg: '#FEE2E2', label: 'Faible' },
  };
  const c = config[level] || config.low;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-jetbrains text-[9px] font-semibold tracking-wider"
      style={{ color: c.color, background: c.bg }}
      title={dataPoints != null ? `${dataPoints} points de données` : ''}
    >
      ● {c.label}
    </span>
  );
}

// ============================================================
// INCOTERMS 2020 · Comparateur visuel
// ============================================================

const SUPPLY_CHAIN_STEPS = [
  { id: 0, label: 'Locaux vendeur',       short: 'Vendeur',     icon: Factory },
  { id: 1, label: 'Pré-acheminement',     short: 'Pré-achem.',  icon: Truck   },
  { id: 2, label: "Point d'export",       short: 'Export',      icon: Anchor  },
  { id: 3, label: 'Transport principal',  short: 'Transport',   icon: Ship    },
  { id: 4, label: "Point d'import",       short: 'Import',      icon: Anchor  },
  { id: 5, label: 'Post-acheminement',    short: 'Post-achem.', icon: Truck   },
  { id: 6, label: 'Locaux acheteur',      short: 'Acheteur',    icon: Warehouse },
];

// 11 obligations à comparer (Incoterms 2020)
const OBLIGATIONS = [
  { key: 'packaging',       label: 'Emballage',                hint: 'conformité export incluse' },
  { key: 'loadingOrigin',   label: 'Chargement origine',       hint: 'sur le 1er véhicule' },
  { key: 'preCarriage',     label: 'Pré-acheminement',         hint: 'vers le point d\'export' },
  { key: 'exportCustoms',   label: 'Dédouanement export',      hint: 'formalités, droits' },
  { key: 'mainCarriage',    label: 'Transport principal',      hint: 'maritime, aérien, routier' },
  { key: 'insurance',       label: 'Assurance transport',      hint: 'CIF/CIP = obligatoire' },
  { key: 'importCustoms',   label: 'Dédouanement import',      hint: 'TVA, droits, formalités' },
  { key: 'postCarriage',    label: 'Post-acheminement',        hint: 'vers locaux acheteur' },
  { key: 'unloading',       label: 'Déchargement final',       hint: 'au point de livraison' },
];

const INCOTERMS = [
  {
    code: 'EXW',
    name: 'Ex Works',
    nameFr: 'À l\'usine',
    mode: 'multimodal',
    family: 'E',
    familyLabel: 'Départ',
    riskTransfer: 0,
    costTransfer: 0,
    summary: 'Obligation minimum pour le vendeur : il met la marchandise à disposition dans ses locaux. L\'acheteur prend tout en charge à partir de là, y compris le dédouanement export.',
    obligations: {
      packaging: 'seller', loadingOrigin: 'buyer', preCarriage: 'buyer',
      exportCustoms: 'buyer', mainCarriage: 'buyer', insurance: 'buyer',
      importCustoms: 'buyer', postCarriage: 'buyer', unloading: 'buyer',
    },
    typical: ['Vente B2B locale', 'Acheteur avec son propre logisticien', 'Pickup direct dans l\'usine'],
    pitfalls: [
      'L\'acheteur doit faire les formalités d\'export — souvent compliqué quand il est étranger.',
      'Mauvais choix pour le commerce international : préférer FCA.',
    ],
  },
  {
    code: 'FCA',
    name: 'Free Carrier',
    nameFr: 'Franco transporteur',
    mode: 'multimodal',
    family: 'F',
    familyLabel: 'Sans transport principal',
    riskTransfer: 2,
    costTransfer: 2,
    summary: 'Le vendeur livre la marchandise dédouanée à l\'export au transporteur désigné par l\'acheteur, au lieu convenu. Recommandé en remplacement de EXW et FOB pour les containers.',
    obligations: {
      packaging: 'seller', loadingOrigin: 'seller', preCarriage: 'seller',
      exportCustoms: 'seller', mainCarriage: 'buyer', insurance: 'buyer',
      importCustoms: 'buyer', postCarriage: 'buyer', unloading: 'buyer',
    },
    typical: ['Conteneurs maritimes', 'Fret aérien', 'Transport multimodal avec hub'],
    pitfalls: [
      'Le lieu de livraison doit être précis (adresse exacte).',
      'Si livraison aux locaux du vendeur, c\'est lui qui charge ; si ailleurs, c\'est le transporteur.',
    ],
  },
  {
    code: 'FAS',
    name: 'Free Alongside Ship',
    nameFr: 'Franco le long du navire',
    mode: 'maritime',
    family: 'F',
    familyLabel: 'Sans transport principal',
    riskTransfer: 2,
    costTransfer: 2,
    summary: 'Le vendeur livre la marchandise le long du navire désigné par l\'acheteur, dans le port d\'embarquement convenu. Réservé au transport maritime de marchandises non-conteneurisées.',
    obligations: {
      packaging: 'seller', loadingOrigin: 'seller', preCarriage: 'seller',
      exportCustoms: 'seller', mainCarriage: 'buyer', insurance: 'buyer',
      importCustoms: 'buyer', postCarriage: 'buyer', unloading: 'buyer',
    },
    typical: ['Vrac sec (minerai, céréales)', 'Cargaisons hors-gabarit', 'Marchandises non-conteneurisées'],
    pitfalls: [
      'Inadapté aux conteneurs : utilisez FCA.',
      'Risque de surcoût si chargement retardé (frais de quai).',
    ],
  },
  {
    code: 'FOB',
    name: 'Free On Board',
    nameFr: 'Franco à bord',
    mode: 'maritime',
    family: 'F',
    familyLabel: 'Sans transport principal',
    riskTransfer: 2,
    costTransfer: 2,
    summary: 'Le vendeur livre la marchandise à bord du navire désigné par l\'acheteur, dans le port d\'embarquement. Le transfert se fait quand la marchandise est chargée sur le bateau.',
    obligations: {
      packaging: 'seller', loadingOrigin: 'seller', preCarriage: 'seller',
      exportCustoms: 'seller', mainCarriage: 'buyer', insurance: 'buyer',
      importCustoms: 'buyer', postCarriage: 'buyer', unloading: 'buyer',
    },
    typical: ['Vrac maritime', 'Transport maritime traditionnel', 'Marchandises non-conteneurisées'],
    pitfalls: [
      'Inadapté aux conteneurs (le risque est mal défini avant chargement) : utilisez FCA.',
      'Très utilisé à tort pour les containers : source fréquente de litiges.',
    ],
  },
  {
    code: 'CFR',
    name: 'Cost and Freight',
    nameFr: 'Coût et fret',
    mode: 'maritime',
    family: 'C',
    familyLabel: 'Avec transport principal',
    riskTransfer: 2,
    costTransfer: 4,
    summary: 'Le vendeur paie le fret jusqu\'au port de destination mais le risque est transféré dès le chargement à bord au départ. Décalage classique des coûts et risques des termes C.',
    obligations: {
      packaging: 'seller', loadingOrigin: 'seller', preCarriage: 'seller',
      exportCustoms: 'seller', mainCarriage: 'seller', insurance: 'buyer',
      importCustoms: 'buyer', postCarriage: 'buyer', unloading: 'buyer',
    },
    typical: ['Vrac maritime', 'Vendeur qui maîtrise les routes maritimes', 'Transports longs'],
    pitfalls: [
      'Piège classique : l\'acheteur croit être couvert pendant la traversée. NON — le risque est à lui dès le port de départ.',
      'L\'acheteur doit souscrire son propre contrat d\'assurance.',
      'Inadapté aux conteneurs : utilisez CPT.',
    ],
  },
  {
    code: 'CIF',
    name: 'Cost, Insurance and Freight',
    nameFr: 'Coût, assurance et fret',
    mode: 'maritime',
    family: 'C',
    familyLabel: 'Avec transport principal',
    riskTransfer: 2,
    costTransfer: 4,
    summary: 'Comme CFR, mais le vendeur souscrit en plus une assurance maritime au profit de l\'acheteur. Couverture minimale obligatoire (clause C des Institute Cargo Clauses).',
    obligations: {
      packaging: 'seller', loadingOrigin: 'seller', preCarriage: 'seller',
      exportCustoms: 'seller', mainCarriage: 'seller', insurance: 'seller',
      importCustoms: 'buyer', postCarriage: 'buyer', unloading: 'buyer',
    },
    typical: ['Vrac maritime', 'Ventes traditionnelles', 'Marchandises de valeur moyenne'],
    pitfalls: [
      'L\'assurance souscrite est minimale (Clause C, ICC) : couverture limitée.',
      'L\'acheteur peut vouloir renforcer la couverture à ses frais.',
      'Inadapté aux conteneurs : utilisez CIP.',
    ],
  },
  {
    code: 'CPT',
    name: 'Carriage Paid To',
    nameFr: 'Port payé jusqu\'à',
    mode: 'multimodal',
    family: 'C',
    familyLabel: 'Avec transport principal',
    riskTransfer: 2,
    costTransfer: 5,
    summary: 'Le vendeur paie le transport jusqu\'au lieu de destination convenu, mais le risque est transféré à la remise au 1er transporteur. Équivalent multimodal de CFR.',
    obligations: {
      packaging: 'seller', loadingOrigin: 'seller', preCarriage: 'seller',
      exportCustoms: 'seller', mainCarriage: 'seller', insurance: 'buyer',
      importCustoms: 'buyer', postCarriage: 'seller', unloading: 'buyer',
    },
    typical: ['Conteneurs', 'Fret aérien', 'Transport multimodal'],
    pitfalls: [
      'Même piège que CFR : risque transféré tôt, coûts payés tard.',
      'L\'acheteur doit comprendre qu\'il assume le risque dès le 1er transporteur.',
    ],
  },
  {
    code: 'CIP',
    name: 'Carriage and Insurance Paid To',
    nameFr: 'Port payé, assurance comprise',
    mode: 'multimodal',
    family: 'C',
    familyLabel: 'Avec transport principal',
    riskTransfer: 2,
    costTransfer: 5,
    summary: 'Comme CPT mais le vendeur souscrit une assurance "tous risques" (Clause A des ICC) au profit de l\'acheteur. Niveau de couverture relevé en 2020 — différence majeure avec CIF.',
    obligations: {
      packaging: 'seller', loadingOrigin: 'seller', preCarriage: 'seller',
      exportCustoms: 'seller', mainCarriage: 'seller', insurance: 'seller',
      importCustoms: 'buyer', postCarriage: 'seller', unloading: 'buyer',
    },
    typical: ['Conteneurs', 'Fret aérien', 'Marchandises de forte valeur'],
    pitfalls: [
      'Couverture "all risks" obligatoire depuis 2020 (vs minimale en CIF).',
      'Coût de l\'assurance plus élevé qu\'en CIF — à intégrer au prix de vente.',
    ],
  },
  {
    code: 'DAP',
    name: 'Delivered at Place',
    nameFr: 'Rendu au lieu',
    mode: 'multimodal',
    family: 'D',
    familyLabel: 'Arrivée',
    riskTransfer: 5,
    costTransfer: 5,
    summary: 'Le vendeur livre la marchandise prête à être déchargée au lieu convenu chez l\'acheteur. Il assume tous les coûts et risques jusqu\'à destination, sauf dédouanement import.',
    obligations: {
      packaging: 'seller', loadingOrigin: 'seller', preCarriage: 'seller',
      exportCustoms: 'seller', mainCarriage: 'seller', insurance: 'seller',
      importCustoms: 'buyer', postCarriage: 'seller', unloading: 'buyer',
    },
    typical: ['Livraison entrepôt acheteur', 'Vendeur qui maîtrise toute la chaîne', 'Importations courantes'],
    pitfalls: [
      'L\'acheteur doit gérer le dédouanement import — vérifier sa capacité à le faire.',
      'Le vendeur doit comprendre la réglementation du pays d\'arrivée.',
    ],
  },
  {
    code: 'DPU',
    name: 'Delivered at Place Unloaded',
    nameFr: 'Rendu au lieu déchargé',
    mode: 'multimodal',
    family: 'D',
    familyLabel: 'Arrivée',
    riskTransfer: 6,
    costTransfer: 6,
    summary: 'Comme DAP mais le vendeur prend en charge le déchargement au lieu de destination. Seul Incoterm où le vendeur est responsable du déchargement final. Remplace DAT (2010).',
    obligations: {
      packaging: 'seller', loadingOrigin: 'seller', preCarriage: 'seller',
      exportCustoms: 'seller', mainCarriage: 'seller', insurance: 'seller',
      importCustoms: 'buyer', postCarriage: 'seller', unloading: 'seller',
    },
    typical: ['Livraison sur terminal ou entrepôt avec équipements', 'Marchandises lourdes nécessitant équipement'],
    pitfalls: [
      'Le vendeur doit s\'assurer que le déchargement est possible au lieu convenu (équipements, accès).',
      'Risque si le lieu n\'est pas équipé pour décharger.',
    ],
  },
  {
    code: 'DDP',
    name: 'Delivered Duty Paid',
    nameFr: 'Rendu droits acquittés',
    mode: 'multimodal',
    family: 'D',
    familyLabel: 'Arrivée',
    riskTransfer: 5,
    costTransfer: 5,
    summary: 'Obligation maximum pour le vendeur : il livre la marchandise au lieu convenu, dédouanement import inclus, droits et taxes payés. Symétrique de EXW. Acheteur reçoit en mode "porte-à-porte".',
    obligations: {
      packaging: 'seller', loadingOrigin: 'seller', preCarriage: 'seller',
      exportCustoms: 'seller', mainCarriage: 'seller', insurance: 'seller',
      importCustoms: 'seller', postCarriage: 'seller', unloading: 'buyer',
    },
    typical: ['E-commerce B2C transfrontalier', 'Marchés simples (UE intra)', 'Vendeur installé dans le pays d\'arrivée'],
    pitfalls: [
      'Le vendeur supporte les droits/TVA import — capacité fiscale du pays d\'arrivée à vérifier.',
      'Souvent impossible si le vendeur n\'est pas enregistré localement (TVA, EORI).',
      'Privilégier DAP si l\'acheteur peut faire l\'import.',
    ],
  },
];

const INCOTERM_FAMILIES = [
  { id: 'E', label: 'E · Départ',                color: '#94A3B8' },
  { id: 'F', label: 'F · Sans transport princ.', color: '#0EA5E9' },
  { id: 'C', label: 'C · Avec transport princ.', color: '#8B5CF6' },
  { id: 'D', label: 'D · Arrivée',               color: '#10B981' },
];

const ORANGE = '#F97316';
const ORANGE_LIGHT = '#FFF7ED';

function IncotermsComparator({ onBack }) {
  const [view, setView] = useState('explore'); // 'explore' | 'compare'
  const [selectedCode, setSelectedCode] = useState('FOB');
  const [compareList, setCompareList] = useState(['EXW', 'FOB', 'DDP']);
  const [modeFilter, setModeFilter] = useState('all'); // 'all' | 'maritime' | 'multimodal'

  const filteredIncoterms = useMemo(() => {
    if (modeFilter === 'all') return INCOTERMS;
    return INCOTERMS.filter(it => it.mode === modeFilter || it.mode === 'multimodal');
  }, [modeFilter]);

  const selected = INCOTERMS.find(it => it.code === selectedCode) || INCOTERMS[0];

  const toggleCompare = (code) => {
    setCompareList(list => {
      if (list.includes(code)) return list.filter(c => c !== code);
      if (list.length >= 4) return list;
      return [...list, code];
    });
  };

  return (
    <div className="min-h-screen text-slate-900" style={{ background: '#F8FAFC', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <FontsAndStyles />

      <nav className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-5">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-jetbrains text-xs">
              <ArrowLeft size={14} />
              RETOUR
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-3">
              <Logo small />
              <div>
                <div className="font-bricolage font-semibold text-sm leading-tight text-slate-900">Incoterms 2020</div>
                <div className="font-jetbrains text-[10px] text-slate-500">ATELIER / 05</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg border border-slate-200 bg-slate-50">
            <button
              onClick={() => setView('explore')}
              className="px-3 py-1.5 rounded-md font-jetbrains text-xs transition-all"
              style={view === 'explore'
                ? { background: '#FFFFFF', color: BLUE, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
                : { color: '#64748B' }}
            >
              EXPLORER
            </button>
            <button
              onClick={() => setView('compare')}
              className="px-3 py-1.5 rounded-md font-jetbrains text-xs transition-all flex items-center gap-1.5"
              style={view === 'compare'
                ? { background: '#FFFFFF', color: BLUE, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
                : { color: '#64748B' }}
            >
              COMPARER
              {compareList.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium" style={{ background: BLUE_LIGHT, color: BLUE }}>{compareList.length}</span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* MODE EXPLORER */}
      {view === 'explore' && (
        <div className="max-w-[1600px] mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Sidebar : grille des 11 */}
          <div className="lg:col-span-4 space-y-4">
            {/* Filtre mode */}
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="font-jetbrains text-[10px] tracking-wider text-slate-500 mb-2">FILTRER PAR MODE DE TRANSPORT</div>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'all', label: 'Tous' },
                  { id: 'multimodal', label: 'Multimodal' },
                  { id: 'maritime', label: 'Maritime' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setModeFilter(opt.id)}
                    className="px-2 py-1.5 rounded-md font-jetbrains text-[11px] transition-all"
                    style={modeFilter === opt.id
                      ? { background: BLUE, color: '#FFFFFF', fontWeight: 600 }
                      : { background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grille incoterms */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="font-jetbrains text-xs text-slate-600">LES 11 INCOTERMS 2020</div>
                <div className="font-jetbrains text-[10px] text-slate-400">{filteredIncoterms.length} affichés</div>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2">
                {filteredIncoterms.map(it => {
                  const fam = INCOTERM_FAMILIES.find(f => f.id === it.family);
                  const isActive = it.code === selectedCode;
                  return (
                    <button
                      key={it.code}
                      onClick={() => setSelectedCode(it.code)}
                      className="text-left p-3 rounded-lg border transition-all"
                      style={isActive
                        ? { borderColor: BLUE, background: BLUE_LIGHT }
                        : { borderColor: '#E2E8F0', background: '#FFFFFF' }}
                    >
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="font-bricolage font-bold text-base" style={{ color: isActive ? BLUE : '#0F172A' }}>{it.code}</span>
                        <span className="font-jetbrains text-[9px] tracking-wider" style={{ color: fam.color }}>● {it.family}</span>
                      </div>
                      <div className="text-[11px] text-slate-700 leading-tight font-medium">{it.nameFr}</div>
                      <div className="font-jetbrains text-[9px] mt-1.5 uppercase" style={{ color: it.mode === 'maritime' ? '#0EA5E9' : '#64748B' }}>
                        {it.mode === 'maritime' ? '⚓ maritime' : '↔ multimodal'}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50">
                <div className="font-jetbrains text-[9px] text-slate-500 tracking-wider mb-1.5">LÉGENDE DES FAMILLES</div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                  {INCOTERM_FAMILIES.map(f => (
                    <div key={f.id} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                      <span style={{ color: f.color }}>●</span>
                      <span>{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Vue détail */}
          <div className="lg:col-span-8 space-y-4">
            {/* En-tête */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                  <div>
                    <div className="flex items-baseline gap-3 mb-1">
                      <span className="font-bricolage font-bold text-4xl tracking-tight" style={{ color: BLUE }}>{selected.code}</span>
                      <span className="font-bricolage text-xl text-slate-700">{selected.name}</span>
                    </div>
                    <div className="font-jetbrains text-xs text-slate-500">
                      {selected.nameFr} · {selected.familyLabel} · {selected.mode === 'maritime' ? 'Maritime uniquement' : 'Multimodal'}
                    </div>
                  </div>
                  <button
                    onClick={() => { toggleCompare(selected.code); setView('compare'); }}
                    className="px-3 py-2 rounded-md font-jetbrains text-xs text-white shadow-sm transition-all hover:translate-y-[-1px] flex items-center gap-1.5"
                    style={{ background: BLUE }}
                  >
                    AJOUTER À LA COMPARAISON
                  </button>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{selected.summary}</p>
              </div>
            </div>

            {/* Timeline transferts */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 font-jetbrains text-xs text-slate-600">
                  <Map size={13} />
                  TRANSFERTS COÛTS & RISQUES SUR LA CHAÎNE
                </div>
                <div className="flex items-center gap-3 font-jetbrains text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: BLUE }} />coûts vendeur</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: ORANGE }} />risques vendeur</span>
                </div>
              </div>
              <div className="p-6" style={{ background: 'repeating-linear-gradient(45deg, #F8FAFC 0, #F8FAFC 14px, #F1F5F9 14px, #F1F5F9 15px)' }}>
                <IncotermTimeline incoterm={selected} />
              </div>
            </div>

            {/* Tableau obligations */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600">QUI PAIE QUOI ?</div>
              <ObligationsTable incoterms={[selected]} />
            </div>

            {/* Cas d'usage + pièges */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="font-jetbrains text-[10px] tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <Info size={11} />
                  CAS D'USAGE TYPIQUES
                </div>
                <ul className="space-y-2">
                  {selected.typical.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span style={{ color: BLUE }} className="font-jetbrains text-xs mt-0.5">→</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border p-5" style={{ borderColor: '#FED7AA', background: ORANGE_LIGHT }}>
                <div className="font-jetbrains text-[10px] tracking-wider mb-3 flex items-center gap-1.5" style={{ color: ORANGE }}>
                  <AlertTriangle size={11} />
                  PIÈGES À ÉVITER
                </div>
                <ul className="space-y-2">
                  {selected.pitfalls.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-orange-900">
                      <span style={{ color: ORANGE }} className="font-jetbrains text-xs mt-0.5">⚠</span>
                      <span className="leading-snug">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE COMPARER */}
      {view === 'compare' && (
        <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-5">
          {/* Sélecteur */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="font-jetbrains text-xs text-slate-600">SÉLECTIONNEZ 2 À 4 INCOTERMS À COMPARER</div>
              <div className="font-jetbrains text-[10px] text-slate-400">{compareList.length} / 4 sélectionné{compareList.length > 1 ? 's' : ''}</div>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-11 gap-2">
              {INCOTERMS.map(it => {
                const isSelected = compareList.includes(it.code);
                const isDisabled = !isSelected && compareList.length >= 4;
                return (
                  <button
                    key={it.code}
                    onClick={() => toggleCompare(it.code)}
                    disabled={isDisabled}
                    className="p-2 rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    style={isSelected
                      ? { borderColor: BLUE, background: BLUE, color: '#FFFFFF' }
                      : { borderColor: '#E2E8F0', background: '#FFFFFF', color: '#0F172A' }}
                  >
                    <div className="font-bricolage font-bold text-sm leading-tight">{it.code}</div>
                    <div className="font-jetbrains text-[9px] mt-0.5" style={isSelected ? { color: 'rgba(255,255,255,0.7)' } : { color: '#64748B' }}>{it.family}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {compareList.length < 2 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-16 text-center">
              <Map size={28} className="mx-auto mb-4" style={{ color: '#94A3B8' }} strokeWidth={1.5} />
              <div className="font-bricolage text-lg text-slate-800 mb-1">Sélectionnez au moins 2 incoterms</div>
              <div className="text-sm text-slate-500">pour démarrer la comparaison côte à côte</div>
            </div>
          ) : (
            <>
              {/* Timelines empilées */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 font-jetbrains text-xs text-slate-600">
                    <Map size={13} />
                    TIMELINES COMPARÉES
                  </div>
                  <div className="flex items-center gap-3 font-jetbrains text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: BLUE }} />coûts vendeur</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: ORANGE }} />risques vendeur</span>
                  </div>
                </div>
                <div className="p-6 space-y-7" style={{ background: 'repeating-linear-gradient(45deg, #F8FAFC 0, #F8FAFC 14px, #F1F5F9 14px, #F1F5F9 15px)' }}>
                  {compareList.map(code => {
                    const it = INCOTERMS.find(i => i.code === code);
                    return <IncotermTimeline key={code} incoterm={it} showLabel />;
                  })}
                </div>
              </div>

              {/* Tableau comparatif obligations */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600">TABLEAU COMPARATIF — QUI PAIE QUOI ?</div>
                <ObligationsTable incoterms={compareList.map(c => INCOTERMS.find(i => i.code === c))} compact />
              </div>

              {/* Résumés courts */}
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(compareList.length, 4)}, minmax(0, 1fr))` }}>
                {compareList.map(code => {
                  const it = INCOTERMS.find(i => i.code === code);
                  const fam = INCOTERM_FAMILIES.find(f => f.id === it.family);
                  return (
                    <div key={code} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bricolage font-bold text-xl" style={{ color: BLUE }}>{it.code}</span>
                        <span className="font-jetbrains text-[9px] tracking-wider" style={{ color: fam.color }}>● {it.family}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mb-2">{it.nameFr}</div>
                      <div className="text-[12px] text-slate-700 leading-snug">{it.summary}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Visualisation timeline : 7 étapes + barres coûts/risques
function IncotermTimeline({ incoterm, showLabel = false }) {
  const STEP_COUNT = SUPPLY_CHAIN_STEPS.length;
  const VB_W = 1000;
  const VB_H = 200;
  const PADDING_X = 40;
  const TRACK_Y = 110;
  const stepX = (i) => PADDING_X + (i * (VB_W - 2 * PADDING_X)) / (STEP_COUNT - 1);

  const costEndX = stepX(incoterm.costTransfer);
  const riskEndX = stepX(incoterm.riskTransfer);

  // Barres : du début jusqu'au point de transfert
  return (
    <div>
      {showLabel && (
        <div className="flex items-baseline gap-2 mb-2 px-1">
          <span className="font-bricolage font-bold text-lg" style={{ color: BLUE }}>{incoterm.code}</span>
          <span className="font-bricolage text-sm text-slate-700">{incoterm.name}</span>
          <span className="font-jetbrains text-[10px] text-slate-500 ml-auto">{incoterm.nameFr}</span>
        </div>
      )}
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" style={{ maxHeight: showLabel ? 180 : 240 }}>
        <defs>
          <pattern id={`stripes-${incoterm.code}`} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0,0,0,0.05)" strokeWidth="6" />
          </pattern>
        </defs>

        {/* Ligne de fond (chaîne logistique) */}
        <line x1={stepX(0)} y1={TRACK_Y} x2={stepX(STEP_COUNT - 1)} y2={TRACK_Y} stroke="#CBD5E1" strokeWidth="2" strokeDasharray="4 3" />

        {/* Barre coûts vendeur (bleu) */}
        {incoterm.costTransfer > 0 && (
          <rect
            x={stepX(0)}
            y={TRACK_Y - 28}
            width={costEndX - stepX(0)}
            height={10}
            fill={BLUE}
            rx="2"
          />
        )}

        {/* Barre risques vendeur (orange) */}
        {incoterm.riskTransfer > 0 && (
          <rect
            x={stepX(0)}
            y={TRACK_Y + 18}
            width={riskEndX - stepX(0)}
            height={10}
            fill={ORANGE}
            rx="2"
          />
        )}

        {/* Labels barres */}
        {incoterm.costTransfer > 0 && (
          <text x={stepX(0) + 6} y={TRACK_Y - 33} fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#FFFFFF" fontWeight="600" style={{ paintOrder: 'stroke', stroke: BLUE, strokeWidth: 3 }}>
            COÛTS VENDEUR
          </text>
        )}
        {incoterm.riskTransfer > 0 && (
          <text x={stepX(0) + 6} y={TRACK_Y + 26} fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#FFFFFF" fontWeight="600" style={{ paintOrder: 'stroke', stroke: ORANGE, strokeWidth: 3 }}>
            RISQUES VENDEUR
          </text>
        )}

        {/* Marqueurs de transfert avec flèches */}
        {incoterm.costTransfer === incoterm.riskTransfer ? (
          // Même point : un seul marqueur
          <g>
            <line x1={costEndX} y1={TRACK_Y - 50} x2={costEndX} y2={TRACK_Y + 50} stroke="#0F172A" strokeWidth="2" strokeDasharray="3 2" />
            <circle cx={costEndX} cy={TRACK_Y - 50} r="4" fill="#0F172A" />
            <text x={costEndX} y={TRACK_Y - 58} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#0F172A" fontWeight="700">TRANSFERT</text>
          </g>
        ) : (
          <>
            {/* Transfert coûts (au-dessus) */}
            <g>
              <line x1={costEndX} y1={TRACK_Y - 50} x2={costEndX} y2={TRACK_Y - 18} stroke={BLUE} strokeWidth="2" strokeDasharray="3 2" />
              <circle cx={costEndX} cy={TRACK_Y - 50} r="4" fill={BLUE} />
              <text x={costEndX} y={TRACK_Y - 58} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono, monospace" fill={BLUE} fontWeight="700">↑ FIN COÛTS</text>
            </g>
            {/* Transfert risques (en-dessous) */}
            <g>
              <line x1={riskEndX} y1={TRACK_Y + 18} x2={riskEndX} y2={TRACK_Y + 50} stroke={ORANGE} strokeWidth="2" strokeDasharray="3 2" />
              <circle cx={riskEndX} cy={TRACK_Y + 50} r="4" fill={ORANGE} />
              <text x={riskEndX} y={TRACK_Y + 63} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono, monospace" fill={ORANGE} fontWeight="700">↓ FIN RISQUES</text>
            </g>
          </>
        )}

        {/* Étapes (pictos + labels) */}
        {SUPPLY_CHAIN_STEPS.map((step, i) => {
          const x = stepX(i);
          return (
            <g key={step.id}>
              <circle cx={x} cy={TRACK_Y} r="6" fill="#FFFFFF" stroke="#475569" strokeWidth="1.5" />
              <text x={x} y={TRACK_Y + 80} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono, monospace" fill="#475569" fontWeight="500">
                {step.short}
              </text>
              {i === 0 && (
                <text x={x} y={TRACK_Y + 92} textAnchor="middle" fontSize="8" fontFamily="JetBrains Mono, monospace" fill="#94A3B8">départ</text>
              )}
              {i === STEP_COUNT - 1 && (
                <text x={x} y={TRACK_Y + 92} textAnchor="middle" fontSize="8" fontFamily="JetBrains Mono, monospace" fill="#94A3B8">arrivée</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Tableau "qui paie quoi" avec une colonne par incoterm
function ObligationsTable({ incoterms, compact = false }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/50">
            <th className="px-3 py-2.5 text-left font-jetbrains text-[10px] tracking-wider text-slate-500">OBLIGATION</th>
            {incoterms.map(it => (
              <th key={it.code} className="px-3 py-2.5 text-center font-jetbrains text-[10px] tracking-wider" style={{ color: BLUE }}>
                {it.code}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {OBLIGATIONS.map(ob => (
            <tr key={ob.key} className="border-b border-slate-100">
              <td className="px-3 py-2">
                <div className="font-medium text-slate-800 text-[12px]">{ob.label}</div>
                {!compact && <div className="font-jetbrains text-[9px] text-slate-400 mt-0.5">{ob.hint}</div>}
              </td>
              {incoterms.map(it => {
                const who = it.obligations[ob.key];
                const isSeller = who === 'seller';
                return (
                  <td key={it.code} className="px-3 py-2 text-center">
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full font-jetbrains text-[10px] font-bold"
                      style={isSeller
                        ? { background: BLUE_LIGHT, color: BLUE, border: `1.5px solid ${BLUE}` }
                        : { background: ORANGE_LIGHT, color: ORANGE, border: `1.5px solid ${ORANGE}` }}
                      title={isSeller ? 'Vendeur' : 'Acheteur'}
                    >
                      {isSeller ? 'V' : 'A'}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-4 font-jetbrains text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold" style={{ background: BLUE_LIGHT, color: BLUE, border: `1.5px solid ${BLUE}` }}>V</span>
          à charge du vendeur
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold" style={{ background: ORANGE_LIGHT, color: ORANGE, border: `1.5px solid ${ORANGE}` }}>A</span>
          à charge de l'acheteur
        </span>
      </div>
    </div>
  );
}

// ============================================================
// CMR / eCMR · Générateur de lettres de voiture internationale
// Convention de Genève 19/05/1956 + Protocole additionnel eCMR
// ============================================================

const CMR_COUNTRIES = [
  'FR', 'BE', 'NL', 'DE', 'IT', 'ES', 'PT', 'LU', 'CH', 'AT',
  'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR', 'DK', 'SE', 'FI',
  'NO', 'IE', 'GB', 'TR', 'MA', 'TN', 'DZ', 'RU', 'UA', 'BA',
  'HR', 'SI', 'RS', 'EE', 'LV', 'LT', 'MD', 'MK', 'AL', 'CY',
];

const EMPTY_PARTY = () => ({
  name: '', address: '', postalCode: '', city: '', country: 'FR', contact: '',
});

const EMPTY_GOODS_ROW = () => ({
  id: 'g-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
  marks: '', packages: '', packaging: '', nature: '',
  statisticalNumber: '', grossWeight: '', volume: '',
});

const generateCmrNumber = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `ATL-CMR-${y}${m}${day}-${rand}`;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const ADDRESS_BOOK_KEY = 'atelier-cmr-addressbook-v1';

function loadAddressBook() {
  try {
    const raw = localStorage.getItem(ADDRESS_BOOK_KEY);
    if (!raw) return { senders: [], receivers: [], carriers: [] };
    const parsed = JSON.parse(raw);
    return {
      senders: Array.isArray(parsed.senders) ? parsed.senders : [],
      receivers: Array.isArray(parsed.receivers) ? parsed.receivers : [],
      carriers: Array.isArray(parsed.carriers) ? parsed.carriers : [],
    };
  } catch {
    return { senders: [], receivers: [], carriers: [] };
  }
}

function saveAddressBook(book) {
  try { localStorage.setItem(ADDRESS_BOOK_KEY, JSON.stringify(book)); }
  catch { /* localStorage full or unavailable */ }
}

function CmrGenerator({ onBack }) {
  const [mode, setMode] = useState('standard'); // 'standard' | 'electronic'

  // États CMR (24 cases)
  const [cmrNumber, setCmrNumber] = useState(generateCmrNumber);
  const [sender, setSender] = useState(EMPTY_PARTY());        // case 1
  const [receiver, setReceiver] = useState(EMPTY_PARTY());    // case 2
  const [deliveryPlace, setDeliveryPlace] = useState({ place: '', country: 'FR' }); // case 3
  const [pickupPlace, setPickupPlace] = useState({ place: '', country: 'FR', date: todayIso() }); // case 4
  const [attachedDocs, setAttachedDocs] = useState('');       // case 5
  const [goods, setGoods] = useState([EMPTY_GOODS_ROW()]);    // cases 6-12
  const [senderInstructions, setSenderInstructions] = useState(''); // case 13
  const [freightPayment, setFreightPayment] = useState('Franco'); // case 14
  const [codAmount, setCodAmount] = useState('');             // case 15
  const [carrier, setCarrier] = useState(EMPTY_PARTY());      // case 16
  const [successiveCarriers, setSuccessiveCarriers] = useState(''); // case 17
  const [reservations, setReservations] = useState('');       // case 18
  const [specialAgreements, setSpecialAgreements] = useState(''); // case 19
  // case 20 (charges) : tableau payeur / montant
  const [charges, setCharges] = useState([
    { id: 'c1', label: 'Prix de transport', sender: '', receiver: '' },
    { id: 'c2', label: 'Réductions', sender: '', receiver: '' },
    { id: 'c3', label: 'Suppléments', sender: '', receiver: '' },
    { id: 'c4', label: 'Frais accessoires', sender: '', receiver: '' },
  ]);
  const [currency, setCurrency] = useState('EUR');
  const [issuedAt, setIssuedAt] = useState('');               // case 21 lieu
  const [issuedDate, setIssuedDate] = useState(todayIso());   // case 21 date

  // Carnet d'adresses
  const [addressBook, setAddressBook] = useState(loadAddressBook);
  const [savedToast, setSavedToast] = useState(null);

  // jsPDF loading avec fallback CDN
  const [pdfLibReady, setPdfLibReady] = useState(false);
  useEffect(() => {
    if (window.jspdf) { setPdfLibReady(true); return; }
    loadScriptWithFallback(CDN_JSPDF, () => !!window.jspdf)
      .then(() => setPdfLibReady(true))
      .catch(() => setPdfLibReady(false));
  }, []);

  // bwip-js loading for QR code (mode eCMR) avec fallback CDN
  const [bwipReady, setBwipReady] = useState(false);
  useEffect(() => {
    if (window.bwipjs) { setBwipReady(true); return; }
    loadScriptWithFallback(CDN_BWIP, () => !!window.bwipjs)
      .then(() => setBwipReady(true))
      .catch(() => setBwipReady(false));
  }, []);

  const updateGoodsRow = (id, key, val) => {
    setGoods(rs => rs.map(r => r.id === id ? { ...r, [key]: val } : r));
  };
  const addGoodsRow = () => setGoods(rs => [...rs, EMPTY_GOODS_ROW()]);
  const removeGoodsRow = (id) => setGoods(rs => rs.length > 1 ? rs.filter(r => r.id !== id) : rs);

  const updateCharge = (id, key, val) => {
    setCharges(cs => cs.map(c => c.id === id ? { ...c, [key]: val } : c));
  };

  // Carnet
  const saveToBook = (type) => {
    const party = type === 'sender' ? sender : type === 'receiver' ? receiver : carrier;
    if (!party.name.trim()) {
      setSavedToast({ type: 'error', text: 'Renseignez au moins le nom avant de sauvegarder' });
      setTimeout(() => setSavedToast(null), 3000);
      return;
    }
    const key = type === 'sender' ? 'senders' : type === 'receiver' ? 'receivers' : 'carriers';
    const entry = { ...party, id: 'pb-' + Date.now() };
    const newBook = { ...addressBook, [key]: [...addressBook[key].filter(e => e.name !== party.name), entry] };
    setAddressBook(newBook);
    saveAddressBook(newBook);
    setSavedToast({ type: 'success', text: `« ${party.name} » ajouté au carnet d'adresses` });
    setTimeout(() => setSavedToast(null), 3000);
  };

  const loadFromBook = (type, id) => {
    const key = type === 'sender' ? 'senders' : type === 'receiver' ? 'receivers' : 'carriers';
    const entry = addressBook[key].find(e => e.id === id);
    if (!entry) return;
    const { id: _, ...rest } = entry;
    if (type === 'sender') setSender(rest);
    else if (type === 'receiver') setReceiver(rest);
    else setCarrier(rest);
  };

  const deleteFromBook = (type, id) => {
    const key = type === 'sender' ? 'senders' : type === 'receiver' ? 'receivers' : 'carriers';
    const newBook = { ...addressBook, [key]: addressBook[key].filter(e => e.id !== id) };
    setAddressBook(newBook);
    saveAddressBook(newBook);
  };

  // Validation light
  const validation = useMemo(() => {
    const issues = [];
    if (!sender.name.trim()) issues.push('Expéditeur sans nom');
    if (!receiver.name.trim()) issues.push('Destinataire sans nom');
    if (!carrier.name.trim()) issues.push('Transporteur sans nom');
    if (!pickupPlace.place.trim()) issues.push('Lieu de prise en charge manquant');
    if (!deliveryPlace.place.trim()) issues.push('Lieu de livraison manquant');
    const filled = goods.filter(g => g.nature.trim() || g.packages.trim());
    if (filled.length === 0) issues.push('Aucune marchandise renseignée');
    return { issues, ready: issues.length === 0 };
  }, [sender, receiver, carrier, pickupPlace, deliveryPlace, goods]);

  // ============ Génération PDF ============
  const generatePdf = async (action = 'download') => {
    if (!pdfLibReady) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297, H = 210;
    const M = 8; // marge
    const cw = W - 2 * M; // largeur utile = 281mm

    let y = M;

    // ===== HEADER =====
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('LETTRE DE VOITURE INTERNATIONALE', W / 2, y + 4, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Convention relative au contrat de transport international de marchandises par route (CMR) — Genève, 19 mai 1956', W / 2, y + 7.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('CMR', M, y + 6);
    if (mode === 'electronic') {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('e-CMR · Protocole additionnel 2008', M, y + 9.5);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`N° ${cmrNumber}`, W - M, y + 4, { align: 'right' });
    doc.text(`Date : ${issuedDate}`, W - M, y + 8, { align: 'right' });

    y += 12;

    // ===== ROW : Parties (1, 16, 2) =====
    const colW = cw / 3;
    const partyH = 32;
    drawBox(doc, M, y, colW, partyH, '1', 'Expéditeur (nom, adresse, pays)', formatParty(sender));
    drawBox(doc, M + colW, y, colW, partyH, '16', 'Transporteur (nom, adresse, pays)', formatParty(carrier));
    drawBox(doc, M + 2 * colW, y, colW, partyH, '2', 'Destinataire (nom, adresse, pays)', formatParty(receiver));
    y += partyH;

    // ===== ROW : Lieux (3, 4, 17) =====
    const placeH = 20;
    drawBox(doc, M, y, colW, placeH, '3', 'Lieu prévu pour la livraison',
      `${deliveryPlace.place || ''}${deliveryPlace.country ? '\nPays : ' + deliveryPlace.country : ''}`);
    drawBox(doc, M + colW, y, colW, placeH, '4', 'Lieu et date de la prise en charge',
      `${pickupPlace.place || ''}${pickupPlace.country ? '\nPays : ' + pickupPlace.country : ''}${pickupPlace.date ? '\nDate : ' + pickupPlace.date : ''}`);
    drawBox(doc, M + 2 * colW, y, colW, placeH, '17', 'Transporteurs successifs', successiveCarriers);
    y += placeH;

    // ===== Case 5 : Documents annexés =====
    const docsH = 7;
    drawBox(doc, M, y, cw, docsH, '5', 'Documents annexés', attachedDocs, 7);
    y += docsH;

    // ===== Tableau marchandises (6 à 12) =====
    const goodsHeaderH = 8;
    const goodsRowH = 5;
    const filledGoods = goods.filter(g => g.nature.trim() || g.packages.trim() || g.marks.trim());
    const goodsRowsCount = Math.max(filledGoods.length, 3);
    const goodsTableH = goodsHeaderH + goodsRowsCount * goodsRowH;

    // En-têtes
    const colWidths = [40, 25, 28, 75, 30, 35, 25, 23];
    const colNumbers = ['6', '7', '8', '9', '10', '11', '12', ''];
    const colLabels = ['Marques & N°', 'Nbre colis', 'Mode emballage', 'Nature de la marchandise', 'N° statistique', 'Poids brut (kg)', 'Vol. (m³)', ''];
    let cx = M;
    for (let i = 0; i < 7; i++) {
      const cwd = colWidths[i] * (cw / colWidths.slice(0, 7).reduce((a, b) => a + b, 0));
      doc.rect(cx, y, cwd, goodsHeaderH);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text(colNumbers[i], cx + 1.5, y + 2.5);
      doc.setFont('helvetica', 'normal');
      doc.text(colLabels[i], cx + 4, y + 2.5);
      cx += cwd;
    }

    // Lignes marchandises
    const totalGoodsW = colWidths.slice(0, 7).reduce((a, b) => a + b, 0);
    for (let r = 0; r < goodsRowsCount; r++) {
      const row = filledGoods[r] || {};
      let cx2 = M;
      const values = [row.marks || '', row.packages || '', row.packaging || '', row.nature || '', row.statisticalNumber || '', row.grossWeight || '', row.volume || ''];
      for (let i = 0; i < 7; i++) {
        const cwd = colWidths[i] * (cw / totalGoodsW);
        doc.rect(cx2, y + goodsHeaderH + r * goodsRowH, cwd, goodsRowH);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        const txt = doc.splitTextToSize(String(values[i]), cwd - 2);
        doc.text(txt[0] || '', cx2 + 1, y + goodsHeaderH + r * goodsRowH + 3.3);
        cx2 += cwd;
      }
    }
    y += goodsTableH;

    // ===== Cases 13, 14, 15 =====
    const instrH = 14;
    const w13 = cw * 0.5, w14 = cw * 0.25, w15 = cw * 0.25;
    drawBox(doc, M, y, w13, instrH, '13', "Instructions de l'expéditeur (douanes, autres)", senderInstructions, 7);
    drawBox(doc, M + w13, y, w14, instrH, '14', "Prescriptions d'affranchissement", freightPayment, 7);
    drawBox(doc, M + w13 + w14, y, w15, instrH, '15', 'Remboursement', codAmount ? `${codAmount} ${currency}` : '', 7);
    y += instrH;

    // ===== Cases 18, 19 =====
    const obsH = 12;
    drawBox(doc, M, y, cw / 2, obsH, '18', 'Réserves et observations du transporteur', reservations, 7);
    drawBox(doc, M + cw / 2, y, cw / 2, obsH, '19', 'Conventions particulières', specialAgreements, 7);
    y += obsH;

    // ===== Case 20 : Charges =====
    const chargesHeaderH = 5;
    const chargesRowH = 5;
    const chargesH = chargesHeaderH + charges.length * chargesRowH + chargesRowH; // + ligne total
    const ccol = [cw * 0.55, cw * 0.2, cw * 0.2, cw * 0.05];

    doc.rect(M, y, cw, chargesHeaderH);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('20', M + 1.5, y + 2.5);
    doc.text('À payer par :', M + 4, y + 2.5);
    let cx3 = M + ccol[0];
    doc.rect(cx3, y, ccol[1], chargesHeaderH);
    doc.text('Expéditeur', cx3 + 1, y + 2.5);
    cx3 += ccol[1];
    doc.rect(cx3, y, ccol[2], chargesHeaderH);
    doc.text('Destinataire', cx3 + 1, y + 2.5);
    cx3 += ccol[2];
    doc.rect(cx3, y, ccol[3], chargesHeaderH);
    doc.text(currency, cx3 + 1, y + 2.5);

    // Lignes
    let sumSender = 0, sumReceiver = 0;
    charges.forEach((c, i) => {
      const ry = y + chargesHeaderH + i * chargesRowH;
      doc.rect(M, ry, ccol[0], chargesRowH);
      doc.rect(M + ccol[0], ry, ccol[1], chargesRowH);
      doc.rect(M + ccol[0] + ccol[1], ry, ccol[2], chargesRowH);
      doc.rect(M + ccol[0] + ccol[1] + ccol[2], ry, ccol[3], chargesRowH);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(c.label, M + 4, ry + 3.3);
      if (c.sender) { doc.text(String(c.sender), M + ccol[0] + ccol[1] - 1, ry + 3.3, { align: 'right' }); sumSender += parseFloat(c.sender) || 0; }
      if (c.receiver) { doc.text(String(c.receiver), M + ccol[0] + ccol[1] + ccol[2] - 1, ry + 3.3, { align: 'right' }); sumReceiver += parseFloat(c.receiver) || 0; }
    });
    // Total
    const ty = y + chargesHeaderH + charges.length * chargesRowH;
    doc.setDrawColor(0); doc.setFillColor(245, 245, 245);
    doc.rect(M, ty, ccol[0], chargesRowH, 'FD');
    doc.rect(M + ccol[0], ty, ccol[1], chargesRowH, 'FD');
    doc.rect(M + ccol[0] + ccol[1], ty, ccol[2], chargesRowH, 'FD');
    doc.rect(M + ccol[0] + ccol[1] + ccol[2], ty, ccol[3], chargesRowH, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.text('Total', M + 4, ty + 3.3);
    if (sumSender > 0) doc.text(sumSender.toFixed(2), M + ccol[0] + ccol[1] - 1, ty + 3.3, { align: 'right' });
    if (sumReceiver > 0) doc.text(sumReceiver.toFixed(2), M + ccol[0] + ccol[1] + ccol[2] - 1, ty + 3.3, { align: 'right' });
    y += chargesH;

    // ===== Case 21 : Établie =====
    const issuedH = 6;
    drawBox(doc, M, y, cw, issuedH, '21', `Établie à : ${issuedAt || '____________'}      Le : ${issuedDate || '__________'}`, '', 7);
    y += issuedH;

    // ===== Signatures (22, 23, 24) + QR =====
    const sigH = H - M - y - 2;
    const sigW = mode === 'electronic' ? cw * 0.7 / 3 : cw / 3;
    drawBox(doc, M, y, sigW, sigH, '22', "Signature et timbre de l'expéditeur", '', 7);
    drawBox(doc, M + sigW, y, sigW, sigH, '23', 'Signature et timbre du transporteur', '', 7);
    drawBox(doc, M + 2 * sigW, y, sigW, sigH, '24', 'Signature et timbre du destinataire', '', 7);

    if (mode === 'electronic') {
      const qrX = M + 3 * sigW;
      const qrW = cw * 0.3;
      doc.rect(qrX, y, qrW, sigH);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text('eCMR', qrX + 1.5, y + 2.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('Document électronique', qrX + 1.5, y + 6);
      doc.text(`ID : ${cmrNumber}`, qrX + 1.5, y + 9.5);
      doc.text(`Émis : ${new Date().toLocaleString('fr-FR')}`, qrX + 1.5, y + 13);
      doc.setFontSize(6);
      doc.text('Vérifiable via QR code', qrX + 1.5, y + 16.5);

      // Générer le QR code
      if (bwipReady && window.bwipjs) {
        try {
          const canvas = document.createElement('canvas');
          window.bwipjs.toCanvas(canvas, {
            bcid: 'qrcode',
            text: JSON.stringify({ id: cmrNumber, sender: sender.name, receiver: receiver.name, date: issuedDate }),
            scale: 4,
            includetext: false,
          });
          const dataUrl = canvas.toDataURL('image/png');
          const qrSize = Math.min(sigH - 8, qrW - 3);
          doc.addImage(dataUrl, 'PNG', qrX + qrW - qrSize - 2, y + sigH - qrSize - 2, qrSize, qrSize);
        } catch (e) { /* QR generation failed silently */ }
      }
    }

    // Bottom mentions
    doc.setFontSize(5.5);
    doc.setTextColor(120);
    doc.text(`Document généré par Atelier Logistique — WALYCONSEIL · ${new Date().toLocaleString('fr-FR')}`, M, H - 2);
    doc.setTextColor(0);

    if (action === 'print') {
      doc.autoPrint();
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } else if (action === 'open') {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } else {
      doc.save(`${cmrNumber}.pdf`);
    }
  };

  const exportJson = () => {
    const payload = {
      mode, cmrNumber, sender, receiver, carrier,
      pickupPlace, deliveryPlace, attachedDocs, goods,
      senderInstructions, freightPayment, codAmount, currency,
      successiveCarriers, reservations, specialAgreements,
      charges, issuedAt, issuedDate,
      emittedAt: new Date().toISOString(),
      protocol: mode === 'electronic' ? 'eCMR Additional Protocol 2008' : 'CMR Geneva 1956',
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${cmrNumber}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    if (!window.confirm('Réinitialiser tous les champs ?')) return;
    setCmrNumber(generateCmrNumber());
    setSender(EMPTY_PARTY()); setReceiver(EMPTY_PARTY()); setCarrier(EMPTY_PARTY());
    setPickupPlace({ place: '', country: 'FR', date: todayIso() });
    setDeliveryPlace({ place: '', country: 'FR' });
    setAttachedDocs(''); setGoods([EMPTY_GOODS_ROW()]);
    setSenderInstructions(''); setFreightPayment('Franco'); setCodAmount('');
    setSuccessiveCarriers(''); setReservations(''); setSpecialAgreements('');
    setCharges([
      { id: 'c1', label: 'Prix de transport', sender: '', receiver: '' },
      { id: 'c2', label: 'Réductions', sender: '', receiver: '' },
      { id: 'c3', label: 'Suppléments', sender: '', receiver: '' },
      { id: 'c4', label: 'Frais accessoires', sender: '', receiver: '' },
    ]);
    setIssuedAt(''); setIssuedDate(todayIso());
  };

  const totalWeight = useMemo(() => {
    return goods.reduce((sum, g) => sum + (parseFloat(g.grossWeight) || 0), 0);
  }, [goods]);
  const totalVolume = useMemo(() => {
    return goods.reduce((sum, g) => sum + (parseFloat(g.volume) || 0), 0);
  }, [goods]);

  return (
    <div className="min-h-screen text-slate-900" style={{ background: '#F8FAFC', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <FontsAndStyles />

      <nav className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-5">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-jetbrains text-xs">
              <ArrowLeft size={14} />
              RETOUR
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-3">
              <Logo small />
              <div>
                <div className="font-bricolage font-semibold text-sm leading-tight text-slate-900">Lettre de voiture CMR / eCMR</div>
                <div className="font-jetbrains text-[10px] text-slate-500">ATELIER / 06</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 p-1 rounded-lg border border-slate-200 bg-slate-50">
              <button onClick={() => setMode('standard')}
                className="px-3 py-1.5 rounded-md font-jetbrains text-xs transition-all"
                style={mode === 'standard'
                  ? { background: '#FFFFFF', color: BLUE, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
                  : { color: '#64748B' }}>
                CMR PAPIER
              </button>
              <button onClick={() => setMode('electronic')}
                className="px-3 py-1.5 rounded-md font-jetbrains text-xs transition-all flex items-center gap-1.5"
                style={mode === 'electronic'
                  ? { background: '#FFFFFF', color: BLUE, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
                  : { color: '#64748B' }}>
                eCMR
                {mode === 'electronic' && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: BLUE }} />}
              </button>
            </div>
            <button onClick={() => generatePdf('download')} disabled={!pdfLibReady || !validation.ready}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md font-jetbrains text-xs font-semibold text-white shadow-sm transition-all hover:translate-y-[-1px] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: BLUE }} title={!validation.ready ? 'Complétez les champs obligatoires' : 'Télécharger PDF'}>
              <Download size={13} />
              TÉLÉCHARGER PDF
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* COLONNE GAUCHE : FORMULAIRE */}
        <div className="lg:col-span-8 space-y-4">

          {/* Numéro + dates */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1.5 block">N° CMR</label>
                <input value={cmrNumber} onChange={e => setCmrNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none font-jetbrains text-sm focus:border-blue-400 transition-colors" />
              </div>
              <div>
                <label className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1.5 block">DATE D'ÉMISSION</label>
                <input type="date" value={issuedDate} onChange={e => setIssuedDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none font-jetbrains text-sm focus:border-blue-400 transition-colors" />
              </div>
              <div>
                <label className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1.5 block">LIEU D'ÉMISSION (case 21)</label>
                <input value={issuedAt} onChange={e => setIssuedAt(e.target.value)} placeholder="ex : Casablanca"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none text-sm focus:border-blue-400 transition-colors" />
              </div>
            </div>
          </div>

          {/* PARTIES */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600">PARTIES (cases 1, 2, 16)</div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <PartyForm label="1. Expéditeur" tone="sender" party={sender} setParty={setSender}
                book={addressBook.senders} onLoadBook={(id) => loadFromBook('sender', id)} onSaveBook={() => saveToBook('sender')} onDeleteBook={(id) => deleteFromBook('sender', id)} />
              <PartyForm label="16. Transporteur" tone="carrier" party={carrier} setParty={setCarrier}
                book={addressBook.carriers} onLoadBook={(id) => loadFromBook('carrier', id)} onSaveBook={() => saveToBook('carrier')} onDeleteBook={(id) => deleteFromBook('carrier', id)} />
              <PartyForm label="2. Destinataire" tone="receiver" party={receiver} setParty={setReceiver}
                book={addressBook.receivers} onLoadBook={(id) => loadFromBook('receiver', id)} onSaveBook={() => saveToBook('receiver')} onDeleteBook={(id) => deleteFromBook('receiver', id)} />
            </div>
          </div>

          {/* TRAJET */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600">TRAJET (cases 3, 4)</div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-2">4. PRISE EN CHARGE</div>
                <div className="space-y-2">
                  <input value={pickupPlace.place} onChange={e => setPickupPlace(p => ({ ...p, place: e.target.value }))} placeholder="Lieu (ville, adresse)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none text-sm focus:border-blue-400 transition-colors" />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={pickupPlace.country} onChange={e => setPickupPlace(p => ({ ...p, country: e.target.value }))}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none font-jetbrains text-sm">
                      {CMR_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="date" value={pickupPlace.date} onChange={e => setPickupPlace(p => ({ ...p, date: e.target.value }))}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none font-jetbrains text-sm" />
                  </div>
                </div>
              </div>
              <div>
                <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-2">3. LIVRAISON</div>
                <div className="space-y-2">
                  <input value={deliveryPlace.place} onChange={e => setDeliveryPlace(p => ({ ...p, place: e.target.value }))} placeholder="Lieu (ville, adresse)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none text-sm focus:border-blue-400 transition-colors" />
                  <select value={deliveryPlace.country} onChange={e => setDeliveryPlace(p => ({ ...p, country: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none font-jetbrains text-sm">
                    {CMR_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* MARCHANDISES */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="font-jetbrains text-xs text-slate-600">MARCHANDISES (cases 6 à 12)</div>
              <div className="font-jetbrains text-[10px] text-slate-500">
                Poids total : <span className="font-semibold text-slate-700">{totalWeight.toLocaleString('fr-FR')} kg</span>
                <span className="mx-2">·</span>
                Volume : <span className="font-semibold text-slate-700">{totalVolume.toLocaleString('fr-FR')} m³</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/30">
                    <Th>6. Marques & n°</Th>
                    <Th className="text-right">7. Colis</Th>
                    <Th>8. Emballage</Th>
                    <Th>9. Nature</Th>
                    <Th>10. N° statistique</Th>
                    <Th className="text-right">11. Poids brut (kg)</Th>
                    <Th className="text-right">12. Vol (m³)</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {goods.map(g => (
                    <tr key={g.id} className="border-b border-slate-100">
                      <Td><CellInput value={g.marks} onChange={v => updateGoodsRow(g.id, 'marks', v)} /></Td>
                      <Td><CellInput value={g.packages} onChange={v => updateGoodsRow(g.id, 'packages', v)} type="number" align="right" mono /></Td>
                      <Td><CellInput value={g.packaging} onChange={v => updateGoodsRow(g.id, 'packaging', v)} /></Td>
                      <Td><CellInput value={g.nature} onChange={v => updateGoodsRow(g.id, 'nature', v)} /></Td>
                      <Td><CellInput value={g.statisticalNumber} onChange={v => updateGoodsRow(g.id, 'statisticalNumber', v)} mono /></Td>
                      <Td><CellInput value={g.grossWeight} onChange={v => updateGoodsRow(g.id, 'grossWeight', v)} type="number" align="right" mono step="0.1" /></Td>
                      <Td><CellInput value={g.volume} onChange={v => updateGoodsRow(g.id, 'volume', v)} type="number" align="right" mono step="0.01" /></Td>
                      <Td>
                        <button onClick={() => removeGoodsRow(g.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors" disabled={goods.length === 1} title="Supprimer">×</button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/30">
              <button onClick={addGoodsRow} className="font-jetbrains text-xs text-slate-700 hover:text-slate-900 transition-colors">
                + AJOUTER UNE LIGNE
              </button>
            </div>
          </div>

          {/* DOCS & INSTRUCTIONS */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600">DOCUMENTS & INSTRUCTIONS (cases 5, 13, 14, 15)</div>
            <div className="p-4 space-y-3">
              <div>
                <label className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1.5 block">5. DOCUMENTS ANNEXÉS</label>
                <textarea rows="2" value={attachedDocs} onChange={e => setAttachedDocs(e.target.value)} placeholder="ex : facture commerciale n°2023-001, certificat d'origine, packing list"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none text-sm focus:border-blue-400 transition-colors resize-none" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1.5 block">13. INSTRUCTIONS EXPÉDITEUR</label>
                  <textarea rows="3" value={senderInstructions} onChange={e => setSenderInstructions(e.target.value)} placeholder="Instructions douane, manipulation, etc."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none text-sm focus:border-blue-400 transition-colors resize-none" />
                </div>
                <div>
                  <label className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1.5 block">14. AFFRANCHISSEMENT</label>
                  <select value={freightPayment} onChange={e => setFreightPayment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none text-sm focus:border-blue-400 transition-colors">
                    <option value="Franco">Franco</option>
                    <option value="Non franco">Non franco</option>
                    <option value="Port dû">Port dû</option>
                    <option value="Port payé">Port payé</option>
                  </select>
                </div>
                <div>
                  <label className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1.5 block">15. REMBOURSEMENT (montant)</label>
                  <div className="flex gap-2">
                    <input value={codAmount} onChange={e => setCodAmount(e.target.value)} type="number" step="0.01" placeholder="0.00"
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none font-jetbrains text-sm focus:border-blue-400 transition-colors" />
                    <select value={currency} onChange={e => setCurrency(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none font-jetbrains text-sm">
                      <option>EUR</option><option>USD</option><option>MAD</option><option>GBP</option><option>CHF</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SUCCESSEURS & RÉSERVES */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600">TRANSPORTEURS & OBSERVATIONS (cases 17, 18, 19)</div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1.5 block">17. TRANSPORTEURS SUCCESSIFS</label>
                <textarea rows="3" value={successiveCarriers} onChange={e => setSuccessiveCarriers(e.target.value)} placeholder="Si plusieurs transporteurs interviennent"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none text-sm focus:border-blue-400 transition-colors resize-none" />
              </div>
              <div>
                <label className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1.5 block">18. RÉSERVES DU TRANSPORTEUR</label>
                <textarea rows="3" value={reservations} onChange={e => setReservations(e.target.value)} placeholder="État apparent, emballage, etc."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none text-sm focus:border-blue-400 transition-colors resize-none" />
              </div>
              <div>
                <label className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1.5 block">19. CONVENTIONS PARTICULIÈRES</label>
                <textarea rows="3" value={specialAgreements} onChange={e => setSpecialAgreements(e.target.value)} placeholder="Accords spécifiques (température, délais, etc.)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none text-sm focus:border-blue-400 transition-colors resize-none" />
              </div>
            </div>
          </div>

          {/* CHARGES */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600">À PAYER PAR (case 20) — devise : {currency}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/30">
                    <Th>Catégorie</Th>
                    <Th className="text-right">Expéditeur</Th>
                    <Th className="text-right">Destinataire</Th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map(c => (
                    <tr key={c.id} className="border-b border-slate-100">
                      <Td className="text-slate-700">{c.label}</Td>
                      <Td><CellInput value={c.sender} onChange={v => updateCharge(c.id, 'sender', v)} type="number" align="right" mono step="0.01" /></Td>
                      <Td><CellInput value={c.receiver} onChange={v => updateCharge(c.id, 'receiver', v)} type="number" align="right" mono step="0.01" /></Td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/50 font-semibold">
                    <Td className="text-slate-800">Total</Td>
                    <Td className="text-right font-jetbrains text-slate-800">
                      {charges.reduce((s, c) => s + (parseFloat(c.sender) || 0), 0).toFixed(2)}
                    </Td>
                    <Td className="text-right font-jetbrains text-slate-800">
                      {charges.reduce((s, c) => s + (parseFloat(c.receiver) || 0), 0).toFixed(2)}
                    </Td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* COLONNE DROITE : APERÇU + ACTIONS (sticky) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="sticky top-[88px] space-y-4">

            {/* Statut */}
            <div className="rounded-xl border p-4" style={validation.ready
              ? { borderColor: '#A7F3D0', background: '#ECFDF5' }
              : { borderColor: '#FCD34D', background: '#FFFBEB' }}>
              <div className="font-jetbrains text-[10px] tracking-wider font-semibold mb-2"
                style={{ color: validation.ready ? '#065F46' : '#92400E' }}>
                {validation.ready ? '✓ CMR PRÊTE' : `⚠ ${validation.issues.length} ÉLÉMENT${validation.issues.length > 1 ? 'S' : ''} MANQUANT${validation.issues.length > 1 ? 'S' : ''}`}
              </div>
              {validation.ready ? (
                <div className="text-xs text-emerald-800">Tous les champs obligatoires sont renseignés. Vous pouvez générer le document.</div>
              ) : (
                <ul className="text-xs space-y-0.5 text-amber-800">
                  {validation.issues.map((iss, i) => <li key={i}>· {iss}</li>)}
                </ul>
              )}
            </div>

            {/* Résumé */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 text-xs">
              <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-2">RÉSUMÉ</div>
              <SummaryRow label="N°" value={cmrNumber} mono />
              <SummaryRow label="Mode" value={mode === 'standard' ? 'CMR papier (4 exemplaires)' : 'eCMR électronique'} />
              <SummaryRow label="Expéditeur" value={sender.name || '—'} />
              <SummaryRow label="Destinataire" value={receiver.name || '—'} />
              <SummaryRow label="Transporteur" value={carrier.name || '—'} />
              <SummaryRow label="Trajet" value={
                pickupPlace.place && deliveryPlace.place
                  ? `${pickupPlace.place} (${pickupPlace.country}) → ${deliveryPlace.place} (${deliveryPlace.country})`
                  : '—'
              } />
              <SummaryRow label="Marchandises" value={`${goods.filter(g => g.nature || g.marks).length} ligne(s) · ${totalWeight} kg`} />
            </div>

            {/* Actions */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-2">ACTIONS</div>
              <button onClick={() => generatePdf('open')} disabled={!pdfLibReady || !validation.ready}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md font-jetbrains text-xs border border-slate-300 hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                <FileText size={13} />
                APERÇU PDF (nouvel onglet)
              </button>
              <button onClick={() => generatePdf('print')} disabled={!pdfLibReady || !validation.ready}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md font-jetbrains text-xs border border-slate-300 hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                IMPRIMER
              </button>
              <button onClick={exportJson}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md font-jetbrains text-xs border border-slate-300 hover:bg-slate-50 transition-all">
                <Download size={13} />
                EXPORTER JSON (intégration TMS)
              </button>
              <button onClick={resetForm}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md font-jetbrains text-xs text-red-600 border border-red-200 hover:bg-red-50 transition-all">
                RÉINITIALISER
              </button>
              {!pdfLibReady && (
                <div className="text-[10px] text-slate-500 text-center pt-1">Chargement de la librairie PDF…</div>
              )}
            </div>

            {/* Info mode */}
            <div className="rounded-xl border border-slate-200 p-4 text-xs leading-relaxed text-slate-600" style={{ background: BLUE_LIGHT, borderColor: '#BFDBFE' }}>
              <div className="font-jetbrains text-[10px] tracking-wider mb-2 font-semibold" style={{ color: BLUE }}>
                {mode === 'standard' ? 'CMR PAPIER · Convention de Genève 1956' : 'eCMR · Protocole additionnel 2008'}
              </div>
              {mode === 'standard' ? (
                <p>
                  Document à imprimer en 4 exemplaires (rouge : expéditeur · bleu : destinataire · vert : transporteur · noir : administration). Valeur probante reconnue dans les pays signataires de la Convention CMR.
                </p>
              ) : (
                <p>
                  Document électronique avec QR code horodaté et identifiant unique. Équivalence légale à la CMR papier dans les pays ayant ratifié le Protocole. Compatible avec le règlement européen <span className="font-semibold">eFTI 2026</span>.
                </p>
              )}
            </div>

            {savedToast && (
              <div className="rounded-lg p-2.5 font-jetbrains text-xs"
                style={savedToast.type === 'success'
                  ? { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }
                  : { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
                {savedToast.text}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helpers CMR
function drawBox(doc, x, y, w, h, num, label, content, fontSize = 8) {
  doc.setDrawColor(0);
  doc.rect(x, y, w, h);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text(String(num), x + 1.5, y + 2.5);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x + 4, y + 2.5);
  if (content) {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(String(content), w - 3);
    const maxLines = Math.max(1, Math.floor((h - 5) / (fontSize * 0.4)));
    doc.text(lines.slice(0, maxLines), x + 1.5, y + 6);
  }
}

function formatParty(p) {
  if (!p.name) return '';
  const lines = [p.name];
  if (p.address) lines.push(p.address);
  if (p.postalCode || p.city) lines.push(`${p.postalCode || ''} ${p.city || ''}`.trim());
  if (p.country) lines.push('Pays : ' + p.country);
  if (p.contact) lines.push('Tél/Email : ' + p.contact);
  return lines.join('\n');
}

function PartyForm({ label, tone, party, setParty, book, onLoadBook, onSaveBook, onDeleteBook }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-jetbrains text-[10px] tracking-wider" style={{ color: BLUE }}>{label}</div>
        {book && book.length > 0 && (
          <select onChange={e => { if (e.target.value) { onLoadBook(e.target.value); e.target.value = ''; } }} defaultValue=""
            className="font-jetbrains text-[10px] bg-transparent border-0 outline-none cursor-pointer text-slate-500 hover:text-slate-800">
            <option value="">📇 Carnet ({book.length})</option>
            {book.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        )}
      </div>
      <input value={party.name} onChange={e => setParty(p => ({ ...p, name: e.target.value }))} placeholder="Nom / raison sociale"
        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none text-sm focus:border-blue-400 transition-colors" />
      <input value={party.address} onChange={e => setParty(p => ({ ...p, address: e.target.value }))} placeholder="Adresse"
        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none text-sm focus:border-blue-400 transition-colors" />
      <div className="grid grid-cols-3 gap-2">
        <input value={party.postalCode} onChange={e => setParty(p => ({ ...p, postalCode: e.target.value }))} placeholder="CP"
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none font-jetbrains text-sm focus:border-blue-400 transition-colors" />
        <input value={party.city} onChange={e => setParty(p => ({ ...p, city: e.target.value }))} placeholder="Ville"
          className="col-span-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none text-sm focus:border-blue-400 transition-colors" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <select value={party.country} onChange={e => setParty(p => ({ ...p, country: e.target.value }))}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none font-jetbrains text-sm">
          {CMR_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={party.contact} onChange={e => setParty(p => ({ ...p, contact: e.target.value }))} placeholder="Tél / email"
          className="col-span-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none text-sm focus:border-blue-400 transition-colors" />
      </div>
      <button onClick={onSaveBook} className="w-full px-2 py-1.5 rounded-md font-jetbrains text-[10px] text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-dashed border-slate-300 transition-all">
        + AJOUTER AU CARNET D'ADRESSES
      </button>
    </div>
  );
}

function SummaryRow({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500 flex-shrink-0">{label}</span>
      <span className={`text-right text-slate-800 ${mono ? 'font-jetbrains' : ''}`} style={{ wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

// ============================================================
// Term · composant d'aide contextuelle (tooltip flottant)
// ============================================================
function Term({ abbr, full, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);

  const TOOLTIP_WIDTH = 280;

  const updatePos = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      let left = r.left + r.width / 2;
      const margin = 12;
      const halfW = TOOLTIP_WIDTH / 2;
      if (left + halfW > window.innerWidth - margin) left = window.innerWidth - halfW - margin;
      if (left - halfW < margin) left = halfW + margin;
      setPos({ top: r.top - 10, left });
    }
  };

  const show = () => { updatePos(); setOpen(true); };
  const hide = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onChange = () => updatePos();
    window.addEventListener('scroll', onChange, true);
    window.addEventListener('resize', onChange);
    return () => {
      window.removeEventListener('scroll', onChange, true);
      window.removeEventListener('resize', onChange);
    };
  }, [open]);

  return (
    <>
      <span
        ref={ref}
        className="cursor-help font-jetbrains"
        style={{ borderBottom: '1px dotted currentColor' }}
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={(e) => { e.stopPropagation(); open ? hide() : show(); }}
      >
        {abbr}
      </span>
      {open && (
        <span
          style={{
            display: 'block',
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: 'translate(-50%, -100%)',
            width: `${TOOLTIP_WIDTH}px`,
            background: '#0F172A',
            color: 'white',
            padding: '12px 14px',
            borderRadius: '8px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            zIndex: 9999,
            pointerEvents: 'none',
            fontFamily: "'DM Sans', sans-serif",
            letterSpacing: 'normal',
            textTransform: 'none',
            fontWeight: 400,
            fontSize: '12px',
            lineHeight: 1.5,
            textAlign: 'left',
            whiteSpace: 'normal',
          }}
        >
          <span style={{ display: 'block', fontWeight: 600, color: 'white', marginBottom: 4 }}>{full}</span>
          <span style={{ display: 'block', color: '#CBD5E1', lineHeight: 1.55 }}>{children}</span>
          <span
            style={{
              display: 'block',
              position: 'absolute',
              left: '50%',
              top: '100%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #0F172A',
            }}
          />
        </span>
      )}
    </>
  );
}

// Glossaire DDMRP — tous les termes méthodologiques
const DDMRP_TERMS = {
  ADU: {
    full: 'Average Daily Usage — Demande moyenne quotidienne',
    desc: "Consommation moyenne par jour de l'article, calculée sur les 3 à 6 derniers mois. C'est le moteur de tous les calculs DDMRP."
  },
  DLT: {
    full: 'Decoupled Lead Time — Délai d\'approvisionnement décou­plé',
    desc: "Durée totale nécessaire pour reconstituer le stock après commande (fournisseur ou production interne), exprimée en jours."
  },
  MOQ: {
    full: 'Minimum Order Quantity — Quantité minimale de commande',
    desc: "Quantité minimale imposée par le fournisseur ou la production. Force la zone verte du buffer à au moins ce niveau."
  },
  VF: {
    full: 'Variability Factor — Facteur de variabilité',
    desc: "Coefficient entre 0 et 1 qui calibre la zone rouge de sécurité. Plus la demande est volatile, plus le VF est élevé (0.25 faible, 0.50 moyenne, 0.75 forte)."
  },
  LTF: {
    full: 'Lead Time Factor — Facteur de délai',
    desc: "Coefficient entre 0 et 1 qui calibre les zones rouge et verte. Plus le délai est long, plus le LTF est bas — car le besoin est étalé dans le temps."
  },
  NFP: {
    full: 'Net Flow Position — Position nette du flux',
    desc: "Stock disponible + Commandes en cours − Demandes qualifiées. C'est le vrai indicateur de santé du buffer (pas le simple stock physique)."
  },
  TOR: {
    full: 'Top of Red — Plafond de la zone rouge',
    desc: "Niveau total de la zone rouge (base + sécurité). Si la NFP descend en-dessous, c'est une URGENCE — commander immédiatement."
  },
  TOY: {
    full: 'Top of Yellow — Plafond de la zone jaune',
    desc: "TOR + Zone jaune. Si la NFP passe sous ce seuil, il faut recommander une commande pour reconstituer le buffer."
  },
  TOG: {
    full: 'Top of Green — Plafond de la zone verte',
    desc: "TOY + Zone verte = stock cible maximum. La quantité suggérée à commander vise à ramener la NFP à ce niveau."
  },
  CV: {
    full: 'Coefficient of Variation — Coefficient de variation',
    desc: "Écart-type ÷ moyenne de la demande. Mesure la régularité : < 0.5 demande stable, > 1.0 demande très volatile."
  },
};

// Helper compact : <T code="ADU" /> rend un tooltip avec les infos du glossaire
function T({ code }) {
  const t = DDMRP_TERMS[code];
  if (!t) return <span>{code}</span>;
  return <Term abbr={code} full={t.full}>{t.desc}</Term>;
}

// ============================================================
// DDMRP · Buffers stratégiques (Demand Driven MRP)
// Méthodologie de Carol Ptak & Chad Smith
// ============================================================

const DDMRP_COLORS = {
  red:    { fill: '#FEE2E2', solid: '#DC2626', text: '#991B1B', label: 'URGENCE' },
  yellow: { fill: '#FEF3C7', solid: '#F59E0B', text: '#92400E', label: 'RECOMMANDER' },
  green:  { fill: '#D1FAE5', solid: '#10B981', text: '#065F46', label: 'OK' },
  blue:   { fill: '#DBEAFE', solid: '#3B82F6', text: '#1E40AF', label: 'SUR-STOCK' },
  stockout: { fill: '#F1F5F9', solid: '#1E293B', text: '#1E293B', label: 'RUPTURE' },
};

// Variability Factor presets (Demand Driven Institute standards)
const VF_PRESETS = [
  { value: 0.25, label: 'Faible', desc: 'CV < 0.5', cvMax: 0.5 },
  { value: 0.50, label: 'Moyenne', desc: 'CV 0.5–1.0', cvMax: 1.0 },
  { value: 0.75, label: 'Élevée', desc: 'CV > 1.0', cvMax: 999 },
];

// Lead Time Factor presets
const LTF_PRESETS = [
  { value: 0.30, label: 'Long LT', desc: '> 20 jours' },
  { value: 0.50, label: 'Moyen LT', desc: '5 – 20 jours' },
  { value: 0.70, label: 'Court LT', desc: '< 5 jours' },
];

// Suggérer LTF en fonction du DLT
function suggestLtf(dlt) {
  if (dlt > 20) return 0.30;
  if (dlt >= 5) return 0.50;
  return 0.70;
}

// Suggérer VF en fonction du coefficient de variation
function suggestVf(cv) {
  if (cv < 0.5) return 0.25;
  if (cv < 1.0) return 0.50;
  return 0.75;
}

function computeBuffer({ adu, dlt, moq, orderCycle, vf, ltf, nfp }) {
  if (adu <= 0 || dlt <= 0) {
    return { valid: false, reason: 'ADU et DLT doivent être > 0' };
  }
  const redBase = adu * dlt * ltf;
  const redSafety = redBase * vf;
  const redZone = redBase + redSafety;

  const yellowZone = adu * dlt;

  const greenLtf = adu * dlt * ltf;
  const greenMoq = moq || 0;
  const greenCycle = orderCycle > 0 ? adu * orderCycle : 0;
  const greenZone = Math.max(greenLtf, greenMoq, greenCycle);
  const greenDriver = greenZone === greenCycle && greenCycle > 0
    ? 'order_cycle'
    : greenZone === greenMoq && greenMoq > 0 && greenMoq >= greenLtf
    ? 'moq'
    : 'lead_time';

  const tor = redZone;
  const toy = tor + yellowZone;
  const tog = toy + greenZone;

  // Statut
  let status;
  if (nfp <= 0) status = 'stockout';
  else if (nfp <= tor) status = 'red';
  else if (nfp <= toy) status = 'yellow';
  else if (nfp <= tog) status = 'green';
  else status = 'blue';

  // Quantité à commander (si NFP ≤ TOY)
  let orderQty = 0;
  if (nfp <= toy) {
    orderQty = Math.max(0, tog - nfp);
    if (moq > 0 && orderQty > 0) {
      orderQty = Math.ceil(orderQty / moq) * moq;
    }
  }

  // Couverture en jours (NFP / ADU)
  const coverageDays = adu > 0 ? nfp / adu : 0;

  return {
    valid: true,
    redBase, redSafety, redZone, yellowZone, greenZone, greenDriver,
    tor, toy, tog,
    status, orderQty, coverageDays,
  };
}

// ============================================================
// BufferChart · visualisation SVG d'un buffer DDMRP
// ============================================================
function BufferChart({ result, nfp, compact = false }) {
  if (!result || !result.valid) {
    return <div className="font-jetbrains text-xs text-slate-500 p-6 text-center">Saisissez ADU et DLT pour visualiser</div>;
  }

  const { redZone, yellowZone, greenZone, tor, toy, tog, status } = result;

  // Hauteur totale considérée : on prend 110% du TOG pour donner de l'air en haut
  // Si NFP > TOG, on étend
  const maxDisplay = Math.max(tog * 1.15, nfp * 1.1, 10);
  const H = compact ? 180 : 280;
  const W = compact ? 280 : 380;
  const padTop = 8, padBottom = 20, padLeft = 10, padRight = 100;
  const chartH = H - padTop - padBottom;
  const chartW = W - padLeft - padRight;

  // Convertir valeurs en y (inversé : 0 en bas, max en haut)
  const toY = (val) => padTop + chartH - (val / maxDisplay) * chartH;

  const colorRed = DDMRP_COLORS.red.solid;
  const colorYellow = DDMRP_COLORS.yellow.solid;
  const colorGreen = DDMRP_COLORS.green.solid;
  const colorBlue = DDMRP_COLORS.blue.solid;

  // Hauteur des zones
  const yRedTop = toY(tor);
  const yYellowTop = toY(toy);
  const yGreenTop = toY(tog);
  const yBottom = toY(0);
  const yNfp = toY(Math.max(0, nfp));

  const nfpInRange = nfp >= 0 && nfp <= maxDisplay;

  // Couleur de la barre NFP selon statut
  const nfpColor = DDMRP_COLORS[status]?.solid || '#1E293B';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" width="100%" style={{ maxHeight: H }}>
      <defs>
        <pattern id="diag-red" patternUnits="userSpaceOnUse" width="6" height="6">
          <rect width="6" height="6" fill={DDMRP_COLORS.red.fill} />
          <path d="M-1 1 L 7 -7 M-1 7 L 7 -1 M-1 13 L 7 5" stroke={colorRed} strokeWidth="0.6" opacity="0.45" />
        </pattern>
      </defs>

      {/* Zone rouge (en bas) */}
      <rect x={padLeft} y={yRedTop} width={chartW} height={yBottom - yRedTop}
        fill="url(#diag-red)" stroke={colorRed} strokeWidth="0.8" />
      <text x={padLeft + 10} y={(yRedTop + yBottom) / 2} fontFamily="'JetBrains Mono', monospace" fontSize="11" fontWeight="600" fill={DDMRP_COLORS.red.text}>
        ROUGE
      </text>

      {/* Zone jaune */}
      <rect x={padLeft} y={yYellowTop} width={chartW} height={yRedTop - yYellowTop}
        fill={DDMRP_COLORS.yellow.fill} stroke={colorYellow} strokeWidth="0.8" />
      <text x={padLeft + 10} y={(yYellowTop + yRedTop) / 2} fontFamily="'JetBrains Mono', monospace" fontSize="11" fontWeight="600" fill={DDMRP_COLORS.yellow.text}>
        JAUNE
      </text>

      {/* Zone verte */}
      <rect x={padLeft} y={yGreenTop} width={chartW} height={yYellowTop - yGreenTop}
        fill={DDMRP_COLORS.green.fill} stroke={colorGreen} strokeWidth="0.8" />
      <text x={padLeft + 10} y={(yGreenTop + yYellowTop) / 2} fontFamily="'JetBrains Mono', monospace" fontSize="11" fontWeight="600" fill={DDMRP_COLORS.green.text}>
        VERT
      </text>

      {/* Zone sur-stock (au-dessus du TOG, si on a affiché plus) */}
      {maxDisplay > tog && (
        <rect x={padLeft} y={padTop} width={chartW} height={yGreenTop - padTop}
          fill="white" stroke={colorBlue} strokeWidth="0.8" strokeDasharray="3,3" opacity="0.6" />
      )}

      {/* Annotations TOG, TOY, TOR à droite */}
      <ZoneLabel x={padLeft + chartW + 6} y={yGreenTop} label="TOG" value={Math.round(tog)} color={colorGreen} />
      <ZoneLabel x={padLeft + chartW + 6} y={yYellowTop} label="TOY" value={Math.round(toy)} color={colorYellow} />
      <ZoneLabel x={padLeft + chartW + 6} y={yRedTop} label="TOR" value={Math.round(tor)} color={colorRed} />
      <ZoneLabel x={padLeft + chartW + 6} y={yBottom} label="0" value={0} color="#64748B" />

      {/* Ligne NFP */}
      {nfpInRange ? (
        <g>
          <line x1={padLeft - 6} y1={yNfp} x2={padLeft + chartW + 4} y2={yNfp}
            stroke={nfpColor} strokeWidth="2.5" strokeLinecap="round" style={{ transition: 'all 0.4s ease' }} />
          <circle cx={padLeft + chartW + 4} cy={yNfp} r="4" fill={nfpColor} style={{ transition: 'all 0.4s ease' }} />
          <rect x={padLeft - 4} y={yNfp - 8} width={42} height={16} rx={3} fill={nfpColor} />
          <text x={padLeft + 17} y={yNfp + 4} fontFamily="'JetBrains Mono', monospace" fontSize="10" fontWeight="700" fill="white" textAnchor="middle">
            NFP {Math.round(nfp)}
          </text>
        </g>
      ) : nfp > maxDisplay ? (
        <g>
          <text x={padLeft + chartW / 2} y={padTop + 4} fontFamily="'JetBrains Mono', monospace" fontSize="10" fontWeight="600" fill={colorBlue} textAnchor="middle">
            ↑ NFP {Math.round(nfp)}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

function ZoneLabel({ x, y, label, value, color }) {
  return (
    <g>
      <line x1={x - 7} y1={y} x2={x - 2} y2={y} stroke={color} strokeWidth="1" />
      <text x={x} y={y - 2} fontFamily="'JetBrains Mono', monospace" fontSize="9" fontWeight="700" fill={color}>
        {label}
      </text>
      <text x={x} y={y + 8} fontFamily="'JetBrains Mono', monospace" fontSize="9" fill="#475569">
        {value.toLocaleString('fr-FR')}
      </text>
    </g>
  );
}

// Mini-graph horizontal pour les lignes du tableau batch
function MiniBufferBar({ result, nfp }) {
  if (!result || !result.valid) return <span className="font-jetbrains text-xs text-slate-400">—</span>;
  const { tor, toy, tog, status } = result;
  const maxDisplay = Math.max(tog * 1.1, nfp * 1.05, 10);
  const W = 80, H = 14;
  const xRedEnd = (tor / maxDisplay) * W;
  const xYellowEnd = (toy / maxDisplay) * W;
  const xGreenEnd = (tog / maxDisplay) * W;
  const xNfp = (Math.max(0, Math.min(nfp, maxDisplay)) / maxDisplay) * W;
  const nfpColor = DDMRP_COLORS[status]?.solid || '#1E293B';

  return (
    <svg viewBox={`0 0 ${W + 2} ${H}`} width={W + 2} height={H} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <rect x="0" y="3" width={xRedEnd} height="8" fill={DDMRP_COLORS.red.fill} stroke={DDMRP_COLORS.red.solid} strokeWidth="0.5" />
      <rect x={xRedEnd} y="3" width={xYellowEnd - xRedEnd} height="8" fill={DDMRP_COLORS.yellow.fill} stroke={DDMRP_COLORS.yellow.solid} strokeWidth="0.5" />
      <rect x={xYellowEnd} y="3" width={xGreenEnd - xYellowEnd} height="8" fill={DDMRP_COLORS.green.fill} stroke={DDMRP_COLORS.green.solid} strokeWidth="0.5" />
      {nfp >= 0 && nfp <= maxDisplay && (
        <line x1={xNfp} y1="1" x2={xNfp} y2="13" stroke={nfpColor} strokeWidth="2" />
      )}
    </svg>
  );
}

// Status badge
function StatusBadge({ status, large = false }) {
  const c = DDMRP_COLORS[status] || DDMRP_COLORS.green;
  if (large) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md font-jetbrains text-sm font-bold tracking-wider"
        style={{ color: c.text, background: c.fill, border: `1px solid ${c.solid}` }}>
        <span className="w-2 h-2 rounded-full" style={{ background: c.solid }} />
        {c.label}
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-jetbrains text-[10px] font-bold tracking-wider"
      style={{ color: c.text, background: c.fill }}>
      ● {c.label}
    </span>
  );
}

// Templates DDMRP
const DDMRP_TEMPLATE_ROWS = [
  { 'Référence': 'A001', 'Libellé': 'Article rapide',  'Demande moyenne / jour': 100, 'Délai approvisionnement (jours)': 5,  'Quantité minimum de commande': 50,  'Cycle de commande (jours)': 7,  'Facteur variabilité (0-1)': 0.5,  'Facteur délai (0-1)': 0.7, 'Stock actuel': 800 },
  { 'Référence': 'A002', 'Libellé': 'Article volatile','Demande moyenne / jour': 50,  'Délai approvisionnement (jours)': 14, 'Quantité minimum de commande': 100, 'Cycle de commande (jours)': 0,  'Facteur variabilité (0-1)': 0.75, 'Facteur délai (0-1)': 0.5, 'Stock actuel': 600 },
  { 'Référence': 'A003', 'Libellé': 'Article stable',  'Demande moyenne / jour': 200, 'Délai approvisionnement (jours)': 3,  'Quantité minimum de commande': 100, 'Cycle de commande (jours)': 14, 'Facteur variabilité (0-1)': 0.25, 'Facteur délai (0-1)': 0.7, 'Stock actuel': 1200 },
];

const DDMRP_ALIASES = {
  ref:   ['ref', 'reference', 'référence', 'sku', 'code', 'article', 'item'],
  label: ['libelle', 'libellé', 'nom', 'description', 'designation', 'désignation', 'name'],
  adu:   ['adu', 'demande', 'demande moyenne', 'demande moyenne par jour', 'demande moyenne / jour', 'demande moyenne jour', 'consommation', 'consommation moyenne', 'demande journaliere', 'demande journalière', 'average daily usage', 'demande / jour', 'demande par jour'],
  dlt:   ['dlt', 'lead time', 'délai', 'delai', 'leadtime', 'lt', 'délai réappro', 'délai approvisionnement', 'délai approvisionnement (jours)', 'délai d approvisionnement', 'delai approvisionnement'],
  moq:   ['moq', 'quantite mini', 'quantité minimum', 'quantité minimum de commande', 'quantité min de commande', 'minimum order quantity', 'qte mini', 'mini', 'qté min commande', 'quantité minimum commande'],
  cycle: ['cycle', 'order cycle', 'cycle commande', 'cycle de commande', 'cycle de commande (jours)', 'periodicite', 'périodicité', 'cycle (jours)'],
  vf:    ['vf', 'variability', 'variability factor', 'facteur variabilite', 'facteur variabilité', 'facteur de variabilité', 'var', 'facteur variabilité (0-1)'],
  ltf:   ['ltf', 'lead time factor', 'facteur lead time', 'facteur délai', 'facteur de délai', 'facteur délai (0-1)'],
  nfp:   ['nfp', 'net flow position', 'flux net', 'position', 'stock disponible', 'stock', 'stock actuel', 'position de flux net', 'stock disponible actuel'],
};

function mapDdmrpRow(raw, idx) {
  const refRaw = findField(raw, DDMRP_ALIASES.ref);
  const labelRaw = findField(raw, DDMRP_ALIASES.label);
  return {
    id: `ddmrp-${Date.now()}-${idx}`,
    ref: refRaw != null ? String(refRaw) : `A${String(idx + 1).padStart(3, '0')}`,
    label: labelRaw != null ? String(labelRaw) : '',
    adu: parseFloat(findField(raw, DDMRP_ALIASES.adu)) || 0,
    dlt: parseFloat(findField(raw, DDMRP_ALIASES.dlt)) || 0,
    moq: parseFloat(findField(raw, DDMRP_ALIASES.moq)) || 0,
    orderCycle: parseFloat(findField(raw, DDMRP_ALIASES.cycle)) || 0,
    vf: parseFloat(findField(raw, DDMRP_ALIASES.vf)) || 0.5,
    ltf: parseFloat(findField(raw, DDMRP_ALIASES.ltf)) || 0.5,
    nfp: parseFloat(findField(raw, DDMRP_ALIASES.nfp)) || 0,
  };
}

// Agrégation historique pour DDMRP : ADU + CV → VF suggéré
function aggregateDdmrpHistory(json, aggregation = 'daily') {
  const valid = [];
  let errorCount = 0;
  for (const raw of json) {
    const ref = String(findField(raw, SALES_COLUMN_ALIASES.ref) || '').trim();
    const label = String(findField(raw, SALES_COLUMN_ALIASES.label) || '').trim();
    const store = String(findField(raw, SALES_COLUMN_ALIASES.store) || '').trim();
    const L = parseFloat(findField(raw, SALES_COLUMN_ALIASES.L));
    const qty = parseFloat(findField(raw, SALES_COLUMN_ALIASES.qty));
    const date = parseDate(findField(raw, SALES_COLUMN_ALIASES.date));
    if (!ref || !date || isNaN(qty)) { errorCount++; continue; }
    valid.push({ ref, label, store: store || '—', L: isNaN(L) ? 0 : L, qty, date });
  }
  if (valid.length === 0) {
    throw new Error('Aucune ligne valide (vérifiez Référence, Date, Quantité)');
  }

  const groups = {};
  for (const row of valid) {
    const key = `${row.ref}|${row.store}`;
    if (!groups[key]) groups[key] = { ref: row.ref, label: row.label, store: row.store, L: row.L, sales: [] };
    groups[key].sales.push({ date: row.date, qty: row.qty });
    if (row.L > 0) groups[key].L = row.L;
    if (row.label && !groups[key].label) groups[key].label = row.label;
  }

  const binSize = aggregation === 'weekly' ? 7 * 86400000 : 86400000;
  const results = [];
  let idx = 0;
  for (const key in groups) {
    const g = groups[key];
    const times = g.sales.map(s => s.date.getTime());
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const minBin = Math.floor(minT / binSize);
    const maxBin = Math.floor(maxT / binSize);
    const totalBins = maxBin - minBin + 1;
    const binnedQty = new Array(totalBins).fill(0);
    for (const s of g.sales) {
      const bin = Math.floor(s.date.getTime() / binSize) - minBin;
      binnedQty[bin] += s.qty;
    }

    const totalQty = binnedQty.reduce((a, b) => a + b, 0);
    const activeBinsArr = binnedQty.filter(q => q > 0);
    const activeBinsCount = activeBinsArr.length;

    // ADU calculé sur l'horizon TOTAL (avec zéros) — c'est la vraie consommation moyenne
    const aduPerBin = totalBins > 0 ? totalQty / totalBins : 0;
    const adu = aggregation === 'daily' ? aduPerBin : aduPerBin / 7;

    // CV calculé sur les bins ACTIFS uniquement (plus représentatif de la variabilité réelle
    // de la demande, sans gonfler artificiellement à cause des zéros)
    let cv = 0;
    if (activeBinsCount > 1) {
      const activeMean = activeBinsArr.reduce((a, b) => a + b, 0) / activeBinsCount;
      const activeVar = activeBinsArr.reduce((acc, q) => acc + (q - activeMean) ** 2, 0) / (activeBinsCount - 1);
      const activeStd = Math.sqrt(activeVar);
      cv = activeMean > 0 ? activeStd / activeMean : 0;
    }

    // Sporadicité : ratio de bins avec demande (1.0 = continu, 0.3 = sporadique)
    const sporadicity = totalBins > 0 ? activeBinsCount / totalBins : 0;

    const vf = suggestVf(cv);
    const ltf = suggestLtf(g.L);

    let reliability = 'low';
    if (totalBins >= 90) reliability = 'high';
    else if (totalBins >= 30) reliability = 'medium';

    results.push({
      id: `ddmrp-sales-${Date.now()}-${idx++}`,
      ref: g.ref,
      label: g.label,
      store: g.store,
      adu: Number(adu.toFixed(2)),
      dlt: g.L,
      moq: 0,
      orderCycle: 0,
      vf, ltf,
      nfp: 0,
      cv: Number(cv.toFixed(3)),
      activeBins: activeBinsCount,
      totalBins,
      sporadicity: Number((sporadicity * 100).toFixed(0)),
      reliability,
    });
  }
  results.sort((a, b) => a.ref.localeCompare(b.ref) || (a.store || '').localeCompare(b.store || ''));
  return { rows: results, errorCount, validLines: valid.length };
}

// ============================================================
// DdmrpBuffers · le composant principal
// ============================================================
function DdmrpBuffers({ onBack }) {
  const [mode, setMode] = useState('single');

  // SINGLE MODE
  const [adu, setAdu] = useState(100);
  const [dlt, setDlt] = useState(7);
  const [moq, setMoq] = useState(50);
  const [orderCycle, setOrderCycle] = useState(0);
  const [vf, setVf] = useState(0.5);
  const [ltf, setLtf] = useState(0.5);
  const [nfp, setNfp] = useState(800);

  const singleResult = useMemo(
    () => computeBuffer({ adu, dlt, moq, orderCycle, vf, ltf, nfp }),
    [adu, dlt, moq, orderCycle, vf, ltf, nfp]
  );

  // BATCH MODE
  const [rows, setRows] = useState([
    { id: 'd-init-1', ref: 'A001', label: 'Article rapide',  adu: 100, dlt: 5,  moq: 50,  orderCycle: 7,  vf: 0.5,  ltf: 0.7, nfp: 800 },
    { id: 'd-init-2', ref: 'A002', label: 'Article volatile', adu: 50, dlt: 14, moq: 100, orderCycle: 0,  vf: 0.75, ltf: 0.5, nfp: 600 },
    { id: 'd-init-3', ref: 'A003', label: 'Article stable',   adu: 200, dlt: 3,  moq: 100, orderCycle: 14, vf: 0.25, ltf: 0.7, nfp: 1200 },
  ]);
  const [selectedRowId, setSelectedRowId] = useState('d-init-1');
  const [importMsg, setImportMsg] = useState(null);
  const fileInputRef = useRef(null);

  const [dataSource, setDataSource] = useState('manual');
  const [rawSalesData, setRawSalesData] = useState(null);
  const [aggregation, setAggregation] = useState('daily');
  // Paramètres globaux mode sales
  const [globalMoq, setGlobalMoq] = useState(0);
  const [globalOrderCycle, setGlobalOrderCycle] = useState(0);
  const [globalVf, setGlobalVf] = useState(0.5);
  const [globalLtf, setGlobalLtf] = useState(0.5);
  const [forceVfGlobal, setForceVfGlobal] = useState(false);
  const [forceLtfGlobal, setForceLtfGlobal] = useState(false);

  // Reagrégation si on change l'agrégation
  useEffect(() => {
    if (dataSource === 'sales' && rawSalesData) {
      try {
        const { rows: aggregated } = aggregateDdmrpHistory(rawSalesData, aggregation);
        setRows(aggregated);
        if (aggregated.length > 0 && !aggregated.find(r => r.id === selectedRowId)) {
          setSelectedRowId(aggregated[0].id);
        }
      } catch (e) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aggregation]);

  // En mode sales : application des paramètres globaux
  // - MOQ et OrderCycle globaux s'appliquent si la ligne a une valeur 0
  //   (= soit pas encore renseignée, soit volontairement remise à 0 par l'utilisateur)
  // - VF/LTF globaux s'appliquent uniquement si le mode "Forcé" est activé,
  //   sinon on garde la suggestion automatique par article (auto-calculée depuis CV/DLT)
  const effectiveRows = useMemo(() => {
    if (dataSource === 'sales') {
      return rows.map(r => ({
        ...r,
        moq: (r.moq && r.moq > 0) ? r.moq : globalMoq,
        orderCycle: (r.orderCycle && r.orderCycle > 0) ? r.orderCycle : globalOrderCycle,
        vf: forceVfGlobal ? globalVf : r.vf,
        ltf: forceLtfGlobal ? globalLtf : r.ltf,
      }));
    }
    return rows;
  }, [rows, dataSource, globalMoq, globalOrderCycle, forceVfGlobal, forceLtfGlobal, globalVf, globalLtf]);

  const computedRows = useMemo(() => effectiveRows.map(r => ({
    ...r,
    result: computeBuffer({ adu: r.adu, dlt: r.dlt, moq: r.moq, orderCycle: r.orderCycle, vf: r.vf, ltf: r.ltf, nfp: r.nfp }),
  })), [effectiveRows]);

  const batchStats = useMemo(() => {
    const valid = computedRows.filter(r => r.result.valid);
    const inRed = valid.filter(r => r.result.status === 'red' || r.result.status === 'stockout').length;
    const inYellow = valid.filter(r => r.result.status === 'yellow').length;
    const inGreen = valid.filter(r => r.result.status === 'green').length;
    const overSupply = valid.filter(r => r.result.status === 'blue').length;
    const totalToOrder = valid.reduce((s, r) => s + r.result.orderQty, 0);
    return { count: valid.length, inRed, inYellow, inGreen, overSupply, totalToOrder };
  }, [computedRows]);

  const addRow = () => {
    const r = {
      id: 'd-' + Date.now(),
      ref: '', label: '', adu: 0, dlt: 0, moq: 0, orderCycle: 0, vf: 0.5, ltf: 0.5, nfp: 0
    };
    setRows(rs => [...rs, r]);
    setSelectedRowId(r.id);
  };
  const removeRow = (id) => {
    setRows(rs => rs.filter(r => r.id !== id));
    if (selectedRowId === id) setSelectedRowId(null);
  };
  const updateRow = (id, key, val) => {
    setRows(rs => rs.map(r => {
      if (r.id !== id) return r;
      if (['ref', 'label', 'store'].includes(key)) return { ...r, [key]: val };
      return { ...r, [key]: Math.max(0, parseFloat(val) || 0) };
    }));
  };
  const clearRows = () => {
    if (window.confirm('Vider toutes les lignes ?')) {
      setRows([]);
      setSelectedRowId(null);
      setDataSource('manual');
      setRawSalesData(null);
    }
  };

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (json.length === 0) throw new Error('Aucune ligne détectée');

      const fileType = detectFileType(json);

      if (fileType === 'sales') {
        const { rows: aggregated, errorCount, validLines } = aggregateDdmrpHistory(json, aggregation);
        setRawSalesData(json);
        setRows(aggregated);
        setSelectedRowId(aggregated[0]?.id || null);
        setDataSource('sales');
        const skipMsg = errorCount > 0 ? ` · ${errorCount} ligne(s) ignorée(s)` : '';
        setImportMsg({ type: 'success', text: `${aggregated.length} couple(s) Réf×Magasin · ADU et VF calculés depuis ${validLines} ligne(s) de ventes${skipMsg}` });
      } else {
        // Mode params : vérifier quelles colonnes ont été matchées
        const firstRow = json[0];
        const requiredCols = {
          'Référence': DDMRP_ALIASES.ref,
          'Demande moyenne / jour': DDMRP_ALIASES.adu,
          'Délai (jours)': DDMRP_ALIASES.dlt,
        };
        const optionalCols = {
          'Libellé': DDMRP_ALIASES.label,
          'Quantité minimum': DDMRP_ALIASES.moq,
          'Cycle de commande': DDMRP_ALIASES.cycle,
          'Facteur variabilité': DDMRP_ALIASES.vf,
          'Facteur délai': DDMRP_ALIASES.ltf,
          'Stock actuel': DDMRP_ALIASES.nfp,
        };
        const missingRequired = Object.entries(requiredCols)
          .filter(([_, aliases]) => findField(firstRow, aliases) === undefined)
          .map(([label]) => label);
        const missingOptional = Object.entries(optionalCols)
          .filter(([_, aliases]) => findField(firstRow, aliases) === undefined)
          .map(([label]) => label);

        const mapped = json.map(mapDdmrpRow);
        setRawSalesData(null);
        setRows(mapped);
        setSelectedRowId(mapped[0]?.id || null);
        setDataSource('manual');

        if (missingRequired.length > 0) {
          setImportMsg({
            type: 'error',
            text: `Colonnes obligatoires manquantes : ${missingRequired.join(', ')}. Téléchargez le template "Paramètres" pour voir les en-têtes attendus.`
          });
        } else if (missingOptional.length > 0) {
          setImportMsg({
            type: 'warning',
            text: `${mapped.length} article(s) importé(s). Colonnes non reconnues (valeurs à 0) : ${missingOptional.join(', ')}.`
          });
        } else {
          setImportMsg({ type: 'success', text: `${mapped.length} article(s) importé(s) depuis « ${file.name} »` });
        }
      }
      setTimeout(() => setImportMsg(null), 5500);
    } catch (err) {
      setImportMsg({ type: 'error', text: 'Erreur d\'import : ' + err.message });
      setTimeout(() => setImportMsg(null), 6000);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const exportXlsx = () => {
    const data = computedRows.map(r => ({
      'Référence': r.ref,
      'Libellé': r.label,
      ...(r.store ? { 'Magasin': r.store } : {}),
      'Demande moyenne / jour': r.adu,
      'Délai approvisionnement (jours)': r.dlt,
      'Quantité minimum de commande': r.moq,
      'Cycle de commande (jours)': r.orderCycle,
      'Facteur variabilité (0-1)': r.vf,
      'Facteur délai (0-1)': r.ltf,
      'Stock actuel': r.nfp,
      ...(r.cv != null ? { 'Coefficient variation': r.cv } : {}),
      ...(r.sporadicity != null ? { 'Sporadicité %': r.sporadicity } : {}),
      'Zone Rouge': r.result.valid ? Math.round(r.result.redZone) : '',
      'Zone Jaune': r.result.valid ? Math.round(r.result.yellowZone) : '',
      'Zone Verte': r.result.valid ? Math.round(r.result.greenZone) : '',
      'Plafond Rouge (TOR)': r.result.valid ? Math.round(r.result.tor) : '',
      'Plafond Jaune (TOY)': r.result.valid ? Math.round(r.result.toy) : '',
      'Plafond Vert / Stock cible (TOG)': r.result.valid ? Math.round(r.result.tog) : '',
      'Statut': r.result.valid ? DDMRP_COLORS[r.result.status]?.label : '',
      'Quantité à commander': r.result.valid ? Math.round(r.result.orderQty) : '',
      'Couverture (jours)': r.result.valid ? Number(r.result.coverageDays.toFixed(1)) : '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Buffers DDMRP');

    // Feuille traçabilité paramètres globaux (en mode sales)
    if (dataSource === 'sales') {
      const params = [
        { 'Paramètre': 'MOQ global', 'Valeur': globalMoq },
        { 'Paramètre': 'Cycle de commande global', 'Valeur': globalOrderCycle },
        { 'Paramètre': 'Mode VF', 'Valeur': forceVfGlobal ? `Forcé à ${globalVf}` : 'Auto (par article)' },
        { 'Paramètre': 'Mode LTF', 'Valeur': forceLtfGlobal ? `Forcé à ${globalLtf}` : 'Auto (par article)' },
        { 'Paramètre': 'Granularité agrégation', 'Valeur': aggregation === 'daily' ? 'Quotidienne' : 'Hebdomadaire' },
        { 'Paramètre': 'Date du calcul', 'Valeur': new Date().toLocaleString('fr-FR') },
      ];
      const wsParams = XLSX.utils.json_to_sheet(params);
      XLSX.utils.book_append_sheet(wb, wsParams, 'Paramètres');
    }

    XLSX.writeFile(wb, `atelier-ddmrp-${Date.now()}.xlsx`);
  };

  const downloadTemplate = (kind) => {
    if (kind === 'params') {
      const ws = XLSX.utils.json_to_sheet(DDMRP_TEMPLATE_ROWS);
      ws['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template DDMRP');
      XLSX.writeFile(wb, 'atelier-template-ddmrp.xlsx');
    } else {
      const ws = XLSX.utils.json_to_sheet(generateSalesTemplate());
      ws['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Historique de ventes');
      XLSX.writeFile(wb, 'atelier-template-historique-ventes.xlsx');
    }
  };

  const examineRow = (row) => {
    setAdu(row.adu); setDlt(row.dlt); setMoq(row.moq);
    setOrderCycle(row.orderCycle); setVf(row.vf); setLtf(row.ltf);
    setNfp(row.nfp);
    setMode('single');
  };

  const selectedRow = computedRows.find(r => r.id === selectedRowId);
  const isSalesMode = dataSource === 'sales';

  return (
    <div className="min-h-screen text-slate-900" style={{ background: '#F8FAFC', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <FontsAndStyles />

      <nav className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-5">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-jetbrains text-xs">
              <ArrowLeft size={14} />
              RETOUR
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-3">
              <Logo small />
              <div>
                <div className="font-bricolage font-semibold text-sm leading-tight text-slate-900">Buffers stratégiques DDMRP</div>
                <div className="font-jetbrains text-[10px] text-slate-500">ATELIER / 07</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg border border-slate-200 bg-slate-50">
            <button onClick={() => setMode('single')}
              className="px-3 py-1.5 rounded-md font-jetbrains text-xs transition-all"
              style={mode === 'single'
                ? { background: '#FFFFFF', color: BLUE, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
                : { color: '#64748B' }}>
              ARTICLE UNIQUE
            </button>
            <button onClick={() => setMode('batch')}
              className="px-3 py-1.5 rounded-md font-jetbrains text-xs transition-all flex items-center gap-1.5"
              style={mode === 'batch'
                ? { background: '#FFFFFF', color: BLUE, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
                : { color: '#64748B' }}>
              MULTI-ARTICLES
              {mode !== 'batch' && rows.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium" style={{ background: BLUE_LIGHT, color: BLUE }}>{rows.length}</span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* ============ MODE SINGLE ============ */}
      {mode === 'single' && (
        <div className="max-w-[1600px] mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2 space-y-4">

            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600">DEMANDE & DÉLAI</div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <NumberField label={<>Demande / jour (<T code="ADU" />)</>} value={adu} onChange={v => setAdu(Math.max(0, parseFloat(v) || 0))} step="1" />
                <NumberField label={<>Délai jours (<T code="DLT" />)</>} value={dlt} onChange={v => { const x = Math.max(0, parseFloat(v) || 0); setDlt(x); setLtf(suggestLtf(x)); }} step="0.5" />
              </div>
              <div className="px-4 pb-3 text-[10px] text-slate-500 leading-relaxed">
                Le <T code="LTF" /> est ajusté automatiquement quand vous changez le <T code="DLT" /> (modifiable ci-dessous).
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600">PARAMÈTRES DE COMMANDE</div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <NumberField label={<>Quantité mini (<T code="MOQ" />)</>} value={moq} onChange={v => setMoq(Math.max(0, parseFloat(v) || 0))} step="1" />
                <NumberField label="Cycle de commande (j)" value={orderCycle} onChange={v => setOrderCycle(Math.max(0, parseFloat(v) || 0))} step="1" />
              </div>
              <div className="px-4 pb-3 text-[10px] text-slate-500 leading-relaxed">
                Le cycle de commande est optionnel — laissez à 0 si vous n'avez pas de périodicité imposée.
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="font-jetbrains text-xs text-slate-600">FACTEUR DE VARIABILITÉ · <T code="VF" /></div>
                <div className="font-jetbrains text-xs font-semibold" style={{ color: BLUE }}>{vf.toFixed(2)}</div>
              </div>
              <div className="p-4 space-y-2">
                <div className="grid grid-cols-3 gap-1.5">
                  {VF_PRESETS.map(p => (
                    <button key={p.value} onClick={() => setVf(p.value)} className="px-1 py-1.5 rounded-md font-jetbrains transition-all text-xs"
                      style={Math.abs(vf - p.value) < 0.001 ? { background: BLUE, color: '#FFFFFF', fontWeight: 600 } : { background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
                      <div>{p.label}</div>
                      <div className="text-[9px] opacity-80 mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>
                <input type="range" min="0.1" max="1.0" step="0.05" value={vf} onChange={e => setVf(parseFloat(e.target.value))} className="w-full" style={{ accentColor: BLUE }} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="font-jetbrains text-xs text-slate-600">FACTEUR DE DÉLAI · <T code="LTF" /></div>
                <div className="font-jetbrains text-xs font-semibold" style={{ color: BLUE }}>{ltf.toFixed(2)}</div>
              </div>
              <div className="p-4 space-y-2">
                <div className="grid grid-cols-3 gap-1.5">
                  {LTF_PRESETS.map(p => (
                    <button key={p.value} onClick={() => setLtf(p.value)} className="px-1 py-1.5 rounded-md font-jetbrains transition-all text-xs"
                      style={Math.abs(ltf - p.value) < 0.001 ? { background: BLUE, color: '#FFFFFF', fontWeight: 600 } : { background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
                      <div>{p.label}</div>
                      <div className="text-[9px] opacity-80 mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>
                <input type="range" min="0.1" max="1.0" step="0.05" value={ltf} onChange={e => setLtf(parseFloat(e.target.value))} className="w-full" style={{ accentColor: BLUE }} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-jetbrains text-xs text-slate-600">POSITION DE FLUX NET · <T code="NFP" /></div>
              <div className="p-4">
                <NumberField label={<><T code="NFP" /> = Stock + En commande − Demande qualifiée</>} value={nfp} onChange={v => setNfp(parseFloat(v) || 0)} step="1" />
                <div className="text-[10px] text-slate-500 leading-relaxed mt-2">
                  Le NFP représente la position de flux disponible. C'est lui qui détermine la couleur d'alerte.
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">

            {/* Header status */}
            {singleResult.valid && (
              <div className="rounded-xl border-2 p-5 transition-all"
                style={{
                  borderColor: DDMRP_COLORS[singleResult.status]?.solid,
                  background: DDMRP_COLORS[singleResult.status]?.fill,
                }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-jetbrains text-[10px] tracking-wider mb-1" style={{ color: DDMRP_COLORS[singleResult.status]?.text }}>STATUT ACTUEL</div>
                    <StatusBadge status={singleResult.status} large />
                    <div className="mt-3 text-sm" style={{ color: DDMRP_COLORS[singleResult.status]?.text }}>
                      {singleResult.status === 'red' && 'Stock dans la zone rouge — passage de commande urgent.'}
                      {singleResult.status === 'yellow' && 'Stock dans la zone jaune — c\'est le bon moment pour recommander.'}
                      {singleResult.status === 'green' && 'Stock dans la zone verte — aucune action nécessaire.'}
                      {singleResult.status === 'blue' && 'Sur-stock — vérifier les paramètres ou ralentir les commandes.'}
                      {singleResult.status === 'stockout' && 'Rupture imminente / déjà en rupture — action immédiate requise.'}
                    </div>
                  </div>
                  {singleResult.orderQty > 0 && (
                    <div className="text-right">
                      <div className="font-jetbrains text-[10px] tracking-wider mb-1" style={{ color: DDMRP_COLORS[singleResult.status]?.text }}>À COMMANDER</div>
                      <div className="font-bricolage text-3xl font-bold" style={{ color: DDMRP_COLORS[singleResult.status]?.solid }}>{Math.round(singleResult.orderQty)}</div>
                      <div className="font-jetbrains text-[10px]" style={{ color: DDMRP_COLORS[singleResult.status]?.text }}>unités · pour atteindre <T code="TOG" /></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Buffer chart */}
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                <div className="font-jetbrains text-xs text-slate-600">BUFFER STRATÉGIQUE</div>
                <div className="font-jetbrains text-[10px] text-slate-400">3 zones : rouge (sécurité) · jaune (réappro) · vert (opportunité)</div>
              </div>
              <div className="p-6 flex justify-center" style={{ background: 'repeating-linear-gradient(45deg, #F8FAFC 0, #F8FAFC 14px, #F1F5F9 14px, #F1F5F9 15px)' }}>
                <BufferChart result={singleResult} nfp={nfp} />
              </div>
            </div>

            {/* Détail des zones */}
            {singleResult.valid && (
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Zone Rouge" value={Math.round(singleResult.redZone)} sub={<><T code="ADU" /> × <T code="DLT" /> × <T code="LTF" /> × (1+<T code="VF" />)</>} />
                <StatCard label="Zone Jaune" value={Math.round(singleResult.yellowZone)} sub={<><T code="ADU" /> × <T code="DLT" /></>} />
                <StatCard label="Zone Verte" value={Math.round(singleResult.greenZone)} sub={
                  singleResult.greenDriver === 'moq' ? <>contrainte par <T code="MOQ" /></> :
                  singleResult.greenDriver === 'order_cycle' ? 'contrainte par Cycle' : 'contrainte par Délai'
                } />
              </div>
            )}

            {singleResult.valid && (
              <div className="rounded-xl border border-slate-200 p-5 bg-white">
                <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-3">DÉTAILS DU CALCUL</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <DetailRow label={<>Rouge Base (<T code="ADU" /> × <T code="DLT" /> × <T code="LTF" />)</>} value={Math.round(singleResult.redBase)} />
                  <DetailRow label={<>Rouge Sécurité (Rouge Base × <T code="VF" />)</>} value={Math.round(singleResult.redSafety)} />
                  <DetailRow label={<><T code="TOR" /> · plafond zone rouge</>} value={Math.round(singleResult.tor)} />
                  <DetailRow label={<><T code="TOY" /> · plafond zone jaune</>} value={Math.round(singleResult.toy)} />
                  <DetailRow label={<><T code="TOG" /> · plafond zone verte (= stock cible max)</>} value={Math.round(singleResult.tog)} />
                  <DetailRow label="Couverture en jours" value={`${singleResult.coverageDays.toFixed(1)} j`} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ MODE BATCH ============ */}
      {mode === 'batch' && (
        <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-5">

          <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileImport} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-md font-jetbrains text-xs font-semibold text-white shadow-sm transition-all hover:translate-y-[-1px]" style={{ background: BLUE }}>
                <Upload size={13} />
                IMPORTER (.xlsx / .csv)
              </button>
              <button onClick={() => downloadTemplate('params')} className="flex items-center gap-1.5 px-3 py-2 rounded-md font-jetbrains text-xs text-slate-700 border border-slate-300 hover:bg-slate-50 transition-all">
                <FileDown size={13} />
                TEMPLATE PARAM.
              </button>
              <button onClick={() => downloadTemplate('sales')} className="flex items-center gap-1.5 px-3 py-2 rounded-md font-jetbrains text-xs text-slate-700 border border-slate-300 hover:bg-slate-50 transition-all">
                <FileDown size={13} />
                TEMPLATE HISTO.
              </button>
              <button onClick={exportXlsx} disabled={rows.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-md font-jetbrains text-xs text-slate-700 border border-slate-300 hover:bg-slate-50 transition-all disabled:opacity-40">
                <Download size={13} />
                EXPORTER (.xlsx)
              </button>
              <div className="w-px h-5 bg-slate-200 mx-1" />
              <button onClick={addRow} disabled={isSalesMode} className="flex items-center gap-1.5 px-3 py-2 rounded-md font-jetbrains text-xs text-slate-700 border border-slate-300 hover:bg-slate-50 transition-all disabled:opacity-40">
                + LIGNE
              </button>
              <button onClick={clearRows} disabled={rows.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-md font-jetbrains text-xs text-red-600 border border-red-200 hover:bg-red-50 transition-all disabled:opacity-40">
                VIDER
              </button>
            </div>
            <div className="font-jetbrains text-xs text-slate-500 flex items-center gap-3">
              {isSalesMode && (
                <span className="px-2 py-1 rounded-md text-[10px] tracking-wider font-medium" style={{ background: BLUE_LIGHT, color: BLUE }}>
                  ◆ ADU CALCULÉS AUTOMATIQUEMENT
                </span>
              )}
              <span>{rows.length} ligne{rows.length > 1 ? 's' : ''} · {batchStats.count} buffer{batchStats.count > 1 ? 's' : ''} calculé{batchStats.count > 1 ? 's' : ''}</span>
            </div>
          </div>

          {importMsg && (
            <div className="rounded-lg p-3 font-jetbrains text-xs"
              style={
                importMsg.type === 'success' ? { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }
                : importMsg.type === 'warning' ? { background: '#FFFBEB', color: '#92400E', border: '1px solid #FCD34D' }
                : { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }
              }>
              {importMsg.text}
            </div>
          )}

          {isSalesMode && (
            <div className="rounded-xl border p-5" style={{ borderColor: '#BFDBFE', background: BLUE_LIGHT }}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="font-jetbrains text-xs tracking-wider font-semibold" style={{ color: BLUE }}>PARAMÈTRES GLOBAUX</div>
                <div className="font-jetbrains text-[10px] text-blue-700">appliqués à toutes les lignes importées</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* MOQ global */}
                <div>
                  <label className="font-jetbrains text-[10px] tracking-wider mb-1.5 block" style={{ color: BLUE }}>
                    <T code="MOQ" /> PAR DÉFAUT
                  </label>
                  <input type="number" min="0" step="1" value={globalMoq}
                    onChange={e => setGlobalMoq(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-white border border-blue-200 rounded-md outline-none font-jetbrains text-sm focus:border-blue-400 transition-colors" />
                  <div className="text-[10px] text-blue-700 mt-1">appliqué si la ligne n'a pas de MOQ propre</div>
                </div>

                {/* Cycle global */}
                <div>
                  <label className="font-jetbrains text-[10px] tracking-wider mb-1.5 block" style={{ color: BLUE }}>
                    CYCLE DE COMMANDE (jours)
                  </label>
                  <input type="number" min="0" step="1" value={globalOrderCycle}
                    onChange={e => setGlobalOrderCycle(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-white border border-blue-200 rounded-md outline-none font-jetbrains text-sm focus:border-blue-400 transition-colors" />
                  <div className="text-[10px] text-blue-700 mt-1">0 = pas de périodicité</div>
                </div>

                {/* VF global */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-jetbrains text-[10px] tracking-wider" style={{ color: BLUE }}>
                      <T code="VF" /> {forceVfGlobal ? 'FORCÉ' : 'AUTO'}
                    </label>
                    <button onClick={() => setForceVfGlobal(v => !v)}
                      className="font-jetbrains text-[9px] px-1.5 py-0.5 rounded transition-colors"
                      style={forceVfGlobal
                        ? { background: BLUE, color: 'white' }
                        : { background: 'white', color: BLUE, border: '1px solid #BFDBFE' }}>
                      {forceVfGlobal ? '◉ FORCÉ' : '○ AUTO'}
                    </button>
                  </div>
                  <input type="range" min="0.1" max="0.95" step="0.05" value={globalVf}
                    onChange={e => setGlobalVf(parseFloat(e.target.value))}
                    disabled={!forceVfGlobal}
                    className="w-full disabled:opacity-40"
                    style={{ accentColor: BLUE }} />
                  <div className="flex justify-between font-jetbrains text-[10px] mt-0.5" style={{ color: BLUE }}>
                    <span>0.1</span>
                    <span className="font-semibold">{globalVf.toFixed(2)}</span>
                    <span>0.95</span>
                  </div>
                </div>

                {/* LTF global */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-jetbrains text-[10px] tracking-wider" style={{ color: BLUE }}>
                      <T code="LTF" /> {forceLtfGlobal ? 'FORCÉ' : 'AUTO'}
                    </label>
                    <button onClick={() => setForceLtfGlobal(v => !v)}
                      className="font-jetbrains text-[9px] px-1.5 py-0.5 rounded transition-colors"
                      style={forceLtfGlobal
                        ? { background: BLUE, color: 'white' }
                        : { background: 'white', color: BLUE, border: '1px solid #BFDBFE' }}>
                      {forceLtfGlobal ? '◉ FORCÉ' : '○ AUTO'}
                    </button>
                  </div>
                  <input type="range" min="0.1" max="0.95" step="0.05" value={globalLtf}
                    onChange={e => setGlobalLtf(parseFloat(e.target.value))}
                    disabled={!forceLtfGlobal}
                    className="w-full disabled:opacity-40"
                    style={{ accentColor: BLUE }} />
                  <div className="flex justify-between font-jetbrains text-[10px] mt-0.5" style={{ color: BLUE }}>
                    <span>0.1</span>
                    <span className="font-semibold">{globalLtf.toFixed(2)}</span>
                    <span>0.95</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-blue-200 flex items-center justify-between flex-wrap gap-3">
                <div className="text-[11px] text-blue-900 leading-snug max-w-2xl">
                  <span className="font-semibold">Mode AUTO</span> : VF et LTF sont calculés par article depuis le <T code="CV" /> de la demande et le <T code="DLT" />.
                  <span className="font-semibold"> Mode FORCÉ</span> : la valeur globale s'applique à toutes les lignes (utile pour des simulations rapides ou pour appliquer une politique unifiée).
                </div>
                <div className="flex items-center gap-2">
                  <label className="font-jetbrains text-[10px] tracking-wider" style={{ color: BLUE }}>GRANULARITÉ</label>
                  <div className="flex gap-1.5">
                    <button onClick={() => setAggregation('daily')} className="px-2 py-1 rounded-md font-jetbrains text-[10px] transition-all"
                      style={aggregation === 'daily' ? { background: BLUE, color: '#FFFFFF', fontWeight: 600 } : { background: 'rgba(255,255,255,0.6)', color: BLUE, border: '1px solid #BFDBFE' }}>
                      Quotidienne
                    </button>
                    <button onClick={() => setAggregation('weekly')} className="px-2 py-1 rounded-md font-jetbrains text-[10px] transition-all"
                      style={aggregation === 'weekly' ? { background: BLUE, color: '#FFFFFF', fontWeight: 600 } : { background: 'rgba(255,255,255,0.6)', color: BLUE, border: '1px solid #BFDBFE' }}>
                      Hebdomadaire
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stats globales avec répartition par zone */}
          {batchStats.count > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-xl border p-4" style={{ borderColor: DDMRP_COLORS.red.solid, background: DDMRP_COLORS.red.fill }}>
                <div className="font-jetbrains text-[10px] tracking-wider" style={{ color: DDMRP_COLORS.red.text }}>EN ROUGE / RUPTURE</div>
                <div className="font-bricolage text-2xl font-bold mt-1" style={{ color: DDMRP_COLORS.red.solid }}>{batchStats.inRed}</div>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: DDMRP_COLORS.yellow.solid, background: DDMRP_COLORS.yellow.fill }}>
                <div className="font-jetbrains text-[10px] tracking-wider" style={{ color: DDMRP_COLORS.yellow.text }}>EN JAUNE</div>
                <div className="font-bricolage text-2xl font-bold mt-1" style={{ color: DDMRP_COLORS.yellow.solid }}>{batchStats.inYellow}</div>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: DDMRP_COLORS.green.solid, background: DDMRP_COLORS.green.fill }}>
                <div className="font-jetbrains text-[10px] tracking-wider" style={{ color: DDMRP_COLORS.green.text }}>EN VERT</div>
                <div className="font-bricolage text-2xl font-bold mt-1" style={{ color: DDMRP_COLORS.green.solid }}>{batchStats.inGreen}</div>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: DDMRP_COLORS.blue.solid, background: DDMRP_COLORS.blue.fill }}>
                <div className="font-jetbrains text-[10px] tracking-wider" style={{ color: DDMRP_COLORS.blue.text }}>SUR-STOCK</div>
                <div className="font-bricolage text-2xl font-bold mt-1" style={{ color: DDMRP_COLORS.blue.solid }}>{batchStats.overSupply}</div>
              </div>
              <StatCard label="Total à commander" value={Math.round(batchStats.totalToOrder).toLocaleString('fr-FR')} sub="toutes lignes" />
            </div>
          )}

          {/* Tableau */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="font-jetbrains text-xs text-slate-600">TABLEAU DES BUFFERS</div>
              <div className="font-jetbrains text-[10px] text-slate-400">cliquez sur une ligne pour la visualiser</div>
            </div>

            {rows.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-14 h-14 rounded-xl mx-auto mb-5 flex items-center justify-center" style={{ background: BLUE_LIGHT, border: '1px solid #BFDBFE' }}>
                  <Box size={22} style={{ color: BLUE }} strokeWidth={1.75} />
                </div>
                <div className="font-bricolage text-xl mb-2 text-slate-800">Aucun article</div>
                <div className="text-sm text-slate-500 mb-5 max-w-md mx-auto">Importez un fichier de paramètres ou un historique de ventes (détection auto).</div>
                <div className="flex justify-center gap-2 flex-wrap">
                  <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-md font-jetbrains text-xs font-semibold text-white" style={{ background: BLUE }}>
                    IMPORTER UN FICHIER
                  </button>
                  <button onClick={() => downloadTemplate('params')} className="px-4 py-2 rounded-md font-jetbrains text-xs text-slate-700 border border-slate-300">
                    TEMPLATE PARAM.
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <Th>Réf.</Th>
                      <Th>Libellé</Th>
                      {isSalesMode && <Th>Magasin</Th>}
                      <Th className="text-right"><T code="ADU" /></Th>
                      <Th className="text-right"><T code="DLT" /></Th>
                      <Th className="text-right"><T code="MOQ" /></Th>
                      <Th className="text-right"><T code="VF" /></Th>
                      <Th className="text-right"><T code="LTF" /></Th>
                      <Th className="text-right"><T code="NFP" /></Th>
                      <Th className="text-right" highlight><T code="TOR" /></Th>
                      <Th className="text-right" highlight><T code="TOY" /></Th>
                      <Th className="text-right" highlight><T code="TOG" /></Th>
                      <Th className="text-center">Buffer</Th>
                      <Th className="text-center">Statut</Th>
                      <Th className="text-right">À cmdr</Th>
                      <Th></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedRows.map(r => {
                      const isSelected = r.id === selectedRowId;
                      const valid = r.result.valid;
                      return (
                        <tr key={r.id} onClick={() => setSelectedRowId(r.id)} className="border-b border-slate-100 cursor-pointer transition-colors" style={isSelected ? { background: BLUE_LIGHT } : {}}>
                          <Td><CellInput value={r.ref} onChange={v => updateRow(r.id, 'ref', v)} mono /></Td>
                          <Td><CellInput value={r.label} onChange={v => updateRow(r.id, 'label', v)} /></Td>
                          {isSalesMode && <Td><CellInput value={r.store || ''} onChange={v => updateRow(r.id, 'store', v)} /></Td>}
                          <Td><CellInput value={r.adu} onChange={v => updateRow(r.id, 'adu', v)} type="number" align="right" mono step="0.1" /></Td>
                          <Td><CellInput value={r.dlt} onChange={v => updateRow(r.id, 'dlt', v)} type="number" align="right" mono step="0.5" /></Td>
                          <Td><CellInput value={r.moq} onChange={v => updateRow(r.id, 'moq', v)} type="number" align="right" mono /></Td>
                          <Td><CellInput value={r.vf} onChange={v => updateRow(r.id, 'vf', v)} type="number" align="right" mono step="0.05" /></Td>
                          <Td><CellInput value={r.ltf} onChange={v => updateRow(r.id, 'ltf', v)} type="number" align="right" mono step="0.05" /></Td>
                          <Td><CellInput value={r.nfp} onChange={v => updateRow(r.id, 'nfp', v)} type="number" align="right" mono /></Td>
                          <Td className="text-right font-jetbrains" style={{ color: DDMRP_COLORS.red.text }}>{valid ? Math.round(r.result.tor) : '—'}</Td>
                          <Td className="text-right font-jetbrains" style={{ color: DDMRP_COLORS.yellow.text }}>{valid ? Math.round(r.result.toy) : '—'}</Td>
                          <Td className="text-right font-jetbrains font-semibold" style={{ color: DDMRP_COLORS.green.text }}>{valid ? Math.round(r.result.tog) : '—'}</Td>
                          <Td className="text-center"><MiniBufferBar result={r.result} nfp={r.nfp} /></Td>
                          <Td className="text-center">{valid ? <StatusBadge status={r.result.status} /> : <span className="text-slate-400">—</span>}</Td>
                          <Td className="text-right font-jetbrains font-semibold" style={{ color: valid && r.result.orderQty > 0 ? BLUE : '#94A3B8' }}>
                            {valid && r.result.orderQty > 0 ? Math.round(r.result.orderQty) : '—'}
                          </Td>
                          <Td>
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={(e) => { e.stopPropagation(); examineRow(r); }} className="p-1 text-slate-400 hover:text-blue-600 transition-colors" title="Examiner en détail">
                                <Zap size={12} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); removeRow(r.id); }} className="p-1 text-slate-400 hover:text-red-600 transition-colors" title="Supprimer">×</button>
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Chart de la ligne sélectionnée */}
          {selectedRow && selectedRow.result.valid && (
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 font-jetbrains text-xs text-slate-600 flex-wrap">
                  BUFFER — <span style={{ color: BLUE }} className="font-medium">{selectedRow.ref || 'sans ref'}</span>
                  {selectedRow.store && <><span className="text-slate-300">·</span><span className="text-slate-500">{selectedRow.store}</span></>}
                  {selectedRow.label && <><span className="text-slate-300">·</span><span className="text-slate-500">{selectedRow.label}</span></>}
                  <span className="text-slate-300">·</span>
                  <StatusBadge status={selectedRow.result.status} />
                </div>
                <button onClick={() => examineRow(selectedRow)} className="flex items-center gap-1.5 px-2.5 py-1 rounded font-jetbrains text-[10px] text-slate-600 border border-slate-300 hover:bg-slate-50 transition-all">
                  <Zap size={10} />
                  EXAMINER EN DÉTAIL
                </button>
              </div>
              <div className="p-6 flex justify-center" style={{ background: 'repeating-linear-gradient(45deg, #F8FAFC 0, #F8FAFC 14px, #F1F5F9 14px, #F1F5F9 15px)' }}>
                <BufferChart result={selectedRow.result} nfp={selectedRow.nfp} />
              </div>
            </div>
          )}

          {/* Doc DDMRP & Glossaire */}
          <div className="rounded-xl border border-slate-200 p-5 bg-white">
            <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-3">GLOSSAIRE & RAPPEL DDMRP</div>
            <div className="text-sm text-slate-600 leading-relaxed mb-4">
              Le buffer DDMRP positionne le stock dans <span className="font-medium" style={{ color: DDMRP_COLORS.red.text }}>3 zones</span> : la <span className="font-medium" style={{ color: DDMRP_COLORS.red.text }}>rouge</span> protège contre la variabilité, la <span className="font-medium" style={{ color: DDMRP_COLORS.yellow.text }}>jaune</span> couvre le délai de réapprovisionnement, la <span className="font-medium" style={{ color: DDMRP_COLORS.green.text }}>verte</span> dimensionne la quantité de commande. La <span className="font-jetbrains">Net Flow Position</span> (stock disponible + commandes en cours − demandes qualifiées) détermine dans quelle zone on se situe à un instant t. On commande ce qu'il faut pour ramener cette position au sommet du vert.
            </div>
            <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-3 pt-3 border-t border-slate-100">TERMES UTILISÉS DANS L'OUTIL</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-3">
              {Object.entries(DDMRP_TERMS).map(([code, t]) => (
                <div key={code} className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-jetbrains text-xs font-bold" style={{ color: BLUE }}>{code}</span>
                    <span className="text-[11px] text-slate-700 font-medium">{t.full.split('—')[1]?.trim() || t.full}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 leading-snug">{t.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// LogisticsConverter · Convertisseur en cascade
// Carton → Palette → Conteneur → Camion
// ============================================================

// Référentiels standards (dimensions en cm, poids en kg)
const PALLET_TYPES = [
  { id: 'EUR',     label: 'EUR (80×120)',         L: 120, W: 80,  baseH: 14.5, maxH: 200, maxLoad: 1500, tare: 25 },
  { id: 'EUR2',    label: 'EUR2 / Industrial (100×120)', L: 120, W: 100, baseH: 14.5, maxH: 200, maxLoad: 1500, tare: 30 },
  { id: 'GMA',     label: 'GMA US (102×122)',     L: 122, W: 102, baseH: 14,   maxH: 200, maxLoad: 1360, tare: 22 },
  { id: 'ISO',     label: 'ISO Asie (110×110)',   L: 110, W: 110, baseH: 14,   maxH: 200, maxLoad: 1500, tare: 25 },
  { id: 'EUR6',    label: 'EUR6 demi (80×60)',    L: 80,  W: 60,  baseH: 14.5, maxH: 200, maxLoad: 500,  tare: 9  },
];

const CONTAINER_TYPES = [
  // Dimensions intérieures en cm
  { id: '20DC',    label: "20' DC standard",      L: 590,  W: 235, H: 239, maxLoad: 28000, tare: 2200 },
  { id: '40DC',    label: "40' DC standard",      L: 1203, W: 235, H: 239, maxLoad: 26500, tare: 3800 },
  { id: '40HC',    label: "40' HC (High Cube)",   L: 1203, W: 235, H: 269, maxLoad: 26500, tare: 3900 },
  { id: '45HC',    label: "45' HC",               L: 1356, W: 235, H: 269, maxLoad: 26500, tare: 4800 },
  { id: '20RF',    label: "20' Reefer (réfrigéré)", L: 545, W: 229, H: 227, maxLoad: 27500, tare: 3050 },
  { id: '40RF',    label: "40' Reefer",           L: 1156, W: 229, H: 227, maxLoad: 27500, tare: 4400 },
];

const TRUCK_TYPES = [
  // Dimensions intérieures utiles en cm
  { id: 'VAN35',     label: 'Fourgon 3.5t',         L: 420,  W: 200, H: 215, maxLoad: 1200,  desc: '~4 EUR au sol' },
  { id: 'PORTEUR75', label: 'Porteur 7.5t',         L: 600,  W: 245, H: 240, maxLoad: 3500,  desc: '~10 EUR au sol' },
  { id: 'PORTEUR19', label: 'Porteur 19t',          L: 740,  W: 245, H: 260, maxLoad: 11000, desc: '~14 EUR au sol' },
  { id: 'SEMI',      label: 'Semi-remorque 13.6m',  L: 1360, W: 245, H: 270, maxLoad: 25000, desc: '~33 EUR au sol' },
  { id: 'MEGA',      label: 'Mega trailer',         L: 1360, W: 248, H: 300, maxLoad: 25000, desc: '~33 EUR · volume max' },
  { id: 'FRIGO',     label: 'Semi frigorifique',    L: 1340, W: 245, H: 260, maxLoad: 22000, desc: 'Température dirigée' },
];

// Calcul cartons → palette : optimal sur 2 orientations + limite hauteur + limite poids
function calcCartonsOnPallet(carton, pallet) {
  const { L: cL, W: cW, H: cH, weight: cWt } = carton;
  if (cL <= 0 || cW <= 0 || cH <= 0) return null;

  // 2 orientations possibles : carton aligné avec longueur palette, ou pivoté 90°
  const perLayerA = Math.floor(pallet.L / cL) * Math.floor(pallet.W / cW);
  const perLayerB = Math.floor(pallet.L / cW) * Math.floor(pallet.W / cL);
  const perLayer = Math.max(perLayerA, perLayerB);
  if (perLayer === 0) return { perLayer: 0, layers: 0, total: 0, limiter: 'dimensions', err: 'Carton trop grand pour la palette' };

  const availableHeight = pallet.maxH - pallet.baseH;
  const layersByHeight = Math.floor(availableHeight / cH);
  const layersByWeight = cWt > 0 ? Math.floor((pallet.maxLoad - pallet.tare) / (perLayer * cWt)) : Infinity;
  const layers = Math.max(0, Math.min(layersByHeight, layersByWeight));
  const total = perLayer * layers;
  const limiter = layersByWeight < layersByHeight ? 'poids' : 'hauteur';

  const palletTotalH = pallet.baseH + layers * cH;
  const palletTotalWeight = pallet.tare + total * cWt;
  return { perLayer, layers, total, limiter, palletTotalH, palletTotalWeight };
}

// Calcul palettes → conteneur ou camion (au sol uniquement, gerbage géré séparément)
function calcPalletsInBox(pallet, palletTotalH, palletTotalWeight, box, stackable = false) {
  // 2 orientations
  const perRowA = Math.floor(box.L / pallet.L) * Math.floor(box.W / pallet.W);
  const perRowB = Math.floor(box.L / pallet.W) * Math.floor(box.W / pallet.L);
  const perFloor = Math.max(perRowA, perRowB);
  if (perFloor === 0) return { perFloor: 0, layers: 0, total: 0, limiter: 'dimensions', err: 'Palette trop grande' };

  const layersByHeight = stackable && palletTotalH > 0 ? Math.floor(box.H / palletTotalH) : 1;
  const layersByWeight = palletTotalWeight > 0 ? Math.floor(box.maxLoad / (perFloor * palletTotalWeight)) : Infinity;
  const layers = Math.max(0, Math.min(layersByHeight, layersByWeight));
  const total = perFloor * layers;
  const limiter = layersByWeight < layersByHeight ? 'poids' : (stackable && layersByHeight < 5 ? 'hauteur' : 'plancher');
  const totalWeight = total * palletTotalWeight;
  return { perFloor, layers, total, limiter, totalWeight };
}

function LogisticsConverter({ onBack }) {
  // Niveau 1 : Carton
  const [cartonL, setCartonL] = useState(40);
  const [cartonW, setCartonW] = useState(30);
  const [cartonH, setCartonH] = useState(25);
  const [cartonWeight, setCartonWeight] = useState(5);
  const [unitsPerCarton, setUnitsPerCarton] = useState(12);

  // Niveau 2 : Palette
  const [palletId, setPalletId] = useState('EUR');
  const pallet = useMemo(() => PALLET_TYPES.find(p => p.id === palletId) || PALLET_TYPES[0], [palletId]);

  // Niveau 3 : Conteneur
  const [containerId, setContainerId] = useState('40HC');
  const [containerStackable, setContainerStackable] = useState(false);
  const container = useMemo(() => CONTAINER_TYPES.find(c => c.id === containerId) || CONTAINER_TYPES[0], [containerId]);

  // Niveau 4 : Camion
  const [truckId, setTruckId] = useState('SEMI');
  const [truckStackable, setTruckStackable] = useState(false);
  const truck = useMemo(() => TRUCK_TYPES.find(t => t.id === truckId) || TRUCK_TYPES[0], [truckId]);

  // Calculs en cascade
  const cartonResult = useMemo(() =>
    calcCartonsOnPallet(
      { L: cartonL, W: cartonW, H: cartonH, weight: cartonWeight },
      pallet
    ),
    [cartonL, cartonW, cartonH, cartonWeight, pallet]
  );

  const containerResult = useMemo(() => {
    if (!cartonResult || cartonResult.total === 0) return null;
    return calcPalletsInBox(pallet, cartonResult.palletTotalH, cartonResult.palletTotalWeight, container, containerStackable);
  }, [pallet, cartonResult, container, containerStackable]);

  const truckResult = useMemo(() => {
    if (!cartonResult || cartonResult.total === 0) return null;
    return calcPalletsInBox(pallet, cartonResult.palletTotalH, cartonResult.palletTotalWeight, truck, truckStackable);
  }, [pallet, cartonResult, truck, truckStackable]);

  // Synthèse globale
  const synth = useMemo(() => {
    if (!cartonResult) return null;
    const cartonsPerPallet = cartonResult.total;
    const unitsPerPallet = cartonsPerPallet * unitsPerCarton;
    const palletsPerContainer = containerResult?.total || 0;
    const palletsPerTruck = truckResult?.total || 0;
    return {
      unitsPerCarton,
      cartonsPerPallet,
      unitsPerPallet,
      palletsPerContainer,
      cartonsPerContainer: palletsPerContainer * cartonsPerPallet,
      unitsPerContainer: palletsPerContainer * unitsPerPallet,
      palletsPerTruck,
      cartonsPerTruck: palletsPerTruck * cartonsPerPallet,
      unitsPerTruck: palletsPerTruck * unitsPerPallet,
    };
  }, [cartonResult, containerResult, truckResult, unitsPerCarton]);

  return (
    <div className="min-h-screen text-slate-900" style={{ background: '#F8FAFC', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <FontsAndStyles />

      <nav className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-5">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-jetbrains text-xs">
              <ArrowLeft size={14} />
              RETOUR
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-3">
              <Logo small />
              <div>
                <div className="font-bricolage font-semibold text-sm leading-tight text-slate-900">Convertisseur logistique</div>
                <div className="font-jetbrains text-[10px] text-slate-500">ATELIER / 08 · cascade carton → palette → conteneur → camion</div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* COLONNE GAUCHE : 4 niveaux de configuration */}
        <div className="lg:col-span-7 space-y-4">

          {/* NIVEAU 1 : Carton */}
          <ConverterStep
            num="1"
            title="CARTON D'EXPÉDITION"
            color={BLUE}
            stat={cartonResult ? `${cartonResult.total} par palette` : null}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <NumberField label="Longueur (cm)" value={cartonL} onChange={v => setCartonL(Math.max(0, parseFloat(v) || 0))} step="1" />
              <NumberField label="Largeur (cm)" value={cartonW} onChange={v => setCartonW(Math.max(0, parseFloat(v) || 0))} step="1" />
              <NumberField label="Hauteur (cm)" value={cartonH} onChange={v => setCartonH(Math.max(0, parseFloat(v) || 0))} step="1" />
              <NumberField label="Poids (kg)" value={cartonWeight} onChange={v => setCartonWeight(Math.max(0, parseFloat(v) || 0))} step="0.1" />
            </div>
            <div className="mt-3">
              <NumberField label="Nombre d'unités par carton (UVC)" value={unitsPerCarton} onChange={v => setUnitsPerCarton(Math.max(1, parseInt(v) || 1))} step="1" />
            </div>
          </ConverterStep>

          {/* NIVEAU 2 : Palette */}
          <ConverterStep
            num="2"
            title="PALETTE"
            color={BLUE}
            stat={cartonResult && containerResult ? `${containerResult.total} par conteneur` : null}
          >
            <div className="space-y-3">
              <div>
                <label className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1.5 block">TYPE DE PALETTE</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {PALLET_TYPES.map(p => (
                    <button key={p.id} onClick={() => setPalletId(p.id)}
                      className="px-3 py-2 rounded-md font-jetbrains text-xs transition-all text-left"
                      style={palletId === p.id
                        ? { background: BLUE, color: '#FFFFFF', fontWeight: 600 }
                        : { background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
                      <div>{p.label}</div>
                      <div className="text-[9px] opacity-75 mt-0.5">{p.maxLoad} kg max · {p.maxH} cm max</div>
                    </button>
                  ))}
                </div>
              </div>
              {cartonResult && cartonResult.total > 0 && (
                <div className="rounded-lg p-3 text-xs space-y-1" style={{ background: BLUE_LIGHT, border: '1px solid #BFDBFE' }}>
                  <div className="font-jetbrains text-[10px] tracking-wider mb-1.5" style={{ color: BLUE }}>RÉSULTAT</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-700">
                    <div><span className="text-slate-500">Par couche :</span> <span className="font-jetbrains font-semibold">{cartonResult.perLayer}</span></div>
                    <div><span className="text-slate-500">Couches :</span> <span className="font-jetbrains font-semibold">{cartonResult.layers}</span></div>
                    <div><span className="text-slate-500">Total cartons :</span> <span className="font-jetbrains font-semibold" style={{ color: BLUE }}>{cartonResult.total}</span></div>
                    <div><span className="text-slate-500">Limité par :</span> <span className="font-jetbrains font-semibold capitalize">{cartonResult.limiter}</span></div>
                    <div><span className="text-slate-500">Hauteur totale :</span> <span className="font-jetbrains font-semibold">{cartonResult.palletTotalH?.toFixed(0)} cm</span></div>
                    <div><span className="text-slate-500">Poids total :</span> <span className="font-jetbrains font-semibold">{cartonResult.palletTotalWeight?.toFixed(0)} kg</span></div>
                  </div>
                </div>
              )}
              {cartonResult && cartonResult.err && (
                <div className="rounded-lg p-3 text-xs" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
                  ⚠ {cartonResult.err}
                </div>
              )}
            </div>
          </ConverterStep>

          {/* NIVEAU 3 : Conteneur */}
          <ConverterStep
            num="3"
            title="CONTENEUR MARITIME"
            color={BLUE}
            stat={containerResult ? `palettes × ${containerResult.total}` : null}
          >
            <div className="space-y-3">
              <div>
                <label className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1.5 block">TYPE DE CONTENEUR</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {CONTAINER_TYPES.map(c => (
                    <button key={c.id} onClick={() => setContainerId(c.id)}
                      className="px-3 py-2 rounded-md font-jetbrains text-xs transition-all text-left"
                      style={containerId === c.id
                        ? { background: BLUE, color: '#FFFFFF', fontWeight: 600 }
                        : { background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
                      <div>{c.label}</div>
                      <div className="text-[9px] opacity-75 mt-0.5">{(c.L/100).toFixed(2)}×{(c.W/100).toFixed(2)}×{(c.H/100).toFixed(2)} m · {(c.maxLoad/1000).toFixed(1)} t</div>
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={containerStackable} onChange={e => setContainerStackable(e.target.checked)} className="rounded" style={{ accentColor: BLUE }} />
                <span className="text-xs text-slate-700">Palettes gerbables dans le conteneur (double étage)</span>
              </label>
              {containerResult && containerResult.total > 0 && (
                <div className="rounded-lg p-3 text-xs" style={{ background: BLUE_LIGHT, border: '1px solid #BFDBFE' }}>
                  <div className="font-jetbrains text-[10px] tracking-wider mb-1.5" style={{ color: BLUE }}>RÉSULTAT</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-700">
                    <div><span className="text-slate-500">Au sol :</span> <span className="font-jetbrains font-semibold">{containerResult.perFloor}</span></div>
                    <div><span className="text-slate-500">Étages :</span> <span className="font-jetbrains font-semibold">{containerResult.layers}</span></div>
                    <div><span className="text-slate-500">Total palettes :</span> <span className="font-jetbrains font-semibold" style={{ color: BLUE }}>{containerResult.total}</span></div>
                    <div><span className="text-slate-500">Limité par :</span> <span className="font-jetbrains font-semibold capitalize">{containerResult.limiter}</span></div>
                    <div className="col-span-2"><span className="text-slate-500">Poids total :</span> <span className="font-jetbrains font-semibold">{(containerResult.totalWeight/1000).toFixed(1)} t</span> / {(container.maxLoad/1000).toFixed(1)} t max</div>
                  </div>
                </div>
              )}
              {containerResult?.err && (
                <div className="rounded-lg p-3 text-xs" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
                  ⚠ {containerResult.err}
                </div>
              )}
            </div>
          </ConverterStep>

          {/* NIVEAU 4 : Camion */}
          <ConverterStep
            num="4"
            title="CAMION ROUTIER"
            color={BLUE}
            stat={truckResult ? `palettes × ${truckResult.total}` : null}
          >
            <div className="space-y-3">
              <div>
                <label className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1.5 block">TYPE DE CAMION</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {TRUCK_TYPES.map(t => (
                    <button key={t.id} onClick={() => setTruckId(t.id)}
                      className="px-3 py-2 rounded-md font-jetbrains text-xs transition-all text-left"
                      style={truckId === t.id
                        ? { background: BLUE, color: '#FFFFFF', fontWeight: 600 }
                        : { background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
                      <div>{t.label}</div>
                      <div className="text-[9px] opacity-75 mt-0.5">{(t.L/100).toFixed(1)}×{(t.W/100).toFixed(2)} m · {(t.maxLoad/1000).toFixed(1)} t · {t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={truckStackable} onChange={e => setTruckStackable(e.target.checked)} className="rounded" style={{ accentColor: BLUE }} />
                <span className="text-xs text-slate-700">Palettes gerbables dans le camion</span>
              </label>
              {truckResult && truckResult.total > 0 && (
                <div className="rounded-lg p-3 text-xs" style={{ background: BLUE_LIGHT, border: '1px solid #BFDBFE' }}>
                  <div className="font-jetbrains text-[10px] tracking-wider mb-1.5" style={{ color: BLUE }}>RÉSULTAT</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-700">
                    <div><span className="text-slate-500">Au sol :</span> <span className="font-jetbrains font-semibold">{truckResult.perFloor}</span></div>
                    <div><span className="text-slate-500">Étages :</span> <span className="font-jetbrains font-semibold">{truckResult.layers}</span></div>
                    <div><span className="text-slate-500">Total palettes :</span> <span className="font-jetbrains font-semibold" style={{ color: BLUE }}>{truckResult.total}</span></div>
                    <div><span className="text-slate-500">Limité par :</span> <span className="font-jetbrains font-semibold capitalize">{truckResult.limiter}</span></div>
                    <div className="col-span-2"><span className="text-slate-500">Poids total :</span> <span className="font-jetbrains font-semibold">{(truckResult.totalWeight/1000).toFixed(1)} t</span> / {(truck.maxLoad/1000).toFixed(1)} t max</div>
                  </div>
                </div>
              )}
              {truckResult?.err && (
                <div className="rounded-lg p-3 text-xs" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
                  ⚠ {truckResult.err}
                </div>
              )}
            </div>
          </ConverterStep>
        </div>

        {/* COLONNE DROITE : SYNTHÈSE (sticky) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-[88px] space-y-4">

            {/* Synthèse cascade */}
            <div className="rounded-xl overflow-hidden shadow-sm" style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)' }}>
              <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                <div className="font-jetbrains text-[10px] text-white tracking-wider opacity-80">SYNTHÈSE DE LA CHAÎNE</div>
                <div className="font-bricolage font-bold text-xl text-white mt-1">1 chargement complet</div>
              </div>
              <div className="p-5 space-y-3">
                {synth && synth.cartonsPerPallet > 0 ? (
                  <>
                    <CascadeRow level="Par carton" value={synth.unitsPerCarton} unit="unités" color="rgba(255,255,255,0.85)" />
                    <CascadeArrow />
                    <CascadeRow level="Par palette" value={synth.cartonsPerPallet} unit="cartons" sub={`${synth.unitsPerPallet.toLocaleString('fr-FR')} unités`} color="rgba(255,255,255,0.95)" />
                    <CascadeArrow />
                    <CascadeRow level="Par conteneur" value={synth.palletsPerContainer} unit="palettes" sub={`${synth.cartonsPerContainer.toLocaleString('fr-FR')} cartons · ${synth.unitsPerContainer.toLocaleString('fr-FR')} unités`} color="white" big />
                    <CascadeArrow />
                    <CascadeRow level="Par camion" value={synth.palletsPerTruck} unit="palettes" sub={`${synth.cartonsPerTruck.toLocaleString('fr-FR')} cartons · ${synth.unitsPerTruck.toLocaleString('fr-FR')} unités`} color="white" big />
                  </>
                ) : (
                  <div className="text-white text-sm opacity-70 text-center py-4">
                    Renseignez les dimensions du carton pour démarrer le calcul
                  </div>
                )}
              </div>
            </div>

            {/* Taux de remplissage */}
            {synth && synth.palletsPerTruck > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-3">TAUX DE REMPLISSAGE</div>
                <FillBar label="Conteneur (poids)" value={containerResult ? Math.min(100, (containerResult.totalWeight / container.maxLoad) * 100) : 0} />
                <FillBar label="Camion (poids)" value={truckResult ? Math.min(100, (truckResult.totalWeight / truck.maxLoad) * 100) : 0} />
              </div>
            )}

            {/* Aide / note */}
            <div className="rounded-xl border border-blue-200 p-4 text-xs leading-relaxed" style={{ background: BLUE_LIGHT }}>
              <div className="font-jetbrains text-[10px] tracking-wider mb-2 font-semibold" style={{ color: BLUE }}>
                MÉTHODE DE CALCUL
              </div>
              <div className="text-blue-900">
                Chaque étape teste les <span className="font-semibold">deux orientations possibles</span> et retient la plus efficace. Le résultat est limité soit par les dimensions (plancher / hauteur), soit par le poids maximum admissible. Les estimations supposent un chargement standard sans débordement ni serrage spécial. Pour les marchandises atypiques (cylindres, longueurs hors-norme), prévoyez 10-15 % de marge.
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// Step container avec numéro et stat à droite
function ConverterStep({ num, title, stat, color, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full flex items-center justify-center font-jetbrains text-xs font-bold text-white" style={{ background: color }}>
            {num}
          </div>
          <div className="font-jetbrains text-xs text-slate-700 font-semibold tracking-wider">{title}</div>
        </div>
        {stat && <div className="font-jetbrains text-xs font-semibold" style={{ color }}>{stat}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function CascadeRow({ level, value, unit, sub, color, big }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="flex-1">
        <div className="font-jetbrains text-[10px] tracking-wider" style={{ color, opacity: 0.7 }}>{level}</div>
        {sub && <div className="text-[10px] mt-0.5" style={{ color, opacity: 0.65 }}>{sub}</div>}
      </div>
      <div className="text-right">
        <span className={`font-bricolage font-bold ${big ? 'text-2xl' : 'text-lg'}`} style={{ color }}>{value.toLocaleString('fr-FR')}</span>
        <span className="font-jetbrains text-xs ml-1.5" style={{ color, opacity: 0.75 }}>{unit}</span>
      </div>
    </div>
  );
}

function CascadeArrow() {
  return (
    <div className="flex justify-center">
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1 }}>↓</div>
    </div>
  );
}

function FillBar({ label, value }) {
  const isHigh = value > 90;
  const isMid = value > 70;
  const color = isHigh ? '#DC2626' : isMid ? '#D97706' : '#059669';
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="font-jetbrains text-xs font-semibold" style={{ color }}>{value.toFixed(0)} %</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-slate-100">
        <div className="h-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

// ============================================================
// OtifAnalyzer · Analyse de performance livraison (OTIF / SLA)
// OTIF = On Time × In Full
// ============================================================

const OTIF_COLUMN_ALIASES = {
  orderId:       ['n° commande', 'numéro commande', 'numero commande', 'commande', 'order', 'po', 'cmd', 'order id', 'order number', 'reference commande'],
  ref:           ['référence article', 'référence', 'article', 'sku', 'item', 'product', 'code', 'reference'],
  partner:       ['fournisseur', 'client', 'tiers', 'partenaire', 'supplier', 'customer', 'fournisseur / client', 'partner'],
  promisedDate:  ['date promise', 'date prévue', 'date prevue', 'date estimée', 'promised date', 'due date', 'date demandée', 'date demandee', 'date confirmée'],
  deliveredDate: ['date livrée', 'date livree', 'date réelle', 'date reelle', 'actual date', 'delivered date', 'date livraison', 'date effective', 'date reception'],
  orderedQty:    ['qté commandée', 'quantité commandée', 'quantite commandee', 'qte commandee', 'ordered qty', 'ordered', 'qty ordered', 'quantité demandée'],
  deliveredQty:  ['qté livrée', 'quantité livrée', 'quantite livree', 'qte livree', 'delivered qty', 'delivered', 'qty delivered', 'quantité reçue'],
};

// Génère un template OTIF avec cas variés (parfait, retard, manquant, échec total)
function generateOtifTemplate() {
  const baseDate = new Date('2026-01-15');
  const day = (n) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  return [
    { 'N° commande': 'CMD-001', 'Référence article': 'A001', 'Fournisseur': 'ALPHA INDUSTRIES', 'Date promise': day(0), 'Date livrée': day(0), 'Qté commandée': 100, 'Qté livrée': 100 },
    { 'N° commande': 'CMD-002', 'Référence article': 'A002', 'Fournisseur': 'ALPHA INDUSTRIES', 'Date promise': day(2), 'Date livrée': day(4), 'Qté commandée': 50, 'Qté livrée': 50 },
    { 'N° commande': 'CMD-003', 'Référence article': 'A001', 'Fournisseur': 'BETA LOGISTICS', 'Date promise': day(5), 'Date livrée': day(5), 'Qté commandée': 200, 'Qté livrée': 180 },
    { 'N° commande': 'CMD-004', 'Référence article': 'A003', 'Fournisseur': 'BETA LOGISTICS', 'Date promise': day(7), 'Date livrée': day(10), 'Qté commandée': 75, 'Qté livrée': 60 },
    { 'N° commande': 'CMD-005', 'Référence article': 'A002', 'Fournisseur': 'GAMMA SUPPLY', 'Date promise': day(10), 'Date livrée': day(10), 'Qté commandée': 30, 'Qté livrée': 30 },
    { 'N° commande': 'CMD-006', 'Référence article': 'A001', 'Fournisseur': 'GAMMA SUPPLY', 'Date promise': day(12), 'Date livrée': day(13), 'Qté commandée': 150, 'Qté livrée': 150 },
    { 'N° commande': 'CMD-007', 'Référence article': 'A003', 'Fournisseur': 'ALPHA INDUSTRIES', 'Date promise': day(15), 'Date livrée': day(15), 'Qté commandée': 100, 'Qté livrée': 95 },
    { 'N° commande': 'CMD-008', 'Référence article': 'A002', 'Fournisseur': 'BETA LOGISTICS', 'Date promise': day(18), 'Date livrée': day(22), 'Qté commandée': 80, 'Qté livrée': 80 },
    { 'N° commande': 'CMD-009', 'Référence article': 'A001', 'Fournisseur': 'GAMMA SUPPLY', 'Date promise': day(20), 'Date livrée': day(20), 'Qté commandée': 120, 'Qté livrée': 120 },
    { 'N° commande': 'CMD-010', 'Référence article': 'A003', 'Fournisseur': 'ALPHA INDUSTRIES', 'Date promise': day(25), 'Date livrée': day(28), 'Qté commandée': 200, 'Qté livrée': 200 },
  ];
}

// Parser OTIF : transforme les lignes brutes en objets de livraison
function parseOtifDeliveries(json) {
  const deliveries = [];
  let errorCount = 0;
  let idx = 0;
  for (const raw of json) {
    const orderId = String(findField(raw, OTIF_COLUMN_ALIASES.orderId) || '').trim();
    const ref = String(findField(raw, OTIF_COLUMN_ALIASES.ref) || '').trim();
    const partner = String(findField(raw, OTIF_COLUMN_ALIASES.partner) || '').trim() || 'Non renseigné';
    const promised = parseDate(findField(raw, OTIF_COLUMN_ALIASES.promisedDate));
    const delivered = parseDate(findField(raw, OTIF_COLUMN_ALIASES.deliveredDate));
    const orderedQty = parseFloat(findField(raw, OTIF_COLUMN_ALIASES.orderedQty));
    const deliveredQty = parseFloat(findField(raw, OTIF_COLUMN_ALIASES.deliveredQty));

    if (!promised || !delivered || isNaN(orderedQty) || isNaN(deliveredQty)) {
      errorCount++;
      continue;
    }
    deliveries.push({
      id: `del-${Date.now()}-${idx++}`,
      orderId: orderId || `CMD-${idx}`,
      ref: ref || '—',
      partner,
      promisedDate: promised,
      deliveredDate: delivered,
      orderedQty,
      deliveredQty,
    });
  }
  return { deliveries, errorCount };
}

// Calcule pour chaque livraison ses indicateurs OT, IF, OTIF
function computeOtifMetrics(deliveries, otTolerance, ifTolerance) {
  return deliveries.map(d => {
    const delayDays = Math.round((d.deliveredDate - d.promisedDate) / (24 * 3600 * 1000));
    const fillRate = d.orderedQty > 0 ? d.deliveredQty / d.orderedQty : 0;
    const isOnTime = delayDays <= otTolerance;
    const isInFull = fillRate >= (ifTolerance / 100);
    const isOtif = isOnTime && isInFull;
    return { ...d, delayDays, fillRate, isOnTime, isInFull, isOtif };
  });
}

// Agrège par fournisseur ou par mois
function aggregateOtif(rows, keyFn) {
  const groups = {};
  for (const r of rows) {
    const key = keyFn(r);
    if (!groups[key]) groups[key] = { key, total: 0, ot: 0, if_: 0, otif: 0, totalDelay: 0 };
    const g = groups[key];
    g.total++;
    if (r.isOnTime) g.ot++;
    if (r.isInFull) g.if_++;
    if (r.isOtif) g.otif++;
    g.totalDelay += Math.max(0, r.delayDays);
  }
  return Object.values(groups).map(g => ({
    ...g,
    otRate: g.total > 0 ? (g.ot / g.total) * 100 : 0,
    ifRate: g.total > 0 ? (g.if_ / g.total) * 100 : 0,
    otifRate: g.total > 0 ? (g.otif / g.total) * 100 : 0,
    avgDelay: g.total > 0 ? g.totalDelay / g.total : 0,
  })).sort((a, b) => a.otifRate - b.otifRate); // Pire en premier
}

function OtifAnalyzer({ onBack }) {
  const [deliveries, setDeliveries] = useState([]);
  const [otTolerance, setOtTolerance] = useState(0); // jours de retard tolérés (0 = livraison à J)
  const [ifTolerance, setIfTolerance] = useState(100); // % minimum pour considérer "In Full" (100 = strict)
  const [pivot, setPivot] = useState('partner'); // partner | month | ref
  const [importMsg, setImportMsg] = useState(null);
  const fileInputRef = useRef(null);

  // Calculs réactifs
  const computedRows = useMemo(
    () => computeOtifMetrics(deliveries, otTolerance, ifTolerance),
    [deliveries, otTolerance, ifTolerance]
  );

  const kpis = useMemo(() => {
    if (computedRows.length === 0) return null;
    const total = computedRows.length;
    const otCount = computedRows.filter(r => r.isOnTime).length;
    const ifCount = computedRows.filter(r => r.isInFull).length;
    const otifCount = computedRows.filter(r => r.isOtif).length;
    const delays = computedRows.filter(r => r.delayDays > 0).map(r => r.delayDays);
    const avgDelay = delays.length > 0 ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;
    const partials = computedRows.filter(r => !r.isInFull);
    const avgFillRateOnFailures = partials.length > 0
      ? partials.reduce((a, b) => a + b.fillRate, 0) / partials.length * 100
      : 0;
    return {
      total,
      otRate: (otCount / total) * 100,
      ifRate: (ifCount / total) * 100,
      otifRate: (otifCount / total) * 100,
      otCount, ifCount, otifCount,
      failuresOt: total - otCount,
      failuresIf: total - ifCount,
      avgDelay,
      avgFillRateOnFailures,
    };
  }, [computedRows]);

  const aggregated = useMemo(() => {
    if (computedRows.length === 0) return [];
    if (pivot === 'partner') return aggregateOtif(computedRows, r => r.partner);
    if (pivot === 'ref') return aggregateOtif(computedRows, r => r.ref);
    if (pivot === 'month') return aggregateOtif(computedRows, r => r.promisedDate.toISOString().slice(0, 7));
    return [];
  }, [computedRows, pivot]);

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (json.length === 0) throw new Error('Aucune ligne détectée');

      // Vérifier colonnes obligatoires
      const firstRow = json[0];
      const requiredCols = {
        'Date promise': OTIF_COLUMN_ALIASES.promisedDate,
        'Date livrée': OTIF_COLUMN_ALIASES.deliveredDate,
        'Qté commandée': OTIF_COLUMN_ALIASES.orderedQty,
        'Qté livrée': OTIF_COLUMN_ALIASES.deliveredQty,
      };
      const missing = Object.entries(requiredCols)
        .filter(([_, aliases]) => findField(firstRow, aliases) === undefined)
        .map(([label]) => label);

      if (missing.length > 0) {
        setImportMsg({
          type: 'error',
          text: `Colonnes obligatoires manquantes : ${missing.join(', ')}. Téléchargez le template pour voir les en-têtes attendus.`
        });
        setTimeout(() => setImportMsg(null), 7000);
        return;
      }

      const { deliveries: parsed, errorCount } = parseOtifDeliveries(json);
      setDeliveries(parsed);
      const skipMsg = errorCount > 0 ? ` · ${errorCount} ligne(s) ignorée(s) (date ou quantité invalide)` : '';
      setImportMsg({
        type: errorCount > 0 ? 'warning' : 'success',
        text: `${parsed.length} livraison(s) importée(s) depuis « ${file.name} »${skipMsg}`
      });
      setTimeout(() => setImportMsg(null), 6000);
    } catch (err) {
      setImportMsg({ type: 'error', text: 'Erreur d\'import : ' + err.message });
      setTimeout(() => setImportMsg(null), 6000);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(generateOtifTemplate());
    ws['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Livraisons');
    XLSX.writeFile(wb, 'atelier-otif-template.xlsx');
  };

  const exportXlsx = () => {
    if (computedRows.length === 0) return;
    const rows = computedRows.map(r => ({
      'N° commande': r.orderId,
      'Référence article': r.ref,
      'Fournisseur': r.partner,
      'Date promise': r.promisedDate.toISOString().slice(0, 10),
      'Date livrée': r.deliveredDate.toISOString().slice(0, 10),
      'Qté commandée': r.orderedQty,
      'Qté livrée': r.deliveredQty,
      'Écart jours': r.delayDays,
      'Taux complétude': Math.round(r.fillRate * 1000) / 10 + ' %',
      'On Time': r.isOnTime ? 'OUI' : 'NON',
      'In Full': r.isInFull ? 'OUI' : 'NON',
      'OTIF': r.isOtif ? 'OUI' : 'NON',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Livraisons OTIF');

    // Feuille KPIs
    if (kpis) {
      const kpiRows = [
        { 'Indicateur': 'Total livraisons analysées', 'Valeur': kpis.total },
        { 'Indicateur': 'Taux OTIF', 'Valeur': kpis.otifRate.toFixed(2) + ' %' },
        { 'Indicateur': 'Taux On Time', 'Valeur': kpis.otRate.toFixed(2) + ' %' },
        { 'Indicateur': 'Taux In Full', 'Valeur': kpis.ifRate.toFixed(2) + ' %' },
        { 'Indicateur': 'Retard moyen (livraisons en retard)', 'Valeur': kpis.avgDelay.toFixed(1) + ' jours' },
        { 'Indicateur': 'Taux complétude moyen (livraisons incomplètes)', 'Valeur': kpis.avgFillRateOnFailures.toFixed(1) + ' %' },
        { 'Indicateur': 'Tolérance OT', 'Valeur': otTolerance + ' jours' },
        { 'Indicateur': 'Tolérance IF', 'Valeur': ifTolerance + ' %' },
        { 'Indicateur': 'Date du calcul', 'Valeur': new Date().toLocaleString('fr-FR') },
      ];
      const ws2 = XLSX.utils.json_to_sheet(kpiRows);
      XLSX.utils.book_append_sheet(wb, ws2, 'KPIs');
    }
    XLSX.writeFile(wb, `atelier-otif-${Date.now()}.xlsx`);
  };

  const clearAll = () => {
    if (deliveries.length === 0) return;
    if (window.confirm('Vider toutes les livraisons ?')) setDeliveries([]);
  };

  return (
    <div className="min-h-screen text-slate-900" style={{ background: '#F8FAFC', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <FontsAndStyles />

      <nav className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-5">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-jetbrains text-xs">
              <ArrowLeft size={14} />
              RETOUR
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-3">
              <Logo small />
              <div>
                <div className="font-bricolage font-semibold text-sm leading-tight text-slate-900">Performance livraison · OTIF</div>
                <div className="font-jetbrains text-[10px] text-slate-500">ATELIER / 09 · On Time × In Full</div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-5">

        {/* Barre d'actions */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileImport} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-md font-jetbrains text-xs font-semibold text-white shadow-sm transition-all hover:translate-y-[-1px]" style={{ background: BLUE }}>
              <Upload size={13} />
              IMPORTER LIVRAISONS
            </button>
            <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-2 rounded-md font-jetbrains text-xs text-slate-700 border border-slate-300 hover:bg-slate-50 transition-all">
              <FileDown size={13} />
              TEMPLATE
            </button>
            <button onClick={exportXlsx} disabled={computedRows.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-md font-jetbrains text-xs text-slate-700 border border-slate-300 hover:bg-slate-50 transition-all disabled:opacity-40">
              <Download size={13} />
              EXPORTER ANALYSE
            </button>
            <div className="w-px h-5 bg-slate-200 mx-1" />
            <button onClick={clearAll} disabled={deliveries.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-md font-jetbrains text-xs text-red-600 border border-red-200 hover:bg-red-50 transition-all disabled:opacity-40">
              VIDER
            </button>
          </div>
          <div className="font-jetbrains text-xs text-slate-500">
            {deliveries.length > 0 ? `${deliveries.length} livraison(s) analysée(s)` : 'Aucune livraison'}
          </div>
        </div>

        {/* Message d'import */}
        {importMsg && (
          <div className="rounded-lg p-3 font-jetbrains text-xs"
            style={
              importMsg.type === 'success' ? { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }
              : importMsg.type === 'warning' ? { background: '#FFFBEB', color: '#92400E', border: '1px solid #FCD34D' }
              : { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }
            }>
            {importMsg.text}
          </div>
        )}

        {/* Empty state */}
        {deliveries.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-16 text-center">
            <div className="w-14 h-14 rounded-xl mx-auto mb-5 flex items-center justify-center" style={{ background: BLUE_LIGHT, border: '1px solid #BFDBFE' }}>
              <Calculator size={22} style={{ color: BLUE }} strokeWidth={1.75} />
            </div>
            <div className="font-bricolage text-xl mb-2 text-slate-800">Analysez votre performance livraison</div>
            <div className="text-sm text-slate-500 mb-5 max-w-xl mx-auto">
              Importez un extract de votre ERP avec dates promises / dates livrées et quantités commandées / livrées.
              L'outil calcule OTIF, On Time, In Full avec décomposition par fournisseur et par période.
            </div>
            <div className="flex justify-center gap-2 flex-wrap">
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-md font-jetbrains text-xs font-semibold text-white" style={{ background: BLUE }}>
                IMPORTER UN FICHIER
              </button>
              <button onClick={downloadTemplate} className="px-4 py-2 rounded-md font-jetbrains text-xs text-slate-700 border border-slate-300">
                TÉLÉCHARGER LE TEMPLATE
              </button>
            </div>
          </div>
        )}

        {/* KPIs */}
        {kpis && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* OTIF — la carte principale */}
              <div className="rounded-xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)' }}>
                <div className="font-jetbrains text-[10px] tracking-wider opacity-80 mb-1">TAUX OTIF GLOBAL</div>
                <div className="font-bricolage font-bold text-4xl">{kpis.otifRate.toFixed(1)}<span className="text-xl"> %</span></div>
                <div className="font-jetbrains text-[10px] mt-1 opacity-80">{kpis.otifCount} / {kpis.total} livraisons</div>
              </div>
              <KpiCard label="On Time" value={kpis.otRate} total={kpis.otCount} totalAll={kpis.total} sub={`${kpis.failuresOt} retard(s)`} />
              <KpiCard label="In Full" value={kpis.ifRate} total={kpis.ifCount} totalAll={kpis.total} sub={`${kpis.failuresIf} incomplète(s)`} />
              <div className="rounded-xl border border-slate-200 p-4 bg-white">
                <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-2">CARACTÉRISTIQUES DÉFAUTS</div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs"><span className="text-slate-500">Retard moyen</span><span className="font-jetbrains font-semibold text-slate-800">{kpis.avgDelay.toFixed(1)} j</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-500">Complétude défauts</span><span className="font-jetbrains font-semibold text-slate-800">{kpis.avgFillRateOnFailures.toFixed(0)} %</span></div>
                </div>
              </div>
            </div>

            {/* Paramètres de tolérance */}
            <div className="rounded-xl border p-4" style={{ borderColor: '#BFDBFE', background: BLUE_LIGHT }}>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="font-jetbrains text-xs tracking-wider font-semibold" style={{ color: BLUE }}>SEUILS DE TOLÉRANCE</div>
                <div className="font-jetbrains text-[10px] text-blue-700">recalcul instantané · ajustez selon votre politique de service</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <label className="font-jetbrains text-[10px] tracking-wider" style={{ color: BLUE }}>RETARD TOLÉRÉ (On Time)</label>
                    <span className="font-jetbrains text-sm font-semibold" style={{ color: BLUE }}>{otTolerance >= 0 ? '+' : ''}{otTolerance} j</span>
                  </div>
                  <input type="range" min="0" max="7" step="1" value={otTolerance} onChange={e => setOtTolerance(parseInt(e.target.value))} className="w-full" style={{ accentColor: BLUE }} />
                  <div className="flex justify-between font-jetbrains text-[10px] mt-0.5" style={{ color: BLUE }}>
                    <span>0 j (strict)</span>
                    <span>7 j</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <label className="font-jetbrains text-[10px] tracking-wider" style={{ color: BLUE }}>COMPLÉTUDE MINIMUM (In Full)</label>
                    <span className="font-jetbrains text-sm font-semibold" style={{ color: BLUE }}>≥ {ifTolerance} %</span>
                  </div>
                  <input type="range" min="80" max="100" step="1" value={ifTolerance} onChange={e => setIfTolerance(parseInt(e.target.value))} className="w-full" style={{ accentColor: BLUE }} />
                  <div className="flex justify-between font-jetbrains text-[10px] mt-0.5" style={{ color: BLUE }}>
                    <span>80 %</span>
                    <span>100 % (strict)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visualisation barres OT / IF / OTIF */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-4">DÉCOMPOSITION DES PERFORMANCES</div>
              <div className="space-y-4">
                <OtifBar label="On Time" success={kpis.otCount} total={kpis.total} color="#3B82F6" />
                <OtifBar label="In Full" success={kpis.ifCount} total={kpis.total} color="#8B5CF6" />
                <OtifBar label="OTIF" success={kpis.otifCount} total={kpis.total} color="#059669" emphasis />
              </div>
            </div>

            {/* Pivot par dimension */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                <div className="font-jetbrains text-xs text-slate-600">DÉCOMPOSITION (pire performance en premier)</div>
                <div className="flex items-center gap-1 p-0.5 rounded-md border border-slate-200 bg-white">
                  {[
                    { id: 'partner', label: 'Par fournisseur' },
                    { id: 'ref', label: 'Par article' },
                    { id: 'month', label: 'Par mois' },
                  ].map(opt => (
                    <button key={opt.id} onClick={() => setPivot(opt.id)}
                      className="px-2.5 py-1 rounded font-jetbrains text-[10px] transition-all"
                      style={pivot === opt.id ? { background: BLUE, color: 'white', fontWeight: 600 } : { color: '#64748B' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/30">
                      <Th>{pivot === 'partner' ? 'Fournisseur' : pivot === 'ref' ? 'Référence' : 'Mois'}</Th>
                      <Th className="text-right">Livraisons</Th>
                      <Th className="text-right">OT %</Th>
                      <Th className="text-right">IF %</Th>
                      <Th className="text-right" highlight>OTIF %</Th>
                      <Th className="text-right">Retard moy.</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregated.map(g => (
                      <tr key={g.key} className="border-b border-slate-100">
                        <Td className="text-slate-800 font-medium">{g.key}</Td>
                        <Td className="text-right font-jetbrains text-slate-700">{g.total}</Td>
                        <Td className="text-right font-jetbrains" style={{ color: g.otRate < 80 ? '#DC2626' : g.otRate < 95 ? '#D97706' : '#059669' }}>{g.otRate.toFixed(0)} %</Td>
                        <Td className="text-right font-jetbrains" style={{ color: g.ifRate < 80 ? '#DC2626' : g.ifRate < 95 ? '#D97706' : '#059669' }}>{g.ifRate.toFixed(0)} %</Td>
                        <Td className="text-right font-jetbrains font-semibold" style={{ color: g.otifRate < 70 ? '#DC2626' : g.otifRate < 90 ? '#D97706' : '#059669' }}>{g.otifRate.toFixed(0)} %</Td>
                        <Td className="text-right font-jetbrains text-slate-600">{g.avgDelay.toFixed(1)} j</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Détail livraisons */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="font-jetbrains text-xs text-slate-600">DÉTAIL LIVRAISONS</div>
                <div className="font-jetbrains text-[10px] text-slate-400">{computedRows.length} ligne(s)</div>
              </div>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="border-b border-slate-200">
                      <Th>Commande</Th>
                      <Th>Article</Th>
                      <Th>Fournisseur</Th>
                      <Th>Date promise</Th>
                      <Th>Date livrée</Th>
                      <Th className="text-right">Écart (j)</Th>
                      <Th className="text-right">Cmd / Livré</Th>
                      <Th className="text-center">OT</Th>
                      <Th className="text-center">IF</Th>
                      <Th className="text-center" highlight>OTIF</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedRows.slice(0, 200).map(r => (
                      <tr key={r.id} className="border-b border-slate-100">
                        <Td className="font-jetbrains text-slate-700">{r.orderId}</Td>
                        <Td className="font-jetbrains text-slate-600">{r.ref}</Td>
                        <Td className="text-slate-700">{r.partner}</Td>
                        <Td className="font-jetbrains text-slate-600">{r.promisedDate.toISOString().slice(0, 10)}</Td>
                        <Td className="font-jetbrains text-slate-600">{r.deliveredDate.toISOString().slice(0, 10)}</Td>
                        <Td className="text-right font-jetbrains" style={{ color: r.delayDays > 0 ? '#DC2626' : r.delayDays < 0 ? '#059669' : '#64748B' }}>{r.delayDays > 0 ? `+${r.delayDays}` : r.delayDays}</Td>
                        <Td className="text-right font-jetbrains text-slate-700">{r.orderedQty} / {r.deliveredQty} <span className="text-[10px] text-slate-500">({(r.fillRate * 100).toFixed(0)} %)</span></Td>
                        <Td className="text-center"><StatusDot ok={r.isOnTime} /></Td>
                        <Td className="text-center"><StatusDot ok={r.isInFull} /></Td>
                        <Td className="text-center"><StatusDot ok={r.isOtif} emphasis /></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {computedRows.length > 200 && (
                  <div className="p-2 text-center font-jetbrains text-[10px] text-slate-500 border-t border-slate-100">
                    Affichage limité aux 200 premières lignes — les KPIs et l'export portent sur la totalité ({computedRows.length})
                  </div>
                )}
              </div>
            </div>

            {/* Doc / aide */}
            <div className="rounded-xl border border-slate-200 p-5 bg-white">
              <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-3">À PROPOS DE L'OTIF</div>
              <div className="text-sm text-slate-600 leading-relaxed mb-3">
                <span className="font-semibold">OTIF = On Time × In Full</span> est le KPI roi de la performance livraison. Une livraison est OTIF uniquement si elle est <span className="font-medium">livrée à la date promise</span> ET <span className="font-medium">complète en quantité</span>. La multiplication des deux taux pénalise fortement les défaillances partielles : un fournisseur à 95 % OT et 95 % IF n'est qu'à 90 % OTIF.
              </div>
              <div className="text-sm text-slate-600 leading-relaxed">
                Standards d'évaluation : un OTIF supérieur à <span className="font-medium" style={{ color: '#059669' }}>95 %</span> est excellent (classe mondiale), entre <span className="font-medium" style={{ color: '#D97706' }}>85 et 95 %</span> est correct, en-dessous de <span className="font-medium" style={{ color: '#DC2626' }}>85 %</span> indique des dysfonctionnements à investiguer côté fournisseur, transporteur ou process interne.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Helpers OTIF
function KpiCard({ label, value, total, totalAll, sub }) {
  const color = value >= 95 ? '#059669' : value >= 85 ? '#D97706' : '#DC2626';
  return (
    <div className="rounded-xl border border-slate-200 p-4 bg-white">
      <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1">{label}</div>
      <div className="font-bricolage font-bold text-3xl" style={{ color }}>{value.toFixed(1)}<span className="text-base"> %</span></div>
      <div className="font-jetbrains text-[10px] text-slate-500 mt-1">{total} / {totalAll} · {sub}</div>
    </div>
  );
}

function OtifBar({ label, success, total, color, emphasis }) {
  const rate = total > 0 ? (success / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className={`text-xs ${emphasis ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{label}</span>
        <span className="font-jetbrains text-xs font-semibold" style={{ color }}>{success} / {total} · {rate.toFixed(1)} %</span>
      </div>
      <div className={`rounded-full overflow-hidden bg-slate-100 ${emphasis ? 'h-4' : 'h-2.5'}`}>
        <div className="h-full transition-all" style={{ width: `${rate}%`, background: color }} />
      </div>
    </div>
  );
}

function StatusDot({ ok, emphasis }) {
  return (
    <span className={`inline-block rounded-full ${emphasis ? 'w-3 h-3' : 'w-2 h-2'}`}
          style={{ background: ok ? '#059669' : '#DC2626' }} />
  );
}

// ============================================================
// AuditFlash · Audit Supply Chain Express
// Lead magnet WALYCONSEIL — analyse rapide à partir de 2 fichiers
// ============================================================

const AUDIT_SALES_ALIASES = {
  ref:        ['ref', 'reference', 'référence', 'sku', 'code', 'article', 'item', 'code article'],
  label:      ['libelle', 'libellé', 'nom', 'description', 'designation', 'désignation', 'name'],
  date:       ['date', 'date vente', 'date de vente', 'jour', 'sale date', 'date commande', 'date facture'],
  qty:        ['qté', 'qte', 'quantité', 'quantite', 'qty', 'quantity', 'volume', 'qté vendue', 'quantité vendue', 'qte vendue'],
  amount:     ['ca', 'montant', 'montant ht', 'ca ht', 'amount', 'revenue', 'total', 'valeur', 'chiffre affaires', "chiffre d'affaires"],
  unitPrice:  ['prix', 'prix unitaire', 'pu', 'unit price', 'price', 'prix de vente'],
  store:      ['magasin', 'depot', 'dépôt', 'entrepot', 'entrepôt', 'site', 'boutique', 'store', 'warehouse', 'location', 'agence', 'point de vente'],
};

const AUDIT_STOCK_ALIASES = {
  ref:        ['ref', 'reference', 'référence', 'sku', 'code', 'article', 'item', 'code article'],
  label:      ['libelle', 'libellé', 'nom', 'description', 'designation', 'name'],
  qty:        ['stock', 'quantité stock', 'quantite stock', 'qty', 'quantity', 'qté', 'qte', 'stock disponible', 'disponible'],
  pmp:        ['pmp', 'prix moyen pondéré', 'prix moyen pondere', 'cump', 'cmp', 'cmup', 'cost', 'cout unitaire', 'coût unitaire', 'prix achat', 'prix d\'achat', 'prix unitaire', 'pu', 'pu ht', 'valeur unitaire', 'val unitaire', 'puhp', 'prix moyen', 'prix de revient', 'cost price', 'unit cost', 'pmp ht', 'cump ht'],
  value:      ['valeur stock', 'valeur', 'stock value', 'montant stock', 'valeur immobilisée'],
  store:      ['magasin', 'depot', 'dépôt', 'entrepot', 'entrepôt', 'site', 'boutique', 'store', 'warehouse', 'location', 'agence', 'point de vente'],
  category:   ['categorie', 'catégorie', 'famille', 'groupe', 'category', 'family', 'classe'],
};

// Audit complet — fichiers complémentaires
const AUDIT_SUPPLIER_DELIVERY_ALIASES = {
  ref:           ['ref', 'reference', 'référence', 'sku', 'code', 'article', 'item'],
  supplier:      ['fournisseur', 'supplier', 'vendor', 'tiers', 'partenaire'],
  promisedDate:  ['date promise', 'date prévue', 'date prevue', 'date attendue', 'promised date', 'due date', 'date demandée', 'date confirmée'],
  deliveredDate: ['date livrée', 'date livree', 'date réelle', 'date reelle', 'actual date', 'delivered date', 'date livraison', 'date reception', 'date de réception'],
  orderedQty:    ['qté commandée', 'quantité commandée', 'quantite commandee', 'qte commandee', 'ordered qty', 'ordered', 'qty ordered'],
  deliveredQty:  ['qté livrée', 'quantité livrée', 'quantite livree', 'qte livree', 'delivered qty', 'delivered', 'qty delivered', 'qté reçue', 'quantité reçue'],
};

const AUDIT_CUSTOMER_DELIVERY_ALIASES = {
  ref:           ['ref', 'reference', 'référence', 'sku', 'code', 'article', 'item'],
  customer:      ['client', 'customer', 'destinataire', 'tiers'],
  promisedDate:  ['date promise', 'date prévue', 'date prevue', 'date attendue', 'date demandée', 'date confirmée', 'promised date', 'due date'],
  deliveredDate: ['date livrée', 'date livree', 'date réelle', 'date reelle', 'actual date', 'delivered date', 'date livraison'],
  orderedQty:    ['qté commandée', 'quantité commandée', 'qte commandee', 'ordered qty', 'ordered'],
  deliveredQty:  ['qté livrée', 'quantité livrée', 'qte livree', 'delivered qty', 'delivered'],
};

const AUDIT_OPEN_ORDERS_ALIASES = {
  ref:           ['ref', 'reference', 'référence', 'sku', 'code', 'article', 'item'],
  supplier:      ['fournisseur', 'supplier', 'vendor', 'tiers'],
  qty:           ['qté commandée', 'quantité commandée', 'quantite', 'qty', 'quantity', 'qté', 'qte', 'open qty'],
  expectedDate:  ['date prévue', 'date attendue', 'date expedition', 'date livraison prévue', 'expected date', 'eta', 'date arrivée'],
  unitPrice:     ['prix', 'prix unitaire', 'pu', 'unit price', 'price'],
};

const AUDIT_REFERENCE_ALIASES = {
  ref:           ['ref', 'reference', 'référence', 'sku', 'code', 'article', 'item', 'code article'],
  label:         ['libelle', 'libellé', 'nom', 'description', 'designation', 'name'],
  category:      ['categorie', 'catégorie', 'famille', 'groupe', 'category', 'family', 'classe', 'segment'],
  subCategory:   ['sous-categorie', 'sous-catégorie', 'sous-famille', 'subcategory', 'sub-family'],
  supplier:      ['fournisseur', 'fournisseur principal', 'supplier', 'main supplier', 'vendor'],
  leadTime:      ['lead time', 'délai', 'delai', 'lt théorique', 'lt theorique', 'délai théorique', 'delai theorique', 'lt'],
  moq:           ['moq', 'quantité minimum', 'quantite minimum', 'mini', 'qte mini'],
  purchasePrice: ['prix achat', 'prix d\'achat', 'cout achat', 'coût achat', 'purchase price'],
  status:        ['statut', 'status', 'actif', 'état', 'state'],
};


function generateAuditSalesTemplate() {
  const today = new Date();
  const rows = [];
  const articles = [
    { ref: 'A001', label: 'Yaourt nature 125g', basePrice: 0.85, baseVol: 800 },
    { ref: 'A002', label: 'Yaourt fruits 125g', basePrice: 0.95, baseVol: 600 },
    { ref: 'A003', label: 'Lait UHT demi-écrémé 1L', basePrice: 0.78, baseVol: 1200 },
    { ref: 'B001', label: 'Eau minérale 1.5L', basePrice: 0.42, baseVol: 2000 },
    { ref: 'B002', label: 'Soda cola 33cl', basePrice: 0.85, baseVol: 500 },
    { ref: 'C001', label: 'Pâtes spaghetti 500g', basePrice: 1.20, baseVol: 300 },
    { ref: 'C002', label: 'Riz long grain 1kg', basePrice: 1.85, baseVol: 250 },
    { ref: 'D001', label: 'Huile olive vierge 75cl', basePrice: 8.50, baseVol: 80 },
  ];
  const stores = ['Casa Centre', 'Rabat Agdal', 'Marrakech Gueliz'];
  for (let m = 11; m >= 0; m--) {
    const d = new Date(today.getFullYear(), today.getMonth() - m, 15);
    const dateStr = d.toISOString().slice(0, 10);
    for (const art of articles) {
      for (const store of stores) {
        const seasonal = 1 + 0.3 * Math.sin((m / 12) * Math.PI * 2);
        const qty = Math.max(0, Math.round(art.baseVol * seasonal * (0.85 + Math.random() * 0.3) / 12));
        if (qty === 0) continue;
        rows.push({
          'Référence': art.ref,
          'Libellé': art.label,
          'Date': dateStr,
          'Quantité vendue': qty,
          'Prix unitaire HT': art.basePrice,
          'Magasin': store,
        });
      }
    }
  }
  return rows;
}

function generateAuditStockTemplate() {
  const articles = [
    { ref: 'A001', label: 'Yaourt nature 125g', pmp: 0.55, qty: 1200 },
    { ref: 'A002', label: 'Yaourt fruits 125g', pmp: 0.62, qty: 800 },
    { ref: 'A003', label: 'Lait UHT demi-écrémé 1L', pmp: 0.50, qty: 1800 },
    { ref: 'B001', label: 'Eau minérale 1.5L', pmp: 0.25, qty: 3500 },
    { ref: 'B002', label: 'Soda cola 33cl', pmp: 0.52, qty: 600 },
    { ref: 'C001', label: 'Pâtes spaghetti 500g', pmp: 0.78, qty: 250 },
    { ref: 'C002', label: 'Riz long grain 1kg', pmp: 1.20, qty: 180 },
    { ref: 'D001', label: 'Huile olive vierge 75cl', pmp: 5.80, qty: 120 },
    { ref: 'X001', label: 'Article ancien obsolète', pmp: 12.40, qty: 350 },
    { ref: 'X002', label: 'Article saisonnier dormant', pmp: 8.90, qty: 180 },
  ];
  const stores = ['Casa Centre', 'Rabat Agdal', 'Marrakech Gueliz'];
  const rows = [];
  for (const art of articles) {
    for (const store of stores) {
      const variation = 0.7 + Math.random() * 0.6;
      rows.push({
        'Référence': art.ref,
        'Libellé': art.label,
        'Quantité en stock': Math.round(art.qty * variation / 3),
        'Prix moyen pondéré': art.pmp,
        'Magasin': store,
      });
    }
  }
  return rows;
}


// ============================================================
// Templates audit COMPLET (4 fichiers complémentaires)
// ============================================================

function generateSupplierDeliveryTemplate() {
  const baseDate = new Date();
  baseDate.setMonth(baseDate.getMonth() - 3);
  const day = (n) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  return [
    { 'Référence': 'A001', 'Fournisseur': 'ALPHA INDUSTRIES', 'Date promise': day(0), 'Date livrée': day(0), 'Qté commandée': 1000, 'Qté livrée': 1000 },
    { 'Référence': 'A002', 'Fournisseur': 'ALPHA INDUSTRIES', 'Date promise': day(2), 'Date livrée': day(5), 'Qté commandée': 500, 'Qté livrée': 500 },
    { 'Référence': 'B001', 'Fournisseur': 'BETA LOGISTICS', 'Date promise': day(5), 'Date livrée': day(5), 'Qté commandée': 2000, 'Qté livrée': 1800 },
    { 'Référence': 'C001', 'Fournisseur': 'BETA LOGISTICS', 'Date promise': day(7), 'Date livrée': day(12), 'Qté commandée': 300, 'Qté livrée': 250 },
    { 'Référence': 'B002', 'Fournisseur': 'GAMMA SUPPLY', 'Date promise': day(10), 'Date livrée': day(10), 'Qté commandée': 500, 'Qté livrée': 500 },
    { 'Référence': 'A001', 'Fournisseur': 'GAMMA SUPPLY', 'Date promise': day(12), 'Date livrée': day(13), 'Qté commandée': 800, 'Qté livrée': 800 },
    { 'Référence': 'C002', 'Fournisseur': 'ALPHA INDUSTRIES', 'Date promise': day(15), 'Date livrée': day(15), 'Qté commandée': 200, 'Qté livrée': 195 },
    { 'Référence': 'D001', 'Fournisseur': 'BETA LOGISTICS', 'Date promise': day(18), 'Date livrée': day(25), 'Qté commandée': 100, 'Qté livrée': 80 },
    { 'Référence': 'A003', 'Fournisseur': 'GAMMA SUPPLY', 'Date promise': day(20), 'Date livrée': day(20), 'Qté commandée': 1500, 'Qté livrée': 1500 },
    { 'Référence': 'B001', 'Fournisseur': 'ALPHA INDUSTRIES', 'Date promise': day(25), 'Date livrée': day(28), 'Qté commandée': 2000, 'Qté livrée': 2000 },
  ];
}

function generateCustomerDeliveryTemplate() {
  const baseDate = new Date();
  baseDate.setMonth(baseDate.getMonth() - 3);
  const day = (n) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  return [
    { 'Référence': 'A001', 'Client': 'CLIENT NORD SARL', 'Date promise': day(0), 'Date livrée': day(0), 'Qté commandée': 100, 'Qté livrée': 100 },
    { 'Référence': 'A002', 'Client': 'CLIENT NORD SARL', 'Date promise': day(2), 'Date livrée': day(2), 'Qté commandée': 50, 'Qté livrée': 50 },
    { 'Référence': 'B001', 'Client': 'HYPER CASA', 'Date promise': day(5), 'Date livrée': day(7), 'Qté commandée': 200, 'Qté livrée': 200 },
    { 'Référence': 'A001', 'Client': 'HYPER CASA', 'Date promise': day(8), 'Date livrée': day(8), 'Qté commandée': 300, 'Qté livrée': 280 },
    { 'Référence': 'C001', 'Client': 'EPICERIE RABAT', 'Date promise': day(10), 'Date livrée': day(13), 'Qté commandée': 30, 'Qté livrée': 30 },
    { 'Référence': 'D001', 'Client': 'HYPER CASA', 'Date promise': day(15), 'Date livrée': day(15), 'Qté commandée': 20, 'Qté livrée': 20 },
    { 'Référence': 'B002', 'Client': 'CLIENT NORD SARL', 'Date promise': day(18), 'Date livrée': day(22), 'Qté commandée': 80, 'Qté livrée': 75 },
    { 'Référence': 'A003', 'Client': 'EPICERIE RABAT', 'Date promise': day(20), 'Date livrée': day(20), 'Qté commandée': 60, 'Qté livrée': 60 },
  ];
}

function generateOpenOrdersTemplate() {
  const futureDate = new Date();
  const day = (n) => {
    const d = new Date(futureDate);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  return [
    { 'Référence': 'A001', 'Fournisseur': 'ALPHA INDUSTRIES', 'Qté commandée': 1500, 'Date prévue': day(7), 'Prix unitaire': 0.55 },
    { 'Référence': 'A002', 'Fournisseur': 'ALPHA INDUSTRIES', 'Qté commandée': 800, 'Date prévue': day(10), 'Prix unitaire': 0.62 },
    { 'Référence': 'B001', 'Fournisseur': 'BETA LOGISTICS', 'Qté commandée': 3000, 'Date prévue': day(15), 'Prix unitaire': 0.25 },
    { 'Référence': 'C001', 'Fournisseur': 'BETA LOGISTICS', 'Qté commandée': 500, 'Date prévue': day(21), 'Prix unitaire': 0.78 },
    { 'Référence': 'D001', 'Fournisseur': 'GAMMA SUPPLY', 'Qté commandée': 200, 'Date prévue': day(30), 'Prix unitaire': 5.80 },
  ];
}

function generateReferenceTemplate() {
  return [
    { 'Référence': 'A001', 'Libellé': 'Yaourt nature 125g', 'Catégorie': 'Frais', 'Sous-catégorie': 'Yaourts', 'Fournisseur principal': 'ALPHA INDUSTRIES', 'Lead time théorique': 5, 'MOQ': 500, 'Prix achat': 0.55, 'Statut': 'Actif' },
    { 'Référence': 'A002', 'Libellé': 'Yaourt fruits 125g', 'Catégorie': 'Frais', 'Sous-catégorie': 'Yaourts', 'Fournisseur principal': 'ALPHA INDUSTRIES', 'Lead time théorique': 5, 'MOQ': 500, 'Prix achat': 0.62, 'Statut': 'Actif' },
    { 'Référence': 'A003', 'Libellé': 'Lait UHT demi-écrémé 1L', 'Catégorie': 'Frais', 'Sous-catégorie': 'Laits', 'Fournisseur principal': 'GAMMA SUPPLY', 'Lead time théorique': 7, 'MOQ': 1000, 'Prix achat': 0.50, 'Statut': 'Actif' },
    { 'Référence': 'B001', 'Libellé': 'Eau minérale 1.5L', 'Catégorie': 'Boissons', 'Sous-catégorie': 'Eaux', 'Fournisseur principal': 'BETA LOGISTICS', 'Lead time théorique': 10, 'MOQ': 2000, 'Prix achat': 0.25, 'Statut': 'Actif' },
    { 'Référence': 'B002', 'Libellé': 'Soda cola 33cl', 'Catégorie': 'Boissons', 'Sous-catégorie': 'Sodas', 'Fournisseur principal': 'GAMMA SUPPLY', 'Lead time théorique': 14, 'MOQ': 500, 'Prix achat': 0.52, 'Statut': 'Actif' },
    { 'Référence': 'C001', 'Libellé': 'Pâtes spaghetti 500g', 'Catégorie': 'Épicerie', 'Sous-catégorie': 'Pâtes', 'Fournisseur principal': 'BETA LOGISTICS', 'Lead time théorique': 21, 'MOQ': 200, 'Prix achat': 0.78, 'Statut': 'Actif' },
    { 'Référence': 'C002', 'Libellé': 'Riz long grain 1kg', 'Catégorie': 'Épicerie', 'Sous-catégorie': 'Riz', 'Fournisseur principal': 'ALPHA INDUSTRIES', 'Lead time théorique': 28, 'MOQ': 100, 'Prix achat': 1.20, 'Statut': 'Actif' },
    { 'Référence': 'D001', 'Libellé': 'Huile olive vierge 75cl', 'Catégorie': 'Épicerie', 'Sous-catégorie': 'Huiles', 'Fournisseur principal': 'GAMMA SUPPLY', 'Lead time théorique': 15, 'MOQ': 50, 'Prix achat': 5.80, 'Statut': 'Actif' },
    { 'Référence': 'X001', 'Libellé': 'Article ancien obsolète', 'Catégorie': 'Épicerie', 'Sous-catégorie': 'Divers', 'Fournisseur principal': 'BETA LOGISTICS', 'Lead time théorique': 30, 'MOQ': 100, 'Prix achat': 12.40, 'Statut': 'Inactif' },
    { 'Référence': 'X002', 'Libellé': 'Article saisonnier dormant', 'Catégorie': 'Saisonnier', 'Sous-catégorie': 'Hiver', 'Fournisseur principal': 'ALPHA INDUSTRIES', 'Lead time théorique': 21, 'MOQ': 50, 'Prix achat': 8.90, 'Statut': 'Actif' },
  ];
}

// ============================================================
// Calculs des modules complets
// ============================================================

function computeSupplierPerf(rows, periodDays) {
  const deliveries = rows.map(r => {
    const promised = parseDate(findField(r, AUDIT_SUPPLIER_DELIVERY_ALIASES.promisedDate));
    const delivered = parseDate(findField(r, AUDIT_SUPPLIER_DELIVERY_ALIASES.deliveredDate));
    const orderedQty = parseFloat(findField(r, AUDIT_SUPPLIER_DELIVERY_ALIASES.orderedQty)) || 0;
    const deliveredQty = parseFloat(findField(r, AUDIT_SUPPLIER_DELIVERY_ALIASES.deliveredQty)) || 0;
    const ref = String(findField(r, AUDIT_SUPPLIER_DELIVERY_ALIASES.ref) || '').trim();
    const supplier = String(findField(r, AUDIT_SUPPLIER_DELIVERY_ALIASES.supplier) || 'Non renseigné').trim();
    if (!promised || !delivered || orderedQty <= 0) return null;
    const delayDays = Math.round((delivered - promised) / (1000 * 60 * 60 * 24));
    const fillRate = deliveredQty / orderedQty;
    const isOnTime = delayDays <= 0;
    const isInFull = fillRate >= 1.0;
    const isOtif = isOnTime && isInFull;
    return { ref, supplier, promised, delivered, orderedQty, deliveredQty, delayDays, fillRate, isOnTime, isInFull, isOtif };
  }).filter(Boolean);

  if (deliveries.length === 0) return null;
  const total = deliveries.length;
  const ot = deliveries.filter(d => d.isOnTime).length;
  const inFull = deliveries.filter(d => d.isInFull).length;
  const otif = deliveries.filter(d => d.isOtif).length;
  const delays = deliveries.filter(d => d.delayDays > 0).map(d => d.delayDays);
  const avgDelay = delays.length > 0 ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;

  // Par fournisseur
  const bySupplier = {};
  for (const d of deliveries) {
    if (!bySupplier[d.supplier]) bySupplier[d.supplier] = { supplier: d.supplier, total: 0, ot: 0, inFull: 0, otif: 0, totalDelay: 0 };
    const g = bySupplier[d.supplier];
    g.total++;
    if (d.isOnTime) g.ot++;
    if (d.isInFull) g.inFull++;
    if (d.isOtif) g.otif++;
    g.totalDelay += Math.max(0, d.delayDays);
  }
  const suppliers = Object.values(bySupplier).map(g => ({
    ...g,
    otRate: (g.ot / g.total) * 100,
    inFullRate: (g.inFull / g.total) * 100,
    otifRate: (g.otif / g.total) * 100,
    avgDelay: g.total > 0 ? g.totalDelay / g.total : 0,
  })).sort((a, b) => a.otifRate - b.otifRate);

  return {
    total, otRate: (ot / total) * 100, inFullRate: (inFull / total) * 100, otifRate: (otif / total) * 100,
    avgDelay, suppliers, deliveries,
  };
}

function computeCustomerPerf(rows) {
  const deliveries = rows.map(r => {
    const promised = parseDate(findField(r, AUDIT_CUSTOMER_DELIVERY_ALIASES.promisedDate));
    const delivered = parseDate(findField(r, AUDIT_CUSTOMER_DELIVERY_ALIASES.deliveredDate));
    const orderedQty = parseFloat(findField(r, AUDIT_CUSTOMER_DELIVERY_ALIASES.orderedQty)) || 0;
    const deliveredQty = parseFloat(findField(r, AUDIT_CUSTOMER_DELIVERY_ALIASES.deliveredQty)) || 0;
    const ref = String(findField(r, AUDIT_CUSTOMER_DELIVERY_ALIASES.ref) || '').trim();
    const customer = String(findField(r, AUDIT_CUSTOMER_DELIVERY_ALIASES.customer) || 'Non renseigné').trim();
    if (!promised || !delivered || orderedQty <= 0) return null;
    const delayDays = Math.round((delivered - promised) / (1000 * 60 * 60 * 24));
    const fillRate = deliveredQty / orderedQty;
    return {
      ref, customer, promised, delivered, orderedQty, deliveredQty, delayDays, fillRate,
      isOnTime: delayDays <= 0, isInFull: fillRate >= 1.0,
      isOtif: delayDays <= 0 && fillRate >= 1.0,
    };
  }).filter(Boolean);

  if (deliveries.length === 0) return null;
  const total = deliveries.length;
  const ot = deliveries.filter(d => d.isOnTime).length;
  const inFull = deliveries.filter(d => d.isInFull).length;
  const otif = deliveries.filter(d => d.isOtif).length;

  // Par client
  const byCustomer = {};
  for (const d of deliveries) {
    if (!byCustomer[d.customer]) byCustomer[d.customer] = { customer: d.customer, total: 0, otif: 0, ot: 0, inFull: 0 };
    const g = byCustomer[d.customer];
    g.total++;
    if (d.isOtif) g.otif++;
    if (d.isOnTime) g.ot++;
    if (d.isInFull) g.inFull++;
  }
  const customers = Object.values(byCustomer).map(g => ({
    ...g,
    otifRate: (g.otif / g.total) * 100,
    otRate: (g.ot / g.total) * 100,
    inFullRate: (g.inFull / g.total) * 100,
  })).sort((a, b) => a.otifRate - b.otifRate);

  return { total, otRate: (ot / total) * 100, inFullRate: (inFull / total) * 100, otifRate: (otif / total) * 100, customers };
}

function computeFutureCoverage(rows, stockByRef, byRef, periodDays) {
  const orders = rows.map(r => {
    const ref = String(findField(r, AUDIT_OPEN_ORDERS_ALIASES.ref) || '').trim();
    const supplier = String(findField(r, AUDIT_OPEN_ORDERS_ALIASES.supplier) || '').trim();
    const qty = parseFloat(findField(r, AUDIT_OPEN_ORDERS_ALIASES.qty)) || 0;
    const expectedDate = parseDate(findField(r, AUDIT_OPEN_ORDERS_ALIASES.expectedDate));
    const unitPrice = parseFloat(findField(r, AUDIT_OPEN_ORDERS_ALIASES.unitPrice)) || 0;
    if (!ref || qty <= 0) return null;
    return { ref, supplier, qty, expectedDate, unitPrice };
  }).filter(Boolean);

  if (orders.length === 0) return null;

  // Agréger par ref
  const ordersByRef = {};
  for (const o of orders) {
    if (!ordersByRef[o.ref]) ordersByRef[o.ref] = { ref: o.ref, qty: 0, value: 0, nextDate: null };
    ordersByRef[o.ref].qty += o.qty;
    ordersByRef[o.ref].value += o.qty * o.unitPrice;
    if (o.expectedDate && (!ordersByRef[o.ref].nextDate || o.expectedDate < ordersByRef[o.ref].nextDate)) {
      ordersByRef[o.ref].nextDate = o.expectedDate;
    }
  }

  // Calcul couverture future + risques
  const today = new Date();
  const futureAnalysis = Object.values(stockByRef).map(s => {
    const sales = byRef[s.ref];
    const adu = sales ? sales.totalQty / periodDays : 0;
    const openQty = ordersByRef[s.ref] ? ordersByRef[s.ref].qty : 0;
    const totalAvailable = s.qty + openQty;
    const coverageDays = adu > 0 ? totalAvailable / adu : Infinity;
    const currentCoverage = adu > 0 ? s.qty / adu : Infinity;
    const nextArrival = ordersByRef[s.ref] ? ordersByRef[s.ref].nextDate : null;
    const daysUntilArrival = nextArrival ? Math.round((nextArrival - today) / (1000 * 60 * 60 * 24)) : null;
    return { ref: s.ref, label: s.label, stockQty: s.qty, openQty, totalAvailable, adu, currentCoverage, coverageDays, nextArrival, daysUntilArrival };
  });

  // Risques imminents : couverture actuelle < délai d'arrivée
  const riskRuptures = futureAnalysis
    .filter(a => a.adu > 0 && a.openQty > 0 && a.daysUntilArrival !== null && a.currentCoverage < a.daysUntilArrival)
    .sort((a, b) => (b.daysUntilArrival - b.currentCoverage) - (a.daysUntilArrival - a.currentCoverage));

  // Sur-commandes potentielles : couverture totale > 12 mois
  const overOrdering = futureAnalysis
    .filter(a => a.adu > 0 && a.coverageDays > 365)
    .sort((a, b) => b.coverageDays - a.coverageDays);

  // Articles SANS commande mais stock faible
  const understockedNoOrder = futureAnalysis
    .filter(a => a.adu > 0 && a.openQty === 0 && a.currentCoverage < 30)
    .sort((a, b) => a.currentCoverage - b.currentCoverage);

  // Concentration achats
  const totalOpenValue = orders.reduce((s, o) => s + o.qty * o.unitPrice, 0);
  const totalOpenQty = orders.reduce((s, o) => s + o.qty, 0);

  return {
    nOrders: orders.length,
    nRefsOrdered: Object.keys(ordersByRef).length,
    totalOpenValue, totalOpenQty,
    riskRuptures, overOrdering, understockedNoOrder, ordersByRef,
  };
}

function computeCategoryAnalysis(rows, byRef, stockByRef, supplierPerf, totalCA) {
  const refData = {};
  for (const r of rows) {
    const ref = String(findField(r, AUDIT_REFERENCE_ALIASES.ref) || '').trim();
    if (!ref) continue;
    refData[ref] = {
      ref,
      label: String(findField(r, AUDIT_REFERENCE_ALIASES.label) || '').trim(),
      category: String(findField(r, AUDIT_REFERENCE_ALIASES.category) || 'Non classé').trim(),
      subCategory: String(findField(r, AUDIT_REFERENCE_ALIASES.subCategory) || '').trim(),
      supplier: String(findField(r, AUDIT_REFERENCE_ALIASES.supplier) || '').trim(),
      leadTime: parseFloat(findField(r, AUDIT_REFERENCE_ALIASES.leadTime)) || null,
      moq: parseFloat(findField(r, AUDIT_REFERENCE_ALIASES.moq)) || null,
      purchasePrice: parseFloat(findField(r, AUDIT_REFERENCE_ALIASES.purchasePrice)) || null,
      status: String(findField(r, AUDIT_REFERENCE_ALIASES.status) || 'Actif').trim().toLowerCase(),
    };
  }

  // Analyse par catégorie
  const byCategory = {};
  for (const ref of Object.keys(refData)) {
    const cat = refData[ref].category;
    if (!byCategory[cat]) byCategory[cat] = { category: cat, nArticles: 0, totalCA: 0, stockValue: 0, dormantValue: 0 };
    const g = byCategory[cat];
    g.nArticles++;
    if (byRef[ref]) g.totalCA += byRef[ref].totalAmount;
    if (stockByRef[ref]) g.stockValue += stockByRef[ref].value;
  }
  const categories = Object.values(byCategory).map(g => ({
    ...g,
    caShare: totalCA > 0 ? (g.totalCA / totalCA) * 100 : 0,
  })).sort((a, b) => b.totalCA - a.totalCA);

  // Monosourçage
  const supplierCounts = {};
  for (const ref of Object.keys(refData)) {
    const sup = refData[ref].supplier;
    if (!sup) continue;
    supplierCounts[sup] = (supplierCounts[sup] || 0) + 1;
  }
  const totalRefs = Object.keys(refData).length;
  const refsWithSupplier = Object.keys(refData).filter(r => refData[r].supplier).length;
  const refsWithoutCategory = Object.keys(refData).filter(r => refData[r].category === 'Non classé').length;

  // Articles inactifs en stock
  const inactiveInStock = Object.keys(refData)
    .filter(r => (refData[r].status === 'inactif' || refData[r].status === 'arrêté' || refData[r].status === 'obsolete') && stockByRef[r] && stockByRef[r].qty > 0)
    .map(r => ({ ...refData[r], stockQty: stockByRef[r].qty, stockValue: stockByRef[r].value }))
    .sort((a, b) => b.stockValue - a.stockValue);

  // Comparaison lead time théorique vs réel (si supplierPerf dispo)
  let ltComparison = null;
  if (supplierPerf && supplierPerf.deliveries) {
    const ltByRef = {};
    for (const d of supplierPerf.deliveries) {
      // Pour comparer, il faudrait l'écart entre commande et livraison; ici on utilise le retard
      // En pratique : si on a la promise date et la delivered date, et la promise = order + LT théorique,
      // alors retard = LT réel - LT théorique
      if (!ltByRef[d.ref]) ltByRef[d.ref] = { ref: d.ref, totalDelay: 0, count: 0 };
      ltByRef[d.ref].totalDelay += d.delayDays;
      ltByRef[d.ref].count++;
    }
    ltComparison = Object.values(ltByRef).map(r => {
      const avgRealDelay = r.totalDelay / r.count;
      const theoretical = refData[r.ref] ? refData[r.ref].leadTime : null;
      return {
        ref: r.ref,
        label: refData[r.ref] ? refData[r.ref].label : '',
        theoretical,
        avgRealDelay,
        diff: avgRealDelay, // positif = retard
      };
    }).filter(r => r.theoretical !== null && Math.abs(r.avgRealDelay) > 1)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 10);
  }

  return {
    nRefs: totalRefs,
    refData,
    categories,
    refsWithSupplier,
    refsWithoutCategory,
    monoSourceRefs: refsWithSupplier, // tous les refs avec 1 seul fournisseur principal
    inactiveInStock,
    ltComparison,
  };
}

function runAudit(salesRows, stockRows, supplierDeliveriesRows, customerDeliveriesRows, openOrdersRows, referenceRows, currency) {
  const cur = (currency && currency.trim()) || 'MAD';
  const fm = (n) => formatMoney(n, cur);
  const sales = salesRows.map(r => ({
    ref: String(findField(r, AUDIT_SALES_ALIASES.ref) || '').trim(),
    label: String(findField(r, AUDIT_SALES_ALIASES.label) || '').trim(),
    date: parseDate(findField(r, AUDIT_SALES_ALIASES.date)),
    qty: parseFloat(findField(r, AUDIT_SALES_ALIASES.qty)) || 0,
    amount: parseFloat(findField(r, AUDIT_SALES_ALIASES.amount)) || 0,
    unitPrice: parseFloat(findField(r, AUDIT_SALES_ALIASES.unitPrice)) || 0,
    store: String(findField(r, AUDIT_SALES_ALIASES.store) || '').trim(),
  })).filter(s => s.ref && s.date && s.qty > 0);

  sales.forEach(s => {
    if (s.amount === 0 && s.unitPrice > 0) s.amount = s.unitPrice * s.qty;
  });

  const stock = stockRows.map(r => {
    const pmp = parseFloat(findField(r, AUDIT_STOCK_ALIASES.pmp)) || 0;
    const qty = parseFloat(findField(r, AUDIT_STOCK_ALIASES.qty)) || 0;
    const value = parseFloat(findField(r, AUDIT_STOCK_ALIASES.value)) || (pmp * qty);
    return {
      ref: String(findField(r, AUDIT_STOCK_ALIASES.ref) || '').trim(),
      label: String(findField(r, AUDIT_STOCK_ALIASES.label) || '').trim(),
      qty, pmp, value,
      store: String(findField(r, AUDIT_STOCK_ALIASES.store) || '').trim(),
      category: String(findField(r, AUDIT_STOCK_ALIASES.category) || '').trim(),
    };
  }).filter(s => s.ref);

  const salesStores = [...new Set(sales.map(s => s.store).filter(Boolean))];
  const stockStores = [...new Set(stock.map(s => s.store).filter(Boolean))];
  const allStores = [...new Set([...salesStores, ...stockStores])];
  const isMultiStore = allStores.length > 1;

  const uniqueRefs = new Set([...sales.map(s => s.ref), ...stock.map(s => s.ref)]);
  const nArticles = uniqueRefs.size;
  let profile;
  if (isMultiStore || nArticles > 50) profile = 'distribution';
  else if (nArticles < 30) profile = 'industrie';
  else profile = 'mixte';

  const dates = sales.map(s => s.date).sort((a, b) => a - b);
  const periodStart = dates[0];
  const periodEnd = dates[dates.length - 1];
  const periodDays = Math.max(1, Math.round((periodEnd - periodStart) / (1000 * 60 * 60 * 24)));
  const periodMonths = Math.max(1, periodDays / 30);

  const byRef = {};
  for (const s of sales) {
    if (!byRef[s.ref]) byRef[s.ref] = {
      ref: s.ref, label: s.label,
      totalQty: 0, totalAmount: 0,
      monthlyQty: {}, lastDate: null,
      byStore: {},
    };
    const a = byRef[s.ref];
    a.totalQty += s.qty;
    a.totalAmount += s.amount;
    a.label = a.label || s.label;
    if (!a.lastDate || s.date > a.lastDate) a.lastDate = s.date;
    const ym = s.date.toISOString().slice(0, 7);
    a.monthlyQty[ym] = (a.monthlyQty[ym] || 0) + s.qty;
    if (s.store) {
      if (!a.byStore[s.store]) a.byStore[s.store] = { qty: 0, amount: 0 };
      a.byStore[s.store].qty += s.qty;
      a.byStore[s.store].amount += s.amount;
    }
  }

  const stockByRef = {};
  for (const s of stock) {
    if (!stockByRef[s.ref]) stockByRef[s.ref] = {
      ref: s.ref, label: s.label,
      qty: 0, value: 0, pmp: s.pmp,
    };
    stockByRef[s.ref].qty += s.qty;
    stockByRef[s.ref].value += s.value;
    stockByRef[s.ref].label = stockByRef[s.ref].label || s.label;
  }

  const refs = Object.values(byRef);
  const totalCA = refs.reduce((sum, r) => sum + r.totalAmount, 0);
  const totalQty = refs.reduce((sum, r) => sum + r.totalQty, 0);
  const hasMonetary = totalCA > 0;
  const sortedByValue = [...refs].sort((a, b) => (hasMonetary ? b.totalAmount - a.totalAmount : b.totalQty - a.totalQty));
  let cumul = 0;
  const totalForAbc = hasMonetary ? totalCA : totalQty;
  sortedByValue.forEach(r => {
    cumul += hasMonetary ? r.totalAmount : r.totalQty;
    const pct = totalForAbc > 0 ? cumul / totalForAbc : 0;
    r.cumulPct = pct;
    r.abc = pct <= 0.80 ? 'A' : pct <= 0.95 ? 'B' : 'C';
  });

  for (const r of sortedByValue) {
    const monthlyValues = Object.values(r.monthlyQty);
    if (monthlyValues.length < 2) { r.xyz = 'Z'; r.cv = null; continue; }
    const mean = monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length;
    if (mean === 0) { r.xyz = 'Z'; r.cv = null; continue; }
    const variance = monthlyValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / monthlyValues.length;
    const cv = Math.sqrt(variance) / mean;
    r.cv = cv;
    r.xyz = cv < 0.5 ? 'X' : cv < 1.0 ? 'Y' : 'Z';
  }

  const matrix = {};
  for (const a of ['A', 'B', 'C']) {
    for (const x of ['X', 'Y', 'Z']) {
      matrix[a + x] = { count: 0, valueShare: 0, refs: [] };
    }
  }
  for (const r of sortedByValue) {
    const key = r.abc + r.xyz;
    matrix[key].count++;
    matrix[key].valueShare += hasMonetary ? r.totalAmount : r.totalQty;
    matrix[key].refs.push(r.ref);
  }
  for (const key in matrix) {
    matrix[key].valueSharePct = totalForAbc > 0 ? (matrix[key].valueShare / totalForAbc) * 100 : 0;
  }

  const dormantThresholdMonths = 6;
  const cutoffDate = new Date(periodEnd);
  cutoffDate.setMonth(cutoffDate.getMonth() - dormantThresholdMonths);
  const dormants = Object.values(stockByRef)
    .map(s => {
      const salesData = byRef[s.ref];
      const lastSale = salesData ? salesData.lastDate : null;
      const isDormant = !lastSale || lastSale < cutoffDate;
      const daysSinceSale = lastSale ? Math.round((periodEnd - lastSale) / (1000 * 60 * 60 * 24)) : null;
      return { ...s, lastSale, isDormant, daysSinceSale };
    })
    .filter(s => s.isDormant && s.qty > 0)
    .sort((a, b) => b.value - a.value);

  const coverages = Object.values(stockByRef).map(s => {
    const salesData = byRef[s.ref];
    const adu = salesData ? salesData.totalQty / periodDays : 0;
    const coverageDays = adu > 0 ? s.qty / adu : Infinity;
    return { ref: s.ref, label: s.label, stockQty: s.qty, stockValue: s.value, adu, coverageDays };
  });
  const overstocked = coverages.filter(c => c.coverageDays !== Infinity && c.coverageDays > 180).sort((a, b) => b.stockValue - a.stockValue);
  const understocked = coverages.filter(c => c.coverageDays < 14 && c.adu > 0).sort((a, b) => a.coverageDays - b.coverageDays);

  const storeStats = {};
  if (isMultiStore) {
    for (const store of allStores) {
      const storeSales = sales.filter(s => s.store === store);
      const storeStock = stock.filter(s => s.store === store);
      storeStats[store] = {
        store,
        totalCA: storeSales.reduce((sum, s) => sum + s.amount, 0),
        totalQty: storeSales.reduce((sum, s) => sum + s.qty, 0),
        stockValue: storeStock.reduce((sum, s) => sum + s.value, 0),
        stockQty: storeStock.reduce((sum, s) => sum + s.qty, 0),
        nArticles: new Set(storeStock.map(s => s.ref)).size,
      };
    }
  }

  let imbalances = [];
  if (isMultiStore) {
    const refsAcrossStores = {};
    for (const s of stock) {
      if (!s.store) continue;
      if (!refsAcrossStores[s.ref]) refsAcrossStores[s.ref] = [];
      refsAcrossStores[s.ref].push(s);
    }
    for (const ref in refsAcrossStores) {
      const stores = refsAcrossStores[ref];
      if (stores.length < 2) continue;
      const sorted = [...stores].sort((a, b) => b.qty - a.qty);
      const maxStore = sorted[0];
      const minStore = sorted[sorted.length - 1];
      const ratio = minStore.qty > 0 ? maxStore.qty / minStore.qty : Infinity;
      if (ratio > 5 && maxStore.qty > 50) {
        imbalances.push({
          ref,
          label: stockByRef[ref] ? stockByRef[ref].label : '',
          maxStore: maxStore.store, maxQty: maxStore.qty, maxValue: maxStore.value,
          minStore: minStore.store, minQty: minStore.qty,
          ratio,
        });
      }
    }
    imbalances.sort((a, b) => b.maxValue - a.maxValue);
  }

  const totalStockValue = stock.reduce((sum, s) => sum + s.value, 0);
  const totalStockQty = stock.reduce((sum, s) => sum + s.qty, 0);
  const dormantValue = dormants.reduce((sum, d) => sum + d.value, 0);
  const dormantPct = totalStockValue > 0 ? (dormantValue / totalStockValue) * 100 : 0;
  const avgRotation = totalStockValue > 0 && totalCA > 0 ? (totalCA / periodMonths * 12) / totalStockValue : null;
  const avgCoverage = totalQty > 0 ? totalStockQty / (totalQty / periodDays) : null;

  // Saisonnalité 12 mois
  const monthlyMap = {};
  for (const s of sales) {
    const ym = s.date.toISOString().slice(0, 7);
    if (!monthlyMap[ym]) monthlyMap[ym] = { ym, qty: 0, amount: 0 };
    monthlyMap[ym].qty += s.qty;
    monthlyMap[ym].amount += s.amount;
  }
  const monthlyTrend = Object.values(monthlyMap).sort((a, b) => a.ym.localeCompare(b.ym));

  // Détection PMP : on a-t-il une vraie valorisation du stock ?
  const hasPmp = totalStockValue > 0;
  const avgPmp = hasPmp && totalStockQty > 0 ? totalStockValue / totalStockQty : null;

  // Répartition du stock : par valeur si PMP, sinon par quantité
  const overstockedValue = overstocked.reduce((sum, c) => sum + c.stockValue, 0);
  const overstockedQty = overstocked.reduce((sum, c) => sum + c.stockQty, 0);
  const dormantQty = dormants.reduce((sum, d) => sum + d.qty, 0);

  const stockBreakdown = hasPmp ? {
    dormant: dormantValue,
    overstocked: overstockedValue,
    healthy: Math.max(0, totalStockValue - dormantValue - overstockedValue),
    unit: 'value',
    total: totalStockValue,
  } : {
    dormant: dormantQty,
    overstocked: overstockedQty,
    healthy: Math.max(0, totalStockQty - dormantQty - overstockedQty),
    unit: 'qty',
    total: totalStockQty,
  };

  // Health Score 0-100 (synthèse de tous les signaux)
  let score = 100;
  if (dormantPct > 5) score -= Math.min(30, dormantPct);
  if (understocked.length > 0) score -= Math.min(15, understocked.length * 2);
  if (overstocked.length > 0) score -= Math.min(15, overstocked.length * 0.5);
  if (imbalances.length > 3) score -= Math.min(10, imbalances.length * 0.5);
  if (matrix.AZ.count > 2) score -= 5;
  if (avgRotation !== null && avgRotation < 2) score -= 10;
  if (matrix.CZ.count > nArticles * 0.3) score -= 5;
  const healthScore = Math.max(0, Math.min(100, Math.round(score)));

  const alerts = [];
  if (dormantPct > 15) alerts.push({
    level: 'critical',
    title: `${dormantPct.toFixed(0)} % du stock est dormant`,
    detail: `${dormants.length} articles immobilisent ${fm(dormantValue)} sans rotation depuis ${dormantThresholdMonths} mois ou plus.`,
  });
  else if (dormantPct > 5) alerts.push({
    level: 'warning',
    title: `${dormantPct.toFixed(0)} % du stock est dormant`,
    detail: `${fm(dormantValue)} immobilisés. Identifier les articles à déstocker ou retirer du référentiel.`,
  });
  if (understocked.length > 5) alerts.push({
    level: 'warning',
    title: `${understocked.length} articles en risque de rupture`,
    detail: 'Couverture inférieure à 14 jours sur des articles actifs — risque imminent sur la disponibilité.',
  });
  if (overstocked.length > 0) {
    const overValue = overstocked.reduce((s, c) => s + c.stockValue, 0);
    alerts.push({
      level: 'warning',
      title: `${overstocked.length} articles en surstock`,
      detail: `${fm(overValue)} immobilisés sur des couvertures supérieures à 6 mois.`,
    });
  }
  if (matrix.AZ.count > 0) alerts.push({
    level: 'info',
    title: `${matrix.AZ.count} article(s) classés "AZ" — fort enjeu de CA mais ventes erratiques`,
    detail: 'Articles à fort CA mais demande irrégulière. Stratégie de stock à adapter (sécurité élevée ou make-to-order).',
  });
  if (imbalances.length > 3) alerts.push({
    level: 'warning',
    title: `${imbalances.length} déséquilibres inter-magasins détectés`,
    detail: 'Articles très sur-stockés dans un magasin et faibles ailleurs — opportunités de transferts internes.',
  });
  if (!hasPmp && stock.length > 0) alerts.push({
    level: 'info',
    title: 'Prix moyen pondéré (PMP) non détecté dans votre fichier stock',
    detail: 'Les valorisations financières sont indisponibles. Ajoutez une colonne "Prix moyen pondéré" ou "Coût unitaire" pour chiffrer en euros le stock dormant, immobilisé et la rotation. L\'analyse reste valide en quantités.',
  });

  // ============================================================
  // MODULES AUDIT COMPLET (si fichiers complémentaires fournis)
  // ============================================================
  let supplierPerf = null;
  if (supplierDeliveriesRows && supplierDeliveriesRows.length > 0) {
    supplierPerf = computeSupplierPerf(supplierDeliveriesRows, periodDays);
    if (supplierPerf && supplierPerf.otifRate < 80) alerts.push({
      level: supplierPerf.otifRate < 60 ? 'critical' : 'warning',
      title: `OTIF achat à ${supplierPerf.otifRate.toFixed(0)} % seulement`,
      detail: `Vos fournisseurs livrent à temps et complet dans ${supplierPerf.otifRate.toFixed(0)} % des cas. Retard moyen quand en retard : ${supplierPerf.avgDelay.toFixed(1)} jours. À traiter par fournisseur.`,
    });
  }

  let customerPerf = null;
  if (customerDeliveriesRows && customerDeliveriesRows.length > 0) {
    customerPerf = computeCustomerPerf(customerDeliveriesRows);
    if (customerPerf && customerPerf.otifRate < 90) alerts.push({
      level: customerPerf.otifRate < 80 ? 'critical' : 'warning',
      title: `OTIF service client à ${customerPerf.otifRate.toFixed(0)} %`,
      detail: `${(100 - customerPerf.otifRate).toFixed(0)} % de vos livraisons clients ont un défaut (retard, manquant ou les deux). Impact direct sur la satisfaction.`,
    });
  }

  let futureCoverage = null;
  if (openOrdersRows && openOrdersRows.length > 0) {
    futureCoverage = computeFutureCoverage(openOrdersRows, stockByRef, byRef, periodDays);
    if (futureCoverage && futureCoverage.riskRuptures.length > 0) alerts.push({
      level: 'critical',
      title: `${futureCoverage.riskRuptures.length} risque(s) de rupture imminente malgré commandes en cours`,
      detail: 'Vos commandes ouvertes arriveront APRÈS que votre stock actuel soit épuisé. Accélérer les livraisons concernées.',
    });
    if (futureCoverage && futureCoverage.understockedNoOrder.length > 5) alerts.push({
      level: 'warning',
      title: `${futureCoverage.understockedNoOrder.length} article(s) en couverture courte SANS commande en cours`,
      detail: 'Ces articles ont moins de 30 jours de stock et aucune commande fournisseur n\'est en cours. À approvisionner d\'urgence.',
    });
  }

  let categoryAnalysis = null;
  if (referenceRows && referenceRows.length > 0) {
    categoryAnalysis = computeCategoryAnalysis(referenceRows, byRef, stockByRef, supplierPerf, totalCA);
    if (categoryAnalysis && categoryAnalysis.inactiveInStock.length > 0) {
      const inactiveValue = categoryAnalysis.inactiveInStock.reduce((s, a) => s + a.stockValue, 0);
      alerts.push({
        level: 'warning',
        title: `${categoryAnalysis.inactiveInStock.length} article(s) "inactifs" présents en stock`,
        detail: `${fm(inactiveValue)} immobilisés sur des références marquées comme arrêtées dans votre référentiel — candidats à la liquidation.`,
      });
    }
    if (categoryAnalysis && categoryAnalysis.refsWithoutCategory > nArticles * 0.2) {
      alerts.push({
        level: 'info',
        title: `${categoryAnalysis.refsWithoutCategory} article(s) sans catégorie — référentiel à nettoyer`,
        detail: 'Plus de 20 % de vos références ne sont pas catégorisées, ce qui dégrade les analyses par famille.',
      });
    }
  }

  // Niveau d'audit selon ce qui a été fourni
  const filesProvided = [supplierDeliveriesRows, customerDeliveriesRows, openOrdersRows, referenceRows].filter(x => x && x.length > 0).length;
  let level;
  if (filesProvided >= 4) level = 'complet';
  else if (filesProvided >= 2) level = 'standard';
  else if (filesProvided >= 1) level = 'express+';
  else level = 'express';

  return {
    profile, isMultiStore, allStores,
    nArticles, periodStart, periodEnd, periodDays, periodMonths,
    hasMonetary, hasPmp, avgPmp,
    totalCA, totalQty, totalStockValue, totalStockQty,
    dormantValue, dormantPct, avgRotation, avgCoverage,
    healthScore, stockBreakdown, monthlyTrend,
    refs: sortedByValue,
    matrix, dormants, overstocked, understocked,
    storeStats, imbalances, alerts,
    supplierPerf, customerPerf, futureCoverage, categoryAnalysis,
    level, filesProvided,
  };
}

function formatMoney(n, currency) {
  const cur = currency || 'MAD';
  if (!isFinite(n) || n === 0) return '—';
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(2) + ' M ' + cur;
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + ' k ' + cur;
  return Math.round(n).toLocaleString('fr-FR') + ' ' + cur;
}
function formatNum(n) {
  if (!isFinite(n)) return '—';
  return Math.round(n).toLocaleString('fr-FR');
}

function AuditFlash({ onBack }) {
  const [salesData, setSalesData] = useState(null);
  const [stockData, setStockData] = useState(null);
  const [salesFileName, setSalesFileName] = useState(null);
  const [stockFileName, setStockFileName] = useState(null);

  // Fichiers complémentaires (audit Complet)
  const [supplierData, setSupplierData] = useState(null);
  const [supplierFileName, setSupplierFileName] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [customerFileName, setCustomerFileName] = useState(null);
  const [openOrdersData, setOpenOrdersData] = useState(null);
  const [openOrdersFileName, setOpenOrdersFileName] = useState(null);
  const [referenceData, setReferenceData] = useState(null);
  const [referenceFileName, setReferenceFileName] = useState(null);

  const [companyName, setCompanyName] = useState('');
  const [currency, setCurrency] = useState('MAD');
  const [importMsg, setImportMsg] = useState(null);
  const [audit, setAudit] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const salesInputRef = useRef(null);
  const stockInputRef = useRef(null);
  const supplierInputRef = useRef(null);
  const customerInputRef = useRef(null);
  const openOrdersInputRef = useRef(null);
  const referenceInputRef = useRef(null);

  const runAuditNow = () => {
    if (!salesData || !stockData) return;
    setAnalyzing(true);
    setTimeout(() => {
      try {
        const result = runAudit(salesData, stockData, supplierData, customerData, openOrdersData, referenceData, currency);
        setAudit(result);
      } catch (e) {
        setImportMsg({ type: 'error', text: "Erreur d'analyse : " + e.message });
      } finally {
        setAnalyzing(false);
      }
    }, 100);
  };

  const handleImport = async (e, kind) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (json.length === 0) throw new Error('Fichier vide');
      if (kind === 'sales') { setSalesData(json); setSalesFileName(file.name); }
      else if (kind === 'stock') { setStockData(json); setStockFileName(file.name); }
      else if (kind === 'supplier') { setSupplierData(json); setSupplierFileName(file.name); }
      else if (kind === 'customer') { setCustomerData(json); setCustomerFileName(file.name); }
      else if (kind === 'openOrders') { setOpenOrdersData(json); setOpenOrdersFileName(file.name); }
      else if (kind === 'reference') { setReferenceData(json); setReferenceFileName(file.name); }

      // Feedback enrichi : signaler quelles colonnes ont été reconnues
      const firstRow = json[0];
      let aliasMap = null;
      if (kind === 'sales') aliasMap = { 'Référence': AUDIT_SALES_ALIASES.ref, 'Date': AUDIT_SALES_ALIASES.date, 'Quantité': AUDIT_SALES_ALIASES.qty, 'Prix ou Montant': [...AUDIT_SALES_ALIASES.unitPrice, ...AUDIT_SALES_ALIASES.amount], 'Magasin': AUDIT_SALES_ALIASES.store };
      else if (kind === 'stock') aliasMap = { 'Référence': AUDIT_STOCK_ALIASES.ref, 'Quantité': AUDIT_STOCK_ALIASES.qty, 'Prix moyen pondéré (PMP)': AUDIT_STOCK_ALIASES.pmp, 'Magasin': AUDIT_STOCK_ALIASES.store };

      if (aliasMap) {
        const recognized = [];
        const missing = [];
        for (const [label, aliases] of Object.entries(aliasMap)) {
          if (findField(firstRow, aliases) !== undefined) recognized.push(label);
          else missing.push(label);
        }
        const summary = `${json.length} ligne(s) · Colonnes reconnues : ${recognized.join(', ') || 'aucune'}`
          + (missing.length > 0 ? ` · Non détectées : ${missing.join(', ')}` : '');
        // Type : warning si une colonne importante manque, success sinon
        const hasWarning = missing.some(m => m === 'Prix moyen pondéré (PMP)' || m === 'Magasin' || m === 'Prix ou Montant');
        setImportMsg({ type: hasWarning ? 'warning' : 'success', text: summary });
      } else {
        setImportMsg({ type: 'success', text: `${json.length} ligne(s) importée(s) depuis « ${file.name} »` });
      }
      setTimeout(() => setImportMsg(null), 10000);
    } catch (err) {
      setImportMsg({ type: 'error', text: "Erreur d'import : " + err.message });
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const downloadTemplate = (kind) => {
    let data, sheetName, fileName;
    if (kind === 'sales') { data = generateAuditSalesTemplate(); sheetName = 'Ventes'; fileName = 'audit-template-ventes.xlsx'; }
    else if (kind === 'stock') { data = generateAuditStockTemplate(); sheetName = 'Stock'; fileName = 'audit-template-stock.xlsx'; }
    else if (kind === 'supplier') { data = generateSupplierDeliveryTemplate(); sheetName = 'Livraisons fournisseurs'; fileName = 'audit-template-livraisons-fournisseurs.xlsx'; }
    else if (kind === 'customer') { data = generateCustomerDeliveryTemplate(); sheetName = 'Livraisons clients'; fileName = 'audit-template-livraisons-clients.xlsx'; }
    else if (kind === 'openOrders') { data = generateOpenOrdersTemplate(); sheetName = 'Commandes ouvertes'; fileName = 'audit-template-commandes-ouvertes.xlsx'; }
    else if (kind === 'reference') { data = generateReferenceTemplate(); sheetName = 'Référentiel'; fileName = 'audit-template-referentiel.xlsx'; }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
  };

  const resetAudit = () => {
    setSalesData(null); setStockData(null);
    setSalesFileName(null); setStockFileName(null);
    setSupplierData(null); setSupplierFileName(null);
    setCustomerData(null); setCustomerFileName(null);
    setOpenOrdersData(null); setOpenOrdersFileName(null);
    setReferenceData(null); setReferenceFileName(null);
    setAudit(null); setImportMsg(null);
  };

  const AMBER = '#F59E0B';
  const AMBER_DARK = '#B45309';

  return (
    <div className="min-h-screen text-slate-900" style={{ background: '#F8FAFC', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <FontsAndStyles />

      <nav className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-5">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-jetbrains text-xs">
              <ArrowLeft size={14} />
              RETOUR
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-3">
              <Logo small />
              <div>
                <div className="font-bricolage font-semibold text-sm leading-tight text-slate-900">Audit Flash Supply Chain</div>
                <div className="font-jetbrains text-[10px] text-slate-500">DIAGNOSTIC EXPRESS · 2 fichiers · 30 secondes</div>
              </div>
            </div>
          </div>
          {audit && (
            <button onClick={resetAudit} className="font-jetbrains text-xs text-slate-500 hover:text-slate-900 transition-colors">
              ← Nouvel audit
            </button>
          )}
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-5">
        {!audit && (
          <>
            <div className="rounded-2xl p-8 md:p-10 text-white" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #B45309 100%)' }}>
              <div className="max-w-3xl">
                <div className="font-jetbrains text-[10px] tracking-wider mb-3" style={{ color: AMBER }}>
                  DIAGNOSTIC EXPRESS · GRATUIT · 100 % CONFIDENTIEL
                </div>
                <h1 className="font-bricolage font-bold text-3xl md:text-4xl mb-3 leading-tight">
                  Votre supply chain analysée en 30 secondes
                </h1>
                <p className="text-slate-300 leading-relaxed mb-5">
                  Importez votre historique de ventes 12 mois et l'état actuel de votre stock.
                  L'outil calcule automatiquement vos classifications ABC × XYZ, votre stock dormant chiffré en valeur,
                  vos couvertures critiques, et identifie les chantiers prioritaires pour votre fonction approvisionnement.
                </p>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400 font-jetbrains">
                  <div>✓ Aucune installation</div>
                  <div>✓ Aucun compte requis</div>
                  <div>✓ Données traitées en local</div>
                  <div>✓ Rapport PDF (à venir)</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-3">ÉTAPE 1 · IDENTITÉ</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-600 mb-1.5 block">Nom de votre société <span className="text-slate-400">(optionnel)</span></label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="ex. ACME Distribution Maroc"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md outline-none font-sans text-sm text-slate-800 focus:border-slate-400"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">Apparaîtra sur la couverture du rapport PDF</div>
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1.5 block">
                    Devise <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={currency}
                    onChange={e => setCurrency(e.target.value.toUpperCase().slice(0, 6))}
                    placeholder="MAD"
                    maxLength={6}
                    className="w-full px-3 py-2 bg-white border rounded-md outline-none font-jetbrains text-sm uppercase tracking-wider focus:border-slate-400"
                    style={{
                      borderColor: !currency.trim() ? '#FCA5A5' : '#E2E8F0',
                      color: '#0F172A',
                    }}
                  />
                  <div className="text-[10px] text-slate-400 mt-1">Saisie libre · ex. MAD, EUR, USD, GBP, XOF, CHF…</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border-2 bg-white p-5" style={{ borderColor: salesData ? '#86EFAC' : '#E2E8F0', background: salesData ? '#F0FDF4' : 'white' }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-jetbrains text-[10px] tracking-wider mb-1" style={{ color: AMBER_DARK }}>ÉTAPE 2A</div>
                    <div className="font-bricolage font-semibold text-base text-slate-900">Historique des ventes</div>
                    <div className="text-xs text-slate-500 mt-1">12 derniers mois · une ligne par vente</div>
                  </div>
                  {salesData && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#22C55E' }}>
                      <Check size={14} className="text-white" />
                    </div>
                  )}
                </div>
                {!salesData ? (
                  <>
                    <div className="text-xs text-slate-600 mb-3 leading-relaxed">
                      Colonnes attendues : <span className="font-jetbrains text-slate-800">Référence</span>,{' '}
                      <span className="font-jetbrains text-slate-800">Date</span>,{' '}
                      <span className="font-jetbrains text-slate-800">Quantité vendue</span>.
                      Optionnel : <span className="font-jetbrains text-slate-800">Prix HT</span> ou{' '}
                      <span className="font-jetbrains text-slate-800">Montant HT</span>,{' '}
                      <span className="font-jetbrains text-slate-800">Magasin</span>.
                    </div>
                    <div className="flex gap-2">
                      <input ref={salesInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={e => handleImport(e, 'sales')} className="hidden" />
                      <button onClick={() => salesInputRef.current && salesInputRef.current.click()} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md font-jetbrains text-xs font-semibold text-white shadow-sm" style={{ background: AMBER }}>
                        <Upload size={13} />
                        IMPORTER
                      </button>
                      <button onClick={() => downloadTemplate('sales')} className="flex items-center gap-1.5 px-3 py-2.5 rounded-md font-jetbrains text-xs text-slate-700 border border-slate-300 hover:bg-slate-50">
                        <FileDown size={13} />
                        TEMPLATE
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="font-jetbrains text-xs text-slate-700">{salesFileName}</div>
                    <div className="font-jetbrains text-[10px] text-emerald-700">{salesData.length} ligne(s) chargée(s)</div>
                    <button onClick={() => { setSalesData(null); setSalesFileName(null); }} className="font-jetbrains text-[10px] text-red-600 hover:underline">
                      Remplacer le fichier
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-xl border-2 bg-white p-5" style={{ borderColor: stockData ? '#86EFAC' : '#E2E8F0', background: stockData ? '#F0FDF4' : 'white' }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-jetbrains text-[10px] tracking-wider mb-1" style={{ color: AMBER_DARK }}>ÉTAPE 2B</div>
                    <div className="font-bricolage font-semibold text-base text-slate-900">État du stock actuel</div>
                    <div className="text-xs text-slate-500 mt-1">Photo à date d'aujourd'hui · une ligne par article × magasin</div>
                  </div>
                  {stockData && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#22C55E' }}>
                      <Check size={14} className="text-white" />
                    </div>
                  )}
                </div>
                {!stockData ? (
                  <>
                    <div className="text-xs text-slate-600 mb-3 leading-relaxed">
                      Colonnes attendues : <span className="font-jetbrains text-slate-800">Référence</span>,{' '}
                      <span className="font-jetbrains text-slate-800">Quantité stock</span>.
                      Optionnel : <span className="font-jetbrains text-slate-800">Prix moyen pondéré</span>,{' '}
                      <span className="font-jetbrains text-slate-800">Magasin</span>,{' '}
                      <span className="font-jetbrains text-slate-800">Catégorie</span>.
                    </div>
                    <div className="flex gap-2">
                      <input ref={stockInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={e => handleImport(e, 'stock')} className="hidden" />
                      <button onClick={() => stockInputRef.current && stockInputRef.current.click()} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md font-jetbrains text-xs font-semibold text-white shadow-sm" style={{ background: AMBER }}>
                        <Upload size={13} />
                        IMPORTER
                      </button>
                      <button onClick={() => downloadTemplate('stock')} className="flex items-center gap-1.5 px-3 py-2.5 rounded-md font-jetbrains text-xs text-slate-700 border border-slate-300 hover:bg-slate-50">
                        <FileDown size={13} />
                        TEMPLATE
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="font-jetbrains text-xs text-slate-700">{stockFileName}</div>
                    <div className="font-jetbrains text-[10px] text-emerald-700">{stockData.length} ligne(s) chargée(s)</div>
                    <button onClick={() => { setStockData(null); setStockFileName(null); }} className="font-jetbrains text-[10px] text-red-600 hover:underline">
                      Remplacer le fichier
                    </button>
                  </div>
                )}
              </div>
            </div>

            {importMsg && (
              <div className="rounded-lg p-3 font-jetbrains text-xs"
                style={
                  importMsg.type === 'success' ? { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }
                  : importMsg.type === 'warning' ? { background: '#FFFBEB', color: '#92400E', border: '1px solid #FCD34D' }
                  : { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }
                }>
                {importMsg.text}
              </div>
            )}

            {/* SECTION AUDIT COMPLET - fichiers complémentaires optionnels */}
            <div className="rounded-xl p-5" style={{ background: 'linear-gradient(to right, #FAFAFA, white)', border: '1px solid #E2E8F0' }}>
              <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
                <div>
                  <div className="font-jetbrains text-[10px] tracking-wider mb-1" style={{ color: AMBER_DARK }}>ÉTAPE 3 · AUDIT APPROFONDI (OPTIONNEL)</div>
                  <div className="font-bricolage font-semibold text-base text-slate-900">Étoffez votre diagnostic avec ces fichiers complémentaires</div>
                </div>
                <div className="font-jetbrains text-[10px] text-slate-500">
                  {[supplierData, customerData, openOrdersData, referenceData].filter(Boolean).length} / 4 fournis
                </div>
              </div>
              <div className="text-xs text-slate-500 mb-4">Chaque fichier déverrouille un module d'analyse supplémentaire. L'audit reste valide même sans ces données.</div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <OptionalFileCard
                  label="Livraisons fournisseurs"
                  description="OTIF achat · retards · top fournisseurs à risque"
                  data={supplierData}
                  fileName={supplierFileName}
                  inputRef={supplierInputRef}
                  onImport={e => handleImport(e, 'supplier')}
                  onTemplate={() => downloadTemplate('supplier')}
                  onClear={() => { setSupplierData(null); setSupplierFileName(null); }}
                />
                <OptionalFileCard
                  label="Livraisons clients"
                  description="OTIF service · taux de service par client"
                  data={customerData}
                  fileName={customerFileName}
                  inputRef={customerInputRef}
                  onImport={e => handleImport(e, 'customer')}
                  onTemplate={() => downloadTemplate('customer')}
                  onClear={() => { setCustomerData(null); setCustomerFileName(null); }}
                />
                <OptionalFileCard
                  label="Commandes ouvertes"
                  description="Couverture future · ruptures imminentes · sur-commandes"
                  data={openOrdersData}
                  fileName={openOrdersFileName}
                  inputRef={openOrdersInputRef}
                  onImport={e => handleImport(e, 'openOrders')}
                  onTemplate={() => downloadTemplate('openOrders')}
                  onClear={() => { setOpenOrdersData(null); setOpenOrdersFileName(null); }}
                />
                <OptionalFileCard
                  label="Référentiel articles"
                  description="Catégories · monosourçage · lead times théoriques"
                  data={referenceData}
                  fileName={referenceFileName}
                  inputRef={referenceInputRef}
                  onImport={e => handleImport(e, 'reference')}
                  onTemplate={() => downloadTemplate('reference')}
                  onClear={() => { setReferenceData(null); setReferenceFileName(null); }}
                />
              </div>
            </div>

            {/* BOUTON ANALYSER */}
            {(() => {
              const optionalCount = [supplierData, customerData, openOrdersData, referenceData].filter(Boolean).length;
              const totalFiles = (salesData ? 1 : 0) + (stockData ? 1 : 0) + optionalCount;
              const hasCurrency = currency && currency.trim().length > 0;
              const ready = salesData && stockData && hasCurrency;
              const levelLabel =
                optionalCount >= 4 ? 'AUDIT COMPLET' :
                optionalCount >= 2 ? 'AUDIT STANDARD' :
                optionalCount >= 1 ? 'AUDIT EXPRESS+' : 'AUDIT EXPRESS';
              return (
                <div className="rounded-xl p-5 text-center" style={{ background: ready ? 'linear-gradient(135deg, #0F172A 0%, #1E293B 70%, ' + AMBER_DARK + ' 100%)' : '#F1F5F9', border: ready ? 'none' : '1px solid #E2E8F0' }}>
                  {ready ? (
                    <>
                      <div className="font-jetbrains text-[10px] tracking-widest mb-2" style={{ color: AMBER }}>{totalFiles} / 6 FICHIERS · NIVEAU {levelLabel}</div>
                      <div className="font-bricolage text-white text-lg mb-4">
                        Prêt à analyser{optionalCount > 0 ? ' · ' + optionalCount + ' module(s) complémentaire(s) activé(s)' : ''}
                      </div>
                      <button
                        onClick={runAuditNow}
                        disabled={analyzing}
                        className="inline-flex items-center gap-3 px-8 py-4 rounded-lg font-jetbrains text-sm font-bold shadow-xl transition-all hover:translate-y-[-2px] hover:shadow-2xl disabled:opacity-60 disabled:cursor-wait"
                        style={{ background: AMBER, color: '#0F172A' }}
                      >
                        {analyzing ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            ANALYSE EN COURS…
                          </>
                        ) : (
                          <>
                            LANCER L'ANALYSE
                            <ArrowRight size={16} />
                          </>
                        )}
                      </button>
                      {optionalCount < 4 && (
                        <div className="text-[10px] text-slate-400 mt-3 font-jetbrains">
                          Astuce : ajoutez des fichiers complémentaires ci-dessus pour enrichir l'analyse avant de lancer
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-slate-500">
                      <div className="font-jetbrains text-[10px] tracking-widest mb-2" style={{ color: '#94A3B8' }}>EN ATTENTE</div>
                      <div>
                        {!hasCurrency && (!salesData || !stockData)
                          ? 'Renseignez la devise et importez les deux fichiers obligatoires (ventes + stock) pour activer l\'analyse'
                          : !hasCurrency
                            ? 'Renseignez la devise pour activer l\'analyse'
                            : 'Importez les deux fichiers obligatoires (ventes + stock) pour activer l\'analyse'}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}

        {audit && (
          <AuditResults audit={audit} companyName={companyName} currency={currency} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// AuditResults V2 — visualisations SVG natives
// ============================================================
function AuditResults({ audit, companyName, currency }) {
  const AMBER = '#F59E0B';
  const AMBER_DARK = '#B45309';
  const cur = (currency && currency.trim()) || 'MAD';
  const fm = (n) => formatMoney(n, cur);
  const profileLabel = {
    distribution: 'Distribution / Négoce',
    industrie: 'Industrie / Manufacturing',
    mixte: 'Profil mixte',
  };

  // Couleur du health score
  const scoreColor =
    audit.healthScore >= 80 ? '#059669' :
    audit.healthScore >= 60 ? '#D97706' :
    audit.healthScore >= 40 ? '#EA580C' : '#DC2626';
  const scoreLabel =
    audit.healthScore >= 80 ? 'Excellent' :
    audit.healthScore >= 60 ? 'Correct' :
    audit.healthScore >= 40 ? 'À optimiser' : 'Critique';
  const scoreMsg =
    audit.healthScore >= 80 ? 'Votre supply chain présente peu de signaux d\'alerte. Quelques optimisations fines possibles.' :
    audit.healthScore >= 60 ? 'Plusieurs leviers d\'amélioration ciblés peuvent être activés rapidement.' :
    audit.healthScore >= 40 ? 'Plusieurs chantiers structurants sont à mener pour fiabiliser la chaîne logistique.' :
    'Signaux critiques détectés — une intervention rapide est recommandée sur plusieurs dimensions.';

  return (
    <div className="space-y-5">

      {/* HERO IDENTITÉ + HEALTH SCORE */}
      <div className="rounded-xl overflow-hidden text-white" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 70%, ' + AMBER_DARK + ' 100%)' }}>
        <div className="px-5 pt-4 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="font-jetbrains text-[10px] tracking-wider opacity-70">NIVEAU D'AUDIT</div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-jetbrains text-[10px] font-bold tracking-widest"
              style={{
                background: audit.level === 'complet' ? AMBER : audit.level === 'standard' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255,255,255,0.1)',
                color: audit.level === 'complet' ? '#0F172A' : '#F59E0B',
                border: audit.level === 'complet' ? 'none' : '1px solid rgba(245, 158, 11, 0.3)',
              }}>
              {audit.level === 'complet' ? '★ AUDIT COMPLET' : audit.level === 'standard' ? '★★ AUDIT STANDARD' : audit.level === 'express+' ? '★ EXPRESS+' : 'EXPRESS'}
            </span>
            <div className="font-jetbrains text-[10px] opacity-60">{2 + audit.filesProvided} / 6 fichiers fournis</div>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Health Score gauge */}
          <div className="lg:col-span-2 flex items-center gap-4">
            <HealthGauge score={audit.healthScore} color={scoreColor} />
            <div>
              <div className="font-jetbrains text-[10px] tracking-wider opacity-70 mb-1">SUPPLY CHAIN HEALTH</div>
              <div className="font-bricolage font-bold text-2xl" style={{ color: scoreColor }}>{scoreLabel}</div>
              <div className="text-xs text-slate-300 leading-snug mt-1.5 max-w-xs">{scoreMsg}</div>
            </div>
          </div>
          {/* Identité */}
          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4 border-l-0 lg:border-l border-slate-700 lg:pl-5">
            <div>
              <div className="text-[10px] text-slate-400 font-jetbrains mb-0.5">Société</div>
              <div className="font-bricolage font-semibold text-sm">{companyName || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-jetbrains mb-0.5">Profil</div>
              <div className="font-bricolage font-semibold text-sm">{profileLabel[audit.profile] || audit.profile}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-jetbrains mb-0.5">Période</div>
              <div className="font-bricolage font-semibold text-sm">{Math.round(audit.periodMonths)} mois</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-jetbrains mb-0.5">Périmètre</div>
              <div className="font-bricolage font-semibold text-sm">{audit.nArticles} articles · {audit.isMultiStore ? audit.allStores.length + ' sites' : '1 site'}</div>
            </div>
            {audit.hasPmp && (
              <div className="md:col-span-4 pt-3 mt-1 border-t border-slate-700/50">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-jetbrains">VALORISATION VIA PMP</span>
                  <span className="font-jetbrains text-xs font-semibold text-emerald-400">✓ Données financières exploitables</span>
                  <span className="text-[10px] text-slate-400 font-jetbrains ml-auto">PMP moyen pondéré : <span className="font-semibold text-white">{fm(audit.avgPmp)}</span></span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ALERTES PRIORITAIRES */}
      {audit.alerts.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-3">SIGNAUX PRIORITAIRES DÉTECTÉS</div>
          <div className="space-y-2.5">
            {audit.alerts.slice(0, 5).map((a, i) => {
              const colorMap = {
                critical: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', dot: '#DC2626' },
                warning:  { bg: '#FFFBEB', border: '#FCD34D', text: '#92400E', dot: '#D97706' },
                info:     { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', dot: '#2563EB' },
              };
              const c = colorMap[a.level];
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: c.bg, border: '1px solid ' + c.border }}>
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: c.dot }} />
                  <div className="flex-1">
                    <div className="font-semibold text-sm" style={{ color: c.text }}>{a.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: c.text, opacity: 0.85 }}>{a.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPIs GLOBAUX */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label="Chiffre d'affaires" value={audit.hasMonetary ? fm(audit.totalCA) : formatNum(audit.totalQty) + ' u'} sub={'sur ' + Math.round(audit.periodMonths) + ' mois'} accent={AMBER} />
        <KpiTile label="Stock immobilisé" value={fm(audit.totalStockValue)} sub={formatNum(audit.totalStockQty) + ' unités'} accent={AMBER} />
        <KpiTile label="Stock dormant" value={fm(audit.dormantValue)} sub={audit.dormantPct.toFixed(0) + ' % du stock · ' + audit.dormants.length + ' articles'} accent={audit.dormantPct > 15 ? '#DC2626' : audit.dormantPct > 5 ? '#D97706' : '#059669'} />
        <KpiTile label="Rotation annuelle" value={audit.avgRotation ? audit.avgRotation.toFixed(1) + ' ×' : '—'} sub={audit.avgCoverage ? 'Couv. moy. ' + Math.round(audit.avgCoverage) + ' j' : ''} accent={AMBER} />
      </div>

      {/* SAISONNALITÉ + RÉPARTITION STOCK (côte à côte) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider">SAISONNALITÉ {audit.hasMonetary ? '(CA)' : '(VOLUME)'}</div>
            <div className="font-jetbrains text-[10px] text-slate-400">{audit.monthlyTrend.length} mois analysés</div>
          </div>
          <div className="text-xs text-slate-500 mb-3">Tendance mensuelle sur la période · identifiez les pics et creux d'activité</div>
          <LineChartSVG data={audit.monthlyTrend} valueKey={audit.hasMonetary ? 'amount' : 'qty'} color={AMBER} hasMonetary={audit.hasMonetary} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1">RÉPARTITION DU STOCK</div>
          <div className="text-xs text-slate-500 mb-3">{audit.hasPmp ? 'Par valeur immobilisée (basée sur le PMP)' : 'Par quantité (PMP non fourni dans votre fichier)'}</div>
          <StockBreakdownDonut breakdown={audit.stockBreakdown} cur={cur} />
        </div>
      </div>

      {/* PARETO ABC */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1">COURBE DE PARETO ABC</div>
        <div className="text-xs text-slate-500 mb-3">Concentration du chiffre d'affaires sur le portefeuille articles · les zones colorées matérialisent les classes A (top 80 %), B (80-95 %), C (95-100 %)</div>
        <ParetoChartSVG refs={audit.refs} hasMonetary={audit.hasMonetary} />
      </div>

      {/* MATRICE ABC × XYZ */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1">CLASSIFICATION ABC × XYZ</div>
        <div className="text-xs text-slate-500 mb-4">ABC = poids dans le CA · XYZ = régularité de la demande · 9 cases pour 9 stratégies d'approvisionnement</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="p-2 text-left font-jetbrains text-[10px] text-slate-500">VALEUR \ RÉGULARITÉ</th>
                <th className="p-2 text-center font-jetbrains text-[10px] text-slate-500">X (régulier)</th>
                <th className="p-2 text-center font-jetbrains text-[10px] text-slate-500">Y (variable)</th>
                <th className="p-2 text-center font-jetbrains text-[10px] text-slate-500">Z (sporadique)</th>
              </tr>
            </thead>
            <tbody>
              {['A', 'B', 'C'].map(a => (
                <tr key={a}>
                  <td className="p-2 font-jetbrains text-[10px] text-slate-500 font-semibold">
                    {a === 'A' ? 'A (top 80 % CA)' : a === 'B' ? 'B (80-95 %)' : 'C (95-100 %)'}
                  </td>
                  {['X', 'Y', 'Z'].map(x => {
                    const cell = audit.matrix[a + x];
                    const colorMap = {
                      AX: '#059669', AY: '#10B981', AZ: '#F59E0B',
                      BX: '#34D399', BY: '#FCD34D', BZ: '#F97316',
                      CX: '#A7F3D0', CY: '#FDE68A', CZ: '#FCA5A5',
                    };
                    const col = colorMap[a + x];
                    return (
                      <td key={x} className="p-1.5">
                        <div className="rounded-lg p-3 text-center" style={{ background: col + '20', border: '1px solid ' + col }}>
                          <div className="font-bricolage font-bold text-xl" style={{ color: col }}>{cell.count}</div>
                          <div className="text-[10px] text-slate-600 mt-0.5">articles</div>
                          <div className="text-[10px] text-slate-500 mt-1">{cell.valueSharePct.toFixed(0)} % du CA</div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 p-3 rounded-lg text-xs leading-relaxed" style={{ background: '#F8FAFC' }}>
          <span className="font-semibold text-slate-700">Lecture : </span>
          <span className="text-slate-600">les <strong>AX</strong> sont les bestsellers stables (prévision facile), les <strong>AZ</strong> font du CA mais sont erratiques (stock de sécurité élevé requis), les <strong>CZ</strong> sont candidats à la rationalisation du référentiel.</span>
        </div>
      </div>

      {/* TOP 10 ARTICLES VENDEURS - bar chart horizontal */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1">TOP 10 ARTICLES VENDEURS</div>
        <div className="text-xs text-slate-500 mb-3">Concentration du chiffre d'affaires sur les meilleurs articles · à fiabiliser en priorité</div>
        <TopArticlesBarChart refs={audit.refs.slice(0, 10)} hasMonetary={audit.hasMonetary} totalValue={audit.hasMonetary ? audit.totalCA : audit.totalQty} cur={cur} />
      </div>

      {/* STOCK DORMANT */}
      {audit.dormants.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
            <div className="font-jetbrains text-xs text-slate-600">TOP 10 ARTICLES DORMANTS · capital immobilisé sans rotation</div>
            <div className="font-jetbrains text-[10px] text-slate-400">
              {audit.dormants.length} articles dormants au total
              {audit.hasPmp && (<> · <span className="text-red-600 font-semibold">{fm(audit.dormantValue)}</span> immobilisés</>)}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/30">
                  <Th>Référence</Th>
                  <Th>Libellé</Th>
                  <Th className="text-right">Qté</Th>
                  {audit.hasPmp && <Th className="text-right">PMP</Th>}
                  {audit.hasPmp && <Th className="text-right">Valeur immobilisée</Th>}
                  <Th className="text-right">Dernière vente</Th>
                </tr>
              </thead>
              <tbody>
                {audit.dormants.slice(0, 10).map((d, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <Td className="font-jetbrains text-slate-700">{d.ref}</Td>
                    <Td className="text-slate-700">{d.label || '—'}</Td>
                    <Td className="text-right font-jetbrains text-slate-700">{formatNum(d.qty)}</Td>
                    {audit.hasPmp && <Td className="text-right font-jetbrains text-slate-600">{d.pmp > 0 ? fm(d.pmp) : '—'}</Td>}
                    {audit.hasPmp && <Td className="text-right font-jetbrains font-semibold text-red-600">{fm(d.value)}</Td>}
                    <Td className="text-right font-jetbrains text-slate-500">{d.lastSale ? 'il y a ' + Math.round(d.daysSinceSale / 30) + ' mois' : 'Jamais'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MULTI-MAGASIN */}
      {audit.isMultiStore && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1">PERFORMANCE PAR SITE</div>
            <div className="text-xs text-slate-500 mb-3">Comparaison ventes et stock entre vos sites · barres colorées pour lecture rapide</div>
            <StoresBarChart stores={Object.values(audit.storeStats)} hasMonetary={audit.hasMonetary} hasPmp={audit.hasPmp} cur={cur} />
          </div>

          {audit.imbalances.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="font-jetbrains text-xs text-slate-600">DÉSÉQUILIBRES INTER-MAGASINS · candidats au transfert</div>
                <div className="font-jetbrains text-[10px] text-slate-400">{audit.imbalances.length} articles concernés</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/30">
                      <Th>Référence</Th>
                      <Th>Libellé</Th>
                      <Th>Site sur-stocké</Th>
                      <Th className="text-right">Qté</Th>
                      <Th>Site sous-stocké</Th>
                      <Th className="text-right">Qté</Th>
                      <Th className="text-right">Ratio</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.imbalances.slice(0, 10).map((im, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <Td className="font-jetbrains text-slate-700">{im.ref}</Td>
                        <Td className="text-slate-700">{im.label || '—'}</Td>
                        <Td className="text-slate-700">{im.maxStore}</Td>
                        <Td className="text-right font-jetbrains text-red-600 font-semibold">{formatNum(im.maxQty)}</Td>
                        <Td className="text-slate-700">{im.minStore}</Td>
                        <Td className="text-right font-jetbrains text-amber-600">{formatNum(im.minQty)}</Td>
                        <Td className="text-right font-jetbrains text-slate-800">×{im.ratio.toFixed(1)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* SOUS-STOCK / SURSTOCK */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {audit.understocked.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div className="font-jetbrains text-xs text-slate-600">ARTICLES EN SOUS-STOCK · risque de rupture</div>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <Th>Référence</Th>
                    <Th className="text-right">Stock</Th>
                    <Th className="text-right">Couverture</Th>
                  </tr>
                </thead>
                <tbody>
                  {audit.understocked.slice(0, 15).map((c, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <Td className="font-jetbrains text-slate-700">{c.ref}</Td>
                      <Td className="text-right font-jetbrains text-slate-700">{formatNum(c.stockQty)}</Td>
                      <Td className="text-right font-jetbrains font-semibold text-red-600">{Math.round(c.coverageDays)} j</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {audit.overstocked.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div className="font-jetbrains text-xs text-slate-600">ARTICLES EN SURSTOCK · plus de 6 mois de couverture</div>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <Th>Référence</Th>
                    <Th className="text-right">Valeur stock</Th>
                    <Th className="text-right">Couverture</Th>
                  </tr>
                </thead>
                <tbody>
                  {audit.overstocked.slice(0, 15).map((c, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <Td className="font-jetbrains text-slate-700">{c.ref}</Td>
                      <Td className="text-right font-jetbrains text-slate-700">{fm(c.stockValue)}</Td>
                      <Td className="text-right font-jetbrains font-semibold text-orange-600">{Math.round(c.coverageDays)} j</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SECTIONS AUDIT COMPLET (si données fournies) */}
      {(audit.supplierPerf || audit.customerPerf || audit.futureCoverage || audit.categoryAnalysis) && (
        <div className="space-y-4">
          <div className="pt-3 border-t border-slate-200">
            <div className="font-jetbrains text-[10px] tracking-wider mb-1" style={{ color: AMBER_DARK }}>AUDIT APPROFONDI</div>
            <div className="font-bricolage font-bold text-xl text-slate-900">Analyses complémentaires</div>
            <div className="text-xs text-slate-500 mt-1">Modules débloqués par les fichiers complémentaires fournis</div>
          </div>
          {audit.supplierPerf && <SupplierPerfSection perf={audit.supplierPerf} />}
          {audit.customerPerf && <CustomerPerfSection perf={audit.customerPerf} />}
          {audit.futureCoverage && <FutureCoverageSection coverage={audit.futureCoverage} hasPmp={audit.hasPmp} cur={cur} />}
          {audit.categoryAnalysis && <CategoryAnalysisSection cat={audit.categoryAnalysis} hasMonetary={audit.hasMonetary} cur={cur} />}
        </div>
      )}

      {/* CTA WALYCONSEIL */}
      <div className="rounded-xl p-6 md:p-8 text-white" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 70%, ' + AMBER_DARK + ' 100%)' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2">
            <div className="font-jetbrains text-[10px] tracking-wider mb-2" style={{ color: AMBER }}>PROCHAINE ÉTAPE</div>
            <div className="font-bricolage font-bold text-2xl mb-2 leading-tight">
              Discutons des chantiers prioritaires identifiés
            </div>
            <div className="text-slate-300 text-sm leading-relaxed">
              Ce diagnostic est généré automatiquement. Pour aller plus loin sur les recommandations chiffrées, un plan d'action concret par chantier et une feuille de route alignée avec votre ERP, échangeons 30 minutes en visio.
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <a href={'mailto:contact@walyconseil.com?subject=Suivi%20audit%20supply%20chain%20' + encodeURIComponent(companyName || '')}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-jetbrains text-xs font-semibold shadow-lg transition-all hover:translate-y-[-2px]"
              style={{ background: AMBER, color: '#0F172A' }}>
              CONTACTER WALYCONSEIL
              <ArrowRight size={13} />
            </a>
            <div className="text-[10px] text-slate-400 text-center font-jetbrains">contact@walyconseil.com</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-4 text-xs text-slate-500 leading-relaxed">
        <span className="font-semibold text-slate-700">À noter : </span>
        cet audit est un diagnostic Express basé sur 2 dimensions (ventes + stock). Pour un audit complet incluant performance fournisseurs (OTIF, retards), analyse marge et BFR détaillé, le niveau Standard ou Complet requiert des données complémentaires. L'export PDF arrive dans la prochaine version.
      </div>
    </div>
  );
}

// ============================================================
// Composants SVG : Health Gauge, Line, Donut, Pareto, Bars
// ============================================================

function HealthGauge({ score, color }) {
  // Demi-cercle 0-100
  const size = 110;
  const cx = size / 2;
  const cy = size * 0.75;
  const radius = 45;
  const angleFromScore = (score / 100) * 180; // 0° à 180° pour 0-100
  const startAngle = 180;
  const endAngle = startAngle + angleFromScore;
  const polarToCartesian = (a) => {
    const r = (a * Math.PI) / 180;
    return { x: cx + radius * Math.cos(r), y: cy + radius * Math.sin(r) };
  };
  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const largeArc = angleFromScore > 180 ? 1 : 0;
  const arcPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  const bgStart = polarToCartesian(180);
  const bgEnd = polarToCartesian(360);
  const bgPath = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 0 1 ${bgEnd.x} ${bgEnd.y}`;
  return (
    <svg width={size} height={size * 0.85} viewBox={`0 0 ${size} ${size * 0.85}`}>
      <path d={bgPath} stroke="rgba(255,255,255,0.1)" strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d={arcPath} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round" />
      <text x={cx} y={cy + 5} textAnchor="middle" fill="white" fontSize="26" fontWeight="700" fontFamily="'Bricolage Grotesque', sans-serif">{score}</text>
      <text x={cx} y={cy + 22} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="'JetBrains Mono', monospace">/ 100</text>
    </svg>
  );
}

function LineChartSVG({ data, valueKey, color, hasMonetary }) {
  const w = 600, h = 200, pad = { t: 20, r: 20, b: 32, l: 50 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  if (!data || data.length < 2) return <div className="text-xs text-slate-400 py-8 text-center">Données insuffisantes</div>;
  const values = data.map(d => d[valueKey]);
  const maxV = Math.max(...values);
  const minV = 0;
  const range = Math.max(1, maxV - minV);
  const points = data.map((d, i) => ({
    x: pad.l + (i / Math.max(1, data.length - 1)) * innerW,
    y: pad.t + (1 - (d[valueKey] - minV) / range) * innerH,
    raw: d,
  }));
  // Path lignes
  const path = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  // Area fill
  const areaPath = path + ` L ${points[points.length - 1].x} ${pad.t + innerH} L ${points[0].x} ${pad.t + innerH} Z`;
  // Ticks Y (4 niveaux)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: pad.t + (1 - t) * innerH,
    val: minV + t * range,
  }));
  const formatTick = (v) => {
    if (hasMonetary) {
      if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
      if (v >= 1000) return Math.round(v / 1000) + 'k';
      return Math.round(v);
    }
    if (v >= 1000) return Math.round(v / 1000) + 'k';
    return Math.round(v);
  };
  const formatMonth = (ym) => {
    const [y, m] = ym.split('-');
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    return months[parseInt(m, 10) - 1] + ' ' + y.slice(2);
  };
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <line key={i} x1={pad.l} y1={t.y} x2={w - pad.r} y2={t.y} stroke="#F1F5F9" strokeWidth="1" />
      ))}
      {/* Y labels */}
      {yTicks.map((t, i) => (
        <text key={'l' + i} x={pad.l - 6} y={t.y + 3} textAnchor="end" fontSize="9" fill="#94A3B8" fontFamily="'JetBrains Mono', monospace">{formatTick(t.val)}</text>
      ))}
      {/* Area */}
      <path d={areaPath} fill={color} opacity="0.12" />
      {/* Line */}
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {/* Points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill={color} stroke="white" strokeWidth="1.5" />
        </g>
      ))}
      {/* X labels (un sur deux si plus de 8 mois) */}
      {points.map((p, i) => {
        const showLabel = data.length <= 8 || i % 2 === 0 || i === points.length - 1;
        if (!showLabel) return null;
        return (
          <text key={'x' + i} x={p.x} y={h - pad.b + 14} textAnchor="middle" fontSize="9" fill="#64748B" fontFamily="'JetBrains Mono', monospace">{formatMonth(p.raw.ym)}</text>
        );
      })}
    </svg>
  );
}

function StockBreakdownDonut({ breakdown, cur = 'MAD' }) {
  const w = 200, h = 200;
  const cx = w / 2, cy = h / 2;
  const r = 70, rInner = 45;
  const segments = [
    { label: 'Actif', value: breakdown.healthy, color: '#059669' },
    { label: 'Surstock', value: breakdown.overstocked, color: '#F97316' },
    { label: 'Dormant', value: breakdown.dormant, color: '#DC2626' },
  ].filter(s => s.value > 0);
  const sum = segments.reduce((a, b) => a + b.value, 0);
  if (sum === 0) return <div className="text-xs text-slate-400 text-center py-8">Aucune donnée à répartir</div>;

  const formatVal = (v) => breakdown.unit === 'value' ? formatMoney(v, cur) : formatNum(v) + ' u';
  const totalLabel = breakdown.unit === 'value' ? formatMoney(breakdown.total, cur) : formatNum(breakdown.total) + ' u';
  const subLabel = breakdown.unit === 'value' ? 'VALEUR' : 'QUANTITÉ';

  let angle = -90;
  const paths = segments.map((s) => {
    const seg = (s.value / sum) * 360;
    const startA = (angle * Math.PI) / 180;
    const endA = ((angle + seg) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startA), y1 = cy + r * Math.sin(startA);
    const x2 = cx + r * Math.cos(endA), y2 = cy + r * Math.sin(endA);
    const xi1 = cx + rInner * Math.cos(endA), yi1 = cy + rInner * Math.sin(endA);
    const xi2 = cx + rInner * Math.cos(startA), yi2 = cy + rInner * Math.sin(startA);
    const largeArc = seg > 180 ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${rInner} ${rInner} 0 ${largeArc} 0 ${xi2} ${yi2} Z`;
    angle += seg;
    return { d, color: s.color, label: s.label, value: s.value, pct: (s.value / sum) * 100 };
  });
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[200px] mx-auto block">
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="10" fill="#64748B" fontFamily="'JetBrains Mono', monospace">{subLabel}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="13" fill="#0F172A" fontWeight="700" fontFamily="'Bricolage Grotesque', sans-serif">{totalLabel}</text>
      </svg>
      <div className="space-y-1.5 mt-3">
        {paths.map((p, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
              <span className="text-slate-700">{p.label}</span>
            </div>
            <div className="font-jetbrains text-[11px] text-slate-600">{p.pct.toFixed(0)} % · {formatVal(p.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ParetoChartSVG({ refs, hasMonetary }) {
  const w = 800, h = 240, pad = { t: 15, r: 50, b: 30, l: 50 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  if (!refs || refs.length === 0) return <div className="text-xs text-slate-400 text-center py-8">Aucune donnée</div>;
  const total = refs.reduce((s, r) => s + (hasMonetary ? r.totalAmount : r.totalQty), 0);
  // Construire série cumulative
  let cumul = 0;
  const points = refs.map((r, i) => {
    cumul += hasMonetary ? r.totalAmount : r.totalQty;
    return {
      x: pad.l + ((i + 1) / refs.length) * innerW,
      y: pad.t + (1 - cumul / total) * innerH,
      cumulPct: (cumul / total) * 100,
      barH: ((hasMonetary ? r.totalAmount : r.totalQty) / refs[0][hasMonetary ? 'totalAmount' : 'totalQty']) * innerH,
      barX: pad.l + (i / refs.length) * innerW,
      barW: innerW / refs.length,
      abc: r.abc,
    };
  });
  // Repérer les seuils 80% et 95%
  const idxA = points.findIndex(p => p.cumulPct >= 80);
  const idxB = points.findIndex(p => p.cumulPct >= 95);
  const xA = idxA >= 0 ? points[idxA].x : pad.l + innerW;
  const xB = idxB >= 0 ? points[idxB].x : pad.l + innerW;
  // Path courbe cumul
  const linePath = [`M ${pad.l} ${pad.t + innerH}`, ...points.map(p => `L ${p.x} ${p.y}`)].join(' ');
  const colorMap = { A: '#059669', B: '#F59E0B', C: '#EF4444' };
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Zones A/B/C */}
      <rect x={pad.l} y={pad.t} width={xA - pad.l} height={innerH} fill="#10B981" opacity="0.05" />
      <rect x={xA} y={pad.t} width={xB - xA} height={innerH} fill="#F59E0B" opacity="0.05" />
      <rect x={xB} y={pad.t} width={pad.l + innerW - xB} height={innerH} fill="#EF4444" opacity="0.05" />
      {/* Barres par article */}
      {points.map((p, i) => (
        <rect key={i} x={p.barX + 1} y={pad.t + innerH - p.barH} width={Math.max(1, p.barW - 2)} height={p.barH} fill={colorMap[p.abc]} opacity="0.7" />
      ))}
      {/* Courbe cumul */}
      <path d={linePath} fill="none" stroke="#0F172A" strokeWidth="2" strokeLinejoin="round" />
      {/* Lignes seuils 80/95 */}
      <line x1={pad.l} y1={pad.t + innerH * 0.2} x2={w - pad.r} y2={pad.t + innerH * 0.2} stroke="#94A3B8" strokeDasharray="3 3" strokeWidth="1" />
      <line x1={pad.l} y1={pad.t + innerH * 0.05} x2={w - pad.r} y2={pad.t + innerH * 0.05} stroke="#94A3B8" strokeDasharray="3 3" strokeWidth="1" />
      {/* Labels Y droite (cumul %) */}
      <text x={w - pad.r + 4} y={pad.t + innerH * 0.2 + 3} fontSize="9" fill="#94A3B8" fontFamily="'JetBrains Mono', monospace">80 %</text>
      <text x={w - pad.r + 4} y={pad.t + innerH * 0.05 + 3} fontSize="9" fill="#94A3B8" fontFamily="'JetBrains Mono', monospace">95 %</text>
      {/* Légende abc */}
      <g transform={`translate(${pad.l}, ${h - 10})`}>
        <rect x="0" y="-9" width="8" height="8" fill="#059669" opacity="0.7" />
        <text x="12" y="-2" fontSize="9" fill="#64748B" fontFamily="'JetBrains Mono', monospace">Classe A</text>
        <rect x="80" y="-9" width="8" height="8" fill="#F59E0B" opacity="0.7" />
        <text x="92" y="-2" fontSize="9" fill="#64748B" fontFamily="'JetBrains Mono', monospace">Classe B</text>
        <rect x="160" y="-9" width="8" height="8" fill="#EF4444" opacity="0.7" />
        <text x="172" y="-2" fontSize="9" fill="#64748B" fontFamily="'JetBrains Mono', monospace">Classe C</text>
        <line x1="245" y1="-5" x2="265" y2="-5" stroke="#0F172A" strokeWidth="2" />
        <text x="270" y="-2" fontSize="9" fill="#64748B" fontFamily="'JetBrains Mono', monospace">Cumul %</text>
      </g>
      {/* Label X */}
      <text x={pad.l + innerW / 2} y={h - 25} textAnchor="middle" fontSize="9" fill="#94A3B8" fontFamily="'JetBrains Mono', monospace">{refs.length} articles (du plus vendu au moins vendu)</text>
    </svg>
  );
}

function TopArticlesBarChart({ refs, hasMonetary, totalValue, cur = 'MAD' }) {
  if (!refs || refs.length === 0) return <div className="text-xs text-slate-400 text-center py-4">Aucune donnée</div>;
  const maxV = Math.max(...refs.map(r => hasMonetary ? r.totalAmount : r.totalQty));
  return (
    <div className="space-y-2">
      {refs.map((r, i) => {
        const value = hasMonetary ? r.totalAmount : r.totalQty;
        const pct = (value / maxV) * 100;
        const sharePct = (value / totalValue) * 100;
        const colorByAbc = { A: '#059669', B: '#F59E0B', C: '#EF4444' }[r.abc] || '#64748B';
        return (
          <div key={r.ref} className="flex items-center gap-3">
            <div className="w-6 font-jetbrains text-[10px] text-slate-400 text-right">#{i + 1}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between mb-1 gap-2">
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="font-jetbrains text-xs text-slate-700 truncate">{r.ref}</span>
                  {r.label && <span className="text-[10px] text-slate-500 truncate">{r.label}</span>}
                </div>
                <div className="flex items-baseline gap-2 flex-shrink-0">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-jetbrains font-semibold" style={{ background: colorByAbc + '20', color: colorByAbc }}>{r.abc}{r.xyz}</span>
                  <span className="font-jetbrains text-xs font-semibold text-slate-800">{hasMonetary ? formatMoney(value, cur) : formatNum(value) + ' u'}</span>
                  <span className="font-jetbrains text-[10px] text-slate-500 w-10 text-right">{sharePct.toFixed(1)} %</span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full transition-all" style={{ width: pct + '%', background: colorByAbc, opacity: 0.85 }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StoresBarChart({ stores, hasMonetary, hasPmp, cur = 'MAD' }) {
  if (!stores || stores.length === 0) return <div className="text-xs text-slate-400 text-center py-4">Aucune donnée</div>;
  const sorted = [...stores].sort((a, b) => (hasMonetary ? b.totalCA - a.totalCA : b.totalQty - a.totalQty));
  const maxLeft = Math.max(...sorted.map(s => hasMonetary ? s.totalCA : s.totalQty), 1);
  const maxRight = Math.max(...sorted.map(s => hasPmp ? s.stockValue : s.stockQty), 1);
  return (
    <div>
      {/* Légende */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: '#10B981' }} />
          <span className="text-slate-600">{hasMonetary ? "Chiffre d'affaires" : 'Volume vendu'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: '#F59E0B' }} />
          <span className="text-slate-600">{hasPmp ? 'Stock valorisé' : 'Stock en quantité'}</span>
        </div>
      </div>

      <div className="space-y-4">
        {sorted.map(s => {
          const leftVal = hasMonetary ? s.totalCA : s.totalQty;
          const rightVal = hasPmp ? s.stockValue : s.stockQty;
          const leftLabel = hasMonetary ? formatMoney(s.totalCA, cur) : formatNum(s.totalQty) + ' u';
          const rightLabel = hasPmp ? formatMoney(s.stockValue, cur) : formatNum(s.stockQty) + ' u';
          return (
            <div key={s.store} className="rounded-lg p-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div className="flex items-baseline justify-between mb-2.5">
                <span className="font-bricolage font-semibold text-sm text-slate-900">{s.store}</span>
                <span className="font-jetbrains text-[10px] text-slate-500">{s.nArticles} articles stockés</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-jetbrains text-[10px] font-semibold" style={{ color: '#059669' }}>{hasMonetary ? 'CA' : 'VENTES'}</span>
                    <span className="font-jetbrains text-xs font-semibold text-slate-800">{leftLabel}</span>
                  </div>
                  <div className="h-4 rounded-md overflow-hidden" style={{ background: '#D1FAE5' }}>
                    <div className="h-full rounded-md transition-all" style={{ width: ((leftVal / maxLeft) * 100) + '%', background: '#10B981' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-jetbrains text-[10px] font-semibold" style={{ color: '#B45309' }}>STOCK</span>
                    <span className="font-jetbrains text-xs font-semibold text-slate-800">{rightLabel}</span>
                  </div>
                  <div className="h-4 rounded-md overflow-hidden" style={{ background: '#FEF3C7' }}>
                    <div className="h-full rounded-md transition-all" style={{ width: ((rightVal / maxRight) * 100) + '%', background: '#F59E0B' }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiTile({ label, value, sub, accent }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-1">{label}</div>
      <div className="font-bricolage font-bold text-2xl" style={{ color: accent || '#0F172A' }}>{value}</div>
      {sub && <div className="font-jetbrains text-[10px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function OptionalFileCard({ label, description, data, fileName, inputRef, onImport, onTemplate, onClear }) {
  const loaded = !!data;
  return (
    <div className="rounded-lg border-2 bg-white p-3 transition-all" style={{ borderColor: loaded ? '#86EFAC' : '#E2E8F0', background: loaded ? '#F0FDF4' : 'white' }}>
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="min-w-0">
          <div className="font-bricolage font-semibold text-xs text-slate-900 truncate">{label}</div>
          <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{description}</div>
        </div>
        {loaded && (
          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#22C55E' }}>
            <Check size={11} className="text-white" />
          </div>
        )}
      </div>
      {!loaded ? (
        <>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={onImport} className="hidden" />
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => inputRef.current && inputRef.current.click()} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded font-jetbrains text-[10px] font-semibold text-white" style={{ background: '#F59E0B' }}>
              <Upload size={10} />
              IMPORTER
            </button>
            <button onClick={onTemplate} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded font-jetbrains text-[10px] text-slate-700 border border-slate-300 hover:bg-slate-50">
              <FileDown size={10} />
              TEMPLATE
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-1">
          <div className="font-jetbrains text-[10px] text-slate-700 truncate">{fileName}</div>
          <div className="font-jetbrains text-[10px] text-emerald-700">{data.length} ligne(s)</div>
          <button onClick={onClear} className="font-jetbrains text-[10px] text-red-600 hover:underline">Remplacer</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sections d'analyse pour l'audit Complet
// ============================================================

function SupplierPerfSection({ perf }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
        <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-0.5">PERFORMANCE FOURNISSEURS · OTIF ACHAT</div>
        <div className="text-xs text-slate-500">Analyse des livraisons reçues : à temps + complet</div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <PerfTile label="OTIF achat global" value={perf.otifRate.toFixed(0) + ' %'} accent={perf.otifRate >= 90 ? '#059669' : perf.otifRate >= 75 ? '#D97706' : '#DC2626'} />
          <PerfTile label="On Time" value={perf.otRate.toFixed(0) + ' %'} accent="#0F172A" />
          <PerfTile label="In Full" value={perf.inFullRate.toFixed(0) + ' %'} accent="#0F172A" />
          <PerfTile label="Retard moyen" value={perf.avgDelay.toFixed(1) + ' j'} accent={perf.avgDelay > 5 ? '#DC2626' : '#0F172A'} sub="quand en retard" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/30">
                <Th>Fournisseur</Th>
                <Th className="text-right">Livraisons</Th>
                <Th className="text-right">OT %</Th>
                <Th className="text-right">IF %</Th>
                <Th className="text-right">OTIF %</Th>
                <Th className="text-right">Retard moyen</Th>
              </tr>
            </thead>
            <tbody>
              {perf.suppliers.slice(0, 10).map((s, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <Td className="font-semibold text-slate-800">{s.supplier}</Td>
                  <Td className="text-right font-jetbrains text-slate-700">{s.total}</Td>
                  <Td className="text-right font-jetbrains" style={{ color: s.otRate < 80 ? '#DC2626' : s.otRate < 95 ? '#D97706' : '#059669' }}>{s.otRate.toFixed(0)} %</Td>
                  <Td className="text-right font-jetbrains" style={{ color: s.inFullRate < 80 ? '#DC2626' : s.inFullRate < 95 ? '#D97706' : '#059669' }}>{s.inFullRate.toFixed(0)} %</Td>
                  <Td className="text-right font-jetbrains font-semibold" style={{ color: s.otifRate < 70 ? '#DC2626' : s.otifRate < 90 ? '#D97706' : '#059669' }}>{s.otifRate.toFixed(0)} %</Td>
                  <Td className="text-right font-jetbrains text-slate-600">{s.avgDelay.toFixed(1)} j</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CustomerPerfSection({ perf }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
        <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-0.5">PERFORMANCE SERVICE CLIENT · OTIF VENTE</div>
        <div className="text-xs text-slate-500">Vos engagements de livraison vis-à-vis de vos clients</div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
          <PerfTile label="OTIF client" value={perf.otifRate.toFixed(0) + ' %'} accent={perf.otifRate >= 95 ? '#059669' : perf.otifRate >= 85 ? '#D97706' : '#DC2626'} />
          <PerfTile label="On Time" value={perf.otRate.toFixed(0) + ' %'} accent="#0F172A" />
          <PerfTile label="In Full" value={perf.inFullRate.toFixed(0) + ' %'} accent="#0F172A" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/30">
                <Th>Client</Th>
                <Th className="text-right">Livraisons</Th>
                <Th className="text-right">OT %</Th>
                <Th className="text-right">IF %</Th>
                <Th className="text-right">OTIF %</Th>
              </tr>
            </thead>
            <tbody>
              {perf.customers.slice(0, 10).map((c, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <Td className="font-semibold text-slate-800">{c.customer}</Td>
                  <Td className="text-right font-jetbrains text-slate-700">{c.total}</Td>
                  <Td className="text-right font-jetbrains" style={{ color: c.otRate < 90 ? '#DC2626' : c.otRate < 95 ? '#D97706' : '#059669' }}>{c.otRate.toFixed(0)} %</Td>
                  <Td className="text-right font-jetbrains" style={{ color: c.inFullRate < 90 ? '#DC2626' : c.inFullRate < 95 ? '#D97706' : '#059669' }}>{c.inFullRate.toFixed(0)} %</Td>
                  <Td className="text-right font-jetbrains font-semibold" style={{ color: c.otifRate < 80 ? '#DC2626' : c.otifRate < 95 ? '#D97706' : '#059669' }}>{c.otifRate.toFixed(0)} %</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FutureCoverageSection({ coverage, hasPmp, cur = 'MAD' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
        <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-0.5">COMMANDES OUVERTES · COUVERTURE FUTURE</div>
        <div className="text-xs text-slate-500">{coverage.nOrders} ligne(s) de commande · {coverage.nRefsOrdered} articles · {hasPmp && coverage.totalOpenValue > 0 ? formatMoney(coverage.totalOpenValue, cur) + ' engagés' : formatNum(coverage.totalOpenQty) + ' unités attendues'}</div>
      </div>
      <div className="p-5 space-y-5">

        {coverage.riskRuptures.length > 0 && (
          <div>
            <div className="font-jetbrains text-xs text-red-700 font-semibold mb-2">⚠ RUPTURES IMMINENTES MALGRÉ COMMANDES EN COURS</div>
            <div className="text-xs text-slate-500 mb-2">Le stock actuel sera épuisé AVANT l'arrivée de la prochaine commande. Accélérer les livraisons.</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/30">
                    <Th>Référence</Th>
                    <Th>Libellé</Th>
                    <Th className="text-right">Couverture actuelle</Th>
                    <Th className="text-right">Arrivée prévue</Th>
                    <Th className="text-right">Qté en cours</Th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.riskRuptures.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <Td className="font-jetbrains text-slate-700">{r.ref}</Td>
                      <Td className="text-slate-700">{r.label || '—'}</Td>
                      <Td className="text-right font-jetbrains font-semibold text-red-600">{Math.round(r.currentCoverage)} j</Td>
                      <Td className="text-right font-jetbrains text-orange-600">dans {r.daysUntilArrival} j</Td>
                      <Td className="text-right font-jetbrains text-slate-700">{formatNum(r.openQty)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {coverage.understockedNoOrder.length > 0 && (
          <div>
            <div className="font-jetbrains text-xs text-orange-700 font-semibold mb-2">⚠ ARTICLES À APPROVISIONNER D'URGENCE (PAS DE COMMANDE EN COURS)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/30">
                    <Th>Référence</Th>
                    <Th>Libellé</Th>
                    <Th className="text-right">Stock actuel</Th>
                    <Th className="text-right">Couverture</Th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.understockedNoOrder.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <Td className="font-jetbrains text-slate-700">{r.ref}</Td>
                      <Td className="text-slate-700">{r.label || '—'}</Td>
                      <Td className="text-right font-jetbrains text-slate-700">{formatNum(r.stockQty)}</Td>
                      <Td className="text-right font-jetbrains font-semibold text-orange-600">{Math.round(r.currentCoverage)} j</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {coverage.overOrdering.length > 0 && (
          <div>
            <div className="font-jetbrains text-xs text-amber-700 font-semibold mb-2">⚠ SUR-COMMANDES POTENTIELLES (couverture totale &gt; 12 mois)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/30">
                    <Th>Référence</Th>
                    <Th className="text-right">Stock + commandes</Th>
                    <Th className="text-right">Couverture totale</Th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.overOrdering.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <Td className="font-jetbrains text-slate-700">{r.ref}</Td>
                      <Td className="text-right font-jetbrains text-slate-700">{formatNum(r.totalAvailable)}</Td>
                      <Td className="text-right font-jetbrains font-semibold text-amber-600">{Math.round(r.coverageDays)} j</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryAnalysisSection({ cat, hasMonetary, cur = 'MAD' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
        <div className="font-jetbrains text-[10px] text-slate-500 tracking-wider mb-0.5">RÉFÉRENTIEL ARTICLES · ANALYSE PAR CATÉGORIE</div>
        <div className="text-xs text-slate-500">{cat.nRefs} références analysées · {cat.refsWithoutCategory} sans catégorie · {cat.inactiveInStock.length} inactives en stock</div>
      </div>
      <div className="p-5 space-y-5">

        {cat.categories.length > 0 && (
          <div>
            <div className="font-jetbrains text-xs text-slate-700 font-semibold mb-3">PERFORMANCE PAR FAMILLE</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/30">
                    <Th>Catégorie</Th>
                    <Th className="text-right">Nb articles</Th>
                    <Th className="text-right">{hasMonetary ? 'CA' : 'Volume'}</Th>
                    <Th className="text-right">Part CA</Th>
                    <Th className="text-right">Stock immobilisé</Th>
                  </tr>
                </thead>
                <tbody>
                  {cat.categories.map((c, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <Td className="font-semibold text-slate-800">{c.category}</Td>
                      <Td className="text-right font-jetbrains text-slate-700">{c.nArticles}</Td>
                      <Td className="text-right font-jetbrains text-slate-700">{hasMonetary ? formatMoney(c.totalCA, cur) : formatNum(c.totalCA) + ' u'}</Td>
                      <Td className="text-right font-jetbrains font-semibold text-slate-800">{c.caShare.toFixed(0)} %</Td>
                      <Td className="text-right font-jetbrains text-slate-700">{formatMoney(c.stockValue, cur)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {cat.inactiveInStock.length > 0 && (
          <div>
            <div className="font-jetbrains text-xs text-red-700 font-semibold mb-2">⚠ ARTICLES "INACTIFS" PRÉSENTS EN STOCK</div>
            <div className="text-xs text-slate-500 mb-2">Références marquées comme arrêtées dans votre référentiel mais encore en stock physique. Candidates à la liquidation.</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/30">
                    <Th>Référence</Th>
                    <Th>Libellé</Th>
                    <Th>Catégorie</Th>
                    <Th className="text-right">Qté en stock</Th>
                    <Th className="text-right">Valeur immobilisée</Th>
                  </tr>
                </thead>
                <tbody>
                  {cat.inactiveInStock.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <Td className="font-jetbrains text-slate-700">{r.ref}</Td>
                      <Td className="text-slate-700">{r.label || '—'}</Td>
                      <Td className="text-slate-700">{r.category}</Td>
                      <Td className="text-right font-jetbrains text-slate-700">{formatNum(r.stockQty)}</Td>
                      <Td className="text-right font-jetbrains font-semibold text-red-600">{formatMoney(r.stockValue, cur)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {cat.ltComparison && cat.ltComparison.length > 0 && (
          <div>
            <div className="font-jetbrains text-xs text-slate-700 font-semibold mb-2">⚠ ÉCARTS LEAD TIME THÉORIQUE vs RÉEL</div>
            <div className="text-xs text-slate-500 mb-2">Le délai promis dans votre référentiel n'est pas tenu sur ces articles. À recalibrer ou à signaler aux fournisseurs.</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/30">
                    <Th>Référence</Th>
                    <Th>Libellé</Th>
                    <Th className="text-right">LT théorique</Th>
                    <Th className="text-right">Écart moyen</Th>
                  </tr>
                </thead>
                <tbody>
                  {cat.ltComparison.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <Td className="font-jetbrains text-slate-700">{r.ref}</Td>
                      <Td className="text-slate-700">{r.label || '—'}</Td>
                      <Td className="text-right font-jetbrains text-slate-700">{r.theoretical} j</Td>
                      <Td className="text-right font-jetbrains font-semibold" style={{ color: r.diff > 0 ? '#DC2626' : '#059669' }}>{r.diff > 0 ? '+' : ''}{r.diff.toFixed(1)} j</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PerfTile({ label, value, sub, accent }) {
  return (
    <div className="rounded-lg p-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
      <div className="font-jetbrains text-[9px] text-slate-500 tracking-wider mb-1">{label}</div>
      <div className="font-bricolage font-bold text-xl" style={{ color: accent || '#0F172A' }}>{value}</div>
      {sub && <div className="font-jetbrains text-[9px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
