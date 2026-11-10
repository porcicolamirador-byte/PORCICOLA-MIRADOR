-- Notificaciones de la app (Web Push): suscripciones de cada teléfono,
-- registro de lo ya enviado (para no repetir) y llaves del servidor.

create table if not exists public.suscripciones_push (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  dispositivo text,
  creado_en timestamptz not null default now()
);
alter table public.suscripciones_push enable row level security;
create policy "ver mis suscripciones" on public.suscripciones_push for select to authenticated using (usuario_id = (select auth.uid()));
create policy "crear mis suscripciones" on public.suscripciones_push for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy "actualizar mis suscripciones" on public.suscripciones_push for update to authenticated using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create policy "borrar mis suscripciones" on public.suscripciones_push for delete to authenticated using (usuario_id = (select auth.uid()));

-- Solo el servidor (función "notificaciones") usa estas dos
create table if not exists public.push_enviados (
  clave text primary key,
  enviado_en timestamptz not null default now()
);
alter table public.push_enviados enable row level security;

create table if not exists public.push_config (
  id smallint primary key default 1 check (id = 1),
  vapid_publica text not null,
  vapid_privada text not null,
  cron_secreto text not null
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;
revoke all on public.push_enviados from anon, authenticated;

create extension if not exists pg_cron;
