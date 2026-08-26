import { getServiceClient } from "@/lib/supabase";

// Devuelve true si la petición está dentro del límite; false si se pasó.
export async function dentroDeLimite(clave, limite, ventanaSegundos) {
  const sb = getServiceClient();
  const { data, error } = await sb.rpc("rate_limit_check", {
    p_clave: clave,
    p_limite: limite,
    p_ventana_segundos: ventanaSegundos,
  });
  if (error) {
    // Fail-open: si el limitador falla, no bloqueamos el sync legítimo.
    console.error("rate_limit_check error:", error.message);
    return true;
  }
  return data === true;
}
