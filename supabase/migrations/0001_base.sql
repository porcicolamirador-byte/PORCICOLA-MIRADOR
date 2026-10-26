-- Porcícola El Mirador: base de datos en la nube
-- Usuarios con PIN, documentos sincronizados desde los teléfonos y registro de actividad.

create schema if not exists private;

-- ───────────── Usuarios de la granja ─────────────
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  usuario text not null unique check (usuario ~ '^[a-z0-9._-]{3,30}$'),
  nombre text not null check (length(trim(nombre)) between 1 and 60),
  rol text not null default 'trabajador' check (rol in ('admin', 'trabajador')),
  -- Permisos extra de un trabajador, p. ej. {"eliminar": true, "bodega": true, "ajustes": false}
  permisos jsonb not null default '{}'::jsonb,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
comment on table public.perfiles is 'Usuarios de la app. Se crean y modifican solo desde la función "usuarios" (administrador).';

-- Intentos fallidos de PIN (no expuesto por la API)
create table private.intentos_acceso (
  usuario text primary key,
  fallidos integer not null default 0,
  bloqueado_hasta timestamptz
);

-- ───────────── Funciones de apoyo para las reglas ─────────────
create or replace function private.usuario_activo()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.activo);
$$;

create or replace function private.es_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.activo and p.rol = 'admin');
$$;

create or replace function private.tiene_permiso(permiso text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo
      and (p.rol = 'admin' or coalesce((p.permisos ->> permiso)::boolean, false))
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.usuario_activo() to authenticated;
grant execute on function private.es_admin() to authenticated;
grant execute on function private.tiene_permiso(text) to authenticated;

-- ───────────── Datos de la granja ─────────────
-- Cada elemento que la app guarda (una cerda, un lote, una factura, el historial
-- de una cerda, la configuración…) es un documento. La app guarda en el teléfono
-- y sincroniza: sube lo que cambió y baja lo que otros cambiaron.
create table public.documentos (
  coleccion text not null check (length(coleccion) between 1 and 80),
  id text not null check (length(id) between 1 and 200),
  datos jsonb,
  borrado boolean not null default false,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references public.perfiles (id) on delete set null,
  primary key (coleccion, id)
);
create index documentos_actualizado_en_idx on public.documentos (actualizado_en);
create index documentos_actualizado_por_idx on public.documentos (actualizado_por);

create or replace function private.sellar_documento()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  new.actualizado_por := (select auth.uid());
  -- Borrar requiere el permiso "eliminar" (el administrador siempre lo tiene)
  if new.borrado and (tg_op = 'INSERT' or not old.borrado) and not private.tiene_permiso('eliminar') then
    raise exception 'No tienes permiso para eliminar' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger documentos_sellar
before insert or update on public.documentos
for each row execute function private.sellar_documento();

-- ───────────── Registro de actividad ─────────────
create table public.registro_actividad (
  id text primary key,
  fecha timestamptz not null,
  accion text not null check (accion in ('Creación', 'Modificación', 'Eliminación', 'Sistema')),
  modulo text not null,
  detalle text not null,
  usuario_id uuid references public.perfiles (id) on delete set null default auth.uid(),
  recibido_en timestamptz not null default now()
);
create index registro_actividad_fecha_idx on public.registro_actividad (fecha desc);
create index registro_actividad_usuario_idx on public.registro_actividad (usuario_id);

create or replace function private.sellar_registro()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  new.usuario_id := (select auth.uid());
  return new;
end;
$$;

create trigger registro_sellar
before insert on public.registro_actividad
for each row execute function private.sellar_registro();

-- ───────────── Reglas de acceso (RLS) ─────────────
alter table public.perfiles enable row level security;
alter table public.documentos enable row level security;
alter table public.registro_actividad enable row level security;

-- Perfiles: cualquier usuario activo ve la lista (para mostrar quién hizo qué).
-- Crear o cambiar usuarios solo se hace desde la función del administrador.
create policy "usuarios activos ven perfiles" on public.perfiles
  for select to authenticated using ((select private.usuario_activo()));

-- Documentos: los usuarios activos leen y escriben; nadie borra filas (se marcan como borradas).
create policy "usuarios activos leen documentos" on public.documentos
  for select to authenticated using ((select private.usuario_activo()));
create policy "usuarios activos crean documentos" on public.documentos
  for insert to authenticated with check ((select private.usuario_activo()));
create policy "usuarios activos actualizan documentos" on public.documentos
  for update to authenticated using ((select private.usuario_activo())) with check ((select private.usuario_activo()));

-- Registro: los usuarios activos agregan entradas y las leen; no se editan ni se borran.
create policy "usuarios activos leen el registro" on public.registro_actividad
  for select to authenticated using ((select private.usuario_activo()));
create policy "usuarios activos agregan al registro" on public.registro_actividad
  for insert to authenticated with check ((select private.usuario_activo()));

revoke all on public.perfiles from anon;
revoke all on public.documentos from anon;
revoke all on public.registro_actividad from anon;
revoke insert, update, delete on public.perfiles from authenticated;
revoke delete on public.documentos from authenticated;
revoke update, delete on public.registro_actividad from authenticated;

-- ───────────── Secreto para derivar la contraseña del PIN ─────────────
-- La contraseña real de cada usuario es un HMAC del PIN con este secreto, así
-- que nadie puede probar PINs directamente contra el servicio de autenticación.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'pin_pepper', 'Secreto para derivar contraseñas a partir del PIN');

create or replace function public.obtener_pepper_pin()
returns text
language sql stable security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'pin_pepper' limit 1;
$$;
revoke execute on function public.obtener_pepper_pin() from public, anon, authenticated;
grant execute on function public.obtener_pepper_pin() to service_role;

-- Intentos de acceso: funciones solo para el servidor
create or replace function public.registrar_intento_pin(p_usuario text, p_exito boolean)
returns timestamptz
language plpgsql security definer
set search_path = ''
as $$
declare
  v_fallidos integer;
  v_hasta timestamptz;
begin
  if p_exito then
    delete from private.intentos_acceso where usuario = p_usuario;
    return null;
  end if;
  insert into private.intentos_acceso as i (usuario, fallidos)
  values (p_usuario, 1)
  on conflict (usuario) do update set fallidos = i.fallidos + 1
  returning fallidos into v_fallidos;
  -- 5 fallos seguidos: bloqueo de 15 minutos
  if v_fallidos >= 5 then
    v_hasta := now() + interval '15 minutes';
    update private.intentos_acceso set bloqueado_hasta = v_hasta, fallidos = 0 where usuario = p_usuario;
  end if;
  return v_hasta;
end;
$$;

create or replace function public.bloqueo_pin(p_usuario text)
returns timestamptz
language sql stable security definer
set search_path = ''
as $$
  select bloqueado_hasta from private.intentos_acceso where usuario = p_usuario and bloqueado_hasta > now();
$$;

revoke execute on function public.registrar_intento_pin(text, boolean) from public, anon, authenticated;
revoke execute on function public.bloqueo_pin(text) from public, anon, authenticated;
grant execute on function public.registrar_intento_pin(text, boolean) to service_role;
grant execute on function public.bloqueo_pin(text) to service_role;
