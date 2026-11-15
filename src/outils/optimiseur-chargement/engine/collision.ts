import type { Box, ContainerDefinition } from './types';
import { EPS } from '../constants/engine-config';

/**
 * Deux boîtes alignées sur les axes s'intersectent si leurs projections se
 * chevauchent STRICTEMENT sur les trois axes. Des faces simplement jointives
 * (contact exact) ne constituent pas une collision.
 */
export function boxesIntersect(a: Box, b: Box): boolean {
  return (
    a.x + EPS < b.x + b.length && b.x + EPS < a.x + a.length &&
    a.y + EPS < b.y + b.width  && b.y + EPS < a.y + a.width  &&
    a.z + EPS < b.z + b.height && b.z + EPS < a.z + a.height
  );
}

/** La boîte tient-elle entièrement dans le contenant (sans dépasser les parois) ? */
export function isWithinContainer(box: Box, c: ContainerDefinition): boolean {
  return (
    box.x >= -EPS && box.y >= -EPS && box.z >= -EPS &&
    box.x + box.length <= c.length + EPS &&
    box.y + box.width  <= c.width  + EPS &&
    box.z + box.height <= c.height + EPS
  );
}

/** La boîte entre-t-elle en collision avec l'une des boîtes déjà placées ? */
export function collidesWithAny(box: Box, others: readonly Box[]): boolean {
  for (const other of others) {
    if (boxesIntersect(box, other)) return true;
  }
  return false;
}
