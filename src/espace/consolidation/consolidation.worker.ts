// Analyse des regroupements hors du thread principal (le moteur 3D tourne plusieurs fois).
import { analyzeDay, type DayShipment } from './engine';
import type { FleetVehicle } from '../../outils/optimiseur-chargement/engine/fleet';

self.onmessage = (e: MessageEvent<{ shipments: DayShipment[]; vehicles: FleetVehicle[] }>) => {
  const post = (m: unknown) => (self as unknown as Worker).postMessage(m);
  try {
    const analysis = analyzeDay(e.data.shipments, e.data.vehicles, { onProgress: (done, total) => post({ progress: [done, total] }) });
    post({ ok: true, analysis });
  } catch (err) {
    post({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
