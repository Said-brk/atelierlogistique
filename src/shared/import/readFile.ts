// Lecture d'un fichier utilisateur (CSV, TXT, Excel) en RawTable.
// Séparé du cœur pour que le cœur reste sans dépendance (réutilisable côté serveur).

import * as XLSX from 'xlsx';
import type { DatasetSchema, RawTable } from './types';
import { findHeaderRow, readDelimitedBytes, toRawTable } from './read';
import { t } from '../i18n/core';

export const ACCEPTED_FILES = '.csv,.txt,.tsv,.xlsx,.xls,.xlsm,.ods';

function sheetCells(ws: XLSX.WorkSheet): string[][] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: true, raw: true });
  return rows.map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c))));
}

/**
 * Lit un fichier. Pour un classeur, choisit la feuille dont l'en-tête est le mieux
 * reconnu (ou celle demandée) et renvoie la liste des feuilles.
 */
export async function readFile(
  file: File, schema: DatasetSchema, sheetName?: string,
): Promise<{ table: RawTable; sheets: string[] }> {
  const buf = await file.arrayBuffer();
  if (/\.(csv|txt|tsv)$/i.test(file.name)) {
    return { table: readDelimitedBytes(buf, file.name, schema), sheets: [] };
  }
  const wb = XLSX.read(buf, { type: 'array' });
  const sheets = wb.SheetNames;
  if (sheets.length === 0) throw new Error(t('Classeur vide'));
  let chosen = sheetName && sheets.includes(sheetName) ? sheetName : sheets[0];
  if (!sheetName && sheets.length > 1) {
    let best = -1;
    for (const s of sheets) {
      const cells = sheetCells(wb.Sheets[s]);
      const h = findHeaderRow(cells, schema);
      const score = h >= 0 ? 1000 - h + cells.length / 1e6 : -1;
      if (score > best) { best = score; chosen = s; }
    }
  }
  const table = toRawTable(sheetCells(wb.Sheets[chosen]), schema, { source: file.name, format: 'xlsx', sheet: chosen });
  return { table, sheets };
}
