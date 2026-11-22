// Calculs QR code sans React (testables) : découpage en segments, taille du QR code.
import qrcode from 'qrcode-generator';

// Mode alphanumérique (0-9, A-Z, espace, $%*+-./:) : 5,5 bits par caractère au lieu de 8.
// Le texte est découpé en morceaux : longs passages alphanumériques dans ce mode, le reste en octets.
const ALNUM = /^[0-9A-Z $%*+\-./:]$/;
export function segments(text: string): [string, 'Alphanumeric' | 'Byte'][] {
  const runs: [string, 'Alphanumeric' | 'Byte'][] = [];
  for (const ch of text) {
    const mode: 'Alphanumeric' | 'Byte' = ALNUM.test(ch) ? 'Alphanumeric' : 'Byte';
    const last = runs[runs.length - 1];
    if (last && last[1] === mode) last[0] += ch; else runs.push([ch, mode]);
  }
  // Un court passage alphanumérique coûte plus cher seul (en-tête de segment) : on le fond dans les octets.
  const merged: [string, 'Alphanumeric' | 'Byte'][] = [];
  for (const [part, mode] of runs) {
    const m: 'Alphanumeric' | 'Byte' = mode === 'Alphanumeric' && part.length < 12 ? 'Byte' : mode;
    const last = merged[merged.length - 1];
    if (last && last[1] === m) last[0] += part; else merged.push([part, m]);
  }
  return merged;
}

/** QR code jugé lisible au téléphone jusqu'à cette taille (version 25). */
export const QR_MAX_MODULES = 117;

/** Nombre de modules (côté) du QR code d'un texte, ou null s'il ne tient pas. */
export function qrModules(text: string, level: 'L' | 'M' | 'Q' | 'H' = 'L'): number | null {
  try { const qr = qrcode(0, level); segments(text).forEach(([p, m]) => qr.addData(p, m)); qr.make(); return qr.getModuleCount(); } catch { return null; }
}

