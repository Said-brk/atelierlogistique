# Palettisation 3D

Des colis aux palettes, puis envoi en un clic vers l'optimiseur de chargement.

```
Palletizer.jsx            interface (tableau colis partagé, assistant d'import, résultats, fiche, CSV, envoi)
engine/layerPattern.ts    plan de couche (guillotine, motifs croisés), centrage, couche retournée 180°
engine/palletize.ts       moteur : palettes complètes puis palettes mixtes (moteur 3D de l'optimiseur)
engine/toLoad.ts          palettes → enregistrements « colis » (schéma atelier-logistique/colis)
engine/presets.ts         supports courants (EUR, EUR3, demi, GMA, Asie) avec tare
```

## Règles

1. **Palettes complètes mono-référence** : meilleure orientation autorisée, meilleur plan de couche,
   couches limitées par la hauteur totale, la charge maxi et l'empilage (non gerbable / au sol = 1 couche).
   Couches alternées à 180° et charge centrée.
2. **Reliquats → palettes mixtes** : moteur 3D de l'optimiseur de chargement (support ≥ 80 %, rien sur un
   colis non gerbable, rotations, poids), avec un score qui remplit couche par couche (palette basse).
3. **Une palette = un arrêt** (option) : pas de dépalettisation au déchargement.
4. Poids palette = charge + tare ; hauteur = plateau + charge.

## Lien avec l'optimiseur de chargement

`palletsToLoadRecords` produit des enregistrements au format du schéma colis (`COLIS_SCHEMA`), envoyés via
`src/shared/handoff` (sessionStorage, lecture unique). L'optimiseur les reçoit à l'ouverture : une ligne par
type de palette, quantité = nombre de palettes, n° PAL conservés (repris dans l'export de séquence).
Gerbage au camion : automatique (gerbable si tous les colis acceptent une charge) ou forcé.

## Supprimer

Retirer l'entrée `pallet` dans `TOOL_COMPONENTS` / `TOOLS` (src/App.jsx) et le dossier `src/outils/palettisation/`.
L'optimiseur n'en dépend pas (il lit simplement un éventuel message de transfert).
