-- Contrôle des factures transport : montant facturé par le transporteur, quantité facturée (MPL, palettes…),
-- n° et date de facture. Colonnes hors verrou du quai (modifiables après chargement). Ré-exécutable.
alter table public.shipments add column if not exists invoiced_amount numeric(12, 2);
alter table public.shipments add column if not exists invoiced_qty numeric(12, 3);
alter table public.shipments add column if not exists invoice_ref text;
alter table public.shipments add column if not exists invoiced_on date;
alter table public.shipments drop constraint if exists shipments_invoice_ref_len;
alter table public.shipments add constraint shipments_invoice_ref_len check (invoice_ref is null or char_length(invoice_ref) <= 60);
