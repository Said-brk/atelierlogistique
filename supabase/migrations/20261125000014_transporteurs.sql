-- Transporteurs (tables de référence, kind = 'carrier') et coût théorique des chargements.
-- data d'un transporteur : billing (ldm | pallet | weight | ftl), rate, minCharge, kgPerM3, kgPerLdm, prices {code véhicule: €}, fuelPct.
-- Ré-exécutable.

alter table public.reference_items drop constraint if exists reference_items_kind_check;
alter table public.reference_items add constraint reference_items_kind_check
  check (kind in ('vehicle', 'pallet', 'agency', 'tour', 'carrier', 'setting'));

-- Chargement : transporteur choisi, coût théorique (€) et son détail (calculés à l'enregistrement, figés à l'envoi au quai).
alter table public.shipments add column if not exists carrier text;
alter table public.shipments add column if not exists carrier_cost numeric(12, 2);
alter table public.shipments add column if not exists carrier_quote jsonb;
alter table public.shipments drop constraint if exists shipments_carrier_len;
alter table public.shipments add constraint shipments_carrier_len check (carrier is null or char_length(carrier) <= 40);
create index if not exists shipments_org_carrier_idx on public.shipments(org_id, carrier, departure_at);
