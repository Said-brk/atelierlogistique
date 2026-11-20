# Module d'import partagé (connectivité ERP / WMS)

Module générique, indépendant de tout outil. Un outil déclare un **schéma** (champs attendus) ;
le module lit le fichier, propose la correspondance des colonnes, convertit les unités et
renvoie des enregistrements canoniques validés. Tout se passe dans le navigateur.

```
lecture (read, readFile) → correspondance (mapping) → conversion (transform) → enregistrements canoniques
CSV / Excel / collage      suggestion, profils          unités, nombres FR,       mm, kg
                                                        regroupement, erreurs
```

| Fichier | Rôle |
|---|---|
| `types.ts` | Contrats : `DatasetSchema`, `RawTable`, `Mapping`, `ImportProfile`, `ProfileStore` |
| `read.ts` | Encodage (UTF-8 / Windows-1252), séparateur, guillemets, ligne d'en-tête après des lignes de titre |
| `readFile.ts` | Fichiers CSV / TXT / Excel (choix automatique de la feuille) — seule dépendance à `xlsx` |
| `mapping.ts` | Suggestion de correspondance (alias par priorité), unités lues dans l'en-tête, fichier sans en-tête |
| `transform.ts` | Conversion, erreurs avec n° de ligne, regroupement « une ligne par SSCC » |
| `profiles.ts` | Profils de correspondance (localStorage), export / import JSON pour les partager |
| `csv.ts` | Écriture CSV « Excel France » (`;`, virgule décimale, BOM) |
| `ImportWizard.jsx` | Assistant d'import générique (fichier ou collage, profils, aperçu) |

## Utiliser dans un autre outil

1. Déclarer un schéma (voir `src/outils/optimiseur-chargement/import/colisSchema.ts`).
2. Ouvrir `<ImportWizard schema={…} store={createLocalProfileStore()} onImport={…} />`.
3. Convertir les enregistrements canoniques vers le modèle de l'outil.

## Supprimer

- Retirer l'import dans un outil : supprimer le bouton qui ouvre `ImportWizard` et l'appel `onImport`.
- Retirer le module : supprimer `src/shared/import/` et les dossiers `import/` des outils qui l'utilisent.
  Les profils enregistrés vivent sous la clé localStorage `al.import.profiles.v1`.

## Niveaux 2 et 3

- **Niveau 2 (API)** : un connecteur produit une `RawTable` (ou des enregistrements canoniques) ;
  `ProfileStore` reçoit une implémentation serveur (profils partagés par entrepôt). Le schéma
  versionné (`id` + `version`) sert de contrat d'API.
- **Niveau 3 (EDI DESADV, connecteurs WMS)** : un nouveau lecteur transforme le message en `RawTable` ;
  correspondance, conversion et validation restent inchangées.
