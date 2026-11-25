-- =============================================================================================
-- Atelier Logistique — suppression définitive d'un chargement ou d'une palettisation (avec dépendances)
-- À exécuter une fois dans Supabase : SQL Editor → coller → Run. Ré-exécutable sans danger.
--
--  • delete_shipment : supprime le chargement, ses palettisations, les chargements d'origine regroupés
--    dans celui-ci, ses versions et confirmations de chargement. Le WMS est prévenu (« annulé ») avant.
--    Les photos de preuve sont effacées du stockage par l'application juste avant (règle preuves_delete).
--  • delete_palletization : supprime la palettisation et retire ses palettes de son chargement s'il est
--    encore modifiable ; refusé si ce chargement est au quai (le rouvrir ou le supprimer d'abord).
-- =============================================================================================

create or replace function public.delete_shipment(p_id uuid)
returns jsonb language plpgsql set search_path = public as $$
declare s public.shipments; n_pz integer; n_merged integer;
begin
  select * into s from public.shipments where id = p_id for update;
  if not found or not public.is_member(s.org_id) then raise exception 'Chargement introuvable'; end if;
  delete from public.palletizations where shipment_id = s.id;
  get diagnostics n_pz = row_count;
  delete from public.shipments where org_id = s.org_id and merged_into = s.code;
  get diagnostics n_merged = row_count;
  -- Prévenir le WMS / ERP (webhook « annulé ») avant la suppression.
  if s.status <> 'cancelled' then update public.shipments set status = 'cancelled' where id = s.id; end if;
  delete from public.shipments where id = s.id;
  return jsonb_build_object('code', s.code, 'palletizations', n_pz, 'merged', n_merged);
end $$;
revoke all on function public.delete_shipment(uuid) from public, anon;
grant execute on function public.delete_shipment(uuid) to authenticated;

create or replace function public.delete_palletization(p_id uuid)
returns jsonb language plpgsql set search_path = public as $$
declare pz public.palletizations; s public.shipments; n_rows integer := 0;
begin
  select * into pz from public.palletizations where id = p_id for update;
  if not found or not public.is_member(pz.org_id) then raise exception 'Palettisation introuvable'; end if;
  if pz.shipment_id is not null then
    select * into s from public.shipments where id = pz.shipment_id for update;
    if found and s.status in ('sent', 'partially_loaded', 'loaded') then
      raise exception 'Ses palettes sont dans le chargement % au quai : rouvrez ou supprimez d''abord ce chargement.', s.code using errcode = 'check_violation';
    end if;
    if found and s.status <> 'cancelled' then
      select count(*) into n_rows from jsonb_array_elements(coalesce(s.input->'rows', '[]')) r where r->>'origin' = pz.code;
      if n_rows > 0 then
        update public.shipments
           set input = jsonb_set(input, '{rows}', (select coalesce(jsonb_agg(r), '[]'::jsonb)
                                                   from jsonb_array_elements(input->'rows') r where r->>'origin' is distinct from pz.code)),
               result = null,
               status = case when status = 'validated' then 'in_progress' else status end
         where id = s.id;
      end if;
    end if;
  end if;
  delete from public.palletizations where id = pz.id;
  return jsonb_build_object('code', pz.code, 'shipment', s.code, 'removed_rows', n_rows);
end $$;
revoke all on function public.delete_palletization(uuid) from public, anon;
grant execute on function public.delete_palletization(uuid) to authenticated;

-- Photos de preuve : effaçables par l'entreprise (avant la suppression du chargement).
do $$ begin
  drop policy if exists preuves_delete on storage.objects;
  create policy preuves_delete on storage.objects for delete to authenticated
    using (bucket_id = 'preuves' and public.can_read_proof(name));
exception when undefined_table or invalid_schema_name then raise notice 'Stockage Supabase absent.';
end $$;
