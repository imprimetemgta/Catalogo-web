import { test } from "node:test";
import assert from "node:assert/strict";
import { mapearFilaJson, mapearFilaSupabase } from "../lib/reposicion/datos.js";

const filaJson = {
  CODIGO: "01002",
  DESCRIPCION: "TONER JDS CANON CRG 057H BK",
  REFERENCIA: "",
  MARCA: "JD SOLUTIONS",
  MODELO: "REND:10000.PAG.",
  PUBLICAWEB: "True",
  PRECIO_USD: "43.22",
  EXISTENCIA_PEDIDO: 0,
  NOMBRE_DEPARTAMENTO: "TONER JD SOLUTIONS",
  EXISTENCIA_DISPONIBLE: 5,
};

test("mapearFilaJson: sin EXISTENCIA_BRUTA da bruta null", () => {
  const p = mapearFilaJson(filaJson);
  assert.equal(p.bruta, null);
  assert.equal(p.pedido, 0);
});

test("mapearFilaJson: EXISTENCIA_BRUTA null también da null", () => {
  assert.equal(mapearFilaJson({ ...filaJson, EXISTENCIA_BRUTA: null }).bruta, null);
  assert.equal(mapearFilaJson({ ...filaJson, EXISTENCIA_PEDIDO: null }).pedido, null);
});

test("mapearFilaJson: con EXISTENCIA_BRUTA 3 da bruta 3", () => {
  assert.equal(mapearFilaJson({ ...filaJson, EXISTENCIA_BRUTA: 3 }).bruta, 3);
});

test("mapearFilaJson: precio es Number y la forma es la de producto", () => {
  const p = mapearFilaJson({ ...filaJson, EXISTENCIA_BRUTA: 3 });
  assert.deepEqual(p, {
    codigo: "01002",
    nombre: "TONER JDS CANON CRG 057H BK",
    referencia: "",
    marca: "JD SOLUTIONS",
    modelo: "REND:10000.PAG.",
    departamento: "TONER JD SOLUTIONS",
    precio: 43.22,
    disponible: 5,
    bruta: 3,
    pedido: 0,
    creadoEn: null,
    imagen: null,
  });
  assert.equal(typeof p.precio, "number");
});

const filaSb = {
  codigo: "A/1 x",
  descripcion: "Producto",
  referencia: "REF",
  marca: "M",
  modelo: "MOD",
  nombre_departamento: "TINTAS",
  precio_usd: "2.50",
  existencia_bruta: null,
  existencia_pedido: 1,
  existencia_disponible: 0,
  creado_en: "2026-10-01T00:00:00Z",
};

test("mapearFilaSupabase: existencia_bruta null se conserva como null", () => {
  const p = mapearFilaSupabase(filaSb, "https://x.supabase.co");
  assert.equal(p.bruta, null);
  assert.equal(p.pedido, 1);
  assert.equal(p.precio, 2.5);
  assert.equal(p.creadoEn, "2026-10-01T00:00:00Z");
});

test("mapearFilaSupabase: imagen igual que /api/productos", () => {
  const p = mapearFilaSupabase(filaSb, "https://x.supabase.co");
  assert.equal(p.imagen, "https://x.supabase.co/storage/v1/object/public/productos/A_1_x.jpg");
});
