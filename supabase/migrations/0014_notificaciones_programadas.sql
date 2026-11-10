-- Envíos programados de notificaciones (hora de Colombia = UTC-5)
--   resumen: todos los días a las 6:00 a. m.
--   urgentes: cada hora a los :07, de 6 a. m. a 9 p. m.
create or replace function private.llamar_notificaciones(p_accion text) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://nfcroczfghddbndwgbab.supabase.co/functions/v1/notificaciones',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron', (select cron_secreto from public.push_config where id = 1)),
    body := jsonb_build_object('accion', p_accion),
    timeout_milliseconds := 30000
  );
end $$;
revoke all on function private.llamar_notificaciones(text) from public, anon, authenticated;
select cron.schedule('notificaciones-resumen', '0 11 * * *', $$select private.llamar_notificaciones('resumen')$$);
select cron.schedule('notificaciones-urgentes', '7 11-23,0-2 * * *', $$select private.llamar_notificaciones('urgentes')$$);
