import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { dentroDeLimite } from "@/lib/rateLimit";
import { validarCargaVentas } from "@/lib/reposicion/ventas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mismos márgenes que /api/sync.
const RL_LIMITE = 60;
const RL_VENTANA_SEG = 60;

function ipDe(request) {
  const xff = request.headers.get("x-forwarded-for") || "";
  return (
    xff.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "desconocida"
  );
}

export async function POST(request) {
  // 1) Rate limit por IP — antes de la auth
  const ip = ipDe(request);
  if (!(await dentroDeLimite(`sync-ventas:${ip}`, RL_LIMITE, RL_VENTANA_SEG))) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Intenta más tarde." },
      { status: 429, headers: { "Retry-After": String(RL_VENTANA_SEG) } }
    );
  }

  // 2) Autenticación por secreto compartido
  const token = (request.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    ""
  );
  if (!process.env.SYNC_SECRET || token !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 3) Cuerpo JSON
  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // 4) Validación. «hoy» es la fecha UTC del servidor; el margen de +1 día de
  //    la validación cubre la diferencia horaria con Venezuela.
  const hoy = new Date().toISOString().slice(0, 10);
  const v = validarCargaVentas(cuerpo, hoy);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  // 5) Reemplazo atómico del historial
  const sb = getServiceClient();
  const { data, error } = await sb.rpc("reemplazar_ventas", {
    p_hasta: v.hasta,
    p_filas: v.filas,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    hasta: v.hasta,
    guardadas: data ?? v.filas.length,
    descartadas: v.descartadas.length,
    detalle_descartadas: v.descartadas.slice(0, 50),
  });
}
