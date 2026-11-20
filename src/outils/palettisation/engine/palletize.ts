// Moteur de palettisation.
//
// Méthode « terrain » :
//  1. Palettes complètes mono-référence : meilleur plan de couche (motif croisé),
//     couches alternées à 180°, charge centrée. Faciles à préparer, à contrôler
//     et à étiqueter (un SSCC = une référence).
//  2. Reliquats : palettes mixtes calculées par le moteur 3D de l'optimiseur de
//     chargement (support, empilage, rotations, poids), lourds et gros en bas.
//  3. Une palette ne mélange jamais deux arrêts (option, activée par défaut).

import { optimize } from '../../optimiseur-chargement/engine/optimizer';
import { getOrientations, rotationAngles } from '../../optimiseur-chargement/engine/rotations';
import type { ContainerDefinition, Dimensions, ItemDefinition, PlacedItem } from '../../optimiseur-chargement/engine/types';
import { bestLayerPattern, centerPattern, rotatePattern180, type LayerPattern } from './layerPattern';
import type { PalletContent, PalletizeOptions, PalletizeResult, PalletPlan, PalletSpec, UnplacedLine } from './types';

/**
 * Pondérations pour une palette mixte : on remplit couche par couche (forte pénalité
 * de hauteur) pour obtenir une palette basse, stable et filmable, pas des colonnes.
 */
const MIXED_SCORING = { floorPenalty: 8, originDistancePenalty: 1, wastedSpacePenalty: 2, contactBonus: 1.5 };

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Volume utile d'une palette vu comme un « contenant » pour le moteur 3D. */
export function palletContainer(p: PalletSpec): ContainerDefinition {
  return {
    id: `pallet-${p.id}`,
    label: p.label,
    length: p.length,
    width: p.width,
    height: Math.max(0, p.maxTotalHeight - p.deckHeight),
    maxWeight: p.maxLoad,
  };
}

interface FullPlan {
  orientation: Dimensions;
  pattern: LayerPattern;
  layers: number;
  capacity: number;
}

/**
 * Meilleure palette complète pour une référence : on essaie chaque orientation
 * autorisée (colis debout d'abord), plan de couche optimal, nombre de couches
 * limité par la hauteur, le poids et l'empilage.
 */
export function bestFullPallet(def: ItemDefinition, pallet: PalletSpec): FullPlan | null {
  const availH = pallet.maxTotalHeight - pallet.deckHeight;
  const orientations = getOrientations({ length: def.length, width: def.width, height: def.height }, def.rotationMode);
  // Une seule orientation par hauteur : le plan de couche gère le pivot au sol.
  const byHeight = new Map<number, Dimensions>();
  for (const o of orientations) if (!byHeight.has(o.height)) byHeight.set(o.height, o);

  let best: FullPlan | null = null;
  for (const o of byHeight.values()) {
    if (o.height > availH) continue;
    const pattern = centerPattern(
      bestLayerPattern(pallet.length, pallet.width, o.length, o.width, def.rotationMode !== 'NONE'),
      pallet.length, pallet.width,
    );
    if (pattern.count === 0) continue;
    let layers = Math.floor(availH / o.height + 1e-9);
    if (!def.stackable || def.floorOnly) layers = Math.min(layers, 1);
    const layerWeight = pattern.count * def.weight;
    if (layerWeight > 0) layers = Math.min(layers, Math.floor(pallet.maxLoad / layerWeight + 1e-9));
    if (layers < 1) continue;
    const capacity = pattern.count * layers;
    // À capacité égale, la palette la plus basse (plus stable) l'emporte.
    if (!best || capacity > best.capacity || (capacity === best.capacity && o.height * layers < best.orientation.height * best.layers)) {
      best = { orientation: o, pattern, layers, capacity };
    }
  }
  return best;
}

function buildFullPallet(def: ItemDefinition, plan: FullPlan, pallet: PalletSpec, index: number): PalletPlan {
  const original = { length: def.length, width: def.width, height: def.height };
  const placed: PlacedItem[] = [];
  const alt = rotatePattern180(plan.pattern, pallet.length, pallet.width);
  let seq = 0;
  for (let l = 0; l < plan.layers; l++) {
    const layer = l % 2 === 0 ? plan.pattern : alt;
    for (const b of layer.boxes) {
      const oriented = { length: b.w, width: b.d, height: plan.orientation.height };
      seq++;
      placed.push({
        id: `${def.id}#P${index}-${seq}`,
        definitionId: def.id,
        reference: def.reference,
        x: b.x, y: b.y, z: l * plan.orientation.height,
        length: b.w, width: b.d, height: plan.orientation.height,
        originalLength: def.length, originalWidth: def.width, originalHeight: def.height,
        rotation: rotationAngles(original, oriented),
        weight: def.weight,
        stackable: def.stackable,
        stop: def.stop ?? 1,
        destination: def.destination ?? '',
        sequence: seq,
        wall: 0,
      });
    }
  }
  return finalizePallet(pallet, index, 'FULL', placed, plan.layers, plan.pattern.count);
}

function finalizePallet(
  pallet: PalletSpec, index: number, kind: PalletPlan['kind'], placed: PlacedItem[], layers = 0, perLayer = 0,
): PalletPlan {
  const loadHeight = placed.reduce((m, p) => Math.max(m, p.z + p.height), 0);
  const loadWeight = Math.round(placed.reduce((s, p) => s + p.weight, 0) * 1000) / 1000;
  const vol = placed.reduce((s, p) => s + p.length * p.width * p.height, 0);
  const floorArea = placed.filter((p) => p.z < 1e-6).reduce((s, p) => s + p.length * p.width, 0);
  const contentsMap = new Map<string, PalletContent>();
  for (const p of placed) {
    const c = contentsMap.get(p.definitionId) ?? { definitionId: p.definitionId, reference: p.reference, quantity: 0 };
    c.quantity++;
    contentsMap.set(p.definitionId, c);
  }
  const first = placed[0];
  const totalHeight = pallet.deckHeight + loadHeight;
  return {
    index,
    id: `PAL-${String(index).padStart(3, '0')}`,
    kind,
    stop: first?.stop ?? 1,
    destination: first?.destination ?? '',
    placed,
    contents: [...contentsMap.values()].sort((a, b) => b.quantity - a.quantity),
    layers,
    perLayer,
    loadHeight,
    totalHeight,
    loadWeight,
    totalWeight: Math.round((loadWeight + pallet.tare) * 1000) / 1000,
    volumeFill: loadHeight > 0 ? vol / (pallet.length * pallet.width * loadHeight) : 0,
    areaFill: floorArea / (pallet.length * pallet.width),
    stackable: placed.length > 0 && placed.every((p) => p.stackable),
    overLimit: totalHeight > pallet.maxTotalHeight + 1e-6 || loadWeight > pallet.maxLoad + 1e-6,
  };
}

/** Recentre une palette mixte : le moteur 3D cale la charge dans un angle. */
function centerPlaced(placed: PlacedItem[], pallet: PalletSpec): PlacedItem[] {
  if (placed.length === 0) return placed;
  const maxX = Math.max(...placed.map((p) => p.x + p.length));
  const maxY = Math.max(...placed.map((p) => p.y + p.width));
  const dx = (pallet.length - maxX) / 2;
  const dy = (pallet.width - maxY) / 2;
  return placed.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
}

/** Raison pour laquelle un colis ne peut aller sur aucune palette. */
export function unplaceableReason(def: ItemDefinition, pallet: PalletSpec): string | null {
  const availH = pallet.maxTotalHeight - pallet.deckHeight;
  if (def.weight > pallet.maxLoad) return 'plus lourd que la charge maxi de la palette';
  const fits = getOrientations({ length: def.length, width: def.width, height: def.height }, def.rotationMode)
    .some((o) => o.length <= pallet.length && o.width <= pallet.width && o.height <= availH);
  if (!fits) return 'plus grand que la palette ou que la hauteur maxi';
  return null;
}

/** Regroupe des définitions par arrêt (ou un seul groupe). */
function groupByStop(defs: ItemDefinition[], separate: boolean): ItemDefinition[][] {
  if (!separate) return [defs];
  const map = new Map<number, ItemDefinition[]>();
  for (const d of defs) {
    const s = d.stop ?? 1;
    if (!map.has(s)) map.set(s, []);
    map.get(s)!.push(d);
  }
  return [...map.keys()].sort((a, b) => a - b).map((k) => map.get(k)!);
}

export function palletize(
  definitions: readonly ItemDefinition[], pallet: PalletSpec, options: PalletizeOptions = {},
): PalletizeResult {
  const t0 = now();
  const fullFirst = options.fullPalletsFirst !== false;
  const separate = options.separateStops !== false;
  const allowMixed = options.allowMixed !== false;

  const pallets: PalletPlan[] = [];
  const unplaced: UnplacedLine[] = [];
  const valid: ItemDefinition[] = [];
  for (const d of definitions) {
    if (d.quantity <= 0) continue;
    const reason = unplaceableReason(d, pallet);
    if (reason) unplaced.push({ definitionId: d.id, reference: d.reference, quantity: d.quantity, reason });
    else valid.push(d);
  }

  const container = palletContainer(pallet);

  for (const group of groupByStop(valid, separate)) {
    // 1. Palettes complètes
    const pool = new Map<string, ItemDefinition>();
    for (const d of group) {
      let remaining = d.quantity;
      if (fullFirst) {
        const plan = bestFullPallet(d, pallet);
        if (plan) {
          while (remaining >= plan.capacity) {
            pallets.push(buildFullPallet(d, plan, pallet, pallets.length + 1));
            remaining -= plan.capacity;
          }
        }
      }
      if (remaining > 0) pool.set(d.id, { ...d, quantity: remaining });
    }

    // 2. Reliquats : palettes mixtes, une à une, jusqu'à épuisement.
    if (!allowMixed) {
      for (const d of pool.values()) unplaced.push({ definitionId: d.id, reference: d.reference, quantity: d.quantity, reason: 'reliquat (palettes mixtes désactivées)' });
      continue;
    }
    let guard = 0;
    while (pool.size > 0 && guard++ < 500) {
      const r = optimize(container, [...pool.values()], { loading: { mode: 'FREE', scoring: MIXED_SCORING }, deliveryMode: 'SOFT' });
      if (r.packedItems === 0) {
        for (const d of pool.values()) unplaced.push({ definitionId: d.id, reference: d.reference, quantity: d.quantity, reason: 'ne trouve pas de place stable' });
        break;
      }
      const index = pallets.length + 1;
      const placed = centerPlaced(r.placedItems, pallet).map((p, i) => ({ ...p, id: `${p.definitionId}#P${index}-${i + 1}` }));
      pallets.push(finalizePallet(pallet, index, 'MIXED', placed));
      const left = new Map<string, number>();
      for (const u of r.unpackedItems) left.set(u.definitionId, (left.get(u.definitionId) ?? 0) + 1);
      for (const [id, d] of [...pool]) {
        const q = left.get(id) ?? 0;
        if (q === 0) pool.delete(id); else pool.set(id, { ...d, quantity: q });
      }
    }
  }

  const totalItems = definitions.reduce((s, d) => s + Math.max(0, d.quantity), 0);
  const palletizedItems = pallets.reduce((s, p) => s + p.placed.length, 0);
  return { pallets, unplaced, totalItems, palletizedItems, computationTimeMs: Math.round(now() - t0) };
}
