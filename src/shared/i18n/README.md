# i18n — interface FR / EN

- **Clé = texte français** : `t('Arrêt {stop}', { stop })`. En français la clé s'affiche telle quelle ; un texte non traduit reste lisible.
- **Langue = route** : `/outils/<id>` (FR) · `/en/truck-load-planner`, `/en/palletizing-calculator`, `/en/loading` (EN). `I18nProvider` la fixe pour l'outil.
- **Dictionnaires par module** : `src/shared/import/i18n.en.ts`, `src/outils/optimiseur-chargement/i18n.en.ts`, `src/outils/palettisation/i18n.en.ts`, réunis dans `dictionaries.ts`.
- **Listes de constantes** : `N_('Libre')` marque le texte, `tText(label)` le traduit à l'affichage. Même chose pour les messages calculés dans un worker.
- **Formats** : `numLocale()` pour `toLocaleString` (1 234,5 / 1,234.5).
- **Test** : `i18n.test.ts` repère toute clé `t()` / `N_()` sans traduction ou dont les variables `{x}` diffèrent.

Ajouter une langue : un type `Lang`, un dictionnaire par module, une adresse dans `paths.ts`.
Traduire un autre outil : entourer ses textes de `t()`, créer son `i18n.en.ts`, l'ajouter au test (MODULES) et à `TOOL_PATHS`.
