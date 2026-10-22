// Orden "Más nuevos primero", compartido por el catálogo y /reposicion.
// Lógica pura: sin imports de la app, para poder testearla con node --test.

// Fecha de alta en ms, o null si no hay (p. ej. el modo de prueba sin Supabase).
const msDeAlta = (p) => {
  const ms = p.creadoEn ? new Date(p.creadoEn).getTime() : NaN;
  return Number.isFinite(ms) ? ms : null;
};

// creado_en de la más reciente a la más vieja; sin fecha al final. Entre
// iguales (la carga inicial comparte fecha), por nombre.
export function porMasNuevos(a, b) {
  const ma = msDeAlta(a);
  const mb = msDeAlta(b);
  if (ma !== mb) {
    if (ma == null) return 1;
    if (mb == null) return -1;
    return mb - ma;
  }
  return String(a.nombre ?? "").localeCompare(String(b.nombre ?? ""), "es");
}
