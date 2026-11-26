// Pré-rendu SEO, exécuté après `vite build`.
//
// Pour chaque page (accueil, ressources, chaque outil), on écrit un HTML complet :
// titre, description, URL canonique, Open Graph, données structurées (logiciel gratuit,
// FAQ, fil d'Ariane) et le contenu texte de la page dans <div id="root">.
// Google lit ce contenu immédiatement ; au chargement, React remplace ce bloc par l'application
// (même contenu, version interactive). Génère aussi sitemap.xml.
//
// Source des textes : src/seo/pages.js (partagée avec les pages React).

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITE, SITE_NAME, TOOL_PAGES, ARTICLE_PAGES, HOME_PAGE, RESSOURCES_PAGE, ALL_TOOLS_PAGE, FEATURED_TOOLS, LOAD_LANDING_PAGE, toolPath,
} from '../src/seo/pages.js';
import { navHtml } from '../src/seo/nav.js';
import { wordmarkHtml } from '../src/seo/brand.js';
import { writeCapacityPages, CAPACITY_HUB } from './capacity-pages.mjs';
import { writeEnPages, enToolPages, EN_TOOL_ALTERNATES } from './en-pages.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const template = readFileSync(join(dist, 'index.html'), 'utf8');

// Page 404 (servie par Vercel pour une URL inconnue) : l'application affiche « Page introuvable ».
writeFileSync(join(dist, '404.html'), template.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <meta name="robots" content="noindex" />'));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const toolById = Object.fromEntries(TOOL_PAGES.map((t) => [t.id, t]));
const articleBySlug = Object.fromEntries(ARTICLE_PAGES.map((a) => [a.slug, a]));

function head({ path, title, description, structured = [], alternate = null, lang = 'fr' }) {
  const url = SITE + path;
  // Version dans l'autre langue : balises hreflang (x-default = version française).
  const fr = lang === 'fr' ? url : SITE + alternate;
  const en = lang === 'en' ? url : SITE + alternate;
  const alt = alternate ? [
    `<link rel="alternate" hreflang="fr" href="${fr}" />`,
    `<link rel="alternate" hreflang="en" href="${en}" />`,
    `<link rel="alternate" hreflang="x-default" href="${fr}" />`,
  ] : [];
  return [
    ...alt,
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="${lang === 'en' ? 'en_GB' : 'fr_FR'}" />`,
    `<meta name="twitter:card" content="summary" />`,
    ...structured.map(jsonLd),
  ].join('\n    ');
}

/** Remplace les balises SEO du gabarit et le contenu de #root. */
function page(headHtml, bodyHtml, lang = 'fr') {
  let html = template
    .replace(/<html lang="[^"]*"/, `<html lang="${lang}"`)
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace(/<meta property="og:title"[^>]*>/, '')
    .replace(/<meta property="og:description"[^>]*>/, '')
    .replace(/<meta property="og:type"[^>]*>/, '<meta property="og:type" content="website" />');
  html = html.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    ${headHtml}`);
  if (!html.includes('<div id="root"></div>')) throw new Error('Gabarit : <div id="root"></div> introuvable');
  return html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);
}

function write(path, html) {
  const file = path === '/' ? join(dist, 'index.html') : join(dist, path.replace(/^\//, ''), 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

const shell = (crumbs, inner, alternate = null, lang = 'fr') => `
<div class="min-h-screen bg-white text-slate-900" style="font-family:'DM Sans',system-ui,sans-serif">
  <header class="border-b border-slate-200">
    <div class="relative max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
      <nav class="flex flex-wrap items-center gap-2 text-sm text-slate-500" aria-label="${lang === 'en' ? 'Breadcrumb' : "Fil d'Ariane"}">
        <a href="${lang === 'en' ? '/en' : '/'}" class="font-semibold text-slate-900">${SITE_NAME}</a>
        ${crumbs.map((c) => `<span>›</span>${c.href ? `<a href="${c.href}">${esc(c.label)}</a>` : `<span class="text-slate-700">${esc(c.label)}</span>`}`).join('')}
      </nav>
      ${navHtml(lang, alternate)}
    </div>
  </header>
  <main class="max-w-3xl mx-auto px-6 py-10 space-y-8">${inner}</main>
</div>`;

const links = (items) => `<ul class="space-y-1">${items.map((i) => `<li><a class="underline" href="${i.href}">${esc(i.label)}</a>${i.desc ? ` — ${esc(i.desc)}` : ''}</li>`).join('')}</ul>`;

// ---------- Outils ----------
for (const t of TOOL_PAGES) {
  const path = toolPath(t.id);
  const structured = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: t.name,
      description: t.description,
      url: SITE + path,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      inLanguage: 'fr',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Outils', item: `${SITE}/outils` },
        { '@type': 'ListItem', position: 3, name: t.name, item: SITE + path },
      ],
    },
  ];
  if (t.faq?.length) {
    structured.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: t.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }
  const related = (t.related ?? []).map((id) => toolById[id]).filter(Boolean)
    .map((r) => ({ href: toolPath(r.id), label: r.name, desc: r.intro }));
  const guides = (t.articles ?? []).map((s) => articleBySlug[s]).filter(Boolean)
    .map((a) => ({ href: `/ressources/${a.slug}`, label: a.title }));
  if (['optimiseur-chargement', 'pallet', 'units'].includes(t.id)) guides.push({ href: CAPACITY_HUB.path, label: `${CAPACITY_HUB.title} (tableau)` });
  const inner = `
    <div>
      <h1 class="font-bold text-3xl">${esc(t.h1)}</h1>
      <p class="text-slate-600 mt-2">${esc(t.intro)}</p>
      <p class="text-sm text-slate-500 mt-1">Gratuit · sans inscription · calcul dans votre navigateur</p>
    </div>
    <section><h2 class="font-bold text-xl mb-2">Fonctionnalités</h2><ul class="list-disc pl-5 space-y-1 text-slate-700">${t.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></section>
    ${t.faq?.length ? `<section><h2 class="font-bold text-xl mb-2">Questions fréquentes</h2>${t.faq.map((f) => `<details class="border border-slate-200 rounded-lg px-4 py-3 mb-2"><summary class="cursor-pointer">${esc(f.q)}</summary><p class="text-slate-600 text-sm mt-2">${esc(f.a)}</p></details>`).join('')}</section>` : ''}
    ${guides.length ? `<section><h2 class="font-bold text-xl mb-2">Guides</h2>${links(guides)}</section>` : ''}
    ${related.length ? `<section><h2 class="font-bold text-xl mb-2">Outils associés</h2>${links(related)}</section>` : ''}`;
  const alternate = EN_TOOL_ALTERNATES[t.id] ?? null;
  write(path, page(head({ path, title: t.title, description: t.description, structured, alternate }), shell([{ label: 'Outils', href: '/outils' }, { label: t.name }], inner, alternate)));
}

// ---------- Outils en anglais (même application, interface anglaise) ----------
const enTools = enToolPages();
for (const p of enTools) {
  write(p.path, page(head({ path: p.path, title: p.title, description: p.description, structured: p.structured, alternate: p.alternate, lang: 'en' }),
    shell(p.crumbs, p.inner, p.alternate, 'en'), 'en'));
}

// ---------- Accueil ----------
// Les deux outils phares d'abord, puis « Tous les outils » : ce sont les liens que Google reprend
// en liens annexes (sitelinks) sous le résultat principal.
const featured = FEATURED_TOOLS.map((id) => TOOL_PAGES.find((t) => t.id === id)).filter(Boolean);
const others = TOOL_PAGES.filter((t) => !FEATURED_TOOLS.includes(t.id));
const ORG = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE}/#organization`,
  name: SITE_NAME,
  url: `${SITE}/`,
  logo: `${SITE}/favicon_atelierlogistique.png`,
  email: 'contact@atelierlogistique.com',
};
{
  const structured = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE}/#website`,
      name: SITE_NAME,
      alternateName: ['atelierlogistique.com', 'Atelier Logistique – outils supply chain'],
      url: `${SITE}/`,
      inLanguage: 'fr',
      description: HOME_PAGE.description,
      publisher: { '@id': `${SITE}/#organization` },
    },
    ORG,
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Outils Atelier Logistique',
      itemListElement: [...featured.map((t) => ({ name: t.name, url: SITE + toolPath(t.id) })), { name: ALL_TOOLS_PAGE.h1, url: SITE + ALL_TOOLS_PAGE.path }]
        .map((x, i) => ({ '@type': 'SiteNavigationElement', position: i + 1, name: x.name, url: x.url })),
    },
  ];
  const inner = `
    <div><h1 class="font-bold text-3xl">${esc(HOME_PAGE.h1)}</h1><p class="text-slate-600 mt-2">${esc(HOME_PAGE.intro)}</p></div>
    <section><h2 class="font-bold text-xl mb-2">Outils phares</h2>${links(featured.map((t) => ({ href: toolPath(t.id), label: t.name, desc: t.intro })))}</section>
    <section><h2 class="font-bold text-xl mb-2"><a class="underline" href="${ALL_TOOLS_PAGE.path}">${esc(ALL_TOOLS_PAGE.h1)}</a></h2>${links(others.map((t) => ({ href: toolPath(t.id), label: t.name })))}</section>`;
  write('/', page(head({ path: '/', title: HOME_PAGE.title, description: HOME_PAGE.description, structured, alternate: '/en' }), shell([], inner, '/en')));
}

// ---------- Palettisation + chargement (page dédiée) ----------
{
  const L = LOAD_LANDING_PAGE;
  const structured = [{
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: L.title,
    url: SITE + L.path,
    inLanguage: 'fr',
    description: L.description,
    isPartOf: { '@id': `${SITE}/#website` },
    about: ['Palettisation', 'Plan de chargement camion', 'Mètre plancher', 'Contrôle des factures transport'],
  }, {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Palettisation et chargement', item: SITE + L.path },
    ],
  }];
  const tools = ['optimiseur-chargement', 'pallet'].map((id) => TOOL_PAGES.find((t) => t.id === id)).filter(Boolean);
  const inner = `
    <div><h1 class="font-bold text-3xl">${esc(L.h1)}</h1><p class="text-slate-600 mt-2">${esc(L.intro)}</p></div>
    <section><h2 class="font-bold text-xl mb-2">Les outils</h2>${links(tools.map((t) => ({ href: toolPath(t.id), label: t.name, desc: t.intro })))}</section>
    <section><h2 class="font-bold text-xl mb-2">Coûts transport</h2><p>Mètres plancher et poids taxable, transporteurs et grilles (agence, tournée, zone), transporteur le moins cher, surcharge gazole mensuelle et contrôle des factures. <a class="underline" href="/ressources/controle-factures-transport">La méthode de pré-facturation</a>.</p></section>`;
  write(L.path, page(head({ path: L.path, title: L.title, description: L.description, structured }), shell([{ label: 'Palettisation et chargement' }], inner)));
}

// ---------- Tous les outils ----------
{
  const structured = [{
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: ALL_TOOLS_PAGE.title,
    url: SITE + ALL_TOOLS_PAGE.path,
    inLanguage: 'fr',
    isPartOf: { '@id': `${SITE}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: TOOL_PAGES.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: SITE + toolPath(t.id) })),
    },
  }, {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: ALL_TOOLS_PAGE.h1, item: SITE + ALL_TOOLS_PAGE.path },
    ],
  }];
  const inner = `
    <div><h1 class="font-bold text-3xl">${esc(ALL_TOOLS_PAGE.h1)}</h1><p class="text-slate-600 mt-2">${esc(ALL_TOOLS_PAGE.intro)}</p></div>
    <section>${links([...featured, ...others].map((t) => ({ href: toolPath(t.id), label: t.name, desc: t.intro })))}</section>`;
  write(ALL_TOOLS_PAGE.path, page(head({ path: ALL_TOOLS_PAGE.path, title: ALL_TOOLS_PAGE.title, description: ALL_TOOLS_PAGE.description, structured }), shell([{ label: ALL_TOOLS_PAGE.h1 }], inner)));
}

// ---------- Ressources ----------
{
  const inner = `
    <div><h1 class="font-bold text-3xl">${esc(RESSOURCES_PAGE.h1)}</h1><p class="text-slate-600 mt-2">${esc(RESSOURCES_PAGE.intro)}</p></div>
    <section>${links([...ARTICLE_PAGES.map((a) => ({ href: `/ressources/${a.slug}`, label: a.title })), { href: CAPACITY_HUB.path, label: CAPACITY_HUB.title }])}</section>`;
  write(RESSOURCES_PAGE.path, page(head({ path: RESSOURCES_PAGE.path, title: RESSOURCES_PAGE.title, description: RESSOURCES_PAGE.description }), shell([{ label: 'Ressources' }], inner)));
}

// ---------- Menu des articles statiques (dist/ressources/*.html) ----------
// Les guides sont écrits à la main ; leur menu d'en-tête est remplacé ici par le menu commun
// (src/seo/nav.js), pour qu'il n'existe qu'une seule définition du menu.
{
  const MARK = '<div class="hidden md:flex items-center gap-5 font-jetbrains text-xs text-slate-500">';
  const dir = join(dist, 'ressources');
  let patched = 0;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.html') && n !== 'index.html')) {
    const file = join(dir, f);
    const html = readFileSync(file, 'utf8');
    const start = html.indexOf(MARK);
    if (start < 0) { console.warn(`Menu non remplacé : ${f}`); continue; }
    // Fin du bloc : on équilibre les <div> ouvrants / fermants.
    let depth = 0;
    let i = start;
    const re = /<div\b|<\/div>/g;
    re.lastIndex = start;
    let m;
    while ((m = re.exec(html))) {
      depth += m[0] === '</div>' ? -1 : 1;
      if (depth === 0) { i = m.index + m[0].length; break; }
    }
    let out = html.slice(0, start) + navHtml() + html.slice(i);
    // Nom du site aux couleurs du logo (source : src/seo/brand.js).
    out = out.replace(/<div class="font-bricolage font-bold text-lg tracking-tight text-slate-900">ATELIER LOGISTIQUE<\/div>\s*<div class="font-jetbrains text-\[10px\] text-slate-500 -mt-1 tracking-wider">[^<]*<\/div>/, wordmarkHtml());
    writeFileSync(file, out);
    patched++;
  }
  console.log(`Menu commun appliqué à ${patched} guide(s)`);
}

// ---------- Pages « Combien de palettes dans un … » ----------
const capacityPaths = writeCapacityPages(root, dist);
console.log(`Capacités : ${capacityPaths.length} pages (FR + EN)`);
const enPaths = writeEnPages(dist);
console.log(`Pages anglaises : ${enPaths.length + enTools.length}`);

// ---------- Sitemap ----------
{
  const today = new Date().toISOString().slice(0, 10);
  // On conserve la date de mise à jour des guides déclarée dans public/sitemap.xml.
  const prev = existsSync(join(root, 'public', 'sitemap.xml')) ? readFileSync(join(root, 'public', 'sitemap.xml'), 'utf8') : '';
  const lastmodOf = (loc) => new RegExp(`<loc>${loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>\\s*<lastmod>([^<]+)</lastmod>`).exec(prev)?.[1] ?? today;
  const entries = [
    { loc: `${SITE}/`, lastmod: today, freq: 'weekly', prio: '1.0' },
    { loc: SITE + ALL_TOOLS_PAGE.path, lastmod: today, freq: 'weekly', prio: '0.9' },
    { loc: SITE + LOAD_LANDING_PAGE.path, lastmod: today, freq: 'weekly', prio: '0.95' },
    ...TOOL_PAGES.map((t) => ({ loc: SITE + toolPath(t.id), lastmod: today, freq: 'monthly', prio: ['optimiseur-chargement', 'pallet'].includes(t.id) ? '0.9' : '0.7' })),
    { loc: `${SITE}/ressources`, lastmod: today, freq: 'weekly', prio: '0.8' },
    ...ARTICLE_PAGES.map((a) => ({ loc: `${SITE}/ressources/${a.slug}`, lastmod: lastmodOf(`${SITE}/ressources/${a.slug}`), freq: 'monthly', prio: '0.8' })),
    ...capacityPaths.map((p) => ({ loc: SITE + p, lastmod: today, freq: 'monthly', prio: p === CAPACITY_HUB.path || p === '/en/capacity' ? '0.8' : '0.6' })),
    ...[...enPaths, ...enTools.map((p) => p.path)].map((p) => ({ loc: SITE + p, lastmod: today, freq: 'monthly', prio: '0.8' })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `  <url><loc>${e.loc}</loc><lastmod>${e.lastmod}</lastmod><changefreq>${e.freq}</changefreq><priority>${e.prio}</priority></url>`).join('\n')}
</urlset>
`;
  writeFileSync(join(dist, 'sitemap.xml'), xml);
}

console.log(`Pré-rendu : ${TOOL_PAGES.length + 4} pages + sitemap.xml`);
