// Invitations à créer un compte, sans bloquer l'usage libre des outils :
//  - useSignupGate : avant d'ouvrir un outil depuis une page d'accueil, propose l'espace gratuit
//    (« Créer mon espace » / « Non, continuer sans compte »), une fois par session de navigation ;
//  - SignupNudge : après un premier résultat dans un outil public, un encart discret
//    « Enregistrez ce plan », au plus une fois par session et tous les 3 jours après « Plus tard ».
// Jamais affichés à un utilisateur déjà connecté dans ce navigateur. Textes : dictionnaire du compte.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CheckCircle2, ArrowRight, Sparkles, Save } from 'lucide-react';
import { t as tr, getCurrentLang } from '../i18n/core';
import { accountEnabled, hasStoredSession } from './supabase';

const BLUE = '#2563EB';
const AMBER = '#F59E0B';
const NAVY = '#0F172A';
const SKIP_KEY = 'al.signup.skip';
const NUDGE_DAYS = 3;

/** Lien d'inscription dans la langue de la page. */
export const signupHref = () => `/connexion?mode=inscription${getCurrentLang() === 'en' ? '&lang=en' : ''}`;
const loginHref = () => `/connexion${getCurrentLang() === 'en' ? '?lang=en' : ''}`;

const session = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* navigation privée */ } },
};
const local = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* navigation privée */ } },
};
const shouldInvite = () => accountEnabled && !hasStoredSession();

const BENEFITS = () => [
  tr('Vos chargements et palettisations enregistrés, retrouvés partout'),
  tr('Vos véhicules, transporteurs et grilles tarifaires'),
  tr('Coût transport de chaque départ et contrôle des factures'),
  tr('QR code cariste permanent, calendrier et travail en équipe'),
];

function Benefits() {
  return (
    <ul className="space-y-2">
      {BENEFITS().map((b) => (
        <li key={b} className="flex gap-2 text-sm text-slate-700"><CheckCircle2 size={17} className="shrink-0 mt-0.5" style={{ color: '#10B981' }} />{b}</li>
      ))}
    </ul>
  );
}

/** Fenêtre « Créez votre espace » avant d'ouvrir un outil. */
function SignupGateModal({ onContinue, onClose }) {
  const navigate = useNavigate();
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={tr('Créez votre espace gratuit')}>
      <style>{'@keyframes sp-in{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}.sp-in{animation:sp-in .35s cubic-bezier(.2,.8,.2,1) both}@media (prefers-reduced-motion: reduce){.sp-in{animation:none}}'}</style>
      <button type="button" aria-label={tr('Fermer')} onClick={onClose} className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" />
      <div className="sp-in relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${BLUE}, ${AMBER})` }} />
        <button type="button" onClick={onClose} aria-label={tr('Fermer')} className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-700"><X size={18} /></button>
        <div className="p-6 sm:p-7">
          <span className="inline-flex items-center gap-1.5 font-jetbrains text-[10px] tracking-widest px-2 py-1 rounded-full" style={{ background: '#FEF3C7', color: '#B45309' }}>
            <Sparkles size={12} /> {tr('GRATUIT PENDANT LA PHASE PILOTE')}
          </span>
          <h2 className="font-bricolage font-bold text-2xl text-slate-900 mt-3">{tr('Créez votre espace gratuit')}</h2>
          <p className="text-sm text-slate-500 mt-1">{tr('30 secondes, juste votre adresse e-mail.')}</p>
          <div className="mt-5"><Benefits /></div>
          <button type="button" onClick={() => navigate(signupHref())}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-jetbrains text-sm font-semibold shadow-lg transition-transform hover:-translate-y-0.5" style={{ background: AMBER, color: NAVY }}>
            {tr('CRÉER MON ESPACE GRATUIT')} <ArrowRight size={15} />
          </button>
          <button type="button" onClick={onContinue} className="mt-2 w-full rounded-lg px-4 py-2.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50">
            {tr('Non, continuer sans compte')}
          </button>
          <p className="mt-3 text-xs text-slate-400 text-center">{tr('Sans compte, les fonctionnalités sont réduites : les calculs marchent, mais rien n’est enregistré. Idéal pour tester.')}</p>
          <p className="mt-2 text-xs text-slate-500 text-center">{tr('Déjà un compte ?')} <a href={loginHref()} className="font-medium hover:underline" style={{ color: BLUE }}>{tr('Se connecter')}</a></p>
        </div>
      </div>
    </div>
  );
}

/**
 * Avant d'ouvrir un outil : ask(href) affiche l'invitation (sauf utilisateur connecté, ou « continuer
 * sans compte » déjà choisi dans cette session), puis ouvre l'outil. node : la fenêtre à rendre.
 */
export function useSignupGate() {
  const navigate = useNavigate();
  const [target, setTarget] = useState(null);
  const go = useCallback((href) => (href.startsWith('/') ? navigate(href) : window.location.assign(href)), [navigate]);
  const ask = useCallback((href) => {
    if (!shouldInvite() || session.get(SKIP_KEY)) { go(href); return; }
    setTarget(href);
  }, [go]);
  const node = target ? (
    <SignupGateModal onClose={() => setTarget(null)} onContinue={() => { session.set(SKIP_KEY, '1'); const h = target; setTarget(null); go(h); }} />
  ) : null;
  return { ask, node };
}

/**
 * Encart discret après un premier résultat dans un outil public (id : outil, show : résultat prêt).
 * Au plus une fois par session, et pas avant 3 jours après « Plus tard ».
 */
export function SignupNudge({ id, show }) {
  const [open, setOpen] = useState(false);
  const key = `al.nudge.${id}`;
  useEffect(() => {
    if (!show || !shouldInvite() || session.get(key)) return undefined;
    const last = Number(local.get(key) || 0);
    if (last && Date.now() - last < NUDGE_DAYS * 864e5) return undefined;
    const tm = setTimeout(() => { setOpen(true); session.set(key, '1'); }, 2500);
    return () => clearTimeout(tm);
  }, [show, key]);
  if (!open) return null;
  const later = () => { local.set(key, String(Date.now())); setOpen(false); };
  return (
    <div className="fixed z-[65] bottom-4 left-4 right-4 sm:right-auto sm:w-[370px] print:hidden" role="dialog" aria-label={tr('Enregistrez ce résultat')}>
      <style>{'@keyframes sn-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}.sn-in{animation:sn-in .4s ease-out both}@media (prefers-reduced-motion: reduce){.sn-in{animation:none}}'}</style>
      <div className="sn-in rounded-2xl bg-white border border-slate-200 shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#EFF6FF', color: BLUE }}><Save size={18} /></span>
          <div className="min-w-0">
            <div className="font-bricolage font-semibold text-slate-900">{tr('Enregistrez ce résultat')}</div>
            <p className="text-sm text-slate-600 mt-0.5">{tr('Sans compte, il reste seulement dans ce navigateur. Avec votre espace gratuit : historique, transporteurs, coût du transport et QR code cariste permanent.')}</p>
          </div>
          <button type="button" onClick={later} aria-label={tr('Plus tard')} className="ml-auto -mt-1 -mr-1 p-1 text-slate-400 hover:text-slate-700"><X size={16} /></button>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button type="button" onClick={later} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800">{tr('Plus tard')}</button>
          <a href={signupHref()} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold" style={{ background: AMBER, color: NAVY }}>
            {tr('Créer mon espace')} <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
