"use client";

import { useState } from "react";
import { estadoDe, urgenciaDe } from "@/lib/reposicion/clasificar";
import { metricasDe } from "@/lib/reposicion/metricas";

// Barra izquierda de la fila: el color es refuerzo, la palabra o el número van al lado.
const BARRA = {
  critico: "bg-brand-magenta",
  bajo: "bg-brand-amber",
  ok: "bg-brand-cyan",
  consultar: "bg-paper-line",
};
// Color de los números del texto (tonos que pasan 4.5:1 sobre blanco).
const TEXTO = {
  critico: "text-brand-magentaDeep",
  bajo: "text-brand-amberDeep",
  ok: "text-ink",
  consultar: "text-ink-muted",
};

const formatUsd = (n) => (Number.isFinite(n) ? `$${n.toFixed(2)}` : "—");
const numero = (n) => (n == null ? "—" : n);
const cantidad = (n) => String(Math.round(n * 100) / 100);
// "AAAA-MM-DD" a "DD/MM[/AAAA]" cortando texto (sin Date, para no desfasar husos).
export const ddmm = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

export default function FilaProducto({ p, periodo }) {
  const [abierta, setAbierta] = useState(false);
  const [fallaImg, setFallaImg] = useState(false);
  const estado = estadoDe(p);
  const urgencia = urgenciaDe(p, periodo);
  const sinDato = estado === "a_consultar";
  const conVentas = periodo != null;
  const m = conVentas ? metricasDe(p, periodo) : null;
  const color = TEXTO[urgencia];

  // Parte de stock de la línea de abajo: palabra si no hay existencias, si no "disp N".
  let stock;
  if (sinDato) stock = <b className="tracking-wide">A CONSULTAR</b>;
  else if (estado === "agotado") stock = <b>Agotado</b>;
  else if (estado === "sin_existencias") stock = <b>Sin existencias</b>;
  else stock = <>disp <b>{p.disponible}</b></>;

  // Caja "pedir": siempre que la página tenga ventas (número, "?" o "—").
  let pedir = "—";
  let cajaClase = "bg-paper-dim text-ink-muted";
  if (sinDato) pedir = "?";
  else if (m && m.sugerido != null) {
    pedir = m.sugerido;
    cajaClase = "bg-brand-navy text-white";
  }

  const detalle = [
    ["Precio", formatUsd(p.precio)],
    ["Código", p.codigo || "—"],
    ["Departamento", p.departamento || "—"],
    ...(p.referencia ? [["Referencia", p.referencia]] : []),
    ["Bruta", numero(p.bruta)],
    ["Reservado", numero(p.pedido)],
    ...(conVentas
      ? [["Última venta", m?.ultima ? ddmm(m.ultima) : "sin ventas en 30 días"]]
      : []),
  ];

  return (
    <li>
      <button
        type="button"
        aria-expanded={abierta}
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-stretch text-left"
      >
        <span aria-hidden="true" className={`w-[5px] shrink-0 ${BARRA[urgencia]}`} />
        <span className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
          {p.imagen && !fallaImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.imagen}
              alt=""
              loading="lazy"
              onError={() => setFallaImg(true)}
              className="h-10 w-10 shrink-0 rounded-md object-cover"
            />
          ) : (
            <span aria-hidden="true" className="h-10 w-10 shrink-0 rounded-md bg-paper-dim" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{p.nombre}</span>
            <span className={`tabular block truncate text-xs ${color}`}>
              {stock}
              {conVentas && !sinDato && (
                <>
                  {" · alcanza "}
                  <b>{m?.alcanzaDias == null ? "—" : `${m.alcanzaDias} d`}</b>
                </>
              )}
              {conVentas && (
                <>
                  {" · vend "}
                  <b>{cantidad(m ? m.vendidos : 0)}</b>
                </>
              )}
            </span>
          </span>
          {conVentas && (
            <span className={`min-w-[58px] shrink-0 rounded-lg px-2 py-1.5 text-center ${cajaClase}`}>
              <span className="tabular block text-xl font-bold leading-none">{pedir}</span>
              <span className="block text-xs font-semibold">pedir</span>
            </span>
          )}
        </span>
      </button>
      {abierta && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 pb-2.5 pl-[69px] pr-3 text-xs">
          {detalle.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="min-w-0">
              <dt className="text-ink-faint">{etiqueta}</dt>
              <dd className="tabular break-words font-semibold text-ink">{valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}
