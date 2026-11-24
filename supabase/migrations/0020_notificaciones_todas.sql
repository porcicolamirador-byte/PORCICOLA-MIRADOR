-- Cada usuario puede elegir recibir (y ver) las alertas de todas sus granjas
alter table public.perfiles add column if not exists notificaciones_todas boolean not null default false;
comment on column public.perfiles.notificaciones_todas is 'El usuario eligió ver y recibir las alertas de todas las granjas a las que tiene acceso';

create or replace function public.cambiar_notificaciones_todas(valor boolean) returns void
language sql security definer set search_path = public as $$
  update public.perfiles set notificaciones_todas = valor where id = (select auth.uid()) and activo;
$$;
revoke all on function public.cambiar_notificaciones_todas(boolean) from public, anon;
grant execute on function public.cambiar_notificaciones_todas(boolean) to authenticated;
