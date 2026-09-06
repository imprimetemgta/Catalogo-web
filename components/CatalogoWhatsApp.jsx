"use client";

import { useState, useMemo } from "react";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  Search,
  SlidersHorizontal,
  PackageX,
  MessageCircle,
} from "lucide-react";
import { LoopMark, StockGauge } from "./RefillLoop";
import { useProductosYTasa } from "@/lib/useProductosYTasa";
import { formatBs, formatFechaTasa } from "@/lib/moneda";

// Número del asesor (configurable por variable de entorno en Vercel).
const WHATSAPP_NUMERO =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMERO || "584248922071";

// Acento que rota por los tres colores del aro de Imprimete — nunca relleno,
// solo un borde de 3px (abajo en chip, a la izquierda en fila de filtro).
const ACCENTOS = ["#E2057D", "#B58900", "#1D9AD6"];

export default function CatalogoWhatsApp() {
  const { productos, cargando, error, tasaBcv, tasaFecha, cargarTasa } =
    useProductosYTasa();

  const [carrito, setCarrito] = useState({}); // { codigo: cantidad }
  const [imgFallo, setImgFallo] = useState({}); // imágenes que no cargaron
  const [departamento, setDepartamento] = useState("Todos");
  const [marca, setMarca] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const departamentos = useMemo(
    () => [
      "Todos",
      ...Array.from(
        new Set(productos.map((p) => p.departamento).filter(Boolean))
      ).sort(),
    ],
    [productos]
  );

  const marcas = useMemo(
    () => [
      "Todas",
      ...Array.from(new Set(productos.map((p) => p.marca).filter(Boolean))).sort(),
    ],
    [productos]
  );

  const productosFiltrados = productos.filter((p) => {
    const coincideDepto = departamento === "Todos" || p.departamento === departamento;
    const coincideMarca = marca === "Todas" || p.marca === marca;
    const objetivo = `${p.nombre || ""} ${p.codigo || ""}`.toLowerCase();
    const coincideBusq = objetivo.includes(busqueda.toLowerCase());
    return coincideDepto && coincideMarca && coincideBusq;
  });

  const filtrosActivos =
    (departamento !== "Todos" ? 1 : 0) + (marca !== "Todas" ? 1 : 0);

  const limpiarFiltros = () => {
    setDepartamento("Todos");
    setMarca("Todas");
  };

  const prod = (codigo) => productos.find((p) => p.codigo === codigo);

  const agregar = (codigo, existencia) =>
    setCarrito((c) => {
      const actual = c[codigo] || 0;
      if (actual >= existencia) return c;
      return { ...c, [codigo]: actual + 1 };
    });

  const cambiar = (codigo, delta, existencia) =>
    setCarrito((c) => {
      const nueva = Math.max(0, Math.min(existencia, (c[codigo] || 0) + delta));
      const copia = { ...c };
      if (nueva === 0) delete copia[codigo];
      else copia[codigo] = nueva;
      return copia;
    });

  const quitar = (codigo) =>
    setCarrito((c) => {
      const copia = { ...c };
      delete copia[codigo];
      return copia;
    });

  const itemsCarrito = useMemo(
    () =>
      Object.entries(carrito)
        .map(([codigo, cantidad]) => {
          const p = prod(codigo);
          return p ? { ...p, cantidad } : null;
        })
        .filter(Boolean),
    [carrito, productos]
  );

  const total = itemsCarrito.reduce((s, it) => s + it.precio * it.cantidad, 0);
  const totalUnidades = itemsCarrito.reduce((s, it) => s + it.cantidad, 0);

  const enviarWhatsApp = async () => {
    if (itemsCarrito.length === 0 || enviando) return;
    setEnviando(true);

    // Último intento de traer la tasa más fresca justo antes de enviar: si
    // el cliente dejó la pestaña abierta días, no se manda con una tasa
    // vieja. Corto (2.5s) y a prueba de fallos — si no responde a tiempo o
    // no hay conexión, se sigue con la última tasa conocida en pantalla.
    let tasaFinal = tasaBcv;
    const tiempoFuera = new Promise((resolve) => setTimeout(() => resolve(null), 2500));
    const fresca = await Promise.race([cargarTasa(), tiempoFuera]);
    if (fresca?.tasa) tasaFinal = fresca.tasa;

    const lineas = itemsCarrito.map(
      (it) =>
        `• ${it.cantidad}x ${it.nombre} (${it.codigo}) — $${(
          it.precio * it.cantidad
        ).toFixed(2)}`
    );
    const totalLinea = tasaFinal
      ? `*Total: $${total.toFixed(2)} (${formatBs(total * tasaFinal)})*`
      : `*Total: $${total.toFixed(2)}*`;
    const mensaje =
      `¡Hola! Quiero hacer este pedido:\n\n${lineas.join("\n")}\n\n` +
      `${totalLinea}\n\nQuedo atento(a). ¡Gracias!`;
    const url = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
      mensaje
    )}`;
    setEnviando(false);
    window.open(url, "_blank");
  };

  return (
    // instrument-grid extendido a todo el sitio (antes solo vivía detrás
    // del buscador), confirmado por el usuario. El <header> lleva su propia
    // instrument-grid (no el div interno de la barra) a propósito: al
    // empezar exactamente en el mismo y=0 que este wrapper, su patrón queda
    // en fase con el del resto de la página — sin eso, cada uno tiene su
    // propio origen y se nota una costura/línea doble justo donde termina
    // el encabezado.
    <div className="instrument-grid min-h-screen bg-paper text-ink">
      {/* Encabezado */}
      <header className="instrument-grid sticky top-0 z-20 border-b border-paper-line bg-paper">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <div className="h-9 shrink-0">
            <img
              src="/logo-imprimete-lockup.png"
              alt="Imprimete C.A. — ¡Economía y calidad en impresión!"
              className="h-full w-auto object-contain"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Filtros — oculto en xl+ porque ahí ya hay panel lateral fijo */}
            <button
              onClick={() => setFiltrosAbiertos(true)}
              aria-label={
                filtrosActivos > 0
                  ? `Abrir filtros, ${filtrosActivos} activos`
                  : "Abrir filtros"
              }
              className="relative flex items-center rounded-md border border-paper-line bg-white px-3 py-2 text-sm font-medium text-ink transition hover:border-brand-navy/40 xl:hidden"
            >
              <SlidersHorizontal size={16} />
              {filtrosActivos > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-magentaDeep px-1 text-xs font-bold text-white">
                  {filtrosActivos}
                </span>
              )}
            </button>

            <button
              onClick={() => setCarritoAbierto(true)}
              aria-label={
                totalUnidades > 0
                  ? `Abrir carrito, ${totalUnidades} unidades`
                  : "Abrir carrito"
              }
              className="relative flex items-center gap-2 rounded-md border border-paper-line bg-white px-3 py-2 text-sm font-medium text-ink transition hover:border-brand-navy/40"
            >
              <ShoppingCart size={16} />
              {totalUnidades > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-magentaDeep px-1 text-xs font-bold text-white">
                  {totalUnidades}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Buscador — la acción principal: casi todos ya saben el código
            o el nombre que buscan. La retícula ya no vive en este div: vive
            en el <header> completo (ver más abajo), para que su origen
            coincida con el de la retícula del resto de la página y no se
            note la costura donde termina la barra. */}
        <div className="border-t border-paper-line">
          <div className="mx-auto max-w-6xl px-4 py-3">
            <div className="relative">
              <Search
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o código…"
                className="w-full rounded-lg border border-paper-line bg-white py-3 pl-11 pr-4 font-medium text-ink outline-none placeholder:text-ink-faint focus:border-brand-navy"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        {/* Filtros — panel lateral fijo en xl+; en pantallas más chicas vive
            en el cajón que abre el botón "Filtros" del encabezado. */}
        <aside className="hidden w-52 shrink-0 xl:block">
          <div className="sticky top-36 overflow-hidden rounded-xl border border-paper-line bg-white p-4 shadow-card">
            <FiltrosPanel
              departamentos={departamentos}
              departamento={departamento}
              setDepartamento={setDepartamento}
              marcas={marcas}
              marca={marca}
              setMarca={setMarca}
              filtrosActivos={filtrosActivos}
              limpiarFiltros={limpiarFiltros}
            />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {/* Estados */}
          {cargando && (
            <div className="flex flex-col items-center gap-3 py-20">
              <LoopMark size={30} spinning />
              <p className="text-sm text-ink-muted">Cargando catálogo…</p>
            </div>
          )}
          {error && !cargando && (
            <p className="py-16 text-center text-sm text-brand-magentaDeep">{error}</p>
          )}

          {/* Grid de productos — tarjetas grandes: 2 columnas en el celular,
              3 en escritorio (`md+`), apoyadas por el espacio que liberó
              quitar el panel fijo del carrito. La fila de precio/existencia
              usa flex-wrap: en la tarjeta más angosta (2 columnas en un
              celular chico) el estado pasa a su propia línea en vez de
              recortarse. */}
          {!cargando && !error && (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
              {productosFiltrados.map((p) => {
                const enCarrito = carrito[p.codigo] || 0;
                const agotado = p.existencia <= 0;
                return (
                  <div
                    key={p.codigo}
                    className="flex flex-col overflow-hidden rounded-xl border border-paper-line bg-white shadow-card"
                  >
                    {/* Imagen desde Supabase Storage, con respaldo al placeholder */}
                    <div className="instrument-grid relative flex aspect-[4/3] items-center justify-center bg-paper-dim px-2 text-center text-sm font-medium uppercase tracking-wide text-ink-faint">
                      <span>{p.marca || "Producto"}</span>
                      {p.imagen && !imgFallo[p.codigo] && (
                        <img
                          src={p.imagen}
                          alt={p.nombre}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={() =>
                            setImgFallo((s) => ({ ...s, [p.codigo]: true }))
                          }
                        />
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-4 sm:p-5">
                      <p className="tabular font-mono text-xs text-ink-faint">
                        {p.codigo}
                      </p>
                      <h3 className="mt-1 text-base font-medium leading-snug text-ink sm:text-lg">
                        {p.nombre}
                      </h3>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <span className="tabular font-mono text-xl font-semibold text-ink sm:text-2xl">
                          ${p.precio.toFixed(2)}
                        </span>
                        <div className="flex items-center gap-2">
                          <StockGauge existencia={p.existencia} size={30} />
                          <span
                            className={`tabular text-sm font-medium ${
                              agotado ? "text-ink-faint" : "text-ink-muted"
                            }`}
                          >
                            {agotado ? "Agotado" : `${p.existencia} disp.`}
                          </span>
                        </div>
                      </div>

                      {tasaBcv && (
                        <p className="tabular font-mono mt-0.5 text-xs text-ink-faint">
                          {formatBs(p.precio * tasaBcv)}
                        </p>
                      )}

                      <div className="mt-auto pt-4">
                        {enCarrito === 0 ? (
                          <button
                            disabled={agotado}
                            onClick={() => agregar(p.codigo, p.existencia)}
                            className="w-full rounded-lg bg-brand-navy py-3 text-base font-medium text-white transition hover:bg-[#152a63] disabled:cursor-not-allowed disabled:bg-paper-dim disabled:text-ink-faint"
                          >
                            Agregar
                          </button>
                        ) : (
                          <div className="flex items-center justify-between rounded-lg bg-paper-dim p-1.5">
                            <button
                              onClick={() =>
                                cambiar(p.codigo, -1, p.existencia)
                              }
                              aria-label="Quitar una unidad"
                              className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-ink shadow-sm"
                            >
                              <Minus size={17} />
                            </button>
                            <span className="tabular text-base font-semibold">
                              {enCarrito}
                            </span>
                            <button
                              onClick={() => cambiar(p.codigo, 1, p.existencia)}
                              disabled={enCarrito >= p.existencia}
                              aria-label="Agregar una unidad"
                              className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-ink shadow-sm disabled:opacity-40"
                            >
                              <Plus size={17} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!cargando && !error && productosFiltrados.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <PackageX size={28} className="text-ink-faint" />
              <p className="text-sm text-ink-muted">
                No hay productos que coincidan con tu búsqueda.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Carrito — siempre un botón + cajón, en cualquier ancho, trazando el
          arco del aro. Antes era un panel fijo en escritorio; ahora se
          comporta igual que en mobile en todas partes. */}
      {carritoAbierto && (
        <div className="fixed inset-0 z-30">
          <div
            className="scrim-in absolute inset-0 bg-ink/40"
            onClick={() => setCarritoAbierto(false)}
          />
          <div className="drawer-arc-in absolute right-0 top-0 flex h-full w-[85%] max-w-sm flex-col bg-paper shadow-panel">
            <div className="flex items-center justify-between bg-brand-navy px-4 py-3">
              <span className="flex items-center gap-2 font-semibold text-white">
                <ShoppingCart size={17} />
                Tu pedido
              </span>
              <button
                onClick={() => setCarritoAbierto(false)}
                aria-label="Cerrar carrito"
              >
                <X size={20} className="text-white/80 hover:text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <CarritoPanel
                items={itemsCarrito}
                total={total}
                tasaBcv={tasaBcv}
                tasaFecha={tasaFecha}
                cambiar={cambiar}
                quitar={quitar}
                enviarWhatsApp={enviarWhatsApp}
                enviando={enviando}
                sinMarco
              />
            </div>
          </div>
        </div>
      )}

      {/* Filtros — cajón que entra por la izquierda, espejo del carrito.
          Header plano (no reversa navy): esa inversión queda reservada
          para el momento del pedido. */}
      {filtrosAbiertos && (
        <div className="fixed inset-0 z-30 xl:hidden">
          <div
            className="scrim-in absolute inset-0 bg-ink/40"
            onClick={() => setFiltrosAbiertos(false)}
          />
          <div className="drawer-arc-in-left absolute left-0 top-0 flex h-full w-[85%] max-w-sm flex-col bg-paper shadow-panel">
            <div className="flex items-center justify-between border-b border-paper-line px-4 py-3">
              <span className="flex items-center gap-2 font-semibold text-ink">
                <SlidersHorizontal size={17} />
                Filtros
              </span>
              <button
                onClick={() => setFiltrosAbiertos(false)}
                aria-label="Cerrar filtros"
              >
                <X size={20} className="text-ink-faint hover:text-ink" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <FiltrosPanel
                departamentos={departamentos}
                departamento={departamento}
                setDepartamento={setDepartamento}
                marcas={marcas}
                marca={marca}
                setMarca={setMarca}
                filtrosActivos={filtrosActivos}
                limpiarFiltros={limpiarFiltros}
              />
            </div>
            <div className="border-t border-paper-line p-4">
              <button
                onClick={() => setFiltrosAbiertos(false)}
                className="w-full rounded-lg bg-brand-navy py-3 text-sm font-semibold text-white transition hover:bg-[#152a63]"
              >
                Ver {productosFiltrados.length}{" "}
                {productosFiltrados.length === 1 ? "producto" : "productos"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FiltrosPanel({
  departamentos,
  departamento,
  setDepartamento,
  marcas,
  marca,
  setMarca,
  filtrosActivos,
  limpiarFiltros,
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
          Filtrar catálogo
        </h2>
        {filtrosActivos > 0 && (
          <button
            onClick={limpiarFiltros}
            className="text-xs font-medium text-brand-magentaDeep hover:underline"
          >
            Limpiar
          </button>
        )}
      </div>
      <FiltroSeccion
        titulo="Departamento"
        etiquetaTodos="Todos los departamentos"
        opciones={departamentos}
        valorTodos="Todos"
        valor={departamento}
        onCambiar={setDepartamento}
      />
      <FiltroSeccion
        titulo="Marca"
        etiquetaTodos="Todas las marcas"
        opciones={marcas}
        valorTodos="Todas"
        valor={marca}
        onCambiar={setMarca}
      />
    </div>
  );
}

// Una sección de filtro de una sola selección — reemplaza la fila de chips
// horizontal por una lista vertical, más práctica para 20-50 opciones: cada
// fila lleva el mismo acento rotando de los 3 colores del aro, pero como
// borde izquierdo en vez de inferior (traduce la línea, nunca un relleno).
function FiltroSeccion({
  titulo,
  etiquetaTodos,
  opciones,
  valorTodos,
  valor,
  onCambiar,
}) {
  if (opciones.length <= 1) return null;
  return (
    <div>
      <p className="mb-1.5 px-2 text-xs font-medium text-ink-muted">{titulo}</p>
      <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
        {opciones.map((o, i) => {
          const activo = valor === o;
          const accento = ACCENTOS[i % ACCENTOS.length];
          return (
            <button
              key={o}
              onClick={() => onCambiar(o)}
              style={activo ? { borderLeftColor: accento } : undefined}
              className={`rounded-md border-l-[3px] border-l-transparent px-2 py-1.5 text-left text-sm font-medium transition ${
                activo
                  ? "bg-paper-dim text-ink"
                  : "text-ink-muted hover:bg-paper-dim/60 hover:text-ink"
              }`}
            >
              {o === valorTodos ? etiquetaTodos : o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CarritoPanel({
  items,
  total,
  tasaBcv,
  tasaFecha,
  cambiar,
  quitar,
  enviarWhatsApp,
  enviando,
  sinMarco,
}) {
  const fechaCorta = formatFechaTasa(tasaFecha);
  return (
    <div
      className={
        sinMarco
          ? ""
          : "overflow-hidden rounded-xl border border-paper-line bg-white shadow-card"
      }
    >
      {/* Banda invertida: el tercer recurso de jerarquía del OWN-WORLD
          (peso / mayúscula / reversa) — reservado para este único momento,
          el cierre del pedido. En el cajón móvil el header ya la cubre. */}
      {!sinMarco && (
        <div className="flex items-center gap-2 bg-brand-navy px-4 py-3 text-white">
          <ShoppingCart size={17} />
          <h2 className="font-semibold">Tu pedido</h2>
        </div>
      )}

      <div className={sinMarco ? "" : "p-4"}>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            Tu carrito está vacío. Agrega productos para armar tu pedido.
          </p>
        ) : (
          <>
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.codigo} className="flex gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium leading-snug text-ink">
                    {it.nombre}
                  </p>
                  <p className="tabular font-mono text-xs text-ink-faint">
                    ${it.precio.toFixed(2)} c/u
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      onClick={() => cambiar(it.codigo, -1, it.existencia)}
                      aria-label="Quitar una unidad"
                      className="flex h-6 w-6 items-center justify-center rounded border border-paper-line text-ink-muted hover:border-brand-navy/40"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="tabular w-5 text-center text-sm">
                      {it.cantidad}
                    </span>
                    <button
                      onClick={() => cambiar(it.codigo, 1, it.existencia)}
                      disabled={it.cantidad >= it.existencia}
                      aria-label="Agregar una unidad"
                      className="flex h-6 w-6 items-center justify-center rounded border border-paper-line text-ink-muted hover:border-brand-navy/40 disabled:opacity-40"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => quitar(it.codigo)}
                      aria-label="Eliminar del carrito"
                      className="ml-auto text-ink-faint hover:text-brand-magentaDeep"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <span className="tabular font-mono text-sm font-semibold text-ink">
                  ${(it.precio * it.cantidad).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-paper-line pt-3">
            <span className="text-sm text-ink-muted">Total</span>
            <div className="text-right">
              <span className="tabular font-mono text-lg font-bold text-ink">
                ${total.toFixed(2)}
              </span>
              {tasaBcv && (
                <p className="tabular font-mono text-xs text-ink-faint">
                  {formatBs(total * tasaBcv)}
                  {fechaCorta && (
                    <span className="ml-1 font-sans">· tasa BCV {fechaCorta}</span>
                  )}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={enviarWhatsApp}
            disabled={enviando}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-whatsapp py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-wait disabled:opacity-70"
          >
            <MessageCircle size={18} />
            {enviando ? "Actualizando tasa…" : "Enviar pedido por WhatsApp"}
          </button>
            <p className="mt-2 text-center text-[11px] text-ink-faint">
              Te atenderá un asesor para confirmar y coordinar el pago.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
