// API v1 : lecture et contrôle d'un chargement envoyé par un WMS / ERP (JSON).
// Le chargement est converti dans le format de l'outil (lignes en cm / kg, comme l'écran) : le planificateur
// l'ouvre dans son espace exactement comme s'il l'avait saisi.

import { CONTAINER_PRESETS } from '../../outils/optimiseur-chargement/constants/containers';
import { DEFAULT_FLEET } from '../../outils/optimiseur-chargement/constants/fleet';
import type { ContainerDefinition } from '../../outils/optimiseur-chargement/engine/types';

export type Issue = { path: string; message: string };

/** Véhicules connus par leur identifiant (dimensions intérieures en mm, charge utile en kg). */
export const VEHICLES: ContainerDefinition[] = [
  ...CONTAINER_PRESETS,
  ...DEFAULT_FLEET.map((v) => v.container).filter((c) => !CONTAINER_PRESETS.some((p) => p.id === c.id)),
];
const DEFAULT_COST: Record<string, number> = Object.fromEntries(DEFAULT_FLEET.map((v) => [v.container.id, v.cost]));

const ROTATION: Record<string, string> = { free: 'FULL', full: 'FULL', horizontal: 'HORIZONTAL', none: 'NONE', upright: 'HORIZONTAL' };
const STACKING: Record<string, { stackable: boolean; floorOnly: boolean }> = {
  free: { stackable: true, floorOnly: false },
  top_only: { stackable: false, floorOnly: false },
  floor: { stackable: true, floorOnly: true },
  floor_no_top: { stackable: false, floorOnly: true },
};
const TYPES = ['case', 'pallet', 'unit'] as const;

export interface ApiRow {
  id: string; reference: string; quantity: number; length: number; width: number; height: number; weight: number;
  rotationMode: string; stackable: boolean; floorOnly: boolean; stop: number; destination: string; type: string;
}
export interface ParsedShipment {
  reference: string;
  label: string | null;
  departureAt: string | null;
  mode: 'draft' | 'auto';
  validate: boolean;
  /** État de l'outil (même format que l'écran « chargement ») */
  input: {
    rows: ApiRow[]; vehicleMode: 'single' | 'fleet'; deliveryMode: 'STRICT' | 'SOFT'; excludedStops: number[];
    containerId: string; custom: { label: string; length: number | string; width: number | string; height: number | string; maxWeight: number | string };
    fleetVehicles?: { container: ContainerDefinition; cost: number; enabled: boolean }[];
  };
  units: number; // nombre total de colis / palettes
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = 120) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : NaN);

/** Contenant sur mesure (dimensions dans l'unité de la requête) → mm. */
function customVehicle(v: Record<string, unknown>, k: number, path: string, issues: Issue[]): ContainerDefinition | null {
  const [l, w, h] = ['length', 'width', 'height'].map((f) => num(v[f]));
  if (![l, w, h].every((x) => x > 0)) { issues.push({ path, message: 'Véhicule sur mesure : length, width et height (> 0) obligatoires.' }); return null; }
  const mw = v.max_weight == null ? null : num(v.max_weight);
  if (mw != null && !(mw > 0)) issues.push({ path: `${path}.max_weight`, message: 'Charge utile > 0 (kg).' });
  return { id: str(v.id, 40) || 'custom', label: str(v.label, 60) || 'Véhicule', length: Math.round(l * k), width: Math.round(w * k), height: Math.round(h * k), maxWeight: mw };
}

function vehicleOf(v: unknown, k: number, path: string, issues: Issue[]): ContainerDefinition | null {
  if (typeof v === 'string') {
    const found = VEHICLES.find((c) => c.id === v);
    if (!found) issues.push({ path, message: `Véhicule inconnu « ${v} ». Connus : ${VEHICLES.map((c) => c.id).join(', ')}, ou dimensions sur mesure.` });
    return found ?? null;
  }
  if (isObj(v)) return customVehicle(v, k, path, issues);
  issues.push({ path, message: 'Véhicule : identifiant (ex. "semi") ou objet { length, width, height, max_weight }.' });
  return null;
}

/** Contrôle et conversion. Renvoie les erreurs (toutes à la fois) ou le chargement prêt à enregistrer. */
export function parseShipment(body: unknown): { ok: true; value: ParsedShipment } | { ok: false; issues: Issue[] } {
  const issues: Issue[] = [];
  if (!isObj(body)) return { ok: false, issues: [{ path: '', message: 'Corps JSON attendu (objet).' }] };

  const reference = str(body.reference, 80);
  if (!reference) issues.push({ path: 'reference', message: 'Obligatoire : référence du chargement dans votre WMS / ERP (n° d’expédition).' });
  else if (/^PL-/i.test(reference)) issues.push({ path: 'reference', message: 'Ne peut pas commencer par « PL- » (réservé aux numéros Atelier Logistique).' });

  const units = body.units == null ? 'cm' : str(body.units, 4).toLowerCase();
  if (!['cm', 'mm', 'm'].includes(units)) issues.push({ path: 'units', message: 'Unité des dimensions : "cm" (défaut), "mm" ou "m".' });
  const toCm = units === 'mm' ? 0.1 : units === 'm' ? 100 : 1; // les lignes de l'outil sont en cm
  const toMm = toCm * 10;

  const mode = body.mode == null ? 'draft' : str(body.mode, 10);
  if (mode !== 'draft' && mode !== 'auto') issues.push({ path: 'mode', message: '"draft" (défaut : à vérifier dans l’espace) ou "auto" (plan calculé tout de suite).' });
  const delivery = body.delivery == null ? 'strict' : str(body.delivery, 10).toLowerCase();
  if (delivery !== 'strict' && delivery !== 'soft') issues.push({ path: 'delivery', message: '"strict" (défaut) ou "soft".' });

  let departureAt: string | null = null;
  if (body.departure_date != null && body.departure_date !== '') {
    const d = new Date(str(body.departure_date, 40));
    if (Number.isNaN(d.getTime())) issues.push({ path: 'departure_date', message: 'Date ISO attendue (ex. 2026-11-25).' });
    else departureAt = d.toISOString();
  }

  // Véhicule unique ou flotte.
  // Même forme que l'état de l'écran (sinon l'espace verrait une « modification » à l'ouverture).
  let input: ParsedShipment['input'] = { rows: [], vehicleMode: 'single', deliveryMode: delivery === 'soft' ? 'SOFT' : 'STRICT', excludedStops: [], containerId: 'semi', custom: { label: 'Mon contenant', length: 600, width: 240, height: 240, maxWeight: '' } };
  if (body.fleet != null) {
    if (!Array.isArray(body.fleet) || body.fleet.length === 0) issues.push({ path: 'fleet', message: 'Liste non vide de véhicules disponibles.' });
    else {
      const fleet = body.fleet.slice(0, 10).map((f, i) => {
        const v = vehicleOf(isObj(f) && 'vehicle' in f ? f.vehicle : f, toMm, `fleet[${i}]`, issues);
        const cost = isObj(f) && f.cost != null ? num(f.cost) : DEFAULT_COST[v?.id ?? ''] ?? 500;
        if (!(cost >= 0)) issues.push({ path: `fleet[${i}].cost`, message: 'Coût par voyage ≥ 0.' });
        return v ? { container: v, cost, enabled: true } : null;
      }).filter((x): x is NonNullable<typeof x> => !!x);
      input = { ...input, vehicleMode: 'fleet', fleetVehicles: fleet };
    }
  } else {
    const v = vehicleOf(body.vehicle ?? 'semi', toMm, 'vehicle', issues);
    if (v) {
      const preset = VEHICLES.find((c) => c.id === v.id && c.length === v.length);
      input = preset && CONTAINER_PRESETS.some((c) => c.id === v.id)
        ? { ...input, containerId: v.id }
        : { ...input, containerId: 'custom', custom: { label: v.label, length: v.length / 10, width: v.width / 10, height: v.height / 10, maxWeight: v.maxWeight ?? '' } };
    }
  }

  // Lignes.
  if (!Array.isArray(body.lines) || body.lines.length === 0) issues.push({ path: 'lines', message: 'Liste non vide de lignes (colis ou palettes).' });
  const lines = Array.isArray(body.lines) ? body.lines.slice(0, 2000) : [];
  if (Array.isArray(body.lines) && body.lines.length > 2000) issues.push({ path: 'lines', message: '2 000 lignes au maximum par chargement.' });
  const seen = new Set<string>();
  let total = 0;
  const rows: ApiRow[] = lines.map((l, i) => {
    const p = `lines[${i}]`;
    if (!isObj(l)) { issues.push({ path: p, message: 'Objet attendu.' }); return null; }
    const type = l.type == null ? 'case' : str(l.type, 10).toLowerCase();
    if (!(TYPES as readonly string[]).includes(type)) issues.push({ path: `${p}.type`, message: '"case" (colis, défaut), "pallet" ou "unit".' });
    const pallet = type === 'pallet' || type === 'unit';
    let id = str(l.id, 60) || `L${i + 1}`;
    if (seen.has(id)) { issues.push({ path: `${p}.id`, message: `Identifiant de ligne en double « ${id} ».` }); id = `${id}#${i}`; }
    seen.add(id);
    const reference = str(l.reference, 80);
    if (!reference) issues.push({ path: `${p}.reference`, message: 'Obligatoire (référence article, SSCC, n° de palette…).' });
    const quantity = l.quantity == null ? 1 : num(l.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) issues.push({ path: `${p}.quantity`, message: 'Entier entre 1 et 10 000.' });
    const dims = ['length', 'width', 'height'].map((f) => {
      const v = num(l[f]);
      if (!(v > 0)) issues.push({ path: `${p}.${f}`, message: `Obligatoire, > 0 (${units}).` });
      return Math.round(v * toCm * 10) / 10;
    });
    const weight = l.weight == null ? 0 : num(l.weight);
    if (!(weight >= 0)) issues.push({ path: `${p}.weight`, message: 'Poids unitaire ≥ 0 (kg).' });
    const rotation = l.rotation == null ? (pallet ? 'horizontal' : 'free') : str(l.rotation, 12).toLowerCase();
    if (!ROTATION[rotation]) issues.push({ path: `${p}.rotation`, message: '"free", "horizontal" ou "none".' });
    const stacking = l.stacking == null ? (pallet ? 'floor' : 'free') : str(l.stacking, 14).toLowerCase();
    if (!STACKING[stacking]) issues.push({ path: `${p}.stacking`, message: '"free", "top_only", "floor" ou "floor_no_top".' });
    const stop = l.stop == null ? 1 : num(l.stop);
    if (!Number.isInteger(stop) || stop < 1 || stop > 99) issues.push({ path: `${p}.stop`, message: 'Ordre de livraison : entier de 1 (livré en premier) à 99.' });
    if (Number.isInteger(quantity) && quantity > 0) total += quantity;
    return {
      id, reference, quantity, length: dims[0], width: dims[1], height: dims[2], weight,
      rotationMode: ROTATION[rotation] ?? 'FULL', ...(STACKING[stacking] ?? STACKING.free),
      stop, destination: str(l.destination, 80), type,
    };
  }).filter((r): r is ApiRow => !!r);
  if (total > 5000) issues.push({ path: 'lines', message: '5 000 colis / palettes au maximum par chargement.' });

  if (issues.length) return { ok: false, issues };
  return {
    ok: true,
    value: {
      reference, label: str(body.label, 120) || null, departureAt, mode: mode as 'draft' | 'auto',
      validate: body.validate === true, input: { ...input, rows }, units: total,
    },
  };
}
