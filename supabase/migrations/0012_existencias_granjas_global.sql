-- Existencias que publica cada granja ("existencias-granjas") para tomar prestado: común a todas
create or replace function private.puede_granja(p_coleccion text)
 returns boolean language sql stable security definer set search_path to ''
as $function$
  select exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo
      and (
        p.rol = 'admin'
        or p.granjas is null
        or p_coleccion in ('granjas', 'jaulas-mapa', 'prestamos-bodega', 'existencias-granjas')
        or (case when p_coleccion like 'g:%' then split_part(p_coleccion, ':', 2) else 'mirador' end) = any (p.granjas)
      )
  );
$function$;
