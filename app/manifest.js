// Manifest del catálogo: permite instalarlo como app en teléfonos y PC.
// Next lo sirve en /manifest.webmanifest y lo enlaza en todas las páginas;
// /reposicion lo reemplaza por el suyo (ver su page.jsx).
export default function manifest() {
  return {
    id: "/",
    name: "Imprimete C.A. — Catálogo",
    short_name: "Imprimete",
    description:
      "Tóner, tinta e insumos de impresión. Arma tu pedido y ciérralo por WhatsApp.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "es",
    icons: [
      { src: "/iconos/catalogo-192.png", sizes: "192x192", type: "image/png" },
      { src: "/iconos/catalogo-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/iconos/catalogo-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
