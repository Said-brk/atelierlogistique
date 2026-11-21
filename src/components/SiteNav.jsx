// Menu principal (en-tête) : liens simples sur ordinateur, menu burger sur mobile.
// Données : src/seo/nav.js (mêmes liens que les articles statiques et le HTML pré-rendu).

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { NAV_LINKS, NAV_LINKS_EN } from '../seo/nav';

function NavLink({ href, className, children, onClick }) {
  // Page interne : navigation sans rechargement ; ancre, mailto ou page statique (/en/…) : lien classique.
  if (href.startsWith('/') && !href.includes('#') && !href.startsWith('/en')) return <Link to={href} className={className} onClick={onClick}>{children}</Link>;
  return <a href={href} className={className} onClick={onClick}>{children}</a>;
}

/** compact : variante pour la barre des pages outils. L'en-tête parent doit être positionné (sticky ou relative). */
export default function SiteNav({ compact = false, lang = 'fr' }) {
  const links = lang === 'en' ? NAV_LINKS_EN : NAV_LINKS;
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
      </div>
      <button onClick={() => setOpen((o) => !o)} aria-label={lang === 'en' ? (open ? 'Close menu' : 'Open menu') : (open ? 'Fermer le menu' : 'Ouvrir le menu')} aria-expanded={open}
        className="md:hidden w-10 h-10 flex items-center justify-center rounded-md border border-slate-200 text-slate-700 bg-white">
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>
      {open && (
        <div className="md:hidden absolute left-0 right-0 top-full bg-white border-y border-slate-200 shadow-lg px-6 py-2 z-50 font-sans">
          {links.map((l) => (
            <NavLink key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-3 text-base text-slate-800 border-b border-slate-100 last:border-0">{l.label}</NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
