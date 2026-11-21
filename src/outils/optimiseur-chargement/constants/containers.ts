import type { ContainerDefinition } from '../engine/types';
import { N_ } from '../../../shared/i18n/core';

// Dimensions intérieures approximatives, en millimètres ; poids utile en kg.
// Valeurs centralisées et facilement modifiables (cf. cahier des charges §12).
export const CONTAINER_PRESETS: ContainerDefinition[] = [
  { id: 'semi', label: N_('Semi-remorque standard'),        length: 13600, width: 2450, height: 2700, maxWeight: 24000 },
  { id: '20ft', label: N_('Conteneur 20 pieds'),            length: 5900,  width: 2350, height: 2390, maxWeight: 28000 },
  { id: '40ft', label: N_('Conteneur 40 pieds'),            length: 12030, width: 2350, height: 2390, maxWeight: 26500 },
  { id: '40hc', label: N_('Conteneur 40 pieds High Cube'),  length: 12030, width: 2350, height: 2690, maxWeight: 26500 },
];

export function getContainerPreset(id: string): ContainerDefinition | undefined {
  return CONTAINER_PRESETS.find((c) => c.id === id);
}
