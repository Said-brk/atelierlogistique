-- Agences (destinations) et tournées dans les tables de référence, réglage du regroupement (libre / par tournée).
-- Ré-exécutable.

alter table public.reference_items drop constraint if exists reference_items_kind_check;
alter table public.reference_items add constraint reference_items_kind_check
  check (kind in ('vehicle', 'pallet', 'agency', 'tour', 'setting'));

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
    {"kind": "setting", "code": "lashing", "label": "Arrimage", "data": {"mu": 0.3, "stfDaN": 400, "angleDeg": 90, "forwardBlocked": true}, "active": true, "sort": 10},
    {"kind": "setting", "code": "consolidation", "label": "Regroupement", "data": {"mode": "free"}, "active": true, "sort": 20}
]'::jsonb $$;

create or replace function public.reset_reference_items(p_org uuid, p_kind text)
returns integer language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(p_org) then raise exception 'Réservé aux administrateurs'; end if;
  if p_kind not in ('vehicle', 'pallet', 'agency', 'tour', 'setting') then raise exception 'Table inconnue'; end if;
  delete from public.reference_items where org_id = p_org and kind = p_kind;
  return public.seed_reference_items(p_org, p_kind);
end $$;
grant execute on function public.reset_reference_items(uuid, text) to authenticated;

-- Entreprises existantes : ajoute le réglage « regroupement » (sans toucher au reste).
select public.seed_reference_items(o.id, 'setting') from public.organizations o;
