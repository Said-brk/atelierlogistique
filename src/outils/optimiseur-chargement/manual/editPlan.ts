// Mode « modifier à la main » : opérations pures sur un plan calculé (sans React, testables).
//   déplacer · pivoter · poser (gravité) · retirer vers la zone d'attente · replacer automatiquement
//   + contrôle du plan (chevauchements, hors du contenant, colis en l'air, charge sur un colis non gerbable)
//   + recalcul des indicateurs (remplissage, poids, arrêts, murs).
// Toutes les dimensions sont en mm, comme le moteur.

import type { ContainerDefinition, OptimizationResult, PlacedItem, WallSummary, DeliveryStopSummary } from '../engine/types';

/** Règles d'un colis venant de sa ligne de saisie (le plan calculé ne les garde pas toutes). */
export interface ItemRules {
  /** Peut tourner d'un quart de tour au sol (longueur ↔ largeur). */
  canRotate: boolean;
  /** Doit rester au sol. */
  floorOnly: boolean;
}
export type RulesOf = (item: PlacedItem) => ItemRules;
export const DEFAULT_RULES: ItemRules = { canRotate: true, floorOnly: false };

/** Part minimale de la base d'un colis qui doit reposer sur quelque chose. */
export const MIN_SUPPORT = 0.6;
/** Distance d'aimantation (mm) : un colis lâché près d'une paroi ou d'un autre colis s'y cale. */
export const SNAP_MM = 40;
const EPS = 0.5;

const overlap1 = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);
const intersects = (a: PlacedItem, b: PlacedItem) =>
  overlap1(a.x, a.x + a.length, b.x, b.x + b.length) > EPS
  && overlap1(a.y, a.y + a.width, b.y, b.y + b.width) > EPS
  && overlap1(a.z, a.z + a.height, b.z, b.z + b.height) > EPS;
const footprint = (a: PlacedItem, b: PlacedItem) =>
  Math.max(0, overlap1(a.x, a.x + a.length, b.x, b.x + b.length)) * Math.max(0, overlap1(a.y, a.y + a.width, b.y, b.y + b.width));

/** Colis posés directement sous `item` (dessus à la hauteur de sa base). */
function supportsOf(item: PlacedItem, placed: readonly PlacedItem[]): PlacedItem[] {
  return placed.filter((o) => o.id !== item.id && Math.abs(o.z + o.height - item.z) <= EPS && footprint(item, o) > 0);
}
function supportRatio(item: PlacedItem, placed: readonly PlacedItem[]): number {
  if (item.z <= EPS) return 1;
  const area = item.length * item.width;
  return supportsOf(item, placed).reduce((s, o) => s + footprint(item, o), 0) / area;
}

export interface PlanIssues {
  /** Colis qui en chevauchent un autre. */
  collisions: Set<string>;
  /** Colis qui dépassent du contenant. */
  outside: Set<string>;
  /** Colis qui ne reposent pas assez (moins de 60 % de la base). */
  floating: Set<string>;
  /** Colis posés sur un colis non gerbable, ou en hauteur alors qu'ils doivent rester au sol. */
  stacking: Set<string>;
  /** Tous les colis en défaut. */
  all: Set<string>;
}

export function checkPlan(container: ContainerDefinition, placed: readonly PlacedItem[], rulesOf: RulesOf = () => DEFAULT_RULES): PlanIssues {
  const collisions = new Set<string>(); const outside = new Set<string>();
  const floating = new Set<string>(); const stacking = new Set<string>();
  // Balayage par x croissant : on ne compare que les colis qui se recouvrent en longueur.
  const byX = [...placed].sort((a, b) => a.x - b.x);
  for (let i = 0; i < byX.length; i++) {
    const a = byX[i];
    if (a.x < -EPS || a.y < -EPS || a.z < -EPS || a.x + a.length > container.length + EPS
      || a.y + a.width > container.width + EPS || a.z + a.height > container.height + EPS) outside.add(a.id);
    for (let j = i + 1; j < byX.length && byX[j].x < a.x + a.length - EPS; j++) {
      if (intersects(a, byX[j])) { collisions.add(a.id); collisions.add(byX[j].id); }
    }
    if (a.z > EPS) {
      if (supportRatio(a, placed) < MIN_SUPPORT) floating.add(a.id);
      if (rulesOf(a).floorOnly || supportsOf(a, placed).some((o) => !o.stackable)) stacking.add(a.id);
    }
  }
  const all = new Set([...collisions, ...outside, ...floating, ...stacking]);
  return { collisions, outside, floating, stacking, all };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const replace = (placed: readonly PlacedItem[], next: PlacedItem) => placed.map((p) => (p.id === next.id ? next : p));

/** Hauteur la plus basse où le colis peut descendre à sa position (x, y), sans traverser un autre colis. */
function restingZ(item: PlacedItem, placed: readonly PlacedItem[]): number {
  let z = 0;
  for (const o of placed) {
    if (o.id === item.id || footprint(item, o) <= 0) continue;
    const top = o.z + o.height;
    if (top <= item.z + EPS) z = Math.max(z, top);
  }
  return z;
}

/** Déplace un colis (mm), en le gardant dans le contenant. */
export function moveItem(container: ContainerDefinition, placed: readonly PlacedItem[], id: string, dx: number, dy: number, dz: number): PlacedItem[] {
  const it = placed.find((p) => p.id === id); if (!it) return [...placed];
  return replace(placed, {
    ...it,
    x: clamp(it.x + dx, 0, container.length - it.length),
    y: clamp(it.y + dy, 0, container.width - it.width),
    z: clamp(it.z + dz, 0, Math.max(0, container.height - it.height)),
  });
}

/**
 * Place un colis à (x, y) — glisser-déposer — en l'aimantant aux parois et aux colis voisins,
 * puis le pose à la hauteur où il repose (gravité).
 */
export function dropAt(container: ContainerDefinition, placed: readonly PlacedItem[], id: string, x: number, y: number): PlacedItem[] {
  const it = placed.find((p) => p.id === id); if (!it) return [...placed];
  const xs = [0, container.length - it.length]; const ys = [0, container.width - it.width];
  for (const o of placed) {
    if (o.id === id) continue;
    xs.push(o.x + o.length, o.x - it.length, o.x); ys.push(o.y + o.width, o.y - it.width, o.y);
  }
  const snap = (v: number, cands: number[]) => {
    let best = v, d = SNAP_MM;
    for (const c of cands) if (Math.abs(c - v) < d) { d = Math.abs(c - v); best = c; }
    return best;
  };
  const nx = clamp(snap(x, xs), 0, container.length - it.length);
  const ny = clamp(snap(y, ys), 0, container.width - it.width);
  const moved = { ...it, x: nx, y: ny, z: container.height }; // lâché d'en haut puis « tombe »
  const z = restingZ(moved, placed);
  return replace(placed, { ...moved, z: Math.min(z, Math.max(0, container.height - it.height)) });
}

/** Pose le colis sur ce qu'il y a dessous (gravité). */
export function settleItem(placed: readonly PlacedItem[], id: string): PlacedItem[] {
  const it = placed.find((p) => p.id === id); if (!it) return [...placed];
  return replace(placed, { ...it, z: restingZ(it, placed) });
}

/** Quart de tour au sol (longueur ↔ largeur) autour du coin le plus proche de la cabine. */
export function rotateItem(container: ContainerDefinition, placed: readonly PlacedItem[], id: string): PlacedItem[] {
  const it = placed.find((p) => p.id === id); if (!it) return [...placed];
  const r = { ...it, length: it.width, width: it.length, rotation: { ...it.rotation, y: ((it.rotation?.y ?? 0) + 90) % 180 } };
  r.x = clamp(r.x, 0, Math.max(0, container.length - r.length));
  r.y = clamp(r.y, 0, Math.max(0, container.width - r.width));
  return replace(placed, r);
}

/** Retire un colis du plan (il va dans la zone d'attente). */
export function removeItem(placed: readonly PlacedItem[], id: string): { placed: PlacedItem[]; removed: PlacedItem | null } {
  const removed = placed.find((p) => p.id === id) ?? null;
  return { placed: placed.filter((p) => p.id !== id), removed };
}

/**
 * Cherche une place libre pour un colis de la zone d'attente : points candidats contre les parois
 * et les colis déjà posés, du fond vers les portes, du bas vers le haut ; les deux orientations au sol
 * si le colis peut tourner. Renvoie null s'il n'y a pas de place.
 */
export function findSpot(container: ContainerDefinition, placed: readonly PlacedItem[], item: PlacedItem, rules: ItemRules = DEFAULT_RULES): PlacedItem | null {
  const xs = new Set([0]); const ys = new Set([0]); const zs = new Set([0]);
  for (const o of placed) { xs.add(o.x + o.length); xs.add(o.x); ys.add(o.y + o.width); ys.add(o.y); if (!rules.floorOnly && o.stackable) zs.add(o.z + o.height); }
  const dims = rules.canRotate && item.length !== item.width
    ? [[item.length, item.width], [item.width, item.length]] : [[item.length, item.width]];
  const X = [...xs].sort((a, b) => a - b); const Y = [...ys].sort((a, b) => a - b); const Z = [...zs].sort((a, b) => a - b);
  for (const x of X) for (const z of Z) for (const y of Y) for (const [l, w] of dims) {
    if (x + l > container.length + EPS || y + w > container.width + EPS || z + item.height > container.height + EPS) continue;
    const cand: PlacedItem = { ...item, x, y, z, length: l, width: w };
    if (placed.some((o) => intersects(cand, o))) continue;
    if (z > EPS) {
      if (supportRatio(cand, placed) < MIN_SUPPORT) continue;
      if (supportsOf(cand, placed).some((o) => !o.stackable)) continue;
    }
    return cand;
  }
  return null;
}

const wallOf = (walls: readonly WallSummary[], p: PlacedItem) => {
  const cx = p.x + p.length / 2;
  return walls.find((w) => cx >= w.xStart && cx < w.xEnd)?.wall ?? p.wall;
};

/**
 * Résultat d'optimisation mis à jour avec le plan modifié : indicateurs, arrêts et murs recalculés,
 * colis de la zone d'attente comptés comme non chargés.
 */
export function applyManualPlan(
  base: OptimizationResult, placed: readonly PlacedItem[], staged: readonly PlacedItem[],
  touched: ReadonlySet<string> = new Set(),
): OptimizationResult {
  const walls = base.walls ?? [];
  const items = placed.map((p) => ({ ...p, wall: walls.length ? wallOf(walls, p) : p.wall }));
  // Séquence : les colis non touchés gardent leur ordre calculé ; un colis déplacé est chargé juste
  // après ce sur quoi il repose et après les colis non touchés de son mur situés côté cabine.
  const rank = new Map<string, number>();
  items.forEach((p) => { if (!touched.has(p.id)) rank.set(p.id, p.sequence); });
  [...items].filter((p) => touched.has(p.id)).sort((a, b) => a.z - b.z || a.x - b.x).forEach((p) => {
    let r = 0;
    for (const o of supportsOf(p, items)) r = Math.max(r, rank.get(o.id) ?? 0);
    for (const o of items) if (!touched.has(o.id) && o.wall === p.wall && o.x <= p.x) r = Math.max(r, o.sequence);
    rank.set(p.id, r + 0.5);
  });
  const ordered = [...items].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)).map((p, i) => ({ ...p, sequence: i + 1 }));
  const vol = (p: PlacedItem) => p.length * p.width * p.height;
  const usedVolume = ordered.reduce((s, p) => s + vol(p), 0);
  const usedWeight = ordered.reduce((s, p) => s + p.weight, 0);
  const stagedIds = new Set(staged.map((s) => s.id));
  const stops: DeliveryStopSummary[] = base.stops.map((s) => {
    const inStop = ordered.filter((p) => (p.stop ?? 1) === s.stop);
    const out = staged.filter((p) => (p.stop ?? 1) === s.stop).length;
    return { ...s, packedItems: inStop.length, unpackedItems: s.unpackedItems + out, packedWeight: inStop.reduce((a, p) => a + p.weight, 0), packedVolume: inStop.reduce((a, p) => a + vol(p), 0) };
  });
  return {
    ...base,
    placedItems: ordered,
    packedItems: ordered.length,
    unpackedCount: base.unpackedCount + staged.length,
    usedVolume,
    volumeUtilization: base.containerVolume ? usedVolume / base.containerVolume : 0,
    usedWeight,
    weightUtilization: base.maxWeight ? usedWeight / base.maxWeight : null,
    stops,
    walls: walls.map((w) => {
      const inWall = ordered.filter((p) => p.wall === w.wall);
      return { ...w, items: inWall.length, weight: inWall.reduce((a, p) => a + p.weight, 0) };
    }),
    blockedItemIds: (base.blockedItemIds ?? []).filter((id) => !stagedIds.has(id)),
    loadingViolationIds: (base.loadingViolationIds ?? []).filter((id) => !stagedIds.has(id)),
  };
}
