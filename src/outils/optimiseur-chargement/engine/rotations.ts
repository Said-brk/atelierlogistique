import type { Dimensions, RotationMode } from './types';

/**
 * Orientations géométriques autorisées pour une boîte selon son mode de rotation.
 * - NONE       : l'orientation d'origine uniquement.
 * - HORIZONTAL : rotation autour de l'axe vertical → la hauteur reste fixe,
 *                longueur et largeur peuvent s'échanger (2 orientations).
 * - FULL       : les 6 permutations géométriques.
 * Les doublons (dimensions égales) sont éliminés.
 */
export function getOrientations(d: Dimensions, mode: RotationMode): Dimensions[] {
  const { length: L, width: W, height: H } = d;

  let candidates: Dimensions[];
  if (mode === 'NONE') {
    candidates = [{ length: L, width: W, height: H }];
  } else if (mode === 'HORIZONTAL') {
    candidates = [
      { length: L, width: W, height: H },
      { length: W, width: L, height: H },
    ];
  } else {
    candidates = [
      { length: L, width: W, height: H },
      { length: L, width: H, height: W },
      { length: W, width: L, height: H },
      { length: W, width: H, height: L },
      { length: H, width: L, height: W },
      { length: H, width: W, height: L },
    ];
  }

  const seen = new Set<string>();
  const unique: Dimensions[] = [];
  for (const c of candidates) {
    const key = `${c.length}x${c.width}x${c.height}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  }
  return unique;
}

/** Angles de rotation (degrés) décrivant le passage des dimensions d'origine à l'orientation donnée. */
export function rotationAngles(original: Dimensions, oriented: Dimensions): { x: number; y: number; z: number } {
  // Rotation autour de Z : longueur/largeur échangées, hauteur conservée.
  if (oriented.height === original.height && oriented.length === original.width && oriented.width === original.length) {
    return { x: 0, y: 0, z: 90 };
  }
  // Couchée sur le côté (rotation autour de X) : hauteur devient largeur d'origine.
  if (oriented.height === original.width) {
    return { x: 90, y: 0, z: 0 };
  }
  // Couchée vers l'avant (rotation autour de Y) : hauteur devient longueur d'origine.
  if (oriented.height === original.length) {
    return { x: 0, y: 90, z: 0 };
  }
  return { x: 0, y: 0, z: 0 };
}
