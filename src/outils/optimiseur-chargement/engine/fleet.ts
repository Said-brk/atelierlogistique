// Mode « Flotte automatique » : combien de véhicules, lesquels, et quels arrêts dans chacun.
//
// Méthode :
//  1. Les arrêts gardent l'ordre de la tournée (1 = premier livré). Chaque véhicule prend une
//     suite d'arrêts consécutifs : on ne sépare pas une tournée cohérente.
//  2. Programmation dynamique sur ces suites : coût total minimal, puis moins de véhicules.
//     Chaque suite candidate est vérifiée par le vrai moteur 3D (même contraintes que le mode
//     standard : murs, tournée, empilage, poids) — pas une simple règle de volume.
//  3. Un arrêt trop gros pour le plus grand véhicule est d'abord découpé en véhicules pleins.
//  4. Comparaison avec des flottes d'un seul type de véhicule (« au lieu de 3 porteurs »).
//
// Le mode standard (un véhicule choisi par l'utilisateur) n'utilise pas ce module.

import { optimize } from './optimizer';
import { getOrientations } from './rotations';
import type { ContainerDefinition, ItemDefinition, OptimizeOptions } from './types';
import { N_ } from '../../../shared/i18n/core';

export interface FleetVehicle {
  container: ContainerDefinition;
  cost: number;
}

export interface FleetTruck {
  index: number;                 // 1-based
  vehicleId: string;
  container: ContainerDefinition;
  cost: number;
  stops: number[];
  destinations: string[];
  /** Colis de ce véhicule (quantités = part de chaque ligne). */
  definitions: ItemDefinition[];
  units: number;
  weight: number;                // kg
  volumeUtilization: number;     // 0..1
  weightUtilization: number | null;
  /** Arrêt partagé avec un autre véhicule (arrêt trop gros pour un seul). */
  split: boolean;
}

export interface FleetAlternative { vehicleId: string; label: string; count: number; cost: number; }

export interface FleetPlan {
  trucks: FleetTruck[];
  totalCost: number;
  alternatives: FleetAlternative[];
  /** Lignes impossibles à charger sur aucun des véhicules proposés. */
  unplaced: { definitionId: string; reference: string; quantity: number; reason: string }[];
  computationTimeMs: number;
}

const EXACT_BUDGET_MS = 2500; // recherche exacte : au-delà, meilleure heuristique
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const volOf = (d: ItemDefinition) => d.length * d.width * d.height * d.quantity;
const weightOf = (d: ItemDefinition) => d.weight * d.quantity;
const capVol = (c: ContainerDefinition) => c.length * c.width * c.height;

function fitsDims(d: ItemDefinition, c: ContainerDefinition): boolean {
  return getOrientations({ length: d.length, width: d.width, height: d.height }, d.rotationMode)
    .some((o) => o.length <= c.length && o.width <= c.width && o.height <= c.height);
}
const fitsVehicle = (d: ItemDefinition, c: ContainerDefinition) => fitsDims(d, c) && (c.maxWeight == null || d.weight <= c.maxWeight);

interface Ctx { opts: OptimizeOptions; cache: Map<string, ReturnType<typeof optimize> | null>; budgetMs: number; }

/** Charge tout ? Bornes rapides (volume, poids, gabarit) puis vrai moteur 3D. Résultat mis en cache. */
function tryLoad(defs: ItemDefinition[], c: ContainerDefinition, ctx: Ctx, key: string) {
  const k = `${c.id}|${key}`;
  if (ctx.cache.has(k)) return ctx.cache.get(k)!;
  let res: ReturnType<typeof optimize> | null = null;
  const vol = defs.reduce((s, d) => s + volOf(d), 0);
  const w = defs.reduce((s, d) => s + weightOf(d), 0);
  if (vol <= capVol(c) && (c.maxWeight == null || w <= c.maxWeight) && defs.every((d) => fitsVehicle(d, c))) {
    const r = optimize(c, defs, ctx.opts);
    if (r.unpackedCount === 0) res = r;
  }
  ctx.cache.set(k, res);
  return res;
}

function summarize(defs: ItemDefinition[], v: FleetVehicle, r: ReturnType<typeof optimize>, split: boolean): Omit<FleetTruck, 'index'> {
  const stops = [...new Set(defs.map((d) => d.stop ?? 1))].sort((a, b) => a - b);
  const destinations = [...new Set(defs.map((d) => d.destination ?? '').filter(Boolean))];
  return {
    vehicleId: v.container.id, container: v.container, cost: v.cost, stops, destinations,
    definitions: defs, units: defs.reduce((s, d) => s + d.quantity, 0), weight: Math.round(r.usedWeight),
    volumeUtilization: r.volumeUtilization, weightUtilization: r.weightUtilization, split,
  };
}

/** Sous-ensemble de lignes correspondant aux colis effectivement placés. */
function definitionsOfPlaced(defs: ItemDefinition[], r: ReturnType<typeof optimize>): { packed: ItemDefinition[]; rest: ItemDefinition[] } {
  const counts = new Map<string, number>();
  for (const p of r.placedItems) counts.set(p.definitionId, (counts.get(p.definitionId) ?? 0) + 1);
  const packed: ItemDefinition[] = [];
  const rest: ItemDefinition[] = [];
  for (const d of defs) {
    const q = Math.min(d.quantity, counts.get(d.id) ?? 0);
    if (q > 0) packed.push({ ...d, quantity: q });
    if (d.quantity - q > 0) rest.push({ ...d, quantity: d.quantity - q });
  }
  return { packed, rest };
}

interface Solution { trucks: Omit<FleetTruck, 'index'>[]; cost: number; ok: boolean; }

function solve(groups: { stop: number; defs: ItemDefinition[] }[], vehicles: FleetVehicle[], ctx: Ctx): Solution {
  const trucks: Omit<FleetTruck, 'index'>[] = [];
  let fixedCost = 0;

  // 3. Arrêts trop gros pour un seul véhicule : véhicules pleins d'abord (meilleur coût par m³ chargé).
  const segments: Segment[] = [];
  for (const g of groups) {
    const alone = vehicles.some((v) => tryLoad(g.defs, v.container, ctx, `s${g.stop}`));
    if (alone) { segments.push(g); continue; }
    let rest = g.defs;
    let guard = 0;
    while (rest.length > 0 && guard++ < 200) {
      if (vehicles.some((v) => tryLoad(rest, v.container, ctx, `s${g.stop}r${guard}`))) break;
      // Véhicule qui charge le plus de volume par euro.
      let best: { v: FleetVehicle; packed: ItemDefinition[]; rest: ItemDefinition[]; r: ReturnType<typeof optimize>; score: number } | null = null;
      for (const v of vehicles) {
        const r = optimize(v.container, rest, ctx.opts);
        if (r.packedItems === 0) continue;
        const split = definitionsOfPlaced(rest, r);
        const loaded = split.packed.reduce((s, d) => s + volOf(d), 0);
        const score = loaded / Math.max(1, v.cost);
        if (!best || score > best.score) best = { v, ...split, r, score };
      }
      if (!best) return { trucks: [], cost: Infinity, ok: false };
      trucks.push(summarize(best.packed, best.v, best.r, true));
      fixedCost += best.v.cost;
      rest = best.rest;
    }
    if (rest.length > 0) segments.push({ stop: g.stop, defs: rest, partial: true });
  }

  // 2. Répartition des arrêts (ou restes d'arrêts) entre véhicules.
  const part = partitionSegments(segments, vehicles, ctx);
  if (!part) return { trucks: [], cost: Infinity, ok: false };
  return { trucks: [...trucks, ...part.trucks].sort((a, b) => (a.stops[0] ?? 0) - (b.stops[0] ?? 0)), cost: fixedCost + part.cost, ok: true };
}

type Segment = { stop: number; defs: ItemDefinition[]; partial?: boolean };
type Partition = { trucks: Omit<FleetTruck, 'index'>[]; cost: number; count: number; gaps: number };

const segKey = (segs: Segment[]) => segs.map((s) => `${s.stop}:${s.defs.map((d) => `${d.id}x${d.quantity}`).join(',')}`).sort().join('|');
/** Arrêts sautés dans un véhicule (2 puis 4 = 1 saut) : à coût égal, on préfère des arrêts qui se suivent. */
const gapsOf = (segs: Segment[]) => {
  const st = [...new Set(segs.map((s) => s.stop))].sort((a, b) => a - b);
  let g = 0; for (let i = 1; i < st.length; i++) g += st[i] - st[i - 1] - 1;
  return g;
};
const better = (a: Partition | null, b: Partition | null) => {
  if (!b) return a; if (!a) return b;
  if (Math.abs(a.cost - b.cost) > 1e-9) return a.cost < b.cost ? a : b;
  if (a.count !== b.count) return a.count < b.count ? a : b;
  return a.gaps <= b.gaps ? a : b;
};

/** Le véhicule le moins cher qui charge tout ce groupe (vrai moteur 3D, en cache). */
function cheapestFor(segs: Segment[], vehicles: FleetVehicle[], ctx: Ctx) {
  const defs = segs.flatMap((s) => s.defs);
  const key = segKey(segs);
  let best: { v: FleetVehicle; r: ReturnType<typeof optimize> } | null = null;
  for (const v of [...vehicles].sort((a, b) => a.cost - b.cost)) {
    if (best && v.cost > best.v.cost) break;
    const r = tryLoad(defs, v.container, ctx, key);
    if (r) best = { v, r };
  }
  return best;
}

/**
 * Chaque véhicule fait sa propre tournée : il peut prendre n'importe quels arrêts (livrés dans l'ordre
 * de la tournée, règle de chargement par arrêt respectée par le moteur 3D). On cherche la combinaison
 * la moins chère : deux heuristiques (arrêts consécutifs, premier véhicule qui convient), puis recherche
 * exacte jusqu'à 10 groupes dans un temps limité (bornes poids / volume d'abord, moteur 3D ensuite).
 */
function partitionSegments(segments: Segment[], vehicles: FleetVehicle[], ctx: Ctx): Partition | null {
  const n = segments.length;
  if (n === 0) return { trucks: [], cost: 0, count: 0, gaps: 0 };
  const truckOf = (segs: Segment[], v: FleetVehicle, r: ReturnType<typeof optimize>) =>
    summarize(segs.flatMap((s) => s.defs), v, r, segs.some((s) => s.partial));
  const maxW = Math.max(...vehicles.map((v) => v.container.maxWeight ?? Infinity));
  const maxV = Math.max(...vehicles.map((v) => capVol(v.container)));
  const w = segments.map((s) => s.defs.reduce((a, d) => a + weightOf(d), 0));
  const vol = segments.map((s) => s.defs.reduce((a, d) => a + volOf(d), 0));

  // Heuristiques d'abord (rapides) ; la recherche exacte ne peut que faire mieux, dans un temps limité.
  let result: Partition | null = better(contiguous(segments, vehicles, ctx, truckOf), firstFit(segments, vehicles, ctx, truckOf, w));
  const deadline = now() + ctx.budgetMs;
  if (n <= 10) try {
    const memo = new Map<number, Partition | null>();
    const groupCache = new Map<number, ReturnType<typeof cheapestFor>>();
    const segsOf = (mask: number) => segments.filter((_, i) => mask & (1 << i));
    const group = (mask: number) => {
      if (!groupCache.has(mask)) {
        if (now() > deadline) throw new Error('budget');
        let sw = 0, sv = 0;
        for (let i = 0; i < n; i++) if (mask & (1 << i)) { sw += w[i]; sv += vol[i]; }
        groupCache.set(mask, sw <= maxW && sv <= maxV ? cheapestFor(segsOf(mask), vehicles, ctx) : null);
      }
      return groupCache.get(mask)!;
    };
    const solveMask = (rest: number): Partition | null => {
      if (rest === 0) return { trucks: [], cost: 0, count: 0, gaps: 0 };
      if (memo.has(rest)) return memo.get(rest)!;
      const low = rest & -rest; // le premier groupe restant part forcément dans un véhicule
      const others = rest & ~low;
      let best: Partition | null = null;
      // Tous les sous-ensembles des autres groupes, ajoutés au premier.
      for (let sub = others; ; sub = (sub - 1) & others) {
        const mask = low | sub;
        const g = group(mask);
        if (g) {
          const tail = solveMask(rest & ~mask);
          if (tail) {
            const segs = segsOf(mask);
            best = better(best, { trucks: [truckOf(segs, g.v, g.r), ...tail.trucks], cost: tail.cost + g.v.cost, count: tail.count + 1, gaps: tail.gaps + gapsOf(segs) });
          }
        }
        if (sub === 0) break;
      }
      memo.set(rest, best);
      return best;
    };
    result = better(result, solveMask((1 << n) - 1));
  } catch { /* trop long : on garde la meilleure heuristique */ }
  return result;
}

/** Heuristique 1 : suites d'arrêts consécutifs (programmation dynamique). */
function contiguous(segments: Segment[], vehicles: FleetVehicle[], ctx: Ctx, truckOf: (s: Segment[], v: FleetVehicle, r: ReturnType<typeof optimize>) => Omit<FleetTruck, 'index'>): Partition | null {
  const n = segments.length;
  const best: (Partition | null)[] = Array.from({ length: n + 1 }, () => null);
  best[0] = { trucks: [], cost: 0, count: 0, gaps: 0 };
  for (let j = 1; j <= n; j++) {
    for (let i = j; i >= 1; i--) {
      if (!best[i - 1]) continue;
      const segs = segments.slice(i - 1, j);
      const g = cheapestFor(segs, vehicles, ctx);
      if (!g) break; // une suite plus longue ne passera pas non plus
      const prev = best[i - 1]!;
      best[j] = better(best[j], { trucks: [...prev.trucks, truckOf(segs, g.v, g.r)], cost: prev.cost + g.v.cost, count: prev.count + 1, gaps: prev.gaps });
    }
  }
  return best[n];
}

/** Heuristique 2 : groupes du plus lourd au plus léger, dans le premier véhicule ouvert qui les accepte. */
function firstFit(segments: Segment[], vehicles: FleetVehicle[], ctx: Ctx, truckOf: (s: Segment[], v: FleetVehicle, r: ReturnType<typeof optimize>) => Omit<FleetTruck, 'index'>, w: number[]): Partition | null {
  const order = segments.map((_, i) => i).sort((a, b) => w[b] - w[a]);
  const bins: Segment[][] = [];
  for (const i of order) {
    const seg = segments[i];
    const open = bins.find((b) => cheapestFor([...b, seg], vehicles, ctx));
    if (open) open.push(seg);
    else if (cheapestFor([seg], vehicles, ctx)) bins.push([seg]);
    else return null;
  }
  const trucks = bins.map((b) => { const g = cheapestFor(b, vehicles, ctx)!; return { t: truckOf(b, g.v, g.r), cost: g.v.cost, gaps: gapsOf(b) }; });
  return { trucks: trucks.map((x) => x.t), cost: trucks.reduce((s, x) => s + x.cost, 0), count: trucks.length, gaps: trucks.reduce((s, x) => s + x.gaps, 0) };
}

export function planFleet(
  definitions: readonly ItemDefinition[], vehicles: readonly FleetVehicle[], options: OptimizeOptions = {},
): FleetPlan {
  const t0 = now();
  const usable = vehicles.filter((v) => v.container.length > 0 && v.container.width > 0 && v.container.height > 0);
  const ctx: Ctx = { opts: options, cache: new Map(), budgetMs: EXACT_BUDGET_MS };
  const unplaced: FleetPlan['unplaced'] = [];
  const valid: ItemDefinition[] = [];
  for (const d of definitions) {
    if (d.quantity <= 0) continue;
    if (usable.some((v) => fitsVehicle(d, v.container))) valid.push(d);
    else unplaced.push({ definitionId: d.id, reference: d.reference, quantity: d.quantity, reason: N_('trop grand ou trop lourd pour les véhicules proposés') });
  }
  const byStop = new Map<number, ItemDefinition[]>();
  for (const d of valid) { const s = d.stop ?? 1; if (!byStop.has(s)) byStop.set(s, []); byStop.get(s)!.push(d); }
  const groups = [...byStop.keys()].sort((a, b) => a - b).map((stop) => ({ stop, defs: byStop.get(stop)! }));

  const main = groups.length ? solve(groups, usable, ctx) : { trucks: [], cost: 0, ok: true };
  if (!main.ok) {
    for (const d of valid) unplaced.push({ definitionId: d.id, reference: d.reference, quantity: d.quantity, reason: N_('aucune combinaison de véhicules ne permet de tout charger') });
  }

  // 4. Comparaisons : un seul type de véhicule.
  const alternatives: FleetAlternative[] = [];
  if (main.ok && usable.length > 1 && groups.length) {
    ctx.budgetMs = EXACT_BUDGET_MS / 4; // comparaisons : recherche plus courte
    for (const v of usable) {
      const s = solve(groups, [v], ctx);
      if (s.ok) alternatives.push({ vehicleId: v.container.id, label: v.container.label, count: s.trucks.length, cost: s.cost });
    }
    alternatives.sort((a, b) => a.cost - b.cost);
  }

  const trucks = main.ok ? main.trucks.map((t, i) => ({ ...t, index: i + 1 })) : [];
  return { trucks, totalCost: main.ok ? main.cost : 0, alternatives, unplaced, computationTimeMs: Math.round(now() - t0) };
}
