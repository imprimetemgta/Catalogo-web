import { NextResponse } from "next/server";
import { getAnonClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = getAnonClient();

  const { data, error } = await sb
    .from("productos")
    .select("codigo, descripcion, marca, modelo, precio_usd, existencia_disponible")
    .eq("publicaweb", true)
    .order("descripcion");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const productos = (data ?? []).map((p) => ({
    codigo: p.codigo,
    nombre: p.descripcion,
    marca: p.marca,
    modelo: p.modelo,
    precio: Number(p.precio_usd),
    existencia: p.existencia_disponible,
  }));

  return NextResponse.json(productos);
}
