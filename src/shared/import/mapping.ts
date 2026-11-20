import type { DatasetSchema, Mapping, RawTable } from './types';
import { normalizeLabel } from './text';
import { detectUnit } from './units';

/**
 * Propose une correspondance colonnes → champs.
 * 1. correspondance exacte d'un alias ; 2. en-tête contenant un alias (le plus long gagne).
 * Une colonne n'est attribuée qu'à un seul champ.
 */
export function suggestMapping(schema: DatasetSchema, headers: string[]): Mapping {
  const norm = headers.map(normalizeLabel);
  const used = new Set<number>();
  const mapping: Mapping = {};

  const pick = (fieldId: string, idx: number) => {
    used.add(idx);
    const f = schema.fields.find((x) => x.id === fieldId)!;
    mapping[fieldId] = {
      column: headers[idx],
      unit: f.unitKind ? detectUnit(headers[idx], f.unitKind) ?? f.defaultUnit : undefined,
    };
  };

  // Passe 1 : exact
  for (const f of schema.fields) {
    // Les alias sont classés par priorité : « article » l'emporte sur « sscc ».
    for (const a of f.aliases.map(normalizeLabel)) {
      const idx = norm.findIndex((h, i) => !used.has(i) && stripUnit(h) === a);
      if (idx >= 0) { pick(f.id, idx); break; }
    }
  }
  // Passe 2 : partiel
  for (const f of schema.fields) {
    if (mapping[f.id]) continue;
    const aliases = f.aliases.map(normalizeLabel).filter((a) => a.length >= 3).sort((a, b) => b.length - a.length);
    let best = -1;
    let bestLen = 0;
    norm.forEach((h, i) => {
      if (used.has(i)) return;
      const words = ` ${h} `;
      for (const a of aliases) {
        if (words.includes(` ${a} `) || (a.length >= 5 && h.includes(a))) {
          if (a.length > bestLen) { bestLen = a.length; best = i; }
          break;
        }
      }
    });
    if (best >= 0) pick(f.id, best);
  }
  for (const f of schema.fields) {
    if (!mapping[f.id]) mapping[f.id] = { column: null, unit: f.defaultUnit };
  }
  return mapping;
}

/**
 * Fichier sans en-tête : colonnes prises dans l'ordre des champs du schéma
 * (= ordre du format standard), unités par défaut.
 */
export function positionalMapping(schema: DatasetSchema, headers: string[]): Mapping {
  const mapping: Mapping = {};
  schema.fields.forEach((f, i) => {
    mapping[f.id] = { column: headers[i] ?? null, unit: f.defaultUnit };
  });
  return mapping;
}

/** Correspondance de départ : par noms de colonnes si un en-tête existe, sinon par position. */
export function initialMapping(schema: DatasetSchema, table: RawTable): Mapping {
  return table.meta.headerRow >= 0 ? suggestMapping(schema, table.headers) : positionalMapping(schema, table.headers);
}

/** Retire un suffixe d'unité : « longueur mm » → « longueur ». */
function stripUnit(h: string): string {
  return h.replace(/\s(mm|cm|m|kg|g|t)$/, '').trim();
}

/** Champs obligatoires sans colonne. */
export function missingRequired(schema: DatasetSchema, mapping: Mapping): string[] {
  return schema.fields.filter((f) => f.required && !mapping[f.id]?.column).map((f) => f.id);
}

/**
 * Empreinte des en-têtes : permet de reconnaître automatiquement un fichier
 * déjà importé avec un profil (même export ERP/WMS chaque jour).
 */
export function headerFingerprint(headers: string[]): string {
  return headers.map(normalizeLabel).filter(Boolean).sort().join('|');
}

/** Un profil est applicable si toutes ses colonnes existent dans le fichier. */
export function mappingFits(mapping: Mapping, table: Pick<RawTable, 'headers'>): boolean {
  const cols = Object.values(mapping).map((m) => m.column).filter((c): c is string => !!c);
  return cols.length > 0 && cols.every((c) => table.headers.includes(c));
}
