-- Módulos del Dashboard desactivados para todos los usuarios (el administrador siempre los ve)
create table if not exists public.app_ajustes (
  id smallint primary key default 1 check (id = 1),
  modulos_ocultos text[] not null default '{}',
  actualizado_en timestamptz not null default now(),
  actualizado_por text
);
alter table public.app_ajustes enable row level security;
revoke all on public.app_ajustes from anon, authenticated;
insert into public.app_ajustes (id) values (1) on conflict do nothing;
update public.perfiles set modulos_ocultos = '{}' where modulos_ocultos <> '{}';
