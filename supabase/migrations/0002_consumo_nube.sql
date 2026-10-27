-- Consumo de la base de datos (solo administradores)
create or replace function public.consumo_nube()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  if not private.es_admin() then
    raise exception 'Solo el administrador puede ver el consumo' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'base_bytes', pg_database_size(current_database()),
    'datos_bytes', pg_total_relation_size('public.documentos'),
    'registro_bytes', pg_total_relation_size('public.registro_actividad'),
    'documentos', (select count(*) from public.documentos where not borrado),
    'borrados', (select count(*) from public.documentos where borrado),
    'registro', (select count(*) from public.registro_actividad),
    'usuarios', (select count(*) from public.perfiles),
    'usuarios_activos', (select count(*) from public.perfiles where activo),
    'por_coleccion', coalesce((
      select jsonb_object_agg(grupo, n) from (
        select case when coleccion like 'historial-%' then 'historial' else coleccion end as grupo, count(*) as n
        from public.documentos where not borrado group by 1
      ) t
    ), '{}'::jsonb),
    'ultimo_cambio', (select max(actualizado_en) from public.documentos)
  ) into r;
  return r;
end;
$$;
revoke execute on function public.consumo_nube() from public, anon;
grant execute on function public.consumo_nube() to authenticated;
