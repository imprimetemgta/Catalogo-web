import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estadoDe,
  esNuevo,
  filtrarYOrdenar,
  resumen,
} from "../lib/reposicion/clasificar.js";

const base = { referencia: "", marca: "", modelo: "", pedido: 0, creadoEn: null, imagen: null };
const fixture = [
  { ...base, codigo: "A", nombre: "Consultar", departamento: "PAPELERIA", precio: 5, bruta: null, disponible: 0 },
  { ...base, codigo: "B", nombre: "Sin existencias", departamento: "PAPELERIA", precio: 1, bruta: 0, disponible: 0 },
  { ...base, codigo: "C", nombre: "Agotado", departamento: "TINTAS", precio: 3, bruta: 4, disponible: 0 },
  { ...base, codigo: "D", nombre: "TÓNER HP", departamento: null, precio: 4, bruta: 5, disponible: 5 },
  { ...base, codigo: "E", nombre: "Ok", departamento: "TINTAS", precio: 2, bruta: 20, disponible: 6 },
];

test("estadoDe clasifica en orden de prioridad", () => {
  assert.deepEqual(fixture.map(estadoDe), ["a_consultar", "sin_existencias", "agotado", "bajo", "ok"]);
  assert.equal(estadoDe({ bruta: 20, disponible: 5 }), "bajo");
  assert.equal(estadoDe({ bruta: 20, disponible: 6 }), "ok");
  assert.equal(estadoDe({ bruta: -2, disponible: 0 }), "sin_existencias");
});

test("resumen cuenta por estado", () => {
  const r = resumen(fixture);
  assert.equal(r.total, 5);
  assert.equal(r.agotado, 1);
  assert.equal(r.sin_existencias, 1);
  assert.equal(r.bajo, 1);
  assert.equal(r.a_consultar, 1);
  assert.equal(r.nuevos, 0);
});

test("resumen: porDepartamento solo con problemas, ordenado, null = Sin departamento", () => {
  const r = resumen(fixture);
  assert.deepEqual(r.porDepartamento, [
    { departamento: "PAPELERIA", agotado: 0, sin_existencias: 1, bajo: 0, a_consultar: 1 },
    { departamento: "TINTAS", agotado: 1, sin_existencias: 0, bajo: 0, a_consultar: 0 },
    { departamento: "Sin departamento", agotado: 0, sin_existencias: 0, bajo: 1, a_consultar: 0 },
  ]);
});

test("resumen: nuevos cuenta independiente del estado", () => {
  const ahora = Date.parse("2026-10-20T00:00:00Z");
  const reciente = new Date(ahora - 2 * 86400000).toISOString();
  const r = resumen([{ ...fixture[2], creadoEn: reciente }, fixture[4]], ahora);
  assert.equal(r.nuevos, 1);
  assert.equal(r.agotado, 1);
});

test("existencia_asc deja a_consultar al final", () => {
  const r = filtrarYOrdenar(fixture, { orden: "existencia_asc" });
  assert.equal(r[r.length - 1].codigo, "A");
  assert.equal(r.length, 5);
});

test("ordena por precio", () => {
  assert.deepEqual(filtrarYOrdenar(fixture, { orden: "precio_asc" }).map((p) => p.precio), [1, 2, 3, 4, 5]);
  assert.deepEqual(filtrarYOrdenar(fixture, { orden: "precio_desc" }).map((p) => p.precio), [5, 4, 3, 2, 1]);
});

test("busca sin distinguir mayúsculas ni acentos, también por código", () => {
  assert.deepEqual(filtrarYOrdenar(fixture, { busqueda: "toner" }).map((p) => p.codigo), ["D"]);
  assert.deepEqual(filtrarYOrdenar(fixture, { busqueda: "c" }).some((p) => p.codigo === "C"), true);
});

test("filtra por departamento y por estado, sin mutar la entrada", () => {
  const copia = JSON.stringify(fixture);
  assert.deepEqual(filtrarYOrdenar(fixture, { departamento: "PAPELERIA" }).map((p) => p.codigo), ["A", "B"]);
  assert.deepEqual(filtrarYOrdenar(fixture, { filtro: "bajo" }).map((p) => p.codigo), ["D"]);
  filtrarYOrdenar(fixture, { orden: "precio_desc" });
  assert.equal(JSON.stringify(fixture), copia);
});

test("filtro nuevos", () => {
  const ahora = Date.parse("2026-10-20T00:00:00Z");
  const p = { ...fixture[4], creadoEn: new Date(ahora - 86400000).toISOString() };
  assert.deepEqual(filtrarYOrdenar([p, fixture[3]], { filtro: "nuevos" }, ahora).map((x) => x.codigo), ["E"]);
});

test("esNuevo: 30 días", () => {
  const ahora = Date.parse("2026-10-20T00:00:00Z");
  assert.equal(esNuevo(new Date(ahora - 29 * 86400000).toISOString(), ahora), true);
  assert.equal(esNuevo(new Date(ahora - 31 * 86400000).toISOString(), ahora), false);
  assert.equal(esNuevo(null, ahora), false);
});
