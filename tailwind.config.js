/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#ffffff",
        "paper-dim": "#f4f5f7",
        "paper-line": "#e4e6eb",
        ink: "#14161f",
        "ink-muted": "#5b5f6c",
        // Más oscuro de lo que "faint" sugiere a propósito: sigue siendo el
        // tono más bajo de la jerarquía, pero cualquier texto o ícono que lo
        // use debe leer ≥4.5:1 sobre blanco (piso de contraste del craft-floor).
        "ink-faint": "#667085",
        brand: {
          navy: "#213B86",
          magenta: "#E2057D",
          // Versión oscurecida de la magenta de marca para texto y insignias
          // pequeñas: la magenta pura (#E2057D) da ~4.2:1 sobre blanco, por
          // debajo del piso de 4.5:1 — se reserva para arcos/bordes gráficos.
          magentaDeep: "#B8055F",
          cyan: "#1D9AD6",
          yellow: "#F3E823",
          // Ámbar oscurecido para cualquier uso del amarillo de marca que
          // cargue significado (arco de "existencia baja", acento activo de
          // chip): el amarillo puro es casi invisible sobre blanco.
          amber: "#B58900",
        },
        whatsapp: "#22C35E",
      },
      fontFamily: {
        sans: ["var(--font-plex-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20, 22, 31, 0.04), 0 8px 20px -12px rgba(20, 22, 31, 0.18)",
        panel: "0 12px 32px -16px rgba(20, 22, 31, 0.28)",
      },
    },
  },
  plugins: [],
};
