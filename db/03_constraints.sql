-- ============================================================
--  Restricciones de la tabla productos (última red de la BD)
--  Ejecutar en: Supabase → SQL Editor.
--  El backend ya limpia estos casos; esto garantiza que la BD
--  nunca acepte cantidades ni precios negativos, aunque un
--  cambio futuro en el backend los dejara pasar.
--
--  Nota: si YA tienes filas que violan alguna regla, el ALTER
--  fallará indicando cuál. Corrige esas filas y vuelve a correr.
-- ============================================================

alter table public.productos
  add constraint chk_precio_no_negativo      check (precio_usd >= 0),
  add constraint chk_bruta_no_negativa       check (existencia_bruta >= 0),
  add constraint chk_pedido_no_negativa      check (existencia_pedido >= 0),
  add constraint chk_disponible_no_negativa  check (existencia_disponible >= 0);
