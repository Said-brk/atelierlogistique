// Menu de navigation du site : source unique pour
//  - le menu React (src/components/SiteNav.jsx) ;
//  - le menu HTML des articles statiques et des pages pré-rendues (scripts/prerender.mjs).
// Trois entrées : les deux outils phares (mis en avant) puis « Tous les outils » (liste déroulante).
// Ressources et contact sont dans le pied de page.

import { TOOL_PAGES, toolPath } from './pages.js';

export const CONTACT_EMAIL = 'contact@atelierlogistique.com';

/** Menu par langue : featured = outils phares, all = liste « Tous les outils », allHref = page de tous les outils. */
export const NAV = {
  fr: {
    featured: [
      { label: 'Palettisation 3D', href: toolPath('pallet'), icon: 'pallet' },
      { label: 'Chargement 3D', href: toolPath('optimiseur-chargement'), icon: 'truck', primary: true },
    ],
    allLabel: 'Tous les outils',
    all: TOOL_PAGES.map((t) => ({ label: t.name, href: toolPath(t.id) })),
    allHref: '/#tools',
    allHrefLabel: 'Voir l’établi complet →',
  },
  en: {
    featured: [
      { label: 'Pallet calculator', href: '/en/palletizing-calculator', icon: 'pallet' },
      { label: 'Load planner', href: '/en/truck-load-planner', icon: 'truck', primary: true },
    ],
    allLabel: 'All tools',
    all: [
      { label: 'Truck & container load planner', href: '/en/truck-load-planner' },
      { label: 'Palletizing calculator', href: '/en/palletizing-calculator' },
      { label: 'Capacity tables', href: '/en/capacity' },
    ],
    allHref: '/en',
    allHrefLabel: 'All tools →',
  },
};

const ICONS = {
  pallet: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
  truck: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>',
};

const BTN = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold';
const featuredStyle = (f) => (f.primary
  ? 'background:#2563EB;color:#fff;border:1px solid #2563EB'
  : 'background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE');

/**
 * Menu en HTML statique : boutons + liste déroulante (<details>, sans JavaScript) sur ordinateur, menu burger sur mobile.
 * lang : 'fr' | 'en' ; switchHref : lien vers la même page dans l'autre langue (sélecteur FR / EN).
 */
export function navHtml(lang = 'fr', switchHref = null) {
  const n = NAV[lang === 'en' ? 'en' : 'fr'];
  const sw = switchHref ? `<a href="${switchHref}" hreflang="${lang === 'en' ? 'fr' : 'en'}" style="border:1px solid #CBD5E1;border-radius:6px;padding:2px 8px">${lang === 'en' ? 'FR' : 'EN'}</a>` : '';
  const item = (l) => `<a href="${l.href}" class="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">${l.label}</a>`;
  return `
    <style>.al-mob summary::-webkit-details-marker,.al-all summary::-webkit-details-marker{display:none}</style>
    <div class="hidden md:flex items-center gap-3 font-jetbrains text-xs text-slate-600">
      ${n.featured.map((f) => `<a href="${f.href}" class="${BTN}" style="${featuredStyle(f)}">${ICONS[f.icon] ?? ''}${f.label}</a>`).join('')}
      <details class="al-all relative">
        <summary class="list-none cursor-pointer px-2 py-1.5 hover:text-slate-900">${n.allLabel} ▾</summary>
        <div class="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg py-2 z-50 font-sans">
          ${n.all.map(item).join('')}
          <a href="${n.allHref}" class="block px-4 pt-2 mt-1 border-t border-slate-100 text-sm font-semibold" style="color:#2563EB">${n.allHrefLabel}</a>
        </div>
      </details>
      ${sw}
    </div>
    <details class="al-mob md:hidden">
      <summary class="list-none cursor-pointer w-10 h-10 flex items-center justify-center rounded-md border border-slate-200 text-slate-700" aria-label="Menu">☰</summary>
      <div class="absolute left-0 right-0 top-full bg-white border-b border-slate-200 shadow-lg px-6 py-4 z-50">
        <div class="grid grid-cols-2 gap-2 mb-3">
          ${n.featured.map((f) => `<a href="${f.href}" class="${BTN} justify-center py-3 text-sm" style="${featuredStyle(f)}">${ICONS[f.icon] ?? ''}${f.label}</a>`).join('')}
        </div>
        <div class="font-jetbrains text-[11px] tracking-wider text-slate-400 mb-1">${n.allLabel.toUpperCase()}</div>
        ${n.all.map((l) => `<a href="${l.href}" class="block py-2.5 text-base text-slate-800 border-b border-slate-100">${l.label}</a>`).join('')}
        ${sw ? `<div class="pt-3">${sw}</div>` : ''}
      </div>
    </details>`;
}
