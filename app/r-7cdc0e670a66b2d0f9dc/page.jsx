import LoginReposicion from "@/components/reposicion/LoginReposicion";
import PanelReposicion from "@/components/reposicion/PanelReposicion";
import { RUTA_SECRETA } from "@/lib/reposicion/auth";
import { sesionActual } from "@/lib/reposicion/servidor";

// Página interna de reposición: no se enlaza desde ningún lado y no se indexa.
export const metadata = {
  title: "Reposición — Imprimete C.A.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ReposicionPage() {
  const sesion = await sesionActual();
  // La base va como prop: auth.js usa node:crypto y no puede ir al cliente.
  if (!sesion) return <LoginReposicion base={RUTA_SECRETA} />;
  return <PanelReposicion base={RUTA_SECRETA} usuario={sesion.usuario} />;
}
