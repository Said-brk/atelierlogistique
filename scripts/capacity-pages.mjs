// Pages « Combien de palettes dans un … » (SEO), générées au build à partir de src/seo/capacity-data.json.
// HTML statique (sans React) : en-tête et menu communs, styles du site, plan de chargement en SVG.
// Données recalculables : npx vite-node scripts/seo-capacity.ts

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SITE, SITE_NAME } from '../src/seo/pages.js';
import { navHtml } from '../src/seo/nav.js';
import { wordmarkHtml } from '../src/seo/brand.js';

export const CAPACITY_HUB = { path: '/capacite', title: 'Combien de palettes par camion et par conteneur' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nf = (n, d = 0) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d });
const m = (mm) => nf(mm / 1000, 2);
const cm = (mm) => nf(mm / 10, 0);
const jsonLd = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const un = (v) => `${v.art ?? 'un'} ${v.name}`; // « une semi-remorque », « un conteneur »
const TITLE_NAME = { europe: 'Europe', 'iso-120x100': 'ISO 120 × 100', 'demi-palettes': '80 × 60 (demi)', 'us-48x40': 'US 48 × 40' };

function layoutSvg(d) {
  const { vehicle: v, pallet: p, boxes } = d;
  const W = 900;
  const s = W / v.length;
  const H = Math.max(60, v.width * s);
  const truck = !v.id.startsWith('20') && !v.id.startsWith('40');
  const rects = boxes.map(([x, y, w, dd]) => {
    const along = Math.abs(w - p.length) < 1;
    return `<rect x="${(x * s).toFixed(1)}" y="${(y * s).toFixed(1)}" width="${(w * s).toFixed(1)}" height="${(dd * s).toFixed(1)}" rx="2" fill="${along ? '#2563EB' : '#F59E0B'}" fill-opacity=".85" stroke="#0F172A" stroke-width="1"/>`;
  }).join('');
  return `<svg viewBox="-40 -6 ${W + 80} ${H + 30}" width="100%" role="img" aria-label="Plan de chargement vu de dessus : ${d.floor} ${esc(p.name)} dans ${esc(un(v))}">
    <rect x="0" y="0" width="${W}" height="${H}" fill="#F8FAFC" stroke="#334155" stroke-width="2"/>
    ${rects}
    <text x="-8" y="${H / 2}" text-anchor="end" font-size="13" fill="#64748B" transform="rotate(-90 -8 ${H / 2})" dx="${H / 2}">${truck ? 'Cabine' : 'Fond'}</text>
    <text x="${W + 8}" y="${H / 2}" font-size="13" fill="#B45309" transform="rotate(90 ${W + 8} ${H / 2})" text-anchor="middle">Portes</text>
    <text x="${W / 2}" y="${H + 20}" text-anchor="middle" font-size="13" fill="#64748B">${m(v.length)} m × ${m(v.width)} m (intérieur)</text>
  </svg>`;
}

function shell({ path, title, description, structured, body, crumbs, css }) {
  const url = SITE + path;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:locale" content="fr_FR" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${css}" />
  ${structured.map(jsonLd).join('\n  ')}
</head>
<body class="bg-white text-slate-900" style="font-family:'DM Sans',system-ui,sans-serif">
  <header class="border-b border-slate-200 bg-white sticky top-0 z-30">
    <div class="relative max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
      <a href="/" class="flex items-center gap-3 min-w-0">
        <img src="/favicon.svg" width="34" height="34" alt="" />
        <div class="leading-tight">${wordmarkHtml()}</div>
      </a>
      ${navHtml()}
    </div>
  </header>
  <nav class="max-w-3xl mx-auto px-6 pt-6 text-xs text-slate-500 flex flex-wrap gap-1.5" aria-label="Fil d'Ariane">
    <a href="/" class="hover:text-slate-900">Accueil</a>${crumbs.map((c) => `<span>›</span>${c.href ? `<a href="${c.href}" class="hover:text-slate-900">${esc(c.label)}</a>` : `<span class="text-slate-700">${esc(c.label)}</span>`}`).join('')}
  </nav>
  <main class="max-w-3xl mx-auto px-6 py-6 space-y-8">${body}</main>
  <footer class="border-t border-slate-200 mt-12">
    <div class="max-w-3xl mx-auto px-6 py-8 text-sm text-slate-500 flex flex-wrap gap-x-6 gap-y-2">
      <a href="/" class="hover:text-slate-900">Atelier Logistique</a>
      <a href="/outils/optimiseur-chargement" class="hover:text-slate-900">Optimiseur de chargement 3D</a>
      <a href="/outils/pallet" class="hover:text-slate-900">Palettisation 3D</a>
      <a href="${CAPACITY_HUB.path}" class="hover:text-slate-900">Capacités de chargement</a>
      <a href="/ressources" class="hover:text-slate-900">Ressources</a>
    </div>
  </footer>
</body>
</html>`;
}

const cta = `
  <div class="rounded-xl p-5 sm:p-6" style="background:#0F172A">
    <div class="font-bold text-xl text-white" style="font-family:'Bricolage Grotesque',sans-serif">Vos palettes n’ont pas toutes la même taille ? Plusieurs livraisons ?</div>
    <p class="text-slate-300 text-sm mt-2">Calculez votre vrai plan de chargement en 3D : hauteurs, gerbage, poids par essieu, tournées multi-arrêts, guide cariste par QR code. Gratuit, sans inscription.</p>
    <div class="flex flex-wrap gap-3 mt-4">
      <a href="/outils/optimiseur-chargement" class="px-4 py-2.5 rounded-md font-semibold text-slate-900" style="background:#F59E0B">Optimiseur de chargement 3D →</a>
      <a href="/outils/pallet" class="px-4 py-2.5 rounded-md border border-slate-500 text-white">Je pars de cartons : palettisation 3D</a>
    </div>
  </div>`;

function pageFor(d, all, css) {
  const { vehicle: v, pallet: p } = d;
  const path = `${CAPACITY_HUB.path}/${d.slug}`;
  const pName = TITLE_NAME[p.slug] ?? p.short;
  const h1 = `Combien de palettes ${pName} dans ${un(v)} ?`;
  const title = `${d.floor} palettes ${pName} dans ${un(v)} : plan de chargement | ${SITE_NAME}`;
  const stack = d.maxStackHeight >= 600;
  const description = `${un(v).charAt(0).toUpperCase() + un(v).slice(1)} charge ${d.floor} ${p.name} au sol${stack ? `, ${d.double} gerbées sur 2 niveaux (palettes de ${cm(d.maxStackHeight)} cm maximum)` : ''}. Plan de chargement, poids maximum et calcul 3D gratuit.`;
  const wPer = v.maxWeight ? Math.floor(v.maxWeight / d.floor) : null;
  const wPer2 = v.maxWeight ? Math.floor(v.maxWeight / d.double) : null;
  const orient = d.along && d.across ? `${d.along} dans le sens de la longueur (en bleu) et ${d.across} en travers (en orange)` : d.along ? 'toutes dans le sens de la longueur' : 'toutes en travers';
  const tight = d.slackLength != null && d.slackLength < 60;
  const faq = [
    { q: `Combien de ${p.name} au sol dans ${un(v)} ?`, a: `${d.floor} palettes, ${orient}, avec les dimensions intérieures ${m(v.length)} × ${m(v.width)} m et un jeu de manutention de 3 cm en longueur et 2 cm en largeur.` },
    stack
      ? { q: `Peut-on gerber des palettes dans ${un(v)} ?`, a: `Oui si les palettes sont gerbables et que deux palettes superposées tiennent dans ${m(v.height)} m de hauteur intérieure, soit ${cm(d.maxStackHeight)} cm maximum par palette (plateau compris). On passe alors à ${d.double} palettes.` }
      : { q: `Peut-on gerber des palettes dans ${un(v)} ?`, a: `Rarement : la hauteur intérieure (${m(v.height)} m) laisse peu de place pour deux niveaux de palettes.` },
    ...(wPer ? [{ q: 'Quel poids maximum par palette ?', a: `Avec une charge utile de ${nf(v.maxWeight)} kg, ${d.floor} palettes au sol peuvent peser ${nf(wPer)} kg chacune en moyenne${stack ? `, ${nf(wPer2)} kg si vous chargez ${d.double} palettes gerbées` : ''}. Vérifiez aussi la charge par essieu : l’optimiseur la calcule.` }] : []),
  ];
  const sameVehicle = all.filter((x) => x.vehicle.id === v.id && x !== d);
  const samePallet = all.filter((x) => x.pallet.slug === p.slug && x !== d);
  const linkRow = (x, label) => `<li><a class="underline" href="${CAPACITY_HUB.path}/${x.slug}">${esc(label)}</a> : <b>${x.floor}</b> au sol</li>`;
  const body = `
    <h1 class="font-bold text-3xl sm:text-4xl leading-tight" style="font-family:'Bricolage Grotesque',sans-serif">${esc(h1)}</h1>
    <div class="rounded-xl border-2 p-5" style="border-color:#2563EB;background:#EFF6FF">
      <div class="text-sm text-slate-600">Réponse</div>
      <div class="font-bold text-4xl" style="font-family:'Bricolage Grotesque',sans-serif;color:#2563EB">${d.floor} palettes au sol</div>
      ${stack ? `<div class="text-slate-800 mt-1"><b>${d.double}</b> en gerbant sur 2 niveaux (palettes gerbables de ${cm(d.maxStackHeight)} cm maximum).</div>` : ''}
      ${wPer ? `<div class="text-slate-600 text-sm mt-1">Charge utile ${nf(v.maxWeight)} kg : ${nf(wPer)} kg maximum par palette en moyenne au sol.</div>` : ''}
    </div>
    <section>
      <h2 class="font-bold text-xl mb-2">Plan de chargement vu de dessus</h2>
      <div class="rounded-xl border border-slate-200 p-3 bg-white">${layoutSvg(d)}</div>
      <p class="text-sm text-slate-600 mt-2">${d.floor} palettes ${p.short} : ${orient}. Plancher occupé à ${Math.round(d.floorFill * 100)} %.${tight ? ' Plan serré : si vos palettes débordent (film, cartons), prévoyez une palette de moins.' : ''}</p>
    </section>
    <section>
      <h2 class="font-bold text-xl mb-2">Dimensions utilisées</h2>
      <table class="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
        <tbody>
          <tr class="border-b border-slate-100"><td class="px-3 py-2 text-slate-500">${esc(v.short)} (intérieur)</td><td class="px-3 py-2 font-semibold">${m(v.length)} × ${m(v.width)} × ${m(v.height)} m</td></tr>
          ${v.maxWeight ? `<tr class="border-b border-slate-100"><td class="px-3 py-2 text-slate-500">Charge utile</td><td class="px-3 py-2 font-semibold">${nf(v.maxWeight)} kg</td></tr>` : ''}
          <tr class="border-b border-slate-100"><td class="px-3 py-2 text-slate-500">Palette</td><td class="px-3 py-2 font-semibold">${esc(p.short)} cm${p.slug === 'us-48x40' ? ' (121,9 × 101,6 cm)' : ''}</td></tr>
          <tr><td class="px-3 py-2 text-slate-500">Jeu de manutention</td><td class="px-3 py-2">3 cm en longueur, 2 cm en largeur</td></tr>
        </tbody>
      </table>
      <p class="text-xs text-slate-500 mt-2">Dimensions types : elles varient selon le constructeur et l’aménagement (hayon, parois, rails). Saisissez les vôtres dans l’optimiseur.</p>
    </section>
    ${cta}
    <section>
      <h2 class="font-bold text-xl mb-3">Questions fréquentes</h2>
      ${faq.map((f) => `<details class="border border-slate-200 rounded-lg px-4 py-3 mb-2"><summary class="cursor-pointer font-medium">${esc(f.q)}</summary><p class="text-slate-600 text-sm mt-2">${esc(f.a)}</p></details>`).join('')}
    </section>
    <section class="grid sm:grid-cols-2 gap-6 text-sm">
      <div><h2 class="font-bold text-lg mb-2">${esc(v.short)} : autres palettes</h2><ul class="space-y-1">${sameVehicle.map((x) => linkRow(x, x.pallet.short)).join('')}</ul></div>
      <div><h2 class="font-bold text-lg mb-2">${esc(p.short)} : autres véhicules</h2><ul class="space-y-1">${samePallet.map((x) => linkRow(x, x.vehicle.short)).join('')}</ul></div>
    </section>
    <p class="text-sm"><a class="underline" href="${CAPACITY_HUB.path}">Tableau complet : palettes par camion et par conteneur →</a></p>`;
  const structured = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Capacités de chargement', item: SITE + CAPACITY_HUB.path },
      { '@type': 'ListItem', position: 3, name: h1, item: SITE + path },
    ] },
  ];
  return { path, html: shell({ path, title, description, structured, body, css, crumbs: [{ label: 'Capacités de chargement', href: CAPACITY_HUB.path }, { label: `${v.short} · ${p.short}` }] }) };
}

function hubFor(all, css) {
  const vehicles = [...new Map(all.map((d) => [d.vehicle.id, d.vehicle])).values()];
  const pallets = [...new Map(all.map((d) => [d.pallet.slug, d.pallet])).values()];
  const cell = (v, p) => { const d = all.find((x) => x.vehicle.id === v.id && x.pallet.slug === p.slug); return `<td class="px-2 py-2 text-center"><a class="underline font-semibold" href="${CAPACITY_HUB.path}/${d.slug}">${d.floor}</a></td>`; };
  const body = `
    <h1 class="font-bold text-3xl sm:text-4xl leading-tight" style="font-family:'Bricolage Grotesque',sans-serif">Combien de palettes dans un camion ou un conteneur ?</h1>
    <p class="text-slate-600">Nombre de palettes au sol (un seul niveau) selon le véhicule et le type de palette. Cliquez sur un chiffre pour voir le plan de chargement, la version gerbée et le poids maximum.</p>
    <div class="overflow-x-auto rounded-xl border border-slate-200">
      <table class="w-full text-sm">
        <thead><tr class="bg-slate-50 text-slate-600"><th class="px-3 py-2 text-left font-medium">Véhicule</th>${pallets.map((p) => `<th class="px-2 py-2 font-medium">${esc(p.short)}</th>`).join('')}</tr></thead>
        <tbody>${vehicles.map((v) => `<tr class="border-t border-slate-100"><td class="px-3 py-2">${esc(v.short)}<div class="text-[11px] text-slate-400">${m(v.length)} × ${m(v.width)} m</div></td>${pallets.map((p) => cell(v, p)).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="text-xs text-slate-500">Dimensions intérieures types, jeu de manutention de 3 cm en longueur et 2 cm en largeur. Calcul : meilleur plan de chargement au sol (palettes en long, en travers ou mélangées).</p>
    ${cta}`;
  const title = `Combien de palettes par camion et par conteneur ? Tableau complet | ${SITE_NAME}`;
  const description = 'Nombre de palettes Europe, ISO 120 × 100, demi-palettes et US dans une semi-remorque, un porteur, un fourgon et un conteneur 20 ou 40 pieds, avec le plan de chargement.';
  const structured = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE}/` },
    { '@type': 'ListItem', position: 2, name: 'Capacités de chargement', item: SITE + CAPACITY_HUB.path },
  ] }];
  return { path: CAPACITY_HUB.path, html: shell({ path: CAPACITY_HUB.path, title, description, structured, body, css, crumbs: [{ label: 'Capacités de chargement' }] }) };
}

/** Écrit les pages dans dist/ et renvoie leurs chemins (pour le sitemap). */
export function writeCapacityPages(root, dist) {
  const all = JSON.parse(readFileSync(join(root, 'src/seo/capacity-data.json'), 'utf8'));
  const cssFile = readdirSync(join(dist, 'assets')).find((f) => f.endsWith('.css'));
  const css = `/assets/${cssFile}`;
  const pages = [hubFor(all, css), ...all.map((d) => pageFor(d, all, css))];
  for (const pg of pages) {
    const dir = join(dist, pg.path.replace(/^\//, ''));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), pg.html);
  }
  return pages.map((p) => p.path);
}
