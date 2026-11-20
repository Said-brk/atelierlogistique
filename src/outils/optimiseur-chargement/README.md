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
    loading.ts       chargement par murs, chargeabilité, hauteurs de manutention
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

## Chargement physique : murs, chargeabilité, hauteurs (engine/loading.ts)

- `loading.mode` : `WALLS` (par murs, de la cabine vers les portes) ou `FREE`
  (historique, remplissage maximal). Sans option, le moteur reste en `FREE`.
- En `WALLS`, un colis n'est placé que si rien de déjà chargé ne se trouve entre
  lui et les portes sur sa section YZ ; on remplit le mur courant puis on avance
  de `wallDepth` (auto = plus grande dimension au sol).
- `loadingViolationIds` : colis à poser par-dessus d'autres en suivant la
  séquence (toujours vide en `WALLS`, signalés en `FREE`).
- Hauteurs de manutention (moteur uniquement, non exposées dans l’UI) : `manualMaxHeight`, `heavyMaxHeight`
  (1 500 mm au-delà de `heavyThresholdKg` = 15 kg), sans limite au-delà de
  `mechanizedAboveKg` = 25 kg (engin). Valeurs par défaut de l'UI :
  `LOADING_DEFAULTS`.
- `optimizeWithInsights` chiffre le coût des limites de hauteur
  (`heightLimitCost`) quand tout ne rentre pas.
- Chaque `PlacedItem` porte `sequence` (ordre de chargement) et `wall`.

## Répartition des charges et arrimage (engine/balance.ts)

Contrôle a posteriori, sans modifier le placement :
- centre de gravité de la charge, décalage latéral ;
- semi-remorque (2 appuis : sellette + essieux) : charge reportée sur chaque appui
  par bras de levier, zone conseillée du CdG, limites réglables (indicatives) ;
- conteneur : excentricité longitudinale ≤ ±5 % (CTU Code) ;
- tournées : état après chaque livraison ;
- arrimage par friction EN 12195-1 : sangles par mur (µ, STF, angle, blocage avant).
Réglages pré-remplis par véhicule dans « Essieux et arrimage », mémorisés.

## Échange avec un ERP / WMS (niveau 1 : fichiers)

L'import repose sur le module partagé `src/shared/import` (voir son README). Spécifique à l'outil :
`import/colisSchema.ts` (schéma = format standard) et `import/exportSequence.ts`.

**Format standard Atelier Logistique v1 — colis à charger** (CSV `;`, UTF-8, virgule décimale) :

| Colonne | Obligatoire | Valeurs |
|---|---|---|
| Référence | oui | code article ou libellé |
| Quantité | non (1) | entier |
| Longueur / Largeur / Hauteur | oui | cm par défaut ; `mm`, `cm` ou `m` reconnus dans l'en-tête, ex. `Longueur (mm)` |
| Poids | non | kg par défaut ; `g`, `kg`, `t` reconnus |
| Rotation | non (Horizontale) | Libre, Horizontale, Interdite |
| Empilage | non (Libre) | Libre, Dessus uniquement, Au sol, Au sol rien dessus ; ou Oui / Non |
| Arrêt | non (1) | numéro (1 = livré en premier) ou nom du client |
| Destination | non | texte |
| N° support (SSCC) | non | identifiant de l'unité, repris à l'export |

Tout autre format (export Reflex, SAP, D365, Sage…) s'importe via la correspondance de colonnes,
mémorisée en **profil** et reconnue automatiquement aux imports suivants.

**Export de la séquence de chargement** (bouton CSV du résultat) : une ligne par colis, dans l'ordre
de chargement — séquence, mur, arrêt, destination, référence, SSCC, position X/Y/Z (cm depuis cabine,
gauche, plancher), dimensions placées, poids, pivoté ; les colis non chargés suivent avec le statut
« Non chargé ».

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
