-- ============================================================
--  Rate limiting para /api/sync  (ventana fija, atómico)
--  Ejecutar en: Supabase → SQL Editor.
-- ============================================================

-- Almacén compartido de contadores (una fila por clave, ej. "sync:<ip>")
create table if not exists public.rate_limits (
  clave           text primary key,
  contador        integer not null default 0,
  ventana_inicio  timestamptz not null default now()
);

-- Nadie del lado público la toca. El backend usa service_role (ignora RLS).
alter table public.rate_limits enable row level security;

-- Función atómica: suma 1 al contador de la clave dentro de la ventana y
-- devuelve TRUE si sigue dentro del límite, FALSE si se pasó.
-- Todo ocurre en un solo statement (INSERT ... ON CONFLICT), que bloquea la
-- fila en conflicto, así que dos llamadas simultáneas no se pisan.
create or replace function public.rate_limit_check(
  p_clave text,
  p_limite integer,
  p_ventana_segundos integer
) returns boolean
language plpgsql
as $$
declare
  v_contador integer;
begin
  insert into public.rate_limits (clave, contador, ventana_inicio)
  values (p_clave, 1, now())
  on conflict (clave) do update set
    contador = case
      when rate_limits.ventana_inicio < now() - make_interval(secs => p_ventana_segundos)
        then 1                              -- ventana vencida: reinicia
      else rate_limits.contador + 1          -- misma ventana: incrementa
    end,
    ventana_inicio = case
      when rate_limits.ventana_inicio < now() - make_interval(secs => p_ventana_segundos)
        then now()
      else rate_limits.ventana_inicio
    end
  returning contador into v_contador;

  return v_contador <= p_limite;
end;
$$;
