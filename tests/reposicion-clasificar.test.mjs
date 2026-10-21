import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estadoDe,
  esNuevo,
  filtrarYOrdenar,
  INICIAL,
  urgenciaDe,
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

// --- Fase 2: métricas de ventas ---
const vt = (u7, u15, u30) => ({ u7, u15, u30, ultima: "2026-10-21" });
const conVentas = [
  { ...base, codigo: "R", nombre: "Rapido", departamento: "TINTAS", precio: 1, bruta: 20, disponible: 6, ventas: vt(3, 15, 30) },
  { ...base, codigo: "S", nombre: "Lento", departamento: "TINTAS", precio: 1, bruta: 60, disponible: 50, ventas: vt(0, 1, 3) },
  { ...base, codigo: "N", nombre: "Quieto", departamento: "TINTAS", precio: 1, bruta: 20, disponible: 8, ventas: vt(0, 0, 0) },
  { ...base, codigo: "C", nombre: "Consultar", departamento: "TINTAS", precio: 1, bruta: null, disponible: 0, ventas: vt(10, 20, 100) },
  { ...base, codigo: "X", nombre: "Sinventas", departamento: "TINTAS", precio: 1, bruta: 20, disponible: 9, ventas: null },
];
const codigos = (opts) => filtrarYOrdenar(conVentas, opts).map((p) => p.codigo);

test("filtros de ventas", () => {
  assert.deepEqual(codigos({ filtro: "mas_vendidos" }), ["C", "S", "R"]); // por nombre
  assert.deepEqual(codigos({ filtro: "reponer_ya" }), ["R"]);
  assert.deepEqual(codigos({ filtro: "sin_movimiento" }), ["N"]);
});

test("reponer_ya depende del periodo", () => {
  assert.deepEqual(codigos({ filtro: "reponer_ya", periodo: 30 }), ["R"]);
  assert.deepEqual(codigos({ filtro: "reponer_ya", periodo: 7 }), []);
});

test("orden vendidos_desc y alcanza_asc", () => {
  assert.deepEqual(codigos({ orden: "vendidos_desc" }), ["C", "R", "S", "N", "X"]);
  assert.deepEqual(codigos({ orden: "alcanza_asc" }), ["C", "R", "S", "N", "X"]);
  // periodo 7: C 10, R 3 y el resto 0 (empate por nombre: Lento, Quieto, Sinventas)
  assert.deepEqual(codigos({ orden: "vendidos_desc", periodo: 7 }), ["C", "R", "S", "N", "X"]);
});

test("resumen suma conteos de ventas", () => {
  const r = resumen(conVentas);
  assert.equal(r.mas_vendidos, 3);
  assert.equal(r.reponer_ya, 1);
  assert.equal(r.sin_movimiento, 1);
  assert.equal(resumen(conVentas, Date.now(), 7).reponer_ya, 0);
  assert.equal(resumen(fixture).mas_vendidos, 0);
});

test("sin datos de ventas, los filtros nuevos no incluyen nada", () => {
  for (const filtro of ["mas_vendidos", "reponer_ya", "sin_movimiento"]) {
    assert.deepEqual(filtrarYOrdenar(fixture, { filtro }), []);
  }
});

test("u30 <= 0 pero u7 > 0 (neto): sin_movimiento lo incluye, mas_vendidos con periodo 7 tambien", () => {
  const p = { ...base, codigo: "Q", nombre: "Neto", departamento: "TINTAS", precio: 1, bruta: 20, disponible: 8, ventas: vt(2, 0, -1) };
  assert.deepEqual(filtrarYOrdenar([p], { filtro: "sin_movimiento" }).map((x) => x.codigo), ["Q"]);
  assert.deepEqual(filtrarYOrdenar([p], { filtro: "mas_vendidos", periodo: 7 }).map((x) => x.codigo), ["Q"]);
  assert.deepEqual(filtrarYOrdenar([p], { filtro: "mas_vendidos", periodo: 30 }), []);
});

test("sin_movimiento no incluye productos con disponible <= 0", () => {
  const ps = [0, -3].map((d, i) => ({ ...base, codigo: "Z" + i, nombre: "Z" + i, departamento: "TINTAS", precio: 1, bruta: 20, disponible: d, ventas: vt(0, 0, 0) }));
  assert.deepEqual(filtrarYOrdenar(ps, { filtro: "sin_movimiento" }), []);
});

test("alcanza_asc desempata por más vendidos y luego por nombre", () => {
  const ps = [
    { ...base, codigo: "P1", nombre: "Bbb", departamento: null, precio: 1, bruta: 10, disponible: 2, ventas: vt(0, 0, 30) }, // alcanza 2
    { ...base, codigo: "P2", nombre: "Aaa", departamento: null, precio: 1, bruta: 10, disponible: 4, ventas: vt(0, 0, 60) }, // alcanza 2, vende más
    { ...base, codigo: "P3", nombre: "Ccc", departamento: null, precio: 1, bruta: 10, disponible: 2, ventas: vt(0, 0, 30) }, // alcanza 2, empata con P1
  ];
  assert.deepEqual(filtrarYOrdenar(ps, { orden: "alcanza_asc", periodo: 30 }).map((p) => p.codigo), ["P2", "P1", "P3"]);
});

test("urgenciaDe: prioridad consultar > agotado/sin existencias > reponer ya > bajo > ok", () => {
  const p = (over) => ({ ...base, codigo: "U", nombre: "U", departamento: null, precio: 1, ...over });
  assert.equal(urgenciaDe(p({ bruta: null, disponible: 0, ventas: vt(5, 5, 5) }), 30), "consultar");
  assert.equal(urgenciaDe(p({ bruta: 0, disponible: 0, ventas: null }), null), "critico"); // sin ventas cargadas
  assert.equal(urgenciaDe(p({ bruta: 4, disponible: 0, ventas: vt(0, 0, 0) }), 30), "critico");
  assert.equal(urgenciaDe(p({ bruta: 20, disponible: 20, ventas: vt(0, 0, 150) }), 30), "critico"); // ok de stock, alcanza 4 d
  assert.equal(urgenciaDe(p({ bruta: 20, disponible: 20, ventas: vt(0, 0, 150) }), null), "ok"); // mismo, sin ventas cargadas
  assert.equal(urgenciaDe(p({ bruta: 9, disponible: 3, ventas: vt(0, 0, 0) }), 30), "bajo");
  assert.equal(urgenciaDe(p({ bruta: 20, disponible: 20, ventas: vt(0, 0, 3) }), 30), "ok");
});

test("INICIAL: valores al abrir con y sin ventas", () => {
  assert.deepEqual(INICIAL, {
    conVentas: { filtro: "reponer_ya", orden: "alcanza_asc" },
    sinVentas: { filtro: "todos", orden: "existencia_asc" },
  });
  assert.ok(Object.isFrozen(INICIAL));
});
