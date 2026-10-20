// Clasificación de stock para la página interna de reposición.
// Lógica pura (sin imports de la app) para poder probarla con node --test.

export const MINIMO_STOCK = 5;

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

export const FILTROS = ["todos", "agotado", "sin_existencias", "bajo", "nuevos", "a_consultar"];
export const ORDENES = ["nombre", "precio_asc", "precio_desc", "existencia_asc"];

const normalizar = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const porNombre = (a, b) => String(a.nombre ?? "").localeCompare(String(b.nombre ?? ""), "es");

export function filtrarYOrdenar(
  productos,
  { filtro = "todos", departamento = null, busqueda = "", orden = "nombre" } = {},
  ahoraMs = Date.now()
) {
  const q = normalizar(busqueda).trim();
  const lista = productos.filter((p) => {
    if (departamento && p.departamento !== departamento) return false;
    if (filtro === "nuevos") {
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
  } else {
    lista.sort(porNombre);
  }
  return lista;
}

export function resumen(productos, ahoraMs = Date.now()) {
  const r = { total: productos.length, agotado: 0, sin_existencias: 0, bajo: 0, a_consultar: 0, nuevos: 0 };
  const deptos = new Map();
  for (const p of productos) {
    const estado = estadoDe(p);
    if (esNuevo(p.creadoEn, ahoraMs)) r.nuevos++;
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
