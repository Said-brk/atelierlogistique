-- =============================================================================================
-- Correctif : création des clés d'API. Sur Supabase, pgcrypto (gen_random_bytes, digest) est installé
-- dans le schéma « extensions », absent du search_path de la fonction → « function gen_random_bytes does not exist ».
-- À exécuter une fois dans Supabase : SQL Editor → coller → Run. Ré-exécutable sans danger.
-- =============================================================================================
create or replace function public.create_api_key(p_org uuid, p_name text)
returns table (id uuid, key text, prefix text)
language plpgsql security definer set search_path = public, extensions as $$
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
