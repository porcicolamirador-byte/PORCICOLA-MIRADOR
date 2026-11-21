-- Temperatura con la que se mandó la última alerta crítica (para avisar de nuevo si sube 1 °C más)
alter table public.temperatura_alerta add column if not exists aviso_temp numeric;
