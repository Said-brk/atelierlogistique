// Regroupement de chargements : pour les chargements d'un même jour, l'outil calcule la meilleure flotte de
// chaque chargement SÉPARÉMENT, puis de deux chargements ENSEMBLE (même moteur 3D, mêmes véhicules et coûts
// de l'entreprise). Une proposition n'apparaît que si le calcul « ensemble » coûte moins cher : l'écart compare
// deux calculs réels de l'outil, jamais une situation supposée.
//
// Ensemble = une tournée : arrêts du premier chargement, puis ceux du second (ordre modifiable ensuite).

import { planFleet, type FleetPlan, type FleetVehicle } from '../../outils/optimiseur-chargement/engine/fleet';
import { rowsToDefinitions } from '../../outils/optimiseur-chargement/uiHelpers';
import type { ContainerDefinition } from '../../outils/optimiseur-chargement/engine/types';

export interface Row {
  id: string; reference: string; quantity: number; length: number; width: number; height: number; weight: number;
  stop?: number; destination?: string; [k: string]: unknown;
}
export interface DayShipment {
  id: string; code: string; label: string | null; status: string; departure_at: string | null;
  input: { rows?: Row[]; deliveryMode?: 'STRICT' | 'SOFT' } | null;
}
export interface Evaluation { cost: number; trucks: { label: string; cost: number; fill: number }[]; ok: boolean; reason?: string }
export interface Suggestion {
  codes: [string, string];
  separate: number;           // coût calculé séparément (somme)
  together: Evaluation;       // calcul ensemble
  saving: number;             // separate − together.cost (> 0)
  trucksBefore: number;
  rows: Row[];                // lignes fusionnées (tournée A puis B)
  plan: FleetPlan;            // flotte calculée ensemble
}
export interface Analysis { separate: Record<string, Evaluation>; suggestions: Suggestion[]; skipped: string[] }

const OPTS = { deliveryMode: 'STRICT' as const, loading: { mode: 'WALLS' as const } };
const validRows = (s: DayShipment) => (s.input?.rows ?? []).filter((r) => r.reference?.trim() && r.quantity > 0 && r.length > 0 && r.width > 0 && r.height > 0);
const volM3 = (rows: Row[]) => rows.reduce((t, r) => t + (r.length * r.width * r.height * r.quantity) / 1e6, 0);
const kg = (rows: Row[]) => rows.reduce((t, r) => t + (Number(r.weight) || 0) * r.quantity, 0);
const capM3 = (c: ContainerDefinition) => (c.length * c.width * c.height) / 1e9;

/** Lignes de plusieurs chargements en une tournée : ids préfixés, arrêts renumérotés à la suite. */
export function mergeRows(list: DayShipment[]): Row[] {
  const out: Row[] = [];
  let offset = 0;
  for (const s of list) {
    const rows = validRows(s);
    const stops = [...new Set(rows.map((r) => r.stop ?? 1))].sort((a, b) => a - b);
    const map = new Map(stops.map((st, i) => [st, offset + i + 1]));
    for (const r of rows) {
      out.push({ ...r, id: `${s.code}:${r.id}`, stop: map.get(r.stop ?? 1)!, destination: r.destination || s.label || s.code, fromShipment: s.code });
    }
    offset += stops.length;
  }
  return out;
}

export function evaluate(rows: Row[], vehicles: FleetVehicle[]): { ev: Evaluation; plan: FleetPlan } {
  const plan = planFleet(rowsToDefinitions(rows), vehicles, OPTS);
  const ok = plan.trucks.length > 0 && plan.unplaced.length === 0;
  return {
    plan,
    ev: {
      ok, cost: plan.totalCost, reason: ok ? undefined : plan.unplaced[0]?.reason ?? 'Aucun véhicule ne convient',
      trucks: plan.trucks.map((t) => ({ label: t.container.label, cost: t.cost, fill: t.volumeUtilization })),
    },
  };
}

/**
 * maxPairs : nombre maximal de paires calculées (le moteur 3D est coûteux) ; les paires les plus prometteuses
 * d'abord. onProgress(fait, total).
 */
export function analyzeDay(
  shipments: DayShipment[], vehicles: FleetVehicle[],
  { maxPairs = 24, onProgress }: { maxPairs?: number; onProgress?: (done: number, total: number) => void } = {},
): Analysis {
  const usable = shipments.filter((s) => validRows(s).length > 0);
  const skipped = shipments.filter((s) => !usable.includes(s)).map((s) => s.code);
  const biggest = vehicles.reduce((m, v) => Math.max(m, capM3(v.container)), 0);
  const heaviest = vehicles.reduce((m, v) => Math.max(m, v.container.maxWeight ?? Infinity), 0);

  // Paires candidates : tiennent (en volume et en poids) dans le plus grand véhicule, sinon rien à gagner à deux.
  const pairs: [DayShipment, DayShipment, number][] = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const rows = [...validRows(usable[i]), ...validRows(usable[j])];
      const v = volM3(rows);
      if (v <= biggest * 0.95 && kg(rows) <= heaviest) pairs.push([usable[i], usable[j], v / biggest]);
    }
  }
  pairs.sort((a, b) => b[2] - a[2]); // remplissage combiné le plus élevé d'abord
  const tried = pairs.slice(0, maxPairs);
  const needed = new Set(tried.flatMap(([a, b]) => [a.code, b.code]));
  const total = needed.size + tried.length;
  let done = 0;

  const separate: Record<string, Evaluation> = {};
  for (const s of usable) {
    if (!needed.has(s.code)) continue;
    separate[s.code] = evaluate(validRows(s), vehicles).ev;
    onProgress?.(++done, total);
  }

  const found: Suggestion[] = [];
  for (const [a, b] of tried) {
    const sa = separate[a.code]; const sb = separate[b.code];
    const rows = mergeRows([a, b]);
    const { ev, plan } = evaluate(rows, vehicles);
    onProgress?.(++done, total);
    if (!sa.ok || !sb.ok || !ev.ok) continue;
    const sep = sa.cost + sb.cost;
    const saving = Math.round((sep - ev.cost) * 100) / 100;
    if (saving > 0.5) {
      found.push({ codes: [a.code, b.code], separate: sep, together: ev, saving, trucksBefore: sa.trucks.length + sb.trucks.length, rows, plan });
    }
  }
  // Propositions compatibles entre elles (un chargement dans une seule proposition), la plus grosse économie d'abord.
  found.sort((x, y) => y.saving - x.saving);
  const used = new Set<string>();
  const suggestions = found.filter((s) => {
    if (s.codes.some((c) => used.has(c))) return false;
    s.codes.forEach((c) => used.add(c));
    return true;
  });
  return { separate, suggestions, skipped };
}
