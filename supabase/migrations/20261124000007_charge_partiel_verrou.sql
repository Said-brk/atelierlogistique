-- =============================================================================================
-- Atelier Logistique — « Chargé en partie » (flotte) et chargement figé une fois envoyé au quai
-- À exécuter une fois dans Supabase : SQL Editor → coller → Run. Ré-exécutable sans danger.
--
--  • Flotte : dès qu'un camion est confirmé chargé par le cariste → « Chargé en partie » ;
--    tous les camions confirmés → « Chargé ».
--  • Sécurité : un chargement envoyé au quai, chargé en partie ou chargé ne peut plus changer de contenu
--    (marchandises, véhicules, plan, flotte). Pour le modifier : « Rouvrir » (il repasse « En cours »).
-- =============================================================================================

alter table public.shipments drop constraint if exists shipments_status_check;
alter table public.shipments add constraint shipments_status_check
  check (status in ('new', 'in_progress', 'validated', 'sent', 'partially_loaded', 'loaded', 'cancelled'));

-- Verrou : contenu figé tant que le chargement est au quai (sauf réouverture explicite).
create or replace function public.shipments_lock()
returns trigger language plpgsql as $$
begin
  if old.status in ('sent', 'partially_loaded', 'loaded')
     and new.status not in ('new', 'in_progress', 'cancelled')
     and (new.input is distinct from old.input or new.result is distinct from old.result) then
    raise exception 'Chargement % envoyé au quai : rouvrez-le pour le modifier', old.code using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists shipments_lock on public.shipments;
create trigger shipments_lock before update on public.shipments for each row execute function public.shipments_lock();

-- Fin de chargement d'un camion par le cariste.
create or replace function public.confirm_loading(p_token text, p_truck integer default 1, p_name text default null, p_photos text[] default '{}')
returns timestamptz language plpgsql security definer set search_path = public as $$
declare s public.shipments; n_trucks integer; n_done integer;
begin
  select * into s from public.shipments
  where share_token = p_token and expires_at > now() and status in ('in_progress', 'validated', 'sent', 'partially_loaded', 'loaded');
  if not found then raise exception 'Lien de chargement invalide, expiré ou annulé'; end if;
  if coalesce(array_length(p_photos, 1), 0) > 6 then raise exception '6 photos au maximum'; end if;
  if exists (select 1 from unnest(p_photos) p where p !~ ('^' || p_token || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')) then
    raise exception 'Photo invalide';
  end if;
  insert into public.shipment_loadings(shipment_id, org_id, truck, loaded_by, photos)
  values (s.id, s.org_id, greatest(1, coalesce(p_truck, 1)), nullif(left(trim(p_name), 80), ''), p_photos);
  n_trucks := greatest(1, coalesce(jsonb_array_length(s.result->'plan'->'guides'), 1));
  select count(distinct truck) into n_done from public.shipment_loadings where shipment_id = s.id;
  if n_done >= n_trucks and s.status <> 'loaded' then
    update public.shipments set status = 'loaded', loaded_at = now() where id = s.id;
  elsif n_done < n_trucks and s.status not in ('partially_loaded', 'loaded') then
    update public.shipments set status = 'partially_loaded' where id = s.id;
  end if;
  return now();
end $$;
revoke all on function public.confirm_loading(text, integer, text, text[]) from public;
grant execute on function public.confirm_loading(text, integer, text, text[]) to anon, authenticated;

create or replace function public.can_upload_proof(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_name ~ '^[0-9a-f]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
     and exists (select 1 from public.shipments s where s.share_token = split_part(p_name, '/', 1)
                 and s.expires_at > now() and s.status in ('in_progress', 'validated', 'sent', 'partially_loaded', 'loaded'));
$$;

-- Notifications : « shipment.partially_loaded » en plus.
create or replace function public.shipments_webhooks()
returns trigger language plpgsql security definer set search_path = public as $$
declare ev text;
begin
  if new.status is not distinct from old.status then return null; end if;
  ev := case
    when new.status = 'validated' then 'shipment.validated'
    when new.status = 'sent' then 'shipment.sent'
    when new.status = 'partially_loaded' then 'shipment.partially_loaded'
    when new.status = 'loaded' then 'shipment.loaded'
    when new.status = 'cancelled' then 'shipment.cancelled'
    when old.status in ('validated', 'sent', 'partially_loaded', 'loaded') and new.status in ('new', 'in_progress') then 'shipment.reopened'
  end;
  if ev is not null and exists (select 1 from public.webhooks where org_id = new.org_id and active) then
    perform public.webhook_enqueue(new.org_id, ev, new.code, public.webhook_shipment_data(new));
  end if;
  return null;
end $$;
