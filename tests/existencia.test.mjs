import { test } from "node:test";
import assert from "node:assert/strict";
import { existenciaONull, esAConsultar, topeCarrito } from "../lib/existencia.js";

test("devuelve null cuando no hay dato o no es numérico", () => {
  assert.equal(existenciaONull(null, 100), null);
  assert.equal(existenciaONull(undefined, 100), null);
  assert.equal(existenciaONull("", 100), null);
  assert.equal(existenciaONull("abc", 100), null);
});

test("convierte a entero y acota a [0, max]", () => {
  assert.equal(existenciaONull("7", 100), 7);
  assert.equal(existenciaONull(-3, 100), 0);
  assert.equal(existenciaONull(500, 100), 100);
  assert.equal(existenciaONull(0, 100), 0);
});

test("los combos son a consultar y no tienen tope en el carrito", () => {
  const combo = { departamento: "COMBOS", existencia: 0 };
  assert.equal(esAConsultar(combo), true);
  assert.equal(esAConsultar({ departamento: " combos " }), true);
  assert.equal(topeCarrito(combo), Infinity);
});

test("el resto usa su existencia como tope", () => {
  const tinta = { departamento: "TINTAS", existencia: 3 };
  assert.equal(esAConsultar(tinta), false);
  assert.equal(esAConsultar({ departamento: null }), false);
  assert.equal(topeCarrito(tinta), 3);
});
