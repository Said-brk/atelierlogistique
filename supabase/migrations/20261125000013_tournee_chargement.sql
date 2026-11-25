-- Tournée d'un chargement : code de la tournée (tables de référence, kind = 'tour').
-- Choisie dans l'en-tête du chargement ; limite les destinations aux agences de la tournée.
alter table public.shipments add column if not exists tour text;
alter table public.shipments drop constraint if exists shipments_tour_len;
alter table public.shipments add constraint shipments_tour_len check (tour is null or char_length(tour) <= 40);
create index if not exists shipments_org_tour_idx on public.shipments(org_id, tour, departure_at);
