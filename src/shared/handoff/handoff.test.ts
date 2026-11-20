import { describe, expect, it } from 'vitest';
import { consumeHandoff, sendHandoff } from './index';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
};

describe('transfert entre outils', () => {
  it('lecture unique, contrôle du schéma', () => {
    const s = mem();
    sendHandoff('opt', { schemaId: 'x/colis', schemaVersion: 1, source: { tool: 'pallet', label: 'Palettisation 3D' }, records: [{ reference: 'PAL' }] }, s);
    expect(consumeHandoff('opt', 'autre', s)).toBeNull();
    sendHandoff('opt', { schemaId: 'x/colis', schemaVersion: 1, source: { tool: 'pallet', label: 'P' }, records: [{ reference: 'PAL' }] }, s);
    const env = consumeHandoff('opt', 'x/colis', s);
    expect(env?.records).toEqual([{ reference: 'PAL' }]);
    expect(consumeHandoff('opt', 'x/colis', s)).toBeNull();
  });
});
