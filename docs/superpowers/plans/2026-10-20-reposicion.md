# Página de reposición — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página interna, en dirección secreta y con usuario y clave, para que el encargado de reponer stock filtre agotados, sin existencias, stock bajo, nuevos y "a consultar", ordene por precio o existencia y vea cifras rápidas por departamento.

**Architecture:** La lógica pura vive en `lib/reposicion/*.js` y en `lib/existencia.js` (clasificación, filtros, resumen, hash y token), probada con `node --test` sin dependencias nuevas. La ruta secreta `app/r-7cdc0e670a66b2d0f9dc/` contiene la página (server component que decide entre login y panel), `sesion/route.js` (entrar y salir) y `datos/route.js` (productos con bruta y reservado, solo con sesión válida). Modo local sin `SUPABASE_URL`: los datos salen de `inventario.json` y el login de un usuario fijo de desarrollo.

**Tech Stack:** Next.js 15 (app router, JSX), React 19, Tailwind 3, Supabase (`@supabase/supabase-js`), `node:crypto` (scrypt, HMAC), `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-20-reposicion-design.md`

## Global Constraints

- Nada se sube a GitHub ni se despliega. Solo commits locales en la rama `feat/reposicion`.
- Sin dependencias npm nuevas.
- No se modifican `/api/productos`, el catálogo público (`components/CatalogoWhatsApp.jsx`), su umbral de "bajo" (3) ni `existencia_disponible` en el sync.
- Mínimo de stock = **5**: "bajo" es `0 < disponible <= 5`.
- "Nuevo" = `creado_en` dentro de los últimos 30 días, el mismo criterio que `CatalogoWhatsApp.jsx:31-36`.
- Solo productos con `publicaweb = true`.
- La ruta secreta es exactamente `r-7cdc0e670a66b2d0f9dc`. No se enlaza desde ningún lado y lleva `robots: noindex, nofollow`.
- La clave nunca se guarda en texto plano. Formato del hash: `scrypt$16384$8$1$<salBase64>$<hashBase64>`, con sal de 16 bytes y clave derivada de 64 bytes.
- Cookie `repo_sesion`: `httpOnly`, `secure` (salvo en desarrollo local), `sameSite: "strict"`, `path: "/r-7cdc0e670a66b2d0f9dc"`, duración 12 h.
- Login: límite de **5 intentos por IP cada 300 s**. Si el limitador falla, se bloquea (*fail-closed*). El error siempre dice "Usuario o clave incorrectos".
- Atajo de desarrollo solo si `!process.env.SUPABASE_URL && process.env.NODE_ENV !== "production"`: usuario `prueba`, clave `prueba-local-123`, secreto de sesión fijo de desarrollo.
- Visual: seguir `DESIGN.md` (IBM Plex Sans/Mono, paleta `brand-navy #213B86` etc.). Es una herramienta densa y legible en teléfono.
- Textos en español.

## Review Focus

1. **Peticiones a `datos/route.js` sin cookie, con cookie vencida o con firma alterada:** deben dar 401 sin datos (Task 3 lo prueba en `verificarToken`; Task 5 lo verifica con curl).
2. **Usuario inexistente o desactivado (`activo = false`):** deben tardar lo mismo y dar el mismo error que una clave mala, para no revelar qué usuarios existen (Task 3 prueba el hash señuelo con `hash` nulo. Task 4 filtra `activo = true` en la consulta, y eso solo se puede revisar leyendo el código, porque en local no hay Supabase).
3. **Productos con `bruta` nula:** no cuentan en agotados, sin existencias ni bajo, y en "menor existencia" van al final (Task 2).
4. **Búsqueda con mayúsculas o acentos ("tóner" frente a "TONER"):** debe encontrar el producto (Task 2).
5. **Sync que recibe `EXISTENCIA_BRUTA` como `""`, `null`, ausente, negativa o `"abc"`:** debe dar `null` en los ausentes o no numéricos y 0 en los negativos, sin romper el resto del lote (Task 1).

---

### Task 1: Base de datos y sync con existencias nulas + test runner

**Files:**
- Create: `db/06_existencia_nullable.sql`, `db/07_usuarios_reposicion.sql`, `lib/existencia.js`, `tests/existencia.test.mjs`
- Modify: `app/api/sync/route.js:115-117` (cálculo de `bruta` y `pedido`), `package.json` (script `test`)

**Interfaces:**
- Produces: `existenciaONull(v: unknown, max: number) -> number | null` en `lib/existencia.js`. Devuelve `null` si `v` es `null`, `undefined`, `""` o no se puede convertir a entero; si no, devuelve el entero acotado a `[0, max]`.
- Produces: la tabla `public.usuarios_reposicion(usuario text primary key, clave_hash text not null, activo boolean not null default true, creado_en timestamptz not null default now())`, con RLS activado y sin políticas.

- [ ] **Step 1:** Agregar `"test": "node --test tests/"` a `package.json` y correr `npm install`.
- [ ] **Step 2: Test que falla** en `tests/existencia.test.mjs`:
  - `existenciaONull(null, 100)`, `(undefined, 100)`, `("", 100)` y `("abc", 100)` dan `null`.
  - `("7", 100)` da `7`, `(-3, 100)` da `0`, `(500, 100)` da `100` y `(0, 100)` da `0`.
- [ ] **Step 3:** `npm test` debe fallar porque el módulo no existe.
- [ ] **Step 4:** Implementar `lib/existencia.js`, sin imports `@/`. En `route.js`, `bruta` y `pedido` usan `existenciaONull(r.EXISTENCIA_BRUTA, EXIST_MAX)` y `existenciaONull(r.EXISTENCIA_PEDIDO, EXIST_MAX)`. `disponible` sigue igual.
- [ ] **Step 5:** Escribir `db/06_existencia_nullable.sql`:
  - `alter table public.productos alter column existencia_bruta drop not null, alter column existencia_pedido drop not null;`, con comentario de cabecera al estilo de `db/02_rate_limit.sql`.
  - Los checks `>= 0` de `03_constraints.sql` siguen valiendo porque `null` los pasa.
  - Escribir `db/07_usuarios_reposicion.sql` con la tabla de arriba y `enable row level security`.
- [ ] **Step 6:** `npm test` debe pasar.
- [ ] **Step 7:** Commit: `feat(sync): existencia bruta/pedido nula cuando A2 no la manda; tabla de usuarios de reposición`.

### Task 2: Clasificación, filtros y resumen (lógica pura)

**Files:**
- Create: `lib/reposicion/clasificar.js`, `tests/reposicion-clasificar.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces, en `lib/reposicion/clasificar.js` (sin imports `@/`). La forma de producto es `{codigo, nombre, referencia, marca, modelo, departamento, precio, disponible, bruta, pedido, creadoEn, imagen}`:
  - `MINIMO_STOCK = 5`
  - `estadoDe(p) -> "a_consultar" | "sin_existencias" | "agotado" | "bajo" | "ok"`, evaluando en este orden:
    1. `bruta == null` da `a_consultar`;
    2. `bruta <= 0` da `sin_existencias`;
    3. `disponible <= 0` da `agotado`;
    4. `disponible <= 5` da `bajo`;
    5. si no, `ok`.
  - `esNuevo(creadoEn, ahoraMs = Date.now()) -> boolean`, con 30 días y la misma semántica que `CatalogoWhatsApp.jsx:31-36`.
  - `FILTROS = ["todos", "agotado", "sin_existencias", "bajo", "nuevos", "a_consultar"]`
  - `ORDENES = ["nombre", "precio_asc", "precio_desc", "existencia_asc"]`
  - `filtrarYOrdenar(productos, { filtro = "todos", departamento = null, busqueda = "", orden = "nombre" }, ahoraMs = Date.now()) -> producto[]`. La búsqueda cubre nombre, código y referencia, sin distinguir mayúsculas ni acentos (`normalize("NFD")` + quitar diacríticos). No muta la entrada.
  - `resumen(productos, ahoraMs = Date.now()) -> { total, agotado, sin_existencias, bajo, a_consultar, nuevos, porDepartamento: [{ departamento, agotado, sin_existencias, bajo, a_consultar }] }`. `porDepartamento` solo incluye departamentos con al menos un problema, ordenados por `agotado + sin_existencias + bajo` de mayor a menor. Un departamento `null` se muestra como `"Sin departamento"`.

- [ ] **Step 1: Tests que fallan.** Fixture con un producto de cada estado: `{bruta:null, disponible:0}`, `{bruta:0, disponible:0}`, `{bruta:4, disponible:0}`, `{bruta:5, disponible:5}`, `{bruta:20, disponible:6}`. Se espera:
  - `estadoDe` da en orden `a_consultar, sin_existencias, agotado, bajo, ok`, y el borde `disponible: 5` da `bajo` mientras `6` da `ok`.
  - `{bruta:-2, disponible:0}` da `sin_existencias`.
  - `resumen(fixture)` da `{agotado:1, sin_existencias:1, bajo:1, a_consultar:1}`.
  - `filtrarYOrdenar(f, {orden:"existencia_asc"})` deja el `a_consultar` al final.
  - `precio_asc` y `precio_desc` respetan el orden.
  - `{busqueda:"toner"}` encuentra el nombre `"TÓNER HP"`.
  - `{departamento:"PAPELERIA"}` filtra por departamento.
  - `esNuevo` es `true` a 29 días, `false` a 31 y `false` con `null`.
- [ ] **Step 2:** `npm test` debe fallar.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test` debe pasar.
- [ ] **Step 5:** Commit: `feat(reposicion): clasificación, filtros y resumen de stock`.

### Task 3: Hash de clave y token de sesión (lógica pura)

**Files:**
- Create: `lib/reposicion/auth.js`, `tests/reposicion-auth.test.mjs`

**Interfaces:**
- Produces, en `lib/reposicion/auth.js` (solo `node:crypto`, sin `@/`):
  - `COOKIE_SESION = "repo_sesion"`, `DURACION_SESION_MS = 12 * 60 * 60 * 1000`, `RUTA_SECRETA = "/r-7cdc0e670a66b2d0f9dc"`
  - `hashClave(clave: string) -> Promise<string>` con el formato de Global Constraints.
  - `verificarClave(clave: string, hash: string | null) -> Promise<boolean>`. Con `hash` nulo o mal formado verifica contra un hash señuelo interno y devuelve `false`, para tardar lo mismo. Compara con `timingSafeEqual`.
  - `crearToken(usuario: string, secreto: string, ahoraMs = Date.now()) -> string`. Formato: `base64url(JSON {u, exp})` + `"."` + `base64url(HMAC-SHA256(secreto, parte1))`.
  - `verificarToken(token: string | undefined, secreto: string, ahoraMs = Date.now()) -> { usuario: string } | null`. Devuelve `null` si el token está vencido, mal formado o con firma distinta (comparada con `timingSafeEqual`).

- [ ] **Step 1: Tests que fallan:**
  - `verificarClave("abc12345", await hashClave("abc12345"))` es `true`, y con `"otra"` es `false`.
  - Dos `hashClave` de la misma clave dan strings distintos, por la sal.
  - `verificarClave("x", null)` y `verificarClave("x", "basura")` dan `false` sin lanzar error.
  - Un token creado en `t` se verifica en `t + 11h` y devuelve `{usuario}`. En `t + 12h + 1ms` da `null`.
  - Cambiar un carácter de la firma da `null`, igual que cambiar el payload sin volver a firmarlo.
  - Usar otro secreto da `null`. `verificarToken(undefined, s)` da `null`.
- [ ] **Step 2:** `npm test` debe fallar.
- [ ] **Step 3:** Implementar con `crypto.scrypt` (promisificado), `randomBytes(16)`, `createHmac("sha256")` y `timingSafeEqual`. Antes de comparar hay que verificar que los largos coincidan.
- [ ] **Step 4:** `npm test` debe pasar.
- [ ] **Step 5:** Commit: `feat(reposicion): hash scrypt de clave y token de sesión firmado`.

### Task 4: Capa de servidor — datos, usuarios, sesión, rutas API

**Files:**
- Create:
  - `lib/reposicion/datos.js`
  - `lib/reposicion/servidor.js`
  - `tests/reposicion-datos.test.mjs`
  - `app/r-7cdc0e670a66b2d0f9dc/sesion/route.js`
  - `app/r-7cdc0e670a66b2d0f9dc/datos/route.js`
- Modify: `lib/rateLimit.js` (agrega una opción de fail-closed sin cambiar el comportamiento por defecto)

**Interfaces:**
- Consumes: Task 2 (forma de producto), Task 3 (`verificarClave`, `crearToken`, `verificarToken`, constantes).
- Produces:
  - `lib/reposicion/datos.js` (pure, sin `@/`):
    - `mapearFilaJson(r) -> producto`, desde un registro de `inventario.json`. `bruta` y `pedido` dan `null` si la clave falta o es `null`; si no, `Number`. `creadoEn` e `imagen` quedan en `null`.
    - `mapearFilaSupabase(row, baseUrl) -> producto`. La imagen se arma igual que en `app/api/productos/route.js:50-63`.
  - `lib/reposicion/servidor.js` (server-only, puede usar `@/lib/supabase` y `next/headers`):
    - `modoLocal() -> boolean`, con la condición de Global Constraints.
    - `secretoSesion() -> string | null`: `process.env.REPOSICION_SESSION_SECRET` si tiene al menos 32 caracteres; en modo local, un secreto fijo de desarrollo; si no, `null`.
    - `buscarHashUsuario(usuario) -> Promise<string | null>`. Consulta `usuarios_reposicion` con el service client, filtrando `activo = true`. En modo local devuelve el hash de `prueba`/`prueba-local-123`, calculado una vez y guardado en memoria.
    - `sesionActual() -> Promise<{usuario} | null>`, que lee la cookie con `cookies()` de `next/headers`.
    - `obtenerProductosReposicion() -> Promise<producto[]>`. En modo local usa `inventario.json` + `mapearFilaJson`, filtrado por `PUBLICAWEB` true. Si no, usa el service client: `select codigo, descripcion, referencia, marca, modelo, nombre_departamento, precio_usd, existencia_bruta, existencia_pedido, existencia_disponible, creado_en`, con `.eq("publicaweb", true)`, ordenado por descripción.
  - `lib/rateLimit.js`: `dentroDeLimite(clave, limite, ventanaSegundos, { failOpen = true } = {})`. Con `failOpen: false`, un error devuelve `false`.
  - `POST sesion/route.js`, cuerpo `{usuario, clave}`:
    1. El rate limit `login:<ip>` (5 cada 300 s, `failOpen: false`) se salta en modo local. Si se pasa, responde 429.
    2. Sin `secretoSesion()` responde 503.
    3. Con `verificarClave` en `false` responde 401 `{error:"Usuario o clave incorrectos"}`.
    4. Si todo está bien, responde 200 y fija la cookie con los atributos de Global Constraints.
  - `DELETE sesion/route.js`: borra la cookie y responde 200.
  - `GET datos/route.js`: sin sesión válida responde 401 `{error:"No autorizado"}`. Con sesión responde 200 con `{productos}`. Siempre con `Cache-Control: no-store`.
  - Las dos rutas llevan `runtime = "nodejs"` y `dynamic = "force-dynamic"`. `ipDe` se copia del patrón de `app/api/sync/route.js:33-40`.

- [ ] **Step 1: Tests que fallan** para `mapearFilaJson`:
  - un registro sin `EXISTENCIA_BRUTA` da `bruta: null`;
  - uno con `EXISTENCIA_BRUTA: 3` da `bruta: 3`;
  - `precio` es `Number`.

  Test de `mapearFilaSupabase`: `existencia_bruta: null` se conserva como `null`.
- [ ] **Step 2:** `npm test` debe fallar.
- [ ] **Step 3:** Implementar `datos.js`, `servidor.js`, el cambio en `rateLimit.js` y las dos rutas.
- [ ] **Step 4:** `npm test` debe pasar y `npm run build` debe compilar sin errores.
- [ ] **Step 5:** Verificar con `npm run dev` (sin `.env`):
  - `curl -i localhost:3000/r-7cdc0e670a66b2d0f9dc/datos` da 401.
  - Un POST a `sesion` con una clave mala da 401 con el mensaje genérico.
  - Con `prueba`/`prueba-local-123` da 200 y un `Set-Cookie` con `HttpOnly`, `SameSite=Strict` y `Path=/r-7cdc0e670a66b2d0f9dc`.
  - `datos` con esa cookie da 200 y 588 productos o menos, alguno con `bruta: null`.
  - Esa misma cookie con un carácter alterado da 401.
- [ ] **Step 6:** Commit: `feat(reposicion): rutas de sesión y datos protegidas`.

### Task 5: Interfaz — login y panel

**Files:**
- Create:
  - `app/r-7cdc0e670a66b2d0f9dc/page.jsx`
  - `components/reposicion/LoginReposicion.jsx`
  - `components/reposicion/PanelReposicion.jsx`

**Interfaces:**
- Consumes: Task 4 (rutas `sesion` y `datos`, `sesionActual`), Task 2 (`filtrarYOrdenar`, `resumen`, `estadoDe`, `FILTROS`, `ORDENES`, `MINIMO_STOCK`).
- `page.jsx` (server component): `metadata = { title: "Reposición — Imprimete C.A.", robots: { index: false, follow: false } }`. Si `await sesionActual()` es `null`, renderiza `<LoginReposicion />`; si no, `<PanelReposicion usuario={...} />`.
- `LoginReposicion` (client): pide usuario y clave (`autocomplete` `username` / `current-password`). Hace POST a `sesion`. Si sale bien, `router.refresh()`. Si sale mal, muestra el error que devuelve el servidor (401 o 429).
- `PanelReposicion` (client):
  - Hace fetch a `datos`. Si recibe 401, `router.refresh()`.
  - **Arriba, cifras tocables:** Agotados, Sin existencias, Stock bajo (≤ 5), A consultar, Nuevos. Tocar una aplica ese filtro y tocarla otra vez vuelve a "todos".
  - Desglose por departamento a partir de `resumen().porDepartamento`. Tocar un departamento lo filtra.
  - Botones de filtro (`FILTROS`), selector de orden (Nombre / Menor precio / Mayor precio / Menor existencia), selector de departamento y búsqueda.
  - **Lista densa de filas:** código, nombre, departamento, precio (formato de `lib/moneda.js`), disponible, bruta y reservado, y etiqueta de estado. Los `a_consultar` muestran la etiqueta **"A CONSULTAR"** en lugar de los tres números. Se puede reusar `StockGauge` (`components/RefillLoop.jsx:52`) con `umbralBajo={MINIMO_STOCK}`.
  - Contador de resultados, estado vacío ("No hay productos con este filtro") y botón **Salir** (DELETE a `sesion`, luego `router.refresh()`).
  - En móvil (360 px) se ve sin scroll horizontal.

- [ ] **Step 1:** Implementar los tres archivos siguiendo `DESIGN.md`.
- [ ] **Step 2:** `npm test` y `npm run build` deben pasar.
- [ ] **Step 3: Verificación en navegador** (`npm run dev`, ancho de escritorio y de 375 px):
  - el login con una clave mala muestra el error;
  - con una buena muestra el panel;
  - cada cifra coincide con lo que da `resumen()` sobre `inventario.json`;
  - los filtros y órdenes funcionan;
  - "A CONSULTAR" aparece en los productos sin bruta (por ejemplo `RM12A`);
  - Salir vuelve al login;
  - `/` (el catálogo público) sigue igual.
- [ ] **Step 4:** Commit: `feat(reposicion): login y panel de reposición`.

### Task 6: Script de usuarios y guía de despliegue

**Files:**
- Create: `scripts/crear_usuario_reposicion.mjs`, `docs/reposicion-despliegue.md`
- Modify: `.env.example` (agregar `REPOSICION_SESSION_SECRET=` con un comentario que diga "mínimo 32 caracteres aleatorios")

**Interfaces:**
- Consumes: `hashClave` (Task 3), importado por ruta relativa.
- El script se usa así: `node scripts/crear_usuario_reposicion.mjs <usuario>`.
  - Lee la clave por stdin, no como argumento, para que no quede en el historial de la terminal.
  - Rechaza claves de menos de 10 caracteres.
  - Imprime el SQL `insert into public.usuarios_reposicion (usuario, clave_hash) values (...) on conflict (usuario) do update set clave_hash = excluded.clave_hash, activo = true;`, con las comillas simples escapadas.
- La guía tiene los pasos, en orden:
  1. correr `db/06` y `db/07` en el SQL Editor de Supabase;
  2. generar un secreto (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) y cargarlo como `REPOSICION_SESSION_SECRET` en Vercel;
  3. crear el usuario con el script y pegar el SQL;
  4. desplegar;
  5. correr un sync para que los productos sin bruta pasen a `null`;
  6. probar la entrada en `https://<dominio>/r-7cdc0e670a66b2d0f9dc`;
  7. para dar de baja a alguien: `update ... set activo = false`.

- [ ] **Step 1:** Implementar el script y verificarlo con `echo clave-de-prueba-1 | node scripts/crear_usuario_reposicion.mjs ana`: debe imprimir un SQL con un hash `scrypt$16384$8$1$...`. Comprobar que ese hash verifica con `verificarClave` usando un `node -e` corto.
- [ ] **Step 2:** Escribir la guía y actualizar `.env.example`.
- [ ] **Step 3:** Commit: `docs(reposicion): script de usuarios y guía de despliegue`.
