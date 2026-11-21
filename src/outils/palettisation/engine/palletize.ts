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
import type { PalletContent, PalletizeOptions, PalletizeResult, PalletPlan, PalletSpec, SupportChoice, UnplacedLine } from './types';
import { t as tr, tText, numLocale } from '../../../shared/i18n/core';

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
    specId: pallet.id,
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
  if (def.weight > pallet.maxLoad) return tr('plus lourd que la charge maxi de la palette');
  const fits = getOrientations({ length: def.length, width: def.width, height: def.height }, def.rotationMode)
    .some((o) => o.length <= pallet.length && o.width <= pallet.width && o.height <= availH);
  if (!fits) return tr('plus grand que la palette ou que la hauteur maxi');
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

/** Compteur partagé : identifiants uniques des palettes pendant un calcul. */
interface Ctx { next: number; fullFirst: boolean; allowMixed: boolean; }

interface Partial { pallets: PalletPlan[]; unplaced: UnplacedLine[]; }

/** Phase 1 : palettes complètes d'une référence sur un support donné ; renvoie le reliquat. */
function fullPhase(d: ItemDefinition, spec: PalletSpec, ctx: Ctx, out: PalletPlan[]): number {
  let remaining = d.quantity;
  if (!ctx.fullFirst) return remaining;
  const plan = bestFullPallet(d, spec);
  if (!plan) return remaining;
  while (remaining >= plan.capacity) {
    out.push(buildFullPallet(d, plan, spec, ctx.next++));
    remaining -= plan.capacity;
  }
  return remaining;
}

/** Phase 2 : reliquats en palettes mixtes (moteur 3D), une palette à la fois. */
function mixedPhase(pool: ItemDefinition[], spec: PalletSpec, ctx: Ctx): Partial {
  const pallets: PalletPlan[] = [];
  const unplaced: UnplacedLine[] = [];
  const left = new Map(pool.filter((d) => d.quantity > 0).map((d) => [d.id, d]));
  if (!ctx.allowMixed) {
    for (const d of left.values()) unplaced.push({ definitionId: d.id, reference: d.reference, quantity: d.quantity, reason: tr('reliquat (palettes mixtes désactivées)') });
    return { pallets, unplaced };
  }
  const container = palletContainer(spec);
  let guard = 0;
  while (left.size > 0 && guard++ < 500) {
    const r = optimize(container, [...left.values()], { loading: { mode: 'FREE', scoring: MIXED_SCORING }, deliveryMode: 'SOFT' });
    if (r.packedItems === 0) {
      for (const d of left.values()) unplaced.push({ definitionId: d.id, reference: d.reference, quantity: d.quantity, reason: tr('ne trouve pas de place stable') });
      break;
    }
    const index = ctx.next++;
    const placed = centerPlaced(r.placedItems, spec).map((p, i) => ({ ...p, id: `${p.definitionId}#P${index}-${i + 1}` }));
    pallets.push(finalizePallet(spec, index, 'MIXED', placed));
    const counts = new Map<string, number>();
    for (const u of r.unpackedItems) counts.set(u.definitionId, (counts.get(u.definitionId) ?? 0) + 1);
    for (const [id, d] of [...left]) {
      const q = counts.get(id) ?? 0;
      if (q === 0) left.delete(id); else left.set(id, { ...d, quantity: q });
    }
  }
  return { pallets, unplaced };
}

/** Tout un groupe sur un seul support. */
function onSpec(defs: ItemDefinition[], spec: PalletSpec, ctx: Ctx): Partial {
  const pallets: PalletPlan[] = [];
  const unplaced: UnplacedLine[] = [];
  const pool: ItemDefinition[] = [];
  for (const d of defs) {
    const reason = unplaceableReason(d, spec);
    if (reason) { unplaced.push({ definitionId: d.id, reference: d.reference, quantity: d.quantity, reason: `${reason} (${tText(spec.label)})` }); continue; }
    const rest = fullPhase(d, spec, ctx, pallets);
    if (rest > 0) pool.push({ ...d, quantity: rest });
  }
  const m = mixedPhase(pool, spec, ctx);
  return { pallets: [...pallets, ...m.pallets], unplaced: [...unplaced, ...m.unplaced] };
}

/** Indicateurs de comparaison de deux solutions (plus petit = meilleur, ordre lexicographique). */
function cost(r: Partial, specs: Map<string, PalletSpec>) {
  const unplaced = r.unplaced.reduce((s, u) => s + u.quantity, 0);
  const area = r.pallets.reduce((s, p) => { const sp = specs.get(p.specId)!; return s + sp.length * sp.width; }, 0);
  const money = r.pallets.reduce((s, p) => s + (specs.get(p.specId)!.cost ?? 0), 0);
  const fill = r.pallets.length ? r.pallets.reduce((s, p) => s + p.volumeFill, 0) / r.pallets.length : 0;
  return { unplaced, count: r.pallets.length, area, money, fill };
}

function better(a: ReturnType<typeof cost>, b: ReturnType<typeof cost>): boolean {
  if (a.unplaced !== b.unplaced) return a.unplaced < b.unplaced;
  if (a.count !== b.count) return a.count < b.count;
  if (Math.abs(a.area - b.area) > 1) return a.area < b.area;
  if (Math.abs(a.money - b.money) > 1e-6) return a.money < b.money;
  return a.fill > b.fill + 1e-9;
}

const m2 = (mm2: number) => (mm2 / 1e6).toLocaleString(numLocale(), { maximumFractionDigits: 2 });

function explain(best: { spec: PalletSpec; c: ReturnType<typeof cost> }, alt: { spec: PalletSpec; c: ReturnType<typeof cost> } | null): string {
  if (!alt) return tr('seul support disponible');
  const b = best.c;
  const a = alt.c;
  if (b.unplaced !== a.unplaced) return tr('{label} : tout est palettisé ({unplaced} colis restent hors palette en {label1})', { label: tText(best.spec.label), unplaced: a.unplaced, label1: tText(alt.spec.label) });
  if (b.count !== a.count) return tr('{label} : {count} palette(s) au lieu de {count1} en {label1}', { label: tText(best.spec.label), count: b.count, count1: a.count, label1: tText(alt.spec.label) });
  if (Math.abs(b.area - a.area) > 1) return tr('{label} : même nombre de palettes, {v1} m² au sol au lieu de {v2} m²', { label: tText(best.spec.label), v1: m2(b.area), v2: m2(a.area) });
  if (Math.abs(b.money - a.money) > 1e-6) return tr('{label} : moins cher ({money} € au lieu de {money1} €)', { label: tText(best.spec.label), money: b.money, money1: a.money });
  return tr('{label} : meilleur remplissage', { label: tText(best.spec.label) });
}

/**
 * Palettisation avec plusieurs supports disponibles.
 * - Un format par arrêt (défaut) : chaque support est essayé pour tout l'arrêt, le meilleur est retenu
 *   (moins de colis hors palette, moins de palettes, moins de surface au sol, moins cher, mieux rempli).
 * - Mélange autorisé : palettes complètes sur le support qui loge le plus de colis par m² de plancher,
 *   reliquats sur le support qui donne la meilleure solution.
 * - Supports imposés (ligne, puis arrêt) : toujours respectés.
 */
export function palletizeMulti(
  definitions: readonly ItemDefinition[], specs: readonly PalletSpec[], options: PalletizeOptions = {},
): PalletizeResult {
  const t0 = now();
  const available = specs.filter((s) => s.length > 0 && s.width > 0);

  // Un seul format pour tout l'envoi : chaque support est imposé à tous les arrêts, le meilleur gagne.
  if (options.oneFormatPerShipment && available.length > 1) {
    const stopsOf = [...new Set(definitions.map((d) => d.stop ?? 1))];
    const byIdAll = new Map(available.map((s) => [s.id, s]));
    const trials = available.map((spec) => {
      const forcedByStop = { ...Object.fromEntries(stopsOf.map((st) => [st, spec.id])), ...(options.forcedByStop ?? {}) };
      const r = palletizeMulti(definitions, available, { ...options, oneFormatPerShipment: false, oneFormatPerStop: true, forcedByStop });
      return { spec, r, c: cost(r, byIdAll) };
    });
    let best = trials[0];
    for (const t of trials.slice(1)) if (better(t.c, best.c)) best = t;
    const alt = trials.filter((t) => t !== best).sort((x, y) => (better(x.c, y.c) ? -1 : 1))[0] ?? null;
    const reason = tr('tout l\'envoi en {v1}', { v1: explain(best, alt) });
    best.r.choices = [{ stop: 0, destination: '', specIds: [...new Set(best.r.pallets.map((p) => p.specId))], reason }];
    best.r.computationTimeMs = Math.round(now() - t0);
    return best.r;
  }
  const byId = new Map(available.map((s) => [s.id, s]));
  const ctx: Ctx = { next: 1, fullFirst: options.fullPalletsFirst !== false, allowMixed: options.allowMixed !== false };
  const separate = options.separateStops !== false;
  const oneFormat = options.oneFormatPerStop !== false;
  const forcedDef = options.forcedByDefinition ?? {};
  const forcedStop = options.forcedByStop ?? {};

  const pallets: PalletPlan[] = [];
  const unplaced: UnplacedLine[] = [];
  const choices: SupportChoice[] = [];

  if (available.length === 0) {
    for (const d of definitions) if (d.quantity > 0) unplaced.push({ definitionId: d.id, reference: d.reference, quantity: d.quantity, reason: tr('aucun support disponible') });
    return { pallets, specs: [], choices, unplaced, totalItems: 0, palletizedItems: 0, computationTimeMs: 0 };
  }

  const active = definitions.filter((d) => d.quantity > 0);
  for (const group of groupByStop([...active], separate)) {
    const stop = group[0].stop ?? 1;
    const destination = group[0].destination ?? '';
    // Support imposé : ligne, puis arrêt (s'il existe parmi les supports disponibles).
    const forcedOf = (d: ItemDefinition): PalletSpec | null =>
      byId.get(forcedDef[d.id] ?? '') ?? (separate ? byId.get(forcedStop[d.stop ?? 1] ?? '') : undefined) ?? null;
    const forcedGroups = new Map<string, ItemDefinition[]>();
    const free: ItemDefinition[] = [];
    for (const d of group) {
      const f = forcedOf(d);
      if (f) { if (!forcedGroups.has(f.id)) forcedGroups.set(f.id, []); forcedGroups.get(f.id)!.push(d); } else free.push(d);
    }

    const used = new Set<string>();
    let reason = '';

    if (free.length > 0 && oneFormat) {
      // Chaque support candidat palettise tout l'arrêt (avec les lignes imposées sur ce même support).
      const trials = available.map((spec) => {
        const trialCtx: Ctx = { ...ctx };
        const r = onSpec([...free, ...(forcedGroups.get(spec.id) ?? [])], spec, trialCtx);
        return { spec, r, c: cost(r, byId), next: trialCtx.next };
      });
      let best = trials[0];
      for (const t of trials.slice(1)) if (better(t.c, best.c)) best = t;
      const alt = trials.filter((t) => t !== best).sort((x, y) => (better(x.c, y.c) ? -1 : 1))[0] ?? null;
      // On rejoue la solution retenue pour une numérotation continue.
      const r = onSpec([...free, ...(forcedGroups.get(best.spec.id) ?? [])], best.spec, ctx);
      pallets.push(...r.pallets); unplaced.push(...r.unplaced);
      forcedGroups.delete(best.spec.id);
      used.add(best.spec.id);
      reason = explain(best, alt);
    } else if (free.length > 0) {
      // Mélange autorisé : palettes complètes sur le support le plus dense au sol…
      const pool: ItemDefinition[] = [];
      for (const d of free) {
        let bestSpec: PalletSpec | null = null;
        let bestDensity = 0;
        for (const spec of available) {
          if (unplaceableReason(d, spec)) continue;
          const plan = bestFullPallet(d, spec);
          const density = plan ? plan.capacity / (spec.length * spec.width) : 0;
          if (!bestSpec || density > bestDensity) { bestSpec = spec; bestDensity = density; }
        }
        if (!bestSpec) { unplaced.push({ definitionId: d.id, reference: d.reference, quantity: d.quantity, reason: unplaceableReason(d, available[0]) ?? tr('ne tient sur aucun support') }); continue; }
        const before = pallets.length;
        const rest = fullPhase(d, bestSpec, ctx, pallets);
        if (pallets.length > before) used.add(bestSpec.id);
        if (rest > 0) pool.push({ ...d, quantity: rest });
      }
      // …puis reliquats sur le support qui donne la meilleure solution.
      if (pool.length > 0) {
        const trials = available.map((spec) => {
          const trialCtx: Ctx = { ...ctx };
          const fits = pool.filter((d) => !unplaceableReason(d, spec));
          const r = mixedPhase(fits, spec, trialCtx);
          const out = pool.filter((d) => unplaceableReason(d, spec));
          r.unplaced.push(...out.map((d) => ({ definitionId: d.id, reference: d.reference, quantity: d.quantity, reason: `${unplaceableReason(d, spec)} (${tText(spec.label)})` })));
          return { spec, c: cost(r, byId) };
        });
        let best = trials[0];
        for (const t of trials.slice(1)) if (better(t.c, best.c)) best = t;
        const fits = pool.filter((d) => !unplaceableReason(d, best.spec));
        const r = mixedPhase(fits, best.spec, ctx);
        pallets.push(...r.pallets); unplaced.push(...r.unplaced);
        for (const d of pool.filter((x) => unplaceableReason(x, best.spec))) {
          unplaced.push({ definitionId: d.id, reference: d.reference, quantity: d.quantity, reason: `${unplaceableReason(d, best.spec)} (${tText(best.spec.label)})` });
        }
        if (r.pallets.length) used.add(best.spec.id);
      }
      reason = tr('formats mélangés : support le plus dense par référence');
    }

    // Lignes imposées sur un autre support.
    for (const [specId, defs] of forcedGroups) {
      const spec = byId.get(specId)!;
      const r = onSpec(defs, spec, ctx);
      pallets.push(...r.pallets); unplaced.push(...r.unplaced);
      used.add(specId);
      reason = reason ? tr('{reason} · {label} imposé', { reason: reason, label: tText(spec.label) }) : tr('{label} imposé', { label: tText(spec.label) });
    }
    choices.push({ stop, destination, specIds: [...used], reason });
  }

  // Numérotation continue PAL-001… dans l'ordre des arrêts.
  pallets.forEach((p, i) => { p.index = i + 1; p.id = `PAL-${String(i + 1).padStart(3, '0')}`; });

  const totalItems = definitions.reduce((s, d) => s + Math.max(0, d.quantity), 0);
  const palletizedItems = pallets.reduce((s, p) => s + p.placed.length, 0);
  return { pallets, specs: available, choices, unplaced, totalItems, palletizedItems, computationTimeMs: Math.round(now() - t0) };
}

/** Un seul support (compatibilité). */
export function palletize(
  definitions: readonly ItemDefinition[], pallet: PalletSpec, options: PalletizeOptions = {},
): PalletizeResult {
  return palletizeMulti(definitions, [pallet], options);
}
