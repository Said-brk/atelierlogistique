import { describe, it, expect } from 'vitest';
import { readTour, writeTour, shouldOffer, snooze, SNOOZE_MS } from './tourStore';

function memory(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(), key: () => null, get length() { return m.size; },
  } as Storage;
}

describe('visite guidée', () => {
  it('proposée la première fois', () => {
    expect(shouldOffer(readTour('x', memory()))).toBe(true);
  });
  it('plus jamais proposée une fois terminée ou refusée', () => {
    const s = memory();
    writeTour('x', { state: 'done' }, s);
    expect(shouldOffer(readTour('x', s))).toBe(false);
    writeTour('x', { state: 'never' }, s);
    expect(shouldOffer(readTour('x', s))).toBe(false);
  });
  it('rappel 24 h plus tard', () => {
    const now = 1_000_000;
    const st = snooze(now);
    expect(shouldOffer(st, now + SNOOZE_MS - 1)).toBe(false);
    expect(shouldOffer(st, now + SNOOZE_MS)).toBe(true);
  });
  it('stockage illisible : proposée sans planter', () => {
    const s = memory();
    s.setItem('al.tour.x', '{oops');
    expect(readTour('x', s)).toBe(null);
    expect(() => writeTour('x', { state: 'done' }, null)).not.toThrow();
  });
});
