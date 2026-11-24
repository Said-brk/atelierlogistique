-- Tables de référence par entreprise : véhicules / contenants, supports de palettisation, réglages d'arrimage.
-- Chaque nouvelle entreprise reçoit les valeurs par défaut (celles des outils publics), que ses administrateurs
-- modifient ensuite dans Paramètres › Tables de référence. Les entreprises existantes sont complétées ici.
-- Unités : mm, kg, €. Ré-exécutable.

create table if not exists public.reference_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('vehicle', 'pallet', 'setting')),
  code text not null check (code ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$'),
  label text not null check (length(trim(label)) between 1 and 80),
  data jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, kind, code)
);
create index if not exists reference_items_org on public.reference_items(org_id, kind, sort);
alter table public.reference_items enable row level security;

drop policy if exists reference_items_read on public.reference_items;
create policy reference_items_read on public.reference_items for select to authenticated using (public.is_member(org_id));
drop policy if exists reference_items_admin on public.reference_items;
create policy reference_items_admin on public.reference_items for all to authenticated
  using (public.is_admin(org_id)) with check (public.is_admin(org_id));

create or replace function public.reference_items_touch()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists reference_items_touch on public.reference_items;
create trigger reference_items_touch before update on public.reference_items for each row execute function public.reference_items_touch();

-- Valeurs par défaut (identiques à src/shared/references/defaults.ts : vérifié par le test du schéma).
create or replace function public.default_reference_items()
returns jsonb language sql immutable as $$ select '[
    {"kind": "vehicle", "code": "semi", "label": "Semi-remorque standard", "data": {"length": 13600, "width": 2450, "height": 2700, "maxWeight": 24000, "cost": 650, "inFleet": true, "axle": {"kind": "TWO_SUPPORTS", "frontLabel": "Sellette (avant)", "rearLabel": "Essieux remorque", "frontPos": 1000, "rearPos": 9000, "frontMax": 11000, "rearMax": 18000}}, "active": true, "sort": 10},
    {"kind": "vehicle", "code": "porteur19", "label": "Porteur 19 t", "data": {"length": 7300, "width": 2450, "height": 2500, "maxWeight": 9500, "cost": 480, "inFleet": true, "axle": {"kind": "TWO_SUPPORTS", "frontLabel": "Essieu avant", "rearLabel": "Essieu arrière", "frontPos": -1300, "rearPos": 4900, "frontMax": 3000, "rearMax": 7500}}, "active": true, "sort": 20},
    {"kind": "vehicle", "code": "porteur12", "label": "Porteur 12 t", "data": {"length": 6200, "width": 2450, "height": 2400, "maxWeight": 5500, "cost": 380, "inFleet": false, "axle": {"kind": "TWO_SUPPORTS", "frontLabel": "Essieu avant", "rearLabel": "Essieu arrière", "frontPos": -1200, "rearPos": 4100, "frontMax": 1800, "rearMax": 4500}}, "active": true, "sort": 30},
    {"kind": "vehicle", "code": "fourgon20", "label": "Fourgon 20 m³", "data": {"length": 4300, "width": 2050, "height": 2250, "maxWeight": 1100, "cost": 250, "inFleet": true, "axle": {"kind": "TWO_SUPPORTS", "frontLabel": "Essieu avant", "rearLabel": "Essieu arrière", "frontPos": -1000, "rearPos": 2900, "frontMax": 450, "rearMax": 850}}, "active": true, "sort": 40},
    {"kind": "vehicle", "code": "20ft", "label": "Conteneur 20 pieds", "data": {"length": 5900, "width": 2350, "height": 2390, "maxWeight": 28000, "cost": 900, "inFleet": false, "axle": null}, "active": true, "sort": 50},
    {"kind": "vehicle", "code": "40ft", "label": "Conteneur 40 pieds", "data": {"length": 12030, "width": 2350, "height": 2390, "maxWeight": 26500, "cost": 1300, "inFleet": false, "axle": null}, "active": true, "sort": 60},
    {"kind": "vehicle", "code": "40hc", "label": "Conteneur 40 pieds High Cube", "data": {"length": 12030, "width": 2350, "height": 2690, "maxWeight": 26500, "cost": 1400, "inFleet": false, "axle": null}, "active": true, "sort": 70},
    {"kind": "pallet", "code": "eur", "label": "EUR / EPAL 120×80", "data": {"length": 1200, "width": 800, "deckHeight": 144, "tare": 25, "maxTotalHeight": 1800, "maxLoad": 1000}, "active": true, "sort": 10},
    {"kind": "pallet", "code": "eur3", "label": "EUR3 / ISO 120×100", "data": {"length": 1200, "width": 1000, "deckHeight": 144, "tare": 30, "maxTotalHeight": 1800, "maxLoad": 1000}, "active": true, "sort": 20},
    {"kind": "pallet", "code": "half", "label": "Demi-palette 80×60", "data": {"length": 800, "width": 600, "deckHeight": 144, "tare": 10, "maxTotalHeight": 1200, "maxLoad": 500}, "active": false, "sort": 30},
    {"kind": "pallet", "code": "gma", "label": "US GMA 48×40 in", "data": {"length": 1219, "width": 1016, "deckHeight": 140, "tare": 23, "maxTotalHeight": 1800, "maxLoad": 1000}, "active": false, "sort": 40},
    {"kind": "pallet", "code": "asia", "label": "Asie 110×110", "data": {"length": 1100, "width": 1100, "deckHeight": 144, "tare": 25, "maxTotalHeight": 1800, "maxLoad": 1000}, "active": false, "sort": 50},
    {"kind": "setting", "code": "lashing", "label": "Arrimage", "data": {"mu": 0.3, "stfDaN": 400, "angleDeg": 90, "forwardBlocked": true}, "active": true, "sort": 10}
]'::jsonb $$;

-- Ajoute les valeurs par défaut manquantes (p_kind null = toutes les tables). Ne modifie pas l'existant.
create or replace function public.seed_reference_items(p_org uuid, p_kind text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.reference_items(org_id, kind, code, label, data, active, sort)
  select p_org, e->>'kind', e->>'code', e->>'label', e->'data', (e->>'active')::boolean, (e->>'sort')::integer
  from jsonb_array_elements(public.default_reference_items()) e
  where p_kind is null or e->>'kind' = p_kind
  on conflict (org_id, kind, code) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.seed_reference_items(uuid, text) from public, anon, authenticated;

-- « Revenir aux valeurs par défaut » d'une table (administrateurs) : efface puis recrée.
create or replace function public.reset_reference_items(p_org uuid, p_kind text)
returns integer language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(p_org) then raise exception 'Réservé aux administrateurs'; end if;
  if p_kind not in ('vehicle', 'pallet', 'setting') then raise exception 'Table inconnue'; end if;
  delete from public.reference_items where org_id = p_org and kind = p_kind;
  return public.seed_reference_items(p_org, p_kind);
end $$;
grant execute on function public.reset_reference_items(uuid, text) to authenticated;

-- Nouvelle entreprise : tables pré-remplies.
create or replace function public.organizations_seed_references()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.seed_reference_items(new.id); return new; end $$;
drop trigger if exists organizations_seed_references on public.organizations;
create trigger organizations_seed_references after insert on public.organizations
  for each row execute function public.organizations_seed_references();

-- Entreprises déjà créées : on complète une seule fois (une table vidée volontairement n'est pas re-remplie
-- à la ré-exécution du script, sauf si l'entreprise n'a encore aucune donnée de référence).
select public.seed_reference_items(o.id) from public.organizations o
where not exists (select 1 from public.reference_items r where r.org_id = o.id);
