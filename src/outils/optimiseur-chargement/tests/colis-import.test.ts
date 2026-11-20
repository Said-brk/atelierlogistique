import { describe, expect, it } from 'vitest';
import { applyMapping, readPasted, suggestMapping, toCsv } from '../../../shared/import';
import { COLIS_SCHEMA, STANDARD_HEADERS, STANDARD_SAMPLE, recordsToColisRows } from '../import/colisSchema';
import { SEQUENCE_HEADERS, sequenceRows } from '../import/exportSequence';
import { optimize } from '../engine/optimizer';

const importText = (text: string, group = false) => {
  const t = readPasted(text, COLIS_SCHEMA);
  const m = suggestMapping(COLIS_SCHEMA, t.headers);
  return { m, ...applyMapping(COLIS_SCHEMA, t, m, { groupIdentical: group }) };
};

describe('schéma colis', () => {
  it('le fichier standard se réimporte à l’identique', () => {
    const csv = toCsv(STANDARD_HEADERS, STANDARD_SAMPLE, { bom: false });
    const { records, issues } = importText(csv);
    expect(issues).toHaveLength(0);
    const rows = recordsToColisRows(records);
    expect(rows[0]).toMatchObject({ reference: 'CARTON-A', quantity: 40, length: 60, width: 40, height: 40, weight: 12, rotationMode: 'FULL', stackable: true, floorOnly: false, stop: 1, destination: 'Client A' });
    expect(rows[1]).toMatchObject({ reference: 'PALETTE-EURO', rotationMode: 'HORIZONTAL', stackable: false, floorOnly: true, stop: 2 });
  });

  it('export WMS type : mm, g, une ligne par SSCC, client en texte', () => {
    const text = [
      'SSCC;Article;LONGUEUR_MM;LARGEUR_MM;HAUTEUR_MM;Poids brut (g);Gerbable;Client',
      '003760001;PAL-EURO;1200;800;1500;380000;Non;Carrefour Massy',
      '003760002;PAL-EURO;1200;800;1500;380000;Non;Carrefour Massy',
      '003760003;CARTON-12;600;400;400;12500;Oui;Leclerc Nanterre',
    ].join('\n');
    const { m, records } = importText(text, true);
    // SSCC unique par ligne : on regroupe sur l'article, pas sur le SSCC.
    expect(m.reference.column).toBe('Article');
    const rows = recordsToColisRows(records, { stopsFromDestination: true });
    expect(rows).toHaveLength(2);
    expect(recordsToColisRows(records).every((r) => r.stop === 1)).toBe(true);
    expect(rows[0]).toMatchObject({ reference: 'PAL-EURO', quantity: 2, length: 120, width: 80, height: 150, weight: 380, stackable: false, stop: 1, destination: 'Carrefour Massy' });
    expect(rows[1]).toMatchObject({ reference: 'CARTON-12', stop: 2, weight: 12.5, stackable: true });
    // Les SSCC sont conservés pour l'export de séquence, et sans colonne Rotation les colis restent debout.
    expect(rows[0].unitIds).toEqual(['003760001', '003760002']);
    expect(rows[0].rotationMode).toBe('HORIZONTAL');
  });

  it('export de séquence : une ligne par colis, chargés puis non chargés', () => {
    const res = optimize(
      { id: 't', label: 'T', length: 1300, width: 900, height: 2100, maxWeight: null },
      [{ id: 'a', reference: 'A', quantity: 3, length: 1200, width: 800, height: 1000, weight: 100, rotationMode: 'FULL', stackable: true }],
    );
    const rows = sequenceRows(res, { a: ['SSCC-1', 'SSCC-2'] });
    expect(rows).toHaveLength(3);
    expect(rows[0][0]).toBe(1);
    const ids = rows.map((r) => r[6]).sort();
    expect(ids).toEqual(['A-3', 'SSCC-1', 'SSCC-2']);
    expect(rows[0]).toHaveLength(SEQUENCE_HEADERS.length);
    expect(rows.filter((r) => r[1] === 'Non chargé').length).toBe(res.unpackedCount);
  });
});
