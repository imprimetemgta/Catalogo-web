import { NextResponse } from "next/server";
import { unirVentas } from "@/lib/reposicion/datos";
import {
  obtenerInventarioActualizado,
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
    // La hora de la última sincronización es informativa: si falla, se omite.
    let inventarioEn = null;
    try {
      inventarioEn = await obtenerInventarioActualizado();
    } catch (e) {
      console.error("inventario actualizado reposicion:", e.message);
    }
    return NextResponse.json(
      {
        productos: unirVentas(productos, ventas?.totales ?? null),
        ventas: ventas ? { hasta: ventas.hasta, actualizadoEn: ventas.actualizadoEn } : null,
        ventasError,
        inventarioEn,
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
