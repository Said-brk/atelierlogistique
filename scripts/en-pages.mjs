// Pages anglaises : accueil /en (page statique) et contenu pré-rendu des deux outils traduits.
// Textes des outils : src/seo/pages-en.js (partagé avec l'application React).

import { SITE, SITE_NAME } from '../src/seo/pages.js';
import { TOOL_PAGES_EN } from '../src/seo/pages-en.js';
import { pageShell, ctaHtml, cssHref, writePage, CAPACITY_HUB_EN } from './capacity-pages.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const EN_TOOL_ALTERNATES = Object.fromEntries(TOOL_PAGES_EN.map((t) => [t.id, t.path]));

const faqHtml = (faq) => `<section><h2 class="font-bold text-xl mb-3">Frequently asked questions</h2>${faq.map((f) => `<details class="border border-slate-200 rounded-lg px-4 py-3 mb-2"><summary class="cursor-pointer font-medium">${esc(f.q)}</summary><p class="text-slate-600 text-sm mt-2">${esc(f.a)}</p></details>`).join('')}</section>`;
const featuresHtml = (items) => `<section><h2 class="font-bold text-xl mb-2">What it does</h2><ul class="list-disc pl-5 space-y-1.5 text-slate-700">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>`;
const appLd = (name, path, description) => ({
  '@context': 'https://schema.org', '@type': 'SoftwareApplication', name, url: SITE + path, description, inLanguage: 'en',
  applicationCategory: 'BusinessApplication', operatingSystem: 'Web', isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }, publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE },
});
const faqLd = (faq) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'en', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });

/**
 * Outils en anglais : l'application React les affiche en anglais (/en/truck-load-planner…).
 * On renvoie le contenu pré-rendu ; scripts/prerender.mjs l'injecte dans le gabarit de l'application.
 */
export function enToolPages() {
  return TOOL_PAGES_EN.map((t) => ({
    path: t.path,
    alternate: `/outils/${t.id}`,
    title: t.title,
    description: t.description,
    crumbs: [{ label: t.name }],
    structured: [appLd(t.name, t.path, t.description), faqLd(t.faq)],
    inner: `
    <div>
      <h1 class="font-bold text-3xl">${esc(t.h1)}</h1>
      <p class="text-slate-600 mt-2">${esc(t.intro)}</p>
      <p class="text-sm text-slate-500 mt-1">Free · no sign-up · runs in your browser</p>
    </div>
    ${featuresHtml(t.features)}
    <p class="text-sm">Quick answers: <a class="underline" href="${CAPACITY_HUB_EN.path}">how many pallets fit in a truck or container →</a></p>
    ${faqHtml(t.faq)}`,
  }));
}

function home(css) {
  const path = '/en';
  const title = `Free supply chain tools: 3D truck load planner & pallet calculator | ${SITE_NAME}`;
  const description = 'Free online logistics tools: 3D truck and container load planner, pallet calculator, pallets-per-truck tables. No sign-up, your data stays in your browser.';
  const card = (href, t, d) => `<a href="${href}" class="block rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"><div class="font-bold text-lg" style="font-family:'Bricolage Grotesque',sans-serif">${esc(t)}</div><p class="text-sm text-slate-600 mt-1">${esc(d)}</p></a>`;
  const body = `
    <div>
      <h1 class="font-bold text-3xl sm:text-4xl leading-tight" style="font-family:'Bricolage Grotesque',sans-serif">The supply chain toolbox</h1>
      <p class="text-slate-600 mt-2">Free web tools built by supply chain practitioners. No installation, no account: your data stays in your browser.</p>
    </div>
    <div class="grid sm:grid-cols-2 gap-4">
      ${card('/en/truck-load-planner', '3D truck load planner', 'Semi-trailers and containers, multi-drop routes, axle loads, automatic fleet, loader QR code.')}
      ${card('/en/palletizing-calculator', '3D pallet calculator', 'Full and mixed pallets, best pallet type, then load the truck in one click.')}
      ${card(CAPACITY_HUB_EN.path, 'How many pallets fit?', 'Pallets per semi-trailer, rigid truck, van and 20ft / 40ft container, with loading plans.')}
      ${card('/', 'All tools (French)', 'Barcodes, ZPL labels, safety stock, DDMRP, Incoterms, CMR, supply chain audit.')}
    </div>
    <p class="text-sm text-slate-500">The load planner and the pallet calculator are fully in English. The other tools are in French for now.</p>`;
  const structured = [{ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: `${SITE}/en`, inLanguage: 'en', description }];
  return { path, html: pageShell({ lang: 'en', path, alternate: '/', title, description, body, css, structured }) };
}

/** Écrit l'accueil anglais et renvoie son chemin (sitemap). Les outils : enToolPages(). */
export function writeEnPages(dist) {
  const css = cssHref(dist);
  // /en est désormais la page Chargement + palettisation en anglais (scripts/prerender.mjs) ; home() reste pour référence.
  void css; void home;
  return ['/en'];
}
