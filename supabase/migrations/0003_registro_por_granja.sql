alter table public.registro_actividad add column if not exists granja text check (granja is null or length(granja) <= 60);
