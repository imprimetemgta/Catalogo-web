import { NextResponse } from "next/server";
import { getAnonClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DEV ONLY: sin Supabase configurado (no hay SUPABASE_URL), sirve
// productos de prueba desde inventario.json en vez de fallar. Nunca se
// activa en Vercel porque ahí SUPABASE_URL siempre está definida.
async function productosDePrueba() {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const ruta = path.join(process.cwd(), "inventario.json");
  const crudo = JSON.parse(await fs.readFile(ruta, "utf-8"));

  return crudo
    .filter((p) => String(p.PUBLICAWEB).toLowerCase() === "true")
    .map((p) => ({
      codigo: p.CODIGO,
      nombre: p.DESCRIPCION,
      marca: p.MARCA,
      modelo: p.MODELO,
      departamento: p.NOMBRE_DEPARTAMENTO || null,
      precio: Number(p.PRECIO_USD),
      existencia: p.EXISTENCIA_DISPONIBLE,
      imagen: null, // sin Supabase Storage local; el catálogo cae al respaldo
    }))
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
}

export async function GET() {
  if (!process.env.SUPABASE_URL) {
    return NextResponse.json(await productosDePrueba());
  }

  const sb = getAnonClient();

  const { data, error } = await sb
    .from("productos")
    .select(
      "codigo, descripcion, marca, modelo, nombre_departamento, precio_usd, existencia_disponible"
    )
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
    departamento: p.nombre_departamento,
    precio: Number(p.precio_usd),
    existencia: p.existencia_disponible,
    imagen: `${base}/storage/v1/object/public/${BUCKET}/${safe(p.codigo)}.jpg`,
  }));

  return NextResponse.json(productos);
}
