// API v1 : parcours complet sur une base en mémoire (même contrat que Supabase).
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { handle, type Db, type ApiRequest } from './handler';
import type { ShipmentRow } from './present';

const KEY = 'al_live_test0123456789';
function memoryDb() {
  const keys = [{ id: 'k1', org_id: 'o1', revoked_at: null as string | null, scopes: [], key_hash: createHash('sha256').update(KEY).digest('hex') }];
  const ships: ShipmentRow[] = [];
  const usage: unknown[] = [];
  let n = 0;
  const db: Db = {
    keyByHash: async (h) => keys.find((k) => k.key_hash === h) ?? null,
    touchKey: async () => {},
    logUsage: async (e) => { usage.push(e); },
    findShipment: async (org, ref) => ships.find((s) => (s as any).org_id === org && (s.code === ref || s.external_id === ref)) ?? null,
    insertShipment: async (row) => {
      const s = { id: `s${++n}`, code: `PL-TEST${n}`, version: 1, created_at: 'c', updated_at: 'u', share_token: 'tok', validated_at: null, ...row } as unknown as ShipmentRow;
      ships.push(s); return s;
    },
    updateShipment: async (id, patch) => { const s = ships.find((x) => x.id === id)!; Object.assign(s, patch, { version: s.version + 1 }); return s; },
    listShipments: async (org, q) => ships.filter((s) => (s as any).org_id === org && (!q.status || q.status.includes(s.status))).slice(0, q.limit),
  };
  return { db, keys, ships, usage };
}
const req = (method: string, path: string, body?: unknown, key: string | null = KEY, query = ''): ApiRequest => ({
  method, path, query: new URLSearchParams(query), headers: key ? { authorization: `Bearer ${key}` } : {}, body,
});
const LINES = [
  { id: 'L1', reference: 'PAL-EUR', type: 'pallet', quantity: 6, length: 120, width: 80, height: 150, weight: 450, stop: 1, destination: 'Lyon' },
  { id: 'L2', reference: 'CARTON-A', quantity: 40, length: 60, width: 40, height: 40, weight: 12, stop: 2, destination: 'Mâcon' },
];

describe('API v1', () => {
  it('santé sans clé ; refus sans clé ou avec une clé révoquée', async () => {
    const { db, keys } = memoryDb();
    expect((await handle(req('GET', '/health', undefined, null), db)).status).toBe(200);
    expect((await handle(req('GET', '/shipments', undefined, null), db)).status).toBe(401);
    keys[0].revoked_at = 'x';
    expect((await handle(req('GET', '/shipments'), db)).status).toBe(401);
  });

  it('erreurs de saisie : toutes renvoyées d’un coup, avec le chemin du champ', async () => {
    const { db } = memoryDb();
    const r = await handle(req('POST', '/shipments', { lines: [{ reference: '', length: -1 }], vehicle: 'navette' }), db);
    expect(r.status).toBe(422);
    const paths = (r.body as any).error.details.map((d: any) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['reference', 'vehicle', 'lines[0].reference', 'lines[0].length', 'lines[0].width']));
  });

  it('brouillon : créé « Nouveau », sans plan ; même référence = mise à jour, pas de doublon', async () => {
    const { db, ships, usage } = memoryDb();
    const r = await handle(req('POST', '/shipments', { reference: 'EXP-1', label: 'Tournée', lines: LINES }), db);
    expect(r.status).toBe(201);
    expect((r.body as any)).toMatchObject({ code: 'PL-TEST1', reference: 'EXP-1', status: 'new', plan: null, links: { dock: null } });
    expect((ships[0].input as any).rows[0]).toMatchObject({ id: 'L1', length: 120, rotationMode: 'HORIZONTAL', floorOnly: true, stackable: true });
    const r2 = await handle(req('POST', '/shipments', { reference: 'EXP-1', lines: LINES.slice(0, 1) }), db);
    expect(r2.status).toBe(200);
    expect(ships).toHaveLength(1);
    expect(usage.at(-1)).toMatchObject({ endpoint: 'POST /v1/shipments', http_status: 200, items: 6 });
  });

  it('auto : plan calculé (même format que l’espace), positions par ligne, lien quai', async () => {
    const { db, ships } = memoryDb();
    const r = await handle(req('POST', '/shipments', { reference: 'EXP-2', mode: 'auto', vehicle: 'semi', lines: LINES }), db);
    const b = r.body as any;
    expect(r.status).toBe(201);
    expect(b.status).toBe('in_progress');
    expect(b.summary).toMatchObject({ vehicles: 1, units_loaded: 46, units_not_loaded: 0 });
    expect(b.links.dock).toBe('https://atelierlogistique.com/q/tok');
    const items = b.plan.vehicles[0].items;
    expect(items).toHaveLength(46);
    expect(items[0]).toMatchObject({ sequence: expect.any(Number), line_id: expect.stringMatching(/^L[12]$/), x: expect.any(Number) });
    expect((ships[0].result as any).plan.guide).toMatch(/^2F/);
    // Lecture par n° ou par référence WMS
    expect((await handle(req('GET', '/shipments/PL-TEST1'), db)).status).toBe(200);
    expect((await handle(req('GET', '/shipments/EXP-2'), db)).body).toMatchObject({ code: 'PL-TEST1' });
  });

  it('auto en flotte : véhicules, coût, lien quai par camion', async () => {
    const { db } = memoryDb();
    const lines = [{ reference: 'PAL', type: 'pallet', quantity: 14, length: 120, width: 80, height: 160, weight: 650, stacking: 'floor_no_top', stop: 1 }];
    const r = await handle(req('POST', '/shipments', { reference: 'EXP-3', mode: 'auto', fleet: [{ vehicle: 'fourgon20', cost: 250 }, { vehicle: 'porteur19', cost: 480 }], lines }), db);
    const b = r.body as any;
    expect(r.status).toBe(201);
    expect(b.plan.vehicles.length).toBeGreaterThan(0);
    expect(b.plan.vehicles.reduce((s: number, v: any) => s + v.units, 0)).toBe(14);
    expect(b.plan.vehicles[0].dock_url).toBe('https://atelierlogistique.com/q/tok?camion=1');
    expect(b.plan.vehicles[0].items.length).toBe(b.plan.vehicles[0].units);
  }, 20000);

  it('validé : renvoi refusé (409) ; liste filtrée ; annulation', async () => {
    const { db } = memoryDb();
    await handle(req('POST', '/shipments', { reference: 'EXP-4', mode: 'auto', validate: true, lines: LINES }), db);
    expect((await handle(req('POST', '/shipments', { reference: 'EXP-4', lines: LINES }), db)).status).toBe(409);
    const list = await handle(req('GET', '/shipments', undefined, KEY, 'status=validated'), db);
    expect((list.body as any).data.map((d: any) => d.reference)).toEqual(['EXP-4']);
    const c = await handle(req('POST', '/shipments/EXP-4/cancel'), db);
    expect((c.body as any)).toMatchObject({ status: 'cancelled', links: { dock: null } });
    expect((await handle(req('GET', '/shipments/inconnu'), db)).status).toBe(404);
  });

  it('dimensions en mm et véhicule sur mesure', async () => {
    const { db, ships } = memoryDb();
    const r = await handle(req('POST', '/shipments', { reference: 'EXP-5', units: 'mm', vehicle: { label: 'Caisse mobile', length: 7200, width: 2450, height: 2600, max_weight: 8000 }, lines: [{ reference: 'C', length: 600, width: 400, height: 400, weight: 10 }] }), db);
    expect(r.status).toBe(201);
    const input = ships[0].input as any;
    expect(input.rows[0]).toMatchObject({ length: 60, width: 40, height: 40 });
    expect(input).toMatchObject({ containerId: 'custom', custom: { label: 'Caisse mobile', length: 720, maxWeight: 8000 } });
  });
});
