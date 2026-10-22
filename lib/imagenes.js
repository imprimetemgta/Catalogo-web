// Imágenes de productos en Supabase Storage (bucket público "productos").
// Lógica pura: sin imports de la app, para poder testearla con node --test.

export const BUCKET_IMAGENES = "productos";

// Nombre del archivo en el bucket; misma regla que scripts/subir_imagenes.py.
export const nombreImagen = (codigo) =>
  `${String(codigo).replace(/[^A-Za-z0-9._-]/g, "_")}.jpg`;

// true/false según el producto tenga foto en el bucket; null si no se pudo saber
// (nombres = null): así el filtro "Sin imagen" no marca de más ante un error.
export const tieneImagenDe = (nombres, codigo) =>
  nombres ? nombres.has(nombreImagen(codigo)) : null;
