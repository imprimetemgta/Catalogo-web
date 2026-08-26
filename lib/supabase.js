import { createClient } from "@supabase/supabase-js";

// Cliente ANON: solo lectura pública. RLS garantiza que solo devuelve
// productos con publicaweb = true.
export function getAnonClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
}

// Cliente SERVICE_ROLE: escritura. Ignora RLS. Solo en código de servidor.
export function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}
