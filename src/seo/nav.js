// Menu de navigation du site : source unique pour
//  - le menu React (src/components/SiteNav.jsx) ;
//  - le menu HTML des articles statiques et des pages pré-rendues (scripts/prerender.mjs).
// Menu volontairement court : des liens vers les pages, pas de listes à tenir à jour.

export const CONTACT_EMAIL = 'contact@atelierlogistique.com';

export const NAV_LINKS = [
  { label: 'Outils', href: '/outils' },
  { label: 'Ressources', href: '/ressources' },
  { label: 'Contact', href: `mailto:${CONTACT_EMAIL}` },
];

/** Menu des pages anglaises (/en/…). */
export const NAV_LINKS_EN = [
  { label: 'Load planner', href: '/en/truck-load-planner' },
  { label: 'Pallet calculator', href: '/en/palletizing-calculator' },
  { label: 'Capacity tables', href: '/en/capacity' },
  { label: 'Contact', href: `mailto:${CONTACT_EMAIL}` },
];

/**
 * Menu en HTML statique : liens sur ordinateur, menu burger (<details>, sans JavaScript) sur mobile.
 * lang : 'fr' | 'en' ; switchHref : lien vers la même page dans l'autre langue (sélecteur FR / EN).
 */
export function navHtml(lang = 'fr', switchHref = null) {
  const NAV_LINKS_L = lang === 'en' ? NAV_LINKS_EN : NAV_LINKS;
  const sw = switchHref ? { label: lang === 'en' ? 'FR' : 'EN', href: switchHref } : null;
  const links = sw ? [...NAV_LINKS_L, sw] : NAV_LINKS_L;
  return `
    <style>.al-mob summary::-webkit-details-marker{display:none}</style>
    <div class="hidden md:flex items-center gap-6 font-jetbrains text-xs text-slate-600">
      ${links.map((l) => `<a href="${l.href}" class="hover:text-slate-900"${l === sw ? ` hreflang="${lang === 'en' ? 'fr' : 'en'}" style="border:1px solid #CBD5E1;border-radius:6px;padding:2px 8px"` : ''}>${l.label}</a>`).join('')}
    </div>
    <details class="al-mob md:hidden">
      <summary class="list-none cursor-pointer w-10 h-10 flex items-center justify-center rounded-md border border-slate-200 text-slate-700" aria-label="Menu">☰</summary>
      <div class="absolute left-0 right-0 top-full bg-white border-b border-slate-200 shadow-lg px-6 py-3 z-50">
        ${links.map((l) => `<a href="${l.href}" class="block py-3 text-base text-slate-800 border-b border-slate-100 last:border-0">${l.label}</a>`).join('')}
      </div>
    </details>`;
}
