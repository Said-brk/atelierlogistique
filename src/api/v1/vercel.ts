// Fonction Vercel de l'API v1 (fichier assemblé par scripts/build-api.mjs → api/_lib/v1.mjs).
// La base est Supabase, avec la clé secrète du serveur (SUPABASE_SERVICE_ROLE_KEY, variable Vercel de type Secret) :
// l'API vérifie elle-même la clé d'API et n'accède qu'aux données de l'entreprise de cette clé.

import type { RefItem } from '../../shared/references/defaults';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { handle, type Db } from './handler';
import type { ShipmentRow } from './present';

// Toutes les colonnes : merged_into (regroupement) n'existe qu'après le script 20261125000010.
const SHIPMENT_FIELDS = '*';
const LIST_FIELDS = 'id, org_id, code, external_id, label, status, version, source, departure_at, created_at, updated_at, validated_at, share_token, summary:result->summary';

let client: SupabaseClient | null = null;
function sb() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Configuration du serveur incomplète (SUPABASE_SERVICE_ROLE_KEY).');
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
const must = <T>({ data, error }: { data: T; error: { message: string } | null }) => { if (error) throw new Error(error.message); return data; };

export const supabaseDb: Db = {
  keyByHash: async (hash) => must(await sb().from('api_keys').select('id, org_id, revoked_at, scopes').eq('key_hash', hash).maybeSingle()),
  touchKey: async (id) => { await sb().from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', id); },
  logUsage: async (e) => { await sb().from('usage_events').insert(e); },
  findShipment: async (org, ref) => {
    const q = sb().from('shipments').select(SHIPMENT_FIELDS).eq('org_id', org);
    return must(await (/^PL-/i.test(ref) ? q.eq('code', ref.toUpperCase()) : q.eq('external_id', ref)).maybeSingle()) as ShipmentRow | null;
  },
  insertShipment: async (row) => must(await sb().from('shipments').insert(row).select(SHIPMENT_FIELDS).single()) as ShipmentRow,
  updateShipment: async (id, patch) => must(await sb().from('shipments').update(patch).eq('id', id).select(SHIPMENT_FIELDS).single()) as ShipmentRow,
  listShipments: async (org, q) => {
    let query = sb().from('shipments').select(LIST_FIELDS).eq('org_id', org).order('updated_at', { ascending: false }).limit(q.limit);
    if (q.status?.length) query = query.in('status', q.status);
    if (q.updatedSince) query = query.gt('updated_at', q.updatedSince);
    const rows = must(await query) as (ShipmentRow & { summary?: Record<string, unknown> })[];
    return rows.map(({ summary, ...r }) => ({ ...r, input: null, result: summary ? { summary } : null }));
  },
  references: async (org) => must(await sb().from('reference_items').select('kind, code, label, data, active, sort').eq('org_id', org)) as RefItem[],
};

type Req = { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; body?: unknown; query?: Record<string, string | string[]> };
type Res = { status: (n: number) => Res; setHeader: (k: string, v: string) => void; json: (b: unknown) => void; end: () => void };

export default async function handler(req: Req, res: Res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-API-Key, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const url = new URL(req.url ?? '/', 'https://x');
  const route = url.searchParams.get('route') ?? '';
  url.searchParams.delete('route');
  let body: unknown = null;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? null; } catch {
    res.status(400).json({ error: { code: 'invalid_json', message: 'Corps de requête : JSON invalide.' } }); return;
  }
  const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v[0] : v]));
  try {
    const r = await handle({ method: req.method ?? 'GET', path: `/${route}`, query: url.searchParams, headers, body }, supabaseDb, process.env.SITE_URL ?? 'https://atelierlogistique.com');
    res.status(r.status).json(r.body);
  } catch (e) {
    res.status(500).json({ error: { code: 'server_error', message: (e as Error).message } });
  }
}
