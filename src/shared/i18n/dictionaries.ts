// Dictionnaires anglais, un fichier par module (chaque module garde ses textes à côté de lui).
import { registerDictionary } from './core';
import importEn from '../import/i18n.en';
import loadEn from '../../outils/optimiseur-chargement/i18n.en';
import palletEn from '../../outils/palettisation/i18n.en';

registerDictionary('en', { ...importEn, ...loadEn, ...palletEn });
