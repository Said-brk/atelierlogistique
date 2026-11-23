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
    create schema auth; create table auth.users(id uuid primary key, email text);
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
    await db.exec(`insert into auth.users values ('${A}', 'alice@a.fr'), ('${B}', 'bob@b.fr')`);
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

    // Palettisations : numéro PZ, cloisonnement, lien vers un chargement de la même entreprise.
    const sid = (await as(A, `select id from shipments limit 1`)).rows[0]?.id
      ?? (await as(A, `insert into shipments(org_id) values ($1) returning id`, [orgA])).rows[0].id;
    const pz = (await as(A, `insert into palletizations(org_id, input) values ($1, '{"rows":[]}') returning id, code, version`, [orgA])).rows[0];
    ok(/^PZ-[2-9A-HJ-NP-Z]{6}$/.test(pz.code), 'palettisation : numéro PZ ' + pz.code);
    await as(A, `update palletizations set shipment_id = $1, result = '{"pallets":8}' where id = $2`, [sid, pz.id]);
    const pz2 = (await as(A, `select shipment_id, version from palletizations where id = $1`, [pz.id])).rows[0];
    ok(pz2.shipment_id === sid && pz2.version === 2, 'palettisation rattachée au chargement, version 2');
    ok((await as(B, 'select * from palletizations')).rows.length === 0, 'B ne voit pas les palettisations de A');
    const sB = (await as(B, `insert into shipments(org_id) values ($1) returning id`, [orgB])).rows[0].id;
    err = null; try { await as(A, `update palletizations set shipment_id = $1 where id = $2`, [sB, pz.id]); } catch (e) { err = e; }
    ok(err, 'impossible de rattacher un chargement d’une autre entreprise');
    await db.exec(`update palletizations set expires_at = now() - interval '1 day'`);
    await db.query('select purge_expired_shipments()');
    ok((await db.query('select count(*)::int as n from palletizations')).rows[0].n === 0, 'purge des palettisations expirées');

    // Invitations : un admin invite une adresse ; seule cette adresse peut accepter ; rôles protégés.
    const C = '33333333-3333-3333-3333-333333333333';
    await db.exec(`insert into auth.users values ('${C}', 'Claire@C.fr')`);
    err = null; try { await as(B, `select invite_member($1, 'claire@c.fr')`, [orgA]); } catch (e) { err = e; }
    ok(err, 'B ne peut pas inviter chez A');
    err = null; try { await as(A, `insert into organization_members(org_id, user_id) values ($1, $2)`, [orgA, C]); } catch (e) { err = e; }
    ok(err, 'personne n’est ajouté sans accepter une invitation');
    const inv = (await as(A, `select invite_member($1, ' CLAIRE@c.fr ', 'member') as id`, [orgA])).rows[0].id;
    await as(A, `select invite_member($1, 'claire@c.fr', 'admin')`, [orgA]);
    ok((await as(A, 'select role from invitations')).rows.map((r) => r.role).join() === 'admin', 'ré-invitation : une seule invitation, rôle mis à jour');
    ok((await as(B, 'select * from invitations')).rows.length === 0, 'B ne voit pas les invitations de A');
    ok((await as(B, 'select * from my_invitations()')).rows.length === 0, 'invitation invisible pour une autre adresse');
    err = null; try { await as(B, `select accept_invitation($1)`, [inv]); } catch (e) { err = e; }
    ok(err, 'une autre adresse ne peut pas accepter');
    const mine = (await as(C, 'select * from my_invitations()')).rows;
    ok(mine.length === 1 && mine[0].org_name === 'Transports A' && mine[0].invited_by_email === 'alice@a.fr', 'Claire voit l’invitation (adresse sans tenir compte des majuscules)');
    await as(C, `select accept_invitation($1)`, [inv]);
    ok((await as(C, 'select name from organizations')).rows[0]?.name === 'Transports A', 'Claire a rejoint Transports A');
    ok((await as(C, 'select count(*)::int as n from shipments')).rows[0].n >= 0 && (await as(C, 'select * from invitations')).rows.length === 0, 'invitation consommée');
    const team = (await as(C, `select email, role from org_members($1)`, [orgA])).rows;
    ok(team.length === 2 && team[0].role === 'owner' && team[1].email === 'claire@c.fr' && team[1].role === 'admin', 'équipe : propriétaire puis admin');
    ok((await as(B, `select * from org_members($1)`, [orgA])).rows.length === 0, 'B ne voit pas l’équipe de A');
    err = null; try { await as(A, `select invite_member($1, 'claire@c.fr')`, [orgA]); } catch (e) { err = e; }
    ok(err, 'déjà membre : pas de nouvelle invitation');
    err = null; try { await as(C, `delete from organization_members where org_id = $1 and user_id = $2`, [orgA, A]); } catch (e) { err = e; }
    ok(err, 'le propriétaire ne peut pas être retiré');
    err = null; try { await as(C, `update organization_members set role = 'owner' where user_id = $1`, [C]); } catch (e) { err = e; }
    ok(err, 'personne ne se donne le rôle de propriétaire');
    await as(A, `update organization_members set role = 'member' where user_id = $1`, [C]);
    err = null; try { await as(C, `select invite_member($1, 'dan@d.fr')`, [orgA]); } catch (e) { err = e; }
    ok(err, 'un membre simple ne peut pas inviter');
    await as(C, `delete from organization_members where user_id = $1`, [C]);
    ok((await as(C, 'select * from organizations')).rows.length === 0, 'Claire peut quitter l’entreprise');
  }, 60000);
});
