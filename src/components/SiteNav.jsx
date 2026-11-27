// Menu principal (en-tête) : liens simples sur ordinateur, menu burger sur mobile.
// Données : src/seo/nav.js (mêmes liens que les articles statiques et le HTML pré-rendu).

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, UserRound, ArrowRight } from 'lucide-react';
import { accountEnabled, hasStoredSession } from '../shared/account/supabase';
import { NAV_LINKS, NAV_LINKS_EN } from '../seo/nav';

function NavLink({ href, className, children, onClick, style }) {
  // Page interne : navigation sans rechargement ; ancre, mailto ou page statique (/en/…) : lien classique.
  if (href.startsWith('/') && !href.includes('#') && !href.startsWith('/en')) return <Link to={href} className={className} onClick={onClick} style={style}>{children}</Link>;
  return <a href={href} className={className} onClick={onClick} style={style}>{children}</a>;
}

/** compact : variante pour la barre des pages outils. L'en-tête parent doit être positionné (sticky ou relative). */
export default function SiteNav({ compact = false, lang = 'fr' }) {
  const links = lang === 'en' ? NAV_LINKS_EN : NAV_LINKS;
  // Compte (si configuré) : « Mon espace » si une session existe dans ce navigateur,
  // sinon « Se connecter » + bouton « Créer mon espace » (visible aussi sur mobile).
  const en = lang === 'en';
  const q = en ? '&lang=en' : '';
  const logged = accountEnabled && hasStoredSession();
  const account = !accountEnabled ? null
    : logged ? { href: '/app', label: en ? 'My workspace' : 'Mon espace' }
    : { href: '/connexion' + (en ? '?lang=en' : ''), label: en ? 'Sign in' : 'Se connecter' };
  const signup = accountEnabled && !logged
    ? { href: '/connexion?mode=inscription' + q, label: en ? 'Create my free space' : 'Créer mon espace', short: en ? 'Sign up' : "S'inscrire" }
    : null;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, []);

  return (
    <div ref={ref} className="flex items-center">
      <div className={`hidden md:flex items-center ${compact ? 'gap-4' : 'gap-6'} font-jetbrains text-xs text-slate-600`}>
        {links.map((l) => <NavLink key={l.href} href={l.href} className="hover:text-slate-900 transition-colors">{l.label}</NavLink>)}
        {account && (
          <NavLink href={account.href} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-300 text-slate-700 hover:text-slate-900 hover:border-slate-400">
            <UserRound size={12} />{account.label}
          </NavLink>
        )}
        {signup && (
          <NavLink href={signup.href} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold shadow-sm hover:brightness-105" style={{ background: '#F59E0B', color: '#0F172A' }}>
            {signup.label}<ArrowRight size={12} />
          </NavLink>
        )}
      </div>
      {/* Mobile : le bouton d'inscription reste visible à côté du menu */}
      {signup && (
        <NavLink href={signup.href} className="md:hidden mr-2 inline-flex items-center h-10 px-2.5 rounded-md font-jetbrains text-[11px] font-semibold whitespace-nowrap" style={{ background: '#F59E0B', color: '#0F172A' }}>
          {signup.short}
        </NavLink>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-label={lang === 'en' ? (open ? 'Close menu' : 'Open menu') : (open ? 'Fermer le menu' : 'Ouvrir le menu')} aria-expanded={open}
        className="md:hidden w-10 h-10 flex items-center justify-center rounded-md border border-slate-200 text-slate-700 bg-white">
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>
      {open && (
        <div className="md:hidden absolute left-0 right-0 top-full bg-white border-y border-slate-200 shadow-lg px-6 py-2 z-50 font-sans">
          {links.map((l) => (
            <NavLink key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-3 text-base text-slate-800 border-b border-slate-100 last:border-0">{l.label}</NavLink>
          ))}
          {account && <NavLink href={account.href} onClick={() => setOpen(false)} className="block py-3 text-base font-semibold border-b border-slate-100" style={{ color: '#2563EB' }}>{account.label}</NavLink>}
          {signup && <NavLink href={signup.href} onClick={() => setOpen(false)} className="block py-3 text-base font-semibold" style={{ color: '#B45309' }}>{signup.label} →</NavLink>}
        </div>
      )}
    </div>
  );
}
