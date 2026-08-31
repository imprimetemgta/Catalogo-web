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

  // URL pública de la imagen en Supabase Storage, derivada del código.
  // Si el producto no tiene foto, el navegador recibe 404 y el catálogo
  // muestra el respaldo (no se guarda ninguna imagen en la base).
  const base = process.env.SUPABASE_URL;
  const BUCKET = "productos";
  const safe = (c) => String(c).replace(/[^A-Za-z0-9._-]/g, "_");

  const productos = (data ?? []).map((p) => ({
    codigo: p.codigo,
    nombre: p.descripcion,
    marca: p.marca,
    modelo: p.modelo,
    precio: Number(p.precio_usd),
    existencia: p.existencia_disponible,
    imagen: `${base}/storage/v1/object/public/${BUCKET}/${safe(p.codigo)}.jpg`,
  }));

  return NextResponse.json(productos);
}
