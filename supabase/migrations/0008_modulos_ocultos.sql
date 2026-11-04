-- Módulos del Dashboard desactivados por usuario (vacío = todos activos)
alter table public.perfiles add column if not exists modulos_ocultos text[] not null default '{}';
comment on column public.perfiles.modulos_ocultos is 'Módulos del Dashboard desactivados para este usuario (vacío = todos activos)';
