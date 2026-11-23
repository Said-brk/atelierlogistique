// Test du schéma Supabase dans un vrai Postgres en mémoire (PGlite) : règles d'accès (RLS),
// versions, lien de partage, clés d'API, purge. Lancé avec les autres tests : npm test.
import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

describe('schéma Supabase', () => {
  it('isole les entreprises et gère chargements, versions, partage, clés et purge', async () => {
    const db = new PGlite({ extensions: { pgcrypto } });
    const ok = (c, m) => expect(c, m).toBeTruthy();
    // Ce que Supabase fournit déjà : rôles, schéma auth, auth.uid().
    await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
    `);
    const sql = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(MIGRATIONS, f), 'utf8')).join('\n');
    await db.exec(sql);
    await db.exec(sql); // ré-exécutable
    ok(true, 'migration appliquée deux fois');
    await db.exec(`grant usage on schema public to anon, authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant select on all tables in schema public to anon;`); // comme Supabase par défaut
    const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
    await db.exec(`insert into auth.users values ('${A}'), ('${B}')`);
    const as = async (uid, q, params) => {
      await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
      try { return await db.query(q, params); } finally { await db.exec('reset role'); }
    };
    const orgA = (await as(A, `select public.create_organization('Transports A') as id`)).rows[0].id;
    const orgB = (await as(B, `select public.create_organization('Logistique B') as id`)).rows[0].id;
    ok((await as(A, 'select * from organizations')).rows.length === 1, 'A ne voit que son entreprise');
    const s = (await as(A, `insert into shipments(org_id, external_id, source, input) values ($1, 'EXP-1', 'api', '{"lines":[]}') returning code, version, share_token, expires_at`, [orgA])).rows[0];
    ok(/^PL-[2-9A-HJ-NP-Z]{6}$/.test(s.code), 'code lisible ' + s.code);
    ok(s.version === 1, 'version 1');
    ok(Math.round((new Date(s.expires_at) - Date.now()) / 864e5) === 90, 'expiration 90 jours');
    ok((await as(B, 'select * from shipments')).rows.length === 0, 'B ne voit pas les chargements de A');
    let err = null; try { await as(B, `insert into shipments(org_id) values ($1)`, [orgA]); } catch (e) { err = e; }
    ok(err, 'B ne peut pas créer un chargement chez A');
    await as(B, `update shipments set status='cancelled'`);
    ok((await as(A, `select status from shipments`)).rows[0].status === 'new', 'B ne peut pas modifier A');
    await as(A, `update shipments set result='{"vehicles":1}', status='validated'`);
    const v = (await as(A, `select version, validated_at from shipments`)).rows[0];
    ok(v.version === 2 && v.validated_at, 'nouvelle version + date de validation');
    ok((await as(A, 'select * from shipment_versions')).rows.length === 2, 'historique des versions');
    ok((await as(null, `select * from shipment_by_token($1)`, [s.share_token])).rows.length === 1, 'lien de partage sans compte');
    ok((await as(null, `select * from shipments`)).rows.length === 0, 'anonyme : aucun accès direct');
    const k = (await as(A, `select * from create_api_key($1, 'Reflex quai 3')`, [orgA])).rows[0];
    ok(k.key.startsWith('al_live_') && k.key.length > 40, 'clé d’API créée');
    const stored = (await as(A, 'select key_hash, prefix from api_keys')).rows[0];
    ok(!JSON.stringify(stored).includes(k.key), 'clé jamais stockée en clair');
    err = null; try { await as(B, `select * from create_api_key($1, 'pirate')`, [orgA]); } catch (e) { err = e; }
    ok(err, 'B ne peut pas créer de clé chez A');
    ok((await as(B, 'select * from api_keys')).rows.length === 0, 'B ne voit pas les clés de A');
    await db.exec(`update shipments set expires_at = now() - interval '1 day'`);
    ok((await db.query('select purge_expired_shipments() as n')).rows[0].n === 1, 'purge des chargements expirés');
  }, 60000);
});
