import { getServiceClient } from "@/lib/supabase";

// Devuelve true si la petición está dentro del límite; false si se pasó.
// failOpen (por defecto true) decide qué devolver si el limitador falla.
export async function dentroDeLimite(
  clave,
  limite,
  ventanaSegundos,
  { failOpen = true } = {}
) {
  try {
    const sb = getServiceClient();
    const { data, error } = await sb.rpc("rate_limit_check", {
      p_clave: clave,
      p_limite: limite,
      p_ventana_segundos: ventanaSegundos,
    });
    if (error) {
      // Fail-open por defecto: si el limitador falla, no bloqueamos el sync
      // legítimo. El login pide failOpen: false (fail-closed).
      console.error("rate_limit_check error:", error.message);
      return failOpen;
    }
    return data === true;
  } catch (e) {
    console.error("rate_limit_check error:", e?.message);
    return failOpen;
  }
}
