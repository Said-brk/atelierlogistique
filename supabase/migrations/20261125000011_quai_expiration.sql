-- =============================================================================================
-- Atelier Logistique — lien quai fiabilisé et expiration glissante (audit n°5 et n°7)
-- À exécuter une fois dans Supabase : SQL Editor → coller → Run. Ré-exécutable sans danger.
--
--  • Confirmation du cariste : seulement pour un chargement au quai (Envoyé / Chargé en partie / Chargé) —
--    jamais pour un chargement rouvert — et pour un n° de camion qui existe dans le plan.
--  • Nouvel envoi au quai après réouverture : les confirmations précédentes ne comptent plus (sent_at) ;
--    les photos restent consultables.
--  • Expiration : repoussée à chaque modification (durée de conservation de l'entreprise) au lieu d'être
--    fixée à la création — un document actif n'expire plus, ni son lien quai.
-- =============================================================================================

alter table public.shipments add column if not exists sent_at timestamptz;

create or replace function public.shipments_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_days integer;
begin
  select retention_days into v_days from public.organizations where id = coalesce(new.org_id, old.org_id);
  if tg_op = 'INSERT' then
    new.code := coalesce(new.code, public.new_shipment_code());
    new.expires_at := now() + make_interval(days => v_days);
    new.created_by := coalesce(new.created_by, auth.uid());
    new.version := 1;
    if new.status = 'sent' then new.sent_at := now(); end if;
  else
    new.updated_at := now();
    -- Expiration repoussée à chaque modification (sauf si elle est elle-même modifiée).
    if new.expires_at is not distinct from old.expires_at then new.expires_at := now() + make_interval(days => v_days); end if;
    -- Nouvelle version quand le plan ou le statut change.
    if new.result is distinct from old.result or new.status is distinct from old.status then
      new.version := old.version + 1;
    end if;
    if new.status = 'validated' and old.status is distinct from 'validated' then new.validated_at := now(); end if;
    -- (Re)mise au quai : nouveau tour de confirmations.
    if new.status = 'sent' and old.status not in ('sent', 'partially_loaded', 'loaded') then
      new.sent_at := now(); new.loaded_at := null;
    end if;
    -- Ces champs ne se modifient pas.
    new.org_id := old.org_id; new.code := old.code; new.created_at := old.created_at; new.share_token := old.share_token;
  end if;
  return new;
end $$;

create or replace function public.palletizations_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_days integer;
begin
  select retention_days into v_days from public.organizations where id = coalesce(new.org_id, old.org_id);
  if tg_op = 'INSERT' then
    new.code := coalesce(new.code, public.new_palletization_code());
    new.expires_at := now() + make_interval(days => v_days);
    new.created_by := coalesce(new.created_by, auth.uid());
    new.version := 1;
  else
    new.updated_at := now();
    if new.expires_at is not distinct from old.expires_at then new.expires_at := now() + make_interval(days => v_days); end if;
    if new.result is distinct from old.result or new.status is distinct from old.status then
      new.version := old.version + 1;
    end if;
    if new.status = 'validated' and old.status is distinct from 'validated' then new.validated_at := now(); end if;
    new.org_id := old.org_id; new.code := old.code; new.created_at := old.created_at;
  end if;
  if new.shipment_id is not null and not exists (
    select 1 from public.shipments s where s.id = new.shipment_id and s.org_id = new.org_id
  ) then
    raise exception 'Chargement introuvable dans cette entreprise';
  end if;
  return new;
end $$;

-- Lien quai : camions confirmés depuis le dernier envoi au quai.
drop function if exists public.shipment_by_token(text);
create function public.shipment_by_token(p_token text)
returns table (code text, label text, status text, version integer, departure_at timestamptz, result jsonb, loaded_at timestamptz, loaded_trucks integer[])
language sql stable security definer set search_path = public as $$
  select s.code, s.label, s.status, s.version, s.departure_at, s.result, s.loaded_at,
         array(select distinct l.truck from public.shipment_loadings l
               where l.shipment_id = s.id and l.created_at >= coalesce(s.sent_at, '-infinity'::timestamptz) order by 1)
  from public.shipments s
  where s.share_token = p_token and s.expires_at > now() and s.status <> 'cancelled';
$$;
revoke all on function public.shipment_by_token(text) from public;
grant execute on function public.shipment_by_token(text) to anon, authenticated;

create or replace function public.confirm_loading(p_token text, p_truck integer default 1, p_name text default null, p_photos text[] default '{}')
returns timestamptz language plpgsql security definer set search_path = public as $$
declare s public.shipments; n_trucks integer; n_done integer;
begin
  select * into s from public.shipments where share_token = p_token and expires_at > now() for update;
  if not found or s.status = 'cancelled' then raise exception 'Lien de chargement invalide, expiré ou annulé'; end if;
  if s.status not in ('sent', 'partially_loaded', 'loaded') then
    raise exception 'Ce chargement est en cours de modification au bureau : attendez qu''il soit renvoyé au quai.' using errcode = 'check_violation';
  end if;
  n_trucks := greatest(1, coalesce(jsonb_array_length(s.result->'plan'->'guides'), 1));
  if p_truck is null or p_truck < 1 or p_truck > n_trucks then
    raise exception 'Camion % inconnu : ce plan compte % camion(s).', p_truck, n_trucks using errcode = 'check_violation';
  end if;
  if coalesce(array_length(p_photos, 1), 0) > 6 then raise exception '6 photos au maximum'; end if;
  if exists (select 1 from unnest(p_photos) p where p !~ ('^' || p_token || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')) then
    raise exception 'Photo invalide';
  end if;
  insert into public.shipment_loadings(shipment_id, org_id, truck, loaded_by, photos)
  values (s.id, s.org_id, p_truck, nullif(left(trim(p_name), 80), ''), p_photos);
  select count(distinct truck) into n_done from public.shipment_loadings
   where shipment_id = s.id and created_at >= coalesce(s.sent_at, '-infinity'::timestamptz);
  if n_done >= n_trucks and s.status <> 'loaded' then
    update public.shipments set status = 'loaded', loaded_at = now() where id = s.id;
  elsif n_done < n_trucks and s.status not in ('partially_loaded', 'loaded') then
    update public.shipments set status = 'partially_loaded' where id = s.id;
  end if;
  return now();
end $$;
revoke all on function public.confirm_loading(text, integer, text, text[]) from public;
grant execute on function public.confirm_loading(text, integer, text, text[]) to anon, authenticated;

-- Photos : seulement pour un chargement au quai.
create or replace function public.can_upload_proof(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_name ~ '^[0-9a-f]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
     and exists (select 1 from public.shipments s where s.share_token = split_part(p_name, '/', 1)
                 and s.expires_at > now() and s.status in ('sent', 'partially_loaded', 'loaded'));
$$;
grant execute on function public.can_upload_proof(text) to anon, authenticated;
