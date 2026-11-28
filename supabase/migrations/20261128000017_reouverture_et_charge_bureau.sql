-- =============================================================================================
-- Atelier Logistique — réouverture signalée au cariste, et « Marquer chargé » depuis le bureau
-- À exécuter une fois dans Supabase : SQL Editor → coller → Run. Ré-exécutable sans danger.
--
--  • Réouverture : on note qui a rouvert et quand (reopened_by / reopened_at). Le lien quai le renvoie :
--    le cariste voit une alerte, mais il n'est plus bloqué (il peut toujours confirmer son camion).
--  • Confirmation du cariste sur un chargement rouvert : acceptée si le chargement a déjà été envoyé
--    au quai au moins une fois. Le terrain fait foi : le statut passe « Chargé » / « Chargé en partie ».
--  • « Marquer chargé » depuis l'espace (sans QR code) : mark_shipment_loaded(id).
-- =============================================================================================

alter table public.shipments add column if not exists reopened_at timestamptz;
alter table public.shipments add column if not exists reopened_by text;

-- Nom court de l'utilisateur connecté (nom du profil, sinon début de l'adresse e-mail).
create or replace function public.actor_name()
returns text language sql stable security definer set search_path = public as $$
  select left(coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)), 80)
  from auth.users u where u.id = auth.uid();
$$;
revoke all on function public.actor_name() from public;
grant execute on function public.actor_name() to authenticated;

-- Reprise de shipments_before_write (migration 11) + horodatage de la réouverture.
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
    if new.expires_at is not distinct from old.expires_at then new.expires_at := now() + make_interval(days => v_days); end if;
    if new.result is distinct from old.result or new.status is distinct from old.status then
      new.version := old.version + 1;
    end if;
    if new.status = 'validated' and old.status is distinct from 'validated' then new.validated_at := now(); end if;
    if new.status = 'sent' and old.status not in ('sent', 'partially_loaded', 'loaded') then
      new.sent_at := now(); new.loaded_at := null;
    end if;
    -- Réouverture : qui et quand (affiché au cariste sur le lien quai).
    if old.status in ('validated', 'sent', 'partially_loaded', 'loaded') and new.status in ('new', 'in_progress') then
      new.reopened_at := now(); new.reopened_by := coalesce(public.actor_name(), 'WMS / ERP');
    end if;
    new.org_id := old.org_id; new.code := old.code; new.created_at := old.created_at; new.share_token := old.share_token;
  end if;
  return new;
end $$;

-- Lien quai : + date d'envoi et réouverture.
drop function if exists public.shipment_by_token(text);
create function public.shipment_by_token(p_token text)
returns table (code text, label text, status text, version integer, departure_at timestamptz, result jsonb, loaded_at timestamptz,
               loaded_trucks integer[], sent_at timestamptz, reopened_at timestamptz, reopened_by text)
language sql stable security definer set search_path = public as $$
  select s.code, s.label, s.status, s.version, s.departure_at, s.result, s.loaded_at,
         array(select distinct l.truck from public.shipment_loadings l
               where l.shipment_id = s.id and l.created_at >= coalesce(s.sent_at, '-infinity'::timestamptz) order by 1),
         s.sent_at, s.reopened_at, s.reopened_by
  from public.shipments s
  where s.share_token = p_token and s.expires_at > now() and s.status <> 'cancelled';
$$;
revoke all on function public.shipment_by_token(text) from public;
grant execute on function public.shipment_by_token(text) to anon, authenticated;

-- Fin de chargement par le cariste : plus de blocage si le chargement a été rouvert après un envoi au quai.
create or replace function public.confirm_loading(p_token text, p_truck integer default 1, p_name text default null, p_photos text[] default '{}')
returns timestamptz language plpgsql security definer set search_path = public as $$
declare s public.shipments; n_trucks integer; n_done integer;
begin
  select * into s from public.shipments where share_token = p_token and expires_at > now() for update;
  if not found or s.status = 'cancelled' then raise exception 'Lien de chargement invalide, expiré ou annulé'; end if;
  if s.status not in ('sent', 'partially_loaded', 'loaded') and s.sent_at is null then
    raise exception 'Ce chargement n''a pas encore été envoyé au quai.' using errcode = 'check_violation';
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

-- Photos : chargement au quai, ou rouvert après un envoi au quai.
create or replace function public.can_upload_proof(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_name ~ '^[0-9a-f]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
     and exists (select 1 from public.shipments s where s.share_token = split_part(p_name, '/', 1)
                 and s.expires_at > now() and s.status <> 'cancelled'
                 and (s.status in ('sent', 'partially_loaded', 'loaded') or s.sent_at is not null));
$$;
grant execute on function public.can_upload_proof(text) to anon, authenticated;

-- « Marquer chargé » depuis l'espace : tous les camions pas encore confirmés, au nom de l'utilisateur.
create or replace function public.mark_shipment_loaded(p_id uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare s public.shipments; n_trucks integer; who text;
begin
  select * into s from public.shipments where id = p_id for update;
  if not found or not public.is_member(s.org_id) then raise exception 'Chargement introuvable'; end if;
  if s.status = 'cancelled' then raise exception 'Chargement % annulé', s.code using errcode = 'check_violation'; end if;
  if s.status = 'loaded' then return s.loaded_at; end if;
  if s.result->'plan' is null then
    raise exception 'Lancez d''abord l''optimisation de % : il n''y a pas de plan.', s.code using errcode = 'check_violation';
  end if;
  n_trucks := greatest(1, coalesce(jsonb_array_length(s.result->'plan'->'guides'), 1));
  who := left('Bureau · ' || coalesce(public.actor_name(), '?'), 80);
  insert into public.shipment_loadings(shipment_id, org_id, truck, loaded_by, photos)
  select s.id, s.org_id, t, who, '{}' from generate_series(1, n_trucks) t
  where not exists (select 1 from public.shipment_loadings l where l.shipment_id = s.id and l.truck = t
                    and l.created_at >= coalesce(s.sent_at, '-infinity'::timestamptz));
  update public.shipments set status = 'loaded', loaded_at = now() where id = s.id;
  return now();
end $$;
revoke all on function public.mark_shipment_loaded(uuid) from public;
grant execute on function public.mark_shipment_loaded(uuid) to authenticated;
