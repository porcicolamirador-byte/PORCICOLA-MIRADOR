-- Notificaciones: una sola al día (7:30 a. m. Colombia = 12:30 UTC) y granjas a notificar por usuario
alter table public.perfiles add column if not exists notificaciones_granjas text[];
comment on column public.perfiles.notificaciones_granjas is 'Granjas de las que el usuario recibe notificaciones de alertas (null = todas sus granjas)';
select cron.unschedule('notificaciones-urgentes');
select cron.unschedule('notificaciones-resumen');
select cron.schedule('notificaciones-diarias', '30 12 * * *', $$select private.llamar_notificaciones('diario')$$);
