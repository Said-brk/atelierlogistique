-- =============================================================================================
-- Atelier Logistique — zones tarifaires (table de référence, comme les tournées)
-- À exécuter une fois dans Supabase : SQL Editor → coller → Run. Ré-exécutable sans danger.
--
--  • Zones : Paramètres › Zones (kind = 'zone' : code, nom, description).
--    Elles forment les colonnes des grilles transporteurs et se choisissent sur les agences.
--  • Chargement : zone choisie (comme la tournée) pour les destinations sans zone.
-- =============================================================================================

alter table public.reference_items drop constraint if exists reference_items_kind_check;
alter table public.reference_items add constraint reference_items_kind_check
  check (kind in ('vehicle', 'pallet', 'agency', 'tour', 'zone', 'carrier', 'setting'));

alter table public.shipments add column if not exists zone text;
alter table public.shipments drop constraint if exists shipments_zone_len;
alter table public.shipments add constraint shipments_zone_len check (zone is null or char_length(zone) <= 40);
