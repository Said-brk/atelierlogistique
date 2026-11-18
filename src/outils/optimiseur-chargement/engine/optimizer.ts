import type {
  Box,
  ContainerDefinition,
  DeliveryMode,
  ItemDefinition,
  ItemInstance,
  LoadingMode,
  OptimizationResult,
  OptimizeOptions,
  PlacedItem,
} from './types';
import { DELIVERY, EPS, MIN_SUPPORT_RATIO } from '../constants/engine-config';
import { countBlockers, findBlockedItems, normalizeStop, summarizeStops } from './delivery';
import { collidesWithAny, isWithinContainer } from './collision';
import { supportRatio, hasNonStackableBelow } from './support';
import { getOrientations, rotationAngles } from './rotations';
import { scorePlacement } from './scoring';
import { STRATEGIES } from './strategies';
import { findLoadingViolations, heightCap, isInFront, resolveLoading, summarizeWalls, type ResolvedLoading } from './loading';

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
        floorOnly: !!d.floorOnly,
        stop: normalizeStop(d.stop),
        destination: (d.destination ?? '').trim(),
      });
    }
  }
  return out;
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

// Index spatial par tranches le long de l'axe X (longueur du contenant) :
// un colis ne peut entrer en collision / supporter qu'avec des voisins
// dont l'intervalle X recouvre le sien. Évite le balayage de toutes les unités.
class SpatialIndex {
  private readonly cell: number;
  private readonly map = new Map<number, PlacedItem[]>();

  constructor(container: ContainerDefinition) {
    this.cell = Math.max(200, Math.round(container.length / 32));
  }

  private range(box: Box): [number, number] {
    return [Math.floor(box.x / this.cell) - 1, Math.floor((box.x + box.length) / this.cell) + 1];
  }

  insert(item: PlacedItem): void {
    const [a, b] = this.range(item);
    for (let i = a; i <= b; i++) {
      let arr = this.map.get(i);
      if (!arr) { arr = []; this.map.set(i, arr); }
      arr.push(item);
    }
  }

  /** Existe-t-il un colis déjà chargé entre `box` et les portes ? (sortie dès le premier trouvé) */
  anyInFront(box: Box, containerLength: number): boolean {
    const a = Math.floor((box.x + box.length) / this.cell) - 1;
    const b = Math.floor(containerLength / this.cell) + 1;
    for (let i = a; i <= b; i++) {
      const arr = this.map.get(i);
      if (!arr) continue;
      for (const it of arr) if (isInFront(it, box)) return true;
    }
    return false;
  }

  query(box: Box): PlacedItem[] {
    const [a, b] = this.range(box);
    const seen = new Set<PlacedItem>();
    const res: PlacedItem[] = [];
    for (let i = a; i <= b; i++) {
      const arr = this.map.get(i);
      if (arr) for (const it of arr) { if (!seen.has(it)) { seen.add(it); res.push(it); } }
    }
    return res;
  }
}

/** Un point candidat tombe-t-il dans le volume solide d'un colis déjà placé ? */
function coveredBy(c: Point, p: PlacedItem): boolean {
  return (
    c.x >= p.x - EPS && c.x < p.x + p.length - EPS &&
    c.y >= p.y - EPS && c.y < p.y + p.width - EPS &&
    c.z >= p.z - EPS && c.z < p.z + p.height - EPS
  );
}

/** Meilleur emplacement d'une unité parmi les points candidats et orientations autorisées. */
function findBestPlacement(
  item: ItemInstance,
  container: ContainerDefinition,
  index: SpatialIndex,
  candidates: readonly Point[],
  currentWeight: number,
  delivery: DeliveryContext,
  load: LoadState,
): { placed: PlacedItem; point: Point } | null {
  if (container.maxWeight !== null && currentWeight + item.weight > container.maxWeight + EPS) {
    return null;
  }

  const orientations = getOrientations(item.dimensions, item.rotationMode);
  const cap = heightCap(item, load.cfg, container);
  let best: { placed: PlacedItem; point: Point; score: number } | null = null;

  for (const pt of candidates) {
    for (const o of orientations) {
      const box: Box = { x: pt.x, y: pt.y, z: pt.z, length: o.length, width: o.width, height: o.height };
      if (!isWithinContainer(box, container)) continue;
      if (item.floorOnly && box.z > EPS) continue; // doit rester au sol
      if (box.z + box.height > cap + EPS) continue; // hauteur de manutention
      if (load.cfg.mode === 'WALLS' && box.x + box.length > load.wallEnd + EPS) {
        // Hors du mur en cours, sauf colis plus long que le mur lui-même.
        const oversize = box.length > load.cfg.wallDepth + EPS && box.x >= load.wallStart - EPS;
        if (!oversize) continue;
      }
      const nearby = index.query(box);
      if (collidesWithAny(box, nearby)) continue;
      const sr = supportRatio(box, nearby);
      if (box.z > EPS) {
        if (hasNonStackableBelow(box, nearby)) continue;
        if (sr < MIN_SUPPORT_RATIO - EPS) continue;
      }

      // Chargeabilité (mode par murs) : rien de déjà chargé entre ce colis et les portes.
      // En mode libre, on la mesure seulement a posteriori (loadingViolationIds).
      if (load.cfg.mode === 'WALLS' && box.x + box.length < load.maxX - EPS && index.anyInFront(box, container.length)) continue;

      let score = scorePlacement(box, container, nearby, sr);
      const blockers = countBlockers(box, delivery.later, delivery.laterMaxX);
      if (blockers > 0) {
        if (delivery.mode === 'STRICT') continue;
        score += DELIVERY.blockedPenalty * blockers;
      }
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
            stop: item.stop,
            destination: item.destination,
            sequence: 0,
            wall: 0,
          },
        };
      }
    }
  }
  return best ? { placed: best.placed, point: best.point } : null;
}

/** Colis déjà placés appartenant à des arrêts livrés APRÈS l'unité courante. */
interface DeliveryContext {
  mode: DeliveryMode;
  later: PlacedItem[];
  laterMaxX: number;
}

/** État du chargement physique pendant une passe. */
interface LoadState {
  cfg: ResolvedLoading;
  wallIndex: number;
  wallStart: number;
  wallEnd: number;
  /** Fin X maximale des colis déjà chargés (rejet rapide de la chargeabilité). */
  maxX: number;
}

/**
 * Une passe de placement sur un ordre d'unités donné (heuristique extreme points).
 * Les unités arrivent triées par arrêt décroissant : le dernier arrêt est chargé
 * en premier, au fond ; le premier arrêt en dernier, côté portes.
 *
 * Chargement LIBRE : chaque unité prend le meilleur emplacement disponible.
 * Chargement PAR MURS : on remplit le mur courant avec toutes les unités qui y
 * entrent (dans l'ordre de la stratégie), puis on avance d'un mur vers les portes.
 */
function packOnce(
  container: ContainerDefinition,
  ordered: readonly ItemInstance[],
  mode: DeliveryMode,
  cfg: ResolvedLoading,
): OptimizationResult {
  const placed: PlacedItem[] = [];
  const index = new SpatialIndex(container);
  const unpacked: ItemInstance[] = [];
  let weight = 0;
  let candidates: Point[] = [{ x: 0, y: 0, z: 0 }];
  const delivery: DeliveryContext = { mode, later: [], laterMaxX: 0 };
  const load: LoadState = {
    cfg,
    wallIndex: cfg.mode === 'WALLS' ? 1 : 0,
    wallStart: 0,
    wallEnd: cfg.mode === 'WALLS' ? Math.min(container.length, cfg.wallDepth) : container.length,
    maxX: 0,
  };

  const tryPlace = (item: ItemInstance): boolean => {
    const found = findBestPlacement(item, container, index, candidates, weight, delivery, load);
    if (!found) return false;
    const p = found.placed;
    p.sequence = placed.length + 1;
    p.wall = load.wallIndex;
    placed.push(p);
    index.insert(p);
    weight += item.weight;
    load.maxX = Math.max(load.maxX, p.x + p.length);

    candidates = candidates.filter((c) => pointKey(c) !== pointKey(found.point) && !coveredBy(c, p));
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
    return true;
  };

  // Regroupe par arrêt (l'ordre reçu est déjà par arrêt décroissant).
  const groups: ItemInstance[][] = [];
  for (const it of ordered) {
    const g = groups[groups.length - 1];
    if (g && g[0].stop === it.stop) g.push(it); else groups.push([it]);
  }

  for (const group of groups) {
    // Changement d'arrêt : tout ce qui est déjà chargé est livré plus tard.
    delivery.later = placed.filter((p) => p.stop > group[0].stop);
    delivery.laterMaxX = delivery.later.reduce((m, p) => Math.max(m, p.x + p.length), 0);

    if (cfg.mode === 'FREE') {
      for (const item of group) if (!tryPlace(item)) unpacked.push(item);
      continue;
    }

    let remaining = group;
    while (remaining.length > 0) {
      let placedAny = false;
      const failed = new Set<string>(); // une définition qui n'entre pas : inutile de réessayer ses copies
      const next: ItemInstance[] = [];
      for (const item of remaining) {
        if (failed.has(item.definitionId) || !tryPlace(item)) {
          failed.add(item.definitionId);
          next.push(item);
        } else {
          placedAny = true;
        }
      }
      remaining = next;
      if (!placedAny) {
        if (load.wallEnd >= container.length - EPS) break; // plus de mur disponible
        load.wallIndex++;
        load.wallStart = load.wallEnd;
        load.wallEnd = Math.min(container.length, load.wallStart + cfg.wallDepth);
      }
    }
    unpacked.push(...remaining);
  }

  return buildResult(container, placed, unpacked, weight, mode, cfg.mode);
}

function buildResult(
  container: ContainerDefinition,
  placed: PlacedItem[],
  unpacked: ItemInstance[],
  weight: number,
  mode: DeliveryMode,
  loadingMode: LoadingMode,
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
    stops: summarizeStops(placed, unpacked),
    blockedItemIds: findBlockedItems(placed),
    deliveryMode: mode,
    loadingMode,
    walls: summarizeWalls(placed),
    loadingViolationIds: findLoadingViolations(placed),
  };
}

function maxHeightUsed(r: OptimizationResult): number {
  let m = 0;
  for (const p of r.placedItems) m = Math.max(m, p.z + p.height);
  return m;
}

/**
 * Compare deux résultats. Retourne une valeur négative si `a` est meilleur que `b`.
 * Ordre : nb placés, colis bloqués (moins = mieux), volume placé, poids placé,
 * puis compacité (hauteur utilisée).
 */
export function compareOptimizationResults(a: OptimizationResult, b: OptimizationResult): number {
  if (a.packedItems !== b.packedItems) return b.packedItems - a.packedItems;
  const ba = a.blockedItemIds?.length ?? 0;
  const bb = b.blockedItemIds?.length ?? 0;
  if (ba !== bb) return ba - bb;
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
  options: OptimizeOptions = {},
): OptimizationResult {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const start = now();
  const instances = expandInstances(definitions);
  const mode: DeliveryMode = options.deliveryMode === 'SOFT' ? 'SOFT' : 'STRICT';
  const cfg = resolveLoading(options.loading, instances);

  // Au-delà d'un gros volume, on limite le nombre de stratégies, et un budget
  // de temps garantit qu'on ne bloque jamais plusieurs dizaines de secondes (§55).
  const strategies = instances.length > 400 ? STRATEGIES.slice(0, 2) : STRATEGIES;
  const budgetMs = 6000;

  let best: OptimizationResult | null = null;
  for (const strategy of strategies) {
    // Dernier arrêt d'abord (chargé au fond), puis la stratégie à l'intérieur d'un arrêt.
    const ordered = [...instances].sort((a, b) => (b.stop - a.stop) || strategy.compare(a, b));
    const result = packOnce(container, ordered, mode, cfg);
    if (best === null || compareOptimizationResults(result, best) < 0) best = result;
    if (now() - start > budgetMs) break;
  }
  if (best === null) best = buildResult(container, [], [], 0, mode, cfg.mode);

  best.computationTimeMs = Math.round(now() - start);
  return best;
}

/**
 * Optimisation + indicateurs pour l'interface. Si des limites de hauteur
 * manuelle sont actives et que tout ne rentre pas, on recalcule sans ces
 * limites pour chiffrer leur coût (colis et remplissage perdus).
 */
export function optimizeWithInsights(
  container: ContainerDefinition,
  definitions: readonly ItemDefinition[],
  options: OptimizeOptions = {},
): OptimizationResult {
  const r = optimize(container, definitions, options);
  const l = options.loading;
  const limited = !!l && ((Number(l.manualMaxHeight) || 0) > 0 || (Number(l.heavyMaxHeight) || 0) > 0);
  r.heightLimitCost = null;
  if (limited && r.unpackedCount > 0) {
    const unlimited = optimize(container, definitions, { ...options, loading: { ...l, manualMaxHeight: null, heavyMaxHeight: null } });
    if (unlimited.packedItems > r.packedItems) {
      r.heightLimitCost = { packedItems: unlimited.packedItems, volumeUtilization: unlimited.volumeUtilization };
    }
    r.computationTimeMs += unlimited.computationTimeMs;
  }
  return r;
}
