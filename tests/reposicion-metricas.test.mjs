import { test } from "node:test";
import assert from "node:assert/strict";
import { totalesPorCodigo, metricasDe, diasDesde } from "../lib/reposicion/metricas.js";

const HASTA = "2026-10-21";
const v = (u30, extra = {}) => ({ u7: 0, u15: 0, u30, ultima: "2026-10-21", ...extra });

test("totalesPorCodigo suma por ventana e ignora filas fuera de 30 días", () => {
  const filas = [
    { codigo: "A1", fecha: "2026-10-21", unidades: 2 },
    { codigo: "A1", fecha: "2026-10-15", unidades: 3 },
    { codigo: "A1", fecha: "2026-10-07", unidades: 4 },
    { codigo: "A1", fecha: "2026-09-22", unidades: 5 },
    { codigo: "A1", fecha: "2026-09-21", unidades: 99 },
  ];
  const t = totalesPorCodigo(filas, HASTA).get("A1");
  assert.equal(t.u7, 2 + 3);
  assert.equal(t.u15, 9);
  assert.equal(t.u30, 14);
  assert.equal(t.ultima, "2026-10-21");
});

test("totalesPorCodigo: filas negativas no se recortan y no cuentan para ultima", () => {
  const t = totalesPorCodigo(
    [
      { codigo: "B1", fecha: "2026-10-20", unidades: 1 },
      { codigo: "B1", fecha: "2026-10-21", unidades: -3 },
    ],
    HASTA
  ).get("B1");
  assert.equal(t.u7, -2);
  assert.equal(t.ultima, "2026-10-20");
  const m = metricasDe({ disponible: 10, ventas: t }, 7);
  assert.equal(m.vendidos, 0);
  assert.equal(m.alcanzaDias, null);
  assert.equal(m.sugerido, null);
});

test("totalesPorCodigo: sin unidades positivas, ultima es null", () => {
  const t = totalesPorCodigo([{ codigo: "Z", fecha: "2026-10-21", unidades: -1 }], HASTA).get("Z");
  assert.equal(t.ultima, null);
});

test("metricasDe: cobertura y sugerido", () => {
  const m = metricasDe({ disponible: 10, ventas: { u7: 7, u15: 15, u30: 30, ultima: "2026-10-21" } }, 30);
  assert.deepEqual(m, { vendidos: 30, alcanzaDias: 10, sugerido: 20, ultima: "2026-10-21" });
});

test("metricasDe: disponible 0, periodo 7", () => {
  const m = metricasDe({ disponible: 0, ventas: { u7: 7, u15: 15, u30: 30, ultima: "2026-10-21" } }, 7);
  assert.equal(m.alcanzaDias, 0);
  assert.equal(m.sugerido, 30);
});

test("metricasDe: stock de sobra -> sugerido null", () => {
  assert.equal(metricasDe({ disponible: 100, ventas: v(3) }, 30).sugerido, null);
});

test("metricasDe: mínimo de stock manda cuando se vende poco", () => {
  assert.equal(metricasDe({ disponible: 1, ventas: v(1) }, 30).sugerido, 4);
});

test("metricasDe: unidades decimales", () => {
  const m = metricasDe({ disponible: 3, ventas: v(1.5) }, 30);
  assert.equal(m.alcanzaDias, 60);
  assert.equal(m.sugerido, 2);
});

test("metricasDe: sin datos de ventas devuelve null", () => {
  assert.equal(metricasDe({ disponible: 3, ventas: null }, 30), null);
  assert.equal(metricasDe({ disponible: 3 }, 30), null);
});

test("diasDesde", () => {
  assert.equal(diasDesde("2026-10-18", "2026-10-21"), 3);
  assert.equal(diasDesde("2026-10-21", "2026-10-21"), 0);
});
