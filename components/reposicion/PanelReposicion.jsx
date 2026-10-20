"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, PackageX, RotateCw, Search } from "lucide-react";
import { LoopMark, StockGauge } from "@/components/RefillLoop";
import {
  FILTROS,
  MINIMO_STOCK,
  ORDENES,
  estadoDe,
  filtrarYOrdenar,
  resumen,
} from "@/lib/reposicion/clasificar";

const NOMBRE_FILTRO = {
  todos: "Todos",
  agotado: "Agotados",
  sin_existencias: "Sin existencias",
  bajo: "Stock bajo",
  nuevos: "Nuevos",
  a_consultar: "A consultar",
};

const NOMBRE_ORDEN = {
  nombre: "Nombre",
  precio_asc: "Menor precio",
  precio_desc: "Mayor precio",
  existencia_asc: "Menor existencia",
};

// Cifras de arriba: cada una es también el atajo a su filtro.
const CIFRAS = [
  { filtro: "agotado", detalle: "todo reservado", acento: "border-l-brand-magenta" },
  { filtro: "sin_existencias", detalle: "0 en almacén", acento: "border-l-brand-magenta" },
  { filtro: "bajo", detalle: `≤ ${MINIMO_STOCK} disp.`, acento: "border-l-brand-amber" },
  { filtro: "a_consultar", detalle: "sin dato de A2", acento: "border-l-ink-faint" },
  { filtro: "nuevos", detalle: "últimos 30 días", acento: "border-l-brand-cyan" },
];

// Etiqueta de estado de cada fila: el color va en el borde, el texto en tinta.
const ETIQUETA = {
  ok: { texto: "OK", clase: "border-brand-cyan text-ink-muted" },
  bajo: { texto: "Bajo", clase: "border-brand-amber text-ink" },
  agotado: { texto: "Agotado", clase: "border-brand-magenta text-brand-magentaDeep" },
  sin_existencias: { texto: "Sin existencias", clase: "border-brand-magenta text-brand-magentaDeep" },
  a_consultar: { texto: "A consultar", clase: "border-ink-faint text-ink-muted" },
};

const SIN_DEPTO = "Sin departamento"; // nombre que usa resumen() para departamento null

const formatUsd = (n) => (Number.isFinite(n) ? `$${n.toFixed(2)}` : "—");
const numero = (n) => (n == null ? "—" : n);

export default function PanelReposicion({ base, usuario }) {
  const router = useRouter();
  const [productos, setProductos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [departamento, setDepartamento] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState("nombre");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`${base}/datos`, { cache: "no-store" });
      // Sesión vencida: el servidor vuelve a pintar el login.
      if (res.status === 401) return router.refresh();
      if (!res.ok) throw new Error();
      const cuerpo = await res.json();
      setProductos(cuerpo.productos ?? []);
    } catch {
      setError("No se pudieron cargar los productos.");
    } finally {
      setCargando(false);
    }
  }, [base, router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const salir = async () => {
    try {
      await fetch(`${base}/sesion`, { method: "DELETE" });
    } catch {
      // Sin conexión: igual se refresca; si la cookie sigue, se ve el panel.
    } finally {
      router.refresh();
    }
  };

  const lista = productos ?? [];
  const totales = useMemo(() => resumen(lista), [lista]);
  const departamentos = useMemo(
    () => [...new Set(lista.map((p) => p.departamento).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [lista]
  );
  const visibles = useMemo(
    () => filtrarYOrdenar(lista, { filtro, departamento, busqueda, orden }),
    [lista, filtro, departamento, busqueda, orden]
  );

  const alternarFiltro = (f) => setFiltro((actual) => (actual === f ? "todos" : f));
  const alternarDepto = (d) => setDepartamento((actual) => (actual === d ? null : d));

  const control =
    "w-full rounded-md border border-paper-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-navy";

  return (
    <div className="instrument-grid min-h-screen bg-paper text-ink">
      <header className="instrument-grid sticky top-0 z-20 border-b border-paper-line bg-paper">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <img
            src="/logo-imprimete-lockup.png"
            alt="Imprimete C.A."
            className="h-7 w-auto shrink-0 object-contain"
          />
          <span className="text-sm font-semibold">Reposición</span>
          <span className="ml-auto hidden truncate text-xs text-ink-faint sm:inline">{usuario}</span>
          <button
            onClick={salir}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-paper-line bg-white px-2.5 py-1.5 text-sm font-medium text-ink-muted transition hover:text-ink sm:ml-0"
          >
            <LogOut size={15} />
            Salir
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        {cargando && !productos && (
          <div className="flex flex-col items-center gap-3 py-16">
            <LoopMark size={30} spinning />
            <p className="text-sm text-ink-muted">Cargando productos…</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-brand-magentaDeep">{error}</p>
            <button
              onClick={cargar}
              className="flex items-center gap-1.5 rounded-md bg-brand-navy px-3 py-2 text-sm font-medium text-white transition hover:bg-[#152a63]"
            >
              <RotateCw size={15} />
              Reintentar
            </button>
          </div>
        )}

        {productos && !error && (
          <>
            {/* Cifras tocables: aplican su filtro; tocar otra vez vuelve a "todos". */}
            <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3 sm:grid-cols-5">
              {CIFRAS.map((c) => {
                const activa = filtro === c.filtro;
                return (
                  <button
                    key={c.filtro}
                    onClick={() => alternarFiltro(c.filtro)}
                    aria-pressed={activa}
                    className={`rounded-md border border-l-[3px] px-3 py-2 text-left transition ${c.acento} ${
                      activa ? "border-brand-navy bg-paper-dim" : "border-paper-line bg-white hover:border-ink-faint"
                    }`}
                  >
                    <span className="tabular block font-mono text-xl font-semibold leading-tight">
                      {totales[c.filtro]}
                    </span>
                    <span className="block text-xs font-medium text-ink">{NOMBRE_FILTRO[c.filtro]}</span>
                    <span className="block text-[11px] text-ink-faint">{c.detalle}</span>
                  </button>
                );
              })}
            </div>

            {/* Desglose por departamento (solo los que tienen algo que revisar). */}
            {totales.porDepartamento.length > 0 && (
              <details open className="mt-3 rounded-md border border-paper-line bg-white">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
                  Por departamento ({totales.porDepartamento.length})
                </summary>
                <div className="max-h-64 overflow-y-auto border-t border-paper-line">
                  <div className="tabular sticky top-0 grid grid-cols-[1fr_repeat(4,2.75rem)] gap-1 bg-paper-dim px-3 py-1 font-mono text-[11px] text-ink-faint">
                    <span className="font-sans">Departamento</span>
                    <span className="text-right">Agot.</span>
                    <span className="text-right">Sin ex.</span>
                    <span className="text-right">Bajo</span>
                    <span className="text-right">Cons.</span>
                  </div>
                  {totales.porDepartamento.map((d) => {
                    // Los productos sin departamento no se pueden filtrar por nombre.
                    const filtrable = d.departamento !== SIN_DEPTO;
                    const activo = departamento === d.departamento;
                    return (
                      <button
                        key={d.departamento}
                        onClick={() => filtrable && alternarDepto(d.departamento)}
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
              </details>
            )}

            {/* Filtros, búsqueda, departamento y orden. */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {FILTROS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  aria-pressed={filtro === f}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                    filtro === f
                      ? "border-brand-navy bg-brand-navy text-white"
                      : "border-paper-line bg-white text-ink-muted hover:text-ink"
                  }`}
                >
                  {NOMBRE_FILTRO[f]}
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="relative col-span-2">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar nombre, código o referencia"
                  aria-label="Buscar"
                  className={`${control} pl-9`}
                />
              </div>
              <select
                value={departamento ?? ""}
                onChange={(e) => setDepartamento(e.target.value || null)}
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
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
                aria-label="Ordenar por"
                className={control}
              >
                {ORDENES.map((o) => (
                  <option key={o} value={o}>
                    {NOMBRE_ORDEN[o]}
                  </option>
                ))}
              </select>
            </div>

            <p className="mt-3 text-xs text-ink-faint">
              <span className="tabular font-mono">{visibles.length}</span> de{" "}
              <span className="tabular font-mono">{lista.length}</span> productos
            </p>

            {visibles.length === 0 ? (
              <div className="mt-2 flex flex-col items-center gap-2 rounded-lg border border-dashed border-paper-line bg-white py-12 text-center text-ink-faint">
                <PackageX size={28} />
                <p className="text-sm">No hay productos con este filtro</p>
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-paper-line overflow-hidden rounded-lg border border-paper-line bg-white">
                {visibles.map((p) => (
                  <FilaProducto key={p.codigo} p={p} />
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function FilaProducto({ p }) {
  const estado = estadoDe(p);
  const etiqueta = ETIQUETA[estado];
  const sinDato = estado === "a_consultar";

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
      </div>
    </li>
  );
}
