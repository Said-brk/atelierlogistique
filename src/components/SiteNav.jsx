// Menu principal (en-tête) : listes déroulantes sur ordinateur, menu « burger » sur mobile.
// Données : src/seo/nav.js (mêmes liens que les articles statiques et le HTML pré-rendu).

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { NAV_TOOL_GROUPS, NAV_ARTICLES, NAV_CTA, CONTACT_EMAIL } from '../seo/nav';

const AMBER = '#F59E0B';

function NavLink({ href, className, style, children, onClick }) {
  // Lien interne : navigation sans rechargement ; mailto / ancres : lien classique.
  if (href.startsWith('/') && !href.includes('#')) return <Link to={href} className={className} style={style} onClick={onClick}>{children}</Link>;
  return <a href={href} className={className} style={style} onClick={onClick}>{children}</a>;
}

function Dropdown({ label, open, onToggle, width, children }) {
  return (
    <div className="relative">
      <button onClick={onToggle} aria-expanded={open} className="flex items-center gap-1 hover:text-slate-900 transition-colors" style={open ? { color: '#0F172A' } : undefined}>
        {label} <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute right-0 mt-3 ${width} bg-white border border-slate-200 rounded-xl shadow-lg p-5 z-50 font-sans`}>{children}</div>
      )}
    </div>
  );
}

/** compact : variante pour la barre des pages outils (moins d'espace). */
export default function SiteNav({ compact = false }) {
  const [open, setOpen] = useState(null); // 'tools' | 'res' | 'mobile' | null
  const ref = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => { setOpen(null); }, [pathname]);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(null); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, []);

  const toggle = (k) => setOpen((o) => (o === k ? null : k));
  const close = () => setOpen(null);
  const item = 'text-sm text-slate-700 hover:text-blue-600';

  return (
    <div ref={ref} className="flex items-center">
      {/* Ordinateur */}
      <div className={`hidden md:flex items-center ${compact ? 'gap-4' : 'gap-6'} font-jetbrains text-xs text-slate-600`}>
        <Dropdown label="Outils" open={open === 'tools'} onToggle={() => toggle('tools')} width="w-[34rem]">
          <div className="grid grid-cols-2 gap-6">
            {NAV_TOOL_GROUPS.map((g) => (
              <div key={g.label}>
                <div className="font-jetbrains text-[10px] tracking-wider text-slate-400 mb-2">{g.label.toUpperCase()}</div>
                <ul className="space-y-1.5">
                  {g.items.map((i) => <li key={i.href}><NavLink href={i.href} className={item} onClick={close}>{i.label}</NavLink></li>)}
                </ul>
              </div>
            ))}
          </div>
        </Dropdown>
        <Dropdown label="Ressources" open={open === 'res'} onToggle={() => toggle('res')} width="w-[26rem]">
          <ul className="space-y-2 font-sans">
            {NAV_ARTICLES.map((a) => <li key={a.href}><a href={a.href} className={item}>{a.label}</a></li>)}
          </ul>
          <NavLink href="/ressources" className="block mt-3 text-xs text-blue-600" onClick={close}>Toutes les ressources →</NavLink>
        </Dropdown>
        <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-slate-900 transition-colors">Contact</a>
        <NavLink href={NAV_CTA.href} className="px-3 py-1.5 rounded-md font-semibold text-slate-900" style={{ background: AMBER }} onClick={close}>{NAV_CTA.label}</NavLink>
      </div>

      {/* Mobile */}
      <button onClick={() => toggle('mobile')} aria-label={open === 'mobile' ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={open === 'mobile'}
        className="md:hidden w-10 h-10 flex items-center justify-center rounded-md border border-slate-200 text-slate-700 bg-white">
        {open === 'mobile' ? <X size={18} /> : <Menu size={18} />}
      </button>
      {open === 'mobile' && (
        // Panneau sous l'en-tête : l'en-tête parent doit être positionné (sticky ou relative).
        <div className="md:hidden absolute left-0 right-0 top-full bg-white border-y border-slate-200 shadow-lg px-6 py-5 space-y-5 max-h-[80vh] overflow-y-auto z-50 font-sans">
          {NAV_TOOL_GROUPS.map((g) => (
            <div key={g.label}>
              <div className="font-jetbrains text-[10px] tracking-wider text-slate-400 mb-2">{g.label.toUpperCase()}</div>
              <ul className="space-y-2.5">
                {g.items.map((i) => <li key={i.href}><NavLink href={i.href} className="text-base text-slate-800" onClick={close}>{i.label}</NavLink></li>)}
              </ul>
            </div>
          ))}
          <div>
            <div className="font-jetbrains text-[10px] tracking-wider text-slate-400 mb-2">RESSOURCES</div>
            <ul className="space-y-2.5">
              {NAV_ARTICLES.map((a) => <li key={a.href}><a href={a.href} className="text-base text-slate-800">{a.label}</a></li>)}
              <li><NavLink href="/ressources" className="text-base text-blue-600" onClick={close}>Toutes les ressources →</NavLink></li>
            </ul>
          </div>
          <div className="flex gap-3 pt-2 pb-6">
            <NavLink href={NAV_CTA.href} className="flex-1 text-center px-4 py-2.5 rounded-md font-semibold text-slate-900" style={{ background: AMBER }} onClick={close}>{NAV_CTA.label}</NavLink>
            <a href={`mailto:${CONTACT_EMAIL}`} className="flex-1 text-center px-4 py-2.5 rounded-md border border-slate-300 text-slate-700">Contact</a>
          </div>
        </div>
      )}
    </div>
  );
}
