// Flotte automatique : plan pas à pas de CHAQUE véhicule, pour le lien quai permanent (/q/…?camion=N).
// Le plan 3D d'un véhicule n'est sinon calculé qu'à l'ouverture (« Voir le plan 3D ») : ici on les calcule
// tous, l'un après l'autre, dans un Web Worker (l'écran ne se fige pas), puis on les compacte (format QR).

import { optimizeWithInsights } from '../engine/optimizer';
import { encodePlan } from './planLink';
import { floorMeters } from '../engine/floorMeters';

/** Un calcul de plan dans un worker jetable (repli synchrone si les workers sont indisponibles). */
function computePlan(container, definitions, options) {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL('../worker/optimizer.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      try { resolve(optimizeWithInsights(container, definitions, options)); } catch (e) { reject(e); }
      return;
    }
    worker.onmessage = (e) => { worker.terminate(); if (e.data?.ok) resolve(e.data.result); else reject(new Error(e.data?.error || 'Erreur moteur')); };
    worker.onerror = (e) => { worker.terminate(); reject(e); };
    worker.postMessage({ container, definitions, options });
  });
}

/** Mètres plancher de chaque véhicule d'une flotte (plan 3D calculé véhicule par véhicule) : { [index]: FloorMeters }. */
export async function fleetFloors(plan, options) {
  const out = {};
  for (const t of plan.trucks) {
    const r = await computePlan(t.container, t.definitions, options);
    out[t.index] = floorMeters(r.placedItems, t.container);
  }
  return out;
}

/**
 * Guides compacts de tous les véhicules d'une flotte : [{ index, label, units, guide, floor }].
 * labelOf : libellé affiché du véhicule (traduit). Les options sont celles de « Voir le plan 3D ».
 */
export async function fleetGuides(plan, options, labelOf, lang = 'fr') {
  const out = [];
  for (const t of plan.trucks) {
    const r = await computePlan(t.container, t.definitions, options);
    const label = `${t.index}. ${labelOf(t.container)}`;
    out.push({ index: t.index, label, units: r.placedItems.length, floor: floorMeters(r.placedItems, t.container),
      guide: await encodePlan({ ...t.container, label }, r.placedItems, () => null, lang) });
  }
  return out;
}
