-- Rangos de las alertas de temperatura (los cambia solo el administrador; todos pueden leerlos)
create table if not exists public.temperatura_config (
  id int primary key default 1 check (id = 1),
  minima numeric not null default 22,
  limite numeric not null default 27.5,
  critica numeric not null default 29,
  actualizado_en timestamptz not null default now()
);
insert into public.temperatura_config (id) values (1) on conflict do nothing;
alter table public.temperatura_config enable row level security;
create policy "temperatura_config_leer" on public.temperatura_config for select to authenticated using (true);
create policy "temperatura_config_admin" on public.temperatura_config for update to authenticated using (private.es_admin()) with check (private.es_admin());
