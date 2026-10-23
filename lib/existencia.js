// Convierte una existencia que manda A2 a entero acotado a [0, max].
// Devuelve null si A2 no mandó dato (null, undefined, "") o no es numérico:
// "sin dato" es distinto de "cero unidades".
export function existenciaONull(v, max) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, 0), max);
}

// Los combos se arman al momento: A2 no lleva su existencia, así que en el
// catálogo se muestran "A consultar" (nunca "Agotado") y se pueden pedir.
const DEPARTAMENTO_A_CONSULTAR = "COMBOS";

export function esAConsultar(p) {
  return String(p?.departamento ?? "").trim().toUpperCase() === DEPARTAMENTO_A_CONSULTAR;
}

// Máximo de unidades que el carrito deja pedir: sin tope para lo que es a consultar.
export function topeCarrito(p) {
  return esAConsultar(p) ? Infinity : p.existencia;
}
