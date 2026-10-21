// Métricas de ventas por producto para la página de reposición.
// Lógica pura (sin imports de la app). Fechas "AAAA-MM-DD" comparadas como texto.
import { sumarDias } from "./ventas.js";

export const MINIMO_STOCK = 5;
export const PERIODOS = [7, 15, 30];
export const PERIODO_PREDETERMINADO = 30;
export const COBERTURA_OBJETIVO_DIAS = 30;
export const UMBRAL_REPONER_DIAS = 7;
export const DIAS_DESACTUALIZADO = 2;

// Suma de unidades por código en las ventanas de 7, 15 y 30 días que terminan
// en `hasta`. No recorta negativos (devoluciones): eso se hace al mostrar.
export function totalesPorCodigo(filas, hasta) {
  const desde7 = sumarDias(hasta, -6);
  const desde15 = sumarDias(hasta, -14);
  const desde30 = sumarDias(hasta, -29);
  const mapa = new Map();
  for (const f of filas) {
    if (f.fecha < desde30 || f.fecha > hasta) continue;
    let t = mapa.get(f.codigo);
    if (!t) {
      t = { u7: 0, u15: 0, u30: 0, ultima: null };
      mapa.set(f.codigo, t);
    }
    t.u30 += f.unidades;
    if (f.fecha >= desde15) t.u15 += f.unidades;
    if (f.fecha >= desde7) t.u7 += f.unidades;
    if (f.unidades > 0 && (t.ultima === null || f.fecha > t.ultima)) t.ultima = f.fecha;
  }
  return mapa;
}

export function metricasDe(producto, periodo) {
  const ventas = producto.ventas;
  if (ventas == null) return null;
  const vendidos = Math.max(0, ventas["u" + periodo]);
  const disponible = producto.disponible;
  let alcanzaDias = null;
  let sugerido = null;
  if (vendidos > 0) {
    const porDia = vendidos / periodo;
    alcanzaDias = disponible <= 0 ? 0 : Math.floor(disponible / porDia);
    const falta =
      Math.max(MINIMO_STOCK, Math.ceil(porDia * COBERTURA_OBJETIVO_DIAS)) - Math.max(0, disponible);
    sugerido = falta > 0 ? falta : null;
  }
  return { vendidos, alcanzaDias, sugerido, ultima: ventas.ultima };
}

export function diasDesde(hasta, hoyStr) {
  return Math.round((Date.parse(hoyStr) - Date.parse(hasta)) / 86400000);
}
