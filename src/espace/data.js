// Accès aux données de l'espace connecté (Supabase). Toutes les requêtes passent par les règles
// d'accès de la base : un utilisateur ne lit et n'écrit que dans son entreprise.

import { getSupabase } from '../shared/account/supabase';

export const STATUS = {
  new: { label: 'Nouveau', color: '#1D4ED8', bg: '#EFF6FF' },
  in_progress: { label: 'En cours', color: '#B45309', bg: '#FFFBEB' },
  validated: { label: 'Validé', color: '#15803D', bg: '#F0FDF4' },
  sent: { label: 'Envoyé', color: '#0F766E', bg: '#F0FDFA' },
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

const LIST_FIELDS = `id, code, label, external_id, source, status, version, departure_at, created_at, updated_at, ${SUMMARY}, palletizations(code)`;

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

export async function updateShipment(id, patch) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('shipments').update(patch).eq('id', id).select('*').single();
  fail(error);
  return data;
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

export async function updatePalletization(id, patch) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('palletizations').update(patch).eq('id', id).select('*, shipments(code, label)').single();
  fail(error);
  return data;
}

/** Palettisations qui alimentent un chargement (navigation chargement → palettes). */
export async function palletizationsOfShipment(shipmentId) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('palletizations').select(`code, label, ${SUMMARY}`).eq('shipment_id', shipmentId).order('created_at');
  fail(error);
  return withSummary(data);
}

/** Crée un chargement pour une palettisation et les relie ; renvoie le n° du chargement. */
export async function createShipmentForPalletization(orgId, pz) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('shipments')
    .insert({ org_id: orgId, source: 'web', label: pz.label ? `Chargement — ${pz.label}` : undefined, input: { rows: [] } })
    .select('id, code').single();
  fail(error);
  const { error: e2 } = await sb.from('palletizations').update({ shipment_id: data.id }).eq('id', pz.id);
  fail(e2);
  return data.code;
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
