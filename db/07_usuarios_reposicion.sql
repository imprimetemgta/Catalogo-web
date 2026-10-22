-- ============================================================
--  Usuarios de la página interna de reposición
--  Ejecutar en: Supabase → SQL Editor.
-- ============================================================

create table if not exists public.usuarios_reposicion (
  usuario    text primary key,
  clave_hash text not null,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

-- Sin políticas: nadie del lado público la toca. El backend usa service_role.
alter table public.usuarios_reposicion enable row level security;
