# Optimiseur de chargement 3D

Outil `/outils/optimiseur-chargement` : place un ensemble de marchandises
(cartons, colis, palettes) dans un camion ou un conteneur et produit un plan
de chargement 3D. 100 % navigateur, sans compte, sans backend.

## Architecture

```
optimiseur-chargement/
  engine/            moteur pur, aucune dépendance React / Three.js
    types.ts         modèles (ItemDefinition, ItemInstance, PlacedItem, ContainerDefinition, OptimizationResult)
    rotations.ts     orientations autorisées (NONE / HORIZONTAL / FULL)
    collision.ts     intersection de boîtes, limites du contenant
    support.ts       surface de contact, support ≥ 80 %, non-empilable
    scoring.ts       score d'un emplacement (sol, origine, support, contact)
    strategies.ts    5 ordres de tri des unités
    delivery.ts      tournées multi-arrêts : règle LIFO, colis bloqués, synthèse par arrêt
    optimizer.ts     heuristique extreme points + index spatial + multi-stratégies
  constants/
    containers.ts    presets (semi, 20', 40', 40' HC), en mm
    engine-config.ts MIN_SUPPORT_RATIO, DEFAULT_ITERATIONS, EPS, coefficients de score
  worker/
    optimizer.worker.ts   exécute le moteur hors du thread UI
  tests/             collision, rotations, support, scénarios métier
  useOptimizer.js    hook : pilote le worker (repli synchrone)
  uiHelpers.js       conversions cm↔mm, validation, couleurs, exemple
  analytics.js       événements anonymes (gtag / Plausible si présents)
  LoadOptimizer.jsx  page (formulaire, contenant, résultats, SEO)
  LoadView3D.jsx     visualisation Three.js (chargée à la demande)
```

Le moteur reçoit `(ContainerDefinition, ItemDefinition[])` et renvoie un
`OptimizationResult`. Il ne connaît ni React ni Three.js : réutilisable pour une
API, un export PDF ou un backend.

## Algorithme

Heuristique **Extreme Points** (bin packing 3D) :

1. les unités sont dépliées (une par quantité) puis triées selon plusieurs
   stratégies (volume, empreinte, hauteur, poids, plus grande dimension) ;
2. pour chaque stratégie, une passe place les unités une à une sur des points
   candidats (initialement l'origine ; à chaque pose on ajoute droite / arrière /
   dessus) ;
3. chaque emplacement est validé (dans le contenant, sans collision, supporté à
   ≥ 80 %, pas au-dessus d'un non-empilable, poids max respecté) puis **scoré** ;
4. le meilleur emplacement (score le plus bas) est retenu ;
5. le meilleur résultat entre toutes les stratégies est conservé
   (`compareOptimizationResults` : articles placés, volume, poids, compacité).

Un **index spatial** (tranches le long de l'axe longueur) limite les tests de
collision/support aux voisins. Au-delà de 400 unités, le nombre de stratégies
est réduit et un budget de temps (~6 s) borne le calcul.

Repère : X = longueur du contenant, Y = largeur, Z = hauteur ; origine à l'angle
inférieur avant gauche. Unités internes : millimètres et kilogrammes.

## Tournées multi-arrêts (LIFO)

Chaque référence peut porter un **arrêt** (`stop`, 1 = livré en premier) et une
**destination** facultative. Les portes sont à l'arrière (X = longueur).

- Les unités sont triées par arrêt **décroissant** : le dernier arrêt est chargé
  au fond, le premier côté portes. Les stratégies de tri s'appliquent à
  l'intérieur de chaque arrêt.
- Règle d'accessibilité (`engine/delivery.ts`) : un colis livré tôt ne doit
  avoir, ni devant lui (côté portes, même section YZ) ni au-dessus de lui, un
  colis d'un arrêt ultérieur.
- `deliveryMode` : `STRICT` (par défaut, règle absolue : ce qui ne la respecte
  pas reste non chargé) ou `SOFT` (pénalité `DELIVERY.blockedPenalty`, colis
  bloqués listés dans `blockedItemIds`).
- Le résultat expose `stops` (synthèse par arrêt). En cas de dépassement, l'UI
  propose de **retirer l'arrêt entier** (recalcul) ou de **reporter seulement
  les colis en excès**, avec export Excel des reliquats.
- Sans arrêt renseigné, le comportement est strictement identique au mono-destination.

## Tests

```bash
npm test          # Vitest, 27 tests
npm run typecheck  # TypeScript strict
```

Couverture : collision (faces jointives ≠ collision), rotations (3 modes +
dédoublonnage), support/empilabilité, et scénarios métier A–D du cahier des
charges + invariants (poids, conservation des quantités, pas de chevauchement,
pas de flottement, déterminisme).

## Performance (mesurée)

| Unités | Temps   | Placés   |
|--------|---------|----------|
| 100    | ~0,3 s  | 100/100  |
| 500    | ~3,4 s  | 500/500  |
| 1000   | ~7 s    | 1000/1000|

Calcul dans un Web Worker : l'interface ne se fige jamais.

## Limites connues (V1)

- Heuristique gloutonne guillotine-free : pas d'optimum garanti, mais résultats
  denses et stables.
- Formes rectangulaires uniquement (pas de cylindres ni formes libres).
- Pas de gestion du poids supporté par colis, du centre de gravité ni des essieux.
- La vue par défaut cadre tout le contenant : sur un semi peu rempli, les colis
  apparaissent petits (zoom/orbite disponibles).

## Recommandations V2

- `maxStackWeight`, `fragile`, `mustStayUpright`, `priority`, `deliverySequence`,
  `group` / `incompatibleGroups`, `centerOfGravity`, contraintes d'essieux
  (les champs sont déjà anticipés dans le modèle).
- Multi-contenants automatique, import Excel, export PDF du plan, estimation
  économique (nombre de véhicules supplémentaires par ré-optimisation réelle).
- Accélération supplémentaire (grille 3D complète, réduction des candidats) pour
  viser < 1 s à 1000 unités.
