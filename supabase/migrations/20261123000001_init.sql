-- =============================================================================================
-- Atelier Logistique — schéma initial (comptes, entreprises, chargements, clés d'API)
-- À exécuter une fois dans Supabase : SQL Editor → coller → Run.
-- Ré-exécutable sans danger (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).
--
-- Principes :
--   · Le site public n'utilise pas cette base : les outils restent sans compte.
--   · Chaque entreprise ne voit que ses données (RLS sur toutes les tables).
--   · Les clés d'API ne sont jamais stockées en clair (empreinte SHA-256).
--   · Les chargements expirent (90 jours par défaut, réglable par entreprise) puis sont purgés.
-- =============================================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- Entreprises et membres
create table if not exists public.organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(trim(name)) between 1 and 120),
  retention_days  integer not null default 90 check (retention_days between 1 and 3650),
  created_at      timestamptz not null default now()
);

create table if not exists public.organization_members (
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists organization_members_user_idx on public.organization_members(user_id);

-- Appartenance (security definer : évite la récursion des règles d'accès sur organization_members).
create or replace function public.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members where org_id = p_org and user_id = auth.uid());
$$;

create or replace function public.is_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members
                 where org_id = p_org and user_id = auth.uid() and role in ('owner', 'admin'));
$$;

-- Créer son entreprise : l'utilisateur connecté en devient propriétaire.
create or replace function public.create_organization(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  insert into public.organizations(name) values (trim(p_name)) returning id into v_id;
  insert into public.organization_members(org_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end $$;

-- ---------------------------------------------------------------- Chargements
-- Un chargement = un envoi (API, fichier ou site) : données reçues (input), plan calculé (result),
-- statut de travail et version. Le numéro lisible (PL-7F3K2) sert dans les échanges et sur les fiches.
create table if not exists public.shipments (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  code            text not null unique,
  external_id     text,                                    -- n° d'expédition du WMS / ERP
  source          text not null default 'web' check (source in ('api', 'file', 'web')),
  status          text not null default 'new'
                    check (status in ('new', 'in_progress', 'validated', 'sent', 'cancelled')),
  version         integer not null default 1,
  departure_at    timestamptz,
  label           text,
  input           jsonb not null default '{}'::jsonb,      -- lignes reçues (case / unit), options
  result          jsonb,                                   -- plan : palettes, véhicules, positions, séquence
  engine_version  text,
  share_token     text not null unique default encode(gen_random_bytes(18), 'hex'),
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  validated_at    timestamptz,
  expires_at      timestamptz not null default now() + interval '90 days',
  unique (org_id, external_id)
);
create index if not exists shipments_org_status_idx on public.shipments(org_id, status, departure_at);
create index if not exists shipments_expires_idx on public.shipments(expires_at);

-- Historique des versions du plan (chaque modification du résultat ou du statut).
create table if not exists public.shipment_versions (
  id           bigint generated always as identity primary key,
  shipment_id  uuid not null references public.shipments(id) on delete cascade,
  version      integer not null,
  status       text not null,
  result       jsonb,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (shipment_id, version)
);

-- Numéro lisible : PL- + 6 caractères sans ambiguïté (pas de 0/O, 1/I).
create or replace function public.new_shipment_code()
returns text language plpgsql as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v text;
begin
  loop
    v := 'PL-';
    for i in 1..6 loop v := v || substr(alphabet, 1 + floor(random() * 32)::int, 1); end loop;
    exit when not exists (select 1 from public.shipments where code = v);
  end loop;
  return v;
end $$;

create or replace function public.shipments_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.code := coalesce(new.code, public.new_shipment_code());
    new.expires_at := now() + make_interval(days => (select retention_days from public.organizations where id = new.org_id));
    new.created_by := coalesce(new.created_by, auth.uid());
    new.version := 1;
  else
    new.updated_at := now();
    -- Nouvelle version quand le plan ou le statut change.
    if new.result is distinct from old.result or new.status is distinct from old.status then
      new.version := old.version + 1;
    end if;
    if new.status = 'validated' and old.status is distinct from 'validated' then new.validated_at := now(); end if;
    -- Ces champs ne se modifient pas.
    new.org_id := old.org_id; new.code := old.code; new.created_at := old.created_at; new.share_token := old.share_token;
  end if;
  return new;
end $$;

create or replace function public.shipments_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.version <> old.version then
    insert into public.shipment_versions(shipment_id, version, status, result, created_by)
    values (new.id, new.version, new.status, new.result, auth.uid())
    on conflict (shipment_id, version) do nothing;
  end if;
  return null;
end $$;

drop trigger if exists shipments_before_write on public.shipments;
create trigger shipments_before_write before insert or update on public.shipments
  for each row execute function public.shipments_before_write();
drop trigger if exists shipments_after_write on public.shipments;
create trigger shipments_after_write after insert or update on public.shipments
  for each row execute function public.shipments_after_write();

-- Plan ouvert par lien de partage (cariste, transporteur) : sans compte, champs utiles seulement.
create or replace function public.shipment_by_token(p_token text)
returns table (code text, label text, status text, version integer, departure_at timestamptz, result jsonb)
language sql stable security definer set search_path = public as $$
  select s.code, s.label, s.status, s.version, s.departure_at, s.result
  from public.shipments s
  where s.share_token = p_token and s.expires_at > now() and s.status <> 'cancelled';
$$;

-- ---------------------------------------------------------------- Clés d'API et consommation
create table if not exists public.api_keys (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  name          text not null check (length(trim(name)) between 1 and 80),
  prefix        text not null,                 -- début de la clé, affiché pour la reconnaître
  key_hash      text not null unique,          -- SHA-256 de la clé complète (jamais la clé en clair)
  scopes        text[] not null default array['shipments:write', 'shipments:read'],
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);
create index if not exists api_keys_org_idx on public.api_keys(org_id);

-- Crée une clé et la renvoie EN CLAIR une seule fois (elle n'est ensuite plus lisible).
create or replace function public.create_api_key(p_org uuid, p_name text)
returns table (id uuid, key text, prefix text)
language plpgsql security definer set search_path = public, extensions as $$  -- pgcrypto est dans « extensions » sur Supabase
declare v_key text; v_id uuid; v_prefix text;
begin
  if not public.is_admin(p_org) then raise exception 'Réservé aux administrateurs de l''entreprise'; end if;
  v_key := 'al_live_' || encode(gen_random_bytes(24), 'hex');
  v_prefix := left(v_key, 14);
  insert into public.api_keys(org_id, name, prefix, key_hash, created_by)
  values (p_org, trim(p_name), v_prefix, encode(digest(v_key, 'sha256'), 'hex'), auth.uid())
  returning api_keys.id into v_id;
  return query select v_id, v_key, v_prefix;
end $$;

create table if not exists public.usage_events (
  id           bigint generated always as identity primary key,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  api_key_id   uuid references public.api_keys(id) on delete set null,
  endpoint     text not null,
  http_status  integer not null,
  items        integer not null default 0,
  duration_ms  integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists usage_events_org_time_idx on public.usage_events(org_id, created_at);

-- ---------------------------------------------------------------- Purge des chargements expirés
create or replace function public.purge_expired_shipments()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.shipments where expires_at < now();
  get diagnostics n = row_count;
  delete from public.usage_events where created_at < now() - interval '400 days';
  return n;
end $$;

-- ---------------------------------------------------------------- Règles d'accès (RLS)
alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;
alter table public.shipments            enable row level security;
alter table public.shipment_versions    enable row level security;
alter table public.api_keys             enable row level security;
alter table public.usage_events         enable row level security;

drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select to authenticated using (public.is_member(id));
drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations for update to authenticated using (public.is_admin(id)) with check (public.is_admin(id));
-- Création : uniquement via create_organization() ; suppression : non exposée.

drop policy if exists members_select on public.organization_members;
create policy members_select on public.organization_members for select to authenticated using (public.is_member(org_id));
drop policy if exists members_admin_insert on public.organization_members;
create policy members_admin_insert on public.organization_members for insert to authenticated with check (public.is_admin(org_id));
drop policy if exists members_admin_update on public.organization_members;
create policy members_admin_update on public.organization_members for update to authenticated using (public.is_admin(org_id)) with check (public.is_admin(org_id));
drop policy if exists members_delete on public.organization_members;
create policy members_delete on public.organization_members for delete to authenticated
  using (public.is_admin(org_id) or user_id = auth.uid());

drop policy if exists shipments_all on public.shipments;
create policy shipments_all on public.shipments for all to authenticated
  using (public.is_member(org_id)) with check (public.is_member(org_id));

drop policy if exists versions_select on public.shipment_versions;
create policy versions_select on public.shipment_versions for select to authenticated
  using (exists (select 1 from public.shipments s where s.id = shipment_id and public.is_member(s.org_id)));

drop policy if exists api_keys_select on public.api_keys;
create policy api_keys_select on public.api_keys for select to authenticated using (public.is_admin(org_id));
drop policy if exists api_keys_revoke on public.api_keys;
create policy api_keys_revoke on public.api_keys for update to authenticated using (public.is_admin(org_id)) with check (public.is_admin(org_id));
-- Création : uniquement via create_api_key().

drop policy if exists usage_select on public.usage_events;
create policy usage_select on public.usage_events for select to authenticated using (public.is_member(org_id));
-- Écriture : uniquement par l'API (clé serveur), aucune règle pour les utilisateurs.

-- Droits d'exécution des fonctions
revoke all on function public.create_organization(text), public.create_api_key(uuid, text),
  public.purge_expired_shipments(), public.shipment_by_token(text) from public;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.create_api_key(uuid, text) to authenticated;
grant execute on function public.shipment_by_token(text) to anon, authenticated;
grant execute on function public.is_member(uuid), public.is_admin(uuid) to authenticated;
