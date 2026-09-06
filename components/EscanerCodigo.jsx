"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ScanLine, PackageX, Search } from "lucide-react";
import { LoopMark, StockGauge } from "./RefillLoop";
import { useProductosYTasa } from "@/lib/useProductosYTasa";
import { formatBs } from "@/lib/moneda";

// Herramienta de mostrador: apuntar el lector y que aparezca el producto,
// sin tocar el mouse ni el teclado. Un lector de código de barras es, para
// el navegador, un teclado que escribe muy rápido y termina con Enter — por
// eso todo gira en torno a UN input que nunca pierde el foco.
export default function EscanerCodigo() {
  const { productos, cargando, error, tasaBcv } = useProductosYTasa();
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState(null); // { codigoBuscado, producto | null }
  const [historial, setHistorial] = useState([]);
  const [imgFallo, setImgFallo] = useState(false);
  const inputRef = useRef(null);

  // El input SIEMPRE debe estar enfocado — es el único requisito real de
  // esta página. Un clic accidental en cualquier otra parte (o volver de
  // otra pestaña) no debe dejar al lector "hablándole" a nadie.
  useEffect(() => {
    const enfocar = () => inputRef.current?.focus();
    enfocar();

    document.addEventListener("visibilitychange", enfocar);
    // Se reenfoca después de CUALQUIER clic en la página, en el siguiente
    // tick — así un clic en el historial o en "Buscar" primero hace su
    // trabajo (onClick) y luego el foco vuelve solo al input.
    const alClickear = () => setTimeout(enfocar, 0);
    document.addEventListener("click", alClickear);

    return () => {
      document.removeEventListener("visibilitychange", enfocar);
      document.removeEventListener("click", alClickear);
    };
  }, []);

  const buscar = useCallback(
    (crudo) => {
      const limpio = crudo.trim();
      if (!limpio) return;
      const producto =
        productos.find(
          (p) => p.codigo?.trim().toUpperCase() === limpio.toUpperCase()
        ) || null;

      setResultado({ codigoBuscado: limpio, producto });
      setImgFallo(false);
      setHistorial((h) =>
        [{ codigo: limpio, producto, id: Date.now() }, ...h.filter((x) => x.codigo !== limpio)].slice(
          0,
          6
        )
      );
      setCodigo("");
    },
    [productos]
  );

  const alEnviar = (e) => {
    e.preventDefault();
    buscar(codigo);
  };

  return (
    <div className="instrument-grid min-h-screen bg-paper text-ink">
      <header className="instrument-grid sticky top-0 z-20 border-b border-paper-line bg-paper">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-medium text-ink-muted transition hover:text-ink"
          >
            <ArrowLeft size={16} />
            Catálogo
          </Link>
          <div className="ml-auto flex items-center gap-2 text-sm font-medium text-ink-muted">
            <ScanLine size={16} className="text-brand-cyan" />
            Escáner de código
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <form onSubmit={alEnviar}>
          <label
            htmlFor="codigo-escaneado"
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-ink-faint"
          >
            Escanea o escribe el código
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanLine
                size={20}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-cyan"
              />
              <input
                ref={inputRef}
                id="codigo-escaneado"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                onBlur={() => setTimeout(() => inputRef.current?.focus(), 0)}
                autoFocus
                autoComplete="off"
                inputMode="text"
                placeholder="Apunta el lector aquí…"
                className="tabular w-full rounded-lg border-2 border-brand-navy bg-white py-4 pl-12 pr-4 font-mono text-lg text-ink outline-none placeholder:font-sans placeholder:text-base placeholder:text-ink-faint"
              />
            </div>
            <button
              type="submit"
              aria-label="Buscar código"
              className="flex items-center justify-center rounded-lg bg-brand-navy px-4 text-white transition hover:bg-[#152a63]"
            >
              <Search size={20} />
            </button>
          </div>
        </form>

        <div className="mt-8">
          {cargando && (
            <div className="flex flex-col items-center gap-3 py-16">
              <LoopMark size={30} spinning />
              <p className="text-sm text-ink-muted">Cargando catálogo…</p>
            </div>
          )}

          {error && !cargando && (
            <p className="py-16 text-center text-sm text-brand-magentaDeep">
              {error}
            </p>
          )}

          {!cargando && !error && !resultado && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-paper-line py-16 text-center text-ink-faint">
              <ScanLine size={32} />
              <p className="text-sm">Esperando un código…</p>
            </div>
          )}

          {!cargando && !error && resultado && (
            <>
              {resultado.producto ? (
                <ResultadoProducto
                  producto={resultado.producto}
                  tasaBcv={tasaBcv}
                  imgFallo={imgFallo}
                  onImgFallo={() => setImgFallo(true)}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-paper-line bg-white py-16 text-center shadow-card">
                  <PackageX size={32} className="text-ink-faint" />
                  <p className="font-medium text-ink">Código no encontrado</p>
                  <p className="tabular font-mono text-sm text-ink-faint">
                    {resultado.codigoBuscado}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {historial.length > 1 && (
          <div className="mt-8">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
              Escaneado recientemente
            </p>
            <div className="flex flex-col gap-1">
              {historial.slice(1).map((h) => (
                <button
                  key={h.id}
                  onClick={() => buscar(h.codigo)}
                  className="flex items-center justify-between gap-3 rounded-md border border-paper-line bg-white px-3 py-2 text-left text-sm transition hover:border-brand-navy/40"
                >
                  <span className="tabular font-mono text-ink-faint">
                    {h.codigo}
                  </span>
                  <span className="truncate text-ink-muted">
                    {h.producto ? h.producto.nombre : "No encontrado"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ResultadoProducto({ producto: p, tasaBcv, imgFallo, onImgFallo }) {
  const agotado = p.existencia <= 0;
  return (
    <div className="overflow-hidden rounded-xl border border-paper-line bg-white shadow-card">
      <div className="flex flex-col gap-6 p-6 sm:flex-row">
        <div className="instrument-grid relative flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-paper-dim text-center text-xs font-medium uppercase tracking-wide text-ink-faint sm:w-48">
          <span>{p.marca || "Producto"}</span>
          {p.imagen && !imgFallo && (
            <img
              src={p.imagen}
              alt={p.nombre}
              className="absolute inset-0 h-full w-full object-cover"
              onError={onImgFallo}
            />
          )}
        </div>

        <div className="flex flex-1 flex-col">
          <p className="tabular font-mono text-sm text-ink-faint">{p.codigo}</p>
          <h2 className="mt-1 text-2xl font-semibold leading-snug text-ink">
            {p.nombre}
          </h2>
          {(p.marca || p.departamento) && (
            <p className="mt-1 text-sm text-ink-muted">
              {[p.marca, p.departamento].filter(Boolean).join(" · ")}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-1">
            <span className="tabular font-mono text-4xl font-bold text-ink">
              ${p.precio.toFixed(2)}
            </span>
            {tasaBcv && (
              <span className="tabular font-mono text-lg text-ink-faint">
                {formatBs(p.precio * tasaBcv)}
              </span>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <StockGauge existencia={p.existencia} size={28} />
            <span
              className={`tabular text-base font-medium ${
                agotado ? "text-ink-faint" : "text-ink-muted"
              }`}
            >
              {agotado ? "Agotado" : `${p.existencia} disponibles`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
