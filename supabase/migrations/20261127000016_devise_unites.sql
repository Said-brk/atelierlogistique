-- Devise et système d'unités de l'entreprise (Paramètres › Entreprise, choix rapide à la création).
-- Les données restent en métrique ; seuls la saisie et l'affichage changent.
alter table public.organizations add column if not exists currency text not null default 'EUR';
alter table public.organizations add column if not exists units text not null default 'metric';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'organizations_currency_check') then
    alter table public.organizations add constraint organizations_currency_check check (currency ~ '^[A-Z]{3}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organizations_units_check') then
    alter table public.organizations add constraint organizations_units_check check (units in ('metric', 'imperial'));
  end if;
end $$;
