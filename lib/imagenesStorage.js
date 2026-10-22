import { getServiceClient } from "@/lib/supabase";
import { BUCKET_IMAGENES } from "@/lib/imagenes";

const TAMANO_PAGINA = 1000;

// Set con los nombres de archivo del bucket de imágenes, o null si falla la
// lectura (el error queda en el log y los productos quedan "sin dato" de imagen).
// Solo en código de servidor: listar el bucket necesita service_role.
export async function nombresDeImagenes() {
  try {
    const bucket = getServiceClient().storage.from(BUCKET_IMAGENES);
    const nombres = new Set();
    for (let offset = 0; ; offset += TAMANO_PAGINA) {
      const { data, error } = await bucket.list("", {
        limit: TAMANO_PAGINA,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      for (const f of data ?? []) nombres.add(f.name);
      if (!data || data.length < TAMANO_PAGINA) return nombres;
    }
  } catch (e) {
    console.error("listar imágenes:", e?.message);
    return null;
  }
}
