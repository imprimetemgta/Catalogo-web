import "./globals.css";

export const metadata = {
  title: "Catálogo",
  description: "Catálogo de productos con pedido por WhatsApp",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
