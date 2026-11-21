import { planFleet, type FleetVehicle } from '../engine/fleet';
import type { ItemDefinition, OptimizeOptions } from '../engine/types';

interface RequestMessage { definitions: ItemDefinition[]; vehicles: FleetVehicle[]; options?: OptimizeOptions; }

// Calcul de flotte hors du thread principal (plusieurs passages du moteur 3D).
self.onmessage = (e: MessageEvent<RequestMessage>) => {
  try {
    const { definitions, vehicles, options } = e.data;
    (self as unknown as Worker).postMessage({ ok: true, plan: planFleet(definitions, vehicles, options) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
