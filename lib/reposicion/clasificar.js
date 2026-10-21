// Clasificación de stock para la página interna de reposición.
// Lógica pura (sin imports de la app) para poder probarla con node --test.

import { MINIMO_STOCK, metricasDe, UMBRAL_REPONER_DIAS, PERIODO_PREDETERMINADO } from "./metricas.js";

export { MINIMO_STOCK };

// Orden de evaluación importa: bruta null = sin dato de A2.
export function estadoDe(p) {
  if (p.bruta == null) return "a_consultar";
  if (p.bruta <= 0) return "sin_existencias";
  if (p.disponible <= 0) return "agotado";
  if (p.disponible <= MINIMO_STOCK) return "bajo";
  return "ok";
}

// Misma regla de 30 días que components/CatalogoWhatsApp.jsx (duplicada a
// propósito para no tocar el catálogo público).
const UN_MES_MS = 30 * 24 * 60 * 60 * 1000;
export function esNuevo(creadoEn, ahoraMs = Date.now()) {
  if (!creadoEn) return false;
  const fecha = new Date(creadoEn).getTime();
  return Number.isFinite(fecha) && ahoraMs - fecha <= UN_MES_MS;
}

export const FILTROS = ["todos", "agotado", "sin_existencias", "bajo", "nuevos", "a_consultar", "mas_vendidos", "reponer_ya", "sin_movimiento"];
export const ORDENES = ["nombre", "precio_asc", "precio_desc", "existencia_asc", "vendidos_desc", "alcanza_asc"];

const normalizar = (s) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Filtros de ventas. Sin datos de ventas (metricasDe null) ninguno incluye al producto.
const FILTROS_VENTAS = {
  mas_vendidos: (p, m) => m != null && m.vendidos > 0,
  reponer_ya: (p, m) =>
    m != null && estadoDe(p) !== "a_consultar" && m.vendidos > 0 && m.alcanzaDias < UMBRAL_REPONER_DIAS,
  sin_movimiento: (p, m) =>
    m != null && estadoDe(p) !== "a_consultar" && p.disponible > 0 && p.ventas.u30 <= 0,
};

const porNombre = (a, b) => String(a.nombre ?? "").localeCompare(String(b.nombre ?? ""), "es");

export function filtrarYOrdenar(
  productos,
  { filtro = "todos", departamento = null, busqueda = "", orden = "nombre", periodo = PERIODO_PREDETERMINADO } = {},
  ahoraMs = Date.now()
) {
  const q = normalizar(busqueda).trim();
  const lista = productos.filter((p) => {
    if (departamento && p.departamento !== departamento) return false;
    if (Object.hasOwn(FILTROS_VENTAS, filtro)) {
      if (!FILTROS_VENTAS[filtro](p, metricasDe(p, periodo))) return false;
    } else if (filtro === "nuevos") {
      if (!esNuevo(p.creadoEn, ahoraMs)) return false;
    } else if (filtro !== "todos" && estadoDe(p) !== filtro) {
      return false;
    }
    if (q) {
      return [p.nombre, p.codigo, p.referencia].some((c) => normalizar(c).includes(q));
    }
    return true;
  });

  // sort sobre la copia filtrada: la entrada no se muta.
  if (orden === "precio_asc") {
    lista.sort((a, b) => (a.precio ?? Infinity) - (b.precio ?? Infinity) || porNombre(a, b));
  } else if (orden === "precio_desc") {
    lista.sort((a, b) => (b.precio ?? -Infinity) - (a.precio ?? -Infinity) || porNombre(a, b));
  } else if (orden === "existencia_asc") {
    // Sin dato (bruta null) al final: no sabemos su existencia real.
    const clave = (p) => (p.bruta == null ? Infinity : p.disponible);
    lista.sort((a, b) => {
      const ka = clave(a), kb = clave(b);
      if (ka === kb) return porNombre(a, b);
      return ka < kb ? -1 : 1;
    });
  } else if (orden === "vendidos_desc") {
    const clave = (p) => metricasDe(p, periodo)?.vendidos ?? 0;
    lista.sort((a, b) => clave(b) - clave(a) || porNombre(a, b));
  } else if (orden === "alcanza_asc") {
    const clave = (p) => metricasDe(p, periodo)?.alcanzaDias ?? Infinity;
    const vendidos = (p) => metricasDe(p, periodo)?.vendidos ?? 0;
    lista.sort((a, b) => {
      const ka = clave(a), kb = clave(b);
      if (ka === kb) return vendidos(b) - vendidos(a) || porNombre(a, b);
      return ka < kb ? -1 : 1;
    });
  } else {
    lista.sort(porNombre);
  }
  return lista;
}

// Urgencia de reposición por producto, para la columna de la fila.
// periodo null = sin ventas cargadas: no se evalúa "reponer ya".
export function urgenciaDe(p, periodo) {
  const estado = estadoDe(p);
  if (estado === "a_consultar") return "consultar";
  if (estado === "agotado" || estado === "sin_existencias") return "critico";
  if (periodo != null && FILTROS_VENTAS.reponer_ya(p, metricasDe(p, periodo))) return "critico";
  if (estado === "bajo") return "bajo";
  return "ok";
}

// Valores del filtro/orden al abrir la página, según haya ventas cargadas o no.
export const INICIAL = Object.freeze({
  conVentas: Object.freeze({ filtro: "reponer_ya", orden: "alcanza_asc" }),
  sinVentas: Object.freeze({ filtro: "todos", orden: "existencia_asc" }),
});

export function resumen(productos, ahoraMs = Date.now(), periodo = PERIODO_PREDETERMINADO) {
  const r = {
    total: productos.length, agotado: 0, sin_existencias: 0, bajo: 0, a_consultar: 0, nuevos: 0,
    mas_vendidos: 0, reponer_ya: 0, sin_movimiento: 0,
  };
  const deptos = new Map();
  for (const p of productos) {
    const estado = estadoDe(p);
    if (esNuevo(p.creadoEn, ahoraMs)) r.nuevos++;
    const m = metricasDe(p, periodo);
    for (const f in FILTROS_VENTAS) if (FILTROS_VENTAS[f](p, m)) r[f]++;
    if (estado === "ok") continue;
    r[estado]++;
    const nombre = p.departamento ?? "Sin departamento";
    if (!deptos.has(nombre)) {
      deptos.set(nombre, { departamento: nombre, agotado: 0, sin_existencias: 0, bajo: 0, a_consultar: 0 });
    }
    deptos.get(nombre)[estado]++;
  }
  const grave = (d) => d.agotado + d.sin_existencias + d.bajo;
  r.porDepartamento = [...deptos.values()].sort((a, b) => grave(b) - grave(a));
  return r;
}
