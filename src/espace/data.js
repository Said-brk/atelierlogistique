// Accès aux données de l'espace connecté (Supabase). Toutes les requêtes passent par les règles
// d'accès de la base : un utilisateur ne lit et n'écrit que dans son entreprise.

import { getSupabase } from '../shared/account/supabase';

export const STATUS = {
  new: { label: 'Nouveau', color: '#1D4ED8', bg: '#EFF6FF' },
  in_progress: { label: 'En cours', color: '#B45309', bg: '#FFFBEB' },
  validated: { label: 'Validé', color: '#15803D', bg: '#F0FDF4' },
  sent: { label: 'Envoyé au WMS', color: '#0F766E', bg: '#F0FDFA' },
  cancelled: { label: 'Annulé', color: '#64748B', bg: '#F1F5F9' },
};
export const SOURCE = { api: 'API', file: 'Fichier', web: 'Saisie' };

const fail = (error) => { if (error) throw new Error(error.message); };

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

const LIST_FIELDS = 'id, code, label, external_id, source, status, version, departure_at, created_at, updated_at, result';

export async function listShipments(orgId, { status = null, limit = 200 } = {}) {
  const sb = await getSupabase();
  let q = sb.from('shipments').select(LIST_FIELDS).eq('org_id', orgId).order('updated_at', { ascending: false }).limit(limit);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  fail(error);
  return data;
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
