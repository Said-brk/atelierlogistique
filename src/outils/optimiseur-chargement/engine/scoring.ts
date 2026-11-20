import type { Box, ContainerDefinition, PlacedItem, ScoringWeights } from './types';
import { EPS, SCORING } from '../constants/engine-config';
import { overlapAreaXY } from './support';

function overlapYZ(a: Box, b: Box): number {
  const dy = Math.min(a.y + a.width, b.y + b.width) - Math.max(a.y, b.y);
  const dz = Math.min(a.z + a.height, b.z + b.height) - Math.max(a.z, b.z);
  return dy > 0 && dz > 0 ? dy * dz : 0;
}

function overlapXZ(a: Box, b: Box): number {
  const dx = Math.min(a.x + a.length, b.x + b.length) - Math.max(a.x, b.x);
  const dz = Math.min(a.z + a.height, b.z + b.height) - Math.max(a.z, b.z);
  return dx > 0 && dz > 0 ? dx * dz : 0;
}

/** Aire des faces de `box` en contact avec les parois du contenant ou d'autres unités. */
export function contactArea(box: Box, container: ContainerDefinition, placed: readonly PlacedItem[]): number {
  const { x, y, z, length, width, height } = box;
  let area = 0;

  // Parois du contenant
  if (x <= EPS) area += width * height;
  if (Math.abs(x + length - container.length) <= EPS) area += width * height;
  if (y <= EPS) area += length * height;
  if (Math.abs(y + width - container.width) <= EPS) area += length * height;
  if (z <= EPS) area += length * width;

  // Unités déjà placées
  for (const p of placed) {
    if (Math.abs((p.z + p.height) - z) <= EPS) area += overlapAreaXY(box, p);
    if (Math.abs((p.x + p.length) - x) <= EPS || Math.abs((x + length) - p.x) <= EPS) area += overlapYZ(box, p);
    if (Math.abs((p.y + p.width) - y) <= EPS || Math.abs((y + width) - p.y) <= EPS) area += overlapXZ(box, p);
  }
  return area;
}

/**
 * Score d'un emplacement candidat. Plus BAS = meilleur.
 * Favorise : proximité du sol, proximité de l'origine, base bien supportée,
 * fort contact avec parois et voisins (chargement compact et stable).
 */
export function scorePlacement(
  box: Box,
  container: ContainerDefinition,
  placed: readonly PlacedItem[],
  supportRatioValue: number,
  weights: ScoringWeights = SCORING,
): number {
  const zTopNorm = (box.z + box.height) / container.height;
  const posNorm = (box.x + box.y) / (container.length + container.width);
  const surface = 2 * (box.length * box.width + box.length * box.height + box.width * box.height);
  const contactNorm = surface > 0 ? contactArea(box, container, placed) / surface : 0;

  return (
    weights.floorPenalty * zTopNorm +
    weights.originDistancePenalty * posNorm +
    weights.wastedSpacePenalty * (1 - supportRatioValue) -
    weights.contactBonus * contactNorm
  );
}
