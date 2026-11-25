-- =============================================================================================
-- Atelier Logistique — regroupement de chargements en une seule opération (audit n°3)
-- À exécuter une fois dans Supabase : SQL Editor → coller → Run. Ré-exécutable sans danger.
--
--  • consolidate_shipments : tout ou rien (nouveau chargement, palettisations rattachées, originaux annulés),
--    après avoir verrouillé et revérifié les chargements d'origine : même entreprise, encore regroupables
--    (Nouveau, En cours, Validé) et inchangés depuis le calcul (updated_at).
--  • merged_into : n° du chargement qui a repris un chargement regroupé (l'API refuse de le réactiver).
-- =============================================================================================

alter table public.shipments add column if not exists merged_into text;

-- p_sources : [{ "id": "<uuid>", "updated_at": "<horodatage lu au calcul>" }, …] (2 au moins)
create or replace function public.consolidate_shipments(
  p_org uuid, p_sources jsonb, p_label text, p_departure timestamptz, p_input jsonb, p_result jsonb
) returns text language plpgsql set search_path = public as $$
declare
  v_ids uuid[];
  v_new uuid;
  v_code text;
  r record;
begin
  if not public.is_member(p_org) then raise exception 'Accès refusé'; end if;
  select array_agg((e->>'id')::uuid) into v_ids from jsonb_array_elements(p_sources) e;
  if coalesce(array_length(v_ids, 1), 0) < 2 then raise exception 'Au moins deux chargements à regrouper'; end if;

  -- Verrou des originaux (dans l'ordre des id : pas d'interblocage), puis contrôles.
  perform 1 from public.shipments where id = any(v_ids) order by id for update;
  for r in
    select e->>'id' as id, (e->>'updated_at')::timestamptz as seen, s.code, s.status, s.updated_at, s.org_id
    from jsonb_array_elements(p_sources) e left join public.shipments s on s.id = (e->>'id')::uuid
  loop
    if r.code is null or r.org_id <> p_org then raise exception 'Chargement introuvable dans cette entreprise'; end if;
    if r.status not in ('new', 'in_progress', 'validated') then
      raise exception 'Le chargement % n''est plus regroupable (statut : %). Relancez l''analyse.', r.code, r.status using errcode = 'check_violation';
    end if;
    if r.seen is null or r.updated_at <> r.seen then
      raise exception 'Le chargement % a été modifié depuis le calcul. Relancez l''analyse.', r.code using errcode = 'check_violation';
    end if;
  end loop;

  insert into public.shipments(org_id, source, status, label, departure_at, input, result)
  values (p_org, 'web', 'in_progress', left(p_label, 200), p_departure, p_input, p_result)
  returning id, code into v_new, v_code;

  update public.palletizations set shipment_id = v_new where shipment_id = any(v_ids);
  update public.shipments
     set status = 'cancelled', merged_into = v_code,
         label = left(coalesce(label, code) || ' → regroupé dans ' || v_code, 200)
   where id = any(v_ids);
  return v_code;
end $$;

revoke all on function public.consolidate_shipments(uuid, jsonb, text, timestamptz, jsonb, jsonb) from public, anon;
grant execute on function public.consolidate_shipments(uuid, jsonb, text, timestamptz, jsonb, jsonb) to authenticated;
