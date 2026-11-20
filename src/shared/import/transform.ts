import type {
  CanonicalRecord, DatasetSchema, FieldDef, ImportIssue, ImportOptions, ImportResult, Mapping, RawTable,
} from './types';
import { parseBoolean, parseNumber } from './text';
import { unitFactor } from './units';

/** Convertit une cellule selon le type du champ. undefined = vide / non renseigné. */
export function convertValue(field: FieldDef, raw: string, unit?: string): { value?: unknown; error?: string } {
  const s = (raw ?? '').toString().trim();
  if (s === '') return {};
  switch (field.type) {
    case 'text':
    case 'enum':
      return { value: s };
    case 'boolean': {
      const b = parseBoolean(s);
      return b === null ? { error: `« ${s} » n'est pas oui/non` } : { value: b };
    }
    case 'integer':
    case 'number': {
      const n = parseNumber(s);
      if (Number.isNaN(n)) return { error: `« ${s} » n'est pas un nombre` };
      let v = field.unitKind ? n * unitFactor(field.unitKind, unit, field.defaultUnit ?? '') : n;
      if (field.type === 'integer') v = Math.round(v);
      return { value: Math.round(v * 1000) / 1000 };
    }
    default:
      return { value: s };
  }
}

/**
 * Applique la correspondance à un tableau brut et produit des enregistrements
 * canoniques (mm, kg). Les lignes sans aucun champ obligatoire sont ignorées
 * (lignes de total, de séparation…) ; les erreurs sont listées avec le n° de ligne.
 */
export function applyMapping(
  schema: DatasetSchema,
  table: RawTable,
  mapping: Mapping,
  options: ImportOptions = {},
): ImportResult {
  const issues: ImportIssue[] = [];
  const colIndex: Record<string, number> = {};
  for (const f of schema.fields) {
    const c = mapping[f.id]?.column;
    colIndex[f.id] = c ? table.headers.indexOf(c) : -1;
  }
  const required = schema.fields.filter((f) => f.required);
  const firstDataLine = table.meta.headerRow + 2; // 1-based, après l'en-tête

  let skipped = 0;
  const records: CanonicalRecord[] = [];
  table.rows.forEach((cells, i) => {
    const line = table.rowLines?.[i] ?? firstDataLine + i;
    const rec: CanonicalRecord = {};
    const rowIssues: ImportIssue[] = [];
    let filledRequired = 0;
    for (const f of schema.fields) {
      const idx = colIndex[f.id];
      const raw = idx >= 0 ? cells[idx] ?? '' : '';
      const { value, error } = convertValue(f, raw, mapping[f.id]?.unit);
      if (error) rowIssues.push({ row: line, field: f.id, level: 'warning', message: `${f.label} : ${error}` });
      if (value !== undefined) {
        rec[f.id] = value;
        if (f.required) filledRequired++;
      } else if (f.defaultValue !== undefined) {
        rec[f.id] = f.defaultValue;
      }
    }
    if (filledRequired === 0) { skipped++; return; }
    for (const f of required) {
      if (rec[f.id] === undefined || rec[f.id] === '' || (typeof rec[f.id] === 'number' && (rec[f.id] as number) <= 0)) {
        rowIssues.push({ row: line, field: f.id, level: 'error', message: `${f.label} manquant ou nul` });
      }
    }
    issues.push(...rowIssues);
    rec.__line = line;
    records.push(rec);
  });

  let grouped = 0;
  let out = records;
  if (options.groupIdentical && schema.groupKey?.length && schema.quantityField) {
    const before = records.length;
    out = groupRecords(records, schema.groupKey, schema.quantityField, schema.unitField);
    grouped = before - out.length;
  }

  return { records: out, issues, stats: { read: table.rows.length, imported: out.length, skipped, grouped } };
}

/**
 * Regroupe les lignes identiques (mêmes valeurs sur groupKey) en additionnant
 * la quantité. Utile pour les exports WMS « une ligne par colis / SSCC ».
 */
export function groupRecords(
  records: CanonicalRecord[], key: string[], qtyField: string, unitField?: string,
): CanonicalRecord[] {
  const map = new Map<string, CanonicalRecord>();
  for (const r of records) {
    const k = key.map((f) => JSON.stringify(r[f] ?? null)).join('§');
    const prev = map.get(k);
    const q = Number(r[qtyField] ?? 1) || 1;
    const unit = unitField && r[unitField] !== undefined && r[unitField] !== '' ? [String(r[unitField])] : [];
    if (prev) {
      prev[qtyField] = (Number(prev[qtyField]) || 0) + q;
      (prev.__units as string[]).push(...unit);
    } else {
      map.set(k, { ...r, [qtyField]: q, __units: unit });
    }
  }
  return [...map.values()];
}
