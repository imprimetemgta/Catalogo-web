import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { dentroDeLimite } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOTE = 500;
// Margen holgado para la sincronización por lotes + reintentos. La protección
// real sigue siendo el secreto (su entropía), no este número.
const RL_LIMITE = 60;
const RL_VENTANA_SEG = 60;

const PRECIO_MAX = 9999999999.99;
const EXIST_MAX = 2000000000;

function aBool(v) {
  return ["true", "1", "si", "sí", "t", "yes"].includes(
    String(v ?? "").trim().toLowerCase()
  );
}
function aInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}
function aNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
function ipDe(request) {
  const xff = request.headers.get("x-forwarded-for") || "";
  return (
    xff.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "desconocida"
  );
}

export async function POST(request) {
  // 0) Rate limit por IP — antes de la auth
  const ip = ipDe(request);
  if (!(await dentroDeLimite(`sync:${ip}`, RL_LIMITE, RL_VENTANA_SEG))) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Intenta más tarde." },
      { status: 429, headers: { "Retry-After": String(RL_VENTANA_SEG) } }
    );
  }

  // 1) Autenticación por secreto compartido
  const token = (request.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    ""
  );
  if (!process.env.SYNC_SECRET || token !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 2) Cuerpo: arreglo de productos
  let registros;
  try {
    registros = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!Array.isArray(registros)) {
    return NextResponse.json(
      { error: "Se esperaba un arreglo de productos" },
      { status: 400 }
    );
  }

  // 3) Coordinación de corrida (para envíos por lotes).
  //    El script manda X-Sync-Run (marca única de toda la corrida) en cada lote
  //    y X-Sync-Final=1 en el último. Así todos los lotes comparten la misma
  //    marca de tiempo y el ocultado de ausentes se hace UNA vez, al final.
  //    Si no viene X-Sync-Run (ej. carga manual de un solo envío), se comporta
  //    como antes: marca = ahora y barre en esta misma llamada.
  const runHeader = request.headers.get("x-sync-run");
  const modoLote = !!(runHeader && !Number.isNaN(Date.parse(runHeader)));
  const marcaTiempo = modoLote
    ? new Date(runHeader).toISOString()
    : new Date().toISOString();
  const finalFlag = (request.headers.get("x-sync-final") || "").toLowerCase();
  const barrer = modoLote ? finalFlag === "1" || finalFlag === "true" : true;

  // Saneamiento + validación por fila
  const porCodigo = new Map();
  const revisar = [];

  for (const r of registros) {
    const codigo = String(r.CODIGO ?? "").trim();
    if (!codigo) {
      revisar.push({ codigo: null, motivo: "sin CODIGO (se descarta)" });
      continue;
    }

    const descripcion = String(r.DESCRIPCION ?? "").trim();
    const precioNum = aNum(r.PRECIO_USD);
    const bruta = clamp(aInt(r.EXISTENCIA_BRUTA), 0, EXIST_MAX);
    const pedido = clamp(aInt(r.EXISTENCIA_PEDIDO), 0, EXIST_MAX);
    const disponible = clamp(aInt(r.EXISTENCIA_DISPONIBLE), 0, EXIST_MAX);

    const problemas = [];
    if (!descripcion) problemas.push("sin descripción");
    if (!Number.isFinite(precioNum) || precioNum <= 0)
      problemas.push("precio inválido");
    else if (precioNum > PRECIO_MAX) problemas.push("precio fuera de rango");

    let publica = aBool(r.PUBLICAWEB);
    if (problemas.length) {
      publica = false;
      revisar.push({ codigo, motivo: problemas.join(", ") });
    }

    const precioLimpio =
      Number.isFinite(precioNum) && precioNum > 0 && precioNum <= PRECIO_MAX
        ? Math.round(precioNum * 100) / 100
        : 0;

    porCodigo.set(codigo, {
      codigo,
      descripcion: descripcion || "(sin descripción)",
      referencia: String(r.REFERENCIA ?? "").trim() || null,
      marca: String(r.MARCA ?? "").trim() || null,
      modelo: String(r.MODELO ?? "").trim() || null,
      nombre_departamento: String(r.NOMBRE_DEPARTAMENTO ?? "").trim() || null,
      publicaweb: publica,
      precio_usd: precioLimpio,
      existencia_bruta: bruta,
      existencia_pedido: pedido,
      existencia_disponible: disponible,
      actualizado_en: marcaTiempo,
    });
  }

  const filas = [...porCodigo.values()];

  if (filas.length === 0) {
    return NextResponse.json(
      { error: "El lote llegó vacío o sin filas válidas; no se aplicó nada." },
      { status: 400 }
    );
  }

  const sb = getServiceClient();

  // 4) Upsert por lotes
  for (let i = 0; i < filas.length; i += LOTE) {
    const chunk = filas.slice(i, i + LOTE);
    const { error } = await sb
      .from("productos")
      .upsert(chunk, { onConflict: "codigo" });
    if (error) {
      return NextResponse.json(
        { error: error.message, en: `lote desde ${i}` },
        { status: 500 }
      );
    }
  }

  // 5) Ocultar productos ausentes — SOLO al final de la corrida.
  let ocultados = [];
  if (barrer) {
    const { data, error: errOcultar } = await sb
      .from("productos")
      .update({ publicaweb: false })
      .lt("actualizado_en", marcaTiempo)
      .eq("publicaweb", true)
      .select("codigo");
    if (errOcultar) {
      return NextResponse.json(
        { error: errOcultar.message, en: "ocultado" },
        { status: 500 }
      );
    }
    ocultados = data ?? [];
  }

  return NextResponse.json({
    ok: true,
    recibidos: registros.length,
    sincronizados: filas.length,
    barrido: barrer,
    ocultados: ocultados.length,
    revisar: revisar.length,
    detalle_revisar: revisar.slice(0, 50),
  });
}
