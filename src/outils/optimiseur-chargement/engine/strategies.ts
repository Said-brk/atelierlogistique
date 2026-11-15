import type { ItemInstance } from './types';

// Ordres de traitement des unités. Le moteur essaie chaque stratégie et
// conserve le meilleur résultat (cf. cahier des charges §18).
export interface Strategy {
  id: string;
  compare: (a: ItemInstance, b: ItemInstance) => number;
}

const volume = (i: ItemInstance): number => i.dimensions.length * i.dimensions.width * i.dimensions.height;
const footprint = (i: ItemInstance): number => i.dimensions.length * i.dimensions.width;
const maxDimension = (i: ItemInstance): number =>
  Math.max(i.dimensions.length, i.dimensions.width, i.dimensions.height);

export const STRATEGIES: Strategy[] = [
  { id: 'volume-desc', compare: (a, b) => volume(b) - volume(a) },
  { id: 'footprint-desc', compare: (a, b) => footprint(b) - footprint(a) },
  { id: 'height-desc', compare: (a, b) => b.dimensions.height - a.dimensions.height },
  { id: 'weight-desc', compare: (a, b) => b.weight - a.weight },
  { id: 'maxdim-desc', compare: (a, b) => maxDimension(b) - maxDimension(a) },
];
