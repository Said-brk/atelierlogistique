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
^FO40,125^FDColis n AT-2026-0001^FS
^FO40,170^FDExpediteur : BARKco^FS
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
^FO40,125^FDColis 1/3 - AT-2026-001^FS
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
^FO40,125^FDColis 2/3 - AT-2026-002^FS
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
^FO40,125^FDColis 3/3 - AT-2026-003^FS
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
  { id: 'ddmrp', cat: 'planification', name: 'Buffers DDMRP', icon: Box, desc: 'Dimensionnement des buffers stratégiques.', status: 'soon' },
  { id: 'incoterms', cat: 'transport', name: 'Incoterms 2020', icon: Map, desc: 'Comparateur visuel des 11 incoterms, transferts coûts/risques sur la chaîne logistique.', status: 'live' },
  { id: 'cmr', cat: 'transport', name: 'CMR / eCMR', icon: FileText, desc: 'Lettre de voiture internationale aux normes européennes, mode papier ou électronique.', status: 'live' },
  { id: 'sla', cat: 'transport', name: 'OTIF / SLA', icon: Calculator, desc: 'Taux de service logistique.', status: 'soon' },
  { id: 'units', cat: 'utilitaires', name: 'Convertisseur', icon: Shuffle, desc: 'Unités logistiques, volumes, poids.', status: 'soon' },
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
              <div className="font-jetbrains text-[10px] text-slate-500 -mt-1 tracking-wider">SUITE D'OUTILS · v0.2 · BARKco</div>
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
              <span>L'OUTILLAGE LOGISTIQUE — ÉDITION 2026</span>
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
                  { l: 'Outils actifs', v: '6 / 9' },
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
            { k: '05', v: 'outils en ligne', d: 'sur 9 prévus' },
            { k: '04', v: 'familles', d: 'marquage, stocks, transport...' },
            { k: '100%', v: 'navigateur', d: 'aucune installation' },
            { k: '∞', v: 'usages', d: 'sans compte, sans envoi' },
          ].map((s, i) => (
            <div key={i} className={`p-6 ${i > 0 ? 'md:border-l border-slate-200' : ''} ${i === 2 || i === 3 ? 'border-t md:border-t-0 border-slate-200' : ''} ${i === 1 ? 'border-l border-slate-200' : ''}`}>
              <div className="font-bricolage text-3xl md:text-4xl font-bold mb-1" style={{ color: BLUE }}>{s.k}</div>
              <div className="font-bricolage text-base text-slate-800">{s.v}</div>
              <div className="font-jetbrains text-[10px] text-slate-500 mt-1">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-20">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            <div className="md:col-span-4">
              <div className="font-jetbrains text-xs text-slate-500 mb-3 tracking-wider">02 / PROCESSUS</div>
              <h2 className="font-bricolage font-semibold text-3xl md:text-4xl tracking-tight mb-4">
                Trois étapes,<br /><span style={{ color: BLUE }}>zéro friction.</span>
              </h2>
              <p className="text-slate-600 leading-relaxed">
                Chaque outil suit le même principe : entrée claire, traitement immédiat dans votre navigateur, sortie exploitable.
              </p>
            </div>
            <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-px bg-slate-200 border border-slate-200">
              {[
                { n: '01', t: 'Importer ou saisir', d: "Glissez un fichier (Excel, CSV, ZPL), saisissez vos paramètres ou collez du code selon l'outil." },
                { n: '02', t: 'Paramétrer', d: "Ajustez les options : format d'étiquette, taux de service, type de palette, mode de transport, granularité..." },
                { n: '03', t: 'Exporter', d: "Récupérez le résultat exploitable : PNG, PDF imprimable, fichier Excel pour vos clients, ZIP." },
              ].map((s, i) => (
                <div key={i} className="bg-white p-6">
                  <div className="font-jetbrains text-xs mb-4" style={{ color: BLUE }}>{s.n}</div>
                  <div className="font-bricolage font-semibold text-lg mb-2">{s.t}</div>
                  <div className="text-sm text-slate-600 leading-relaxed">{s.d}</div>
                </div>
              ))}
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
            <span>ATELIER LOGISTIQUE © 2026 — Outillage par BARKco</span>
          </div>
          <span>Fait à Casablanca ⵎ</span>
        </div>
      </footer>
    </div>
  );
}

function ToolCard({ tool, onLaunch }) {
  const isLive = tool.status === 'live';
  const Icon = tool.icon;
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
            background: isLive ? BLUE_LIGHT : '#F1F5F9',
            border: `1px solid ${isLive ? '#BFDBFE' : '#E2E8F0'}`,
          }}
        >
          <Icon size={17} style={{ color: isLive ? BLUE : '#94A3B8' }} strokeWidth={1.75} />
        </div>
        {isLive ? (
          <span className="font-jetbrains text-[10px] tracking-widest px-2 py-1 rounded-md" style={{ background: BLUE_LIGHT, color: BLUE }}>
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
        <div className="font-jetbrains text-xs flex items-center gap-1.5 transition-transform group-hover:translate-x-1" style={{ color: BLUE }}>
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
      <div
        className="absolute inset-0"
        style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 6px)' }}
      />
      <div className="relative w-2 h-2 bg-white rounded-sm" />
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

// --- Chargement des libs externes (bwip-js pour barcodes, jsPDF pour export PDF) ---
const loadScript = (src) => new Promise((resolve, reject) => {
  if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
  const script = document.createElement('script');
  script.src = src;
  script.onload = () => resolve();
  script.onerror = () => reject(new Error(`Échec du chargement : ${src}`));
  document.head.appendChild(script);
});

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

  // Charger les libs au montage (résilient : si jsPDF échoue, PNG reste dispo)
  useEffect(() => {
    Promise.allSettled([
      loadScript('https://cdn.jsdelivr.net/npm/bwip-js@4.5.2/dist/bwip-js-min.js'),
      loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'),
      loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'),
    ]).then((results) => {
      const bwipOk = results[0].status === 'fulfilled' && window.bwipjs;
      const pdfOk = results[1].status === 'fulfilled' && window.jspdf;
      const zipOk = results[2].status === 'fulfilled' && window.JSZip;
      if (!bwipOk) {
        setLibsError("Le module de rendu des codes-barres n'a pas pu être chargé. Vérifiez votre connexion.");
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
    example: 'ATELIER-2026-001',
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
    example: '(00)373500001234567890',
    placeholder: '(00)... (01)... (10)... etc.',
    validate: (d) => d.length > 0
      ? { ok: true, msg: 'OK · vérifiez la syntaxe des AI (parenthèses)' }
      : { ok: false, msg: 'Données requises' },
  },
  // 2D
  {
    id: 'qrcode', label: 'QR Code', bcid: 'qrcode', cat: '2d',
    desc: 'Universel · URLs, vCards, jusqu\'à ~4000 caractères. Lecture smartphone.',
    example: 'https://atelier.barkco.ma/colis/AT-2026-001',
    placeholder: 'URL, texte, ou données structurées',
    validate: (d) => d.length > 0
      ? { ok: true, msg: `OK · ${d.length} caractères` }
      : { ok: false, msg: 'Données requises' },
  },
  {
    id: 'datamatrix', label: 'Data Matrix', bcid: 'datamatrix', cat: '2d',
    desc: 'Compact 2D · industrie, pharma (GS1 DataMatrix), pièces marquées laser.',
    example: 'AT-2026-001-LOT-A',
    placeholder: 'Données alphanumériques',
    validate: (d) => d.length > 0
      ? { ok: true, msg: `OK · ${d.length} caractères` }
      : { ok: false, msg: 'Données requises' },
  },
  {
    id: 'pdf417', label: 'PDF417', bcid: 'pdf417', cat: '2d',
    desc: 'Étiquettes complexes 2D linéaire · expédition (UPS), permis de conduire.',
    example: 'ATELIER LOGISTIQUE - COLIS AT-2026-001 - CASABLANCA',
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

  const [preview, setPreview] = useState(null);
  const [pngBlob, setPngBlob] = useState(null);
  const [svgString, setSvgString] = useState(null);
  const [previewDims, setPreviewDims] = useState(null);

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState(null);

  const [libsReady, setLibsReady] = useState(false);
  const [pdfAvailable, setPdfAvailable] = useState(false);
  const [libsError, setLibsError] = useState(null);

  const currentType = BARCODE_TYPES.find(t => t.id === typeId);
  const validation = currentType.validate(data);

  // Chargement des libs (bwip-js requis, jsPDF optionnel)
  useEffect(() => {
    Promise.allSettled([
      loadScript('https://cdn.jsdelivr.net/npm/bwip-js@4.5.2/dist/bwip-js-min.js'),
      loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'),
    ]).then((results) => {
      const bwipOk = results[0].status === 'fulfilled' && window.bwipjs;
      const pdfOk = results[1].status === 'fulfilled' && window.jspdf;
      if (!bwipOk) {
        setLibsError("Le module de rendu des codes-barres n'a pas pu être chargé.");
        return;
      }
      setLibsReady(true);
      setPdfAvailable(pdfOk);
    });
  }, []);

  // Quand on change de type, pré-remplir l'exemple
  useEffect(() => {
    setData(currentType.example);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId]);

  // Auto-rendu avec debounce 250ms
  useEffect(() => {
    if (!libsReady) return;
    if (!validation.ok) { setError(null); return; }
    setError(null);
    const t = setTimeout(() => { render(); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libsReady, typeId, data, scale, heightMM, includeText, rotation]);

  const render = async () => {
    if (!libsReady || !validation.ok) return;
    setLoading(true);
    try {
      const canvas = document.createElement('canvas');
      const opts = {
        bcid: currentType.bcid,
        text: data,
        scale: scale,
        includetext: includeText,
        textxalign: 'center',
        backgroundcolor: 'FFFFFF',
      };
      // Hauteur des barres uniquement pour les 1D
      if (!['qrcode', 'datamatrix'].includes(currentType.bcid)) {
        opts.height = heightMM;
      }
      // Rotation
      if (rotation === 90) opts.rotate = 'R';
      else if (rotation === 180) opts.rotate = 'I';
      else if (rotation === 270) opts.rotate = 'L';

      window.bwipjs.toCanvas(canvas, opts);

      const dataUrl = canvas.toDataURL('image/png');
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      const svg = window.bwipjs.toSVG ? window.bwipjs.toSVG(opts) : null;

      if (preview) URL.revokeObjectURL(preview);
      setPreview(dataUrl);
      setPngBlob(blob);
      setSvgString(svg);
      setPreviewDims({ w: canvas.width, h: canvas.height });
    } catch (e) {
      setError('Erreur de génération : ' + (e.message || 'données invalides pour ce type'));
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
                  rows={3}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md outline-none resize-none font-jetbrains text-sm text-slate-800 focus:border-slate-400 transition-colors"
                  placeholder={currentType.placeholder}
                  spellCheck={false}
                />
                <div
                  className={`mt-2.5 text-xs font-jetbrains flex items-start gap-1.5 ${validation.ok ? 'text-emerald-600' : 'text-red-500'}`}
                >
                  {validation.ok ? <Check size={12} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />}
                  <span>{validation.msg}</span>
                </div>
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
                  {previewDims && (
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
  D:     ['d', 'demande', 'demande moyenne', 'demande moy', 'demande/jour', 'demand', 'mean demand'],
  sD:    ['sd', 'σd', 'sigma d', 'ecart-type demande', 'écart-type demande', 'std demande', 'std', 'sigma demand'],
  L:     ['l', 'lead time', 'délai', 'delai', 'lt', 'leadtime'],
  sL:    ['sl', 'σl', 'sigma l', 'ecart-type lt', 'écart-type lt', 'std lt', 'écart-type délai', 'sigma lead time'],
  sl:    ['taux de service', 'service level', 'service', 'taux de service %', 'taux service', 'sl%'],
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
  const wanted = new Set(aliases.map(normalizeKey));
  for (const key of Object.keys(row)) {
    if (wanted.has(normalizeKey(key))) return row[key];
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
  { 'Référence': 'A001', 'Libellé': 'Article exemple 1', 'Demande moyenne': 100, 'Ecart-type demande': 20, 'Lead time': 5, 'Ecart-type LT': 1, 'Taux de service (%)': 95 },
  { 'Référence': 'A002', 'Libellé': 'Article exemple 2', 'Demande moyenne': 50,  'Ecart-type demande': 10, 'Lead time': 7, 'Ecart-type LT': 2, 'Taux de service (%)': 99 },
  { 'Référence': 'A003', 'Libellé': 'Article exemple 3', 'Demande moyenne': 200, 'Ecart-type demande': 30, 'Lead time': 3, 'Ecart-type LT': 0.5, 'Taux de service (%)': 90 },
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
              style={importMsg.type === 'success'
                ? { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }
                : { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
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

function CellInput({ value, onChange, type = 'text', align = 'left', mono = false, step }) {
  return (
    <input
      type={type}
      value={value}
      step={step}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      className={`w-full bg-transparent outline-none px-1.5 py-1 rounded focus:bg-white focus:ring-1 focus:ring-slate-300 transition-all ${align === 'right' ? 'text-right' : ''} ${mono ? 'font-jetbrains' : ''} text-slate-800`}
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

  // jsPDF loading
  const [pdfLibReady, setPdfLibReady] = useState(false);
  useEffect(() => {
    if (window.jspdf) { setPdfLibReady(true); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    s.onload = () => setPdfLibReady(true);
    s.onerror = () => setPdfLibReady(false);
    document.head.appendChild(s);
  }, []);

  // bwip-js loading for QR code (mode eCMR)
  const [bwipReady, setBwipReady] = useState(false);
  useEffect(() => {
    if (window.bwipjs) { setBwipReady(true); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/bwip-js@4.5.2/dist/bwip-js-min.js';
    s.onload = () => setBwipReady(true);
    s.onerror = () => setBwipReady(false);
    document.head.appendChild(s);
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
    doc.text(`Document généré par Atelier Logistique — BARKco · ${new Date().toLocaleString('fr-FR')}`, M, H - 2);
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
                <textarea rows="2" value={attachedDocs} onChange={e => setAttachedDocs(e.target.value)} placeholder="ex : facture commerciale n°2026-001, certificat d'origine, packing list"
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
