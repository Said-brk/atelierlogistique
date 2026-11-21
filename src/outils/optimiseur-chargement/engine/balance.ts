// Répartition des charges et arrimage : contrôle A POSTERIORI d'un plan de
// chargement (le placement n'est pas modifié).
//
// Repère : X depuis la face avant (cabine) vers les portes, Y en largeur, Z en hauteur (mm).
//
// 1) Centre de gravité de la charge (barycentre des colis placés).
// 2) Véhicule à deux appuis (semi-remorque : pivot de sellette + groupe d'essieux) :
//    la part de charge utile reportée sur un appui est inversement proportionnelle à
//    la distance entre cet appui et le centre de gravité (bras de levier) :
//      R_arrière = P × (x_cg − a) / (b − a) ;  R_avant = P − R_arrière
// 3) Conteneur : excentricité longitudinale du centre de gravité ≤ ±5 % de la
//    longueur (CTU Code, annexe 7 § 3.1.4).
// 4) Arrimage par friction (sangles par-dessus), EN 12195-1 — estimation :
//      masse retenue par sangle = 2 · µ · sin α · STF / (g · (c − µ·cz) · fs)
//    avec c = 0,5 et fs = 1,1 latéralement / vers l'arrière, c = 0,8 et fs = 1,25 vers
//    l'avant, cz = 1. Minimum une sangle par mur (rangée).

import type { ContainerDefinition, PlacedItem } from './types';
import { N_ } from '../../../shared/i18n/core';

const G = 9.81;

export type BalanceStatus = 'ok' | 'warn' | 'over';

export interface AxleProfile {
  kind: 'TWO_SUPPORTS' | 'CONTAINER';
  frontLabel: string;
  rearLabel: string;
  /** Position de l'appui avant depuis la face avant (mm). */
  frontPos: number;
  /** Position de l'appui arrière (centre du groupe d'essieux) depuis la face avant (mm). */
  rearPos: number;
  /** Charge utile maximale reprise par chaque appui (kg). */
  frontMax: number;
  rearMax: number;
}

export interface LashingParams {
  /** Coefficient de frottement µ entre la charge et le plancher. */
  mu: number;
  /** Force de tension standard d'une sangle (daN). */
  stfDaN: number;
  /** Angle de la sangle par rapport au plancher (degrés). */
  angleDeg: number;
  /** Charge bloquée vers l'avant (contre la face avant et les murs précédents). */
  forwardBlocked: boolean;
}

export const DEFAULT_LASHING: LashingParams = { mu: 0.3, stfDaN: 400, angleDeg: 90, forwardBlocked: true };

export interface SupportLoads {
  front: number; rear: number;
  frontPct: number; rearPct: number;
  status: BalanceStatus;
  /** Zone conseillée du centre de gravité (mm depuis la face avant) pour ce poids ; null si impossible. */
  zone: { from: number; to: number } | null;
}

export interface BalanceSnapshot {
  weight: number;
  cog: { x: number; y: number; z: number } | null;
  /** Décalage latéral du CdG / largeur (0 = centré). */
  lateralPct: number;
  /** Excentricité longitudinale / longueur (conteneur). */
  longitudinalPct: number;
  supports: SupportLoads | null;
  status: BalanceStatus;
}

export interface WallLashing { wall: number; weight: number; straps: number }

export interface BalanceReport extends BalanceSnapshot {
  profile: AxleProfile;
  /** Après la livraison de chaque arrêt (tournées) : état du véhicule pour la suite du trajet. */
  afterStops: Array<{ stop: number } & BalanceSnapshot>;
  lashing: { perStrapKg: number | null; walls: WallLashing[]; total: number; params: LashingParams };
}

/** Profils par défaut (valeurs indicatives, à ajuster selon la carte grise / la fiche constructeur). */
export function defaultAxleProfile(container: ContainerDefinition): AxleProfile {
  if (container.id === 'semi') {
    return {
      kind: 'TWO_SUPPORTS',
      frontLabel: N_('Sellette (avant)'), rearLabel: N_('Essieux remorque'),
      frontPos: 1000, rearPos: 9000,
      frontMax: 11000, rearMax: 18000,
    };
  }
  // Porteurs et fourgon (mode Flotte automatique) : essieu avant devant la caisse (position négative),
  // essieu arrière sous la caisse. Charges utiles par essieu indicatives.
  const ROAD: Record<string, Pick<AxleProfile, 'frontPos' | 'rearPos' | 'frontMax' | 'rearMax'>> = {
    porteur19: { frontPos: -1300, rearPos: 4900, frontMax: 3000, rearMax: 7500 },
    porteur12: { frontPos: -1200, rearPos: 4100, frontMax: 1800, rearMax: 4500 },
    fourgon20: { frontPos: -1000, rearPos: 2900, frontMax: 450, rearMax: 850 },
  };
  const road = ROAD[container.id];
  if (road) return { kind: 'TWO_SUPPORTS', frontLabel: N_('Essieu avant'), rearLabel: N_('Essieu arrière'), ...road };
  return {
    kind: 'CONTAINER',
    frontLabel: N_('Avant'), rearLabel: N_('Arrière'),
    frontPos: 0, rearPos: container.length,
    frontMax: container.maxWeight ?? 0, rearMax: container.maxWeight ?? 0,
  };
}

const statusOfPct = (pct: number): BalanceStatus => (pct > 1 + 1e-9 ? 'over' : pct > 0.9 ? 'warn' : 'ok');
const worst = (...s: BalanceStatus[]): BalanceStatus => (s.includes('over') ? 'over' : s.includes('warn') ? 'warn' : 'ok');

export function snapshot(container: ContainerDefinition, items: readonly PlacedItem[], profile: AxleProfile): BalanceSnapshot {
  let w = 0, mx = 0, my = 0, mz = 0;
  for (const p of items) {
    w += p.weight;
    mx += p.weight * (p.x + p.length / 2);
    my += p.weight * (p.y + p.width / 2);
    mz += p.weight * (p.z + p.height / 2);
  }
  if (w <= 0) {
    return { weight: 0, cog: null, lateralPct: 0, longitudinalPct: 0, supports: null, status: 'ok' };
  }
  const cog = { x: mx / w, y: my / w, z: mz / w };
  const lateralPct = (cog.y - container.width / 2) / container.width;
  const longitudinalPct = (cog.x - container.length / 2) / container.length;

  let supports: SupportLoads | null = null;
  let status: BalanceStatus;
  const lateralStatus: BalanceStatus = Math.abs(lateralPct) > 0.05 ? 'warn' : 'ok';

  if (profile.kind === 'TWO_SUPPORTS' && profile.rearPos > profile.frontPos) {
    const span = profile.rearPos - profile.frontPos;
    const rear = (w * (cog.x - profile.frontPos)) / span;
    const front = w - rear;
    const frontPct = profile.frontMax > 0 ? front / profile.frontMax : 0;
    const rearPct = profile.rearMax > 0 ? rear / profile.rearMax : 0;
    // Zone du CdG où les deux appuis restent dans leurs limites pour ce poids.
    const from = profile.frontPos + (span * Math.max(0, w - profile.frontMax)) / w;
    const to = profile.frontPos + (span * Math.min(w, profile.rearMax)) / w;
    supports = {
      front, rear, frontPct, rearPct,
      // Une valeur négative signifie seulement que la charge est en porte-à-faux devant
      // (ou derrière) un appui : seul le dépassement des limites est une non-conformité.
      status: worst(statusOfPct(frontPct), statusOfPct(rearPct)),
      zone: from <= to ? { from, to } : null,
    };
    status = worst(supports.status, lateralStatus);
  } else {
    const ecc = Math.abs(longitudinalPct);
    status = worst(ecc > 0.05 ? 'over' : ecc > 0.04 ? 'warn' : 'ok', lateralStatus);
  }
  return { weight: w, cog, lateralPct, longitudinalPct, supports, status };
}

/** Masse (kg) retenue par une sangle par-dessus dans une direction ; null = le frottement suffit. */
export function massPerStrap(c: number, fs: number, p: LashingParams): number | null {
  const net = c - p.mu * 1; // cz = 1
  if (net <= 0) return null;
  const sinA = Math.sin((Math.max(1, Math.min(90, p.angleDeg)) * Math.PI) / 180);
  return (2 * p.mu * sinA * p.stfDaN * 10) / (G * net * fs);
}

export function lashingPlan(placed: readonly PlacedItem[], p: LashingParams): BalanceReport['lashing'] {
  const side = massPerStrap(0.5, 1.1, p);
  const fwd = p.forwardBlocked ? null : massPerStrap(0.8, 1.25, p);
  const perStrapKg = [side, fwd].filter((v): v is number => v !== null).reduce<number | null>((m, v) => (m === null ? v : Math.min(m, v)), null);

  const byWall = new Map<number, number>();
  for (const it of placed) {
    const key = it.wall > 0 ? it.wall : 1;
    byWall.set(key, (byWall.get(key) ?? 0) + it.weight);
  }
  const walls = [...byWall.entries()].sort((a, b) => a[0] - b[0]).map(([wall, weight]) => ({
    wall, weight,
    straps: Math.max(1, perStrapKg ? Math.ceil(weight / perStrapKg) : 0),
  }));
  return { perStrapKg, walls, total: walls.reduce((s, w) => s + w.straps, 0), params: p };
}

export function analyzeBalance(
  container: ContainerDefinition,
  placed: readonly PlacedItem[],
  profile: AxleProfile = defaultAxleProfile(container),
  lashing: LashingParams = DEFAULT_LASHING,
): BalanceReport {
  const base = snapshot(container, placed, profile);
  const stops = [...new Set(placed.map((p) => p.stop))].sort((a, b) => a - b);
  const afterStops = stops.length > 1
    ? stops.slice(0, -1).map((s) => ({ stop: s, ...snapshot(container, placed.filter((p) => p.stop > s), profile) }))
    : [];
  return { ...base, profile, afterStops, lashing: lashingPlan(placed, lashing) };
}

// ---------------------------------------------------------------------------
// Décalage du chargement : translation de tout le bloc vers les portes.
// Les positions relatives des colis sont conservées : murs, ordre des arrêts,
// empilage, colis au sol et accessibilité restent identiques.
// ---------------------------------------------------------------------------

export interface ShiftSuggestion {
  /** Décalage proposé vers l'arrière (mm, arrondi au décimètre supérieur). */
  shift: number;
  before: BalanceSnapshot;
  after: BalanceSnapshot;
  /** Le décalage disponible ne suffit pas à revenir dans la zone verte. */
  partial: boolean;
}

/** Translate le bloc de chargement de `shift` mm vers les portes. */
export function shiftPlaced<T extends PlacedItem>(placed: readonly T[], shift: number): T[] {
  if (!shift) return placed as T[];
  return placed.map((p) => ({ ...p, x: p.x + shift }));
}

/**
 * Propose un décalage vers l'arrière quand l'avant est trop chargé (sellette au-delà
 * de 90 %, ou conteneur trop chargé vers l'avant) et qu'il reste de la place côté portes.
 * null si inutile ou impossible.
 */
export function suggestShift(
  container: ContainerDefinition,
  placed: readonly PlacedItem[],
  profile: AxleProfile = defaultAxleProfile(container),
): ShiftSuggestion | null {
  const before = snapshot(container, placed, profile);
  if (!before.cog || placed.length === 0) return null;
  const freeAtRear = container.length - Math.max(...placed.map((p) => p.x + p.length));
  if (freeAtRear < 100) return null;

  let target: number;
  if (before.supports && profile.kind === 'TWO_SUPPORTS') {
    if (before.supports.frontPct <= 0.9) return null;
    const span = profile.rearPos - profile.frontPos;
    const w = before.weight;
    // Sellette ramenée à 90 % de sa limite, sans dépasser la limite des essieux.
    const needed = profile.frontPos + (span * Math.max(0, w - 0.9 * profile.frontMax)) / w;
    const rearLimit = profile.frontPos + (span * profile.rearMax) / w;
    target = Math.min(needed, rearLimit);
  } else {
    if (before.longitudinalPct >= -0.04) return null;
    target = container.length / 2 - 0.02 * container.length;
  }

  const wanted = target - before.cog.x;
  if (wanted <= 0) return null;
  const shift = Math.min(Math.ceil(wanted / 100) * 100, Math.floor(freeAtRear / 100) * 100);
  if (shift <= 0) return null;

  const after = snapshot(container, shiftPlaced(placed, shift), profile);
  const improves = after.supports
    ? after.supports.frontPct < before.supports!.frontPct - 0.01
    : Math.abs(after.longitudinalPct) < Math.abs(before.longitudinalPct) - 0.005;
  if (!improves) return null;
  return { shift, before, after, partial: shift < Math.ceil(wanted / 100) * 100 };
}
