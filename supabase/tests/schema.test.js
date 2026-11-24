// Test du schéma Supabase dans un vrai Postgres en mémoire (PGlite) : règles d'accès (RLS),
// versions, lien de partage, clés d'API, purge. Lancé avec les autres tests : npm test.
import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultReferences } from '../../src/shared/references/defaults';

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
    ok((await as(A, 'select * from organizations')).rows.length === 1, 'A ne voit que son entreprise');
    // Tables de référence : pré-remplies à la création, isolées, modifiables par les administrateurs.
    const refs = (await as(A, `select kind, code, label, data, active, sort from reference_items order by kind, sort`)).rows;
    const key = (r) => `${r.kind}:${r.code}`;
    const want = defaultReferences().map(({ kind, code, label, data, active, sort }) => ({ kind, code, label, data, active, sort }));
    expect(refs.map((r) => ({ ...r })).sort((a, b) => key(a).localeCompare(key(b)))).toEqual(want.sort((a, b) => key(a).localeCompare(key(b))));
    ok((await as(B, `select * from reference_items where org_id = $1`, [orgA])).rows.length === 0, 'B ne voit pas les références de A');
    await as(B, `update reference_items set label = 'pirate' where org_id = $1`, [orgA]);
    await as(A, `update reference_items set data = jsonb_set(data, '{length}', '13620') where org_id = $1 and code = 'semi'`, [orgA]);
    await as(A, `insert into reference_items(org_id, kind, code, label, data) values ($1, 'pallet', 'cp1', 'CP1 chimie', '{"length":1200,"width":1000}')`, [orgA]);
    ok((await as(A, `select count(*)::int n from reference_items where label = 'pirate'`)).rows[0].n === 0, 'B ne modifie pas A');
    await as(A, `insert into reference_items(org_id, kind, code, label) values ($1, 'tour', 'T-NORD', 'Tournée Nord')`, [orgA]);
    await as(A, `insert into reference_items(org_id, kind, code, label, data) values ($1, 'agency', 'LYO01', 'Agence Lyon', '{"tour":"T-NORD","order":1}')`, [orgA]);
    ok((await as(A, `select count(*)::int n from reference_items where kind in ('agency', 'tour')`)).rows[0].n === 2, 'agences et tournées');
    await as(A, `select reset_reference_items($1, 'pallet')`, [orgA]);
    ok((await as(A, `select count(*)::int n from reference_items where kind = 'pallet'`)).rows[0].n === 5, 'retour aux supports par défaut');
    ok((await as(A, `select data->>'length' l from reference_items where code = 'semi'`)).rows[0].l === '13620', 'les autres tables ne bougent pas');
    let rerr = null; try { await as(B, `select reset_reference_items($1, 'vehicle')`, [orgA]); } catch (e) { rerr = e; }
    ok(rerr, 'B ne réinitialise pas A');
    await db.exec(sql);
    ok((await as(A, `select data->>'length' l from reference_items where code = 'semi'`)).rows[0].l === '13620', 'ré-exécution du script : modifications conservées');
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

    // Webhooks : abonnement, envoi signé au changement de statut, nouvelles tentatives, cloisonnement.
    err = null; try { await as(A, `insert into webhooks(org_id, url) values ($1, 'http://wms.a.fr/hook')`, [orgA]); } catch (e) { err = e; }
    ok(err, 'https obligatoire');
    err = null; try { await as(A, `insert into webhooks(org_id, url) values ($1, 'https://localhost/hook')`, [orgA]); } catch (e) { err = e; }
    ok(err, 'adresse locale refusée');
    const wh = (await as(A, `insert into webhooks(org_id, url) values ($1, 'https://wms.a.fr/hook') returning id, secret`, [orgA])).rows[0];
    ok(wh.secret.length === 48, 'secret de signature généré');
    err = null; try { await as(B, `insert into webhooks(org_id, url) values ($1, 'https://pirate.fr/x')`, [orgA]); } catch (e) { err = e; }
    ok(err && (await as(B, 'select * from webhooks')).rows.length === 0, 'B ne voit ni ne crée de webhook chez A');
    err = null; try { await as(B, `select webhook_test($1)`, [wh.id]); } catch (e) { err = e; }
    ok(err, 'B ne peut pas tester le webhook de A');
    const sh = (await as(A, `insert into shipments(org_id, external_id, label, input, result) values ($1, 'EXP-WH', 'Tournée', '{}', '{"summary":{"packed":12,"unpacked":0,"fill":0.41,"weight":5200},"plan":{"guide":"2Fabc"}}') returning code, share_token`, [orgA])).rows[0];
    ok((await db.query('select count(*)::int as n from net.calls')).rows[0].n === 0, 'pas de notification à la création');
    await as(A, `update shipments set status = 'validated' where code = $1`, [sh.code]);
    const call = (await db.query('select * from net.calls order by id desc limit 1')).rows[0];
    const payload = JSON.parse(call.body_text);
    ok(call.url === 'https://wms.a.fr/hook' && payload.event === 'shipment.validated' && call.headers['X-AL-Event'] === 'shipment.validated', 'notification envoyée tout de suite');
    ok(payload.data.code === sh.code && payload.data.reference === 'EXP-WH' && payload.data.summary.units_loaded === 12 && payload.data.summary.fill_rate_pct === 41, 'contenu : chargement + résumé');
    ok(payload.data.links.dock.endsWith(sh.share_token) && payload.data.links.api.endsWith('/api/v1/shipments/' + sh.code), 'liens quai et API');
    const [, t, sig] = call.headers['X-AL-Signature'].match(/^t=(\d+),v1=([0-9a-f]{64})$/);
    const { createHmac } = await import('node:crypto');
    ok(createHmac('sha256', wh.secret).update(`${t}.${call.body_text}`).digest('hex') === sig, 'signature HMAC vérifiable');
    // Échec (500) → nouvel essai planifié ; puis succès.
    await db.query('insert into net._http_response(id, status_code) values ($1, 500)', [call.id]);
    await db.query('select webhook_tick()');
    let dl = (await db.query('select status, attempt, http_status, next_attempt_at > now() as later from webhook_deliveries')).rows[0];
    ok(dl.status === 'pending' && dl.attempt === 1 && dl.http_status === 500 && dl.later, 'échec : nouvel essai planifié');
    ok((await as(A, 'select failure_count from webhooks')).rows[0].failure_count === 1, 'échec compté');
    await db.query(`update webhook_deliveries set next_attempt_at = now() - interval '1 second'`);
    await db.query('select webhook_tick()');
    const call2 = (await db.query('select id from net.calls order by id desc limit 1')).rows[0];
    ok(call2.id !== call.id, 'renvoyé');
    await db.query('insert into net._http_response(id, status_code) values ($1, 204)', [call2.id]);
    await db.query('select webhook_tick()');
    dl = (await db.query('select status, attempt from webhook_deliveries')).rows[0];
    ok(dl.status === 'ok' && dl.attempt === 2, 'succès au 2e essai');
    ok((await as(A, 'select failure_count, last_status from webhooks')).rows[0].last_status === 204, 'état du webhook à jour');
    ok((await as(A, 'select * from webhook_deliveries')).rows.length === 1 && (await as(B, 'select * from webhook_deliveries')).rows.length === 0, 'historique visible par A seulement');
    // Rouvrir, abonnements, test, désactivation.
    await as(A, `update shipments set status = 'in_progress' where code = $1`, [sh.code]);
    ok(JSON.parse((await db.query('select body_text from net.calls order by id desc limit 1')).rows[0].body_text).event === 'shipment.reopened', 'réouverture notifiée');
    await as(A, `update webhooks set events = array['shipment.sent']`);
    const before = (await db.query('select count(*)::int as n from net.calls')).rows[0].n;
    await as(A, `update shipments set status = 'validated' where code = $1`, [sh.code]);
    ok((await db.query('select count(*)::int as n from net.calls')).rows[0].n === before, 'évènement non abonné : rien envoyé');
    ok((await as(A, 'select webhook_test($1) as n', [wh.id])).rows[0].n === 1, 'test envoyé');
    await as(A, `update webhooks set active = false`);
    await as(A, `update shipments set status = 'sent' where code = $1`, [sh.code]);
    ok((await db.query('select count(*)::int as n from net.calls')).rows[0].n === before + 1, 'webhook désactivé : plus rien');

    // Fin de chargement par le cariste (lien quai, sans compte) : photos, statut « Chargé », flotte.
    await as(A, `update webhooks set active = true, events = array['shipment.loaded']`);
    const tok = sh.share_token;
    err = null; try { await as(null, `select confirm_loading($1, 1, 'Karim', $2)`, [tok, ['autre/123e4567-e89b-12d3-a456-426614174000.jpg']]); } catch (e) { err = e; }
    ok(err, 'photo hors du dossier du lien refusée');
    err = null; try { await as(null, `select confirm_loading('faux', 1, null, '{}')`); } catch (e) { err = e; }
    ok(err, 'jeton invalide refusé');
    const photo = `${tok}/123e4567-e89b-12d3-a456-426614174000.jpg`;
    await as(null, `select confirm_loading($1, 1, '  Karim  ', $2)`, [tok, [photo]]);
    const ld = (await as(A, `select status, loaded_at from shipments where code = $1`, [sh.code])).rows[0];
    ok(ld.status === 'loaded' && ld.loaded_at, 'chargé + heure de fin');
    const lo = (await as(A, 'select loaded_by, photos, truck from shipment_loadings')).rows[0];
    ok(lo.loaded_by === 'Karim' && lo.photos[0] === photo && lo.truck === 1, 'preuve enregistrée (nom, photo)');
    ok((await as(B, 'select * from shipment_loadings')).rows.length === 0, 'preuve invisible pour une autre entreprise');
    ok(JSON.parse((await db.query('select body_text from net.calls order by id desc limit 1')).rows[0].body_text).event === 'shipment.loaded', 'notification « chargé »');
    const byTok = (await as(null, 'select status, loaded_trucks from shipment_by_token($1)', [tok])).rows[0];
    ok(byTok.status === 'loaded' && byTok.loaded_trucks.join() === '1', 'le lien quai voit les camions confirmés');
    ok((await as(null, 'select can_upload_proof($1) as ok', [photo])).rows[0].ok === true && (await as(null, 'select can_upload_proof($1) as ok', ['x/y.jpg'])).rows[0].ok === false, 'dépôt de photo : seulement dans le dossier d’un lien valide');
    ok((await as(A, 'select can_read_proof($1) as ok', [photo])).rows[0].ok === true && (await as(B, 'select can_read_proof($1) as ok', [photo])).rows[0].ok === false, 'lecture des photos : l’entreprise seulement');
    // Flotte : chargé quand les deux camions sont confirmés.
    const fl = (await as(A, `insert into shipments(org_id, input, result, status) values ($1, '{}', '{"plan":{"guides":[{"index":1},{"index":2}]}}', 'sent') returning code, share_token`, [orgA])).rows[0];
    await as(null, `select confirm_loading($1, 1, null, '{}')`, [fl.share_token]);
    ok((await as(A, `select status from shipments where code = $1`, [fl.code])).rows[0].status === 'partially_loaded', 'flotte : un camion sur deux → chargé en partie');
    err = null; try { await as(A, `update shipments set result = '{}' where code = $1`, [fl.code]); } catch (e) { err = e; }
    ok(err && /rouvrez-le/.test(err.message), 'au quai : flotte et plan figés');
    await as(A, `update shipments set label = 'Libellé modifiable' where code = $1`, [fl.code]);
    ok((await as(A, `select label from shipments where code = $1`, [fl.code])).rows[0].label === 'Libellé modifiable', 'au quai : le libellé reste modifiable');
    await as(null, `select confirm_loading($1, 2, null, '{}')`, [fl.share_token]);
    ok((await as(A, `select status from shipments where code = $1`, [fl.code])).rows[0].status === 'loaded', 'flotte : tous les camions confirmés');
    await as(A, `update shipments set status = 'in_progress', result = '{"plan":{}}' where code = $1`, [fl.code]);
    ok((await as(A, `select status from shipments where code = $1`, [fl.code])).rows[0].status === 'in_progress', 'rouvrir : de nouveau modifiable');
  }, 60000);
});
