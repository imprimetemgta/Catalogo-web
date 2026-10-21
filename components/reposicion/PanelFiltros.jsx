"use client";

import { useEffect, useRef } from "react";

const SIN_DEPTO = "Sin departamento"; // nombre que usa resumen() para departamento null

const titulo = "mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted";

// Hoja inferior con orden, departamento, "Nuevos" y el resumen por departamento.
export default function PanelFiltros({
  abierto,
  onCerrar,
  retorno, // ref del botón "Filtros", para devolverle el foco al cerrar
  orden,
  ordenes,
  nombresOrden,
  onOrden,
  departamento,
  departamentos,
  onDepartamento,
  filtro,
  onNuevos,
  cuentaNuevos,
  porDepartamento,
  onDepto,
  cantidad,
}) {
  const panel = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    const boton = retorno?.current;
    panel.current?.focus();
    const alTeclear = (e) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", alTeclear);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflowPrevio;
      boton?.focus();
    };
  }, [abierto, onCerrar, retorno]);

  if (!abierto) return null;

  const control =
    "w-full min-h-10 rounded-md border border-paper-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-navy";

  return (
    <>
      <div className="fixed inset-0 z-30 bg-ink/40" onClick={onCerrar} aria-hidden="true" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Filtros"
        className="fixed inset-x-0 bottom-0 z-40 mx-auto max-h-[85vh] max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl outline-none"
      >
        <section className="mb-4">
          <h2 className={titulo}>Ordenar por</h2>
          <div className="flex flex-wrap gap-2">
            {ordenes.map((o) => (
              <button
                key={o}
                onClick={() => onOrden(o)}
                aria-pressed={orden === o}
                className={`min-h-10 rounded-full border px-3 text-sm font-medium transition ${
                  orden === o
                    ? "border-brand-navy bg-brand-navy text-white"
                    : "border-paper-line bg-white text-ink-muted hover:text-ink"
                }`}
              >
                {nombresOrden[o]}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-4">
          <h2 className={titulo}>Departamento</h2>
          <select
            value={departamento ?? ""}
            onChange={(e) => onDepartamento(e.target.value || null)}
            aria-label="Departamento"
            className={control}
          >
            <option value="">Todos los departamentos</option>
            {departamentos.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </section>

        <section className="mb-4">
          <h2 className={titulo}>Otros</h2>
          <button
            onClick={onNuevos}
            aria-pressed={filtro === "nuevos"}
            className={`min-h-10 rounded-full border px-3 text-sm font-medium transition ${
              filtro === "nuevos"
                ? "border-brand-navy bg-brand-navy text-white"
                : "border-paper-line bg-white text-ink-muted hover:text-ink"
            }`}
          >
            Nuevos (<span className="tabular font-mono">{cuentaNuevos}</span>)
          </button>
        </section>

        {porDepartamento.length > 0 && (
          <section className="mb-4">
            <h2 className={titulo}>Resumen por departamento ({porDepartamento.length})</h2>
            <div className="max-h-64 overflow-y-auto rounded-md border border-paper-line">
              <div className="tabular sticky top-0 grid grid-cols-[1fr_repeat(4,2.75rem)] gap-1 bg-paper-dim px-3 py-1 font-mono text-xs text-ink-muted">
                <span className="font-sans">Departamento</span>
                <span className="text-right">Agot.</span>
                <span className="text-right">Sin ex.</span>
                <span className="text-right">Bajo</span>
                <span className="text-right">Cons.</span>
              </div>
              {porDepartamento.map((d) => {
                // Los productos sin departamento no se pueden filtrar por nombre.
                const filtrable = d.departamento !== SIN_DEPTO;
                const activo = departamento === d.departamento;
                return (
                  <button
                    key={d.departamento}
                    onClick={() => filtrable && onDepto(d.departamento)}
                    disabled={!filtrable}
                    aria-pressed={activo}
                    className={`tabular grid w-full grid-cols-[1fr_repeat(4,2.75rem)] items-center gap-1 border-l-[3px] px-3 py-1.5 text-left font-mono text-xs transition ${
                      activo ? "border-l-brand-navy bg-paper-dim" : "border-l-transparent hover:bg-paper-dim"
                    }`}
                  >
                    <span className="truncate font-sans text-sm text-ink">{d.departamento}</span>
                    <span className="text-right">{d.agotado || "·"}</span>
                    <span className="text-right">{d.sin_existencias || "·"}</span>
                    <span className="text-right">{d.bajo || "·"}</span>
                    <span className="text-right">{d.a_consultar || "·"}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <button
          onClick={onCerrar}
          className="min-h-11 w-full rounded-md bg-brand-navy px-4 text-sm font-semibold text-white transition hover:bg-[#152a63]"
        >
          Ver {cantidad} productos
        </button>
      </div>
    </>
  );
}
