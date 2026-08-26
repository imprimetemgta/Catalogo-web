-- ============================================================
--  Esquema del catálogo en Supabase
--  Campos alineados 1:1 con lo que envía el sync desde A2.
--  Ejecutar TODO este archivo en: Supabase → SQL Editor.
--  (La sección final de "referencia para el backend" está
--   comentada a propósito: no se ejecuta aquí.)
-- ============================================================

-- ── Tabla principal de productos ──────────────────────────
create table public.productos (
  codigo                 text primary key,               -- CODIGO (clave única, para el upsert)
  descripcion            text not null,                  -- DESCRIPCION
  referencia             text,                           -- REFERENCIA
  marca                  text,                           -- MARCA
  modelo                 text,                           -- MODELO
  publicaweb             boolean not null default false, -- PUBLICAWEB (controla visibilidad)
  precio_usd             numeric(12,2) not null default 0, -- PRECIO_USD
  existencia_bruta       integer not null default 0,     -- EXISTENCIA_BRUTA (interno)
  existencia_pedido      integer not null default 0,     -- EXISTENCIA_PEDIDO (interno)
  existencia_disponible  integer not null default 0,     -- EXISTENCIA_DISPONIBLE (la que ve el catálogo)
  creado_en              timestamptz not null default now(), -- se fija al insertar; NO cambia luego
  actualizado_en         timestamptz not null default now()  -- cambia en cada sincronización
);

-- Índice para el catálogo
create index idx_productos_publicaweb on public.productos (publicaweb);

-- ── Seguridad a nivel de fila (RLS) ───────────────────────
-- El sitio usa la clave ANON: solo puede LEER productos con publicaweb = true.
-- La escritura la hará el backend con la clave service_role (ignora RLS),
-- por eso NO se crea ninguna política de escritura para anon.
alter table public.productos enable row level security;

create policy "lectura_publica_productos_visibles"
  on public.productos for select
  to anon
  using (publicaweb = true);


-- ============================================================
--  REFERENCIA PARA EL BACKEND — NO EJECUTAR EN EL SQL EDITOR
--  Todo lo de abajo está comentado. Es la lógica que corre
--  tu backend Next.js (con service_role), no parte del esquema.
-- ============================================================

-- UPSERT por producto (los $1..$10 los rellena el backend).
-- OJO: creado_en NO va aquí. En la inserción lo pone el default;
-- en el update NO se toca, para conservar la fecha de creación.
--
-- insert into public.productos
--   (codigo, descripcion, referencia, marca, modelo,
--    publicaweb, precio_usd,
--    existencia_bruta, existencia_pedido, existencia_disponible, actualizado_en)
-- values
--   ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
-- on conflict (codigo) do update set
--   descripcion           = excluded.descripcion,
--   referencia            = excluded.referencia,
--   marca                 = excluded.marca,
--   modelo                = excluded.modelo,
--   publicaweb            = excluded.publicaweb,
--   precio_usd            = excluded.precio_usd,
--   existencia_bruta      = excluded.existencia_bruta,
--   existencia_pedido     = excluded.existencia_pedido,
--   existencia_disponible = excluded.existencia_disponible,
--   actualizado_en        = now();
--
-- Barrido posterior: ocultar productos que ya no llegaron en el lote
-- (ajusta el intervalo al tiempo real de tu sincronización):
--
-- update public.productos
-- set publicaweb = false
-- where actualizado_en < now() - interval '10 minutes'
--   and publicaweb = true;
