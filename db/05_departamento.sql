-- ============================================================
--  Departamento (categoría) — filtro adicional en el catálogo
--  Ejecutar en: Supabase → SQL Editor.
--  Alinea con NOMBRE_DEPARTAMENTO del export de A2. Idempotente:
--  se puede correr aunque la columna ya exista.
-- ============================================================

alter table public.productos
  add column if not exists nombre_departamento text;
