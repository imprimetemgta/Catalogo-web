// Hash de clave (scrypt) y token de sesión firmado (HMAC-SHA256) para /reposicion.
// Lógica pura: solo node:crypto, sin dependencias del proyecto.
import { randomBytes, scrypt, createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_SESION = "repo_sesion";
export const DURACION_SESION_MS = 12 * 60 * 60 * 1000;
export const RUTA_SECRETA = "/r-7cdc0e670a66b2d0f9dc";

// Parámetros con los que se generan los hashes nuevos.
const N = 16384;
const R = 8;
const P = 1;
const LARGO_SAL = 16;
const LARGO_HASH = 64;
// Tope de parámetros leídos de un hash guardado: evita que una fila corrupta
// obligue al servidor a gastar memoria/CPU sin límite.
const N_MAX = 2 ** 20;
const R_MAX = 32;
const P_MAX = 16;

function derivar(clave, sal, n, r, p) {
  return new Promise((resolve, reject) => {
    scrypt(
      clave,
      sal,
      LARGO_HASH,
      { N: n, r, p, maxmem: 256 * n * r + 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key))
    );
  });
}

export async function hashClave(clave) {
  const sal = randomBytes(LARGO_SAL);
  const key = await derivar(clave, sal, N, R, P);
  return `scrypt$${N}$${R}$${P}$${sal.toString("base64")}$${key.toString("base64")}`;
}

// Hash señuelo: se calcula una sola vez y se usa cuando no hay hash válido,
// para que la respuesta tarde lo mismo que con un usuario real.
let senuelo = null;
function obtenerSenuelo() {
  senuelo ??= hashClave(randomBytes(16).toString("hex"));
  return senuelo;
}

// Devuelve { n, r, p, sal, esperado } o null si el hash no sirve.
function leerHash(hash) {
  if (typeof hash !== "string") return null;
  const partes = hash.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return null;
  const [n, r, p] = partes.slice(1, 4).map((x) => (/^\d+$/.test(x) ? Number(x) : NaN));
  if (!Number.isInteger(n) || n < 2 || n > N_MAX || (n & (n - 1)) !== 0) return null;
  if (!Number.isInteger(r) || r < 1 || r > R_MAX) return null;
  if (!Number.isInteger(p) || p < 1 || p > P_MAX) return null;
  const sal = Buffer.from(partes[4], "base64");
  const esperado = Buffer.from(partes[5], "base64");
  if (sal.length === 0 || esperado.length !== LARGO_HASH) return null;
  return { n, r, p, sal, esperado };
}

export async function verificarClave(clave, hash) {
  try {
    if (typeof clave !== "string") return false;
    let datos = leerHash(hash);
    const valido = datos !== null;
    if (!valido) datos = leerHash(await obtenerSenuelo());
    const key = await derivar(clave, datos.sal, datos.n, datos.r, datos.p);
    // Largos iguales garantizados por leerHash; timingSafeEqual lo exige.
    return timingSafeEqual(key, datos.esperado) && valido;
  } catch {
    return false;
  }
}

function firmar(parte, secreto) {
  return createHmac("sha256", secreto).update(parte).digest();
}

export function crearToken(usuario, secreto, ahoraMs = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ u: usuario, exp: ahoraMs + DURACION_SESION_MS })
  ).toString("base64url");
  return `${payload}.${firmar(payload, secreto).toString("base64url")}`;
}

export function verificarToken(token, secreto, ahoraMs = Date.now()) {
  try {
    if (typeof token !== "string" || typeof secreto !== "string") return null;
    const partes = token.split(".");
    if (partes.length !== 2) return null;
    const [payload, firma] = partes;
    const recibida = Buffer.from(firma, "base64url");
    const esperada = firmar(payload, secreto);
    if (recibida.length !== esperada.length) return null;
    if (!timingSafeEqual(recibida, esperada)) return null;
    const datos = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!datos || typeof datos.u !== "string" || typeof datos.exp !== "number") return null;
    if (!(datos.exp >= ahoraMs)) return null;
    return { usuario: datos.u };
  } catch {
    return null;
  }
}
