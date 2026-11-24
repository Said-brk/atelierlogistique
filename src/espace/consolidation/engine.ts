// Regroupement de chargements : pour les chargements d'un même jour, l'outil calcule la meilleure flotte de
// chaque chargement SÉPARÉMENT, puis de deux chargements ENSEMBLE (même moteur 3D, mêmes véhicules et coûts
// de l'entreprise). Une proposition n'apparaît que si le calcul « ensemble » coûte moins cher : l'écart compare
// deux calculs réels de l'outil, jamais une situation supposée.
//
// Ensemble = une tournée : arrêts dans l'ordre des agences de la tournée (tables de référence) quand toutes les
// destinations sont des agences connues ; sinon ceux du premier chargement puis du second. Même agence = même arrêt.
// Mode « par tournée » (Paramètres) : seuls des chargements dont toutes les destinations sont dans la même
// tournée sont comparés.

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
export interface Analysis {
  separate: Record<string, Evaluation>; suggestions: Suggestion[]; skipped: string[];
  /** Tournée de chaque chargement : code, null (destination hors tournée) ou '*' (plusieurs tournées). */
  tours: Record<string, string | null>;
}
export interface Agency { code: string; tour: string | null; order: number }
export interface AnalyzeOptions {
  maxPairs?: number;
  mode?: 'free' | 'tour';
  agencies?: Agency[];
  onProgress?: (done: number, total: number) => void;
}

const destOf = (r: Row) => String(r.destination ?? '').trim();

/** Tournée d'un chargement : toutes ses destinations dans la même tournée, sinon null / '*'. */
export function tourOf(s: DayShipment, agencies: Map<string, Agency>): string | null {
  const tours = new Set(validRows(s).map((r) => agencies.get(destOf(r))?.tour ?? null));
  if (tours.has(null) || tours.size === 0) return null;
  return tours.size === 1 ? [...tours][0] : '*';
}

const OPTS = { deliveryMode: 'STRICT' as const, loading: { mode: 'WALLS' as const } };
const validRows = (s: DayShipment) => (s.input?.rows ?? []).filter((r) => r.reference?.trim() && r.quantity > 0 && r.length > 0 && r.width > 0 && r.height > 0);
const volM3 = (rows: Row[]) => rows.reduce((t, r) => t + (r.length * r.width * r.height * r.quantity) / 1e6, 0);
const kg = (rows: Row[]) => rows.reduce((t, r) => t + (Number(r.weight) || 0) * r.quantity, 0);
const capM3 = (c: ContainerDefinition) => (c.length * c.width * c.height) / 1e9;

/** Lignes de plusieurs chargements en une tournée : ids préfixés, arrêts renumérotés à la suite. */
export function mergeRows(list: DayShipment[], agencies: Map<string, Agency> = new Map()): Row[] {
  // Clé d'arrêt : l'agence si elle est connue (même agence = même arrêt), sinon l'arrêt du chargement.
  const keyOf = (s: DayShipment, r: Row) => (agencies.has(destOf(r)) ? `A:${destOf(r)}` : `S:${s.code}:${r.stop ?? 1}`);
  const groups = new Map<string, { rank: number; ship: number; stop: number }>();
  list.forEach((s, si) => validRows(s).forEach((r) => {
    const k = keyOf(s, r);
    if (groups.has(k)) return;
    const a = agencies.get(destOf(r));
    groups.set(k, { rank: a?.tour ? a.order : Number.MAX_SAFE_INTEGER, ship: si, stop: r.stop ?? 1 });
  }));
  // Ordre de la tournée si toutes les destinations y sont, sinon chargement par chargement.
  const allRanked = [...groups.values()].every((g) => g.rank !== Number.MAX_SAFE_INTEGER);
  const order = [...groups.entries()].sort(([, x], [, y]) => (allRanked ? x.rank - y.rank || x.ship - y.ship : x.ship - y.ship || x.stop - y.stop));
  const stopOf = new Map(order.map(([k], i) => [k, i + 1]));
  return list.flatMap((s) => validRows(s).map((r) => ({
    ...r, id: `${s.code}:${r.id}`, stop: stopOf.get(keyOf(s, r))!, destination: r.destination || s.label || s.code, fromShipment: s.code,
  })));
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
  { maxPairs = 24, mode = 'free', agencies = [], onProgress }: AnalyzeOptions = {},
): Analysis {
  const agencyMap = new Map(agencies.map((a) => [a.code, a]));
  const tours = Object.fromEntries(shipments.map((s) => [s.code, tourOf(s, agencyMap)]));
  const usable = shipments.filter((s) => validRows(s).length > 0);
  const skipped = shipments.filter((s) => !usable.includes(s)).map((s) => s.code);
  const biggest = vehicles.reduce((m, v) => Math.max(m, capM3(v.container)), 0);
  const heaviest = vehicles.reduce((m, v) => Math.max(m, v.container.maxWeight ?? Infinity), 0);

  // Paires candidates : tiennent (en volume et en poids) dans le plus grand véhicule, sinon rien à gagner à deux.
  const pairs: [DayShipment, DayShipment, number][] = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      if (mode === 'tour') {
        const t = tours[usable[i].code];
        if (!t || t === '*' || t !== tours[usable[j].code]) continue;
      }
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
    const rows = mergeRows([a, b], agencyMap);
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
  return { separate, suggestions, skipped, tours };
}
