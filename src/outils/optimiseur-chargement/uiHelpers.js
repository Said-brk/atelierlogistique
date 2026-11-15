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

export const mm3ToM3 = (mm3) => mm3 / 1e9;
export const formatM3 = (mm3) => mm3ToM3(mm3).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatKg = (kg) => Math.round(kg).toLocaleString('fr-FR');
export const formatPct = (ratio) => (ratio * 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
