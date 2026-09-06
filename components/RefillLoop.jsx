// El aro de refill: el mismo lenguaje de tres arcos del logo de Imprimete,
// pero puesto a trabajar como parte real de la interfaz — no como insignia.
// LoopMark gira mientras el catálogo carga; StockGauge lee la existencia de
// cada producto como un arco continuo, siempre acompañado del número exacto.

const ARC = [
  { color: "#E2057D", offset: 0 },
  { color: "#F3E823", offset: 120 },
  { color: "#1D9AD6", offset: 240 },
];

export function LoopMark({ size = 22, spinning = false, className = "" }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  const dash = c * 0.22;
  const gap = c - dash;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <g
        className={spinning ? "loop-spin" : ""}
        style={{ transformOrigin: "12px 12px" }}
      >
        {ARC.map((a) => (
          <circle
            key={a.color}
            cx="12"
            cy="12"
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            transform={`rotate(${a.offset} 12 12)`}
          />
        ))}
      </g>
    </svg>
  );
}

// existencia: unidades disponibles. umbralBajo: a partir de cuánto se marca
// "bajo" en vez de "disponible". El arco nunca es el único portador del
// estado: agotado se dobla en trazo tachado, bajo en trazo punteado.
export function StockGauge({ existencia, umbralBajo = 3, size = 30 }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const agotado = existencia <= 0;
  const bajo = !agotado && existencia <= umbralBajo;

  const pct = agotado ? 1 : Math.min(1, existencia / (umbralBajo * 4));
  const dash = c * pct;

  const color = agotado ? "#c7cad3" : bajo ? "#B58900" : "#1D9AD6";
  const trackDasharray = agotado ? `${c * 0.06} ${c * 0.06}` : undefined;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#e4e6eb"
        strokeWidth="3"
        strokeDasharray={trackDasharray}
      />
      {!agotado && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeDashoffset={c * 0.25}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      {agotado && (
        <line
          x1={size * 0.28}
          y1={size * 0.28}
          x2={size * 0.72}
          y2={size * 0.72}
          stroke="#c7cad3"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
