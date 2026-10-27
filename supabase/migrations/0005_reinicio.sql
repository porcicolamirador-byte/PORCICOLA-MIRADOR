-- Reinicio total de los datos de la granja (solo administrador, desde la función "usuarios").
-- Borra todos los documentos (incluidos los eliminados) y el registro de actividad,
-- y sube la "generación" para que cada teléfono borre su copia local al sincronizar.
-- Los usuarios, PIN y permisos se conservan.

create table if not exists public.reinicio (
  id smallint primary key default 1 check (id = 1),
  generacion bigint not null default 0,
  fecha timestamptz,
  por text
);
insert into public.reinicio (id, generacion) values (1, 0) on conflict (id) do nothing;

alter table public.reinicio enable row level security;
revoke all on public.reinicio from anon;
revoke insert, update, delete, truncate on public.reinicio from authenticated;
grant select on public.reinicio to authenticated;
drop policy if exists "usuarios activos ven el reinicio" on public.reinicio;
create policy "usuarios activos ven el reinicio" on public.reinicio
  for select to authenticated using ((select private.usuario_activo()));

create or replace function public.reiniciar_base(p_por text)
returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  g bigint;
begin
  delete from public.documentos where true;
  delete from public.registro_actividad where true;
  update public.reinicio set generacion = generacion + 1, fecha = now(), por = p_por where id = 1
    returning generacion into g;
  return g;
end;
$$;
revoke execute on function public.reiniciar_base(text) from public, anon, authenticated;
grant execute on function public.reiniciar_base(text) to service_role;
