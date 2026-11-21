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

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const volOf = (d: ItemDefinition) => d.length * d.width * d.height * d.quantity;
const weightOf = (d: ItemDefinition) => d.weight * d.quantity;
const capVol = (c: ContainerDefinition) => c.length * c.width * c.height;

function fitsDims(d: ItemDefinition, c: ContainerDefinition): boolean {
  return getOrientations({ length: d.length, width: d.width, height: d.height }, d.rotationMode)
    .some((o) => o.length <= c.length && o.width <= c.width && o.height <= c.height);
}
const fitsVehicle = (d: ItemDefinition, c: ContainerDefinition) => fitsDims(d, c) && (c.maxWeight == null || d.weight <= c.maxWeight);

interface Ctx { opts: OptimizeOptions; cache: Map<string, ReturnType<typeof optimize> | null>; }

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
  const segments: { stop: number; defs: ItemDefinition[] }[] = [];
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
    if (rest.length > 0) segments.push({ stop: g.stop, defs: rest });
  }

  // 2. Programmation dynamique sur les suites d'arrêts consécutifs.
  const n = segments.length;
  const best: { cost: number; count: number; prev: number; v: FleetVehicle | null; r: ReturnType<typeof optimize> | null }[] =
    Array.from({ length: n + 1 }, () => ({ cost: Infinity, count: Infinity, prev: -1, v: null, r: null }));
  best[0] = { cost: 0, count: 0, prev: -1, v: null, r: null };
  for (let j = 1; j <= n; j++) {
    for (let i = j; i >= 1; i--) {
      if (best[i - 1].cost === Infinity) continue;
      const defs = segments.slice(i - 1, j).flatMap((s) => s.defs);
      const key = segments.slice(i - 1, j).map((s) => `${s.stop}:${s.defs.map((d) => `${d.id}x${d.quantity}`).join(',')}`).join('|');
      let anyFits = false;
      for (const v of vehicles) {
        const r = tryLoad(defs, v.container, ctx, key);
        if (!r) continue;
        anyFits = true;
        const cost = best[i - 1].cost + v.cost;
        const count = best[i - 1].count + 1;
        if (cost < best[j].cost - 1e-9 || (Math.abs(cost - best[j].cost) < 1e-9 && count < best[j].count)) {
          best[j] = { cost, count, prev: i - 1, v, r };
        }
      }
      // Si aucun véhicule ne prend cette suite, une suite plus longue ne passera pas non plus.
      if (!anyFits) break;
    }
  }
  if (best[n].cost === Infinity) return { trucks: [], cost: Infinity, ok: false };
  const dpTrucks: Omit<FleetTruck, 'index'>[] = [];
  for (let j = n; j > 0; j = best[j].prev) {
    const b = best[j];
    const defs = segments.slice(b.prev, j).flatMap((s) => s.defs);
    dpTrucks.unshift(summarize(defs, b.v!, b.r!, false));
  }
  return { trucks: [...trucks, ...dpTrucks].sort((a, b) => (a.stops[0] ?? 0) - (b.stops[0] ?? 0)), cost: fixedCost + best[n].cost, ok: true };
}

export function planFleet(
  definitions: readonly ItemDefinition[], vehicles: readonly FleetVehicle[], options: OptimizeOptions = {},
): FleetPlan {
  const t0 = now();
  const usable = vehicles.filter((v) => v.container.length > 0 && v.container.width > 0 && v.container.height > 0);
  const ctx: Ctx = { opts: options, cache: new Map() };
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
    for (const v of usable) {
      const s = solve(groups, [v], ctx);
      if (s.ok) alternatives.push({ vehicleId: v.container.id, label: v.container.label, count: s.trucks.length, cost: s.cost });
    }
    alternatives.sort((a, b) => a.cost - b.cost);
  }

  const trucks = main.ok ? main.trucks.map((t, i) => ({ ...t, index: i + 1 })) : [];
  return { trucks, totalCost: main.ok ? main.cost : 0, alternatives, unplaced, computationTimeMs: Math.round(now() - t0) };
}
