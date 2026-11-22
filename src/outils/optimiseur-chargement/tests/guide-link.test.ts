import { describe, expect, it } from 'vitest';
import { decodePlan, encodePlan, guideUrl, qrTextOf, payloadLang } from '../guide/planLink';
import { qrModules, QR_MAX_MODULES, segments } from '../guide/qr';
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
    // chaque colis : dimensions posées (orientation) et position identiques au cm près
    const sorted = [...r.placedItems].sort((a, b) => a.sequence - b.sequence);
    sorted.forEach((p, i) => {
      const c = (v: number) => Math.round(v / 10) * 10;
      expect(plan.items[i]).toMatchObject({ x: c(p.x), y: c(p.y), z: c(p.z), l: c(p.length), w: c(p.width), h: c(p.height), wall: p.wall ?? 0 });
    });
  });

  it('format v2 : langue dans le lien, QR code en mode alphanumérique', async () => {
    const r = optimize(semi, [{ id: 'p', reference: 'PAL', quantity: 5, length: 1200, width: 800, height: 1500, weight: 500, rotationMode: 'HORIZONTAL', stackable: false }]);
    const payload = await encodePlan(semi, r.placedItems, () => null, 'en');
    expect(payloadLang(payload)).toBe('en');
    const url = guideUrl('https://atelierlogistique.com', payload);
    expect(url.startsWith('https://atelierlogistique.com/g#2E')).toBe(true);
    const qr = qrTextOf(url);
    expect(qr.startsWith('HTTPS://ATELIERLOGISTIQUE.COM/G#2E')).toBe(true);
    expect(segments(qr).filter(([, m]) => m === 'Alphanumeric').map(([p]) => p.length).reduce((a, b) => a + b, 0)).toBeGreaterThan(qr.length - 3);
  });

  it('les anciens liens (v1, déjà imprimés) restent lisibles', async () => {
    const json = JSON.stringify({ v: 1, n: 'Semi', c: [1360, 245, 270], r: ['A'], d: { 1: 'Lyon' }, i: [[0, 0, 0, 0, 120, 80, 150, 1, 1, 'SSCC1']] });
    const b64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const plan = await decodePlan(`j${b64}`);
    expect(plan.items[0]).toMatchObject({ ref: 'A', l: 1200, w: 800, h: 1500, unitId: 'SSCC1', destination: 'Lyon' });
  });

  it('une semi de 33 palettes donne un QR code peu dense (≤ 57 modules, version 10)', async () => {
    const r = optimize(semi, [{ id: 'p', reference: 'PALETTE-EUR', quantity: 33, length: 1200, width: 800, height: 1500, weight: 500, rotationMode: 'HORIZONTAL', stackable: false }]);
    const url = guideUrl('https://atelierlogistique.com', await encodePlan(semi, r.placedItems));
    expect(qrModules(qrTextOf(url))!).toBeLessThanOrEqual(57);
  });

  it('100 colis de 10 références restent scannables', async () => {
    const defs = Array.from({ length: 10 }, (_, k) => ({ id: `r${k}`, reference: `COLIS-${k}`, quantity: 10, length: 400 + k * 20, width: 300, height: 250 + k * 10, weight: 12, rotationMode: 'FULL' as const, stackable: true, stop: 1 + (k % 4), destination: `Client ${k % 4}` }));
    const r = optimize(semi, defs, { loading: { mode: 'WALLS' } });
    const url = guideUrl('https://atelierlogistique.com', await encodePlan(semi, r.placedItems));
    expect(qrModules(qrTextOf(url))!).toBeLessThanOrEqual(QR_MAX_MODULES);
  });

  it('lien abîmé : erreur explicite', async () => {
    await expect(decodePlan('zAAAA')).rejects.toThrow();
  });
});
