-- ============================================================
--  Existencia bruta / pedido: permitir NULL ("A2 no mandó el dato")
--  Ejecutar en: Supabase → SQL Editor.
-- ============================================================

-- NULL = A2 no envió el dato; 0 = A2 dijo que hay cero.
-- Los checks >= 0 de 03_constraints.sql siguen valiendo: NULL los pasa.
alter table public.productos
  alter column existencia_bruta  drop not null,
  alter column existencia_pedido drop not null;
