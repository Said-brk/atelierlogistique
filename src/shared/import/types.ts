// Module d'import partagé : types.
//
// Ce module ne dépend d'aucun outil. Un outil fournit un SCHÉMA (les champs qu'il
// attend) ; le module lit un fichier, propose une correspondance colonnes → champs,
// convertit les unités et renvoie des enregistrements « canoniques » validés.
// Les mêmes briques serviront aux niveaux 2 (API) et 3 (EDI, connecteurs).

export type FieldType = 'text' | 'integer' | 'number' | 'enum' | 'boolean';

/** Famille d'unité : les valeurs canoniques sont en mm (longueur) et kg (masse). */
export type UnitKind = 'length' | 'mass';

export interface UnitDef {
  id: string;        // 'mm', 'cm', 'm', 'g', 'kg', 't'
  label: string;
  factor: number;    // multiplicateur vers l'unité canonique (mm ou kg)
}

export interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Valeur utilisée quand la colonne n'est pas renseignée. */
  defaultValue?: unknown;
  /** Noms de colonnes reconnus (comparaison sans accents ni casse). */
  aliases: string[];
  unitKind?: UnitKind;
  /** Unité supposée quand l'en-tête n'en indique pas. */
  defaultUnit?: string;
  help?: string;
}

export interface DatasetSchema {
  /** Identifiant stable et versionné, ex. 'atelier-logistique/colis'. */
  id: string;
  version: number;
  label: string;
  fields: FieldDef[];
  /** Champs servant à regrouper les lignes identiques (quantités additionnées). */
  groupKey?: string[];
  /** Champ additionné lors du regroupement. */
  quantityField?: string;
  /**
   * Champ identifiant chaque unité (ex. SSCC) : lors du regroupement, ses valeurs
   * sont conservées dans la liste `__units` de l'enregistrement regroupé.
   */
  unitField?: string;
}

/** Tableau brut lu depuis un fichier ou un collage. */
export interface RawTable {
  headers: string[];
  rows: string[][];
  /** Numéro de ligne d'origine (1-based) de chaque ligne de données, pour les messages d'erreur. */
  rowLines?: number[];
  meta: {
    source: string;
    format: 'csv' | 'xlsx' | 'paste';
    encoding?: string;
    delimiter?: string;
    /** Index (0-based) de la ligne d'en-tête dans le fichier d'origine. */
    headerRow: number;
    sheet?: string;
  };
}

export interface FieldMapping {
  column: string | null;
  unit?: string;
}

export type Mapping = Record<string, FieldMapping>;

export interface ImportOptions {
  /** Regrouper les lignes identiques (ex. un export WMS à une ligne par colis/SSCC). */
  groupIdentical?: boolean;
  /** Options propres à un outil (ex. « un arrêt par destination »), mémorisées dans le profil. */
  [key: string]: unknown;
}

export interface ImportIssue {
  row: number;        // numéro de ligne dans le fichier (1-based), 0 = global
  field?: string;
  level: 'error' | 'warning';
  message: string;
}

export type CanonicalRecord = Record<string, unknown>;

export interface ImportResult {
  records: CanonicalRecord[];
  issues: ImportIssue[];
  stats: { read: number; imported: number; skipped: number; grouped: number };
}

/** Profil de correspondance enregistré (ex. « Reflex quai 3 », « Export D365 »). */
export interface ImportProfile {
  id: string;
  name: string;
  schemaId: string;
  schemaVersion: number;
  mapping: Mapping;
  options: ImportOptions;
  createdAt: string;
  updatedAt: string;
}

/**
 * Stockage des profils. Niveau 1 : navigateur (localStorage).
 * Niveau 2 : une implémentation serveur respectant la même interface.
 */
export interface ProfileStore {
  list(schemaId: string): ImportProfile[];
  get(id: string): ImportProfile | null;
  save(profile: ImportProfile): void;
  remove(id: string): void;
}
