import { NextResponse } from "next/server";
import { getAnonClient } from "@/lib/supabase";
import { BUCKET_IMAGENES, nombreImagen, tieneImagenDe } from "@/lib/imagenes";
import { nombresDeImagenes } from "@/lib/imagenesStorage";

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
      creadoEn: null, // inventario.json no trae fecha de alta; "Más nuevos primero" queda por nombre en este modo de prueba
      imagen: null, // sin Supabase Storage local; el catálogo cae al respaldo
      tieneImagen: false,
    }))
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
}

export async function GET() {
  if (!process.env.SUPABASE_URL) {
    return NextResponse.json(await productosDePrueba());
  }

  const sb = getAnonClient();

  const [{ data, error }, nombres] = await Promise.all([
    sb
      .from("productos")
      .select(
        "codigo, descripcion, marca, modelo, nombre_departamento, precio_usd, existencia_disponible, creado_en"
      )
      .eq("publicaweb", true)
      .order("descripcion"),
    nombresDeImagenes(),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // URL pública de la imagen en Supabase Storage, derivada del código.
  // Si el producto no tiene foto, el navegador recibe 404 y el catálogo
  // muestra el respaldo (no se guarda ninguna imagen en la base).
  // tieneImagen sale de listar el bucket (null si no se pudo listar).
  const base = process.env.SUPABASE_URL;

  const productos = (data ?? []).map((p) => ({
    codigo: p.codigo,
    nombre: p.descripcion,
    marca: p.marca,
    modelo: p.modelo,
    departamento: p.nombre_departamento,
    precio: Number(p.precio_usd),
    existencia: p.existencia_disponible,
    creadoEn: p.creado_en,
    imagen: `${base}/storage/v1/object/public/${BUCKET_IMAGENES}/${nombreImagen(p.codigo)}`,
    tieneImagen: tieneImagenDe(nombres, p.codigo),
  }));

  return NextResponse.json(productos);
}
