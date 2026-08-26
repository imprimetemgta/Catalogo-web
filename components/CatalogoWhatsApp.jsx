"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  Search,
  Package,
} from "lucide-react";

// Número del asesor (configurable por variable de entorno en Vercel).
const WHATSAPP_NUMERO =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMERO || "584121234567";

export default function CatalogoWhatsApp() {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [carrito, setCarrito] = useState({}); // { codigo: cantidad }
  const [marca, setMarca] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");
  const [carritoAbierto, setCarritoAbierto] = useState(false);

  // Carga los productos reales desde la API.
  useEffect(() => {
    let activo = true;
    fetch("/api/productos")
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo cargar el catálogo");
        return r.json();
      })
      .then((data) => {
        if (activo) {
          setProductos(Array.isArray(data) ? data : []);
          setCargando(false);
        }
      })
      .catch((e) => {
        if (activo) {
          setError(e.message);
          setCargando(false);
        }
      });
    return () => {
      activo = false;
    };
  }, []);

  const marcas = useMemo(
    () => [
      "Todas",
      ...Array.from(new Set(productos.map((p) => p.marca).filter(Boolean))).sort(),
    ],
    [productos]
  );

  const productosFiltrados = productos.filter((p) => {
    const coincideMarca = marca === "Todas" || p.marca === marca;
    const coincideBusq = (p.nombre || "")
      .toLowerCase()
      .includes(busqueda.toLowerCase());
    return coincideMarca && coincideBusq;
  });

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

  const enviarWhatsApp = () => {
    if (itemsCarrito.length === 0) return;
    const lineas = itemsCarrito.map(
      (it) =>
        `• ${it.cantidad}x ${it.nombre} (${it.codigo}) — $${(
          it.precio * it.cantidad
        ).toFixed(2)}`
    );
    const mensaje =
      `¡Hola! Quiero hacer este pedido:\n\n${lineas.join("\n")}\n\n` +
      `*Total: $${total.toFixed(2)}*\n\nQuedo atento(a). ¡Gracias!`;
    const url = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
      mensaje
    )}`;
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      {/* Encabezado */}
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-900 text-white">
              <Package size={18} />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Mi Catálogo
            </span>
          </div>

          <div className="relative ml-auto hidden max-w-xs flex-1 sm:block">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto…"
              className="w-full rounded-lg border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-stone-400"
            />
          </div>

          <button
            onClick={() => setCarritoAbierto(true)}
            className="relative flex items-center gap-2 rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white lg:hidden"
          >
            <ShoppingCart size={16} />
            {totalUnidades > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-xs font-bold text-white">
                {totalUnidades}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <main className="flex-1">
          {/* Buscador en móvil */}
          <div className="relative mb-4 sm:hidden">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto…"
              className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-stone-400"
            />
          </div>

          {/* Filtro por marca */}
          {marcas.length > 1 && (
            <div className="mb-5">
              <select
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-stone-400"
              >
                {marcas.map((m) => (
                  <option key={m} value={m}>
                    {m === "Todas" ? "Todas las marcas" : m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Estados */}
          {cargando && (
            <p className="py-16 text-center text-sm text-stone-400">
              Cargando catálogo…
            </p>
          )}
          {error && !cargando && (
            <p className="py-16 text-center text-sm text-red-500">{error}</p>
          )}

          {/* Grid de productos */}
          {!cargando && !error && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {productosFiltrados.map((p) => {
                const enCarrito = carrito[p.codigo] || 0;
                const agotado = p.existencia <= 0;
                return (
                  <div
                    key={p.codigo}
                    className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white"
                  >
                    {/* Placeholder de imagen (a futuro: <img src={p.imagen} />) */}
                    <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 px-2 text-center text-xs font-medium text-stone-400">
                      {p.marca || "Producto"}
                    </div>

                    <div className="flex flex-1 flex-col p-3">
                      <p className="text-[11px] font-mono text-stone-400">
                        {p.codigo}
                      </p>
                      <h3 className="mt-0.5 text-sm font-medium leading-snug">
                        {p.nombre}
                      </h3>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-base font-semibold">
                          ${p.precio.toFixed(2)}
                        </span>
                        <span
                          className={`text-xs ${
                            agotado ? "text-red-500" : "text-stone-400"
                          }`}
                        >
                          {agotado ? "Agotado" : `${p.existencia} disp.`}
                        </span>
                      </div>

                      <div className="mt-auto pt-3">
                        {enCarrito === 0 ? (
                          <button
                            disabled={agotado}
                            onClick={() => agregar(p.codigo, p.existencia)}
                            className="w-full rounded-lg bg-stone-900 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
                          >
                            Agregar
                          </button>
                        ) : (
                          <div className="flex items-center justify-between rounded-lg bg-stone-100 p-1">
                            <button
                              onClick={() =>
                                cambiar(p.codigo, -1, p.existencia)
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-stone-700 shadow-sm"
                            >
                              <Minus size={15} />
                            </button>
                            <span className="text-sm font-semibold">
                              {enCarrito}
                            </span>
                            <button
                              onClick={() => cambiar(p.codigo, 1, p.existencia)}
                              disabled={enCarrito >= p.existencia}
                              className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-stone-700 shadow-sm disabled:opacity-40"
                            >
                              <Plus size={15} />
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
            <p className="py-16 text-center text-sm text-stone-400">
              No hay productos que coincidan con tu búsqueda.
            </p>
          )}
        </main>

        {/* Carrito — panel lateral en escritorio */}
        <aside className="hidden w-80 shrink-0 lg:block">
          <div className="sticky top-20">
            <CarritoPanel
              items={itemsCarrito}
              total={total}
              cambiar={cambiar}
              quitar={quitar}
              enviarWhatsApp={enviarWhatsApp}
            />
          </div>
        </aside>
      </div>

      {/* Carrito — cajón deslizante en móvil */}
      {carritoAbierto && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setCarritoAbierto(false)}
          />
          <div className="absolute right-0 top-0 flex h-full w-[85%] max-w-sm flex-col bg-stone-50 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
              <span className="font-semibold">Tu pedido</span>
              <button onClick={() => setCarritoAbierto(false)}>
                <X size={20} className="text-stone-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <CarritoPanel
                items={itemsCarrito}
                total={total}
                cambiar={cambiar}
                quitar={quitar}
                enviarWhatsApp={enviarWhatsApp}
                sinMarco
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CarritoPanel({ items, total, cambiar, quitar, enviarWhatsApp, sinMarco }) {
  return (
    <div className={sinMarco ? "" : "rounded-xl border border-stone-200 bg-white p-4"}>
      <div className="mb-3 flex items-center gap-2">
        <ShoppingCart size={17} />
        <h2 className="font-semibold">Tu pedido</h2>
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-400">
          Tu carrito está vacío. Agrega productos para armar tu pedido.
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.codigo} className="flex gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium leading-snug">{it.nombre}</p>
                  <p className="text-xs text-stone-400">
                    ${it.precio.toFixed(2)} c/u
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      onClick={() => cambiar(it.codigo, -1, it.existencia)}
                      className="flex h-6 w-6 items-center justify-center rounded border border-stone-200 text-stone-600"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-5 text-center text-sm">{it.cantidad}</span>
                    <button
                      onClick={() => cambiar(it.codigo, 1, it.existencia)}
                      disabled={it.cantidad >= it.existencia}
                      className="flex h-6 w-6 items-center justify-center rounded border border-stone-200 text-stone-600 disabled:opacity-40"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => quitar(it.codigo)}
                      className="ml-auto text-stone-300 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <span className="text-sm font-semibold">
                  ${(it.precio * it.cantidad).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-stone-200 pt-3">
            <span className="text-sm text-stone-500">Total</span>
            <span className="text-lg font-bold">${total.toFixed(2)}</span>
          </div>

          <button
            onClick={enviarWhatsApp}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.6.2-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.2-.6-1.5-.9-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.1 0 1.2.9 2.4 1 2.6.1.2 1.7 2.7 4.2 3.8.6.3 1 .4 1.4.5.6.2 1.1.2 1.5.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.5-.3zM12 2a10 10 0 00-8.5 15.3L2 22l4.8-1.5A10 10 0 1012 2z" />
            </svg>
            Enviar pedido por WhatsApp
          </button>
          <p className="mt-2 text-center text-[11px] text-stone-400">
            Te atenderá un asesor para confirmar y coordinar el pago.
          </p>
        </>
      )}
    </div>
  );
}
