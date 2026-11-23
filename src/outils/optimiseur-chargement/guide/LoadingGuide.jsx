// Guide cariste : plan de chargement pas à pas sur téléphone, ouvert depuis un QR code.
// Le plan est dans l'URL (#…) : aucune donnée envoyée au serveur. Progression mémorisée sur le téléphone.

import { useEffect, useMemo, useState, lazy, Suspense, Component } from 'react';
import { ChevronLeft, ChevronRight, Check, Camera, Share2, RotateCcw, Loader2, Truck } from 'lucide-react';
import { decodePlan } from './planLink';
import { refColor, stopColor } from '../uiHelpers';
import { t, numLocale } from '../../../shared/i18n/core';

const LoadView3D = lazy(() => import('../LoadView3D.jsx'));
const BLUE = '#2563EB';
const AMBER = '#F59E0B';
const CURRENT = { solid: AMBER, light: '#FDE68A', dark: '#B45309', edge: '#B45309' };

class Boundary extends Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const m = (mm) => (mm / 1000).toLocaleString(numLocale(), { maximumFractionDigits: 1 });
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

/** Position lisible pour le cariste (vu depuis les portes, tourné vers la cabine). */
function where(it, W) {
  const cy = it.y + it.w / 2;
  const side = cy < W / 3 ? t('à droite') : cy > (2 * W) / 3 ? t('à gauche') : t('au centre');
  const level = it.z < 10 ? t('au sol') : t('en hauteur (sur {v1} m)', { v1: m(it.z) });
  return t('{v1} m depuis la cabine · {side} · {level}', { v1: m(it.x), side: side, level: level });
}

/**
 * Sans props : plan lu dans l'adresse (#…), lien du QR code des outils publics.
 * Avec payload : plan fourni par la page (lien permanent /q/… de l'espace) ; notice = bandeau d'information (warn : en orange).
 */
export default function LoadingGuide({ payload: given = null, notice = null, warn = false }) {
  const payload = given ?? (typeof window !== 'undefined' ? window.location.hash.slice(1) : '');
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const key = `al_guide_${hash(payload)}`;
  // Position = index du prochain colis à charger (indépendant du mode colis / mur).
  const [pos, setPos] = useState(() => { try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; } });
  const [byWall, setByWall] = useState(false);
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = t('Guide de chargement | Atelier Logistique');
    const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex'; document.head.appendChild(robots);
    return () => { document.title = prevTitle; robots.remove(); };
  }, []);

  useEffect(() => {
    if (!payload) { setError(t('Aucun plan dans ce lien. Scannez le QR code de la fiche de chargement.')); return; }
    decodePlan(payload).then((p) => { setPlan(p); if (p.items.length > 40) setByWall(true); }).catch(() => setError(t('Ce lien de chargement est incomplet ou abîmé.')));
  }, [payload]);

  // Étapes : un colis par étape, ou un mur entier par étape (gros chargements).
  const steps = useMemo(() => {
    if (!plan) return [];
    if (!byWall) return plan.items.map((it, i) => ({ from: i, to: i + 1 }));
    const out = [];
    plan.items.forEach((it, i) => {
      const last = out[out.length - 1];
      if (last && plan.items[last.from].wall === it.wall) last.to = i + 1; else out.push({ from: i, to: i + 1 });
    });
    return out;
  }, [plan, byWall]);

  const total = steps.length;
  const nItems = plan?.items.length ?? 0;
  const done = total > 0 && pos >= nItems;
  const cur = done ? total : Math.max(0, steps.findIndex((st) => pos >= st.from && pos < st.to));
  useEffect(() => { try { localStorage.setItem(key, String(pos)); } catch { /* stockage indisponible */ } }, [key, pos]);
  const next = () => { if (!done) setPos(steps[cur].to); };
  const back = () => { if (cur > 0) setPos(steps[cur - 1].from); };
  const restart = () => setPos(0);
  const toggleMode = () => setByWall((b) => !b);

  const refIdx = useMemo(() => (plan ? Object.fromEntries([...new Set(plan.items.map((i) => i.ref))].map((r, i) => [r, i])) : {}), [plan]);
  const current = !done && steps[cur] ? steps[cur] : null;
  const shownCount = current ? current.to : plan?.items.length ?? 0;

  const placed = useMemo(() => (plan ? plan.items.slice(0, shownCount).map((it, i) => ({
    id: `g${i}`, definitionId: it.ref, reference: it.ref, x: it.x, y: it.y, z: it.z, length: it.l, width: it.w, height: it.h,
    stop: it.stop, wall: it.wall, sequence: i + 1, weight: 0, stackable: true, originalLength: it.l, originalWidth: it.w, originalHeight: it.h,
    rotation: { x: 0, y: 0, z: 0 }, current: current ? i >= current.from : false,
  })) : []), [plan, shownCount, current]);
  const container = plan ? { id: 'guide', label: plan.label, length: plan.container.length, width: plan.container.width, height: plan.container.height, maxWeight: null } : null;
  const colorOf = (p) => (p.current ? CURRENT : refColor(refIdx[p.reference] ?? 0));

  const share = async () => {
    if (!photo) return;
    try {
      if (navigator.canShare?.({ files: [photo.file] })) await navigator.share({ files: [photo.file], title: t('Camion chargé'), text: t('Chargement terminé : {label}, {length} colis', { label: plan.label, length: plan.items.length }) });
      else { const a = document.createElement('a'); a.href = photo.url; a.download = photo.file.name; a.click(); }
    } catch { /* partage annulé */ }
  };

  if (error) return <div className="min-h-screen flex items-center justify-center p-6 text-center text-slate-700" style={{ fontFamily: "'DM Sans', system-ui" }}><div><Truck className="mx-auto mb-3 text-slate-400" />{error}</div></div>;
  if (!plan) return <div className="min-h-screen flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;

  const items = current ? plan.items.slice(current.from, current.to) : [];
  const first = items[0];
  const stopCol = first ? stopColor(first.stop) : null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-jetbrains text-[10px] text-slate-500">{t('GUIDE DE CHARGEMENT')}</div>
            <div className="font-bricolage font-semibold text-sm truncate">{t('{label} · {length} colis', { label: plan.label, length: plan.items.length })}</div>
          </div>
          <button onClick={toggleMode} className="shrink-0 font-jetbrains text-[11px] px-2.5 py-1.5 rounded-md bg-slate-100 text-slate-600">{byWall ? t('Colis par colis') : t('Mur par mur')}</button>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${(cur / Math.max(1, total)) * 100}%`, background: done ? '#10B981' : BLUE }} /></div>
        {notice && <div className="mt-2 rounded-md px-2.5 py-1.5 text-[11px]" style={warn ? { background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A' } : { background: '#F1F5F9', color: '#475569' }}>{notice}</div>}
        <div className="mt-1 font-jetbrains text-[10px] text-slate-500">{done ? t('Terminé') : (byWall ? t('Mur {n} / {total}', { n: cur + 1, total }) : t('Colis {n} / {total}', { n: cur + 1, total }))}</div>
      </header>

      <div className="relative bg-white" style={{ height: '42vh', minHeight: 260 }}>
        <Boundary fallback={<div className="h-full flex items-center justify-center text-sm text-slate-500 px-6 text-center">{t('Vue 3D indisponible sur ce téléphone : suivez les indications ci-dessous.')}</div>}>
          <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>}>
            <LoadView3D container={container} placed={placed} colorOf={colorOf} isDimmed={(p) => !!current && !p.current} blockedIds={null} onHover={() => {}} cameraScale={0.75} />
          </Suspense>
        </Boundary>
      </div>

      <main className="flex-1 px-4 py-4 pb-32 space-y-3">
        {!done && first && (
          <div className="rounded-xl bg-white border-2 p-4" style={{ borderColor: AMBER }}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-bricolage font-bold text-xl">{items.length > 1 ? t('{length} colis', { length: items.length }) : (first.unitId || first.ref)}</div>
              <span className="font-jetbrains text-[11px] px-2 py-1 rounded-md text-white" style={{ background: stopCol.solid }}>{t('Arrêt {stop}', { stop: first.stop })}</span>
            </div>
            {items.length === 1 && first.unitId && <div className="text-sm text-slate-600">{first.ref}</div>}
            {first.destination && <div className="text-sm text-slate-600">{first.destination}</div>}
            <div className="mt-2 text-sm text-slate-800">{items.length > 1 ? t('Mur {wall} · à partir de {v1} m depuis la cabine', { wall: first.wall, v1: m(first.x) }) : where(first, plan.container.width)}</div>
            {items.length > 1 && (
              <ul className="mt-2 text-xs text-slate-600 space-y-0.5 max-h-28 overflow-y-auto">
                {Object.entries(items.reduce((acc, i) => { acc[i.ref] = (acc[i.ref] ?? 0) + 1; return acc; }, {})).map(([r, n]) => <li key={r}>{r} × {n}</li>)}
              </ul>
            )}
            <div className="mt-1 font-jetbrains text-[11px] text-slate-500">{t('{v1}en orange sur la vue', { v1: items.length === 1 ? `${m(first.l)} × ${m(first.w)} × ${m(first.h)} m · ` : '' })}</div>
          </div>
        )}

        {done && (
          <div className="rounded-xl bg-white border-2 border-green-500 p-4 space-y-3">
            <div className="flex items-center gap-2 font-bricolage font-bold text-xl text-green-700"><Check />{' '}{t('Chargement terminé')}</div>
            <div className="text-sm text-slate-600">{t('Prenez une photo du camion chargé, portes ouvertes, comme preuve de chargement.')}</div>
            <label className="flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-white cursor-pointer" style={{ background: BLUE }}>
              <Camera size={18} /> {photo ? t('Reprendre la photo') : t('Prendre une photo')}
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhoto({ file: f, url: URL.createObjectURL(f) }); }} />
            </label>
            {photo && (
              <>
                <img src={photo.url} alt={t('Camion chargé')} className="w-full rounded-lg border border-slate-200" />
                <button onClick={share} className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold bg-slate-900 text-white"><Share2 size={18} />{' '}{t('Envoyer la photo')}</button>
              </>
            )}
            <button onClick={() => { restart(); setPhoto(null); }} className="w-full flex items-center justify-center gap-2 py-2 text-sm text-slate-500"><RotateCcw size={14} />{' '}{t('Recommencer')}</button>
          </div>
        )}
        <p className="text-center font-jetbrains text-[10px] text-slate-400">{t('atelierlogistique.com · plan conservé sur ce téléphone')}</p>
      </main>

      {!done && (
        <div className="fixed inset-x-0 bottom-0 bg-white border-t border-slate-200 px-4 py-3 flex gap-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button onClick={back} disabled={cur === 0} className="w-1/3 flex items-center justify-center gap-1 py-4 rounded-xl bg-slate-100 text-slate-700 font-semibold disabled:opacity-40"><ChevronLeft size={18} />{' '}{t('Retour')}</button>
          <button onClick={next} className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-white font-bold text-lg" style={{ background: '#10B981' }}><Check size={20} />{' '}{t('Chargé')}{' '}<ChevronRight size={18} /></button>
        </div>
      )}
    </div>
  );
}
