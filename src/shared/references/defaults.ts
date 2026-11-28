// Tables de référence d'une entreprise (espace connecté) : véhicules / contenants, supports de palettisation,
// agences (destinations) et tournées, réglages (arrimage, regroupement). Valeurs par défaut = celles des outils publics ; elles sont copiées dans chaque
// nouvelle entreprise (script SQL 20261124000008, vérifié par le test du schéma) puis modifiables.
// Unités stockées : mm, kg, €.

import type { CarrierData } from '../carriers/pricing';
import { CONTAINER_PRESETS } from '../../outils/optimiseur-chargement/constants/containers';
import { DEFAULT_FLEET } from '../../outils/optimiseur-chargement/constants/fleet';
import { defaultAxleProfile, DEFAULT_LASHING } from '../../outils/optimiseur-chargement/engine/balance';
import type { AxleProfile, LashingParams } from '../../outils/optimiseur-chargement/engine/balance';
import type { ContainerDefinition } from '../../outils/optimiseur-chargement/engine/types';
import { PALLET_PRESETS } from '../../outils/palettisation/engine/presets';
import type { PalletSpec } from '../../outils/palettisation/engine/types';

export type RefKind = 'vehicle' | 'pallet' | 'agency' | 'tour' | 'carrier' | 'setting';

export interface RefItem {
  id?: string;
  kind: RefKind;
  code: string;
  label: string;
  data: Record<string, unknown>;
  /** Véhicule : proposé dans la liste « Un véhicule » et la flotte. Support : coché par défaut. */
  active: boolean;
  sort: number;
}

export interface VehicleData {
  length: number; width: number; height: number; maxWeight: number | null;
  cost: number;
  /** Coché par défaut en « Flotte automatique ». */
  inFleet: boolean;
  /** Essieux / appuis (répartition des charges) ; null = conteneur (contrôle du centre de gravité). */
  axle: Omit<AxleProfile, 'kind'> & { kind: 'TWO_SUPPORTS' } | null;
}

const VEHICLE_ORDER = ['semi', 'porteur19', 'porteur12', 'fourgon20', '20ft', '40ft', '40hc'];
const PALLET_AVAILABLE = new Set(['eur', 'eur3']);

export function defaultReferences(): RefItem[] {
  const vehicles = new Map<string, { c: ContainerDefinition; cost: number; inFleet: boolean }>();
  for (const v of DEFAULT_FLEET) vehicles.set(v.container.id, { c: v.container, cost: v.cost, inFleet: v.enabled });
  for (const c of CONTAINER_PRESETS) if (!vehicles.has(c.id)) vehicles.set(c.id, { c, cost: 0, inFleet: false });
  const out: RefItem[] = VEHICLE_ORDER.map((id, i) => {
    const { c, cost, inFleet } = vehicles.get(id)!;
    const axle = defaultAxleProfile(c);
    const data: VehicleData = {
      length: c.length, width: c.width, height: c.height, maxWeight: c.maxWeight, cost, inFleet,
      axle: axle.kind === 'TWO_SUPPORTS' ? { ...axle, kind: 'TWO_SUPPORTS' } : null,
    };
    return { kind: 'vehicle', code: id, label: c.label, data: { ...data }, active: true, sort: (i + 1) * 10 };
  });
  PALLET_PRESETS.forEach((p, i) => {
    const { id, label, ...data } = p;
    out.push({ kind: 'pallet', code: id, label, data: { ...data }, active: PALLET_AVAILABLE.has(id), sort: (i + 1) * 10 });
  });
  out.push({ kind: 'setting', code: 'lashing', label: 'Arrimage', data: { ...DEFAULT_LASHING }, active: true, sort: 10 });
  out.push({ kind: 'setting', code: 'consolidation', label: 'Regroupement', data: { mode: 'free' }, active: true, sort: 20 });
  // Agences et tournées : propres à chaque entreprise, aucune valeur par défaut.
  return out;
}

/** Ce que les outils intégrés reçoivent (workspace.references). */
export interface ToolReferences {
  vehicles: { container: ContainerDefinition; cost: number; inFleet: boolean; active: boolean; axle: AxleProfile | null }[];
  pallets: (PalletSpec & { available: boolean })[];
  lashing: LashingParams;
  /** Destinations connues (code = valeur saisie dans les lignes), avec leur tournée et leur rang dans la tournée. */
  agencies: { code: string; label: string; city: string; tour: string | null; order: number; zone: string | null; postalCode: string | null }[];
  /** days : jours de préparation / expédition (1 = lundi … 7 = dimanche). */
  tours: { code: string; label: string; days: number[]; carrier: string | null }[];
  /** Transporteurs actifs et leur grille (src/shared/carriers/pricing.ts). */
  carriers: { code: string; label: string; data: CarrierData }[];
  /** free : regroupement libre ; tour : seulement des chargements d'une même tournée. */
  consolidation: { mode: 'free' | 'tour' };
}

const n = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export function toToolReferences(items: RefItem[]): ToolReferences {
  const by = (k: RefKind) => items.filter((i) => i.kind === k).sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
  const vehicles = by('vehicle').map((i) => {
    const d = i.data as Partial<VehicleData>;
    const container: ContainerDefinition = {
      id: i.code, label: i.label, length: n(d.length), width: n(d.width), height: n(d.height),
      maxWeight: d.maxWeight == null || (d.maxWeight as unknown) === '' ? null : n(d.maxWeight),
    };
    return {
      container, cost: n(d.cost), inFleet: !!d.inFleet, active: i.active,
      axle: d.axle ? { ...d.axle, kind: 'TWO_SUPPORTS' as const } : null,
    };
  });
  const pallets = by('pallet').map((i) => {
    const d = i.data as Partial<PalletSpec>;
    return {
      id: i.code, label: i.label, length: n(d.length), width: n(d.width), deckHeight: n(d.deckHeight), tare: n(d.tare),
      maxTotalHeight: n(d.maxTotalHeight), maxLoad: n(d.maxLoad), ...(d.cost != null && (d.cost as unknown) !== '' ? { cost: n(d.cost) } : {}),
      available: i.active,
    };
  });
  const lashingItem = items.find((i) => i.kind === 'setting' && i.code === 'lashing');
  const lashing = { ...DEFAULT_LASHING, ...((lashingItem?.data ?? {}) as Partial<LashingParams>) };
  const tours = by('tour').filter((i) => i.active).map((i) => ({
    code: i.code, label: i.label,
    days: (Array.isArray(i.data.days) ? (i.data.days as unknown[]) : []).map(Number).filter((d) => d >= 1 && d <= 7).sort(),
    carrier: typeof i.data.carrier === 'string' && i.data.carrier ? i.data.carrier : null,
  }));
  const carriers = by('carrier').filter((i) => i.active).map((i) => ({ code: i.code, label: i.label, data: i.data as unknown as CarrierData }));
  const tourCodes = new Set(tours.map((t) => t.code));
  const agencies = by('agency').filter((i) => i.active).map((i) => {
    const d = i.data as { city?: string; tour?: string | null; order?: number; zone?: string | null; postalCode?: string | null };
    return { code: i.code, label: i.label, city: d.city ?? '', tour: d.tour && tourCodes.has(d.tour) ? d.tour : null, order: n(d.order), zone: d.zone ? String(d.zone).trim() : null,
      postalCode: d.postalCode ? String(d.postalCode).trim() : null };
  });
  const cons = items.find((i) => i.kind === 'setting' && i.code === 'consolidation')?.data as { mode?: string } | undefined;
  return { vehicles, pallets, lashing, agencies, tours, carriers, consolidation: { mode: cons?.mode === 'tour' ? 'tour' : 'free' } };
}
