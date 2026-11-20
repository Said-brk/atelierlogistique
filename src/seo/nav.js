// Menu de navigation du site : source unique pour
//  - le menu React (src/components/SiteNav.jsx) ;
//  - le menu HTML des articles statiques et des pages pré-rendues (scripts/prerender.mjs).
// Sans JSX ni dépendance : importable depuis Node.

import { TOOL_PAGES, ARTICLE_PAGES, toolPath } from './pages.js';

export const CONTACT_EMAIL = 'contact@atelierlogistique.com';

const GROUPS = [
  { label: 'Chargement & palettisation', ids: ['optimiseur-chargement', 'pallet', 'units'] },
  { label: 'Stocks & performance', ids: ['audit', 'safety', 'ddmrp', 'sla'] },
  { label: 'Étiquetage', ids: ['barcode', 'zpl'] },
  { label: 'Transport & documents', ids: ['incoterms', 'cmr'] },
];

const byId = Object.fromEntries(TOOL_PAGES.map((t) => [t.id, t]));

/** Outils regroupés par usage : [{ label, items: [{ label, href, desc }] }]. */
export const NAV_TOOL_GROUPS = GROUPS.map((g) => ({
  label: g.label,
  items: g.ids.map((id) => byId[id]).filter(Boolean).map((t) => ({ label: t.name, href: toolPath(t.id), desc: t.intro })),
}));

export const NAV_ARTICLES = ARTICLE_PAGES.map((a) => ({ label: a.title, href: `/ressources/${a.slug}` }));

export const NAV_CTA = { label: 'Audit gratuit', href: '/outils/audit' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Menu en HTML statique (sans JavaScript) : listes déroulantes et menu mobile en <details>.
 * Classes Tailwind ; à placer à droite du logo dans l'en-tête.
 */
export function navHtml() {
  const toolCols = NAV_TOOL_GROUPS.map((g) => `
        <div><div class="font-jetbrains text-[10px] tracking-wider text-slate-400 mb-2">${esc(g.label.toUpperCase())}</div>
        <ul class="space-y-1.5">${g.items.map((i) => `<li><a href="${i.href}" class="text-sm text-slate-700 hover:text-blue-600">${esc(i.label)}</a></li>`).join('')}</ul></div>`).join('');
  const articles = NAV_ARTICLES.map((a) => `<li><a href="${a.href}" class="text-sm text-slate-700 hover:text-blue-600">${esc(a.label)}</a></li>`).join('');
  const dropdown = (label, inner, width) => `
      <details class="al-dd relative">
        <summary class="list-none cursor-pointer flex items-center gap-1 hover:text-slate-900">${label}<span aria-hidden="true">▾</span></summary>
        <div class="absolute right-0 mt-3 ${width} bg-white border border-slate-200 rounded-xl shadow-lg p-5 z-50">${inner}</div>
      </details>`;
  return `
    <style>.al-dd summary::-webkit-details-marker,.al-mob summary::-webkit-details-marker{display:none}</style>
    <div class="hidden md:flex items-center gap-6 font-jetbrains text-xs text-slate-600">
      ${dropdown('Outils', `<div class="grid grid-cols-2 gap-6">${toolCols}</div>`, 'w-[34rem]')}
      ${dropdown('Ressources', `<ul class="space-y-2">${articles}</ul><a href="/ressources" class="block mt-3 text-xs text-blue-600">Toutes les ressources →</a>`, 'w-[26rem]')}
      <a href="mailto:${CONTACT_EMAIL}" class="hover:text-slate-900">Contact</a>
      <a href="${NAV_CTA.href}" class="px-3 py-1.5 rounded-md font-semibold text-slate-900" style="background:#F59E0B">${NAV_CTA.label}</a>
    </div>
    <details class="al-mob md:hidden">
      <summary class="list-none cursor-pointer w-10 h-10 flex items-center justify-center rounded-md border border-slate-200 text-slate-700" aria-label="Menu">☰</summary>
      <div class="absolute left-0 right-0 top-full bg-white border-b border-slate-200 shadow-lg px-6 py-5 space-y-5 max-h-[80vh] overflow-y-auto z-50">
        ${NAV_TOOL_GROUPS.map((g) => `<div><div class="font-jetbrains text-[10px] tracking-wider text-slate-400 mb-2">${esc(g.label.toUpperCase())}</div><ul class="space-y-2">${g.items.map((i) => `<li><a href="${i.href}" class="text-base text-slate-800">${esc(i.label)}</a></li>`).join('')}</ul></div>`).join('')}
        <div><div class="font-jetbrains text-[10px] tracking-wider text-slate-400 mb-2">RESSOURCES</div><ul class="space-y-2">${NAV_ARTICLES.map((a) => `<li><a href="${a.href}" class="text-base text-slate-800">${esc(a.label)}</a></li>`).join('')}<li><a href="/ressources" class="text-base text-blue-600">Toutes les ressources →</a></li></ul></div>
        <div class="flex gap-3 pt-2">
          <a href="${NAV_CTA.href}" class="flex-1 text-center px-4 py-2.5 rounded-md font-semibold text-slate-900" style="background:#F59E0B">${NAV_CTA.label}</a>
          <a href="mailto:${CONTACT_EMAIL}" class="flex-1 text-center px-4 py-2.5 rounded-md border border-slate-300 text-slate-700">Contact</a>
        </div>
      </div>
    </details>`;
}
