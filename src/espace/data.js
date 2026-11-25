// Accès aux données de l'espace connecté (Supabase). Toutes les requêtes passent par les règles
// d'accès de la base : un utilisateur ne lit et n'écrit que dans son entreprise.

import { getSupabase } from '../shared/account/supabase';
import { recordsToColisRows } from '../outils/optimiseur-chargement/import/colisSchema';
import { newRowId } from '../outils/optimiseur-chargement/uiHelpers';

export const STATUS = {
  new: { label: 'Nouveau', color: '#1D4ED8', bg: '#EFF6FF' },
  in_progress: { label: 'En cours', color: '#B45309', bg: '#FFFBEB' },
  validated: { label: 'Validé', color: '#15803D', bg: '#F0FDF4' },
  sent: { label: 'Envoyé', color: '#0F766E', bg: '#F0FDFA' },
  partially_loaded: { label: 'Chargé en partie', color: '#7C3AED', bg: '#FAF5FF' },
  loaded: { label: 'Chargé', color: '#6D28D9', bg: '#F5F3FF' },
  cancelled: { label: 'Annulé', color: '#64748B', bg: '#F1F5F9' },
};
export const SOURCE = { api: 'API', file: 'Fichier', web: 'Saisie' };

const fail = (error) => { if (error) throw new Error(error.message); };

// Les listes ne lisent que le résumé du plan (result->summary), pas le plan 3D complet (lourd).
const SUMMARY = 'summary:result->summary';
const withSummary = (rows) => rows.map(({ summary, ...r }) => ({ ...r, result: summary ? { summary } : null }));

export async function myOrganizations(userId) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('organization_members')
    .select('role, organizations(id, name, retention_days, created_at)').eq('user_id', userId);
  fail(error);
  return data.filter((m) => m.organizations).map((m) => ({ ...m.organizations, role: m.role }));
}

export async function createOrganization(name) {
  const sb = await getSupabase();
  const { error } = await sb.rpc('create_organization', { p_name: name.trim() });
  fail(error);
}

export async function renameOrganization(id, name) {
  const sb = await getSupabase();
  const { error } = await sb.from('organizations').update({ name: name.trim() }).eq('id', id);
  fail(error);
}

const LIST_FIELDS = `id, code, label, external_id, source, status, version, departure_at, tour, carrier, carrier_cost, created_at, updated_at, ${SUMMARY}, palletizations(code)`;

export async function listShipments(orgId, { status = null, limit = 200 } = {}) {
  const sb = await getSupabase();
  let q = sb.from('shipments').select(LIST_FIELDS).eq('org_id', orgId).order('updated_at', { ascending: false }).limit(limit);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  fail(error);
  return withSummary(data);
}

export async function getShipment(code) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('shipments').select('*').eq('code', code).maybeSingle();
  fail(error);
  return data;
}

export async function createShipment(orgId, fields = {}) {
  const sb = await getSupabase();
  const label = fields.label ?? `Chargement du ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
  const { data, error } = await sb.from('shipments')
    .insert({ org_id: orgId, source: 'web', label, input: { rows: [] }, ...fields }).select('code').single();
  fail(error);
  return data.code;
}

/** Le document a changé en base depuis sa lecture (autre onglet, collègue, WMS) : remote = version en base. */
export class ConflictError extends Error {
  constructor(remote) { super('Document modifié ailleurs'); this.name = 'ConflictError'; this.remote = remote; }
}

/**
 * Mise à jour avec contrôle de concurrence : expected = updated_at lu (null : sans contrôle). Si le document a
 * changé entre-temps, rien n'est écrit et ConflictError porte la version en base.
 */
async function guardedUpdate(table, id, patch, expected, select, reload) {
  const sb = await getSupabase();
  let q = sb.from(table).update(patch).eq('id', id);
  if (expected) q = q.eq('updated_at', expected);
  const { data, error } = await q.select(select);
  fail(error);
  if (data?.length) return data[0];
  const remote = await reload();
  if (!remote) throw new Error('Document introuvable (supprimé ?).');
  throw new ConflictError(remote);
}

export async function updateShipment(id, patch, expected = null) {
  return guardedUpdate('shipments', id, patch, expected, '*', async () => {
    const sb = await getSupabase();
    const { data } = await sb.from('shipments').select('*').eq('id', id).maybeSingle();
    return data;
  });
}

export async function signOut() {
  const sb = await getSupabase();
  await sb.auth.signOut();
}

// ---------------------------------------------------------------- Palettisations
const PZ_FIELDS = `id, code, label, external_id, source, status, version, created_at, updated_at, ${SUMMARY}, shipment_id, shipments(code, label)`;

export async function listPalletizations(orgId, { limit = 200 } = {}) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('palletizations').select(PZ_FIELDS).eq('org_id', orgId).order('updated_at', { ascending: false }).limit(limit);
  fail(error);
  return withSummary(data);
}

export async function getPalletization(code) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('palletizations').select('*, shipments(code, label)').eq('code', code).maybeSingle();
  fail(error);
  return data;
}

export async function createPalletization(orgId, fields = {}) {
  const sb = await getSupabase();
  const label = fields.label ?? `Palettisation du ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
  const { data, error } = await sb.from('palletizations')
    .insert({ org_id: orgId, source: 'web', label, input: { rows: [] }, ...fields }).select('code').single();
  fail(error);
  return data.code;
}

export async function updatePalletization(id, patch, expected = null) {
  return guardedUpdate('palletizations', id, patch, expected, '*, shipments(code, label)', async () => {
    const sb = await getSupabase();
    const { data } = await sb.from('palletizations').select('*, shipments(code, label)').eq('id', id).maybeSingle();
    return data;
  });
}

/** Palettisations qui alimentent un chargement (navigation chargement → palettes). */
export async function palletizationsOfShipment(shipmentId) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('palletizations').select(`code, label, ${SUMMARY}`).eq('shipment_id', shipmentId).order('created_at');
  fail(error);
  return withSummary(data);
}

/** Lignes de chargement des palettes d'une palettisation (marquées de son n° : origin). */
export function palletRows(pzCode, records) {
  return recordsToColisRows(records).map((r) => ({ id: newRowId(), ...r, origin: pzCode }));
}

/**
 * Écrit les palettes dans le chargement (en base) : remplace celles déjà reçues de cette palettisation, garde
 * les autres lignes ; le plan est à recalculer. Refusé si le chargement n'est plus modifiable. Contrôle de
 * concurrence : la mise à jour ne passe que si le chargement n'a pas changé depuis sa lecture (2 essais).
 */
export async function putPalletsInShipment(shipmentId, pzCode, rows) {
  const sb = await getSupabase();
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: s, error } = await sb.from('shipments').select('id, code, status, input, updated_at').eq('id', shipmentId).single();
    fail(error);
    if (!OPEN_STATUSES.includes(s.status)) throw new Error(`Le chargement ${s.code} n’est plus modifiable (${STATUS[s.status]?.label ?? s.status}).`); // eslint-disable-line no-use-before-define
    const kept = (s.input?.rows ?? []).filter((r) => r.origin !== pzCode && (r.reference || r.length));
    const input = { ...(s.input ?? {}), rows: [...kept, ...rows], excludedStops: [] };
    const { data, error: e2 } = await sb.from('shipments').update({ input, result: null }).eq('id', s.id).eq('updated_at', s.updated_at).select('code');
    fail(e2);
    if (data?.length) return s.code;
  }
  throw new Error('Le chargement vient d’être modifié par ailleurs : réessayez.');
}

/** Crée un chargement avec les palettes d'une palettisation et les relie ; renvoie le n° du chargement. */
export async function createShipmentForPalletization(orgId, pz, rows) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('shipments')
    .insert({ org_id: orgId, source: 'web', label: pz.label ? `Chargement — ${pz.label}` : undefined, input: { rows } })
    .select('id, code').single();
  fail(error);
  return linkPalletization(pz, data, null); // eslint-disable-line no-use-before-define
}

/** Chargements qui peuvent encore recevoir des palettes : Nouveau ou En cours (pas validés, envoyés ni annulés). */
export const OPEN_STATUSES = ['new', 'in_progress'];
export async function openShipments(orgId, limit = 50) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('shipments').select(LIST_FIELDS).eq('org_id', orgId).in('status', OPEN_STATUSES)
    .order('updated_at', { ascending: false }).limit(limit);
  fail(error);
  return withSummary(data);
}

/**
 * Relie une palettisation à un chargement. rows : ses palettes, écrites d'abord dans le chargement (null : déjà
 * fait à la création). Si elle alimentait un autre chargement encore modifiable, ses palettes en sont retirées
 * ensuite (lignes marquées de son n°) et le plan de ce chargement est à recalculer.
 */
export async function linkPalletization(pz, shipment, rows) {
  const sb = await getSupabase();
  if (rows) await putPalletsInShipment(shipment.id, pz.code, rows);
  const { error } = await sb.from('palletizations').update({ shipment_id: shipment.id }).eq('id', pz.id);
  fail(error);
  if (pz.shipment_id && pz.shipment_id !== shipment.id) {
    const { data: old } = await sb.from('shipments').select('id, status, input').eq('id', pz.shipment_id).maybeSingle();
    const oldRows = old?.input?.rows;
    if (old && OPEN_STATUSES.includes(old.status) && Array.isArray(oldRows) && oldRows.some((r) => r.origin === pz.code)) {
      const { error: e0 } = await sb.from('shipments').update({ input: { ...old.input, rows: oldRows.filter((r) => r.origin !== pz.code) }, result: null }).eq('id', old.id);
      fail(e0);
    }
  }
  return shipment.code;
}

// ---------------------------------------------------------------- Lien quai (cariste, sans compte)
/** Lien permanent d'un chargement : ouvre le dernier plan enregistré, sans compte. */
export const shareUrlOf = (doc) => (doc?.share_token ? `${window.location.origin}/q/${doc.share_token}` : null);

/** Chargement ouvert par son lien de partage (fonction de la base, accessible sans compte). */
export async function shipmentByToken(token) {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('shipment_by_token', { p_token: token });
  fail(error);
  return data?.[0] ?? null;
}

// ---------------------------------------------------------------- Mot de passe
/** Définit ou change le mot de passe (connexion sans attendre d'e-mail). */
export async function setPassword(password) {
  const sb = await getSupabase();
  const { error } = await sb.auth.updateUser({ password, data: { has_password: true } });
  if (error && /different from the old/i.test(error.message)) return; // même mot de passe : rien à faire
  if (error && /weak|at least/i.test(error.message)) throw new Error('Mot de passe trop simple : 8 caractères minimum, avec lettres et chiffres.');
  fail(error);
}

// ---------------------------------------------------------------- Équipe et invitations
export const ROLES = { owner: 'Propriétaire', admin: 'Administrateur', member: 'Membre' };

export async function orgMembers(orgId) {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('org_members', { p_org: orgId });
  fail(error);
  return data;
}

export async function setMemberRole(orgId, userId, role) {
  const sb = await getSupabase();
  const { error } = await sb.from('organization_members').update({ role }).eq('org_id', orgId).eq('user_id', userId);
  fail(error);
}

/** Retirer un membre (ou se retirer soi-même : quitter l'entreprise). */
export async function removeMember(orgId, userId) {
  const sb = await getSupabase();
  const { error } = await sb.from('organization_members').delete().eq('org_id', orgId).eq('user_id', userId);
  fail(error);
}

export async function listInvitations(orgId) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('invitations').select('id, email, role, created_at, expires_at').eq('org_id', orgId).order('created_at', { ascending: false });
  fail(error);
  return data;
}

export async function inviteMember(orgId, email, role) {
  const sb = await getSupabase();
  const { error } = await sb.rpc('invite_member', { p_org: orgId, p_email: email.trim().toLowerCase(), p_role: role });
  fail(error);
}

export async function revokeInvitation(id) {
  const sb = await getSupabase();
  const { error } = await sb.from('invitations').delete().eq('id', id);
  fail(error);
}

export async function myInvitations() {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('my_invitations');
  fail(error);
  return data ?? [];
}

export async function acceptInvitation(id) {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('accept_invitation', { p_id: id });
  fail(error);
  return data; // id de l'entreprise rejointe
}

export async function declineInvitation(id) {
  const sb = await getSupabase();
  const { error } = await sb.rpc('decline_invitation', { p_id: id });
  fail(error);
}

/** Lien et message d'invitation à envoyer au collègue (la création du compte se fait avec son adresse). */
export function invitationMessage(orgName, email) {
  const url = `${window.location.origin}/connexion?mode=inscription&email=${encodeURIComponent(email)}`;
  const text = `Bonjour,\n\nJe t’invite à rejoindre « ${orgName} » sur Atelier Logistique (chargements, palettisations, plans 3D).\n\n`
    + `1. Ouvre ce lien et crée ton compte avec l’adresse ${email} :\n${url}\n`
    + '2. Choisis ton mot de passe, connecte-toi et accepte l’invitation.\n\n'
    + 'Tu as déjà un compte avec cette adresse ? Connecte-toi simplement : l’invitation t’attend.';
  return { url, text, subject: `Invitation à rejoindre ${orgName} sur Atelier Logistique` };
}

// ---------------------------------------------------------------- Clés d'API
export async function listApiKeys(orgId) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('api_keys').select('id, name, prefix, created_at, last_used_at, revoked_at').eq('org_id', orgId).order('created_at', { ascending: false });
  fail(error);
  return data;
}

/** Crée une clé : renvoyée EN CLAIR une seule fois (la base n'en garde que l'empreinte). */
export async function createApiKey(orgId, name) {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('create_api_key', { p_org: orgId, p_name: name });
  fail(error);
  return data?.[0];
}

export async function revokeApiKey(id) {
  const sb = await getSupabase();
  const { error } = await sb.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id);
  fail(error);
}

/** Appels des 30 derniers jours (total et erreurs). */
export async function apiUsage(orgId) {
  const sb = await getSupabase();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const q = () => sb.from('usage_events').select('id', { count: 'exact', head: true }).eq('org_id', orgId).gte('created_at', since);
  const [all, errors] = await Promise.all([q(), q().gte('http_status', 400)]);
  fail(all.error); fail(errors.error);
  return { calls: all.count ?? 0, errors: errors.count ?? 0 };
}

// ---------------------------------------------------------------- Notifications (webhooks)
export const WEBHOOK_EVENTS = [
  { id: 'shipment.validated', label: 'Chargement validé' },
  { id: 'shipment.sent', label: 'Envoyé au quai' },
  { id: 'shipment.partially_loaded', label: 'Chargé en partie (flotte)' },
  { id: 'shipment.loaded', label: 'Chargé (photo du cariste)' },
  { id: 'shipment.cancelled', label: 'Annulé' },
  { id: 'shipment.reopened', label: 'Rouvert (après validation)' },
];

export async function listWebhooks(orgId) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('webhooks').select('id, url, description, events, secret, active, created_at, last_status, last_delivery_at, failure_count').eq('org_id', orgId).order('created_at');
  fail(error);
  return data;
}

export async function createWebhook(orgId, url, events, description) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('webhooks').insert({ org_id: orgId, url: url.trim(), events, description: description?.trim() || null }).select('id').single();
  if (error && /check constraint/i.test(error.message)) throw new Error('Adresse refusée : elle doit commencer par https:// et être publique (pas d’adresse locale).');
  fail(error);
  return data;
}

export async function updateWebhook(id, patch) {
  const sb = await getSupabase();
  const { error } = await sb.from('webhooks').update(patch).eq('id', id);
  fail(error);
}

export async function deleteWebhook(id) {
  const sb = await getSupabase();
  const { error } = await sb.from('webhooks').delete().eq('id', id);
  fail(error);
}

export async function testWebhook(id) {
  const sb = await getSupabase();
  const { error } = await sb.rpc('webhook_test', { p_webhook: id });
  fail(error);
}

export async function listDeliveries(orgId, limit = 15) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('webhook_deliveries').select('id, webhook_id, event, shipment_code, status, attempt, http_status, error, created_at, next_attempt_at').eq('org_id', orgId).order('created_at', { ascending: false }).limit(limit);
  fail(error);
  return data;
}

// ---------------------------------------------------------------- Preuve de chargement (photos du cariste)
const PROOF_BUCKET = 'preuves';

/** Cariste (sans compte) : envoie les photos dans le dossier du lien quai, puis confirme le chargement. */
export async function confirmLoadingWithPhotos(token, truck, name, blobs) {
  const sb = await getSupabase();
  const paths = [];
  for (const b of blobs) {
    const path = `${token}/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from(PROOF_BUCKET).upload(path, b, { contentType: 'image/jpeg', upsert: false });
    if (error) throw new Error(`Photo non envoyée : ${error.message}`);
    paths.push(path);
  }
  const { data, error } = await sb.rpc('confirm_loading', { p_token: token, p_truck: truck, p_name: name || null, p_photos: paths });
  fail(error);
  return data;
}

/** Preuves de chargement d'un chargement, avec des liens temporaires (1 h) vers les photos. */
export async function loadingProofs(shipmentId) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('shipment_loadings').select('id, truck, loaded_by, photos, created_at').eq('shipment_id', shipmentId).order('created_at', { ascending: false });
  fail(error);
  const all = data.flatMap((l) => l.photos);
  if (!all.length) return data.map((l) => ({ ...l, urls: [] }));
  const { data: signed, error: e2 } = await sb.storage.from(PROOF_BUCKET).createSignedUrls(all, 3600);
  fail(e2);
  const urlOf = Object.fromEntries((signed ?? []).map((x) => [x.path, x.signedUrl]));
  return data.map((l) => ({ ...l, urls: l.photos.map((p) => urlOf[p]).filter(Boolean) }));
}

/** Statut seul (léger) : suivi du chargement au quai pendant que la page est ouverte. */
export async function shipmentStatus(id) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('shipments').select('status, loaded_at, version, updated_at').eq('id', id).maybeSingle();
  fail(error);
  return data;
}
/** Chargements au quai : contenu figé (le verrou est aussi dans la base). */
export const DOCK_STATUSES = ['sent', 'partially_loaded', 'loaded'];

// ---------------------------------------------------------------- Tables de référence
// Véhicules / contenants, supports de palettisation, réglages (arrimage) de l'entreprise.

const REF_COLS = 'id, kind, code, label, data, active, sort';

export async function listReferences(orgId) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('reference_items').select(REF_COLS).eq('org_id', orgId).order('sort');
  fail(error);
  return data;
}

/** Création (sans id) ou modification. */
export async function saveReference(orgId, item) {
  const sb = await getSupabase();
  const row = { kind: item.kind, code: item.code.trim(), label: item.label.trim(), data: item.data, active: item.active, sort: Number(item.sort) || 0 };
  const q = item.id ? sb.from('reference_items').update(row).eq('id', item.id) : sb.from('reference_items').insert({ org_id: orgId, ...row });
  const { data, error } = await q.select(REF_COLS).single();
  if (error?.code === '23505') throw new Error(`Le code « ${row.code} » existe déjà.`);
  fail(error);
  return data;
}

export async function deleteReference(id) {
  const sb = await getSupabase();
  const { error } = await sb.from('reference_items').delete().eq('id', id);
  fail(error);
}

export async function resetReferences(orgId, kind) {
  const sb = await getSupabase();
  const { error } = await sb.rpc('reset_reference_items', { p_org: orgId, p_kind: kind });
  fail(error);
}

// ---------------------------------------------------------------- Regroupement de chargements
/** Statuts regroupables : pas encore au quai ni annulés. */
export const CONSOLIDABLE = ['new', 'in_progress', 'validated'];

/** Chargements datés à venir (depuis hier), avec leurs lignes, pour l'analyse des regroupements. */
export async function datedShipments(orgId) {
  const sb = await getSupabase();
  const since = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const { data, error } = await sb.from('shipments').select(`id, code, label, external_id, status, departure_at, tour, updated_at, input, ${SUMMARY}`)
    .eq('org_id', orgId).in('status', CONSOLIDABLE).gte('departure_at', since).order('departure_at').limit(300);
  fail(error);
  return data;
}

/**
 * Regroupe des chargements en une seule opération de la base (tout ou rien) : crée le chargement commun
 * (lignes fusionnées, flotte déjà calculée), y rattache leurs palettisations, annule les originaux (« → regroupé
 * dans PL-… »). La base revérifie que chaque original est encore regroupable et inchangé depuis l'analyse
 * (updated_at) ; sinon rien n'est fait. Renvoie le n° du nouveau chargement.
 */
export async function consolidateShipments(orgId, list, { rows, plan, summary, fleetVehicles, label, tour }) {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('consolidate_shipments', {
    p_org: orgId,
    p_sources: list.map((s) => ({ id: s.id, updated_at: s.updated_at })),
    p_label: label || `Regroupement ${list.map((s) => s.code).join(' + ')}`,
    p_departure: list[0].departure_at,
    p_input: { rows, vehicleMode: 'fleet', deliveryMode: 'STRICT', excludedStops: [], containerId: 'semi',
      custom: { label: 'Mon contenant', length: 600, width: 240, height: 240, maxWeight: '' }, fleetVehicles },
    p_result: { summary, plan: { fleet: plan, guides: null } },
  });
  if (error && /consolidate_shipments|schema cache|does not exist/i.test(error.message)) {
    throw new Error('Regroupement indisponible : exécutez le script SQL 20261125000010 dans Supabase.');
  }
  fail(error);
  // Tournée commune aux chargements regroupés : reportée sur le nouveau chargement.
  if (tour) await sb.from('shipments').update({ tour }).eq('org_id', orgId).eq('code', data);
  return data;
}

// ---------------------------------------------------------------- Calendrier des chargements
const CAL_FIELDS = `id, code, label, external_id, status, departure_at, tour, ${SUMMARY}, rows:input->rows`;

/** Chargements datés entre deux jours (AAAA-MM-JJ, inclus) + chargements à faire sans date (hors annulés). */
export async function calendarShipments(orgId, from, to) {
  const sb = await getSupabase();
  const [dated, undated] = await Promise.all([
    sb.from('shipments').select(CAL_FIELDS).eq('org_id', orgId).neq('status', 'cancelled')
      .gte('departure_at', `${from}T00:00:00Z`).lte('departure_at', `${to}T23:59:59Z`).order('departure_at').limit(500),
    sb.from('shipments').select(CAL_FIELDS).eq('org_id', orgId).in('status', ['new', 'in_progress', 'validated'])
      .is('departure_at', null).order('updated_at', { ascending: false }).limit(100),
  ]);
  fail(dated.error); fail(undated.error);
  return { dated: dated.data, undated: undated.data };
}

/** Change la date de départ (glisser-déposer du calendrier). day = AAAA-MM-JJ ou null. */
export async function setDeparture(id, day) {
  const sb = await getSupabase();
  const { error } = await sb.from('shipments').update({ departure_at: day ? `${day}T00:00:00.000Z` : null }).eq('id', id);
  fail(error);
}

// ---------------------------------------------------------------- Supprimer / dupliquer
const missingFn = (error, fn) => error && new RegExp(`${fn}|schema cache|does not exist`, 'i').test(error.message);

/**
 * Supprime définitivement un chargement et ses dépendances : palettisations, chargements regroupés dans
 * celui-ci, versions, confirmations ; photos de preuve effacées du stockage d'abord. Le WMS reçoit « annulé ».
 */
export async function deleteShipment(id) {
  const sb = await getSupabase();
  const { data: loads } = await sb.from('shipment_loadings').select('photos').eq('shipment_id', id);
  const photos = (loads ?? []).flatMap((l) => l.photos ?? []);
  if (photos.length) await sb.storage.from('preuves').remove(photos).catch(() => {}); // photos : au mieux
  const { data, error } = await sb.rpc('delete_shipment', { p_id: id });
  if (missingFn(error, 'delete_shipment')) throw new Error('Suppression indisponible : exécutez le script SQL 20261125000012 dans Supabase.');
  fail(error);
  return { ...data, photos: photos.length };
}

/** Supprime une palettisation ; ses palettes sont retirées de son chargement s'il est encore modifiable. */
export async function deletePalletization(id) {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('delete_palletization', { p_id: id });
  if (missingFn(error, 'delete_palletization')) throw new Error('Suppression indisponible : exécutez le script SQL 20261125000012 dans Supabase.');
  fail(error);
  return data;
}

/** Copie d'un document (saisie et plan) : nouveau n°, statut Nouveau, sans référence WMS ni date de départ. */
async function duplicate(table, doc) {
  const sb = await getSupabase();
  const { data, error } = await sb.from(table).insert({
    org_id: doc.org_id, source: 'web', status: 'new',
    label: `Copie de ${doc.label || doc.code}`.slice(0, 200),
    // Les lignes ne sont plus « reçues » d'une palettisation : la copie est indépendante.
    input: { ...(doc.input ?? {}), rows: (doc.input?.rows ?? []).map(({ origin, fromShipment, ...r }) => r) },
    result: doc.result ?? null,
    ...(doc.tour ? { tour: doc.tour } : {}),
    ...(doc.carrier ? { carrier: doc.carrier } : {}),
  }).select('code').single();
  fail(error);
  return data.code;
}
export const duplicateShipment = (doc) => duplicate('shipments', doc);
export const duplicatePalletization = (doc) => duplicate('palletizations', doc);

/** Nombre de chargements d'origine regroupés dans celui-ci (pour annoncer ce que la suppression emporte). */
export async function mergedCount(orgId, code) {
  const sb = await getSupabase();
  const { count } = await sb.from('shipments').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('merged_into', code);
  return count ?? 0;
}

// ---------------------------------------------------------------- Contrôle transport
const CONTROL_FIELDS = `id, code, label, external_id, status, departure_at, created_at, tour, carrier, carrier_cost, carrier_quote,
  invoiced_amount, invoiced_qty, invoice_ref, invoiced_on, ${SUMMARY}`;

/** Chargements d'un mois (date de départ, sinon de création) ayant un transporteur ; annulés et regroupés exclus. */
export async function controlShipments(orgId, month) {
  const sb = await getSupabase();
  const [y, m] = month.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const to = new Date(Date.UTC(y, m, 1)).toISOString();
  const { data, error } = await sb.from('shipments').select(CONTROL_FIELDS)
    .eq('org_id', orgId).not('carrier', 'is', null).neq('status', 'cancelled').is('merged_into', null)
    .or(`and(departure_at.gte.${from},departure_at.lt.${to}),and(departure_at.is.null,created_at.gte.${from},created_at.lt.${to})`)
    .order('departure_at', { ascending: true, nullsFirst: false }).limit(1000);
  fail(error);
  return data;
}

/** Facture transporteur d'un chargement (montant, quantité, n°) : colonnes hors verrou du quai. */
export async function saveInvoice(id, { invoiced_amount, invoiced_qty, invoice_ref }) {
  const sb = await getSupabase();
  const patch = {};
  if (invoiced_amount !== undefined) patch.invoiced_amount = invoiced_amount;
  if (invoiced_qty !== undefined) patch.invoiced_qty = invoiced_qty;
  if (invoice_ref !== undefined) patch.invoice_ref = invoice_ref || null;
  patch.invoiced_on = patch.invoiced_amount == null && invoiced_amount !== undefined ? null : new Date().toISOString().slice(0, 10);
  const { data, error } = await sb.from('shipments').update(patch).eq('id', id).select(CONTROL_FIELDS).single();
  fail(error);
  return data;
}
