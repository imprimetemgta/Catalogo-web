import { NextResponse } from "next/server";
import { dentroDeLimite } from "@/lib/rateLimit";
import {
  COOKIE_SESION,
  DURACION_SESION_MS,
  RUTA_SECRETA,
  crearToken,
  verificarClave,
} from "@/lib/reposicion/auth";
import {
  buscarHashUsuario,
  modoLocal,
  secretoSesion,
} from "@/lib/reposicion/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 5 intentos por IP cada 5 minutos; si el limitador falla, se bloquea.
const RL_LIMITE = 5;
const RL_VENTANA_SEG = 300;
const LARGO_MAX = 200;
const SIN_CACHE = { "Cache-Control": "no-store" };

function ipDe(request) {
  const xff = request.headers.get("x-forwarded-for") || "";
  return (
    xff.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "desconocida"
  );
}

function responder(cuerpo, status, extra = {}) {
  return NextResponse.json(cuerpo, {
    status,
    headers: { ...SIN_CACHE, ...extra },
  });
}

// Siempre el mismo mensaje: no revela si falló el usuario o la clave.
function noAutorizado() {
  return responder({ error: "Usuario o clave incorrectos" }, 401);
}

function opcionesCookie(maxAge) {
  return {
    httpOnly: true,
    secure: !modoLocal(),
    sameSite: "strict",
    path: RUTA_SECRETA,
    maxAge,
  };
}

function textoValido(v) {
  return typeof v === "string" && v.length > 0 && v.length <= LARGO_MAX;
}

export async function POST(request) {
  // 1) Rate limit por IP, fail-closed (se salta solo en modo local)
  if (!modoLocal()) {
    const ip = ipDe(request);
    const ok = await dentroDeLimite(`login:${ip}`, RL_LIMITE, RL_VENTANA_SEG, {
      failOpen: false,
    });
    if (!ok) {
      return responder(
        { error: "Demasiados intentos. Intenta más tarde." },
        429,
        { "Retry-After": String(RL_VENTANA_SEG) }
      );
    }
  }

  // 2) Sin secreto de sesión configurado no se puede emitir sesión
  const secreto = secretoSesion();
  if (!secreto) {
    return responder({ error: "Servicio no disponible" }, 503);
  }

  // 3) Solo JSON: un formulario de otro sitio no puede mandar este
  //    content-type sin preflight CORS, así se evita el login CSRF.
  const tipo = (request.headers.get("content-type") || "").toLowerCase();
  if (!tipo.startsWith("application/json")) {
    return responder({ error: "Se espera JSON" }, 415);
  }

  // 4) Cuerpo { usuario, clave }
  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return responder({ error: "JSON inválido" }, 400);
  }
  const usuario =
    typeof cuerpo?.usuario === "string" ? cuerpo.usuario.trim() : null;
  const clave = cuerpo?.clave;
  if (!textoValido(usuario) || !textoValido(clave)) return noAutorizado();

  // 5) Verificación. Si el usuario no existe, hash es null y verificarClave
  //    corre un scrypt señuelo para que la respuesta tarde lo mismo.
  let hash;
  try {
    hash = await buscarHashUsuario(usuario);
  } catch (e) {
    console.error("login reposicion:", e.message);
    return responder({ error: "Error interno" }, 500);
  }
  if (!(await verificarClave(clave, hash))) return noAutorizado();

  // 6) Sesión en cookie firmada
  const res = responder({ ok: true }, 200);
  res.cookies.set(
    COOKIE_SESION,
    crearToken(usuario, secreto),
    opcionesCookie(DURACION_SESION_MS / 1000)
  );
  return res;
}

export async function DELETE() {
  const res = responder({ ok: true }, 200);
  res.cookies.set(COOKIE_SESION, "", opcionesCookie(0));
  return res;
}
