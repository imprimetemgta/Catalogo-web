// Mapeo de filas (inventario.json o Supabase) a la forma de producto de /reposicion.
// Lógica pura: sin imports de la app, para poder testearla con node --test.
import { sumarDias } from "./ventas.js";

// null si no hay dato (clave ausente o null): "sin dato" no es "cero unidades".
function numeroONull(v) {
  return v == null ? null : Number(v);
}

export function mapearFilaJson(r) {
  return {
    codigo: r.CODIGO,
    nombre: r.DESCRIPCION,
    referencia: r.REFERENCIA ?? null,
    marca: r.MARCA ?? null,
    modelo: r.MODELO ?? null,
    departamento: r.NOMBRE_DEPARTAMENTO || null,
    precio: Number(r.PRECIO_USD),
    disponible: Number(r.EXISTENCIA_DISPONIBLE) || 0,
    bruta: numeroONull(r.EXISTENCIA_BRUTA),
    pedido: numeroONull(r.EXISTENCIA_PEDIDO),
    creadoEn: null, // inventario.json no trae fecha de alta
    imagen: null, // sin Supabase Storage local
  };
}

// Misma URL de imagen que /api/productos: derivada del código, en el bucket público.
const BUCKET = "productos";
const safe = (c) => String(c).replace(/[^A-Za-z0-9._-]/g, "_");

export function mapearFilaSupabase(row, baseUrl) {
  return {
    codigo: row.codigo,
    nombre: row.descripcion,
    referencia: row.referencia ?? null,
    marca: row.marca ?? null,
    modelo: row.modelo ?? null,
    departamento: row.nombre_departamento || null,
    precio: Number(row.precio_usd),
    disponible: Number(row.existencia_disponible) || 0,
    bruta: numeroONull(row.existencia_bruta),
    pedido: numeroONull(row.existencia_pedido),
    creadoEn: row.creado_en ?? null,
    imagen: `${baseUrl}/storage/v1/object/public/${BUCKET}/${safe(row.codigo)}.jpg`,
  };
}

const SIN_VENTAS = { u7: 0, u15: 0, u30: 0, ultima: null };

// Agrega `ventas` a cada producto. totales: Map codigo -> {u7,u15,u30,ultima} o
// null (sin dato de ventas). Un código ausente del Map vendió cero. No muta.
export function unirVentas(productos, totales) {
  return productos.map((p) => ({
    ...p,
    ventas: totales ? (totales.get(String(p.codigo).trim()) ?? { ...SIN_VENTAS }) : null,
  }));
}

// Mueve `hasta` y cada `fecha` los mismos días para que hasta sea hoyStr
// (solo para el ejemplo local). No muta.
export function desplazarAHoy(carga, hoyStr) {
  const dias = Math.round((Date.parse(hoyStr) - Date.parse(carga.hasta)) / 86400000);
  return {
    ...carga,
    hasta: hoyStr,
    filas: carga.filas.map((f) => ({ ...f, fecha: sumarDias(f.fecha, dias) })),
  };
}
