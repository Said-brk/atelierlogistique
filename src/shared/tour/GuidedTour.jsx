import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { readTour, writeTour, shouldOffer, snooze } from './tourStore';

/**
 * Visite guidée réutilisable : invitation discrète, puis bulles pas à pas sur les éléments marqués.
 *
 * id         : identifiant de la visite (mémoire navigateur : terminée, refusée, rappel dans 24 h).
 * steps      : [{ target: '[data-tour="x"]' | [sélecteurs…], title, body, action?: { label, run, disabled } }]
 *              Une étape dont la cible est absente est sautée ; après une action, on attend sa cible (calcul en cours).
 * labels     : textes (déjà traduits) — introTitle, introBody, start, later, never, next, finish, waiting, of.
 * enabled    : false → rien ne s'affiche (ex. chargement verrouillé).
 * restartKey : nombre ; le changer relance la visite (bouton « Visite guidée »).
 * onEvent    : (nom) → suivi d'usage facultatif.
 */
const BLUE = '#2563EB';
const AMBER = '#F59E0B';
const POPOVER_W = 340;
const WAIT_AFTER_ACTION = 15000;

const CSS = `
@keyframes gt-in { from { opacity: 0; transform: translateY(12px) scale(.98) } to { opacity: 1; transform: none } }
@keyframes gt-ring { 0%,100% { box-shadow: 0 0 0 2px ${AMBER}, 0 0 0 9999px rgba(15,23,42,.55) } 50% { box-shadow: 0 0 0 6px rgba(245,158,11,.45), 0 0 0 9999px rgba(15,23,42,.55) } }
.gt-in { animation: gt-in .45s cubic-bezier(.2,.8,.2,1) both }
.gt-ring { animation: gt-ring 1.8s ease-in-out infinite }
.gt-move { transition: top .35s ease, left .35s ease, width .35s ease, height .35s ease }
@media (prefers-reduced-motion: reduce) { .gt-in, .gt-ring { animation: none } .gt-move { transition: none } .gt-ring { box-shadow: 0 0 0 2px ${AMBER}, 0 0 0 9999px rgba(15,23,42,.55) } }
`;

function findTarget(target) {
  for (const sel of [].concat(target)) {
    const el = document.querySelector(sel);
    if (el) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return el; }
  }
  return null;
}

export default function GuidedTour({ id, steps, labels, enabled = true, restartKey = 0, onEvent }) {
  const [phase, setPhase] = useState('idle'); // idle | intro | tour
  const [index, setIndex] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0); // > 0 : on attend la cible (après une action)
  const [rect, setRect] = useState(null);
  const elRef = useRef(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const ev = useCallback((n) => { try { onEventRef.current?.(n); } catch { /* suivi facultatif */ } }, []);

  // Invitation automatique, en douceur, si la visite n'a jamais été faite (ou rappel échu).
  useEffect(() => {
    if (!enabled || !shouldOffer(readTour(id))) return undefined;
    const t = setTimeout(() => {
      if (!shouldOffer(readTour(id))) return;
      setPhase((p) => (p === 'idle' ? 'intro' : p)); ev('tour_offered');
    }, 1400);
    return () => clearTimeout(t);
  }, [id, enabled, ev]);

  // Relance manuelle.
  const firstRestart = useRef(restartKey);
  useEffect(() => {
    if (restartKey === firstRestart.current) return;
    setIndex(0); setWaitUntil(0); setPhase('tour'); ev('tour_restarted');
  }, [restartKey, ev]);

  useEffect(() => { if (!enabled) setPhase('idle'); }, [enabled]);

  const end = useCallback((state, evt) => {
    writeTour(id, state);
    setPhase('idle'); setRect(null); elRef.current = null;
    ev(evt);
  }, [id, ev]);

  const step = phase === 'tour' ? steps[index] : null;
  const last = index >= steps.length - 1;

  const next = useCallback((wait = false) => {
    if (index >= steps.length - 1) { end({ state: 'done' }, 'tour_completed'); return; }
    setIndex((i) => i + 1);
    setWaitUntil(wait ? Date.now() + WAIT_AFTER_ACTION : 0);
  }, [index, steps.length, end]);

  // Cible de l'étape : trouvée tout de suite, attendue après une action, sinon étape sautée.
  useEffect(() => {
    if (!step) return undefined;
    let timer;
    const look = () => {
      const el = findTarget(step.target);
      if (el) {
        elRef.current = el; setWaitUntil(0);
        el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        return;
      }
      elRef.current = null; setRect(null);
      if (waitUntil && Date.now() < waitUntil) { timer = setTimeout(look, 250); return; }
      next();
    };
    look();
    return () => clearTimeout(timer);
  }, [step, waitUntil, next]);

  // Suit la cible (défilement, redimensionnement, mise en page qui bouge).
  useLayoutEffect(() => {
    if (phase !== 'tour') return undefined;
    let raf;
    const tick = () => {
      const el = elRef.current;
      if (el && el.isConnected) {
        const r = el.getBoundingClientRect();
        setRect((p) => (p && p.top === r.top && p.left === r.left && p.width === r.width && p.height === r.height ? p : { top: r.top, left: r.left, width: r.width, height: r.height }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase === 'idle') return undefined;
    const onKey = (e) => { if (e.key === 'Escape') end(phase === 'tour' ? { state: 'done' } : snooze(), 'tour_closed'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, end]);

  if (phase === 'idle') return null;

  // ---------- Invitation ----------
  if (phase === 'intro') {
    return (
      <div className="fixed z-[70] bottom-4 right-4 left-4 sm:left-auto sm:w-[360px] gt-in" role="dialog" aria-label={labels.introTitle}>
        <style>{CSS}</style>
        <div className="rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${BLUE}, ${AMBER})` }} />
          <div className="p-5">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#FEF3C7', color: '#B45309' }}><Sparkles size={18} /></span>
              <div className="min-w-0">
                <div className="font-bricolage font-semibold text-slate-900">{labels.introTitle}</div>
                <p className="text-sm text-slate-600 mt-1">{labels.introBody}</p>
              </div>
              <button onClick={() => end(snooze(), 'tour_snoozed')} className="ml-auto -mt-1 -mr-1 p-1 text-slate-400 hover:text-slate-700" aria-label={labels.later}><X size={16} /></button>
            </div>
            <button onClick={() => { setIndex(0); setWaitUntil(0); setPhase('tour'); ev('tour_started'); }}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-white text-sm" style={{ background: BLUE }}>
              {labels.start} <ArrowRight size={15} />
            </button>
            <div className="mt-2 flex items-center justify-between font-jetbrains text-[11px]">
              <button onClick={() => end(snooze(), 'tour_snoozed')} className="text-slate-600 hover:text-slate-900 py-1">{labels.later}</button>
              <button onClick={() => end({ state: 'never' }, 'tour_never')} className="text-slate-400 hover:text-slate-700 py-1">{labels.never}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Étape ----------
  const pad = 6;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = vw < 640;
  const w = Math.min(POPOVER_W, vw - 24);
  let pos;
  if (!rect || mobile) {
    pos = { left: 12, right: 12, bottom: 12 };
  } else {
    const below = rect.top + rect.height + pad + 12;
    const placeBelow = below + 220 < vh || rect.top < 240;
    const left = Math.max(12, Math.min(rect.left + rect.width / 2 - w / 2, vw - w - 12));
    pos = placeBelow ? { left, top: Math.min(below, vh - 230), width: w } : { left, bottom: vh - rect.top + pad + 12, width: w };
  }
  const waiting = !rect;

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none" aria-live="polite">
      <style>{CSS}</style>
      {rect
        ? <div className="fixed rounded-xl gt-ring gt-move" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
        : <div className="fixed inset-0" style={{ background: 'rgba(15,23,42,.35)' }} />}
      <div key={index} role="dialog" aria-label={step?.title} className="fixed pointer-events-auto gt-in rounded-2xl bg-white shadow-2xl border border-slate-200 p-4" style={pos}>
        <div className="flex items-center gap-2 font-jetbrains text-[10px] text-slate-400">
          <span className="flex gap-1">{steps.map((_, i) => <span key={i} className="h-1 rounded-full transition-all" style={{ width: i === index ? 16 : 6, background: i <= index ? AMBER : '#E2E8F0' }} />)}</span>
          <span>{index + 1} {labels.of} {steps.length}</span>
          <button onClick={() => end({ state: 'done' }, 'tour_closed')} className="ml-auto p-1 -mr-1 text-slate-400 hover:text-slate-700" aria-label={labels.never}><X size={15} /></button>
        </div>
        {waiting ? (
          <div className="flex items-center gap-2 text-sm text-slate-600 py-3"><Loader2 size={16} className="animate-spin" style={{ color: BLUE }} />{labels.waiting}</div>
        ) : (<>
          <div className="font-bricolage font-semibold text-slate-900 mt-1.5">{step.title}</div>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">{step.body}</p>
          <div className="mt-3 flex items-center justify-end gap-2">
            {step.action && !step.action.disabled ? (<>
              <button onClick={() => next()} className="font-jetbrains text-[11px] text-slate-500 hover:text-slate-800 px-2 py-2">{last ? labels.finish : labels.next}</button>
              <button onClick={() => { ev(`tour_action_${index + 1}`); step.action.run(); next(true); }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold" style={{ background: AMBER, color: '#0F172A' }}>
                {step.action.label} <ArrowRight size={14} />
              </button>
            </>) : (
              <button onClick={() => next()} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: BLUE }}>
                {last ? labels.finish : labels.next} {!last && <ArrowRight size={14} />}
              </button>
            )}
          </div>
        </>)}
      </div>
    </div>
  );
}
