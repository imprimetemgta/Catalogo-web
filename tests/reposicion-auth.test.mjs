import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COOKIE_SESION,
  DURACION_SESION_MS,
  RUTA_SECRETA,
  hashClave,
  verificarClave,
  crearToken,
  verificarToken,
} from "../lib/reposicion/auth.js";

const H = 60 * 60 * 1000;

test("constantes", () => {
  assert.equal(COOKIE_SESION, "repo_sesion");
  assert.equal(DURACION_SESION_MS, 12 * H);
  assert.equal(RUTA_SECRETA, "/r-7cdc0e670a66b2d0f9dc");
});

test("hashClave tiene el formato esperado", async () => {
  const p = (await hashClave("abc12345")).split("$");
  assert.deepEqual(p.slice(0, 4), ["scrypt", "16384", "8", "1"]);
  assert.equal(Buffer.from(p[4], "base64").length, 16);
  assert.equal(Buffer.from(p[5], "base64").length, 64);
});

test("verificarClave acepta la correcta y rechaza otra", async () => {
  const h = await hashClave("abc12345");
  assert.equal(await verificarClave("abc12345", h), true);
  assert.equal(await verificarClave("otra", h), false);
});

test("dos hashes de la misma clave difieren (sal)", async () => {
  assert.notEqual(await hashClave("abc12345"), await hashClave("abc12345"));
});

test("verificarClave con hash nulo o mal formado da false sin lanzar", async () => {
  assert.equal(await verificarClave("x", null), false);
  assert.equal(await verificarClave("x", "basura"), false);
  assert.equal(await verificarClave("x", "scrypt$a$b$c$d$e"), false);
  assert.equal(await verificarClave("x", "scrypt$16384$8$1$AAAA$AAAA"), false);
});

test("verificarClave rechaza parámetros absurdos", async () => {
  const h = (await hashClave("x")).split("$");
  h[1] = String(2 ** 25);
  assert.equal(await verificarClave("x", h.join("$")), false);
});

test("token válido dentro de la ventana de 12 h", () => {
  const t = 1_700_000_000_000;
  const tok = crearToken("ana", "secreto", t);
  assert.deepEqual(verificarToken(tok, "secreto", t + 11 * H), { usuario: "ana" });
  assert.equal(verificarToken(tok, "secreto", t + 12 * H + 1), null);
});

test("token alterado, otro secreto o ausente da null", () => {
  const t = 1_700_000_000_000;
  const tok = crearToken("ana", "secreto", t);
  const [p, f] = tok.split(".");
  const f2 = f.slice(0, -1) + (f.endsWith("A") ? "B" : "A");
  assert.equal(verificarToken(`${p}.${f2}`, "secreto", t), null);
  const p2 = Buffer.from(JSON.stringify({ u: "root", exp: t + H })).toString("base64url");
  assert.equal(verificarToken(`${p2}.${f}`, "secreto", t), null);
  assert.equal(verificarToken(tok, "otro", t), null);
  assert.equal(verificarToken(undefined, "secreto", t), null);
  assert.equal(verificarToken("sinpunto", "secreto", t), null);
  assert.equal(verificarToken("a.b.c", "secreto", t), null);
});

test("token firmado con payload sin u o exp válidos da null", async () => {
  const { createHmac } = await import("node:crypto");
  const firmar = (obj) => {
    const p = Buffer.from(typeof obj === "string" ? obj : JSON.stringify(obj)).toString("base64url");
    return `${p}.${createHmac("sha256", "s").update(p).digest("base64url")}`;
  };
  assert.equal(verificarToken(firmar({ exp: 9e15 }), "s", 0), null);
  assert.equal(verificarToken(firmar({ u: "a" }), "s", 0), null);
  assert.equal(verificarToken(firmar({ u: 5, exp: 9e15 }), "s", 0), null);
  assert.equal(verificarToken(firmar("no-json"), "s", 0), null);
  assert.deepEqual(verificarToken(firmar({ u: "a", exp: 10 }), "s", 0), { usuario: "a" });
});
