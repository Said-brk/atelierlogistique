// API v1 : routage, authentification par clé, enregistrement. Indépendant de l'hébergement (Vercel) et de
// la base (Supabase) : la base est fournie par `db` (testable avec une base en mémoire).
//
//   GET  /v1/health                         état de l'API (sans clé)
//   POST /v1/shipments                      créer ou mettre à jour un chargement (par sa référence WMS)
//   GET  /v1/shipments                      lister (?status=validated&updated_since=…&limit=50)
//   GET  /v1/shipments/{ref}                détail + plan (ref = n° PL-… ou référence WMS)
//   POST /v1/shipments/{ref}/cancel         annuler

import { parseShipment } from './schema';
import { computePlan } from './compute';
import { shipmentOf, listItemOf, type ShipmentRow } from './present';

export interface ApiKey { id: string; org_id: string; revoked_at: string | null; scopes: string[] }
export interface Db {
  keyByHash(hash: string): Promise<ApiKey | null>;
  touchKey(id: string): Promise<void>;
  logUsage(e: { org_id: string; api_key_id: string; endpoint: string; http_status: number; items: number; duration_ms: number }): Promise<void>;
  findShipment(orgId: string, ref: string): Promise<ShipmentRow | null>;
  insertShipment(row: Record<string, unknown>): Promise<ShipmentRow>;
  updateShipment(id: string, patch: Record<string, unknown>): Promise<ShipmentRow>;
  listShipments(orgId: string, q: { status?: string[]; updatedSince?: string; limit: number }): Promise<ShipmentRow[]>;
}
export interface ApiRequest { method: string; path: string; query: URLSearchParams; headers: Record<string, string | undefined>; body: unknown }
export interface ApiResponse { status: number; body: unknown }

const STATUSES = ['new', 'in_progress', 'validated', 'sent', 'partially_loaded', 'loaded', 'cancelled'];
const err = (status: number, code: string, message: string, details?: unknown): ApiResponse => ({ status, body: { error: { code, message, ...(details ? { details } : {}) } } });

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function apiKeyOf(h: ApiRequest['headers']) {
  const auth = h.authorization ?? h.Authorization;
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
  return (h['x-api-key'] ?? '').trim() || null;
}

export async function handle(req: ApiRequest, db: Db, site = 'https://atelierlogistique.com'): Promise<ApiResponse> {
  const t0 = Date.now();
  const path = req.path.replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean); // ['shipments', ref?, action?]

  if (path === '/health' && req.method === 'GET') return { status: 200, body: { ok: true, version: 'v1' } };

  // Authentification
  const key = apiKeyOf(req.headers);
  if (!key) return err(401, 'unauthorized', 'Clé d’API manquante : en-tête « Authorization: Bearer al_live_… ».');
  const k = await db.keyByHash(await sha256Hex(key));
  if (!k || k.revoked_at) return err(401, 'unauthorized', 'Clé d’API invalide ou révoquée.');
  const org = k.org_id;

  let res: ApiResponse;
  let items = 0;
  try {
    if (parts[0] !== 'shipments') res = err(404, 'not_found', `Route inconnue : ${req.method} /v1${path}`);
    else if (parts.length === 1 && req.method === 'POST') {
      const parsed = parseShipment(req.body);
      if (!parsed.ok) res = err(422, 'invalid_request', 'Chargement invalide : voir details.', parsed.issues);
      else {
        const v = parsed.value;
        items = v.units;
        const existing = await db.findShipment(org, v.reference);
        if (existing && ['validated', 'sent', 'partially_loaded', 'loaded'].includes(existing.status)) {
          res = err(409, 'already_validated', `Le chargement ${existing.code} (« ${v.reference} ») est déjà ${existing.status === 'sent' ? 'envoyé au quai' : existing.status === 'loaded' ? 'chargé' : existing.status === 'partially_loaded' ? 'chargé en partie' : 'validé'} : rouvrez-le dans l’espace ou envoyez une nouvelle référence.`);
        } else {
          const result = v.mode === 'auto' ? await computePlan(v.input) : null;
          const status = v.mode === 'auto' ? (v.validate ? 'validated' : 'in_progress') : 'new';
          const fields = { label: v.label, departure_at: v.departureAt, input: v.input, result, status, source: 'api' };
          const row = existing
            ? await db.updateShipment(existing.id, fields)
            : await db.insertShipment({ ...fields, org_id: org, external_id: v.reference });
          res = { status: existing ? 200 : 201, body: await shipmentOf(row, site) };
        }
      }
    } else if (parts.length === 1 && req.method === 'GET') {
      const status = req.query.get('status')?.split(',').map((s) => s.trim()).filter(Boolean);
      const bad = status?.find((s) => !STATUSES.includes(s));
      const since = req.query.get('updated_since') ?? undefined;
      const limit = Math.min(200, Math.max(1, Number(req.query.get('limit') ?? 50) || 50));
      if (bad) res = err(422, 'invalid_request', `Statut inconnu « ${bad} » : ${STATUSES.join(', ')}.`);
      else if (since && Number.isNaN(new Date(since).getTime())) res = err(422, 'invalid_request', 'updated_since : date ISO attendue.');
      else {
        const rows = await db.listShipments(org, { status, updatedSince: since ? new Date(since).toISOString() : undefined, limit });
        res = { status: 200, body: { data: rows.map((r) => listItemOf(r, site)), count: rows.length } };
      }
    } else if (parts.length >= 2) {
      const ref = decodeURIComponent(parts[1]);
      const s = await db.findShipment(org, ref);
      if (!s) res = err(404, 'not_found', `Aucun chargement « ${ref} » (n° PL-… ou référence WMS).`);
      else if (parts.length === 2 && req.method === 'GET') res = { status: 200, body: await shipmentOf(s, site) };
      else if (parts.length === 3 && parts[2] === 'cancel' && req.method === 'POST') {
        const row = s.status === 'cancelled' ? s : await db.updateShipment(s.id, { status: 'cancelled' });
        res = { status: 200, body: await shipmentOf(row, site) };
      } else res = err(405, 'method_not_allowed', `${req.method} non pris en charge sur cette route.`);
    } else res = err(405, 'method_not_allowed', `${req.method} non pris en charge sur cette route.`);
  } catch (e) {
    res = err(500, 'server_error', 'Erreur interne. Réessayez ; si elle persiste : contact@atelierlogistique.com.', { message: (e as Error).message });
  }

  // Suivi de consommation (n'empêche jamais la réponse).
  await Promise.allSettled([
    db.touchKey(k.id),
    db.logUsage({ org_id: org, api_key_id: k.id, endpoint: `${req.method} /v1/${parts[0] ?? ''}${parts.length > 1 ? '/{ref}' : ''}${parts[2] ? `/${parts[2]}` : ''}`, http_status: res.status, items, duration_ms: Date.now() - t0 }),
  ]);
  return res;
}
