import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata = {
  title: "Imprimete C.A. — Catálogo",
  description:
    "Tóner, tinta e insumos de impresión. Economía y calidad en impresión — arma tu pedido y ciérralo por WhatsApp.",
  icons: {
    // Solo el ícono del aro (sin el nombre), recortado a su bounding box
    // real y con el blanco vuelto transparente — el logo completo
    // (logo-imprimete.png) lleva texto que no se lee a tamaño de favicon.
    icon: "/favicon-imprimete.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
