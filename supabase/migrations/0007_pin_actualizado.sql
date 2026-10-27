-- Fecha del último cambio de PIN: si cambia, el teléfono del usuario pide entrar de nuevo
alter table public.perfiles add column if not exists pin_actualizado timestamptz;
