// Pages « Combien de palettes dans un … » / "How many pallets fit in a …" (SEO), en français et en anglais.
// Générées au build à partir de src/seo/capacity-data.json (données recalculables :
// npx vite-node scripts/seo-capacity.ts). HTML statique sans React : en-tête et menu communs,
// styles du site, plan de chargement en SVG, balises hreflang entre les deux langues.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SITE, SITE_NAME } from '../src/seo/pages.js';
import { navHtml } from '../src/seo/nav.js';
import { wordmarkHtml } from '../src/seo/brand.js';

export const CAPACITY_HUB = { path: '/capacite', title: 'Combien de palettes par camion et par conteneur' };
export const CAPACITY_HUB_EN = { path: '/en/capacity', title: 'How many pallets fit in a truck or container' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonLd = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// --- Noms par langue -----------------------------------------------------------------------------
const VEH_EN = {
  semi: { slug: 'semi-trailer', name: '13.6 m semi-trailer', short: 'Semi-trailer 13.6 m' },
  '20ft': { slug: '20ft-container', name: '20ft container', short: '20ft container' },
  '40ft': { slug: '40ft-container', name: '40ft container', short: '40ft container' },
  '40hc': { slug: '40ft-high-cube-container', name: '40ft High Cube container', short: '40ft HC container' },
  porteur19: { slug: '19t-rigid-truck', name: '19-tonne rigid truck', short: '19 t rigid truck' },
  porteur12: { slug: '12t-rigid-truck', name: '12-tonne rigid truck', short: '12 t rigid truck' },
  fourgon20: { slug: '20m3-van', name: '20 m³ van', short: '20 m³ van' },
};
const PAL_EN = {
  europe: { slug: 'euro', title: 'Euro', name: 'Euro pallets (EUR/EPAL 1200 × 800 mm)', short: 'Euro 1200 × 800 mm' },
  'iso-120x100': { slug: 'iso-1200x1000', title: '1200 × 1000', name: '1200 × 1000 mm pallets (ISO / EUR3)', short: 'ISO 1200 × 1000 mm' },
  'demi-palettes': { slug: 'half', title: 'half (800 × 600)', name: 'half pallets (800 × 600 mm)', short: 'Half 800 × 600 mm' },
  'us-48x40': { slug: 'us-48x40', title: 'US 48 × 40', name: 'US 48 × 40 in pallets', short: 'US 48 × 40 in' },
};
const TITLE_NAME_FR = { europe: 'Europe', 'iso-120x100': 'ISO 120 × 100', 'demi-palettes': '80 × 60 (demi)', 'us-48x40': 'US 48 × 40' };

const LOCALE = { fr: 'fr-FR', en: 'en-GB' };
const nf = (lang, n, d = 0) => Number(n).toLocaleString(LOCALE[lang], { maximumFractionDigits: d, minimumFractionDigits: d });
const metres = (lang, mm) => nf(lang, mm / 1000, 2);

/** Vue localisée d'une ligne de données (chemin, noms). */
function loc(d, lang) {
  if (lang === 'fr') {
    return {
      path: `${CAPACITY_HUB.path}/${d.slug}`, vName: d.vehicle.name, vArt: d.vehicle.art ?? 'un', vShort: d.vehicle.short,
      pTitle: TITLE_NAME_FR[d.pallet.slug] ?? d.pallet.short, pName: d.pallet.name, pShort: `${d.pallet.short} cm`,
    };
  }
  const v = VEH_EN[d.vehicle.id]; const p = PAL_EN[d.pallet.slug];
  return {
    path: `${CAPACITY_HUB_EN.path}/${p.slug}-pallets-in-${v.slug}`, vName: v.name, vArt: 'a', vShort: v.short,
    pTitle: p.title, pName: p.name, pShort: p.short,
  };
}

// --- Textes par langue ---------------------------------------------------------------------------
const T = {
  fr: {
    colon: ' :', hub: CAPACITY_HUB, home: 'Accueil', crumb: 'Capacités de chargement', answer: 'Réponse',
    floorBig: (n) => `${n} palettes au sol`,
    stacked: (n, h) => `<b>${n}</b> en gerbant sur 2 niveaux (palettes gerbables de ${h} maximum).`,
    perPallet: (w, k) => `Charge utile ${w} kg : ${k} kg maximum par palette en moyenne au sol.`,
    planTitle: 'Plan de chargement vu de dessus',
    orient: (d) => (d.along && d.across ? `${d.along} dans le sens de la longueur (en bleu) et ${d.across} en travers (en orange)` : d.along ? 'toutes dans le sens de la longueur' : 'toutes en travers'),
    planText: (n, short, o, fill, tight) => `${n} palettes ${short} : ${o}. Plancher occupé à ${fill} %.${tight ? ' Plan serré : si vos palettes débordent (film, cartons), prévoyez une palette de moins.' : ''}`,
    dimsTitle: 'Dimensions utilisées', interior: 'intérieur', payload: 'Charge utile', pallet: 'Palette', clearance: 'Jeu de manutention', clearanceVal: '3 cm en longueur, 2 cm en largeur',
    usDims: ' (121,9 × 101,6 cm)',
    dimsNote: 'Dimensions types : elles varient selon le constructeur et l’aménagement (hayon, parois, rails). Saisissez les vôtres dans l’optimiseur.',
    faqTitle: 'Questions fréquentes', otherPallets: 'autres palettes', otherVehicles: 'autres véhicules', onFloor: 'au sol',
    fullTable: 'Tableau complet : palettes par camion et par conteneur →',
    h1: (L) => `Combien de palettes ${L.pTitle} dans ${L.vArt} ${L.vName} ?`,
    title: (n, L) => `${n} palettes ${L.pTitle} dans ${L.vArt} ${L.vName} : plan de chargement | ${SITE_NAME}`,
    desc: (d, L, stackH) => `${cap(`${L.vArt} ${L.vName}`)} charge ${d.floor} ${L.pName} au sol${stackH ? `, ${d.double} gerbées sur 2 niveaux (palettes de ${stackH} maximum)` : ''}. Plan de chargement, poids maximum et calcul 3D gratuit.`,
    faq: (d, L, v, stackH, wPer, wPer2, o) => [
      { q: `Combien de ${L.pName} au sol dans ${L.vArt} ${L.vName} ?`, a: `${d.floor} palettes, ${o}, avec les dimensions intérieures ${metres('fr', v.length)} × ${metres('fr', v.width)} m et un jeu de manutention de 3 cm en longueur et 2 cm en largeur.` },
      stackH
        ? { q: `Peut-on gerber des palettes dans ${L.vArt} ${L.vName} ?`, a: `Oui si les palettes sont gerbables et que deux palettes superposées tiennent dans ${metres('fr', v.height)} m de hauteur intérieure, soit ${stackH} maximum par palette (plateau compris). On passe alors à ${d.double} palettes.` }
        : { q: `Peut-on gerber des palettes dans ${L.vArt} ${L.vName} ?`, a: `Rarement : la hauteur intérieure (${metres('fr', v.height)} m) laisse peu de place pour deux niveaux de palettes.` },
      ...(wPer ? [{ q: 'Quel poids maximum par palette ?', a: `Avec une charge utile de ${nf('fr', v.maxWeight)} kg, ${d.floor} palettes au sol peuvent peser ${nf('fr', wPer)} kg chacune en moyenne${stackH ? `, ${nf('fr', wPer2)} kg si vous chargez ${d.double} palettes gerbées` : ''}. Vérifiez aussi la charge par essieu : l’optimiseur la calcule.` }] : []),
    ],
    stackHeight: (mm) => `${nf('fr', mm / 10)} cm`,
    cta: { title: 'Vos palettes n’ont pas toutes la même taille ? Plusieurs livraisons ?', text: 'Calculez votre vrai plan de chargement en 3D : hauteurs, gerbage, poids par essieu, tournées multi-arrêts, guide cariste par QR code. Gratuit, sans inscription.', main: ['/outils/optimiseur-chargement', 'Optimiseur de chargement 3D →'], alt: ['/outils/pallet', 'Je pars de cartons : palettisation 3D'] },
    footer: [['/', 'Atelier Logistique'], ['/outils/optimiseur-chargement', 'Optimiseur de chargement 3D'], ['/outils/pallet', 'Palettisation 3D'], [CAPACITY_HUB.path, 'Capacités de chargement'], ['/ressources', 'Ressources'], ['/en', 'English']],
    svg: { cab: 'Cabine', back: 'Fond', doors: 'Portes', aria: (d, L) => `Plan de chargement vu de dessus : ${d.floor} ${L.pName} dans ${L.vArt} ${L.vName}` },
    hubH1: 'Combien de palettes dans un camion ou un conteneur ?',
    hubIntro: 'Nombre de palettes au sol (un seul niveau) selon le véhicule et le type de palette. Cliquez sur un chiffre pour voir le plan de chargement, la version gerbée et le poids maximum.',
    hubVehicle: 'Véhicule',
    hubNote: 'Dimensions intérieures types, jeu de manutention de 3 cm en longueur et 2 cm en largeur. Calcul : meilleur plan de chargement au sol (palettes en long, en travers ou mélangées).',
    hubTitle: `Combien de palettes par camion et par conteneur ? Tableau complet | ${SITE_NAME}`,
    hubDesc: 'Nombre de palettes Europe, ISO 120 × 100, demi-palettes et US dans une semi-remorque, un porteur, un fourgon et un conteneur 20 ou 40 pieds, avec le plan de chargement.',
  },
  en: {
    colon: ':', hub: CAPACITY_HUB_EN, home: 'Home', crumb: 'Load capacity', answer: 'Answer',
    floorBig: (n) => `${n} pallets on the floor`,
    stacked: (n, h) => `<b>${n}</b> when double-stacked (stackable pallets up to ${h} high).`,
    perPallet: (w, k) => `Payload ${w} kg: up to ${k} kg per pallet on average (single tier).`,
    planTitle: 'Top-view loading plan',
    orient: (d) => (d.along && d.across ? `${d.along} loaded lengthways (blue) and ${d.across} widthways (orange)` : d.along ? 'all loaded lengthways' : 'all loaded widthways'),
    planText: (n, short, o, fill, tight) => `${n} ${short} pallets: ${o}. Floor coverage ${fill}%.${tight ? ' Tight plan: if your pallets overhang (wrap, cartons), allow for one pallet less.' : ''}`,
    dimsTitle: 'Dimensions used', interior: 'internal', payload: 'Payload', pallet: 'Pallet', clearance: 'Handling clearance', clearanceVal: '30 mm lengthways, 20 mm widthways',
    usDims: ' (1219 × 1016 mm)',
    dimsNote: 'Typical dimensions: they vary by manufacturer and fit-out (tail lift, walls, rails). Enter your own in the load planner.',
    faqTitle: 'Frequently asked questions', otherPallets: 'other pallets', otherVehicles: 'other vehicles', onFloor: 'on the floor',
    fullTable: 'Full table: pallets per truck and container →',
    h1: (L) => `How many ${L.pTitle} pallets fit in ${L.vArt} ${L.vName}?`,
    title: (n, L) => `${n} ${L.pTitle} pallets in ${L.vArt} ${L.vName}: loading plan | ${SITE_NAME}`,
    desc: (d, L, stackH) => `${cap(`${L.vArt} ${L.vName}`)} holds ${d.floor} ${L.pName} on the floor${stackH ? `, ${d.double} double-stacked (pallets up to ${stackH})` : ''}. Loading plan, maximum weight and free 3D load planner.`,
    faq: (d, L, v, stackH, wPer, wPer2, o) => [
      { q: `How many ${L.pName} fit on the floor of ${L.vArt} ${L.vName}?`, a: `${d.floor} pallets, ${o}, based on internal dimensions of ${metres('en', v.length)} × ${metres('en', v.width)} m and a handling clearance of 30 mm lengthways and 20 mm widthways.` },
      stackH
        ? { q: `Can pallets be double-stacked in ${L.vArt} ${L.vName}?`, a: `Yes, if the pallets are stackable and two of them fit within the ${metres('en', v.height)} m internal height, i.e. ${stackH} maximum per pallet (deck included). That gives ${d.double} pallets.` }
        : { q: `Can pallets be double-stacked in ${L.vArt} ${L.vName}?`, a: `Rarely: the internal height (${metres('en', v.height)} m) leaves little room for two tiers of pallets.` },
      ...(wPer ? [{ q: 'What is the maximum weight per pallet?', a: `With a payload of ${nf('en', v.maxWeight)} kg, ${d.floor} pallets on the floor can weigh ${nf('en', wPer)} kg each on average${stackH ? `, or ${nf('en', wPer2)} kg if you load ${d.double} double-stacked pallets` : ''}. Also check axle loads: the load planner calculates them.` }] : []),
    ],
    stackHeight: (mm) => `${nf('en', mm / 1000, 2)} m`,
    cta: { title: 'Mixed pallet sizes? Several drops?', text: 'Build your real 3D loading plan: heights, stacking, axle loads, multi-drop routes, step-by-step loading guide by QR code. Free, no sign-up.', main: ['/en/truck-load-planner', '3D truck load planner →'], alt: ['/en/palletizing-calculator', 'Starting from cartons: pallet calculator'] },
    footer: [['/en', 'Atelier Logistique'], ['/en/truck-load-planner', '3D truck load planner'], ['/en/palletizing-calculator', 'Pallet calculator'], [CAPACITY_HUB_EN.path, 'Load capacity tables'], ['/', 'Version française']],
    svg: { cab: 'Cab', back: 'Front wall', doors: 'Doors', aria: (d, L) => `Top-view loading plan: ${d.floor} ${L.pName} in ${L.vArt} ${L.vName}` },
    hubH1: 'How many pallets fit in a truck or a container?',
    hubIntro: 'Number of pallets on the floor (single tier) by vehicle and pallet type. Click a number to see the loading plan, the double-stacked figure and the maximum weight.',
    hubVehicle: 'Vehicle',
    hubNote: 'Typical internal dimensions, handling clearance of 30 mm lengthways and 20 mm widthways. Calculation: best floor layout (pallets lengthways, widthways or mixed).',
    hubTitle: `How many pallets fit in a truck or container? Full table | ${SITE_NAME}`,
    hubDesc: 'Number of Euro, 1200 × 1000, half and US 48 × 40 pallets in a 13.6 m semi-trailer, a rigid truck, a van and a 20ft or 40ft container, with the loading plan.',
  },
};

// --- Gabarit commun (aussi utilisé par les pages anglaises des outils) ---------------------------
export function pageShell({ lang = 'fr', path, title, description, structured = [], body, crumbs = [], css, alternate = null, footer = null }) {
  const url = SITE + path;
  const other = lang === 'fr' ? 'en' : 'fr';
  const hreflang = alternate ? `
  <link rel="alternate" hreflang="${lang}" href="${url}" />
  <link rel="alternate" hreflang="${other}" href="${SITE + alternate}" />
  <link rel="alternate" hreflang="x-default" href="${SITE + (lang === 'fr' ? path : alternate)}" />` : '';
  const home = lang === 'en' ? '/en' : '/';
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${url}" />${hreflang}
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:locale" content="${lang === 'en' ? 'en_GB' : 'fr_FR'}" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${css}" />
  ${structured.map(jsonLd).join('\n  ')}
</head>
<body class="bg-white text-slate-900" style="font-family:'DM Sans',system-ui,sans-serif">
  <header class="border-b border-slate-200 bg-white sticky top-0 z-30">
    <div class="relative max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
      <a href="${home}" class="flex items-center gap-3 min-w-0">
        <img src="/favicon.svg" width="34" height="34" alt="" />
        <div class="leading-tight">${wordmarkHtml(lang)}</div>
      </a>
      ${navHtml(lang, alternate)}
    </div>
  </header>
  ${crumbs.length ? `<nav class="max-w-3xl mx-auto px-6 pt-6 text-xs text-slate-500 flex flex-wrap gap-1.5" aria-label="${lang === 'en' ? 'Breadcrumb' : 'Fil d’Ariane'}">
    <a href="${home}" class="hover:text-slate-900">${T[lang].home}</a>${crumbs.map((c) => `<span>›</span>${c.href ? `<a href="${c.href}" class="hover:text-slate-900">${esc(c.label)}</a>` : `<span class="text-slate-700">${esc(c.label)}</span>`}`).join('')}
  </nav>` : ''}
  <main class="max-w-3xl mx-auto px-6 py-6 space-y-8">${body}</main>
  <footer class="border-t border-slate-200 mt-12">
    <div class="max-w-3xl mx-auto px-6 py-8 text-sm text-slate-500 flex flex-wrap gap-x-6 gap-y-2">
      ${(footer ?? T[lang].footer).map(([h, l]) => `<a href="${h}" class="hover:text-slate-900">${esc(l)}</a>`).join('\n      ')}
    </div>
  </footer>
</body>
</html>`;
}

export function ctaHtml(lang) {
  const c = T[lang].cta;
  return `
  <div class="rounded-xl p-5 sm:p-6" style="background:#0F172A">
    <div class="font-bold text-xl text-white" style="font-family:'Bricolage Grotesque',sans-serif">${esc(c.title)}</div>
    <p class="text-slate-300 text-sm mt-2">${esc(c.text)}</p>
    <div class="flex flex-wrap gap-3 mt-4">
      <a href="${c.main[0]}" class="px-4 py-2.5 rounded-md font-semibold text-slate-900" style="background:#F59E0B">${esc(c.main[1])}</a>
      <a href="${c.alt[0]}" class="px-4 py-2.5 rounded-md border border-slate-500 text-white">${esc(c.alt[1])}</a>
    </div>
  </div>`;
}

function layoutSvg(d, lang, L) {
  const { vehicle: v, pallet: p, boxes } = d;
  const t = T[lang];
  const W = 900;
  const s = W / v.length;
  const H = Math.max(60, v.width * s);
  const truck = !v.id.startsWith('20') && !v.id.startsWith('40');
  const rects = boxes.map(([x, y, w, dd]) => {
    const along = Math.abs(w - p.length) < 1;
    return `<rect x="${(x * s).toFixed(1)}" y="${(y * s).toFixed(1)}" width="${(w * s).toFixed(1)}" height="${(dd * s).toFixed(1)}" rx="2" fill="${along ? '#2563EB' : '#F59E0B'}" fill-opacity=".85" stroke="#0F172A" stroke-width="1"/>`;
  }).join('');
  return `<svg viewBox="-40 -6 ${W + 80} ${H + 30}" width="100%" role="img" aria-label="${esc(t.svg.aria(d, L))}">
    <rect x="0" y="0" width="${W}" height="${H}" fill="#F8FAFC" stroke="#334155" stroke-width="2"/>
    ${rects}
    <text x="-8" y="${H / 2}" text-anchor="end" font-size="13" fill="#64748B" transform="rotate(-90 -8 ${H / 2})" dx="${H / 2}">${truck ? t.svg.cab : t.svg.back}</text>
    <text x="${W + 8}" y="${H / 2}" font-size="13" fill="#B45309" transform="rotate(90 ${W + 8} ${H / 2})" text-anchor="middle">${t.svg.doors}</text>
    <text x="${W / 2}" y="${H + 20}" text-anchor="middle" font-size="13" fill="#64748B">${metres(lang, v.length)} m × ${metres(lang, v.width)} m (${t.interior})</text>
  </svg>`;
}

function pageFor(d, all, css, lang) {
  const t = T[lang];
  const v = d.vehicle;
  const L = loc(d, lang);
  const Lother = loc(d, lang === 'fr' ? 'en' : 'fr');
  const stack = d.maxStackHeight >= 600;
  const stackH = stack ? t.stackHeight(d.maxStackHeight) : null;
  const wPer = v.maxWeight ? Math.floor(v.maxWeight / d.floor) : null;
  const wPer2 = v.maxWeight ? Math.floor(v.maxWeight / d.double) : null;
  const o = t.orient(d);
  const tight = d.slackLength != null && d.slackLength < 60;
  const faq = t.faq(d, L, v, stackH, wPer, wPer2, o);
  const h1 = t.h1(L);
  const sameVehicle = all.filter((x) => x.vehicle.id === v.id && x !== d);
  const samePallet = all.filter((x) => x.pallet.slug === d.pallet.slug && x !== d);
  const linkRow = (x, label) => `<li><a class="underline" href="${loc(x, lang).path}">${esc(label)}</a>${t.colon} <b>${x.floor}</b> ${t.onFloor}</li>`;
  const body = `
    <h1 class="font-bold text-3xl sm:text-4xl leading-tight" style="font-family:'Bricolage Grotesque',sans-serif">${esc(h1)}</h1>
    <div class="rounded-xl border-2 p-5" style="border-color:#2563EB;background:#EFF6FF">
      <div class="text-sm text-slate-600">${t.answer}</div>
      <div class="font-bold text-4xl" style="font-family:'Bricolage Grotesque',sans-serif;color:#2563EB">${t.floorBig(d.floor)}</div>
      ${stack ? `<div class="text-slate-800 mt-1">${t.stacked(d.double, stackH)}</div>` : ''}
      ${wPer ? `<div class="text-slate-600 text-sm mt-1">${t.perPallet(nf(lang, v.maxWeight), nf(lang, wPer))}</div>` : ''}
    </div>
    <section>
      <h2 class="font-bold text-xl mb-2">${t.planTitle}</h2>
      <div class="rounded-xl border border-slate-200 p-3 bg-white">${layoutSvg(d, lang, L)}</div>
      <p class="text-sm text-slate-600 mt-2">${esc(t.planText(d.floor, L.pShort, o, Math.round(d.floorFill * 100), tight))}</p>
    </section>
    <section>
      <h2 class="font-bold text-xl mb-2">${t.dimsTitle}</h2>
      <table class="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
        <tbody>
          <tr class="border-b border-slate-100"><td class="px-3 py-2 text-slate-500">${esc(L.vShort)} (${t.interior})</td><td class="px-3 py-2 font-semibold">${metres(lang, v.length)} × ${metres(lang, v.width)} × ${metres(lang, v.height)} m</td></tr>
          ${v.maxWeight ? `<tr class="border-b border-slate-100"><td class="px-3 py-2 text-slate-500">${t.payload}</td><td class="px-3 py-2 font-semibold">${nf(lang, v.maxWeight)} kg</td></tr>` : ''}
          <tr class="border-b border-slate-100"><td class="px-3 py-2 text-slate-500">${t.pallet}</td><td class="px-3 py-2 font-semibold">${esc(L.pShort)}${d.pallet.slug === 'us-48x40' ? t.usDims : ''}</td></tr>
          <tr><td class="px-3 py-2 text-slate-500">${t.clearance}</td><td class="px-3 py-2">${t.clearanceVal}</td></tr>
        </tbody>
      </table>
      <p class="text-xs text-slate-500 mt-2">${t.dimsNote}</p>
    </section>
    ${ctaHtml(lang)}
    <section>
      <h2 class="font-bold text-xl mb-3">${t.faqTitle}</h2>
      ${faq.map((f) => `<details class="border border-slate-200 rounded-lg px-4 py-3 mb-2"><summary class="cursor-pointer font-medium">${esc(f.q)}</summary><p class="text-slate-600 text-sm mt-2">${esc(f.a)}</p></details>`).join('')}
    </section>
    <section class="grid sm:grid-cols-2 gap-6 text-sm">
      <div><h2 class="font-bold text-lg mb-2">${esc(L.vShort)}${t.colon} ${t.otherPallets}</h2><ul class="space-y-1">${sameVehicle.map((x) => linkRow(x, loc(x, lang).pShort)).join('')}</ul></div>
      <div><h2 class="font-bold text-lg mb-2">${esc(L.pShort)}${t.colon} ${t.otherVehicles}</h2><ul class="space-y-1">${samePallet.map((x) => linkRow(x, loc(x, lang).vShort)).join('')}</ul></div>
    </section>
    <p class="text-sm"><a class="underline" href="${t.hub.path}">${t.fullTable}</a></p>`;
  const structured = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: lang, mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE + (lang === 'en' ? '/en' : '/') },
      { '@type': 'ListItem', position: 2, name: t.crumb, item: SITE + t.hub.path },
      { '@type': 'ListItem', position: 3, name: h1, item: SITE + L.path },
    ] },
  ];
  return {
    path: L.path,
    html: pageShell({ lang, path: L.path, alternate: Lother.path, title: t.title(d.floor, L), description: t.desc(d, L, stackH), structured, body, css,
      crumbs: [{ label: t.crumb, href: t.hub.path }, { label: `${L.vShort} · ${L.pShort}` }] }),
  };
}

function hubFor(all, css, lang) {
  const t = T[lang];
  const vehicles = [...new Map(all.map((d) => [d.vehicle.id, d])).values()];
  const pallets = [...new Map(all.map((d) => [d.pallet.slug, d])).values()];
  const cell = (vd, pd) => { const d = all.find((x) => x.vehicle.id === vd.vehicle.id && x.pallet.slug === pd.pallet.slug); return `<td class="px-2 py-2 text-center"><a class="underline font-semibold" href="${loc(d, lang).path}">${d.floor}</a></td>`; };
  const body = `
    <h1 class="font-bold text-3xl sm:text-4xl leading-tight" style="font-family:'Bricolage Grotesque',sans-serif">${t.hubH1}</h1>
    <p class="text-slate-600">${t.hubIntro}</p>
    <div class="overflow-x-auto rounded-xl border border-slate-200">
      <table class="w-full text-sm">
        <thead><tr class="bg-slate-50 text-slate-600"><th class="px-3 py-2 text-left font-medium">${t.hubVehicle}</th>${pallets.map((p) => `<th class="px-2 py-2 font-medium">${esc(loc(p, lang).pShort)}</th>`).join('')}</tr></thead>
        <tbody>${vehicles.map((v) => `<tr class="border-t border-slate-100"><td class="px-3 py-2">${esc(loc(v, lang).vShort)}<div class="text-[11px] text-slate-400">${metres(lang, v.vehicle.length)} × ${metres(lang, v.vehicle.width)} m</div></td>${pallets.map((p) => cell(v, p)).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="text-xs text-slate-500">${t.hubNote}</p>
    ${ctaHtml(lang)}`;
  const structured = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE + (lang === 'en' ? '/en' : '/') },
    { '@type': 'ListItem', position: 2, name: t.crumb, item: SITE + t.hub.path },
  ] }];
  const other = lang === 'fr' ? CAPACITY_HUB_EN.path : CAPACITY_HUB.path;
  return { path: t.hub.path, html: pageShell({ lang, path: t.hub.path, alternate: other, title: t.hubTitle, description: t.hubDesc, structured, body, css, crumbs: [{ label: t.crumb }] }) };
}

export function cssHref(dist) {
  return `/assets/${readdirSync(join(dist, 'assets')).find((f) => f.endsWith('.css'))}`;
}

export function writePage(dist, pg) {
  const dir = join(dist, pg.path.replace(/^\//, ''));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), pg.html);
}

/** Écrit les pages (français + anglais) dans dist/ et renvoie leurs chemins (pour le sitemap). */
export function writeCapacityPages(root, dist) {
  const all = JSON.parse(readFileSync(join(root, 'src/seo/capacity-data.json'), 'utf8'));
  const css = cssHref(dist);
  const pages = ['fr', 'en'].flatMap((lang) => [hubFor(all, css, lang), ...all.map((d) => pageFor(d, all, css, lang))]);
  pages.forEach((pg) => writePage(dist, pg));
  return pages.map((p) => p.path);
}
