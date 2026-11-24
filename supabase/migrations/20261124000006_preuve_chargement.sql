-- =============================================================================================
-- Atelier Logistique — statut « Chargé » et preuve de chargement (photos du cariste)
-- À exécuter une fois dans Supabase : SQL Editor → coller → Run. Ré-exécutable sans danger.
--
-- Le cariste, depuis le lien quai (sans compte), termine le chargement : il prend une ou plusieurs photos
-- du camion chargé et confirme. Le chargement passe « Chargé » (flotte : quand tous les camions sont confirmés).
-- Photos : stockage privé « preuves », chemin <jeton du lien>/<id>.jpg ; lisibles par l'entreprise seulement.
-- =============================================================================================

-- Nouveau statut « loaded » (Chargé).
alter table public.shipments drop constraint if exists shipments_status_check;
alter table public.shipments add constraint shipments_status_check
  check (status in ('new', 'in_progress', 'validated', 'sent', 'loaded', 'cancelled'));
alter table public.shipments add column if not exists loaded_at timestamptz;

-- Confirmations de chargement (une par camion ; la dernière fait foi).
create table if not exists public.shipment_loadings (
  id           uuid primary key default gen_random_uuid(),
  shipment_id  uuid not null references public.shipments(id) on delete cascade,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  truck        integer not null default 1 check (truck between 1 and 50),
  loaded_by    text check (length(loaded_by) <= 80),
  photos       text[] not null default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists shipment_loadings_shipment_idx on public.shipment_loadings(shipment_id, created_at desc);
alter table public.shipment_loadings enable row level security;
drop policy if exists shipment_loadings_member on public.shipment_loadings;
create policy shipment_loadings_member on public.shipment_loadings for select to authenticated using (public.is_member(org_id));

-- Lien quai : le statut et l'heure de fin sont renvoyés au guide (camions déjà confirmés).
drop function if exists public.shipment_by_token(text);
create function public.shipment_by_token(p_token text)
returns table (code text, label text, status text, version integer, departure_at timestamptz, result jsonb, loaded_at timestamptz, loaded_trucks integer[])
language sql stable security definer set search_path = public as $$
  select s.code, s.label, s.status, s.version, s.departure_at, s.result, s.loaded_at,
         array(select distinct l.truck from public.shipment_loadings l where l.shipment_id = s.id order by 1)
  from public.shipments s
  where s.share_token = p_token and s.expires_at > now() and s.status <> 'cancelled';
$$;
revoke all on function public.shipment_by_token(text) from public;
grant execute on function public.shipment_by_token(text) to anon, authenticated;

-- Fin de chargement par le cariste (sans compte, avec le jeton du lien quai).
create or replace function public.confirm_loading(p_token text, p_truck integer default 1, p_name text default null, p_photos text[] default '{}')
returns timestamptz language plpgsql security definer set search_path = public as $$
declare s public.shipments; n_trucks integer; n_done integer;
begin
  select * into s from public.shipments
  where share_token = p_token and expires_at > now() and status in ('in_progress', 'validated', 'sent', 'loaded');
  if not found then raise exception 'Lien de chargement invalide, expiré ou annulé'; end if;
  if coalesce(array_length(p_photos, 1), 0) > 6 then raise exception '6 photos au maximum'; end if;
  if exists (select 1 from unnest(p_photos) p where p !~ ('^' || p_token || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')) then
    raise exception 'Photo invalide';
  end if;
  insert into public.shipment_loadings(shipment_id, org_id, truck, loaded_by, photos)
  values (s.id, s.org_id, greatest(1, coalesce(p_truck, 1)), nullif(left(trim(p_name), 80), ''), p_photos);
  -- Chargé quand chaque camion (flotte) a été confirmé.
  n_trucks := greatest(1, coalesce(jsonb_array_length(s.result->'plan'->'guides'), 1));
  select count(distinct truck) into n_done from public.shipment_loadings where shipment_id = s.id;
  if n_done >= n_trucks and s.status <> 'loaded' then
    update public.shipments set status = 'loaded', loaded_at = now() where id = s.id;
  end if;
  return now();
end $$;
revoke all on function public.confirm_loading(text, integer, text, text[]) from public;
grant execute on function public.confirm_loading(text, integer, text, text[]) to anon, authenticated;

-- Notification automatique « shipment.loaded » (webhooks) : même déclencheur, évènement en plus.
create or replace function public.shipments_webhooks()
returns trigger language plpgsql security definer set search_path = public as $$
declare ev text;
begin
  if new.status is not distinct from old.status then return null; end if;
  ev := case
    when new.status = 'validated' then 'shipment.validated'
    when new.status = 'sent' then 'shipment.sent'
    when new.status = 'loaded' then 'shipment.loaded'
    when new.status = 'cancelled' then 'shipment.cancelled'
    when old.status in ('validated', 'sent', 'loaded') and new.status in ('new', 'in_progress') then 'shipment.reopened'
  end;
  if ev is not null and exists (select 1 from public.webhooks where org_id = new.org_id and active) then
    perform public.webhook_enqueue(new.org_id, ev, new.code, public.webhook_shipment_data(new));
  end if;
  return null;
end $$;

-- Stockage privé des photos (Supabase Storage). Ignoré hors Supabase.
create or replace function public.can_upload_proof(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_name ~ '^[0-9a-f]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
     and exists (select 1 from public.shipments s where s.share_token = split_part(p_name, '/', 1)
                 and s.expires_at > now() and s.status in ('in_progress', 'validated', 'sent', 'loaded'));
$$;
create or replace function public.can_read_proof(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shipments s where s.share_token = split_part(p_name, '/', 1) and public.is_member(s.org_id));
$$;
grant execute on function public.can_upload_proof(text) to anon, authenticated;
grant execute on function public.can_read_proof(text) to authenticated;

do $$ begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('preuves', 'preuves', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  drop policy if exists preuves_upload on storage.objects;
  create policy preuves_upload on storage.objects for insert to anon, authenticated
    with check (bucket_id = 'preuves' and public.can_upload_proof(name));
  drop policy if exists preuves_read on storage.objects;
  create policy preuves_read on storage.objects for select to authenticated
    using (bucket_id = 'preuves' and public.can_read_proof(name));
exception when undefined_table or invalid_schema_name then raise notice 'Stockage Supabase absent : photos non configurées.';
end $$;
