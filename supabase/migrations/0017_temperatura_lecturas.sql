-- Historial del sensor ESP32: una lectura cada 5 minutos, se guardan 7 días
create table if not exists public.temperatura_lecturas (
  id bigint generated always as identity primary key,
  fecha timestamptz not null default now(),
  temperatura numeric not null
);
create index if not exists temperatura_lecturas_fecha on public.temperatura_lecturas (fecha desc);
alter table public.temperatura_lecturas enable row level security;
create policy "temperatura_lecturas_leer" on public.temperatura_lecturas for select to authenticated using (true);

-- Copia la última lectura (temperatura_alerta, que la función actualiza cada minuto) y borra lo de más de 7 días.
-- actualizado_en llega en hora de Colombia (UTC-5) por el reloj del motor de alertas.
create or replace function private.guardar_lectura_temperatura() returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.temperatura_lecturas (fecha, temperatura)
  select now(), a.temperatura from public.temperatura_alerta a
  where a.id = 1 and a.temperatura is not null
    and (a.actualizado_en > now() - interval '3 minutes' or a.actualizado_en + interval '5 hours' > now() - interval '3 minutes');
  delete from public.temperatura_lecturas where fecha < now() - interval '7 days';
end $$;
revoke all on function private.guardar_lectura_temperatura() from public;
select cron.schedule('temperatura-historial', '*/5 * * * *', 'select private.guardar_lectura_temperatura()');
