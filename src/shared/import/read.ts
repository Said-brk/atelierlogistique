// Lecture de fichiers et de collages en tableau brut (RawTable).
// Gère les pièges courants des exports ERP / WMS :
//  - encodage Windows-1252 (accents illisibles) vs UTF-8, BOM ;
//  - séparateur « ; », « , », tabulation ou « | » ;
//  - champs entre guillemets contenant le séparateur ;
//  - lignes de titre ou de filtres avant l'en-tête ;
//  - lignes vides.

import type { DatasetSchema, RawTable } from './types';
import { normalizeLabel } from './text';

/** Décode des octets : UTF-8 si valide, sinon Windows-1252 (exports Windows / AS400). */
export function decodeText(bytes: ArrayBuffer | Uint8Array): { text: string; encoding: string } {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(u8);
    return { text: text.replace(/^﻿/, ''), encoding: 'utf-8' };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(u8), encoding: 'windows-1252' };
  }
}

const DELIMS = ['\t', ';', ',', '|'];

/** Séparateur le plus régulier sur les premières lignes (hors guillemets). */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 20);
  let best = ';';
  let bestScore = -1;
  for (const d of DELIMS) {
    const counts = lines.map((l) => splitLine(l, d).length);
    if (counts.length === 0) continue;
    const max = Math.max(...counts);
    if (max < 2) continue;
    const regular = counts.filter((c) => c === max).length;
    const score = regular * 100 + max;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

function splitLine(line: string, d: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === d) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Découpe un texte délimité (CSV, TSV, collage tableur) en cellules, une entrée par ligne du fichier. */
export function parseDelimited(text: string, delimiter = detectDelimiter(text)): string[][] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => splitLine(l, delimiter));
}

const isBlank = (cells: string[]) => !cells.some((c) => String(c ?? '').trim() !== '');

/**
 * Trouve la ligne d'en-tête : celle (parmi les 15 premières) qui contient le plus de
 * noms de colonnes reconnus par le schéma. -1 si aucune ne ressemble à un en-tête.
 */
export function findHeaderRow(rows: string[][], schema: DatasetSchema): number {
  const aliases = schema.fields.flatMap((f) => f.aliases.map(normalizeLabel));
  let best = -1;
  let bestHits = 1; // au moins 2 colonnes reconnues
  rows.slice(0, 20).forEach((cells, i) => {
    const hits = cells.filter((c) => {
      const k = normalizeLabel(c);
      if (!k || /^[\d\s.,-]+$/.test(k)) return false;
      return aliases.some((a) => k === a || (a.length >= 3 && ` ${k} `.includes(` ${a} `)));
    }).length;
    if (hits > bestHits) { bestHits = hits; best = i; }
  });
  return best;
}

/** Construit une RawTable à partir de cellules, en repérant l'en-tête. */
export function toRawTable(
  cells: string[][],
  schema: DatasetSchema,
  meta: Omit<RawTable['meta'], 'headerRow'>,
): RawTable {
  const h = findHeaderRow(cells, schema);
  const width = Math.max(0, ...cells.filter((r) => !isBlank(r)).map((r) => r.length));
  const headers = h >= 0
    ? cells[h].map((c, i) => c || `Colonne ${i + 1}`)
    : Array.from({ length: width }, (_, i) => `Colonne ${i + 1}`);
  // Complète les en-têtes manquants et rend les doublons uniques.
  while (headers.length < width) headers.push(`Colonne ${headers.length + 1}`);
  const seen = new Map<string, number>();
  const unique = headers.map((x) => {
    const n = (seen.get(x) ?? 0) + 1; seen.set(x, n);
    return n > 1 ? `${x} (${n})` : x;
  });
  const rows: string[][] = [];
  const rowLines: number[] = [];
  cells.forEach((r, i) => {
    if (i <= h || isBlank(r)) return;
    rows.push(unique.map((_, j) => (r[j] ?? '').toString().trim()));
    rowLines.push(i + 1);
  });
  return { headers: unique, rows, rowLines, meta: { ...meta, headerRow: h } };
}

/** Lit un texte collé depuis un tableur. */
export function readPasted(text: string, schema: DatasetSchema): RawTable {
  const delimiter = detectDelimiter(text);
  return toRawTable(parseDelimited(text, delimiter), schema, { source: 'collage', format: 'paste', delimiter });
}

/** Lit un CSV / TXT (octets bruts). */
export function readDelimitedBytes(bytes: ArrayBuffer, name: string, schema: DatasetSchema): RawTable {
  const { text, encoding } = decodeText(bytes);
  const delimiter = detectDelimiter(text);
  return toRawTable(parseDelimited(text, delimiter), schema, { source: name, format: 'csv', encoding, delimiter });
}
