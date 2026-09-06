import { NextResponse } from "next/server";

export const runtime = "nodejs";

// El BCV no publica una API REST propia — solo su página web (HTML, sin
// contrato estable para scrapear). DolarAPI es un proveedor comunitario muy
// usado en Venezuela que expone esa misma tasa oficial como JSON; su campo
// "fuente" confirma que es la oficial (BCV), no la paralela/binance.
// Si el día de mañana prefieres otro proveedor, este es el único archivo
// que hay que tocar.
const FUENTE = "https://ve.dolarapi.com/v1/dolares/oficial";

export async function GET() {
  try {
    // Next cachea este fetch 1 hora (el BCV actualiza como mucho una vez
    // por día hábil), así no se golpea al proveedor en cada carga del
    // catálogo ni en cada visitante.
    const r = await fetch(FUENTE, { next: { revalidate: 3600 } });
    if (!r.ok) throw new Error(`DolarAPI respondió ${r.status}`);

    const data = await r.json();
    const tasa = Number(data.promedio);
    if (!Number.isFinite(tasa) || tasa <= 0) {
      throw new Error("La tasa recibida no es un número válido");
    }

    return NextResponse.json({
      tasa,
      fecha: data.fechaActualizacion ?? null,
      fuente: "BCV (oficial, vía DolarAPI)",
    });
  } catch (e) {
    // El catálogo funciona igual sin esto — el precio en bolívares
    // simplemente no se muestra si la tasa no está disponible.
    return NextResponse.json(
      { error: "No se pudo obtener la tasa BCV", detalle: e.message },
      { status: 502 }
    );
  }
}
