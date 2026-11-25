// API v1 : un chargement tel que l'API le renvoie (statut, résumé, liens, plan détaillé par véhicule).
// Positions en mm : x = depuis la cabine (fond du véhicule) vers les portes,
// z = depuis le plancher ; dimensions après rotation. « sequence » = ordre de chargement.
// (y = depuis la paroi de droite, vue depuis les portes face à la cabine.)

import { applyManualPlan } from '../../outils/optimiseur-chargement/manual/editPlan';
import { decodePlan } from '../../outils/optimiseur-chargement/guide/planLink';
import type { OptimizationResult, PlacedItem } from '../../outils/optimiseur-chargement/engine/types';
import { containerOf } from './compute';

export interface ShipmentRow {
  id: string; code: string; external_id: string | null; label: string | null; status: string; version: number; source: string;
  departure_at: string | null; created_at: string; updated_at: string; validated_at?: string | null; loaded_at?: string | null; share_token: string;
  input: Record<string, unknown> | null; result: { summary?: Record<string, unknown>; plan?: Record<string, any> } | null;
  /** Regroupé dans ce chargement (annulé). */
  merged_into?: string | null;
  tour?: string | null;
  carrier?: string | null;
  carrier_cost?: number | string | null;
}

const pct = (v: unknown) => (typeof v === 'number' ? Math.round(v * 1000) / 10 : null);

export function summaryOf(s: ShipmentRow) {
  const m = s.result?.summary as Record<string, any> | undefined;
  if (!m) return null;
  return { vehicles: m.fleet ?? 1, vehicle: m.vehicle ?? null, units_loaded: m.packed ?? 0, units_not_loaded: m.unpacked ?? 0, fill_rate_pct: pct(m.fill), weight_kg: Math.round(m.weight ?? 0), edited_by_hand: !!m.edited };
}

export function listItemOf(s: ShipmentRow, site: string) {
  return {
    code: s.code, reference: s.external_id, label: s.label, status: s.status, ...(s.merged_into ? { merged_into: s.merged_into } : {}), version: s.version, source: s.source,
    departure_date: s.departure_at, tour: s.tour ?? null, carrier: s.carrier ?? null, carrier_cost: s.carrier_cost == null ? null : Number(s.carrier_cost), created_at: s.created_at, updated_at: s.updated_at,
    summary: summaryOf(s), links: { app: `${site}/app/chargements/${s.code}` },
  };
}

const itemOf = (p: PlacedItem, lineIds: Set<string>) => ({
  sequence: p.sequence, line_id: lineIds.has(p.definitionId) ? p.definitionId : null, reference: p.reference,
  stop: p.stop, destination: p.destination || null, x: p.x, y: p.y, z: p.z, length: p.length, width: p.width, height: p.height,
  rotated: p.length !== p.originalLength || p.width !== p.originalWidth || p.height !== p.originalHeight, weight_kg: p.weight,
});

/** Plan détaillé : un véhicule (calcul + retouches) ou une flotte (guide de chaque véhicule). */
async function planOf(s: ShipmentRow, dockUrl: string | null) {
  const plan = s.result?.plan;
  if (!plan) return null;
  const rows = (s.input?.rows as { id: string }[] | undefined) ?? [];
  const lineIds = new Set(rows.map((r) => r.id));

  if (plan.base) {
    const base = plan.base as OptimizationResult;
    const m = plan.manual as { placed: PlacedItem[]; staged: PlacedItem[]; touched: string[] } | null;
    const r = m ? applyManualPlan(base, m.placed, m.staged, new Set(m.touched)) : base;
    const c = containerOf(s.input as any);
    const unplaced = new Map<string, { line_id: string | null; reference: string; quantity: number }>();
    for (const u of r.unpackedItems) {
      const e = unplaced.get(u.definitionId) ?? { line_id: lineIds.has(u.definitionId) ? u.definitionId : null, reference: u.reference, quantity: 0 };
      e.quantity++; unplaced.set(u.definitionId, e);
    }
    return {
      vehicles: [{
        index: 1, vehicle: { id: c.id, label: c.label, length: c.length, width: c.width, height: c.height, max_weight_kg: c.maxWeight ?? null },
        fill_rate_pct: pct(r.volumeUtilization), weight_kg: Math.round(r.usedWeight), dock_url: dockUrl,
        items: [...r.placedItems].sort((a, b) => a.sequence - b.sequence).map((p) => itemOf(p, lineIds)),
      }],
      not_loaded: [...unplaced.values()],
    };
  }

  if (plan.fleet) {
    const fleet = plan.fleet as { trucks: any[]; unplaced: { definitionId: string; reference: string; quantity: number; reason: string }[] };
    const guides = (plan.guides as { index: number; guide: string }[] | null) ?? [];
    const vehicles = [];
    for (const t of fleet.trucks) {
      const g = guides.find((x) => x.index === t.index);
      const decoded = g ? await decodePlan(g.guide).catch(() => null) : null;
      vehicles.push({
        index: t.index, vehicle: { id: t.container.id, label: t.container.label, length: t.container.length, width: t.container.width, height: t.container.height, max_weight_kg: t.container.maxWeight ?? null },
        cost: t.cost, stops: t.stops, fill_rate_pct: pct(t.volumeUtilization), weight_kg: t.weight, units: t.units,
        dock_url: dockUrl ? `${dockUrl}?camion=${t.index}` : null,
        // Flotte : positions issues du guide cariste (arrondies au cm), par ordre de chargement.
        items: decoded ? decoded.items.map((it, i) => ({ sequence: i + 1, line_id: null, reference: it.ref, stop: it.stop, destination: it.destination || null, x: it.x, y: it.y, z: it.z, length: it.l, width: it.w, height: it.h, rotated: null, weight_kg: null })) : [],
      });
    }
    return {
      vehicles, total_cost: fleet.trucks.reduce((s2, t) => s2 + (t.cost ?? 0), 0),
      not_loaded: fleet.unplaced.map((u) => ({ line_id: lineIds.has(u.definitionId) ? u.definitionId : null, reference: u.reference, quantity: u.quantity, reason: u.reason })),
    };
  }
  return null;
}

export async function shipmentOf(s: ShipmentRow, site: string) {
  const plan = s.result?.plan;
  const hasGuide = !!(plan?.guide || plan?.guides?.length);
  const dock = hasGuide && s.status !== 'cancelled' ? `${site}/q/${s.share_token}` : null;
  const detailed = await planOf(s, dock);
  return { ...listItemOf(s, site), validated_at: s.validated_at ?? null, loaded_at: s.loaded_at ?? null, links: { app: `${site}/app/chargements/${s.code}`, dock }, plan: detailed };
}
