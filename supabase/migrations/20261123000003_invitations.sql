-- =============================================================================================
-- Atelier Logistique — invitations et équipe
-- À exécuter une fois dans Supabase : SQL Editor → coller → Run. Ré-exécutable sans danger.
--
-- Principe (gratuit, sans serveur d'e-mails) :
--   1. Un administrateur invite une adresse e-mail (rôle Membre ou Administrateur).
--   2. Il envoie le lien d'invitation à son collègue (copier, e-mail, WhatsApp).
--   3. Le collègue crée son compte avec CETTE adresse (ou se connecte s'il en a déjà un) :
--      l'invitation l'attend à l'entrée de l'espace, il l'accepte et rejoint l'entreprise.
-- =============================================================================================

create table if not exists public.invitations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  email        text not null check (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role         text not null default 'member' check (role in ('admin', 'member')),
  invited_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '14 days',
  unique (org_id, email)
);
create index if not exists invitations_email_idx on public.invitations(email);

alter table public.invitations enable row level security;
drop policy if exists invitations_admin_select on public.invitations;
create policy invitations_admin_select on public.invitations for select to authenticated using (public.is_admin(org_id));
drop policy if exists invitations_admin_delete on public.invitations;
create policy invitations_admin_delete on public.invitations for delete to authenticated using (public.is_admin(org_id));
-- Création / acceptation : uniquement par les fonctions ci-dessous.

-- Un membre n'entre plus que par create_organization() ou accept_invitation() (jamais ajouté sans son accord).
drop policy if exists members_admin_insert on public.organization_members;

-- Adresse de l'utilisateur connecté (en minuscules).
create or replace function public.my_email()
returns text language sql stable security definer set search_path = public as $$
  select lower(email) from auth.users where id = auth.uid();
$$;

-- Inviter (ou ré-inviter : l'invitation repart pour 14 jours). Réservé aux administrateurs.
create or replace function public.invite_member(p_org uuid, p_email text, p_role text default 'member')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(p_email)); v_id uuid;
begin
  if not public.is_admin(p_org) then raise exception 'Réservé aux administrateurs de l''entreprise'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Rôle inconnu'; end if;
  if exists (select 1 from public.organization_members m join auth.users u on u.id = m.user_id
             where m.org_id = p_org and lower(u.email) = v_email) then
    raise exception 'Cette personne fait déjà partie de l''entreprise';
  end if;
  insert into public.invitations(org_id, email, role, invited_by) values (p_org, v_email, p_role, auth.uid())
  on conflict (org_id, email) do update
    set role = excluded.role, invited_by = excluded.invited_by, created_at = now(), expires_at = now() + interval '14 days'
  returning id into v_id;
  return v_id;
end $$;

-- Invitations en attente pour l'utilisateur connecté (son adresse).
create or replace function public.my_invitations()
returns table (id uuid, org_id uuid, org_name text, role text, invited_by_email text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.org_id, o.name, i.role, lower(u.email), i.created_at
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  left join auth.users u on u.id = i.invited_by
  where i.email = public.my_email() and i.expires_at > now()
    and not exists (select 1 from public.organization_members m where m.org_id = i.org_id and m.user_id = auth.uid())
  order by i.created_at desc;
$$;

-- Accepter : l'adresse du compte doit être celle de l'invitation.
create or replace function public.accept_invitation(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v public.invitations;
begin
  select * into v from public.invitations where id = p_id and email = public.my_email() and expires_at > now();
  if not found then raise exception 'Invitation introuvable ou expirée'; end if;
  insert into public.organization_members(org_id, user_id, role) values (v.org_id, auth.uid(), v.role)
  on conflict (org_id, user_id) do nothing;
  delete from public.invitations where id = p_id;
  return v.org_id;
end $$;

-- Refuser.
create or replace function public.decline_invitation(p_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.invitations where id = p_id and email = public.my_email();
$$;

-- Membres d'une entreprise avec leur adresse (visible par les membres).
create or replace function public.org_members(p_org uuid)
returns table (user_id uuid, email text, role text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, lower(u.email), m.role, m.created_at
  from public.organization_members m join auth.users u on u.id = m.user_id
  where m.org_id = p_org and public.is_member(p_org)
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at;
$$;

-- Le propriétaire ne peut être ni rétrogradé ni retiré, et personne ne peut se donner le rôle de propriétaire.
create or replace function public.members_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and (old.role = 'owner' or new.role = 'owner') and old.role <> new.role then
    raise exception 'Le rôle de propriétaire ne se modifie pas';
  end if;
  if tg_op = 'INSERT' and new.role = 'owner'
     and exists (select 1 from public.organization_members where org_id = new.org_id) then
    raise exception 'L''entreprise a déjà un propriétaire';
  end if;
  if tg_op = 'DELETE' and old.role = 'owner'
     and exists (select 1 from public.organizations where id = old.org_id) then
    raise exception 'Le propriétaire ne peut pas être retiré';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists organization_members_guard on public.organization_members;
create trigger organization_members_guard before insert or update or delete on public.organization_members
  for each row execute function public.members_guard();

revoke all on function public.my_email(), public.invite_member(uuid, text, text), public.my_invitations(),
  public.accept_invitation(uuid), public.decline_invitation(uuid), public.org_members(uuid) from public;
grant execute on function public.my_email(), public.invite_member(uuid, text, text), public.my_invitations(),
  public.accept_invitation(uuid), public.decline_invitation(uuid), public.org_members(uuid) to authenticated;
