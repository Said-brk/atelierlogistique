import type { Box, PlacedItem } from './types';
import { EPS } from '../constants/engine-config';

/** Aire de recouvrement dans le plan horizontal (XY) entre deux boîtes. */
export function overlapAreaXY(a: Box, b: Box): number {
  const dx = Math.min(a.x + a.length, b.x + b.length) - Math.max(a.x, b.x);
  const dy = Math.min(a.y + a.width, b.y + b.width) - Math.max(a.y, b.y);
  return dx > 0 && dy > 0 ? dx * dy : 0;
}

/**
 * Fraction de la base de `box` effectivement supportée par des unités dont la
 * face supérieure est au niveau de la base de `box`. Un objet posé au sol est
 * supporté à 100 %.
 */
export function supportRatio(box: Box, placed: readonly PlacedItem[]): number {
  if (box.z <= EPS) return 1;
  const baseArea = box.length * box.width;
  if (baseArea <= 0) return 0;

  let supported = 0;
  for (const p of placed) {
    if (Math.abs((p.z + p.height) - box.z) <= EPS) {
      supported += overlapAreaXY(box, p);
    }
  }
  return Math.min(1, supported / baseArea);
}

/** Existe-t-il, directement sous `box`, une unité marquée non empilable ? */
export function hasNonStackableBelow(box: Box, placed: readonly PlacedItem[]): boolean {
  for (const p of placed) {
    if (!p.stackable && Math.abs((p.z + p.height) - box.z) <= EPS && overlapAreaXY(box, p) > EPS) {
      return true;
    }
  }
  return false;
}

/**
 * Un emplacement est stable si :
 *  - l'objet est posé au sol, ou
 *  - au moins MIN_SUPPORT_RATIO de sa base repose sur des unités en dessous,
 *  - et aucune de ces unités n'est non empilable.
 */
export function isStable(box: Box, placed: readonly PlacedItem[], minSupportRatio: number): boolean {
  if (box.z <= EPS) return true;
  if (hasNonStackableBelow(box, placed)) return false;
  return supportRatio(box, placed) >= minSupportRatio - EPS;
}
