// Menu principal (en-tête) : les deux outils phares mis en avant + « Tous les outils » (liste déroulante).
// Menu burger sur mobile. Données : src/seo/nav.js (mêmes liens que les articles statiques et le HTML pré-rendu).

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, UserRound, Package, Truck, ChevronDown } from 'lucide-react';
import { accountEnabled, hasStoredSession } from '../shared/account/supabase';
import { NAV } from '../seo/nav';

const ICONS = { pallet: Package, truck: Truck };
const BLUE = '#2563EB';

function NavLink({ href, className, children, onClick, style }) {
  // Page interne : navigation sans rechargement ; ancre, mailto ou page statique (/en/…) : lien classique.
  if (href.startsWith('/') && !href.includes('#') && !href.startsWith('/en')) return <Link to={href} className={className} onClick={onClick} style={style}>{children}</Link>;
  return <a href={href} className={className} onClick={onClick} style={style}>{children}</a>;
}

/** Bouton d'un outil phare : plein (primary) ou teinté, page courante soulignée. */
function Featured({ f, active, className = '', onClick }) {
  const Icon = ICONS[f.icon];
  const style = f.primary
    ? { background: BLUE, color: '#fff', borderColor: BLUE }
    : { background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' };
  return (
    <NavLink href={f.href} onClick={onClick} style={style}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border font-semibold transition-all hover:-translate-y-px hover:shadow-sm ${active ? 'ring-2 ring-offset-1 ring-blue-300' : ''} ${className}`}>
      {Icon && <Icon size={13} />}{f.label}
    </NavLink>
  );
}

/** compact : variante pour la barre des pages outils. L'en-tête parent doit être positionné (sticky ou relative). */
export default function SiteNav({ compact = false, lang = 'fr' }) {
  const n = NAV[lang === 'en' ? 'en' : 'fr'];
  // Compte (FR, si configuré) : « Mon espace » si une session existe dans ce navigateur, sinon « Se connecter ».
  const account = accountEnabled && lang === 'fr'
    ? (hasStoredSession() ? { href: '/app', label: 'Mon espace' } : { href: '/connexion', label: 'Se connecter' })
    : null;
  const [open, setOpen] = useState(false);   // menu mobile
  const [all, setAll] = useState(false);     // liste « Tous les outils »
  const ref = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => { setOpen(false); setAll(false); }, [pathname]);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setAll(false); } };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setAll(false); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, []);

  return (
    <div ref={ref} className="flex items-center">
      <div className={`hidden md:flex items-center ${compact ? 'gap-2.5' : 'gap-3'} font-jetbrains text-xs text-slate-600`}>
        {n.featured.map((f) => <Featured key={f.href} f={f} active={pathname === f.href} />)}
        <div className="relative">
          <button onClick={() => setAll((o) => !o)} aria-expanded={all} aria-haspopup="true"
            className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md hover:text-slate-900 ${all ? 'text-slate-900 bg-slate-100' : ''}`}>
            {n.allLabel}<ChevronDown size={12} className={`transition-transform ${all ? 'rotate-180' : ''}`} />
          </button>
          {all && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-lg py-2 z-50 font-sans">
              {n.all.map((l) => (
                <NavLink key={l.href} href={l.href} onClick={() => setAll(false)}
                  className={`block px-4 py-2 text-sm hover:bg-slate-50 ${pathname === l.href ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{l.label}</NavLink>
              ))}
              <NavLink href={n.allHref} onClick={() => setAll(false)} className="block px-4 pt-2.5 mt-1 border-t border-slate-100 text-sm font-semibold" style={{ color: BLUE }}>{n.allHrefLabel}</NavLink>
            </div>
          )}
        </div>
        {account && (
          <NavLink href={account.href} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-300 text-slate-700 hover:text-slate-900 hover:border-slate-400">
            <UserRound size={12} />{account.label}
          </NavLink>
        )}
      </div>
      <button onClick={() => setOpen((o) => !o)} aria-label={lang === 'en' ? (open ? 'Close menu' : 'Open menu') : (open ? 'Fermer le menu' : 'Ouvrir le menu')} aria-expanded={open}
        className="md:hidden w-10 h-10 flex items-center justify-center rounded-md border border-slate-200 text-slate-700 bg-white">
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>
      {open && (
        <div className="md:hidden absolute left-0 right-0 top-full bg-white border-y border-slate-200 shadow-lg px-6 py-4 z-50 font-sans max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 mb-4">
            {n.featured.map((f) => <Featured key={f.href} f={f} active={pathname === f.href} onClick={() => setOpen(false)} className="justify-center py-3 text-sm" />)}
          </div>
          <div className="font-jetbrains text-[11px] tracking-wider text-slate-400 mb-1">{n.allLabel.toUpperCase()}</div>
          {n.all.map((l) => (
            <NavLink key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-2.5 text-base text-slate-800 border-b border-slate-100 last:border-0">{l.label}</NavLink>
          ))}
          {account && <NavLink href={account.href} onClick={() => setOpen(false)} className="block pt-3 text-base font-semibold" style={{ color: BLUE }}>{account.label}</NavLink>}
        </div>
      )}
    </div>
  );
}
