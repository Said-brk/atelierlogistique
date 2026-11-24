// API v1 : calcul du plan côté serveur (mode "auto"), avec le même moteur et le même format de résultat
// que l'écran — un chargement calculé par l'API se rouvre tel quel dans l'espace (plan, flotte, QR quai).

import { optimizeWithInsights } from '../../outils/optimiseur-chargement/engine/optimizer';
import { planFleet } from '../../outils/optimiseur-chargement/engine/fleet';
import { encodePlan } from '../../outils/optimiseur-chargement/guide/planLink';
import { rowsToDefinitions } from '../../outils/optimiseur-chargement/uiHelpers';
import { CONTAINER_PRESETS } from '../../outils/optimiseur-chargement/constants/containers';
import type { ContainerDefinition } from '../../outils/optimiseur-chargement/engine/types';
import type { ParsedShipment } from './schema';

const LOADING = { mode: 'WALLS' as const };
const labelOf = (c: ContainerDefinition) => c.label;

export function containerOf(input: ParsedShipment['input']): ContainerDefinition {
  if (input.vehicle && input.vehicle.id === input.containerId) return input.vehicle;
  const preset = CONTAINER_PRESETS.find((c) => c.id === input.containerId);
  if (input.containerId !== 'custom' && preset) return preset;
  const c = input.custom;
  return {
    id: 'custom', label: c.label || 'Véhicule', length: Math.round(Number(c.length) * 10), width: Math.round(Number(c.width) * 10),
    height: Math.round(Number(c.height) * 10), maxWeight: c.maxWeight === '' ? null : Number(c.maxWeight),
  };
}

/** Résultat au format de l'espace : { summary, plan } (plan = { base, manual, guide } ou { fleet, guides }). */
export async function computePlan(input: ParsedShipment['input']) {
  const defs = rowsToDefinitions(input.rows);
  const opts = { deliveryMode: input.deliveryMode, loading: LOADING };

  if (input.vehicleMode === 'fleet') {
    const vehicles = (input.fleetVehicles ?? []).filter((v) => v.enabled).map((v) => ({ container: v.container, cost: v.cost }));
    const fleet = planFleet(defs, vehicles, opts);
    const guides = [];
    for (const t of fleet.trucks) {
      const r = optimizeWithInsights(t.container, t.definitions, opts);
      const label = `${t.index}. ${labelOf(t.container)}`;
      guides.push({ index: t.index, label, units: r.placedItems.length, guide: await encodePlan({ ...t.container, label }, r.placedItems) });
    }
    const n = fleet.trucks.length;
    const byVehicle = Object.entries(fleet.trucks.reduce<Record<string, number>>((m, t) => { m[t.container.label] = (m[t.container.label] ?? 0) + 1; return m; }, {}));
    const summary = n ? {
      vehicle: byVehicle.map(([l, k]) => `${k} × ${l}`).join(' + '), fleet: n,
      packed: fleet.trucks.reduce((s, t) => s + t.units, 0), unpacked: fleet.unplaced.reduce((s, u) => s + u.quantity, 0),
      fill: fleet.trucks.reduce((s, t) => s + t.volumeUtilization, 0) / n, weight: fleet.trucks.reduce((s, t) => s + t.weight, 0), edited: false,
    } : { vehicle: '—', fleet: 0, packed: 0, unpacked: fleet.unplaced.reduce((s, u) => s + u.quantity, 0), fill: 0, weight: 0, edited: false };
    return { summary, plan: { fleet, guides } };
  }

  const container = containerOf(input);
  const base = optimizeWithInsights(container, defs, opts);
  const guide = await encodePlan(container, base.placedItems);
  return {
    summary: { vehicle: container.label, packed: base.packedItems, unpacked: base.unpackedCount, fill: base.volumeUtilization, weight: base.usedWeight, edited: false },
    plan: { base, manual: null, guide },
  };
}
