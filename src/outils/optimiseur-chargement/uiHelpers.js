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
  };
}

// Données d'exemple (cm / kg) — cf. cahier des charges §9.
export function exampleRows() {
  return [
    { id: newRowId(), reference: 'CARTON-A',     quantity: 40, length: 60,  width: 40, height: 40,  weight: 12,  rotationMode: 'FULL',       stackable: true },
    { id: newRowId(), reference: 'CARTON-B',     quantity: 20, length: 80,  width: 60, height: 50,  weight: 18,  rotationMode: 'FULL',       stackable: true },
    { id: newRowId(), reference: 'PALETTE-EURO', quantity: 4,  length: 120, width: 80, height: 140, weight: 450, rotationMode: 'HORIZONTAL', stackable: false },
  ];
}

const NUMERIC_FIELDS = ['quantity', 'length', 'width', 'height', 'weight'];

/** Erreurs de validation d'une ligne (clé champ → message). Vide = valide. */
export function validateRow(row) {
  const errors = {};
  if (!String(row.reference).trim()) errors.reference = 'Référence obligatoire';
  if (!Number.isInteger(row.quantity) || row.quantity <= 0) errors.quantity = 'Quantité entière > 0';
  if (!(row.length > 0)) errors.length = 'Longueur > 0';
  if (!(row.width > 0)) errors.width = 'Largeur > 0';
  if (!(row.height > 0)) errors.height = 'Hauteur > 0';
  if (!(row.weight >= 0)) errors.weight = 'Poids ≥ 0';
  return errors;
}

export function rowsAreValid(rows) {
  return rows.length > 0 && rows.every((r) => Object.keys(validateRow(r)).length === 0);
}

export function coerceField(field, value) {
  if (!NUMERIC_FIELDS.includes(field)) return value;
  if (field === 'quantity') return Math.max(0, Math.round(Number(value) || 0));
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
    stackable: r.stackable,
  }));
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
  stackable: ['stackable', 'empilable', 'gerbable', 'empil'],
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
  const cols = looksHeader ? first : ['reference', 'quantity', 'length', 'width', 'height', 'weight', 'rotation', 'stackable'];
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
  for (const field in BULK_ALIASES) {
    const aliases = BULK_ALIASES[field];
    let key = headers.find((h) => aliases.includes(normKey(h)));
    if (!key) key = headers.find((h) => aliases.some((a) => normKey(h).includes(a)));
    if (key) map[field] = key;
  }
  return json.map((r) => ({
    id: newRowId(),
    reference: map.reference ? String(r[map.reference] ?? '').trim() : '',
    quantity: map.quantity ? Math.max(0, Math.round(toNum(r[map.quantity]))) : 1,
    length: map.length ? toNum(r[map.length]) : 0,
    width: map.width ? toNum(r[map.width]) : 0,
    height: map.height ? toNum(r[map.height]) : 0,
    weight: map.weight ? toNum(r[map.weight]) : 0,
    rotationMode: map.rotation ? parseRotation(r[map.rotation]) : 'FULL',
    stackable: map.stackable ? parseBool(r[map.stackable]) : true,
  })).filter((r) => r.reference || r.length || r.width || r.height);
}

export const mm3ToM3 = (mm3) => mm3 / 1e9;
export const formatM3 = (mm3) => mm3ToM3(mm3).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatKg = (kg) => Math.round(kg).toLocaleString('fr-FR');
export const formatPct = (ratio) => (ratio * 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
