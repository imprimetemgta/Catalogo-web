-- ============================================================
--  Bucket de imágenes de productos (Supabase Storage)
--  Ejecutar en: Supabase → SQL Editor.
--  Alternativa: Storage → New bucket → nombre "productos" → Public.
-- ============================================================

-- Bucket público: las imágenes se leen sin autenticación (URL directa).
-- La subida la hace el script con la llave service_role (que ignora RLS).
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;
