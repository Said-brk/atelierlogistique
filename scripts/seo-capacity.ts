// Génère src/seo/capacity-data.json : nombre de palettes au sol par véhicule et par type de palette.
// Calcul : meilleur des deux méthodes (plan 2D guillotine de la palettisation, moteur 3D de l'optimiseur),
// avec un jeu de manutention (30 mm en longueur, 20 mm en largeur) : on ne promet pas un chargement
// « au millimètre » impossible sur le quai.
// Lancer : npx vite-node scripts/seo-capacity.ts
import { writeFileSync } from 'node:fs';
import { CONTAINER_PRESETS } from '../src/outils/optimiseur-chargement/constants/containers';
import { DEFAULT_FLEET } from '../src/outils/optimiseur-chargement/constants/fleet';
import { optimize } from '../src/outils/optimiseur-chargement/engine/optimizer';
import { bestLayerPattern } from '../src/outils/palettisation/engine/layerPattern';

const VEHICLES = [
  { slug: 'semi-remorque', id: 'semi', name: 'semi-remorque', art: 'une', short: 'Semi-remorque' },
  { slug: 'conteneur-20-pieds', id: '20ft', name: 'conteneur 20 pieds', short: 'Conteneur 20’' },
  { slug: 'conteneur-40-pieds', id: '40ft', name: 'conteneur 40 pieds', short: 'Conteneur 40’' },
  { slug: 'conteneur-40-pieds-high-cube', id: '40hc', name: 'conteneur 40 pieds High Cube', short: 'Conteneur 40’ HC' },
  { slug: 'porteur-19-tonnes', id: 'porteur19', name: 'porteur 19 tonnes', short: 'Porteur 19 t' },
  { slug: 'porteur-12-tonnes', id: 'porteur12', name: 'porteur 12 tonnes', short: 'Porteur 12 t' },
  { slug: 'fourgon-20-m3', id: 'fourgon20', name: 'fourgon 20 m³', short: 'Fourgon 20 m³' },
];
const PALLETS = [
  { slug: 'europe', name: 'palettes Europe (EUR / EPAL)', short: 'EUR 120 × 80', length: 1200, width: 800, tare: 25 },
  { slug: 'iso-120x100', name: 'palettes ISO 120 × 100 (EUR3)', short: 'EUR3 120 × 100', length: 1200, width: 1000, tare: 30 },
  { slug: 'demi-palettes', name: 'demi-palettes 80 × 60', short: 'Demi 80 × 60', length: 800, width: 600, tare: 10 },
  { slug: 'us-48x40', name: 'palettes US 48 × 40 pouces', short: 'US 48 × 40', length: 1219, width: 1016, tare: 23 },
];

const allContainers = [...CONTAINER_PRESETS, ...DEFAULT_FLEET.map((f) => f.container)];
const out: unknown[] = [];
for (const v of VEHICLES) {
  const raw = allContainers.find((x) => x.id === v.id)!;
  const c = { ...raw, length: raw.length - 30, width: raw.width - 20 };
  for (const p of PALLETS) {
    // 1. Plan 2D (motifs en long, en travers et mixtes).
    const pat = bestLayerPattern(c.length, c.width, p.length, p.width, true);
    // 2. Moteur 3D (un seul niveau, palettes non gerbables).
    const r = optimize({ ...c, height: 1200, maxWeight: null }, [{ id: 'p', reference: 'P', quantity: 80, length: p.length, width: p.width, height: 1000, weight: 0, rotationMode: 'HORIZONTAL', stackable: false }], { loading: { mode: 'FREE' } });
    const use3d = r.packedItems > pat.count;
    const boxes = use3d
      ? r.placedItems.map((b) => ({ x: b.x, y: b.y, w: b.length, d: b.width }))
      : pat.boxes;
    const floor = boxes.length;
    const along = boxes.filter((b) => Math.abs(b.w - p.length) < 1).length; // 120 dans le sens de la longueur
    const usedArea = floor * p.length * p.width;
    out.push({
      slug: `palettes-${p.slug}-${v.slug}`, vehicle: { ...v, length: raw.length, width: raw.width, height: raw.height, maxWeight: raw.maxWeight },
      pallet: p, floor, along, across: floor - along, double: floor * 2, maxStackHeight: Math.floor(c.height / 2 / 10) * 10,
      floorFill: usedArea / (raw.length * raw.width),
      maxWeightPerPallet: c.maxWeight ? Math.floor(c.maxWeight / floor) : null,
      slackLength: Math.round(raw.length - Math.max(...boxes.map((b) => b.x + b.w))),
      boxes: boxes.map((b) => [Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.d)]),
    });
    console.log(v.slug.padEnd(30), p.slug.padEnd(14), floor, `(2D ${pat.count} / 3D ${r.packedItems})`);
  }
}
writeFileSync(new URL('../src/seo/capacity-data.json', import.meta.url), JSON.stringify(out));
