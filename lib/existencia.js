// Convierte una existencia que manda A2 a entero acotado a [0, max].
// Devuelve null si A2 no mandó dato (null, undefined, "") o no es numérico:
// "sin dato" es distinto de "cero unidades".
export function existenciaONull(v, max) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, 0), max);
}
