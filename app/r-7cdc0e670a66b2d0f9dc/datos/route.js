import { NextResponse } from "next/server";
import { unirVentas } from "@/lib/reposicion/datos";
import {
  obtenerProductosReposicion,
  obtenerVentasReposicion,
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
    // Si las ventas fallan, la página de stock sigue funcionando sin ellas.
    let ventas = null;
    let ventasError = false;
    try {
      ventas = await obtenerVentasReposicion();
    } catch (e) {
      console.error("ventas reposicion:", e.message);
      ventasError = true;
    }
    return NextResponse.json(
      {
        productos: unirVentas(productos, ventas?.totales ?? null),
        ventas: ventas ? { hasta: ventas.hasta } : null,
        ventasError,
      },
      { headers: SIN_CACHE }
    );
  } catch (e) {
    console.error("datos reposicion:", e.message);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500, headers: SIN_CACHE }
    );
  }
}
