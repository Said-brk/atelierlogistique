import { describe, it, expect } from 'vitest';
// @ts-ignore
import { bulkToRows, stackingOf, parseStacking } from '../uiHelpers';
describe('Import : colonne Empilage', () => {
  it('reconnaît les 4 libellés et l\'ancienne colonne Empilable', () => {
    expect(parseStacking('Au sol, rien dessus')).toBe('FLOOR_NO_TOP');
    expect(parseStacking('au sol')).toBe('FLOOR');
    expect(parseStacking('Dessus uniquement')).toBe('TOP_ONLY');
    expect(parseStacking('Libre')).toBe('FREE');
    const rows = bulkToRows([
      { 'Référence': 'A', 'Qté': 1, 'Longueur': 10, 'Largeur': 10, 'Hauteur': 10, 'Empilage': 'Au sol' },
    ]);
    expect(stackingOf(rows[0])).toBe('FLOOR');
    const legacy = bulkToRows([{ 'Référence': 'B', 'Qté': 1, 'Longueur': 10, 'Largeur': 10, 'Hauteur': 10, 'Empilable': 'Non' }]);
    expect(stackingOf(legacy[0])).toBe('TOP_ONLY');
  });
});
