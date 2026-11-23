// Plans enregistrés dans l'espace (jsonb) : ils doivent revenir identiques après un aller-retour JSON,
// sinon un chargement rouvert n'afficherait pas le même plan que celui validé.
import { describe, it, expect } from 'vitest';
import { optimizeWithInsights } from '../engine/optimizer';
import { CONTAINER_PRESETS } from '../constants/containers';
import { applyManualPlan, removeItem } from '../manual/editPlan';
import { palletizeMulti } from '../../palettisation/engine/palletize';
import { DEFAULT_PALLET } from '../../palettisation/engine/presets';

const roundTrip = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const semi = CONTAINER_PRESETS.find((c) => c.id === 'semi')!;

describe('plan enregistré', () => {
  it('le plan de chargement et les retouches survivent à l’enregistrement', () => {
    const base = optimizeWithInsights(semi, [
      { id: 'a', reference: 'PAL', quantity: 8, length: 1200, width: 800, height: 1200, weight: 400, rotationMode: 'HORIZONTAL', stackable: false },
      { id: 'b', reference: 'CART', quantity: 12, length: 600, width: 400, height: 400, weight: 20, rotationMode: 'FULL', stackable: true, stop: 2 },
    ], { deliveryMode: 'STRICT' });
    expect(roundTrip(base)).toEqual(base);
    const { placed, removed } = removeItem(base.placedItems, base.placedItems[0].id);
    const manual = { placed, staged: [removed!], touched: [] as string[] };
    const saved = roundTrip({ base, manual });
    const again = applyManualPlan(saved.base, saved.manual.placed, saved.manual.staged, new Set(saved.manual.touched));
    expect(again).toEqual(applyManualPlan(base, placed, [removed!], new Set()));
  });

  it('le résultat de la palettisation survit à l’enregistrement', () => {
    const r = palletizeMulti([{ id: 'a', reference: 'C', quantity: 70, length: 400, width: 300, height: 250, weight: 8, rotationMode: 'HORIZONTAL', stackable: true }], [DEFAULT_PALLET]);
    expect(roundTrip(r)).toEqual(r);
  });
});
