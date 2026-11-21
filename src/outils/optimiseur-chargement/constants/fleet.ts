import type { ContainerDefinition } from '../engine/types';
import { CONTAINER_PRESETS } from './containers';

// Véhicules proposés au mode « Flotte automatique ». Dimensions intérieures et charges
// utiles indicatives (mm, kg), coûts par voyage indicatifs (€) : tout est modifiable
// dans l'outil et mémorisé dans le navigateur. Le mode standard n'utilise pas cette liste.
export interface FleetVehicleOption {
  container: ContainerDefinition;
  cost: number;          // € par voyage
  enabled: boolean;      // proposé par défaut
}

const ROAD: ContainerDefinition[] = [
  { id: 'fourgon20', label: 'Fourgon 20 m³', length: 4300, width: 2050, height: 2250, maxWeight: 1100 },
  { id: 'porteur12', label: 'Porteur 12 t', length: 6200, width: 2450, height: 2400, maxWeight: 5500 },
  { id: 'porteur19', label: 'Porteur 19 t', length: 7300, width: 2450, height: 2500, maxWeight: 9500 },
];

const preset = (id: string) => CONTAINER_PRESETS.find((c) => c.id === id)!;

export const DEFAULT_FLEET: FleetVehicleOption[] = [
  { container: ROAD[0], cost: 250, enabled: true },
  { container: ROAD[1], cost: 380, enabled: false },
  { container: ROAD[2], cost: 480, enabled: true },
  { container: preset('semi'), cost: 650, enabled: true },
  { container: preset('20ft'), cost: 900, enabled: false },
  { container: preset('40ft'), cost: 1300, enabled: false },
  { container: preset('40hc'), cost: 1400, enabled: false },
];
