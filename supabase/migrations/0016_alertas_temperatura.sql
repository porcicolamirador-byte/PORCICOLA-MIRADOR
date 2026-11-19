-- TEMPORAL: aviso push de temperatura de la granja (ESP32 por EMQX).
-- Para quitarlo: select cron.unschedule('temperatura-granja'); drop table public.temperatura_alerta, public.mqtt_servidor;
-- y borrar la acción "temperatura" de la función notificaciones.

-- Datos de EMQX para que el servidor lea la temperatura (solo el administrador los escribe)
create table if not exists public.mqtt_servidor (
  id int primary key default 1 check (id = 1),
  url text not null,
  usuario text,
  clave text,
  actualizado_en timestamptz not null default now()
);
alter table public.mqtt_servidor enable row level security;
create policy "mqtt_servidor_admin" on public.mqtt_servidor for all to authenticated
  using (private.es_admin()) with check (private.es_admin());

-- Último estado avisado (normal / alta / baja): se avisa una sola vez por cruce
create table if not exists public.temperatura_alerta (
  id int primary key default 1 check (id = 1),
  estado text not null default 'normal',
  temperatura numeric,
  actualizado_en timestamptz not null default now()
);
alter table public.temperatura_alerta enable row level security;

select cron.schedule('temperatura-granja', '* * * * *', $$select private.llamar_notificaciones('temperatura')$$);
