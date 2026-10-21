"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, PackageX, RotateCw, Search, SlidersHorizontal } from "lucide-react";
import { LoopMark } from "@/components/RefillLoop";
import FilaProducto, { ddmm } from "./FilaProducto";
import PanelFiltros from "./PanelFiltros";
import { INICIAL, ORDENES, filtrarYOrdenar, resumen } from "@/lib/reposicion/clasificar";
import {
  DIAS_DESACTUALIZADO,
  PERIODOS,
  PERIODO_PREDETERMINADO,
  diasDesde,
} from "@/lib/reposicion/metricas";

const NOMBRE_FILTRO = {
  todos: "Todos",
  agotado: "Agotados",
  sin_existencias: "Sin existencias",
  bajo: "Stock bajo",
  nuevos: "Nuevos",
  a_consultar: "A consultar",
  mas_vendidos: "Más vendidos",
  reponer_ya: "Reponer ya",
  sin_movimiento: "Sin movimiento",
};

const FILTROS_VENTAS = ["mas_vendidos", "reponer_ya", "sin_movimiento"];
const NOMBRE_PERIODO = { 7: "Semana", 15: "15 días", 30: "Mes" };

const NOMBRE_ORDEN = {
  nombre: "Nombre",
  precio_asc: "Menor precio",
  precio_desc: "Mayor precio",
  existencia_asc: "Menor existencia",
  vendidos_desc: "Más vendidos",
  alcanza_asc: "Se acaba antes",
};

const ORDENES_VENTAS = ["vendidos_desc", "alcanza_asc"];

// Píldoras de arriba, en este orden: cada una es un filtro y lleva su número.
const PILDORAS = [
  { filtro: "reponer_ya", tono: "magenta" },
  { filtro: "agotado", tono: "magenta" },
  { filtro: "sin_existencias", tono: "magenta" },
  { filtro: "bajo", tono: "ambar" },
  { filtro: "mas_vendidos", tono: "azul" },
  { filtro: "sin_movimiento", tono: "gris" },
  { filtro: "a_consultar", tono: "gris" },
  { filtro: "todos", tono: "gris" },
];

// Fondo tenue con texto oscuro (≥ 4.5:1); el color puro solo en el borde.
const TONOS = {
  magenta: { base: "bg-brand-magenta/10 text-brand-magentaDeep", borde: "border-brand-magenta" },
  ambar: { base: "bg-brand-amber/15 text-brand-amberDeep", borde: "border-brand-amber" },
  azul: { base: "bg-brand-navy/10 text-brand-navy", borde: "border-brand-navy" },
  gris: { base: "bg-paper-dim text-ink-muted", borde: "border-ink-faint" },
};

const hoyLocal = () => {
  const d = new Date();
  const dos = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};

export default function PanelReposicion({ base, usuario }) {
  const router = useRouter();
  const [productos, setProductos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  // Abre en "Reponer ya"; si no llegan ventas, cargar() pasa a los de sin ventas.
  const [filtro, setFiltro] = useState(INICIAL.conVentas.filtro);
  const [departamento, setDepartamento] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState(INICIAL.conVentas.orden);
  const [ventas, setVentas] = useState(null);
  const [ventasError, setVentasError] = useState(false);
  const [periodo, setPeriodo] = useState(PERIODO_PREDETERMINADO);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const botonFiltros = useRef(null);
  const pildoraActiva = useRef(null);
  const primeraCarga = useRef(true);

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
      setVentas(cuerpo.ventas ?? null);
      setVentasError(cuerpo.ventasError === true);
      if (!cuerpo.ventas) {
        if (primeraCarga.current) {
          // Aún están los valores de apertura con ventas: pasar a los de sin ventas completos.
          setFiltro(INICIAL.sinVentas.filtro);
          setOrden(INICIAL.sinVentas.orden);
        } else {
          // Recarga: solo se corrige lo que ya no existe sin ventas.
          setFiltro((f) => (FILTROS_VENTAS.includes(f) ? INICIAL.sinVentas.filtro : f));
          setOrden((o) => (ORDENES_VENTAS.includes(o) ? INICIAL.sinVentas.orden : o));
        }
      }
      primeraCarga.current = false;
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
  const totales = useMemo(() => resumen(lista, Date.now(), periodo), [lista, periodo]);
  const hayVentas = ventas != null;
  const diasAtraso = hayVentas ? diasDesde(ventas.hasta, hoyLocal()) : 0;
  const pildorasVisibles = hayVentas ? PILDORAS : PILDORAS.filter((x) => !FILTROS_VENTAS.includes(x.filtro));
  const ordenesVisibles = hayVentas ? ORDENES : ORDENES.filter((o) => !ORDENES_VENTAS.includes(o));
  const departamentos = useMemo(
    () => [...new Set(lista.map((p) => p.departamento).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [lista]
  );
  const visibles = useMemo(
    () => filtrarYOrdenar(lista, { filtro, departamento, busqueda, orden, periodo }),
    [lista, filtro, departamento, busqueda, orden, periodo]
  );

  // Elegir "Más vendidos" como filtro también ordena por ventas.
  const elegirFiltro = (f) => {
    setFiltro(f);
    if (f === "mas_vendidos") setOrden("vendidos_desc");
  };
  const tocarCifra = (f) => (filtro === f ? setFiltro("todos") : elegirFiltro(f));
  const alternarNuevos = () => setFiltro((actual) => (actual === "nuevos" ? "todos" : "nuevos"));
  const alternarDepto = (d) => setDepartamento((actual) => (actual === d ? null : d));
  const cerrarPanel = useCallback(() => setPanelAbierto(false), []);

  // La píldora activa siempre queda a la vista dentro de la fila con scroll lateral.
  useEffect(() => {
    pildoraActiva.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [filtro, productos]);

  // Punto en "Filtros": algo distinto del arranque quedó escondido en el panel.
  const ordenBase = hayVentas ? INICIAL.conVentas.orden : INICIAL.sinVentas.orden;
  const hayFiltrosActivos = departamento != null || filtro === "nuevos" || orden !== ordenBase;

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
            {/* Píldoras: cada una es un filtro; tocar la activa vuelve a "todos". */}
            <div className="relative -mx-4">
            <div className="flex flex-nowrap gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {pildorasVisibles.map(({ filtro: f, tono }) => {
                const activa = filtro === f;
                return (
                  <button
                    key={f}
                    ref={activa ? pildoraActiva : null}
                    onClick={() => tocarCifra(f)}
                    aria-pressed={activa}
                    className={`flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3 text-xs transition ${TONOS[tono].base} ${
                      activa ? TONOS[tono].borde : "border-transparent"
                    }`}
                  >
                    <span className="font-medium">{NOMBRE_FILTRO[f]}</span>
                    <span className="tabular font-mono font-semibold">
                      {f === "todos" ? totales.total : totales[f]}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Degradado de borde: avisa que hay más píldoras a la derecha. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-paper to-transparent" />
            </div>

            {/* Buscador, periodo (solo con ventas) y panel de filtros. */}
            <div className="mt-3 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar producto"
                  aria-label="Buscar"
                  className="min-h-10 w-full rounded-md border border-paper-line bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-brand-navy"
                />
              </div>
              {hayVentas && (
                <div className="relative shrink-0">
                  <select
                    value={periodo}
                    onChange={(e) => setPeriodo(Number(e.target.value))}
                    aria-label="Periodo de ventas"
                    className="min-h-10 appearance-none rounded-md border border-paper-line bg-white py-2 pl-3 pr-8 text-sm font-medium text-ink outline-none transition focus:border-brand-navy"
                  >
                    {PERIODOS.map((d) => (
                      <option key={d} value={d}>
                        {NOMBRE_PERIODO[d]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
                  />
                </div>
              )}
              <button
                ref={botonFiltros}
                onClick={() => setPanelAbierto(true)}
                aria-label={hayFiltrosActivos ? "Filtros (hay filtros activos)" : "Filtros"}
                aria-haspopup="dialog"
                className="relative flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border border-paper-line bg-white px-3 text-sm font-medium text-ink transition hover:border-ink-faint"
              >
                <SlidersHorizontal size={16} />
                Filtros
                {hayFiltrosActivos && (
                  <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-magenta" />
                )}
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-ink-muted">
              <span>
                <span className="tabular font-mono">{visibles.length}</span> productos
              </span>
              {hayVentas ? (
                <span
                  className={`tabular font-mono ${
                    diasAtraso > DIAS_DESACTUALIZADO ? "font-medium text-brand-magentaDeep" : ""
                  }`}
                >
                  ventas al {ddmm(ventas.hasta)}
                  {diasAtraso > DIAS_DESACTUALIZADO && ` · ${diasAtraso} días sin actualizar`}
                </span>
              ) : (
                <span>
                  {ventasError
                    ? "No se pudieron leer las ventas; intenta más tarde"
                    : "Aún no hay ventas cargadas"}
                </span>
              )}
            </div>

            <PanelFiltros
              abierto={panelAbierto}
              onCerrar={cerrarPanel}
              retorno={botonFiltros}
              orden={orden}
              ordenes={ordenesVisibles}
              nombresOrden={NOMBRE_ORDEN}
              onOrden={setOrden}
              departamento={departamento}
              departamentos={departamentos}
              onDepartamento={setDepartamento}
              filtro={filtro}
              onNuevos={alternarNuevos}
              cuentaNuevos={totales.nuevos}
              porDepartamento={totales.porDepartamento}
              onDepto={alternarDepto}
              cantidad={visibles.length}
            />

            {visibles.length === 0 ? (
              <div className="mt-2 flex flex-col items-center gap-2 rounded-lg border border-dashed border-paper-line bg-white py-12 text-center text-ink-faint">
                <PackageX size={28} />
                <p className="text-sm">No hay productos con este filtro</p>
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-paper-line overflow-hidden rounded-lg border border-paper-line bg-white">
                {visibles.map((p) => (
                  <FilaProducto key={p.codigo} p={p} periodo={hayVentas ? periodo : null} />
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}
