import { describe, it, expect } from 'vitest';
import { optimize } from '../engine/optimizer';
import { CONTAINER_PRESETS } from '../constants/containers';
import { checkPlan, moveItem, dropAt, rotateItem, removeItem, findSpot, settleItem, applyManualPlan } from '../manual/editPlan';

const semi = CONTAINER_PRESETS.find((c) => c.id === 'semi')!;
const plan = () => optimize(semi, [
  { id: 'a', reference: 'PAL', quantity: 10, length: 1200, width: 800, height: 1200, weight: 400, rotationMode: 'HORIZONTAL', stackable: false },
  { id: 'b', reference: 'CART', quantity: 6, length: 600, width: 400, height: 400, weight: 20, rotationMode: 'FULL', stackable: true },
]);

describe('modifier le plan à la main', () => {
  it('le plan calculé est valide', () => {
    const r = plan();
    expect(checkPlan(semi, r.placedItems).all.size).toBe(0);
  });

  it('déplacer un colis sur un autre : chevauchement détecté ; le reposer ailleurs : valide', () => {
    const r = plan(); const [a, b] = [...r.placedItems].sort((p, q) => p.x - q.x);
    const moved = moveItem(semi, r.placedItems, b.id, a.x - b.x, a.y - b.y, a.z - b.z);
    expect(checkPlan(semi, moved).collisions.has(b.id)).toBe(true);
    // glisser-déposer vers les portes, au sol libre : s'aimante, retombe, plus de défaut
    const free = dropAt(semi, r.placedItems, b.id, semi.length - b.length - 10, 0);
    const it = free.find((p) => p.id === b.id)!;
    expect(it.x + it.length).toBe(semi.length); // aimanté contre les portes
    expect(checkPlan(semi, free).all.size).toBe(0);
  });

  it('reste dans le contenant ; pivoter échange longueur et largeur', () => {
    const r = plan(); const p = r.placedItems[0];
    const far = moveItem(semi, r.placedItems, p.id, 1e6, 1e6, 0).find((q) => q.id === p.id)!;
    expect(far.x + far.length).toBe(semi.length);
    const rot = rotateItem(semi, r.placedItems, p.id).find((q) => q.id === p.id)!;
    expect([rot.length, rot.width]).toEqual([p.width, p.length]);
  });

  it('colis en l’air et posé sur un non gerbable détectés ; « Poser » le fait retomber', () => {
    const r = plan(); const pal = r.placedItems.find((p) => p.reference === 'PAL')!;
    const up = moveItem(semi, r.placedItems, pal.id, 0, 0, 500);
    expect(checkPlan(semi, up).floating.has(pal.id)).toBe(true);
    expect(checkPlan(semi, settleItem(up, pal.id)).all.size).toBe(0);
    const cart = r.placedItems.find((p) => p.reference === 'CART')!;
    const onPal = r.placedItems.map((p) => (p.id === cart.id ? { ...p, x: pal.x, y: pal.y, z: pal.z + pal.height } : p));
    expect(checkPlan(semi, onPal).stacking.has(cart.id)).toBe(true);
  });

  it('retirer puis replacer à la première place libre ; indicateurs recalculés', () => {
    const r = plan(); const p = r.placedItems[0];
    const { placed, removed } = removeItem(r.placedItems, p.id);
    const res = applyManualPlan(r, placed, [removed!]);
    expect(res.packedItems).toBe(r.packedItems - 1);
    expect(res.unpackedCount).toBe(r.unpackedCount + 1);
    expect(res.usedWeight).toBeCloseTo(r.usedWeight - p.weight);
    const spot = findSpot(semi, placed, removed!)!;
    expect(spot).not.toBeNull();
    expect(checkPlan(semi, [...placed, spot]).all.size).toBe(0);
    const back = applyManualPlan(r, [...placed, spot], [], new Set([p.id]));
    expect(back.placedItems.map((q) => q.sequence)).toEqual(back.placedItems.map((_, i) => i + 1));
  });
});
