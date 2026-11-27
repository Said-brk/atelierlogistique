// Schéma « Colis » de l'optimiseur de chargement = format standard Atelier Logistique v1.
// C'est le contrat d'échange avec un ERP / WMS (niveau 1 : fichier ; niveaux 2-3 : API, EDI).
// Valeurs canoniques : dimensions en mm, poids en kg.

import type { CanonicalRecord, DatasetSchema } from '../../../shared/import';
import { N_ } from '../../../shared/i18n/core';
import { imperial } from '../../../shared/units/units';

export const COLIS_SCHEMA: DatasetSchema = {
  id: 'atelier-logistique/colis',
  version: 1,
  label: N_('Colis à charger'),
  groupKey: ['reference', 'length', 'width', 'height', 'weight', 'rotation', 'stacking', 'stop', 'destination', 'support'],
  quantityField: 'quantity',
  unitField: 'unitId',
  fields: [
    { id: 'reference', label: N_('Référence'), type: 'text', required: true,
      aliases: ['reference', 'ref', 'sku', 'code article', 'article', 'code', 'item', 'item number', 'produit', 'designation', 'libelle', 'nom', 'description', 'product'],
      help: N_('Code article, SSCC ou libellé du support.') },
    { id: 'quantity', label: N_('Quantité'), type: 'integer', defaultValue: 1,
      aliases: ['quantite', 'qte', 'qty', 'quantity', 'nb', 'nombre', 'nb colis', 'nb supports', 'nb um', 'qte', 'pieces', 'count'] },
    { id: 'length', label: N_('Longueur'), type: 'number', required: true, unitKind: 'length', get defaultUnit() { return imperial() ? 'in' : 'cm'; },
      aliases: ['longueur', 'long', 'length', 'lg', 'l'] },
    { id: 'width', label: N_('Largeur'), type: 'number', required: true, unitKind: 'length', get defaultUnit() { return imperial() ? 'in' : 'cm'; },
      aliases: ['largeur', 'larg', 'width', 'lar', 'w'] },
    { id: 'height', label: N_('Hauteur'), type: 'number', required: true, unitKind: 'length', get defaultUnit() { return imperial() ? 'in' : 'cm'; },
      aliases: ['hauteur', 'haut', 'height', 'ht', 'h'] },
    { id: 'weight', label: N_('Poids'), type: 'number', unitKind: 'mass', get defaultUnit() { return imperial() ? 'lb' : 'kg'; }, defaultValue: 0,
      aliases: ['poids', 'poids brut', 'masse', 'weight', 'gross weight', 'pds', 'kg'] },
    // Sans colonne Rotation, un fichier importé garde les colis debout (« Horizontale ») :
    // une palette couchée sur le plan est inexploitable au quai.
    { id: 'rotation', label: N_('Rotation'), type: 'enum', defaultValue: 'Horizontale',
      aliases: ['rotation', 'rot', 'orientation', 'sens'],
      help: N_('Libre, Horizontale (reste debout, pivote au sol) ou Interdite.') },
    { id: 'stacking', label: N_('Empilage'), type: 'enum',
      aliases: ['empilage', 'gerbage', 'superposition', 'empilable', 'gerbable', 'stackable', 'stacking rule'] },
    { id: 'stop', label: N_('Arrêt'), type: 'text',
      aliases: ['arret', 'ordre de livraison', 'stop', 'sequence', 'ordre', 'tournee', 'rang', 'drop'] },
    { id: 'destination', label: N_('Destination'), type: 'text',
      aliases: ['destination', 'client', 'destinataire', 'livre a', 'ship to', 'ville', 'adresse', 'customer', 'consignee', 'city', 'address'] },
    { id: 'unitId', label: N_('N° support (SSCC)'), type: 'text',
      aliases: ['sscc', 'n support', 'no support', 'numero support', 'id colis', 'numero colis', 'n colis', 'lpn', 'license plate', 'hu', 'n um', 'etiquette', 'unit id', 'pallet id', 'pallet no', 'handling unit'],
      help: N_('Identifiant de chaque palette / colis : repris dans l’export de séquence pour votre WMS.') },
    { id: 'support', label: N_('Support imposé'), type: 'text',
      aliases: ['support', 'type de support', 'type palette', 'type de palette', 'format palette', 'pallet type', 'forced pallet'],
      help: N_('Palettisation : palette exigée pour cette ligne (EUR, EUR3, 120x100…). Vide = choix automatique.') },
  ],
};

/** En-têtes du fichier standard (ordre et libellés à reprendre tels quels dans l'ERP/WMS). */
export const STANDARD_HEADERS = [
  N_('Référence'), N_('Quantité'), N_('Longueur (cm)'), N_('Largeur (cm)'), N_('Hauteur (cm)'), N_('Poids (kg)'),
  N_('Rotation'), N_('Empilage'), N_('Arrêt'), N_('Destination'),
];

export const STANDARD_SAMPLE: (string | number)[][] = [
  ['CARTON-A', 40, 60, 40, 40, 12, N_('Libre'), N_('Libre'), 1, N_('Client A')],
  ['PALETTE-EURO', 4, 120, 80, 140, 450, N_('Horizontale'), N_('Au sol, rien dessus'), 2, N_('Client B')],
];

export type RotationMode = 'FULL' | 'HORIZONTAL' | 'NONE';
export type StackingValue = 'FREE' | 'TOP_ONLY' | 'FLOOR' | 'FLOOR_NO_TOP';

const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function parseRotationValue(v: unknown): RotationMode {
  const s = norm(v);
  if (['none', 'interdite', 'interdit', 'non', 'no', '0', 'false', 'aucune', 'fixe', 'forbidden', 'fixed', 'not allowed'].includes(s)) return 'NONE';
  if (['horizontal', 'horizontale', 'h', 'z', 'a plat', 'upright', 'this way up', 'flat'].includes(s) || s.includes('horiz') || s.includes('upright')) return 'HORIZONTAL';
  return 'FULL';
}

/** Lit l'empilage : 4 libellés, ou ancienne colonne oui/non (« Empilable »). */
export function parseStackingValue(v: unknown): StackingValue {
  const k = norm(v);
  if (!k) return 'FREE';
  // Libellés français et anglais (fichiers exportés depuis l'interface anglaise).
  const floor = k.includes('sol') || k.includes('floor');
  if (floor && (k.includes('rien') || k.includes('non') || k.includes('nothing') || k.includes('no top'))) return 'FLOOR_NO_TOP';
  if (floor) return 'FLOOR';
  if (k.includes('dessus') || k.includes('fragile') || k.includes('top only') || k.includes('nothing on top') || k.includes('non stackable') || k.includes('not stackable')) return 'TOP_ONLY';
  if (['non', 'no', 'n', '0', 'false', 'faux'].includes(k)) return 'TOP_ONLY';
  return 'FREE';
}

const STACKING_FIELDS: Record<StackingValue, { stackable: boolean; floorOnly: boolean }> = {
  FREE: { stackable: true, floorOnly: false },
  TOP_ONLY: { stackable: false, floorOnly: false },
  FLOOR: { stackable: true, floorOnly: true },
  FLOOR_NO_TOP: { stackable: false, floorOnly: true },
};

export interface ColisRow {
  reference: string;
  quantity: number;
  length: number;   // cm (unité de l'interface)
  width: number;
  height: number;
  weight: number;   // kg
  rotationMode: RotationMode;
  stackable: boolean;
  floorOnly: boolean;
  stop: number;
  destination: string;
  /** Identifiants d'unités (SSCC…) dans l'ordre du fichier, repris à l'export. */
  unitIds?: string[];
  /** Support de palettisation imposé (texte libre : EUR, EUR3, 120x100…). */
  support?: string;
}

/**
 * Enregistrements canoniques (mm, kg) → lignes de l'interface (cm, kg).
 * Un arrêt saisi en texte (nom de client) est numéroté dans l'ordre d'apparition.
 */
export function recordsToColisRows(
  records: CanonicalRecord[],
  opts: { stopsFromDestination?: boolean } = {},
): ColisRow[] {
  const textStops = new Map<string, number>();
  return records.map((r) => {
    let rawStop = String(r.stop ?? '').trim();
    // Pas de colonne Arrêt : une destination = un arrêt, dans l'ordre du fichier.
    if (!rawStop && opts.stopsFromDestination) rawStop = String(r.destination ?? '').trim();
    let stop = 1;
    let dest = '';
    if (/^\d+([.,]0+)?$/.test(rawStop) && parseInt(rawStop, 10) >= 1) stop = parseInt(rawStop, 10);
    else if (rawStop) {
      if (!textStops.has(rawStop)) textStops.set(rawStop, textStops.size + 1);
      stop = textStops.get(rawStop)!;
      dest = rawStop;
    }
    const cm = (v: unknown) => Math.round((Number(v) || 0) / 10 * 10) / 10;
    return {
      reference: String(r.reference ?? '').trim(),
      quantity: Math.max(0, Math.round(Number(r.quantity ?? 1) || 0)),
      length: cm(r.length),
      width: cm(r.width),
      height: cm(r.height),
      weight: Number(r.weight) || 0,
      rotationMode: parseRotationValue(r.rotation),
      ...STACKING_FIELDS[parseStackingValue(r.stacking)],
      stop,
      destination: String(r.destination ?? '').trim() || dest,
      ...(() => {
        const ids = Array.isArray(r.__units) ? (r.__units as string[]) : r.unitId ? [String(r.unitId)] : [];
        return ids.length ? { unitIds: ids } : {};
      })(),
      ...(r.support ? { support: String(r.support).trim() } : {}),
    };
  });
}
