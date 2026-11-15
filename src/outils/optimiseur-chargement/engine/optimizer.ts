import type {
  Box,
  ContainerDefinition,
  ItemDefinition,
  ItemInstance,
  OptimizationResult,
  OptimizeOptions,
  PlacedItem,
} from './types';
import { EPS, MIN_SUPPORT_RATIO } from '../constants/engine-config';
import { collidesWithAny, isWithinContainer } from './collision';
import { isStable, supportRatio } from './support';
import { getOrientations, rotationAngles } from './rotations';
import { scorePlacement } from './scoring';
import { STRATEGIES } from './strategies';

interface Point { x: number; y: number; z: number; }

/** Déplie chaque définition en autant d'unités que sa quantité. */
export function expandInstances(defs: readonly ItemDefinition[]): ItemInstance[] {
  const out: ItemInstance[] = [];
  for (const d of defs) {
    for (let i = 0; i < d.quantity; i++) {
      out.push({
        id: `${d.id}#${i}`,
        definitionId: d.id,
        reference: d.reference,
        dimensions: { length: d.length, width: d.width, height: d.height },
        weight: d.weight,
        rotationMode: d.rotationMode,
        stackable: d.stackable,
      });
    }
  }
  return out;
}

function toBox(p: PlacedItem): Box {
  return { x: p.x, y: p.y, z: p.z, length: p.length, width: p.width, height: p.height };
}

const pointKey = (p: Point): string => `${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.z)}`;

function dedupe(points: Point[]): Point[] {
  const seen = new Set<string>();
  const out: Point[] = [];
  for (const p of points) {
    const k = pointKey(p);
    if (!seen.has(k)) { seen.add(k); out.push(p); }
  }
  return out;
}

/** Meilleur emplacement d'une unité parmi les points candidats et orientations autorisées. */
function findBestPlacement(
  item: ItemInstance,
  container: ContainerDefinition,
  placed: readonly PlacedItem[],
  placedBoxes: readonly Box[],
  candidates: readonly Point[],
  currentWeight: number,
): { placed: PlacedItem; point: Point } | null {
  if (container.maxWeight !== null && currentWeight + item.weight > container.maxWeight + EPS) {
    return null;
  }

  const orientations = getOrientations(item.dimensions, item.rotationMode);
  let best: { placed: PlacedItem; point: Point; score: number } | null = null;

  for (const pt of candidates) {
    for (const o of orientations) {
      const box: Box = { x: pt.x, y: pt.y, z: pt.z, length: o.length, width: o.width, height: o.height };
      if (!isWithinContainer(box, container)) continue;
      if (collidesWithAny(box, placedBoxes)) continue;
      if (!isStable(box, placed, MIN_SUPPORT_RATIO)) continue;

      const score = scorePlacement(box, container, placed, supportRatio(box, placed));
      if (best === null || score < best.score) {
        best = {
          score,
          point: pt,
          placed: {
            id: item.id,
            definitionId: item.definitionId,
            reference: item.reference,
            x: box.x, y: box.y, z: box.z,
            length: box.length, width: box.width, height: box.height,
            originalLength: item.dimensions.length,
            originalWidth: item.dimensions.width,
            originalHeight: item.dimensions.height,
            rotation: rotationAngles(item.dimensions, o),
            weight: item.weight,
            stackable: item.stackable,
          },
        };
      }
    }
  }
  return best ? { placed: best.placed, point: best.point } : null;
}

/** Une passe de placement sur un ordre d'unités donné (heuristique extreme points). */
function packOnce(container: ContainerDefinition, ordered: readonly ItemInstance[]): OptimizationResult {
  const placed: PlacedItem[] = [];
  const placedBoxes: Box[] = [];
  const unpacked: ItemInstance[] = [];
  let weight = 0;
  let candidates: Point[] = [{ x: 0, y: 0, z: 0 }];

  for (const item of ordered) {
    const found = findBestPlacement(item, container, placed, placedBoxes, candidates, weight);
    if (!found) { unpacked.push(item); continue; }

    const p = found.placed;
    placed.push(p);
    placedBoxes.push(toBox(p));
    weight += item.weight;

    candidates = candidates.filter((c) => pointKey(c) !== pointKey(found.point));
    const generated: Point[] = [
      { x: p.x + p.length, y: p.y, z: p.z },
      { x: p.x, y: p.y + p.width, z: p.z },
      { x: p.x, y: p.y, z: p.z + p.height },
    ];
    for (const c of generated) {
      if (c.x < container.length - EPS && c.y < container.width - EPS && c.z < container.height - EPS) {
        candidates.push(c);
      }
    }
    candidates = dedupe(candidates);
  }

  return buildResult(container, placed, unpacked, weight);
}

function buildResult(
  container: ContainerDefinition,
  placed: PlacedItem[],
  unpacked: ItemInstance[],
  weight: number,
): OptimizationResult {
  const usedVolume = placed.reduce((s, p) => s + p.length * p.width * p.height, 0);
  const containerVolume = container.length * container.width * container.height;
  const hasWeightLimit = container.maxWeight !== null && container.maxWeight > 0;

  return {
    placedItems: placed,
    unpackedItems: unpacked,
    totalItems: placed.length + unpacked.length,
    packedItems: placed.length,
    unpackedCount: unpacked.length,
    usedVolume,
    containerVolume,
    volumeUtilization: containerVolume > 0 ? usedVolume / containerVolume : 0,
    usedWeight: weight,
    maxWeight: container.maxWeight,
    weightUtilization: hasWeightLimit ? weight / (container.maxWeight as number) : null,
    computationTimeMs: 0,
  };
}

function maxHeightUsed(r: OptimizationResult): number {
  let m = 0;
  for (const p of r.placedItems) m = Math.max(m, p.z + p.height);
  return m;
}

/**
 * Compare deux résultats. Retourne une valeur négative si `a` est meilleur que `b`.
 * Ordre : nb placés, volume placé, poids placé, puis compacité (hauteur utilisée).
 */
export function compareOptimizationResults(a: OptimizationResult, b: OptimizationResult): number {
  if (a.packedItems !== b.packedItems) return b.packedItems - a.packedItems;
  if (a.usedVolume !== b.usedVolume) return b.usedVolume - a.usedVolume;
  if (a.usedWeight !== b.usedWeight) return b.usedWeight - a.usedWeight;
  return maxHeightUsed(a) - maxHeightUsed(b);
}

/**
 * Point d'entrée du moteur. Essaie plusieurs ordres de tri et conserve le
 * meilleur résultat. Déterministe : mêmes entrées → même sortie.
 */
export function optimize(
  container: ContainerDefinition,
  definitions: readonly ItemDefinition[],
  _options: OptimizeOptions = {},
): OptimizationResult {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const instances = expandInstances(definitions);

  let best: OptimizationResult | null = null;
  for (const strategy of STRATEGIES) {
    const ordered = [...instances].sort(strategy.compare);
    const result = packOnce(container, ordered);
    if (best === null || compareOptimizationResults(result, best) < 0) best = result;
  }
  if (best === null) best = buildResult(container, [], [], 0);

  const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
  best.computationTimeMs = Math.round(end - start);
  return best;
}
