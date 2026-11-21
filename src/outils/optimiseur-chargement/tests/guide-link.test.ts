import { describe, expect, it } from 'vitest';
import { decodePlan, encodePlan, guideUrl, QR_MAX_URL } from '../guide/planLink';
import { optimize } from '../engine/optimizer';
import { CONTAINER_PRESETS } from '../constants/containers';

const semi = CONTAINER_PRESETS.find((c) => c.id === 'semi')!;

describe('lien du guide cariste', () => {
  it('aller-retour : séquence, positions (au cm), arrêts, identifiants', async () => {
    const r = optimize(semi, [
      { id: 'a', reference: 'PAL-A', quantity: 10, length: 1200, width: 800, height: 1400, weight: 400, rotationMode: 'HORIZONTAL', stackable: false, stop: 2, destination: 'Massy' },
      { id: 'b', reference: 'PAL-B', quantity: 6, length: 1200, width: 800, height: 1000, weight: 300, rotationMode: 'HORIZONTAL', stackable: false, stop: 1, destination: 'Nanterre' },
    ], { loading: { mode: 'WALLS' } });
    const payload = await encodePlan(semi, r.placedItems, (p) => `SSCC-${p.id}`);
    const plan = await decodePlan(payload);
    expect(plan.items).toHaveLength(16);
    const first = [...r.placedItems].sort((a, b) => a.sequence - b.sequence)[0];
    expect(plan.items[0]).toMatchObject({ ref: first.reference, x: Math.round(first.x / 10) * 10, stop: first.stop, unitId: `SSCC-${first.id}` });
    expect(plan.items.find((i) => i.stop === 2)?.destination).toBe('Massy');
    expect(plan.container.length).toBe(13600);
  });

  it('une semi de 33 palettes tient dans un QR code', async () => {
    const r = optimize(semi, [{ id: 'p', reference: 'PALETTE-EUR', quantity: 33, length: 1200, width: 800, height: 1500, weight: 500, rotationMode: 'HORIZONTAL', stackable: false }]);
    const url = guideUrl('https://atelierlogistique.com', await encodePlan(semi, r.placedItems));
    expect(url.length).toBeLessThan(QR_MAX_URL);
  });

  it('lien abîmé : erreur explicite', async () => {
    await expect(decodePlan('zAAAA')).rejects.toThrow();
  });
});
