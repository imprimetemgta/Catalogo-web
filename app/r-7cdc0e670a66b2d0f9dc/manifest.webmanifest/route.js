import { RUTA_SECRETA } from "@/lib/reposicion/auth";

// Manifest de la app "Reposición": se instala aparte del catálogo y abre directo
// en la ruta secreta. Solo lo enlaza la página de reposición, así que la ruta no
// aparece en el manifest público del catálogo.
export function GET() {
  const manifest = {
    id: RUTA_SECRETA,
    name: "Reposición — Imprimete C.A.",
    short_name: "Reposición",
    start_url: RUTA_SECRETA,
    scope: RUTA_SECRETA,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#213B86",
    lang: "es",
    icons: [
      { src: "/iconos/reposicion-192.png", sizes: "192x192", type: "image/png" },
      { src: "/iconos/reposicion-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/iconos/reposicion-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
