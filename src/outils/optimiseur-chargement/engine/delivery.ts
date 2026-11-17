// Livraisons multi-arrêts (tournée) : règle d'accessibilité LIFO.
//
// Convention : les PORTES du contenant sont à l'arrière, en X = container.length
// (l'origine X = 0 est le fond, côté cabine). L'arrêt 1 est livré en premier.
//
// Un colis livré tôt (arrêt a) est BLOQUÉ par un colis livré plus tard
// (arrêt b > a) si ce dernier se trouve :
//   - devant lui, côté portes, sur la même section largeur × hauteur (YZ), ou
//   - au-dessus de lui, sur la même emprise au sol (XY).
// Il faudrait alors décharger le colis de l'arrêt b avant de pouvoir livrer a.

import type { Box, DeliveryStopSummary, ItemInstance, PlacedItem } from './types';
import { EPS } from '../constants/engine-config';

export const DEFAULT_STOP = 1;

/** Normalise un numéro d'arrêt (entier ≥ 1). */
export function normalizeStop(stop: unknown): number {
  const n = Math.round(Number(stop));
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_STOP;
}

function overlapYZ(a: Box, b: Box): boolean {
  return (
    Math.min(a.y + a.width, b.y + b.width) - Math.max(a.y, b.y) > EPS &&
    Math.min(a.z + a.height, b.z + b.height) - Math.max(a.z, b.z) > EPS
  );
}

function overlapXY(a: Box, b: Box): boolean {
  return (
    Math.min(a.x + a.length, b.x + b.length) - Math.max(a.x, b.x) > EPS &&
    Math.min(a.y + a.width, b.y + b.width) - Math.max(a.y, b.y) > EPS
  );
}

/** `blocker` empêche-t-il l'accès à `item` depuis les portes (ou par le dessus) ? */
export function blocks(blocker: Box, item: Box): boolean {
  const inFront = blocker.x >= item.x + item.length - EPS && overlapYZ(blocker, item);
  const onTop = blocker.z >= item.z + item.height - EPS && overlapXY(blocker, item);
  return inFront || onTop;
}

/**
 * Nombre de colis livrés PLUS TARD (parmi `later`) qui bloqueraient `box`.
 * `later` doit déjà être filtré sur stop > stop(box).
 * `laterMaxX` (fin X maximale des colis de `later`) permet un rejet rapide :
 * si la boîte commence au-delà, rien ne peut se trouver devant elle.
 */
export function countBlockers(box: Box, later: readonly PlacedItem[], laterMaxX: number): number {
  if (later.length === 0) return 0;
  if (box.x >= laterMaxX - EPS) {
    // Rien devant : il ne reste que le cas « posé dessus », impossible si
    // tous les colis plus tardifs se terminent avant le début de la boîte.
    return 0;
  }
  let n = 0;
  for (const p of later) if (blocks(p, box)) n++;
  return n;
}

/** Identifiants des colis placés dont la livraison est bloquée par un arrêt ultérieur. */
export function findBlockedItems(placed: readonly PlacedItem[]): string[] {
  const out: string[] = [];
  for (const a of placed) {
    for (const b of placed) {
      if (b.stop > a.stop && blocks(b, a)) { out.push(a.id); break; }
    }
  }
  return out;
}

/** Synthèse par arrêt (ordre croissant de livraison). */
export function summarizeStops(
  placed: readonly PlacedItem[],
  unpacked: readonly ItemInstance[],
): DeliveryStopSummary[] {
  const map = new Map<number, DeliveryStopSummary>();
  const get = (stop: number, destination: string): DeliveryStopSummary => {
    let s = map.get(stop);
    if (!s) {
      s = { stop, destination, totalItems: 0, packedItems: 0, unpackedItems: 0, packedWeight: 0, packedVolume: 0 };
      map.set(stop, s);
    }
    if (!s.destination && destination) s.destination = destination;
    return s;
  };
  for (const p of placed) {
    const s = get(p.stop, p.destination);
    s.totalItems++; s.packedItems++;
    s.packedWeight += p.weight;
    s.packedVolume += p.length * p.width * p.height;
  }
  for (const u of unpacked) {
    const s = get(u.stop, u.destination);
    s.totalItems++; s.unpackedItems++;
  }
  return [...map.values()].sort((a, b) => a.stop - b.stop);
}
