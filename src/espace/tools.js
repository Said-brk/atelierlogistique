// Outils du site dans l'espace connecté : mêmes composants que les pages publiques (catalogue de App.jsx).
// Ils fonctionnent dans le navigateur : rien n'est enregistré dans l'espace (sauf chargements et palettisations,
// qui ont leurs propres pages). L'Audit Flash s'ajoute au catalogue.

import { Zap } from 'lucide-react';
import { TOOLS, CATEGORIES } from '../App.jsx';

/** Outils déjà intégrés autrement (Chargements, Palettisations) : pas répétés dans « Outils ». */
const IN_OPERATIONS = new Set(['pallet', 'optimiseur-chargement']);

export const APP_TOOLS = [
  ...TOOLS.filter((t) => t.status === 'live' && !IN_OPERATIONS.has(t.id)),
  { id: 'audit', cat: 'planification', name: 'Audit Flash', icon: Zap, desc: 'Diagnostic supply chain en 5 minutes : ABC×XYZ, stock dormant, OTIF, couverture, Health Score.', status: 'live' },
];

/** Catégories (sous-sections) et leurs outils, dans l'ordre du site. */
export const TOOL_GROUPS = CATEGORIES
  .map((c) => ({ ...c, tools: APP_TOOLS.filter((t) => t.cat === c.id) }))
  .filter((g) => g.tools.length > 0);
