import { test } from "node:test";
import assert from "node:assert/strict";
import { sumarDias, esFechaValida, validarCargaVentas } from "../lib/reposicion/ventas.js";

const HOY = "2026-10-21";
const VACIA = "La carga llegó vacía o sin filas válidas; no se aplicó nada.";
const carga = (filas, hasta = HOY) => validarCargaVentas({ hasta, filas }, HOY);

test("sumarDias cruza mes y año", () => {
  assert.equal(sumarDias("2026-03-01", -1), "2026-02-28");
  assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
});

test("esFechaValida", () => {
  assert.equal(esFechaValida("2026-02-30"), false);
  assert.equal(esFechaValida("2026-10-21"), true);
  assert.equal(esFechaValida("21/10/2026"), false);
});

test("carga válida recorta el código y suma duplicados", () => {
  const r = carga([
    { codigo: " A1 ", fecha: "2026-10-20", unidades: 2 },
    { codigo: "A1", fecha: "2026-10-20", unidades: -1 },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.hasta, HOY);
  assert.deepEqual(r.filas, [{ codigo: "A1", fecha: "2026-10-20", unidades: 1 }]);
  assert.deepEqual(r.descartadas, []);
});

test("ventana de 30 días: hasta-30 se descarta, hasta-29 se acepta", () => {
  const r = carga([
    { codigo: "A", fecha: "2026-09-21", unidades: 1 },
    { codigo: "B", fecha: "2026-09-22", unidades: 1 },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.filas.map((f) => f.codigo), ["B"]);
  assert.deepEqual(r.descartadas.map((d) => d.codigo), ["A"]);
});

test("descarta código vacío, unidades no numéricas y fuera de rango", () => {
  const r = carga([
    { codigo: "  ", fecha: HOY, unidades: 1 },
    { codigo: "X", fecha: HOY, unidades: "abc" },
    { codigo: "Y", fecha: HOY, unidades: 1e8 },
    { codigo: "OK", fecha: HOY, unidades: 3 },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.filas, [{ codigo: "OK", fecha: HOY, unidades: 3 }]);
  assert.equal(r.descartadas.length, 3);
  assert.ok(r.descartadas.every((d) => typeof d.motivo === "string" && d.motivo));
});

test("hasta no puede pasar de hoy + 1 día", () => {
  const f = [{ codigo: "A", fecha: "2026-10-22", unidades: 1 }];
  assert.equal(carga(f, "2026-10-23").ok, false);
  assert.equal(carga(f, "2026-10-22").ok, true);
});

test("sin filas válidas da el mensaje exacto", () => {
  assert.deepEqual(carga([]), { ok: false, error: VACIA });
  assert.deepEqual(carga([{ codigo: "", fecha: HOY, unidades: 1 }]), { ok: false, error: VACIA });
});

test("cuerpo mal formado", () => {
  assert.equal(validarCargaVentas(null, HOY).ok, false);
  assert.equal(validarCargaVentas([], HOY).ok, false);
  assert.equal(validarCargaVentas({ hasta: HOY, filas: "x" }, HOY).ok, false);
  assert.equal(validarCargaVentas({ filas: [] }, HOY).ok, false);
  assert.equal(validarCargaVentas({ hasta: "2026-02-30", filas: [] }, HOY).ok, false);
  assert.equal(carga(new Array(50001).fill({ codigo: "A", fecha: HOY, unidades: 1 })).ok, false);
});
