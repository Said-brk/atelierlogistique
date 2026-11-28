// Schéma « transport » (tournée, transporteur, coût théorique, facture) dans un vrai Postgres en mémoire (PGlite).
import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

describe('schéma transport', () => {
  it('tournée, transporteur, coût théorique et facture : colonnes, contraintes, droits, verrou du quai', async () => {
    const db = new PGlite({ extensions: { pgcrypto } });
    const ok = (c, m) => expect(c, m).toBeTruthy();
    // Ce que Supabase fournit déjà : rôles, schéma auth, auth.uid().
    await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
    -- Comme Supabase : pgcrypto installé dans le schéma « extensions » (pas dans public).
    create schema extensions; create extension pgcrypto schema extensions; grant usage on schema extensions to anon, authenticated;
    set search_path = public, extensions;
    -- pg_net simulé : on enregistre les appels HTTP, les réponses sont écrites par le test.
    create schema net;
    create table net.calls(id bigserial primary key, url text, body_text text, headers jsonb);
    create table net._http_response(id bigint primary key, status_code int, error_msg text, timed_out boolean default false);
    create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
      returns bigint language sql as $f$ insert into net.calls(url, body_text, headers) values (url, body::text, headers) returning id $f$;
    `);
    const sql = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(MIGRATIONS, f), 'utf8')).join('\n');
    await db.exec(sql);
    await db.exec(sql); // ré-exécutable
    ok(true, 'migration appliquée deux fois');
    await db.exec(`grant usage on schema public to anon, authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant select on all tables in schema public to anon;`); // comme Supabase par défaut
    const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
    await db.exec(`insert into auth.users values ('${A}', 'alice@a.fr'), ('${B}', 'bob@b.fr')`);
    const as = async (uid, q, params) => {
      await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
      try { return await db.query(q, params); } finally { await db.exec('reset role'); }
    };
    const orgA = (await as(A, `select public.create_organization('Transports A') as id`)).rows[0].id;
    const orgB = (await as(B, `select public.create_organization('Logistique B') as id`)).rows[0].id;
    const fails = async (who, q, p) => { try { await as(who, q, p); return false; } catch { return true; } };

    // Transporteurs dans les tables de référence
    await as(A, `insert into reference_items(org_id, kind, code, label, data) values ($1, 'carrier', 'GEO', 'Geodis', '{"billing":"ldm","rate":100,"zones":[{"scope":"tour","key":"T1","rate":90}]}')`, [orgA]);
    ok((await as(A, `select count(*)::int n from reference_items where kind = 'carrier'`)).rows[0].n === 1, 'transporteur enregistré');
    ok(await fails(A, `insert into reference_items(org_id, kind, code, label) values ($1, 'truc', 'X', 'X')`, [orgA]), 'type de référence inconnu refusé');
    ok((await as(B, `select count(*)::int n from reference_items where kind = 'carrier'`)).rows[0].n === 0, 'B ne voit pas les transporteurs de A');

    // Chargement : tournée, transporteur, coût
    const s = (await as(A, `insert into shipments(org_id, input, tour, carrier, carrier_cost, carrier_quote)
      values ($1, '{"rows":[]}', 'T1', 'GEO', 1452.40, '{"basis":"ldm","amount":1452.4}') returning id, code, version`, [orgA])).rows[0];
    const row = (await as(A, `select tour, carrier, carrier_cost::float c, carrier_quote->>'basis' b from shipments where id = $1`, [s.id])).rows[0];
    ok(row.tour === 'T1' && row.carrier === 'GEO' && row.c === 1452.4 && row.b === 'ldm', 'colonnes tournée / transporteur / coût');
    ok(await fails(A, `update shipments set tour = repeat('x', 41) where id = $1`, [s.id]), 'tournée > 40 caractères refusée');
    ok(await fails(A, `update shipments set carrier = repeat('x', 41) where id = $1`, [s.id]), 'transporteur > 40 caractères refusé');
    ok(await fails(A, `update shipments set invoice_ref = repeat('x', 61) where id = $1`, [s.id]), 'n° de facture > 60 caractères refusé');

    // Au quai : plan verrouillé, mais la facture reste saisissable
    await as(A, `update shipments set status = 'sent' where id = $1`, [s.id]);
    ok(await fails(A, `update shipments set input = '{"rows":[1]}' where id = $1`, [s.id]), 'plan verrouillé au quai');
    const before = (await as(A, `select version from shipments where id = $1`, [s.id])).rows[0].version;
    await as(A, `update shipments set invoiced_amount = 1500, invoiced_qty = 7, invoice_ref = 'F-1', invoiced_on = current_date where id = $1`, [s.id]);
    const inv = (await as(A, `select invoiced_amount::float a, invoiced_qty::float q, invoice_ref r, status from shipments where id = $1`, [s.id])).rows[0];
    ok(inv.a === 1500 && inv.q === 7 && inv.r === 'F-1' && inv.status === 'sent', 'facture saisie après envoi au quai');
    const ver = (await as(A, `select version from shipments where id = $1`, [s.id])).rows[0].version;
    ok(ver === before, 'saisir la facture ne crée pas de nouvelle version du plan (' + ver + ')');

    // Isolement
    await as(B, `update shipments set invoiced_amount = 1 where id = $1`, [s.id]);
    ok((await as(A, `select invoiced_amount::float a from shipments where id = $1`, [s.id])).rows[0].a === 1500, 'B ne modifie pas la facture de A');
    ok((await as(B, `select count(*)::int n from shipments where carrier is not null`)).rows[0].n === 0, 'B ne voit pas les chargements de A');
    expect(orgB).toBeTruthy();
  }, 30000);
});
