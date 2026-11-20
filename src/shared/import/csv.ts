// Écriture CSV « Excel France » : séparateur « ; », virgule décimale, BOM UTF-8
// (Excel l'ouvre avec les accents corrects ; la plupart des ERP/WMS l'acceptent).

export interface CsvOptions {
  delimiter?: string;
  decimalComma?: boolean;
  bom?: boolean;
}

export function toCsv(headers: string[], rows: unknown[][], opts: CsvOptions = {}): string {
  const d = opts.delimiter ?? ';';
  const comma = opts.decimalComma ?? d === ';';
  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    let s = typeof v === 'number' ? String(v) : String(v);
    if (typeof v === 'number' && comma) s = s.replace('.', ',');
    if (/[";\n\r,\t|]/.test(s) && (s.includes(d) || /["\n\r]/.test(s))) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers, ...rows].map((r) => r.map(cell).join(d));
  return (opts.bom === false ? '' : '﻿') + lines.join('\r\n') + '\r\n';
}

/** Déclenche le téléchargement d'un fichier texte dans le navigateur. */
export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
