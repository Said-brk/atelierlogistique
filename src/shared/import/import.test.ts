import { describe, expect, it } from 'vitest';
import {
  applyMapping, createLocalProfileStore, decodeText, detectDelimiter, detectUnit, exportProfile,
  headerFingerprint, importProfileJson, mappingFits, newProfile, parseNumber, readDelimitedBytes,
  readPasted, suggestMapping, toCsv,
} from './index';
import type { DatasetSchema } from './index';

const SCHEMA: DatasetSchema = {
  id: 'test/colis', version: 1, label: 'Test',
  groupKey: ['ref', 'len'], quantityField: 'qty',
  fields: [
    { id: 'ref', label: 'Référence', type: 'text', required: true, aliases: ['reference', 'sku', 'article'] },
    { id: 'qty', label: 'Quantité', type: 'integer', defaultValue: 1, aliases: ['quantite', 'qte'] },
    { id: 'len', label: 'Longueur', type: 'number', required: true, unitKind: 'length', defaultUnit: 'cm', aliases: ['longueur'] },
    { id: 'kg', label: 'Poids', type: 'number', unitKind: 'mass', defaultUnit: 'kg', aliases: ['poids', 'poids brut'] },
    { id: 'ok', label: 'Actif', type: 'boolean', aliases: ['actif'] },
  ],
};

const win1252 = (s: string) => new Uint8Array([...s].map((c) => {
  const code = c.charCodeAt(0);
  if (code > 255) throw new Error('hors latin-1');
  return code;
}));

describe('lecture', () => {
  it('nombres FR / EN', () => {
    expect(parseNumber('1 234,5')).toBe(1234.5);
    expect(parseNumber('1.234,5')).toBe(1234.5);
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('12 kg')).toBe(12);
    expect(parseNumber('abc')).toBeNaN();
  });

  it('encodage Windows-1252 et UTF-8 avec BOM', () => {
    expect(decodeText(win1252('Référence;Qté')).encoding).toBe('windows-1252');
    expect(decodeText(win1252('Référence;Qté')).text).toBe('Référence;Qté');
    const utf = new TextEncoder().encode('﻿Référence');
    expect(decodeText(utf)).toEqual({ text: 'Référence', encoding: 'utf-8' });
  });

  it('séparateur et guillemets', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
    const t = readPasted('Référence,Longueur\n"CARTON, grand",60', SCHEMA);
    expect(t.rows[0]).toEqual(['CARTON, grand', '60']);
  });

  it('saute les lignes de titre avant l’en-tête', () => {
    const csv = 'Export WMS du 12/11/2026;;\nEntrepôt : Lyon;;\n;;\nArticle;Qte;Longueur (mm);Poids brut (g)\nA1;2;1200;450000\n';
    const t = readDelimitedBytes(win1252(csv).buffer as ArrayBuffer, 'export.csv', SCHEMA);
    expect(t.meta.headerRow).toBe(3);
    expect(t.headers).toEqual(['Article', 'Qte', 'Longueur (mm)', 'Poids brut (g)']);
  });
});

describe('correspondance et conversion', () => {
  it('détecte unités dans les en-têtes', () => {
    expect(detectUnit('Longueur (mm)', 'length')).toBe('mm');
    expect(detectUnit('HAUTEUR_M', 'length')).toBe('m');
    expect(detectUnit('Poids brut (g)', 'mass')).toBe('g');
    expect(detectUnit('Poids', 'mass')).toBeNull();
  });

  it('mm / g → canonique mm / kg, avec ligne de total ignorée', () => {
    const t = readPasted('Article;Qte;Longueur (mm);Poids brut (g)\nA1;2;1200;450000\n;;;\nTOTAL;;;', SCHEMA);
    const m = suggestMapping(SCHEMA, t.headers);
    expect(m.ref.column).toBe('Article');
    expect(m.len).toEqual({ column: 'Longueur (mm)', unit: 'mm' });
    expect(m.kg.unit).toBe('g');
    const r = applyMapping(SCHEMA, t, m);
    expect(r.records[0]).toMatchObject({ ref: 'A1', qty: 2, len: 1200, kg: 450 });
    expect(r.issues.some((i) => i.level === 'error' && i.row === 4)).toBe(true); // TOTAL sans longueur
  });

  it('cm par défaut et virgule décimale', () => {
    const t = readPasted('Référence;Longueur\nX;60,5', SCHEMA);
    const r = applyMapping(SCHEMA, t, suggestMapping(SCHEMA, t.headers));
    expect(r.records[0].len).toBe(605);
  });

  it('signale les valeurs illisibles avec n° de ligne', () => {
    const t = readPasted('Référence;Longueur;Actif\nX;abc;peut-être', SCHEMA);
    const r = applyMapping(SCHEMA, t, suggestMapping(SCHEMA, t.headers));
    expect(r.issues.map((i) => i.row)).toContain(2);
    expect(r.issues.filter((i) => i.level === 'warning')).toHaveLength(2);
  });

  it('regroupe une ligne par colis (export SSCC)', () => {
    const t = readPasted('SKU;Longueur\nA;60\nA;60\nA;60\nB;80', SCHEMA);
    const r = applyMapping(SCHEMA, t, suggestMapping(SCHEMA, t.headers), { groupIdentical: true });
    expect(r.records.map((x) => [x.ref, x.qty])).toEqual([['A', 3], ['B', 1]]);
    expect(r.stats.grouped).toBe(2);
  });
});

describe('profils', () => {
  it('enregistre, liste, supprime, exporte et réimporte', () => {
    const mem = new Map<string, string>();
    const store = createLocalProfileStore({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => { mem.set(k, v); } });
    const t = readPasted('SKU;Longueur (mm)\nA;600', SCHEMA);
    const p = newProfile('Reflex quai 3', SCHEMA.id, 1, suggestMapping(SCHEMA, t.headers), { groupIdentical: true });
    store.save(p);
    expect(store.list(SCHEMA.id).map((x) => x.name)).toEqual(['Reflex quai 3']);
    expect(store.list('autre')).toHaveLength(0);
    expect(mappingFits(p.mapping, t)).toBe(true);
    expect(mappingFits(p.mapping, { headers: ['Autre'] })).toBe(false);

    const copy = importProfileJson(exportProfile(p), SCHEMA.id);
    expect(copy.id).not.toBe(p.id);
    expect(copy.mapping).toEqual(p.mapping);
    expect(() => importProfileJson('{}', SCHEMA.id)).toThrow();

    store.remove(p.id);
    expect(store.list(SCHEMA.id)).toHaveLength(0);
  });

  it('empreinte d’en-têtes indépendante de l’ordre et des accents', () => {
    expect(headerFingerprint(['Qté', 'Référence'])).toBe(headerFingerprint(['Reference', 'QTE']));
  });
});

describe('écriture CSV', () => {
  it('format Excel France', () => {
    const csv = toCsv(['A', 'B'], [[1.5, 'x;y'], ['he said "hi"', null]]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('1,5;"x;y"');
    expect(csv).toContain('"he said ""hi""";');
  });
});
