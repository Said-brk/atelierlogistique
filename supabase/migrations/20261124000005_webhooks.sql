-- =============================================================================================
-- Atelier Logistique — notifications automatiques (webhooks)
-- À exécuter une fois dans Supabase : SQL Editor → coller → Run. Ré-exécutable sans danger.
-- Prérequis : extensions pg_net (appels HTTP depuis la base) et pg_cron (nouvelles tentatives),
-- à activer dans Database → Extensions si ce n'est pas déjà fait.
--
-- Principe : quand un chargement est validé, envoyé au quai, annulé ou rouvert, la base envoie
-- tout de suite un POST JSON signé (HMAC-SHA256) à l'adresse déclarée par l'entreprise.
-- Échec (hors 2xx, délai dépassé) : nouvelles tentatives après 1 min, 5 min, 30 min, 2 h, 6 h.
-- =============================================================================================

do $$ begin create extension if not exists pg_net; exception when others then raise notice 'pg_net indisponible : %', sqlerrm; end $$;

create table if not exists public.webhooks (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  url             text not null check (url ~ '^https://[^/\s]+\.[^/\s]+' and url !~* '^https://(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)'),
  description     text,
  events          text[] not null default array['shipment.validated', 'shipment.sent', 'shipment.cancelled', 'shipment.reopened'],
  secret          text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  active          boolean not null default true,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  last_status     integer,                -- dernier code HTTP reçu (0 = pas de réponse)
  last_delivery_at timestamptz,
  failure_count   integer not null default 0  -- échecs consécutifs
);
create index if not exists webhooks_org_idx on public.webhooks(org_id);

create table if not exists public.webhook_deliveries (
  id              uuid primary key default gen_random_uuid(),
  webhook_id      uuid not null references public.webhooks(id) on delete cascade,
  org_id          uuid not null references public.organizations(id) on delete cascade,
  event           text not null,
  shipment_code   text,
  payload         jsonb not null,
  status          text not null default 'pending' check (status in ('pending', 'sent', 'ok', 'failed')),
  attempt         integer not null default 0,
  request_id      bigint,
  sent_at         timestamptz,
  next_attempt_at timestamptz not null default now(),
  http_status     integer,
  error           text,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);
create index if not exists webhook_deliveries_todo_idx on public.webhook_deliveries(status, next_attempt_at) where status in ('pending', 'sent');
create index if not exists webhook_deliveries_org_idx on public.webhook_deliveries(org_id, created_at desc);

alter table public.webhooks enable row level security;
alter table public.webhook_deliveries enable row level security;
drop policy if exists webhooks_admin on public.webhooks;
create policy webhooks_admin on public.webhooks for all to authenticated
  using (public.is_admin(org_id)) with check (public.is_admin(org_id));
drop policy if exists webhook_deliveries_admin on public.webhook_deliveries;
create policy webhook_deliveries_admin on public.webhook_deliveries for select to authenticated using (public.is_admin(org_id));

-- Adresse du site (liens dans les notifications).
create or replace function public.site_url() returns text language sql immutable as $$ select 'https://atelierlogistique.com' $$;

-- Contenu de la notification : le chargement en bref + liens (le plan complet : GET links.api avec une clé).
create or replace function public.webhook_shipment_data(s public.shipments)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'code', s.code, 'reference', s.external_id, 'label', s.label, 'status', s.status, 'version', s.version,
    'departure_date', s.departure_at, 'updated_at', s.updated_at, 'validated_at', s.validated_at,
    'summary', case when s.result ? 'summary' then jsonb_build_object(
      'vehicles', coalesce((s.result->'summary'->>'fleet')::int, 1),
      'vehicle', s.result->'summary'->>'vehicle',
      'units_loaded', coalesce((s.result->'summary'->>'packed')::int, 0),
      'units_not_loaded', coalesce((s.result->'summary'->>'unpacked')::int, 0),
      'fill_rate_pct', round(coalesce((s.result->'summary'->>'fill')::numeric, 0) * 1000) / 10,
      'weight_kg', round(coalesce((s.result->'summary'->>'weight')::numeric, 0))) end,
    'links', jsonb_build_object(
      'app', public.site_url() || '/app/chargements/' || s.code,
      'api', public.site_url() || '/api/v1/shipments/' || s.code,
      'dock', case when s.status <> 'cancelled' and (s.result->'plan' ? 'guide' or jsonb_array_length(coalesce(s.result->'plan'->'guides', '[]'::jsonb)) > 0)
                   then public.site_url() || '/q/' || s.share_token end));
$$;

-- Envoi (ou nouvel essai) d'une notification : POST signé via pg_net.
-- Signature : en-tête X-AL-Signature = « t=<horodatage>,v1=<hex HMAC-SHA256(secret, "<horodatage>.<corps>")> ».
create or replace function public.webhook_send(p_delivery uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare d public.webhook_deliveries; w public.webhooks; ts text; body text; rid bigint;
begin
  select * into d from public.webhook_deliveries where id = p_delivery for update;
  select * into w from public.webhooks where id = d.webhook_id;
  if not found or not w.active then
    update public.webhook_deliveries set status = 'failed', error = 'webhook désactivé', completed_at = now() where id = p_delivery;
    return;
  end if;
  ts := extract(epoch from now())::bigint::text;
  body := d.payload::text;
  rid := net.http_post(
    url := w.url, body := d.payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json', 'User-Agent', 'AtelierLogistique-Webhook/1',
      'X-AL-Event', d.event, 'X-AL-Delivery', d.id::text,
      'X-AL-Signature', 't=' || ts || ',v1=' || encode(hmac(ts || '.' || body, w.secret, 'sha256'), 'hex')),
    timeout_milliseconds := 10000);
  update public.webhook_deliveries set status = 'sent', attempt = attempt + 1, request_id = rid, sent_at = now() where id = p_delivery;
end $$;

-- Crée les notifications d'un évènement pour les webhooks abonnés de l'entreprise, et les envoie tout de suite.
create or replace function public.webhook_enqueue(p_org uuid, p_event text, p_code text, p_data jsonb, p_only uuid default null)
returns integer language plpgsql security definer set search_path = public as $$
declare w record; v_id uuid; n integer := 0;
begin
  for w in select id from public.webhooks
           where org_id = p_org and active and (p_only is null or id = p_only) and (p_event = 'ping' or p_event = any(events)) loop
    v_id := gen_random_uuid();
    insert into public.webhook_deliveries(id, webhook_id, org_id, event, shipment_code, payload)
    values (v_id, w.id, p_org, p_event, p_code,
            jsonb_build_object('id', 'evt_' || replace(v_id::text, '-', ''), 'event', p_event, 'created_at', now(), 'data', p_data));
    perform public.webhook_send(v_id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Déclencheur : changement de statut d'un chargement.
create or replace function public.shipments_webhooks()
returns trigger language plpgsql security definer set search_path = public as $$
declare ev text;
begin
  if new.status is not distinct from old.status then return null; end if;
  ev := case
    when new.status = 'validated' then 'shipment.validated'
    when new.status = 'sent' then 'shipment.sent'
    when new.status = 'cancelled' then 'shipment.cancelled'
    when old.status in ('validated', 'sent') and new.status in ('new', 'in_progress') then 'shipment.reopened'
  end;
  if ev is not null and exists (select 1 from public.webhooks where org_id = new.org_id and active) then
    perform public.webhook_enqueue(new.org_id, ev, new.code, public.webhook_shipment_data(new));
  end if;
  return null;
end $$;
drop trigger if exists shipments_webhooks on public.shipments;
create trigger shipments_webhooks after update of status on public.shipments
  for each row execute function public.shipments_webhooks();

-- Bouton « Envoyer un test » de l'espace.
create or replace function public.webhook_test(p_webhook uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare w public.webhooks;
begin
  select * into w from public.webhooks where id = p_webhook;
  if not found or not public.is_admin(w.org_id) then raise exception 'Réservé aux administrateurs de l''entreprise'; end if;
  return public.webhook_enqueue(w.org_id, 'ping', null,
    jsonb_build_object('message', 'Test de notification Atelier Logistique : votre adresse est bien jointe.'), p_webhook);
end $$;

-- Toutes les minutes (pg_cron) : relève des réponses, nouvelles tentatives, ménage.
create or replace function public.webhook_tick()
returns integer language plpgsql security definer set search_path = public as $$
declare d record; r record; ok boolean; delays interval[] := array['1 minute', '5 minutes', '30 minutes', '2 hours', '6 hours']::interval[]; n integer := 0;
begin
  for d in select * from public.webhook_deliveries where status = 'sent' loop
    select status_code, error_msg, timed_out into r from net._http_response where id = d.request_id;
    if not found and d.sent_at > now() - interval '10 minutes' then continue; end if; -- réponse pas encore arrivée
    ok := found and r.status_code between 200 and 299;
    update public.webhook_deliveries set
      http_status = case when found then r.status_code end,
      error = case when ok then null when not found then 'pas de réponse' when r.timed_out then 'délai dépassé (10 s)' else coalesce(r.error_msg, 'HTTP ' || r.status_code) end,
      status = case when ok then 'ok' when d.attempt > array_length(delays, 1) then 'failed' else 'pending' end,
      next_attempt_at = case when ok or d.attempt > array_length(delays, 1) then next_attempt_at else now() + delays[d.attempt] end,
      completed_at = case when ok or d.attempt > array_length(delays, 1) then now() end
    where id = d.id;
    update public.webhooks set last_status = coalesce(r.status_code, 0), last_delivery_at = now(),
      failure_count = case when ok then 0 else failure_count + 1 end
    where id = d.webhook_id;
    n := n + 1;
  end loop;
  for d in select id from public.webhook_deliveries where status = 'pending' and next_attempt_at <= now() and attempt > 0 loop
    perform public.webhook_send(d.id); n := n + 1;
  end loop;
  delete from public.webhook_deliveries where created_at < now() - interval '30 days';
  return n;
end $$;

revoke all on function public.webhook_send(uuid), public.webhook_enqueue(uuid, text, text, jsonb, uuid), public.webhook_tick(),
  public.shipments_webhooks(), public.webhook_shipment_data(public.shipments) from public, anon, authenticated;
revoke all on function public.webhook_test(uuid) from public, anon;
grant execute on function public.webhook_test(uuid) to authenticated;

-- Tâche planifiée (si pg_cron est activé).
do $$ begin
  perform cron.schedule('webhooks-relances', '* * * * *', 'select public.webhook_tick()');
exception when others then raise notice 'pg_cron indisponible : activez-le puis relancez ce script (%).', sqlerrm;
end $$;
