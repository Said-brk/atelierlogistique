-- =============================================================================================
-- Atelier Logistique — palettisations (et lien vers les chargements)
-- À exécuter après 20261123000001_init.sql : SQL Editor → coller → Run. Ré-exécutable.
--
-- Une palettisation = des colis transformés en palettes (n° PZ-XXXXXX).
-- « Charger le camion » la rattache à un chargement (shipment_id) : plusieurs palettisations
-- (commandes, clients) peuvent alimenter le même chargement.
-- =============================================================================================

create table if not exists public.palletizations (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  code            text not null unique,
  external_id     text,                                    -- n° de commande / préparation du WMS / ERP
  source          text not null default 'web' check (source in ('api', 'file', 'web')),
  status          text not null default 'new'
                    check (status in ('new', 'in_progress', 'validated', 'sent', 'cancelled')),
  version         integer not null default 1,
  label           text,
  input           jsonb not null default '{}'::jsonb,      -- colis, supports disponibles, règles
  result          jsonb,                                   -- résumé : palettes, types, poids, non palettisés
  shipment_id     uuid references public.shipments(id) on delete set null,   -- chargement alimenté
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  validated_at    timestamptz,
  expires_at      timestamptz not null default now() + interval '90 days',
  unique (org_id, external_id)
);
create index if not exists palletizations_org_status_idx on public.palletizations(org_id, status, updated_at);
create index if not exists palletizations_shipment_idx on public.palletizations(shipment_id);
create index if not exists palletizations_expires_idx on public.palletizations(expires_at);

-- Numéro lisible : PZ- + 6 caractères sans ambiguïté.
create or replace function public.new_palletization_code()
returns text language plpgsql as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v text;
begin
  loop
    v := 'PZ-';
    for i in 1..6 loop v := v || substr(alphabet, 1 + floor(random() * 32)::int, 1); end loop;
    exit when not exists (select 1 from public.palletizations where code = v);
  end loop;
  return v;
end $$;

create or replace function public.palletizations_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.code := coalesce(new.code, public.new_palletization_code());
    new.expires_at := now() + make_interval(days => (select retention_days from public.organizations where id = new.org_id));
    new.created_by := coalesce(new.created_by, auth.uid());
    new.version := 1;
  else
    new.updated_at := now();
    if new.result is distinct from old.result or new.status is distinct from old.status then
      new.version := old.version + 1;
    end if;
    if new.status = 'validated' and old.status is distinct from 'validated' then new.validated_at := now(); end if;
    new.org_id := old.org_id; new.code := old.code; new.created_at := old.created_at;
  end if;
  -- Le chargement rattaché doit appartenir à la même entreprise.
  if new.shipment_id is not null and not exists (
    select 1 from public.shipments s where s.id = new.shipment_id and s.org_id = new.org_id
  ) then
    raise exception 'Chargement introuvable dans cette entreprise';
  end if;
  return new;
end $$;

drop trigger if exists palletizations_before_write on public.palletizations;
create trigger palletizations_before_write before insert or update on public.palletizations
  for each row execute function public.palletizations_before_write();

-- Purge : palettisations expirées aussi.
create or replace function public.purge_expired_shipments()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.shipments where expires_at < now();
  get diagnostics n = row_count;
  delete from public.palletizations where expires_at < now();
  delete from public.usage_events where created_at < now() - interval '400 days';
  return n;
end $$;

alter table public.palletizations enable row level security;
drop policy if exists palletizations_all on public.palletizations;
create policy palletizations_all on public.palletizations for all to authenticated
  using (public.is_member(org_id)) with check (public.is_member(org_id));

revoke all on function public.purge_expired_shipments() from public;
