-- ============================================================
--  Ventas diarias por producto (página interna de reposición, fase 2)
--  Correr en Supabase antes de desplegar la fase 2.
--  Ejecutar en: Supabase → SQL Editor. Es idempotente.
-- ============================================================

-- Una fila por producto y día (unidades vendidas, pueden ser negativas
-- por devoluciones). Se reemplaza completa en cada carga.
create table if not exists public.ventas_diarias (
  codigo   text    not null,
  fecha    date    not null,
  unidades numeric not null,
  primary key (codigo, fecha)
);

-- Una sola fila (id = 1): hasta qué día llegó la última carga.
create table if not exists public.ventas_corte (
  id             int primary key default 1 check (id = 1),
  hasta          date not null,
  actualizado_en timestamptz not null default now()
);

-- Sin políticas: nadie del lado público las toca. El backend usa service_role.
alter table public.ventas_diarias enable row level security;
alter table public.ventas_corte   enable row level security;

-- Reemplaza todo el historial en UNA transacción (la función entera lo es):
-- si algo falla, queda la carga anterior intacta.
-- p_filas: arreglo JSON de { codigo, fecha, unidades }. Devuelve cuántas insertó.
create or replace function public.reemplazar_ventas(p_hasta date, p_filas jsonb)
returns integer
language plpgsql
as $$
declare
  v_insertadas integer;
begin
  delete from public.ventas_diarias where true;

  insert into public.ventas_diarias (codigo, fecha, unidades)
  select x.codigo, x.fecha, x.unidades
  from jsonb_to_recordset(p_filas) as x(codigo text, fecha date, unidades numeric);
  get diagnostics v_insertadas = row_count;

  insert into public.ventas_corte (id, hasta, actualizado_en)
  values (1, p_hasta, now())
  on conflict (id) do update
    set hasta = excluded.hasta,
        actualizado_en = excluded.actualizado_en;

  return v_insertadas;
end;
$$;

-- Solo el backend (service_role) puede llamarla.
revoke execute on function public.reemplazar_ventas(date, jsonb)
  from public, anon, authenticated;
