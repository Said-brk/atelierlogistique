// Nom du site aux couleurs du logo « Itinéraire » : source unique (React + HTML statique).
//   ATELIER = marine du tracé, LOGISTIQUE = bleu des étapes, SUPPLY CHAIN = orange du sommet
//   (orange foncé #D97706 pour rester lisible en petit sur fond blanc).

export const BRAND_COLORS = { navy: '#0F172A', blue: '#2563EB', amber: '#D97706', muted: '#64748B' };
export const TAGLINE = ['BOÎTE À OUTILS', 'SUPPLY CHAIN'];

/** Version HTML (articles statiques, pages pré-rendues). lang : 'fr' | 'en'. */
export function wordmarkHtml(lang = 'fr') {
  const c = BRAND_COLORS;
  const tag = lang === 'en'
    ? `<span style="color:${c.amber};font-weight:600">SUPPLY CHAIN</span> <span style="color:${c.muted}">TOOLBOX</span>`
    : `<span style="color:${c.muted}">${TAGLINE[0]}</span> <span style="color:${c.amber};font-weight:600">${TAGLINE[1]}</span>`;
  return `<div class="font-bricolage font-bold text-lg tracking-tight"><span style="color:${c.navy}">ATELIER</span> <span style="color:${c.blue}">LOGISTIQUE</span></div>
          <div class="font-jetbrains text-[10px] -mt-1 tracking-wider">${tag}</div>`;
}
