// Fiche de chargement : une étape par mur, lisible sans couleur d'arrêt.
//   · repère : où se trouve le mur dans le camion (vue de dessus, mur en couleur, murs déjà chargés en gris) ;
//   · vue de face, comme le cariste la voit depuis les portes : chaque colis numéroté dans l'ordre de chargement ;
//   · liste : n°, référence, position (droite / centre / gauche, au sol / en hauteur).
// Les numéros sont ceux du guide cariste (QR code) : « Colis 12 / 27 ».

import { t, numLocale } from '../../../shared/i18n/core';

const m = (mm) => (mm / 1000).toLocaleString(numLocale(), { maximumFractionDigits: 2 });

/** Position vue depuis les portes, tourné vers la cabine (même règle que le guide cariste). */
export function wherePlaced(p, W) {
  const cy = p.y + p.width / 2;
  const side = cy < W / 3 ? t('à droite') : cy > (2 * W) / 3 ? t('à gauche') : t('au centre');
  const level = p.z < 10 ? t('au sol') : t('en hauteur (sur {v1} m)', { v1: m(p.z) });
  return `${side} · ${level}`;
}

// Repère : le camion vu de dessus, ce mur en couleur, les précédents en gris clair.
function WallLocator({ container, placed, wall }) {
  const S = 300 / container.length; const W = container.length * S; const H = container.width * S;
  return (
    <svg viewBox={`-2 -2 ${W + 4} ${H + 14}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <rect x="0" y="0" width={W} height={H} fill="#fff" stroke="#94A3B8" strokeWidth="1" />
      {placed.filter((p) => p.wall <= wall).map((p) => (
        <rect key={p.id} x={p.x * S} y={p.y * S} width={p.length * S} height={p.width * S}
          fill={p.wall === wall ? '#2563EB' : '#E2E8F0'} stroke="#fff" strokeWidth="0.6" opacity={p.wall === wall ? 0.85 : 1} />
      ))}
      <line x1={W} y1="0" x2={W} y2={H} stroke="#F59E0B" strokeWidth="3" />
      <text x="2" y={H + 10} fontSize="8" fill="#64748B">{t('Cabine')}</text>
      <text x={W} y={H + 10} fontSize="8" fill="#B45309" textAnchor="end">{t('Portes')}</text>
    </svg>
  );
}

// Vue de face depuis les portes : largeur × hauteur (droite du camion à droite de l'image).
function WallFront({ container, items, colorOf }) {
  const S = 300 / container.width; const W = container.width * S; const H = container.height * S;
  const sorted = [...items].sort((a, b) => (b.x + b.length) - (a.x + a.length)); // le plus proche des portes dessiné en dernier
  return (
    <svg viewBox={`-2 -2 ${W + 4} ${H + 4}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <rect x="0" y="0" width={W} height={H} fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1" />
      {sorted.map((p) => {
        const x = (container.width - p.y - p.width) * S; const y = (container.height - p.z - p.height) * S; // y = 0 : à droite
        const w = p.width * S; const h = p.height * S;
        const c = colorOf(p);
        const fs = Math.max(7, Math.min(18, w * 0.42, h * 0.5));
        return (
          <g key={p.id}>
            <rect x={x} y={y} width={w} height={h} fill={c.light} stroke={c.dark} strokeWidth="1.2" />
            <text x={x + w / 2} y={y + h / 2 + fs * 0.35} fontSize={fs} fontWeight="700" textAnchor="middle" fill="#0F172A">{p.sequence}</text>
          </g>
        );
      })}
      <line x1="0" y1={H} x2={W} y2={H} stroke="#0F172A" strokeWidth="2" />
    </svg>
  );
}

const ov = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
/** Colis sur lequel celui-ci est posé (le plus grand appui), pour « sur le n° X ». */
function restsOn(p, items) {
  if (p.z < 10) return null;
  let best = null, area = 0;
  for (const q of items) {
    if (q.id === p.id || Math.abs(q.z + q.height - p.z) > 5) continue;
    const a = ov(p.x, p.x + p.length, q.x, q.x + q.length) * ov(p.y, p.y + p.width, q.y, q.y + q.width);
    if (a > area) { area = a; best = q; }
  }
  return best;
}

// Vue de dessus du mur seul (cabine à gauche, portes à droite ; droite du camion en haut, comme vu
// depuis les portes). Colis au sol numérotés ; ceux posés dessus apparaissent en pointillés.
function WallTop({ container, wall, items, colorOf }) {
  const depth = Math.max(1, wall.xEnd - wall.xStart);
  const S = 220 / Math.max(depth, container.width); const W = depth * S; const H = container.width * S;
  const sorted = [...items].sort((a, b) => a.z - b.z);
  return (
    <svg viewBox={`-2 -2 ${W + 4} ${H + 4}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <rect x="0" y="0" width={W} height={H} fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1" />
      {sorted.map((p) => {
        const x = (p.x - wall.xStart) * S; const y = p.y * S; const w = p.length * S; const h = p.width * S;
        const c = colorOf(p); const floor = p.z < 10;
        const fs = Math.max(7, Math.min(16, w * 0.4, h * 0.45));
        return (
          <g key={p.id}>
            <rect x={x} y={y} width={w} height={h} fill={floor ? c.light : 'none'} stroke={c.dark} strokeWidth={floor ? 1.2 : 1} strokeDasharray={floor ? undefined : '3 2'} />
            {floor && <text x={x + w / 2} y={y + h / 2 + fs * 0.35} fontSize={fs} fontWeight="700" textAnchor="middle" fill="#0F172A">{p.sequence}</text>}
          </g>
        );
      })}
      <line x1={W} y1="0" x2={W} y2={H} stroke="#F59E0B" strokeWidth="3" />
    </svg>
  );
}

export default function WallSteps({ container, placed, walls, colorOf }) {
  if (!walls?.length) return null;
  const total = placed.length;
  return (
    <div>
      <div className="lo-sheet-head">
      <strong style={{ fontSize: 14 }}>{t('Pas à pas, mur par mur')}</strong>
      <div style={{ fontSize: 10, color: '#64748B', margin: '2px 0 8px' }}>
        {t('Vue de face, comme depuis les portes. Chargez les colis dans l’ordre des numéros ({n} au total), du sol vers le haut.', { n: total })}
      </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {walls.map((w) => {
          const items = placed.filter((p) => p.wall === w.wall).sort((a, b) => a.sequence - b.sequence);
          if (!items.length) return null;
          return (
            <div key={w.wall} className="lo-stop" style={{ border: '1px solid #CBD5E1', borderRadius: 6, padding: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>
                  <span style={{ background: '#0F172A', color: '#fff', borderRadius: 4, padding: '1px 6px', marginRight: 6 }}>{t('Mur {n}', { n: w.wall })}</span>
                  {t('n° {a} → {b}', { a: items[0].sequence, b: items[items.length - 1].sequence })}
                </span>
                <span style={{ fontSize: 9, color: '#64748B' }}>{t('{a} → {b} m depuis la cabine', { a: m(w.xStart), b: m(w.xEnd) })}</span>
              </div>
              <WallLocator container={container} placed={placed} wall={w.wall} />
              <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 7, color: '#64748B', marginBottom: 1 }}>{t('AU SOL · VU DE DESSUS')}</div>
                  <div style={{ fontSize: 7, color: '#64748B', textAlign: 'center' }}>{t('Droite')}</div>
                  <WallTop container={container} wall={w} items={items} colorOf={colorOf} />
                  <div style={{ fontSize: 7, color: '#64748B', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t('← Cabine')}</span><span>{t('Gauche')}</span><span style={{ color: '#B45309' }}>{t('Portes →')}</span>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 7, color: '#64748B', marginBottom: 1 }}>{t('VUE DE FACE · DEPUIS LES PORTES')}</div>
                  <WallFront container={container} items={items} colorOf={colorOf} />
                  <div style={{ fontSize: 7, color: '#64748B', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t('Gauche')}</span><span>{t('Droite')}</span>
                  </div>
                </div>
              </div>
              <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 6 }}>
                <tbody>
                  {items.map((p) => {
                    const on = restsOn(p, items);
                    return (
                      <tr key={p.id}>
                        <td style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px 1px 0', verticalAlign: 'top', width: 18 }}>{p.sequence}</td>
                        <td style={{ fontSize: 9, padding: '1px 5px 1px 0', verticalAlign: 'top' }}>
                          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: colorOf(p).solid, marginRight: 3 }} />
                          {p.reference}
                        </td>
                        <td style={{ fontSize: 8, color: '#475569', padding: '1px 0', verticalAlign: 'top' }}>
                          {wherePlaced(p, container.width)}
                          {on && <b>{t(' · sur le n° {n}', { n: on.sequence })}</b>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
