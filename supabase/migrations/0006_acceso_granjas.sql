-- Acceso por granja: el administrador elige a qué granjas entra cada usuario.
-- granjas = null → todas (incluidas las que se creen después).
alter table public.perfiles add column if not exists granjas text[];

-- ¿El usuario puede ver/escribir esta colección? (la lista de granjas es común)
create or replace function private.puede_granja(p_coleccion text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo
      and (
        p.rol = 'admin'
        or p.granjas is null
        or p_coleccion = 'granjas'
        or (case when p_coleccion like 'g:%' then split_part(p_coleccion, ':', 2) else 'mirador' end) = any (p.granjas)
      )
  );
$$;
grant execute on function private.puede_granja(text) to authenticated;

alter policy "usuarios activos leen documentos" on public.documentos
  using (private.puede_granja(coleccion));
alter policy "usuarios activos crean documentos" on public.documentos
  with check (private.puede_granja(coleccion));
alter policy "usuarios activos actualizan documentos" on public.documentos
  using (private.puede_granja(coleccion)) with check (private.puede_granja(coleccion));
