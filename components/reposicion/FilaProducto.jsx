import { StockGauge } from "@/components/RefillLoop";
import { MINIMO_STOCK, estadoDe } from "@/lib/reposicion/clasificar";
import { metricasDe } from "@/lib/reposicion/metricas";

// Etiqueta de estado de cada fila: el color va en el borde, el texto en tinta.
const ETIQUETA = {
  ok: { texto: "OK", clase: "border-brand-cyan text-ink-muted" },
  bajo: { texto: "Bajo", clase: "border-brand-amber text-ink" },
  agotado: { texto: "Agotado", clase: "border-brand-magenta text-brand-magentaDeep" },
  sin_existencias: { texto: "Sin existencias", clase: "border-brand-magenta text-brand-magentaDeep" },
  a_consultar: { texto: "A consultar", clase: "border-ink-faint text-ink-muted" },
};

const formatUsd = (n) => (Number.isFinite(n) ? `$${n.toFixed(2)}` : "—");
const numero = (n) => (n == null ? "—" : n);
const cantidad = (n) => String(Math.round(n * 100) / 100);
// "AAAA-MM-DD" a "DD/MM[/AAAA]" cortando texto (sin Date, para no desfasar husos).
export const ddmm = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

export default function FilaProducto({ p, periodo }) {
  const estado = estadoDe(p);
  const etiqueta = ETIQUETA[estado];
  const sinDato = estado === "a_consultar";
  const m = periodo ? metricasDe(p, periodo) : null;

  return (
    <li className="flex gap-3 px-3 py-2.5">
      <div className="w-[26px] shrink-0 pt-0.5">
        {!sinDato && <StockGauge existencia={p.disponible} umbralBajo={MINIMO_STOCK} size={26} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="tabular min-w-0 truncate font-mono text-[11px] text-ink-faint">
            {p.codigo}
            {p.departamento && <span className="font-sans"> · {p.departamento}</span>}
          </p>
          <span
            className={`shrink-0 rounded-md border px-1.5 py-px text-[11px] font-medium ${etiqueta.clase}`}
          >
            {etiqueta.texto}
          </span>
        </div>
        <p className="mt-0.5 text-sm font-medium leading-snug">{p.nombre}</p>
        <div className="tabular mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-mono text-xs">
          <span className="font-semibold text-ink">{formatUsd(p.precio)}</span>
          {sinDato ? (
            <span className="font-sans font-semibold tracking-wide text-ink-muted">A CONSULTAR</span>
          ) : (
            <>
              <span className="text-ink">
                <span className="text-ink-faint">disp </span>
                {p.disponible}
              </span>
              <span className="text-ink-muted">
                <span className="text-ink-faint">bruta </span>
                {numero(p.bruta)}
              </span>
              <span className="text-ink-muted">
                <span className="text-ink-faint">reserv </span>
                {numero(p.pedido)}
              </span>
            </>
          )}
        </div>
        {m && (
          <div className="tabular mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-mono text-xs text-ink-muted">
            <span>
              <span className="text-ink-faint">vend </span>
              {cantidad(m.vendidos)}
            </span>
            {!sinDato && (
              <span>
                <span className="text-ink-faint">alcanza </span>
                {m.alcanzaDias == null ? "—" : `${m.alcanzaDias} d`}
              </span>
            )}
            <span className="font-sans">
              {m.ultima ? `últ. venta ${ddmm(m.ultima)}` : "sin ventas en 30 días"}
            </span>
            {!sinDato && m.sugerido != null && (
              <span className="font-semibold text-ink">pedir {m.sugerido}</span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
