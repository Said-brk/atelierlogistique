// Schéma « Colis » de l'optimiseur de chargement = format standard Atelier Logistique v1.
// C'est le contrat d'échange avec un ERP / WMS (niveau 1 : fichier ; niveaux 2-3 : API, EDI).
// Valeurs canoniques : dimensions en mm, poids en kg.

import type { CanonicalRecord, DatasetSchema } from '../../../shared/import';

export const COLIS_SCHEMA: DatasetSchema = {
  id: 'atelier-logistique/colis',
  version: 1,
  label: 'Colis à charger',
  groupKey: ['reference', 'length', 'width', 'height', 'weight', 'rotation', 'stacking', 'stop', 'destination', 'support'],
  quantityField: 'quantity',
  unitField: 'unitId',
  fields: [
    { id: 'reference', label: 'Référence', type: 'text', required: true,
      aliases: ['reference', 'ref', 'sku', 'code article', 'article', 'code', 'item', 'item number', 'produit', 'designation', 'libelle', 'nom'],
      help: 'Code article, SSCC ou libellé du support.' },
    { id: 'quantity', label: 'Quantité', type: 'integer', defaultValue: 1,
      aliases: ['quantite', 'qte', 'qty', 'quantity', 'nb', 'nombre', 'nb colis', 'nb supports', 'nb um'] },
    { id: 'length', label: 'Longueur', type: 'number', required: true, unitKind: 'length', defaultUnit: 'cm',
      aliases: ['longueur', 'long', 'length', 'lg', 'l'] },
    { id: 'width', label: 'Largeur', type: 'number', required: true, unitKind: 'length', defaultUnit: 'cm',
      aliases: ['largeur', 'larg', 'width', 'lar', 'w'] },
    { id: 'height', label: 'Hauteur', type: 'number', required: true, unitKind: 'length', defaultUnit: 'cm',
      aliases: ['hauteur', 'haut', 'height', 'ht', 'h'] },
    { id: 'weight', label: 'Poids', type: 'number', unitKind: 'mass', defaultUnit: 'kg', defaultValue: 0,
      aliases: ['poids', 'poids brut', 'masse', 'weight', 'gross weight', 'pds', 'kg'] },
    // Sans colonne Rotation, un fichier importé garde les colis debout (« Horizontale ») :
    // une palette couchée sur le plan est inexploitable au quai.
    { id: 'rotation', label: 'Rotation', type: 'enum', defaultValue: 'Horizontale',
      aliases: ['rotation', 'rot', 'orientation', 'sens'],
      help: 'Libre, Horizontale (reste debout, pivote au sol) ou Interdite.' },
    { id: 'stacking', label: 'Empilage', type: 'enum',
      aliases: ['empilage', 'gerbage', 'superposition', 'empilable', 'gerbable', 'stackable'] },
    { id: 'stop', label: 'Arrêt', type: 'text',
      aliases: ['arret', 'ordre de livraison', 'stop', 'sequence', 'ordre', 'tournee', 'rang', 'drop'] },
    { id: 'destination', label: 'Destination', type: 'text',
      aliases: ['destination', 'client', 'destinataire', 'livre a', 'ship to', 'ville', 'adresse'] },
    { id: 'unitId', label: 'N° support (SSCC)', type: 'text',
      aliases: ['sscc', 'n support', 'no support', 'numero support', 'id colis', 'numero colis', 'n colis', 'lpn', 'license plate', 'hu', 'n um', 'etiquette'],
      help: 'Identifiant de chaque palette / colis : repris dans l’export de séquence pour votre WMS.' },
    { id: 'support', label: 'Support imposé', type: 'text',
      aliases: ['support', 'type de support', 'type palette', 'type de palette', 'format palette'],
      help: 'Palettisation : palette exigée pour cette ligne (EUR, EUR3, 120x100…). Vide = choix automatique.' },
  ],
};

/** En-têtes du fichier standard (ordre et libellés à reprendre tels quels dans l'ERP/WMS). */
export const STANDARD_HEADERS = [
  'Référence', 'Quantité', 'Longueur (cm)', 'Largeur (cm)', 'Hauteur (cm)', 'Poids (kg)',
  'Rotation', 'Empilage', 'Arrêt', 'Destination',
];

export const STANDARD_SAMPLE: (string | number)[][] = [
  ['CARTON-A', 40, 60, 40, 40, 12, 'Libre', 'Libre', 1, 'Client A'],
  ['PALETTE-EURO', 4, 120, 80, 140, 450, 'Horizontale', 'Au sol, rien dessus', 2, 'Client B'],
];

export type RotationMode = 'FULL' | 'HORIZONTAL' | 'NONE';
export type StackingValue = 'FREE' | 'TOP_ONLY' | 'FLOOR' | 'FLOOR_NO_TOP';

const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function parseRotationValue(v: unknown): RotationMode {
  const s = norm(v);
  if (['none', 'interdite', 'interdit', 'non', 'no', '0', 'false', 'aucune', 'fixe'].includes(s)) return 'NONE';
  if (['horizontal', 'horizontale', 'h', 'z', 'a plat'].includes(s) || s.includes('horiz')) return 'HORIZONTAL';
  return 'FULL';
}

/** Lit l'empilage : 4 libellés, ou ancienne colonne oui/non (« Empilable »). */
export function parseStackingValue(v: unknown): StackingValue {
  const k = norm(v);
  if (!k) return 'FREE';
  if (k.includes('sol') && (k.includes('rien') || k.includes('non'))) return 'FLOOR_NO_TOP';
  if (k.includes('sol')) return 'FLOOR';
  if (k.includes('dessus') || k.includes('fragile')) return 'TOP_ONLY';
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
