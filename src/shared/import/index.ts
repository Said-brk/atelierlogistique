// Point d'entrée du module d'import partagé.
//
//   lecture (read)  →  correspondance (mapping)  →  conversion (transform)  →  enregistrements
//   CSV / Excel /      suggestion auto, profils       unités, nombres FR,       canoniques
//   collage            enregistrés                   regroupement, erreurs     (mm, kg)
//
// Niveau 2 (API) : un connecteur produit directement une RawTable ou des enregistrements
// canoniques ; ProfileStore peut être implémenté côté serveur.
// Niveau 3 (EDI DESADV, connecteurs WMS) : un nouveau lecteur produit une RawTable,
// le reste de la chaîne est inchangé.

export * from './types';
export * from './text';
export * from './units';
export * from './read';
export * from './mapping';
export * from './transform';
export * from './profiles';
export * from './csv';
