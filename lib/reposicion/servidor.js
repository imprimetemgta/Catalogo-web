// Capa de servidor de /reposicion: modo local, secreto, usuarios, sesión y datos.
// Solo para código de servidor (usa service_role y next/headers).
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase";
import { COOKIE_SESION, hashClave, verificarToken } from "@/lib/reposicion/auth";
import { mapearFilaJson, mapearFilaSupabase } from "@/lib/reposicion/datos";

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

// { usuario } si la cookie trae un token válido y vigente; si no, null.
export async function sesionActual() {
  const secreto = secretoSesion();
  if (!secreto) return null;
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  return token ? verificarToken(token, secreto) : null;
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

  const { data, error } = await getServiceClient()
    .from("productos")
    .select(
      "codigo, descripcion, referencia, marca, modelo, nombre_departamento, precio_usd, existencia_bruta, existencia_pedido, existencia_disponible, creado_en"
    )
    .eq("publicaweb", true)
    .order("descripcion");
  if (error) throw new Error(`productos: ${error.message}`);

  const base = process.env.SUPABASE_URL;
  return (data ?? []).map((row) => mapearFilaSupabase(row, base));
}
