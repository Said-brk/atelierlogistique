import { describe, it, expect } from 'vitest';
import { floorMeters, taxableWeight } from './floorMeters';

const semi = { id: 'semi', label: 'Semi', length: 13600, width: 2450, height: 2700, maxWeight: 24000 };
const pal = (i: number, x: number, y: number, z = 0) => ({
  id: `p${i}`, definitionId: 'd', reference: 'PAL', x, y, z, length: 1200, width: 800, height: 1200,
  originalLength: 1200, originalWidth: 800, originalHeight: 1200, rotation: { x: 0, y: 0, z: 0 },
  weight: 120, stackable: true, stop: 1, destination: '', sequence: i, wall: 1,
});

describe('mètres plancher et poids taxable', () => {
  it('palette Europe = 0,4 MPL ; un colis gerbé ne compte pas ; longueur occupée', () => {
    const placed = [pal(1, 0, 0), pal(2, 0, 800), pal(3, 1200, 0), pal(4, 1200, 0, 1200)];
    const f = floorMeters(placed, semi);
    expect(f.ldm).toBeCloseTo(1.2, 5);
    expect(f.floorItems).toBe(3);
    expect(f.stackedItems).toBe(1);
    expect(f.occupiedLength).toBeCloseTo(2.4, 5);
    expect(f.containerLength).toBe(13.6);
  });

  it('25 palettes Europe non gerbables de 120 kg : facturées au plancher (10 MPL × 1 750 kg)', () => {
    const t = taxableWeight({ weightKg: 3000, volumeM3: 37.5, ldm: 10 });
    expect(t.floor).toBe(17500);
    expect(t.volumetric).toBeCloseTo(12375);
    expect(t.taxable).toBe(17500);
    expect(t.basis).toBe('floor');
  });

  it('marchandise dense : le poids réel l’emporte ; facteurs du transporteur', () => {
    expect(taxableWeight({ weightKg: 9000, volumeM3: 10, ldm: 2 }).basis).toBe('real');
    expect(taxableWeight({ weightKg: 1000, volumeM3: 10, ldm: 0.4 }, { kgPerM3: 250, kgPerLdm: 1800 }))
      .toMatchObject({ volumetric: 2500, floor: 720, basis: 'volume' });
  });
});
