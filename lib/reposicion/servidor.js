// Capa de servidor de /reposicion: modo local, secreto, usuarios, sesión y datos.
// Solo para código de servidor (usa service_role y next/headers).
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase";
import { COOKIE_SESION, hashClave, verificarToken } from "@/lib/reposicion/auth";
import {
  mapearFilaJson,
  mapearFilaSupabase,
  desplazarAHoy,
} from "@/lib/reposicion/datos";
import { totalesPorCodigo } from "@/lib/reposicion/metricas";

// DEV ONLY: sin Supabase y fuera de producción. Nunca se activa en Vercel
// porque ahí SUPABASE_URL siempre está definida y NODE_ENV es production.
export function modoLocal() {
  return !process.env.SUPABASE_URL && process.env.NODE_ENV !== "production";
}

const SECRETO_DEV = "solo-desarrollo-local-reposicion-no-usar-en-produccion";
const LARGO_MIN_SECRETO = 32;

// Secreto para firmar la sesión, o null si no hay uno usable (las rutas cierran).
export function secretoSesion() {
  const s = process.env.REPOSICION_SESSION_SECRET;
  if (typeof s === "string" && s.length >= LARGO_MIN_SECRETO) return s;
  return modoLocal() ? SECRETO_DEV : null;
}

// Usuario de prueba del modo local; su hash se calcula una vez y queda en memoria.
const USUARIO_DEV = "prueba";
const CLAVE_DEV = "prueba-local-123";
let hashDev = null;

// Hash guardado del usuario activo, o null si no existe o está inactivo.
export async function buscarHashUsuario(usuario) {
  if (modoLocal()) {
    if (usuario !== USUARIO_DEV) return null;
    hashDev ??= hashClave(CLAVE_DEV);
    return hashDev;
  }
  const { data, error } = await getServiceClient()
    .from("usuarios_reposicion")
    .select("clave_hash")
    .eq("usuario", usuario)
    .eq("activo", true)
    .maybeSingle();
  if (error) throw new Error(`usuarios_reposicion: ${error.message}`);
  return data?.clave_hash ?? null;
}

// true si el usuario sigue existiendo y activo. Ante un error de la base,
// false: sin confirmación no hay sesión (fail-closed).
export async function usuarioActivo(usuario) {
  if (modoLocal()) return usuario === USUARIO_DEV;
  const { data, error } = await getServiceClient()
    .from("usuarios_reposicion")
    .select("usuario")
    .eq("usuario", usuario)
    .eq("activo", true)
    .maybeSingle();
  if (error) {
    console.error("sesion reposicion:", error.message);
    return false;
  }
  return Boolean(data);
}

// { usuario } si la cookie trae un token válido y vigente y el usuario sigue
// activo (así dar de baja corta el acceso en la siguiente petición); si no, null.
export async function sesionActual() {
  const secreto = secretoSesion();
  if (!secreto) return null;
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  const sesion = token ? verificarToken(token, secreto) : null;
  if (!sesion) return null;
  try {
    return (await usuarioActivo(sesion.usuario)) ? sesion : null;
  } catch (e) {
    console.error("sesion reposicion:", e.message);
    return null;
  }
}

const TAMANO_PAGINA = 1000;

// Lee todas las filas de una consulta de Supabase en bloques de 1000 (tope de
// PostgREST). `consulta(desde, hasta)` debe traer un .order() estable.
// Supone que el max-rows de PostgREST es >= 1000 (el valor por defecto de Supabase);
// si fuera menor, una página corta se tomaría por la última y se perderían filas.
async function leerTodo(etiqueta, consulta) {
  const filas = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await consulta(desde, desde + TAMANO_PAGINA - 1);
    if (error) throw new Error(`${etiqueta}: ${error.message}`);
    filas.push(...(data ?? []));
    if (!data || data.length < TAMANO_PAGINA) return filas;
  }
}

// Fecha local de hoy como "AAAA-MM-DD" (no toISOString: eso es UTC).
function hoyLocal() {
  const d = new Date();
  const dos = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export async function obtenerProductosReposicion() {
  if (modoLocal()) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const ruta = path.join(process.cwd(), "inventario.json");
    const crudo = JSON.parse(await fs.readFile(ruta, "utf-8"));
    return crudo
      .filter((r) => String(r.PUBLICAWEB).toLowerCase() === "true")
      .map(mapearFilaJson)
      .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
  }

  const db = getServiceClient();
  const data = await leerTodo("productos", (desde, hasta) =>
    db
      .from("productos")
      .select(
        "codigo, descripcion, referencia, marca, modelo, nombre_departamento, precio_usd, existencia_bruta, existencia_pedido, existencia_disponible, creado_en"
      )
      .eq("publicaweb", true)
      .order("descripcion")
      .order("codigo")
      .range(desde, hasta)
  );

  const base = process.env.SUPABASE_URL;
  return data.map((row) => mapearFilaSupabase(row, base));
}

// { hasta, totales: Map codigo -> {u7,u15,u30,ultima} }, o null si aún no hay
// ninguna carga de ventas. En modo local usa ventas.ejemplo.json (datos
// inventados) desplazado para que termine hoy.
export async function obtenerVentasReposicion() {
  if (modoLocal()) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    let crudo;
    try {
      crudo = await fs.readFile(path.join(process.cwd(), "ventas.ejemplo.json"), "utf-8");
    } catch (e) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
    const carga = desplazarAHoy(JSON.parse(crudo), hoyLocal());
    return { hasta: carga.hasta, totales: totalesPorCodigo(carga.filas, carga.hasta) };
  }

  // Ojo: las lecturas de ventas_corte y ventas_diarias no son atómicas. Si la carga
  // diaria corre justo entre las dos, se mezclan datos de dos cargas; pasa a lo más
  // una vez al día, por segundos, y se acepta.
  const db = getServiceClient();
  const { data: corte, error } = await db
    .from("ventas_corte")
    .select("hasta")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(`ventas_corte: ${error.message}`);
  if (!corte) return null;

  const filas = await leerTodo("ventas_diarias", (desde, hasta) =>
    db
      .from("ventas_diarias")
      .select("codigo, fecha, unidades")
      .order("codigo")
      .order("fecha")
      .range(desde, hasta)
  );
  return {
    hasta: corte.hasta,
    totales: totalesPorCodigo(
      filas.map((f) => ({ codigo: String(f.codigo).trim(), fecha: f.fecha, unidades: Number(f.unidades) })),
      corte.hasta
    ),
  };
}
