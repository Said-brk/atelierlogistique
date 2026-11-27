// Test exécuté par Vitest (Node) ; exclu de tsc (pas de types Node dans ce projet).
import { describe, it, expect } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanDir } from './scanKeys';
import { translate, translateText, interpolate, hasTranslation } from './core';
import './dictionaries';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MODULES = ['shared/import', 'outils/optimiseur-chargement', 'outils/palettisation', 'shared/account', 'shared/carriers', 'espace'];

describe('i18n — dictionnaires', () => {
  it('chaque texte t()/N_() des outils traduits a sa traduction anglaise', () => {
    const missing = [];
    for (const m of MODULES) {
      for (const [file, keys] of scanDir(join(SRC, m))) {
        for (const k of keys) if (!hasTranslation('en', k)) missing.push(`${file.replace(SRC, '')} : ${k}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('les variables {x} sont conservées dans la traduction', () => {
    const bad = [];
    for (const m of MODULES) {
      for (const [, keys] of scanDir(join(SRC, m))) {
        for (const k of keys) {
          const vars = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
          if (vars(k) !== vars(translate('en', k))) bad.push(k);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('i18n — fonctions', () => {
  it('français : renvoie la clé ; anglais : la traduction', () => {
    expect(translate('fr', 'Arrêt {stop}', { stop: 2 })).toBe('Arrêt 2');
    expect(translate('en', 'Arrêt {stop}', { stop: 2 })).toBe('Stop 2');
    expect(translate('en', 'Texte inconnu')).toBe('Texte inconnu');
  });
  it('interpolation : variable absente laissée visible', () => {
    expect(interpolate('{a} et {b}', { a: 1 })).toBe('1 et {b}');
  });
  it('retraduit un message déjà rempli (moteur, worker)', () => {
    expect(translateText('en', 'Conteneur 40 pieds')).toBe('40ft container');
    expect(translateText('en', 'EUR3 / ISO 120×100 imposé')).toBe('EUR3 / ISO 120×100 forced');
    expect(translateText('fr', 'Conteneur 40 pieds')).toBe('Conteneur 40 pieds');
  });
});
