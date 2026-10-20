import { NextResponse } from "next/server";
import {
  obtenerProductosReposicion,
  sesionActual,
} from "@/lib/reposicion/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };

export async function GET() {
  if (!(await sesionActual())) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401, headers: SIN_CACHE }
    );
  }
  try {
    const productos = await obtenerProductosReposicion();
    return NextResponse.json({ productos }, { headers: SIN_CACHE });
  } catch (e) {
    console.error("datos reposicion:", e.message);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500, headers: SIN_CACHE }
    );
  }
}
