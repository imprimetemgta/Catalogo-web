// Validación de la carga diaria de ventas (A2 -> /api/sync-ventas).
// Lógica pura (sin imports de la app). Fechas "AAAA-MM-DD" de punta a punta;
// se calculan con Date.UTC para no depender de la zona horaria.

const MAX_FILAS = 50000;
const MAX_UNIDADES = 10000000;
const MAX_CODIGO = 64;
const DIAS_VENTANA = 30;
const MENSAJE_VACIA =
  "La carga llegó vacía o sin filas válidas; no se aplicó nada.";

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

function aUtc(fechaStr) {
  const m = RE_FECHA.exec(fechaStr);
  if (!m) return NaN;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(a, mes - 1, d);
  const f = new Date(t);
  // Rechaza fechas que Date "corrige" (30 de febrero, mes 13...).
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== d)
    return NaN;
  return t;
}

export function esFechaValida(fechaStr) {
  return typeof fechaStr === "string" && !Number.isNaN(aUtc(fechaStr));
}

export function sumarDias(fechaStr, n) {
  return new Date(aUtc(fechaStr) + n * 86400000).toISOString().slice(0, 10);
}

export function validarCargaVentas(cuerpo, hoyStr) {
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo))
    return { ok: false, error: "Se esperaba un objeto { hasta, filas }" };
  const { hasta, filas } = cuerpo;
  if (!esFechaValida(hasta))
    return { ok: false, error: "«hasta» debe ser una fecha AAAA-MM-DD válida" };
  if (hasta > sumarDias(hoyStr, 1))
    return { ok: false, error: "«hasta» no puede ser una fecha futura" };
  if (!Array.isArray(filas))
    return { ok: false, error: "«filas» debe ser un arreglo" };
  if (filas.length > MAX_FILAS)
    return { ok: false, error: `«filas» excede el máximo de ${MAX_FILAS}` };

  const desde = sumarDias(hasta, -(DIAS_VENTANA - 1));
  const acumulado = new Map();
  const descartadas = [];

  for (const r of filas) {
    const codigo = String(r?.codigo ?? "").trim();
    const descartar = (motivo) => descartadas.push({ codigo: codigo || null, motivo });
    if (!codigo) { descartar("sin código"); continue; }
    if (codigo.length > MAX_CODIGO) { descartar("código demasiado largo"); continue; }
    if (!esFechaValida(r.fecha)) { descartar("fecha inválida"); continue; }
    if (r.fecha < desde || r.fecha > hasta) { descartar("fecha fuera de la ventana"); continue; }
    const u = typeof r.unidades === "number" ? r.unidades : NaN;
    if (!Number.isFinite(u)) { descartar("unidades no numéricas"); continue; }
    if (Math.abs(u) > MAX_UNIDADES) { descartar("unidades fuera de rango"); continue; }

    const clave = `${codigo}|${r.fecha}`;
    const previa = acumulado.get(clave);
    if (previa) previa.unidades += u;
    else acumulado.set(clave, { codigo, fecha: r.fecha, unidades: u });
  }

  if (acumulado.size === 0) return { ok: false, error: MENSAJE_VACIA };
  return { ok: true, hasta, filas: [...acumulado.values()], descartadas };
}
