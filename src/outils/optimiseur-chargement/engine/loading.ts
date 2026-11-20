// Règles de chargement physique : chargeabilité, murs, hauteurs de manutention.
//
// Convention : portes à l'arrière, en X = container.length. Le cariste ou le
// magasinier entre par les portes : pour poser un colis, l'espace entre ce
// colis et les portes, sur sa section largeur × hauteur (YZ), doit être libre.

import type { Box, ContainerDefinition, ItemInstance, LoadingMode, LoadingOptions, PlacedItem, ScoringWeights, WallSummary } from './types';
import { EPS, SCORING } from '../constants/engine-config';

export interface ResolvedLoading {
  mode: LoadingMode;
  wallDepth: number;            // mm (résolu)
  manualMaxHeight: number | null;
  heavyMaxHeight: number | null;
  heavyThresholdKg: number;
  mechanizedAboveKg: number;
  scoring: ScoringWeights;
}

const positiveOrNull = (v: unknown): number | null => {
  const n = Number(v);
  return v === null || v === undefined || !Number.isFinite(n) || n <= 0 ? null : n;
};

/** Profondeur de mur automatique : plus grande dimension au sol parmi les unités. */
export function autoWallDepth(items: readonly ItemInstance[]): number {
  let d = 0;
  for (const it of items) d = Math.max(d, it.dimensions.length, it.dimensions.width);
  return d;
}

/**
 * Options résolues. Sans options, le moteur reste en chargement LIBRE sans
 * limite de hauteur (comportement historique) ; l'interface envoie ses réglages.
 */
export function resolveLoading(opts: LoadingOptions | undefined, items: readonly ItemInstance[]): ResolvedLoading {
  const o = opts ?? {};
  const fixed = positiveOrNull(o.wallDepth);
  return {
    mode: o.mode === 'WALLS' ? 'WALLS' : 'FREE',
    wallDepth: fixed ?? Math.max(autoWallDepth(items), 1),
    manualMaxHeight: positiveOrNull(o.manualMaxHeight),
    heavyMaxHeight: positiveOrNull(o.heavyMaxHeight),
    heavyThresholdKg: Number.isFinite(Number(o.heavyThresholdKg)) ? Number(o.heavyThresholdKg) : Infinity,
    mechanizedAboveKg: Number.isFinite(Number(o.mechanizedAboveKg)) ? Number(o.mechanizedAboveKg) : Infinity,
    scoring: { ...SCORING, ...(o.scoring ?? {}) },
  };
}

/** Hauteur maximale (dessus du colis) autorisée pour cette unité. */
export function heightCap(item: { weight: number }, cfg: ResolvedLoading, container: ContainerDefinition): number {
  if (item.weight > cfg.mechanizedAboveKg) return container.height; // engin : pas de limite manuelle
  let cap = container.height;
  if (cfg.manualMaxHeight !== null) cap = Math.min(cap, cfg.manualMaxHeight);
  if (cfg.heavyMaxHeight !== null && item.weight > cfg.heavyThresholdKg) cap = Math.min(cap, cfg.heavyMaxHeight);
  return cap;
}

function overlapYZ(a: Box, b: Box): boolean {
  return (
    Math.min(a.y + a.width, b.y + b.width) - Math.max(a.y, b.y) > EPS &&
    Math.min(a.z + a.height, b.z + b.height) - Math.max(a.z, b.z) > EPS
  );
}

/** `p` (déjà chargé) se trouve-t-il entre `box` et les portes ? */
export function isInFront(p: Box, box: Box): boolean {
  return p.x >= box.x + box.length - EPS && overlapYZ(p, box);
}

/** Contrôle a posteriori : colis dont l'accès était déjà obstrué au moment de leur chargement. */
export function findLoadingViolations(placed: readonly PlacedItem[]): string[] {
  const bySeq = [...placed].sort((a, b) => a.sequence - b.sequence);
  const out: string[] = [];
  for (let i = 0; i < bySeq.length; i++) {
    const it = bySeq[i];
    for (let j = 0; j < i; j++) {
      if (isInFront(bySeq[j], it)) { out.push(it.id); break; }
    }
  }
  return out;
}

/** Synthèse par mur (chargement par murs uniquement). */
export function summarizeWalls(placed: readonly PlacedItem[]): WallSummary[] {
  const map = new Map<number, WallSummary>();
  for (const p of placed) {
    if (p.wall <= 0) continue;
    let w = map.get(p.wall);
    if (!w) { w = { wall: p.wall, xStart: p.x, xEnd: p.x + p.length, items: 0, weight: 0 }; map.set(p.wall, w); }
    w.items++;
    w.weight += p.weight;
    w.xStart = Math.min(w.xStart, p.x);
    w.xEnd = Math.max(w.xEnd, p.x + p.length);
  }
  return [...map.values()].sort((a, b) => a.wall - b.wall);
}
