// Inventaire des textes à traduire : appels t('…'), tr('…') et N_('…') dans les sources.
// Utilisé par le test qui vérifie qu'aucune clé n'est oubliée dans les dictionnaires.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CALL = /\b(?:t|tr|N_)\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
const unescape = (s) => s.replace(/\\(['"\\n])/g, (_, c) => (c === 'n' ? '\n' : c));

export function scanFile(file) {
  const src = readFileSync(file, 'utf8');
  const keys = [];
  for (const m of src.matchAll(CALL)) keys.push(unescape(m[1] ?? m[2]));
  return keys;
}

export function scanDir(dir) {
  const out = new Map();
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.(jsx?|tsx?)$/.test(n) || /\.test\.|i18n\.en\.|en\.common|scanKeys/.test(n)) continue;
      const keys = scanFile(p);
      if (keys.length) out.set(p, keys);
    }
  };
  walk(dir);
  return out;
}
