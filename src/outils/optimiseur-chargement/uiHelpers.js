// Helpers d'interface : conversions, validation, couleurs, données d'exemple.
// L'UI travaille en cm / kg ; le moteur reçoit des mm / kg.

let seq = 0;
export const newRowId = () => `row_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export const cmToMm = (cm) => Math.round(Number(cm) * 10);

export const ROTATION_OPTIONS = [
  { value: 'FULL', label: 'Libre' },
  { value: 'HORIZONTAL', label: 'Horizontale' },
  { value: 'NONE', label: 'Interdite' },
];

// Empilage : deux propriétés indépendantes réunies en 4 choix simples.
//  - stackable : le colis peut recevoir d'autres colis par-dessus
//  - floorOnly : le colis doit rester au sol (ne peut pas être posé sur un autre)
export const STACKING_OPTIONS = [
  { value: 'FREE',         label: 'Libre',              stackable: true,  floorOnly: false, hint: 'Peut aller sur un autre colis et en recevoir dessus.' },
  { value: 'TOP_ONLY',     label: 'Dessus uniquement',  stackable: false, floorOnly: false, hint: 'Rien par-dessus (fragile), mais peut être posé sur un autre colis.' },
  { value: 'FLOOR',        label: 'Au sol',             stackable: true,  floorOnly: true,  hint: 'Reste au sol, peut recevoir des colis dessus.' },
  { value: 'FLOOR_NO_TOP', label: 'Au sol, rien dessus', stackable: false, floorOnly: true, hint: 'Reste au sol et ne reçoit rien dessus.' },
];

export function stackingOf(row) {
  const st = row.stackable !== false;
  const fl = !!row.floorOnly;
  return (STACKING_OPTIONS.find((o) => o.stackable === st && o.floorOnly === fl) ?? STACKING_OPTIONS[0]).value;
}

export function stackingFields(value) {
  const o = STACKING_OPTIONS.find((x) => x.value === value) ?? STACKING_OPTIONS[0];
  return { stackable: o.stackable, floorOnly: o.floorOnly };
}

/** Lit un libellé d'empilage (4 choix) ; null si non reconnu. */
export function parseStacking(v) {
  const k = String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!k) return null;
  if (k.includes('sol') && (k.includes('rien') || k.includes('non'))) return 'FLOOR_NO_TOP';
  if (k.includes('sol')) return 'FLOOR';
  if (k.includes('dessus') || k.includes('fragile')) return 'TOP_ONLY';
  if (k.includes('libre')) return 'FREE';
  return null;
}

export function emptyRow() {
  return {
    id: newRowId(),
    reference: '',
    quantity: 1,
    length: 0,
    width: 0,
    height: 0,
    weight: 0,
    rotationMode: 'FULL',
    stackable: true,
    floorOnly: false,
    stop: 1,
    destination: '',
  };
}

export const DELIVERY_MODES = [
  { value: 'STRICT', label: 'Strict', hint: 'Chaque arrêt est accessible sans déplacer un colis d’un arrêt suivant. Ce qui ne respecte pas la règle reste à quai.' },
  { value: 'SOFT', label: 'Souple', hint: 'Charge au maximum ; les colis qui devront être manipulés à la livraison sont signalés.' },
];

// Données d'exemple (cm / kg) — cf. cahier des charges §9.
export function exampleRows() {
  // Tournée de démonstration : 5 arrêts en Île-de-France (arrêt 1 = livré en premier).
  return [
    { id: newRowId(), reference: 'PALETTE-EUR-01', quantity: 2, length: 120, width: 80, height: 145, weight: 520, rotationMode: 'HORIZONTAL', stackable: true, floorOnly: true, stop: 1, destination: 'NANTERRE' },
    { id: newRowId(), reference: 'COLIS-A-01', quantity: 20, length: 60, width: 40, height: 40, weight: 12, rotationMode: 'FULL', stackable: true, floorOnly: false, stop: 1, destination: 'NANTERRE' },
    { id: newRowId(), reference: 'PALETTE-EUR-02', quantity: 3, length: 120, width: 80, height: 160, weight: 610, rotationMode: 'HORIZONTAL', stackable: true, floorOnly: true, stop: 2, destination: 'SAINT-DENIS' },
    { id: newRowId(), reference: 'COLIS-B-02', quantity: 18, length: 80, width: 60, height: 50, weight: 18, rotationMode: 'FULL', stackable: true, floorOnly: false, stop: 2, destination: 'SAINT-DENIS' },
    { id: newRowId(), reference: 'PALETTE-EUR-03', quantity: 2, length: 120, width: 80, height: 135, weight: 430, rotationMode: 'HORIZONTAL', stackable: true, floorOnly: true, stop: 3, destination: 'BOBIGNY' },
    { id: newRowId(), reference: 'COLIS-C-03', quantity: 30, length: 50, width: 40, height: 35, weight: 9, rotationMode: 'FULL', stackable: true, floorOnly: false, stop: 3, destination: 'BOBIGNY' },
    { id: newRowId(), reference: 'PALETTE-EUR-04', quantity: 4, length: 120, width: 80, height: 150, weight: 560, rotationMode: 'HORIZONTAL', stackable: true, floorOnly: true, stop: 4, destination: 'CRETEIL' },
    { id: newRowId(), reference: 'COLIS-D-04', quantity: 12, length: 100, width: 50, height: 45, weight: 22, rotationMode: 'FULL', stackable: true, floorOnly: false, stop: 4, destination: 'CRETEIL' },
    { id: newRowId(), reference: 'PALETTE-EUR-05', quantity: 2, length: 120, width: 80, height: 170, weight: 680, rotationMode: 'HORIZONTAL', stackable: true, floorOnly: true, stop: 5, destination: 'MASSY' },
    { id: newRowId(), reference: 'COLIS-E-05', quantity: 10, length: 70, width: 50, height: 45, weight: 15, rotationMode: 'FULL', stackable: true, floorOnly: false, stop: 5, destination: 'MASSY' },
  ];
}

const NUMERIC_FIELDS = ['quantity', 'length', 'width', 'height', 'weight', 'stop'];

/** Erreurs de validation d'une ligne (clé champ → message). Vide = valide. */
export function validateRow(row) {
  const errors = {};
  if (!String(row.reference).trim()) errors.reference = 'Référence obligatoire';
  if (!Number.isInteger(row.quantity) || row.quantity <= 0) errors.quantity = 'Quantité entière > 0';
  if (!(row.length > 0)) errors.length = 'Longueur > 0';
  if (!(row.width > 0)) errors.width = 'Largeur > 0';
  if (!(row.height > 0)) errors.height = 'Hauteur > 0';
  if (!(row.weight >= 0)) errors.weight = 'Poids ≥ 0';
  if (!Number.isInteger(row.stop ?? 1) || (row.stop ?? 1) < 1) errors.stop = 'Arrêt ≥ 1';
  return errors;
}

export function rowsAreValid(rows) {
  return rows.length > 0 && rows.every((r) => Object.keys(validateRow(r)).length === 0);
}

export function coerceField(field, value) {
  if (!NUMERIC_FIELDS.includes(field)) return value;
  if (field === 'quantity') return Math.max(0, Math.round(Number(value) || 0));
  if (field === 'stop') return Math.max(1, Math.round(Number(value) || 1));
  return Math.max(0, Number(value) || 0);
}

/** Convertit les lignes UI (cm) en définitions moteur (mm). */
export function rowsToDefinitions(rows) {
  return rows.map((r) => ({
    id: r.id,
    reference: r.reference.trim(),
    quantity: r.quantity,
    length: cmToMm(r.length),
    width: cmToMm(r.width),
    height: cmToMm(r.height),
    weight: r.weight,
    rotationMode: r.rotationMode,
    stackable: r.stackable !== false,
    floorOnly: !!r.floorOnly,
    stop: r.stop ?? 1,
    destination: (r.destination ?? '').trim(),
  }));
}

/** Arrêts distincts présents dans les lignes, triés. */
export function distinctStops(rows) {
  return [...new Set(rows.map((r) => r.stop ?? 1))].sort((a, b) => a - b);
}

/** Libellé d'un arrêt : « Arrêt 2 · Client B » (destination = 1re renseignée). */
export function stopLabel(stop, rows) {
  const dest = rows.find((r) => (r.stop ?? 1) === stop && String(r.destination ?? '').trim())?.destination;
  return dest ? `Arrêt ${stop} · ${String(dest).trim()}` : `Arrêt ${stop}`;
}

// Palette distincte par arrêt (contrastée, lisible en 3D).
const STOP_HUES = [217, 142, 32, 280, 350, 190, 60, 10, 250, 100];
export function stopColor(stop) {
  const hue = STOP_HUES[(Math.max(1, stop) - 1) % STOP_HUES.length];
  return {
    solid: `hsl(${hue}, 65%, 52%)`,
    light: `hsl(${hue}, 65%, 86%)`,
    dark: `hsl(${hue}, 65%, 30%)`,
  };
}

// Couleur stable par référence (même réf → même couleur).
export function refColor(index) {
  const hue = (index * 47) % 360;
  return {
    solid: `hsl(${hue}, 55%, 55%)`,
    light: `hsl(${hue}, 55%, 88%)`,
    dark: `hsl(${hue}, 55%, 32%)`,
  };
}

// ---- Import en masse (coller un tableau ou un fichier Excel/CSV) ----
const normKey = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
const toNum = (v) => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
};

const BULK_ALIASES = {
  reference: ['reference', 'référence', 'ref', 'réf', 'sku', 'code', 'article', 'designation', 'désignation', 'libelle', 'libellé', 'nom'],
  quantity: ['quantity', 'quantité', 'quantite', 'qte', 'qté', 'qty', 'nb', 'nombre'],
  length: ['length', 'longueur', 'long'],
  width: ['width', 'largeur', 'larg'],
  height: ['height', 'hauteur', 'haut'],
  weight: ['weight', 'poids', 'masse', 'kg'],
  rotation: ['rotation', 'rot'],
  stacking: ['empilage', 'superposition', 'gerbage'],
  stackable: ['stackable', 'empilable', 'gerbable', 'empil'],
  stop: ['arrêt', 'arret', 'stop', 'ordre de livraison', 'ordre', 'tournée', 'tournee', 'séquence', 'sequence'],
  destination: ['destination', 'client', 'destinataire', 'ville'],
};

const parseRotation = (v) => {
  const s = normKey(v);
  if (['none', 'interdite', 'interdit', 'non', 'no', '0', 'false', 'aucune'].includes(s)) return 'NONE';
  if (['horizontal', 'horizontale', 'h', 'z'].includes(s)) return 'HORIZONTAL';
  return 'FULL';
};
const parseBool = (v) => !['non', 'no', '0', 'false', 'n', ''].includes(normKey(v));

/** Transforme un collage tableur (TSV / CSV / point-virgule) en lignes d'objets. */
export function parsePastedTable(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const delim = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
  const first = lines[0].split(delim).map((h) => h.trim());
  // Ligne d'en-tête seulement si plusieurs cellules correspondent à des noms de colonnes connus.
  const aliasList = Object.values(BULK_ALIASES).flat();
  const headerMatches = first.filter((h) => {
    const k = normKey(h);
    return aliasList.some((a) => k === a || k.includes(a));
  }).length;
  const looksHeader = headerMatches >= 2;
  const cols = looksHeader ? first : ['reference', 'quantity', 'length', 'width', 'height', 'weight', 'rotation', 'stackable', 'stop', 'destination'];
  return lines.slice(looksHeader ? 1 : 0).map((line) => {
    const cells = line.split(delim);
    const o = {};
    cols.forEach((h, i) => { o[h] = (cells[i] ?? '').trim(); });
    return o;
  });
}

/** Mappe des lignes d'objets (collage ou Excel) vers des lignes de l'outil (cm). */
export function bulkToRows(json) {
  if (!json || json.length === 0) return [];
  const headers = Object.keys(json[0]);
  const map = {};
  const used = new Set();
  // Correspondances exactes d'abord (toutes colonnes), puis partielles.
  for (const field in BULK_ALIASES) {
    const key = headers.find((h) => !used.has(h) && BULK_ALIASES[field].includes(normKey(h)));
    if (key) { map[field] = key; used.add(key); }
  }
  for (const field in BULK_ALIASES) {
    if (map[field]) continue;
    const key = headers.find((h) => !used.has(h) && BULK_ALIASES[field].some((a) => normKey(h).includes(a)));
    if (key) { map[field] = key; used.add(key); }
  }
  // Arrêt saisi en texte (ex. nom du client) : numérotation dans l'ordre d'apparition.
  const textStops = new Map();
  const readStop = (r) => {
    if (!map.stop) return { stop: 1, dest: '' };
    const raw = String(r[map.stop] ?? '').trim();
    const n = Math.round(toNum(raw));
    if (raw && /^\s*\d+([.,]0+)?\s*$/.test(raw) && n >= 1) return { stop: n, dest: '' };
    if (!raw) return { stop: 1, dest: '' };
    if (!textStops.has(raw)) textStops.set(raw, textStops.size + 1);
    return { stop: textStops.get(raw), dest: raw };
  };
  return json.map((r) => {
    const { stop, dest } = readStop(r);
    return {
    id: newRowId(),
    reference: map.reference ? String(r[map.reference] ?? '').trim() : '',
    quantity: map.quantity ? Math.max(0, Math.round(toNum(r[map.quantity]))) : 1,
    length: map.length ? toNum(r[map.length]) : 0,
    width: map.width ? toNum(r[map.width]) : 0,
    height: map.height ? toNum(r[map.height]) : 0,
    weight: map.weight ? toNum(r[map.weight]) : 0,
    rotationMode: map.rotation ? parseRotation(r[map.rotation]) : 'FULL',
    ...(() => {
      // Colonne « Empilage » (4 choix) prioritaire ; sinon ancienne colonne Empilable Oui/Non.
      const st = map.stacking ? parseStacking(r[map.stacking]) : null;
      if (st) return stackingFields(st);
      return { stackable: map.stackable ? parseBool(r[map.stackable]) : true, floorOnly: false };
    })(),
    stop,
    destination: map.destination ? String(r[map.destination] ?? '').trim() : dest,
    };
  }).filter((r) => r.reference || r.length || r.width || r.height);
}

export const mm3ToM3 = (mm3) => mm3 / 1e9;
export const formatM3 = (mm3) => mm3ToM3(mm3).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatKg = (kg) => Math.round(kg).toLocaleString('fr-FR');
export const formatPct = (ratio) => (ratio * 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
