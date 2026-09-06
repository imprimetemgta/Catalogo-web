"use client";

import { useCallback, useEffect, useState } from "react";

// Cada cuánto se refresca sola la página si el cliente la deja abierta sin
// tocarla — la red de seguridad para una pestaña que nunca llega a
// ocultarse (ej. un monitor secundario siempre visible).
const RECARGA_AUTOMATICA_MS = 30 * 60 * 1000; // 30 min

// Productos y tasa BCV, compartido entre el catálogo y el escáner de
// código: se llama al montar, al volver a la pestaña después de un rato y
// en un temporizador de respaldo — un cliente que deja la página abierta
// días no debe ver precios, existencia ni tasa de hace una semana.
export function useProductosYTasa() {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [tasaBcv, setTasaBcv] = useState(null); // Bs por USD, o null si no está disponible
  const [tasaFecha, setTasaFecha] = useState(null);

  const cargarProductos = useCallback(() => {
    return fetch("/api/productos")
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo cargar el catálogo");
        return r.json();
      })
      .then((data) => {
        setProductos(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  // Tasa oficial BCV. Es un dato secundario: si falla, el catálogo/escáner
  // sigue funcionando solo en USD. Devuelve la tasa obtenida (o null) para
  // poder usarla de inmediato sin esperar a que el estado se actualice —
  // clave justo antes de enviar un pedido por WhatsApp.
  const cargarTasa = useCallback(() => {
    return fetch("/api/tasa-bcv")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.tasa) return null;
        setTasaBcv(data.tasa);
        setTasaFecha(data.fecha ?? null);
        return data;
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    cargarProductos();
    cargarTasa();

    const alVolverVisible = () => {
      if (document.visibilityState === "visible") {
        cargarProductos();
        cargarTasa();
      }
    };
    document.addEventListener("visibilitychange", alVolverVisible);

    const intervalo = setInterval(() => {
      cargarProductos();
      cargarTasa();
    }, RECARGA_AUTOMATICA_MS);

    return () => {
      document.removeEventListener("visibilitychange", alVolverVisible);
      clearInterval(intervalo);
    };
  }, [cargarProductos, cargarTasa]);

  return {
    productos,
    cargando,
    error,
    tasaBcv,
    tasaFecha,
    cargarTasa,
  };
}
