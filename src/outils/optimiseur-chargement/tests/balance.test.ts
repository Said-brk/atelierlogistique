import { describe, it, expect } from 'vitest';
import { analyzeBalance, defaultAxleProfile, massPerStrap, snapshot, DEFAULT_LASHING } from '../engine/balance';
import { optimize } from '../engine/optimizer';
import type { ContainerDefinition, PlacedItem } from '../engine/types';

const semi: ContainerDefinition = { id: 'semi', label: 'Semi', length: 13600, width: 2450, height: 2700, maxWeight: 24000 };
const c20: ContainerDefinition = { id: '20ft', label: '20', length: 5900, width: 2350, height: 2390, maxWeight: 28000 };

const pal = (id: string, x: number, weight: number, stop = 1, wall = 1, y = 0): PlacedItem => ({
  id, definitionId: 'd', reference: 'P', x, y, z: 0, length: 1200, width: 800, height: 1400,
  originalLength: 1200, originalWidth: 800, originalHeight: 1400, rotation: { x: 0, y: 0, z: 0 },
  weight, stackable: false, stop, destination: '', sequence: 1, wall,
});

describe('Centre de gravité et appuis (semi-remorque)', () => {
  const profile = defaultAxleProfile(semi);

  it('bras de levier : CdG au milieu des appuis → moitié / moitié', () => {
    const mid = (profile.frontPos + profile.rearPos) / 2;
    const s = snapshot(semi, [pal('a', mid - 600, 10000, 1, 1, 825)], profile);
    expect(s.supports!.front).toBeCloseTo(5000, 3);
    expect(s.supports!.rear).toBeCloseTo(5000, 3);
    expect(s.weight).toBe(10000);
  });

  it('charge lourde contre la face avant → surcharge de la sellette', () => {
    const s = snapshot(semi, [pal('a', 0, 12000, 1, 1, 825)], profile);
    expect(s.supports!.front).toBeGreaterThan(profile.frontMax);
    expect(s.status).toBe('over');
  });

  it('zone conseillée cohérente pour 24 t (≈ 5,3 à 7 m de la face avant)', () => {
    const s = snapshot(semi, [pal('a', 5600, 24000, 1, 1, 825)], profile);
    expect(s.supports!.zone!.from).toBeCloseTo(1000 + 8000 * 13 / 24, 0);
    expect(s.supports!.zone!.to).toBeCloseTo(1000 + 8000 * 18 / 24, 0);
  });

  it('petite charge devant la sellette : pas de faux « hors limites »', () => {
    const s = snapshot(semi, [pal('a', 0, 1500, 1, 1, 825)], profile);
    expect(s.supports!.rear).toBeLessThan(0);
    expect(s.status).toBe('ok');
  });

  it('décalage latéral > 5 % → avertissement', () => {
    const s = snapshot(semi, [pal('a', 5000, 2000, 1, 1, 0)], profile);
    expect(Math.abs(s.lateralPct)).toBeGreaterThan(0.05);
    expect(s.status).not.toBe('ok');
  });
});

describe('Conteneur : excentricité ±5 % (CTU Code)', () => {
  const profile = defaultAxleProfile(c20);
  it('centré → ok, en bout → hors tolérance', () => {
    expect(snapshot(c20, [pal('a', 2350, 5000, 1, 1, 775)], profile).status).toBe('ok');
    expect(snapshot(c20, [pal('a', 0, 5000, 1, 1, 775)], profile).status).toBe('over');
  });
});

describe('Arrimage par friction (EN 12195-1)', () => {
  it('reproduit l\'exemple du guide : µ 0,30, STF 400 daN, 90° → ≈ 391 kg par sangle vers l\'avant', () => {
    expect(massPerStrap(0.8, 1.25, DEFAULT_LASHING)!).toBeCloseTo(391, 0);
  });
  it('µ ≥ 0,5 : le frottement suffit latéralement, minimum une sangle par mur', () => {
    const r = analyzeBalance(semi, [pal('a', 0, 3000)], defaultAxleProfile(semi), { ...DEFAULT_LASHING, mu: 0.6 });
    expect(r.lashing.perStrapKg).toBeNull();
    expect(r.lashing.total).toBe(1);
  });
  it('nombre de sangles par mur = masse / masse retenue par sangle', () => {
    const r = analyzeBalance(semi, [pal('a', 0, 3000, 1, 1), pal('b', 1200, 1000, 1, 2)]);
    const per = r.lashing.perStrapKg!;
    expect(r.lashing.walls[0].straps).toBe(Math.ceil(3000 / per));
    expect(r.lashing.walls[1].straps).toBe(Math.max(1, Math.ceil(1000 / per)));
  });
});

describe('Tournée : équilibre après chaque livraison', () => {
  it('un état par arrêt livré (sauf le dernier)', () => {
    const placed = [pal('a', 0, 3000, 3), pal('b', 4000, 3000, 2), pal('c', 10000, 3000, 1)];
    const r = analyzeBalance(semi, placed);
    expect(r.afterStops.map((s) => s.stop)).toEqual([1, 2]);
    expect(r.afterStops[1].weight).toBe(3000);
  });

  it('ne modifie pas le plan de chargement', () => {
    const res = optimize(semi, [{ id: 'x', reference: 'X', quantity: 20, length: 600, width: 400, height: 400, weight: 12, rotationMode: 'FULL', stackable: true }]);
    const before = JSON.stringify(res.placedItems);
    analyzeBalance(semi, res.placedItems);
    expect(JSON.stringify(res.placedItems)).toBe(before);
  });
});
