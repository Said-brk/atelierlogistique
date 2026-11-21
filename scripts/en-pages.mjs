// Pages anglaises (étape 1 du site bilingue) : accueil /en et pages des deux outils phares.
// Les interfaces des outils sont encore en français : chaque page le dit clairement et donne
// un petit glossaire pour les utiliser dès maintenant.

import { SITE, SITE_NAME } from '../src/seo/pages.js';
import { pageShell, ctaHtml, cssHref, writePage, CAPACITY_HUB_EN } from './capacity-pages.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const EN_TOOL_ALTERNATES = {
  'optimiseur-chargement': '/en/truck-load-planner',
  pallet: '/en/palletizing-calculator',
};

const LOAD_FAQ = [
  { q: 'Is the load planner free? Do I need an account?', a: 'It is free and needs no account. Everything runs in your browser: your data is neither stored nor sent to any server.' },
  { q: 'What can I load?', a: 'Rectangular cartons, cases and pallets. For each line you enter dimensions, weight, quantity, whether it may be rotated, and its stacking rule: free, top only (nothing on top), floor only, or floor only with nothing on top. The truck is loaded wall by wall, from the cab to the doors.' },
  { q: 'Which vehicles and containers are supported?', a: 'A 13.6 m semi-trailer, 20ft, 40ft and 40ft High Cube containers, and custom dimensions. The automatic fleet mode also offers vans and 12 t / 19 t rigid trucks and picks the cheapest combination that carries everything.' },
  { q: 'Can I plan a multi-drop route?', a: 'Yes. Give each line a stop number (1 = delivered first). The last stop is loaded at the front, the first by the doors, and no later drop blocks an earlier one. If not everything fits, you choose to drop a whole stop or only the excess cases.' },
  { q: 'Does it check axle loads and load securing?', a: 'Yes: centre of gravity, axle loads (with a suggested shift if one axle is overloaded) and the number of lashing straps according to EN 12195-1.' },
  { q: 'Can my ERP or WMS feed it?', a: 'Yes. Import an Excel or CSV file (or paste rows): columns and units (mm, cm, g, kg) are recognised and the mapping is saved. The loading sequence can be exported as CSV for your WMS.' },
];

const PALLET_FAQ_EN = [
  { q: 'How many cartons fit on a Euro pallet?', a: 'Cartons per layer times the number of layers. Example: 400 × 300 × 250 mm cartons on a 1200 × 800 Euro pallet give 8 per layer; with a 1.80 m total height (144 mm deck included) that is 6 layers, so 48 cartons. The calculator also tests interlocked patterns mixing both orientations.' },
  { q: 'Euro or 1200 × 1000 pallet: which one?', a: 'Tick the pallets you actually have: the calculator picks the one that gives the fewest pallets, then the smallest truck floor area, then the lowest cost, and explains why. You can also force a pallet type per line or per customer.' },
  { q: 'What is a mixed pallet?', a: 'A pallet carrying several SKUs. The calculator first builds full single-SKU pallets (easier to pick and check), then puts the remainders on mixed pallets computed in 3D, heavy cases at the bottom and nothing on top of fragile ones.' },
  { q: 'How do I then load the pallets into a truck?', a: 'One click on “Charger le camion” (load the truck) sends the pallets — dimensions, weight, stacking, stop — to the 3D load planner.' },
  { q: 'Is it free?', a: 'Yes, free and with no sign-up. The calculation runs in your browser: your data is not sent to any server.' },
];

const NOTE = (tool, rows) => `
  <section class="rounded-xl border border-amber-200 p-5" style="background:#FFFBEB">
    <h2 class="font-bold text-lg">The ${esc(tool)} interface is in French for now</h2>
    <p class="text-sm text-slate-700 mt-1">An English interface is on the way. It already works the same way — here is the vocabulary you need:</p>
    <table class="w-full text-sm mt-3"><tbody>${rows.map(([fr, en]) => `<tr class="border-t border-amber-100"><td class="py-1.5 pr-3 font-semibold">${esc(fr)}</td><td class="py-1.5 text-slate-700">${esc(en)}</td></tr>`).join('')}</tbody></table>
  </section>`;

const COMMON_GLOSSARY = [
  ['Référence · Quantité', 'SKU / reference · Quantity'],
  ['Longueur · Largeur · Hauteur (cm) · Poids (kg)', 'Length · Width · Height (cm) · Weight (kg)'],
  ['Empilage : Libre · Dessus uniquement · Au sol', 'Stacking: free · top only (nothing on top) · floor only'],
  ['Arrêt · Destination', 'Stop (1 = delivered first) · Destination'],
  ['Importer / coller', 'Import a file / paste rows'],
];

const faqHtml = (faq) => `<section><h2 class="font-bold text-xl mb-3">Frequently asked questions</h2>${faq.map((f) => `<details class="border border-slate-200 rounded-lg px-4 py-3 mb-2"><summary class="cursor-pointer font-medium">${esc(f.q)}</summary><p class="text-slate-600 text-sm mt-2">${esc(f.a)}</p></details>`).join('')}</section>`;
const featuresHtml = (items) => `<section><h2 class="font-bold text-xl mb-2">What it does</h2><ul class="list-disc pl-5 space-y-1.5 text-slate-700">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>`;
const openBtn = (href, label) => `<a href="${href}" class="inline-block px-5 py-3 rounded-lg font-semibold text-white" style="background:#2563EB">${esc(label)}</a>`;
const appLd = (name, path, description) => ({
  '@context': 'https://schema.org', '@type': 'SoftwareApplication', name, url: SITE + path, description, inLanguage: 'en',
  applicationCategory: 'BusinessApplication', operatingSystem: 'Web', isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }, publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE },
});
const faqLd = (faq) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'en', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });

function loadPlanner(css) {
  const path = EN_TOOL_ALTERNATES['optimiseur-chargement'];
  const title = `Free 3D truck load planner: semi-trailer & container loading plan | ${SITE_NAME}`;
  const description = 'Free online 3D load planner for semi-trailers and 20ft / 40ft containers: pallets and cartons, multi-drop routes, stacking, axle loads, lashing straps. No sign-up.';
  const body = `
    <div>
      <h1 class="font-bold text-3xl sm:text-4xl leading-tight" style="font-family:'Bricolage Grotesque',sans-serif">Free 3D truck load planner</h1>
      <p class="text-slate-600 mt-2">Plan how your pallets and cartons fit in a semi-trailer or a shipping container, in 3D, in seconds. Free, no sign-up, your data stays in your browser.</p>
      <div class="mt-4">${openBtn('/outils/optimiseur-chargement', 'Open the load planner →')}</div>
    </div>
    ${featuresHtml([
      '3D loading plan for a 13.6 m semi-trailer, 20ft, 40ft and 40ft High Cube containers or custom dimensions.',
      'Multi-drop routes: the first delivery is loaded by the doors and nothing blocks an earlier stop.',
      'Stacking rules, rotation, payload, axle loads with suggested load shift, lashing straps (EN 12195-1).',
      'Automatic fleet mode: the cheapest mix of vans, rigid trucks and trailers that carries everything.',
      'Excel / CSV import from your ERP or WMS, loading-sequence export, printable loading sheet.',
      'Step-by-step loading guide on the loader’s phone via QR code, with a photo of the loaded truck at the end.',
    ])}
    ${NOTE('load planner', [...COMMON_GLOSSARY,
      ['Un véhicule · Flotte automatique', 'One vehicle · Automatic fleet'],
      ['Optimiser le chargement', 'Optimise the load'],
      ['QR code cariste · Fiche PDF', 'Loader QR code · Loading sheet (PDF)'],
    ])}
    <p class="text-sm">Quick answers: <a class="underline" href="${CAPACITY_HUB_EN.path}">how many pallets fit in a truck or container →</a></p>
    ${faqHtml(LOAD_FAQ)}
    ${ctaHtml('en')}`;
  return { path, html: pageShell({ lang: 'en', path, alternate: '/outils/optimiseur-chargement', title, description, body, css,
    structured: [appLd('3D truck load planner', path, description), faqLd(LOAD_FAQ)], crumbs: [{ label: 'Truck load planner' }] }) };
}

function palletCalculator(css) {
  const path = EN_TOOL_ALTERNATES.pallet;
  const title = `Free 3D pallet calculator: palletizing plan for Euro & 1200 × 1000 pallets | ${SITE_NAME}`;
  const description = 'How many cartons per pallet? Free 3D palletizing calculator: full and mixed pallets, Euro, 1200 × 1000 or custom pallets, then load the truck in one click. No sign-up.';
  const body = `
    <div>
      <h1 class="font-bold text-3xl sm:text-4xl leading-tight" style="font-family:'Bricolage Grotesque',sans-serif">Free 3D pallet calculator</h1>
      <p class="text-slate-600 mt-2">Turn your cartons into optimised pallets — full and mixed — then send them to the truck load planner in one click.</p>
      <div class="mt-4">${openBtn('/outils/pallet', 'Open the pallet calculator →')}</div>
    </div>
    ${featuresHtml([
      'Full single-SKU pallets first: best layer pattern (interlocked), alternating layers, centred load.',
      'Remainders on mixed pallets computed in 3D, never mixing two delivery stops.',
      'Tick the pallets you own (Euro, 1200 × 1000, half, US 48 × 40, custom): the best one is chosen and explained.',
      'Height and weight limits, pallet tare, stackable or not in the truck.',
      'Printable sheet, CSV export, and one-click transfer to the 3D truck load planner.',
    ])}
    ${NOTE('pallet calculator', [...COMMON_GLOSSARY,
      ['Mes supports', 'My pallets (tick the ones you have)'],
      ['Calculer la palettisation', 'Calculate the pallets'],
      ['Charger le camion', 'Load the truck (send to the load planner)'],
    ])}
    ${faqHtml(PALLET_FAQ_EN)}
    ${ctaHtml('en')}`;
  return { path, html: pageShell({ lang: 'en', path, alternate: '/outils/pallet', title, description, body, css,
    structured: [appLd('3D pallet calculator', path, description), faqLd(PALLET_FAQ_EN)], crumbs: [{ label: 'Pallet calculator' }] }) };
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
    <p class="text-sm text-slate-500">The tool interfaces are in French for now; English versions are coming. Each page above includes a short glossary.</p>`;
  const structured = [{ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: `${SITE}/en`, inLanguage: 'en', description }];
  return { path, html: pageShell({ lang: 'en', path, alternate: '/', title, description, body, css, structured }) };
}

/** Écrit les pages anglaises et renvoie leurs chemins (sitemap). */
export function writeEnPages(dist) {
  const css = cssHref(dist);
  const pages = [home(css), loadPlanner(css), palletCalculator(css)];
  pages.forEach((p) => writePage(dist, p));
  return pages.map((p) => p.path);
}
