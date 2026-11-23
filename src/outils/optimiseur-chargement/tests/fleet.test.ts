import { describe, expect, it } from 'vitest';
import { planFleet, type FleetVehicle } from '../engine/fleet';
import { DEFAULT_FLEET } from '../constants/fleet';
import type { ItemDefinition } from '../engine/types';

const veh = (id: string): FleetVehicle => {
  const o = DEFAULT_FLEET.find((v) => v.container.id === id)!;
  return { container: o.container, cost: o.cost };
};
const SEMI = veh('semi'), P19 = veh('porteur19'), VAN = veh('fourgon20');
const OPTS = { deliveryMode: 'STRICT' as const, loading: { mode: 'WALLS' as const } };

const pal = (o: Partial<ItemDefinition> = {}): ItemDefinition => ({
  id: 'p', reference: 'PAL', quantity: 1, length: 1200, width: 800, height: 1400, weight: 400,
  rotationMode: 'HORIZONTAL', stackable: false, stop: 1, ...o,
});

describe('flotte automatique', () => {
  it('peu de marchandise : le petit véhicule le moins cher', () => {
    const r = planFleet([pal({ quantity: 2, weight: 300 })], [VAN, P19, SEMI], OPTS);
    expect(r.trucks.map((t) => t.vehicleId)).toEqual(['fourgon20']);
    expect(r.totalCost).toBe(250);
  });

  it('33 palettes : une semi plutôt que plusieurs porteurs, avec comparaison', () => {
    const r = planFleet([pal({ quantity: 33, weight: 600 })], [P19, SEMI], OPTS);
    expect(r.trucks).toHaveLength(1);
    expect(r.trucks[0].vehicleId).toBe('semi');
    const alt = r.alternatives.find((a) => a.vehicleId === 'porteur19')!;
    expect(alt.count).toBeGreaterThan(1);
    expect(alt.cost).toBeGreaterThan(r.totalCost);
  });

  it('trop pour une semi : arrêt découpé, rien de perdu', () => {
    const r = planFleet([pal({ quantity: 50, weight: 300 })], [SEMI], OPTS);
    expect(r.trucks.length).toBe(2);
    expect(r.trucks.reduce((s, t) => s + t.units, 0)).toBe(50);
    expect(r.trucks.some((t) => t.split)).toBe(true);
    expect(r.unplaced).toHaveLength(0);
  });

  it('tournée : arrêts consécutifs regroupés, chaque arrêt entier dans un véhicule', () => {
    const defs = [1, 2, 3, 4].map((s) => pal({ id: `s${s}`, reference: `S${s}`, quantity: 9, weight: 500, stop: s, destination: `Client ${s}` }));
    const r = planFleet(defs, [P19, SEMI], OPTS);
    const allStops = r.trucks.flatMap((t) => t.stops);
    expect(allStops.sort()).toEqual([1, 2, 3, 4]);
    for (const t of r.trucks) {
      // suite consécutive
      for (let i = 1; i < t.stops.length; i++) expect(t.stops[i]).toBe(t.stops[i - 1] + 1);
    }
    expect(r.trucks.reduce((s, t) => s + t.units, 0)).toBe(36);
  });

  it('colis hors gabarit signalé', () => {
    const r = planFleet([pal({ length: 15000, rotationMode: 'NONE' })], [VAN, SEMI], OPTS);
    expect(r.unplaced).toHaveLength(1);
    expect(r.trucks).toHaveLength(0);
  });
});

import { defaultAxleProfile } from '../engine/balance';
describe('essieux des porteurs', () => {
  it('profil à deux essieux pour les véhicules de la flotte, conteneurs inchangés', () => {
    expect(defaultAxleProfile(P19.container).kind).toBe('TWO_SUPPORTS');
    expect(defaultAxleProfile(DEFAULT_FLEET.find((v) => v.container.id === '20ft')!.container).kind).toBe('CONTAINER');
  });
});

describe('flotte : pas de véhicule en trop', () => {
  // Cas réel : 8 palettes, 3 arrêts, fourgons 20 m³ seulement (1 100 kg). Le poids impose au moins 3 fourgons
  // (2 880 kg) ; avant, l'ordre strict des arrêts entre véhicules en faisait 4 (arrêt 3 seul dans un fourgon à 6 %).
  const p = (id: string, length: number, width: number, height: number, weight: number, stop: number, quantity = 1): ItemDefinition => ({
    id, reference: id, quantity, length, width, height, weight, rotationMode: 'HORIZONTAL', stackable: false, floorOnly: true, stop, destination: ['', 'Nanterre', 'Massy', 'Créteil'][stop],
  });
  const defs = [
    p('a', 1200, 1000, 1644, 510, 1), p('b', 1200, 1000, 1644, 380, 1), p('c', 1200, 1000, 1594, 390, 1), p('d', 1200, 1000, 1144, 350, 1),
    p('e', 1200, 800, 444, 73, 2, 2), p('f', 1200, 800, 1644, 799, 2), p('g', 1200, 800, 1144, 305, 3),
  ];

  it('3 fourgons au lieu de 4, tout chargé, poids respecté', () => {
    const r = planFleet(defs, [VAN], OPTS);
    expect(r.unplaced).toHaveLength(0);
    expect(r.trucks.reduce((s, t) => s + t.units, 0)).toBe(8);
    expect(r.trucks.every((t) => t.weight <= 1100)).toBe(true);
    expect(r.trucks).toHaveLength(3);
    expect(r.totalCost).toBe(750);
  });

  it('un véhicule peut servir des arrêts non consécutifs (les autres sont livrés par un autre véhicule)', () => {
    const r = planFleet(defs, [VAN], OPTS);
    // chaque véhicule garde ses arrêts dans l'ordre de la tournée
    for (const t of r.trucks) expect([...t.stops].sort((a, b) => a - b)).toEqual(t.stops);
  });
});

describe('flotte : temps de calcul', () => {
  it('10 arrêts, 3 types de véhicules : résultat en quelques secondes au plus', () => {
    const defs = Array.from({ length: 10 }, (_, i) => pal({ id: `s${i}`, reference: `S${i}`, quantity: 3, weight: 350, stop: i + 1 }));
    const t0 = Date.now();
    const r = planFleet(defs, [VAN, P19, SEMI], OPTS);
    expect(Date.now() - t0).toBeLessThan(8000);
    expect(r.trucks.reduce((s, t) => s + t.units, 0)).toBe(30);
  }, 20000);
});
