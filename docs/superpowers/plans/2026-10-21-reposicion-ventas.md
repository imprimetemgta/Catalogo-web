# Reposición fase 2 (ventas por periodo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar en la página de reposición las ventas por producto en periodos de 7, 15 y 30 días (vendidos, alcanza para, última venta, sugerido a pedir) con filtros "Más vendidos", "Reponer ya" y "Sin movimiento", alimentadas por un extractor de A2 nuevo.

**Architecture:** Un extractor Python de 32 bits lee `SDetalleVenta` de A2 (solo lectura) y manda unidades netas por código y día a `POST /api/sync-ventas`. Esa ruta reemplaza de forma atómica la foto de 30 días en `ventas_diarias` mediante una función SQL. La ruta de datos de reposición (ya protegida por sesión) agrega a cada producto sus totales de 7, 15 y 30 días, y el panel calcula las métricas en el cliente con funciones puras de `lib/reposicion/`.

**Tech Stack:** Next.js 15 (app router, JSX), React 19, Tailwind 3, Supabase (`@supabase/supabase-js`, service role, RLS), Node 24 `node:test`; Python 3.13 de 32 bits + `pyodbc` + `unittest` para el extractor.

**Spec:** `docs/superpowers/specs/2026-10-21-reposicion-ventas-design.md` (fase 1: `docs/superpowers/specs/2026-10-20-reposicion-design.md`).

## Global Constraints

- **Nada se sube ni se despliega.** Solo commits locales en la rama `feat/reposicion`. Nunca `git push`.
- Sin dependencias npm nuevas. Las pruebas JS son `node:test` en `tests/*.test.mjs` y corren con `npm test`.
- Toda lógica de cálculo en `lib/reposicion/` es pura (sin imports de la app), igual que `clasificar.js` y `datos.js`.
- Textos de la interfaz en español. Hay que seguir `DESIGN.md` y el estilo denso de la fase 1.
- Las fechas de ventas son cadenas `"AAAA-MM-DD"` de punta a punta y se comparan como cadenas, nunca como `Date` con zona horaria.
- Periodos: exactamente `7`, `15` y `30` días; el predeterminado es `30`. Las ventanas se cuentan desde `hasta`, inclusive: el periodo N abarca de `hasta − (N−1)` a `hasta`.
- Umbrales: `MINIMO_STOCK = 5` (ya existe), cobertura objetivo del sugerido = `30` días, "Reponer ya" = alcanza para `< 7` días, aviso de desactualizado si `hasta` tiene `> 2` días.
- Tipos A2: `11` = venta (suma) y `12` = devolución (resta). Ningún otro tipo cuenta.
- El extractor solo lee A2 (`ReadOnly=True` en la cadena ODBC); nunca escribe.
- Las ventas nunca aparecen en `/api/productos` ni en el catálogo público.

## Review Focus

1. **Tope de 1000 filas de PostgREST:** leer `ventas_diarias`, o `productos` cuando pasen de 1000, sin paginar devuelve datos cortados sin error. Se espera que la lectura pagine (lo cubre la Tarea 3).
2. **Carga vacía o de otra empresa:** una carga sin filas válidas no debe borrar las ventas buenas. Se espera un 400 y que no se reemplace nada (la prueba de validación está en la Tarea 1).
3. **Unidades raras:** con decimales, con negativos en días de devolución o un periodo cuyo neto da negativo. Se espera que vendidos sea ≥ 0 y que la página nunca muestre `NaN` (pruebas en la Tarea 2).
4. **"Sin datos" no es lo mismo que "cero ventas":** si nunca se cargaron ventas, se ve el aviso y no hay filtros de ventas; si ya hay carga, un producto sin filas tiene 0 vendidos y cuenta en "Sin movimiento" (pruebas en las Tareas 2 y 3).
5. **Fechas:** un `hasta` en el futuro, fechas fuera de la ventana o mal formadas. Se espera que se descarten o rechacen y no corran las ventanas (pruebas en la Tarea 1).

---

### Task 1: Recepción de ventas (migración + validación + ruta)

**Files:**
- Create: `db/08_ventas_diarias.sql`
- Create: `lib/reposicion/ventas.js`
- Create: `app/api/sync-ventas/route.js`
- Test: `tests/reposicion-ventas.test.mjs`

**Interfaces:**
- Produces:
  - La tabla `public.ventas_diarias(codigo text not null, fecha date not null, unidades numeric not null, primary key (codigo, fecha))`.
  - La tabla `public.ventas_corte(id int primary key default 1 check (id = 1), hasta date not null, actualizado_en timestamptz not null default now())`.
  - Las dos tablas con RLS activado y **sin políticas**.
  - La función `public.reemplazar_ventas(p_hasta date, p_filas jsonb) returns integer`. En una sola transacción borra todo `ventas_diarias`, inserta `p_filas` (arreglo de `{codigo, fecha, unidades}`), hace upsert de `ventas_corte` (id 1, `hasta = p_hasta`, `actualizado_en = now()`) y devuelve cuántas filas insertó. `revoke execute ... from public, anon, authenticated`.
  - `validarCargaVentas(cuerpo, hoyStr) -> { ok: true, hasta, filas, descartadas } | { ok: false, error }` en `lib/reposicion/ventas.js`, donde `filas: {codigo, fecha, unidades}[]` y `descartadas: {codigo, motivo}[]`.
  - Las utilidades de fecha `sumarDias(fechaStr, n) -> string` y `esFechaValida(fechaStr) -> boolean`, exportadas en el mismo archivo para las Tareas 2 y 3.
- Consumes: `dentroDeLimite(clave, limite, ventana)` de `lib/rateLimit.js` y `getServiceClient()` de `lib/supabase.js`. Copiar el patrón de IP, secreto y rate limit de `app/api/sync/route.js`.

Reglas de `validarCargaVentas`:
- `cuerpo` debe ser un objeto con `hasta` (`"AAAA-MM-DD"` válido) y `filas` (arreglo de hasta 50000 elementos).
- `hasta` no puede ser posterior a `hoyStr + 1 día`.
- Por fila:
  - `codigo` en `String().trim()`, no vacío y de 64 caracteres o menos;
  - `fecha` válida dentro de `[hasta − 29, hasta]`;
  - `unidades` numérico finito con `|u| ≤ 10000000`.
- Una fila inválida va a `descartadas` con su motivo, y el resto sigue.
- Si dos filas tienen el mismo `(codigo, fecha)`, se suman en una sola.
- Si no queda ninguna fila válida, devuelve `{ ok: false, error: "La carga llegó vacía o sin filas válidas; no se aplicó nada." }`.

- [ ] **Step 1: Write the failing tests** en `tests/reposicion-ventas.test.mjs`, con `hoyStr = "2026-10-21"`:
  - `sumarDias("2026-03-01", -1) === "2026-02-28"` y `sumarDias("2026-12-31", 1) === "2027-01-01"`;
  - `esFechaValida("2026-02-30") === false`, `esFechaValida("2026-10-21") === true` y `esFechaValida("21/10/2026") === false`;
  - una carga válida `{hasta:"2026-10-21", filas:[{codigo:" A1 ", fecha:"2026-10-20", unidades:2}, {codigo:"A1", fecha:"2026-10-20", unidades:-1}]}` da `ok` con `filas` deepEqual `[{codigo:"A1", fecha:"2026-10-20", unidades:1}]`;
  - una fila con `fecha:"2026-09-21"` (fuera de la ventana: `hasta − 30`) se descarta, y `"2026-09-22"` se acepta;
  - se descartan el código vacío, `unidades:"abc"` y `unidades: 1e8`;
  - `hasta:"2026-10-23"` da `ok:false`, y `"2026-10-22"` da `ok:true`;
  - `filas:[]` y una carga con todas las filas inválidas dan `ok:false` con el mensaje exacto;
  - un cuerpo que no es objeto, `filas` que no es arreglo y `hasta` ausente dan `ok:false`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL, porque el módulo no existe.
- [ ] **Step 3: Implement** `lib/reposicion/ventas.js`. Las fechas se manejan con `Date.UTC` sobre las partes de la cadena, para que no dependan de la zona horaria.
- [ ] **Step 4: Run** `npm test`. Expected: PASS, con todas las pruebas anteriores todavía en verde.
- [ ] **Step 5: Write** `db/08_ventas_diarias.sql`, con el estilo y los comentarios de `db/07_usuarios_reposicion.sql`. Debe ser idempotente (`if not exists`, `create or replace`) e incluir un comentario de cabecera: "Correr en Supabase antes de desplegar la fase 2".
- [ ] **Step 6: Implement** `app/api/sync-ventas/route.js` (POST), en este orden:
  1. rate limit `sync-ventas:${ip}` con los mismos 60 por 60 s que `/api/sync`, respondiendo 429;
  2. `Bearer` igual a `SYNC_SECRET`; si no coincide, 401 "No autorizado";
  3. JSON inválido, 400;
  4. `validarCargaVentas(cuerpo, hoy)`, donde `hoy` es la fecha UTC del servidor (el margen de +1 día cubre la diferencia horaria). Si falla, 400 `{error}`;
  5. `rpc("reemplazar_ventas", { p_hasta, p_filas })`; si hay error, 500 `{error: mensaje}`;
  6. 200 `{ ok:true, hasta, guardadas, descartadas: n, detalle_descartadas: primeras 50 }`.

  `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
- [ ] **Step 7: Verify** `npm run build`. Expected: compila sin errores.
- [ ] **Step 8: Commit** `feat(reposicion): recepción de ventas por día (db/08 + /api/sync-ventas)`.

### Task 2: Métricas de ventas, filtros y orden

**Files:**
- Create: `lib/reposicion/metricas.js`
- Modify: `lib/reposicion/clasificar.js`
- Test: `tests/reposicion-metricas.test.mjs` (y agregar casos a `tests/reposicion-clasificar.test.mjs`)

**Interfaces:**
- Consumes: `sumarDias` de `lib/reposicion/ventas.js` y `estadoDe` y `MINIMO_STOCK` de `clasificar.js`.
- Produces (en `metricas.js`):
  - `PERIODOS = [7, 15, 30]`, `PERIODO_PREDETERMINADO = 30`, `COBERTURA_OBJETIVO_DIAS = 30`, `UMBRAL_REPONER_DIAS = 7`, `DIAS_DESACTUALIZADO = 2`.
  - `totalesPorCodigo(filas, hasta) -> Map<codigo, { u7, u15, u30, ultima }>`. Cada `uN` es la suma de `unidades` de las filas con `fecha` en la ventana N, **sin** recortar a 0, porque eso se hace al mostrar. `ultima` es la `fecha` máxima con `unidades > 0`, o `null`. Las filas fuera de `[hasta−29, hasta]` se ignoran.
  - `metricasDe(producto, periodo) -> { vendidos, alcanzaDias, sugerido, ultima } | null`. Devuelve `null` si `producto.ventas == null` (no hay datos de ventas cargados). El objeto `producto.ventas` es `{ u7, u15, u30, ultima }`. Las reglas son:
    - `vendidos = max(0, ventas["u" + periodo])`;
    - `alcanzaDias`: `null` si `vendidos <= 0`; `0` si `disponible <= 0`; en otro caso `floor(disponible / (vendidos / periodo))`;
    - `sugerido`: `null` si `vendidos <= 0`; en otro caso `max(MINIMO_STOCK, ceil(vendidos / periodo * COBERTURA_OBJETIVO_DIAS)) − max(0, disponible)`, que pasa a `null` si da `<= 0`;
    - `ultima = ventas.ultima`.
  - `diasDesde(hasta, hoyStr) -> number`: días enteros entre las dos fechas.
- Modifies `clasificar.js` (sin cambiar el comportamiento existente):
  - `FILTROS` suma `"mas_vendidos"`, `"reponer_ya"` y `"sin_movimiento"`, y `ORDENES` suma `"vendidos_desc"` y `"alcanza_asc"`.
  - `filtrarYOrdenar(productos, { ..., periodo = 30 }, ahoraMs)`:
    - `mas_vendidos`: `vendidos > 0`;
    - `reponer_ya`: `estadoDe(p) !== "a_consultar"`, `vendidos > 0` y `alcanzaDias < 7`;
    - `sin_movimiento`: `estadoDe(p) !== "a_consultar"`, `p.disponible > 0`, `p.ventas != null` y `p.ventas.u30 <= 0`;
    - con `metricasDe === null`, ninguno de los tres filtros incluye el producto;
    - `vendidos_desc`: vendidos de mayor a menor, con los productos sin métricas como 0 y empate por nombre;
    - `alcanza_asc`: `alcanzaDias` de menor a mayor, con `null` al final y empate por nombre.
  - `resumen(productos, ahoraMs, periodo = 30)` suma los conteos `mas_vendidos`, `reponer_ya` y `sin_movimiento` con las mismas reglas, sin tocar `porDepartamento`.

- [ ] **Step 1: Write the failing tests** en `tests/reposicion-metricas.test.mjs`:
  - `totalesPorCodigo` con `hasta = "2026-10-21"` y filas de A1 el 21-10 (2), el 15-10 (3), el 07-10 (4) y el 22-09 (5), más una fila del 21-09 que se ignora. Expected: `u7 = 2`, `u15 = 2 + 3 + 4 = 9` (la ventana de 15 empieza el 07-10), `u30 = 14` y `ultima = "2026-10-21"`.
  - Una fila negativa: B1 con +1 el 20-10 y −3 el 21-10. Expected: `u7 = −2` y `ultima = "2026-10-20"`. `metricasDe` da `vendidos = 0`, `alcanzaDias = null` y `sugerido = null`.
  - `metricasDe({disponible: 10, ventas: {u7: 7, u15: 15, u30: 30, ultima: "2026-10-21"}}, 30)`: `vendidos = 30`, `alcanzaDias = 10` y `sugerido = max(5, 30) − 10 = 20`.
  - Con `disponible: 0` y el periodo 7: `alcanzaDias = 0` y `sugerido = 30`.
  - Con `disponible: 100` y `u30: 3`: `sugerido = null`, porque `max(5, 3) − 100 < 0`.
  - Con `disponible: 1` y `u30: 1`: `sugerido = 4`, porque `max(5, 1) − 1`.
  - Con unidades decimales (`u30: 1.5`, `disponible: 3`): `alcanzaDias = 60` y `sugerido = 3`.
  - `metricasDe` con `ventas: null` devuelve `null`.
  - `diasDesde("2026-10-18", "2026-10-21") === 3`.
- [ ] **Step 2: Write the failing tests** en `tests/reposicion-clasificar.test.mjs`. Usar un set de 5 productos: uno que vende rápido con poco stock, uno que vende lento con mucho stock, uno sin ventas con stock, uno a_consultar con ventas y uno con `ventas: null`. Verificar:
  - qué códigos devuelve cada filtro nuevo;
  - el orden de `vendidos_desc` y de `alcanza_asc`;
  - que `periodo: 7` cambia el resultado de `reponer_ya` frente a `30`;
  - los conteos nuevos de `resumen`;
  - que las pruebas existentes no cambian.
- [ ] **Step 3: Run** `npm test`. Expected: FAIL en las pruebas nuevas.
- [ ] **Step 4: Implement** `metricas.js` y las extensiones de `clasificar.js`.
- [ ] **Step 5: Run** `npm test`. Expected: PASS, todas.
- [ ] **Step 6: Commit** `feat(reposicion): métricas de ventas por periodo y filtros`.

### Task 3: Datos de ventas en la ruta de reposición

**Files:**
- Modify: `lib/reposicion/datos.js`, `lib/reposicion/servidor.js` y `app/r-7cdc0e670a66b2d0f9dc/datos/route.js`
- Create: `ventas.ejemplo.json` (en la raíz, junto a `inventario.json`)
- Test: `tests/reposicion-datos.test.mjs` (agregar casos)

**Interfaces:**
- Consumes: `totalesPorCodigo` y `sumarDias` de las Tareas 1 y 2.
- Produces:
  - `unirVentas(productos, totales) -> productos`, pura y en `datos.js`. `totales` es `Map | null`. Con `null`, cada producto queda con `ventas: null`. Con un `Map`, cada producto queda con `ventas = totales.get(codigo.trim()) ?? { u7: 0, u15: 0, u30: 0, ultima: null }`. Devuelve objetos nuevos, sin mutar la entrada.
  - `desplazarAHoy(carga, hoyStr) -> carga`, pura y en `datos.js`: mueve `hasta` y todas las `fecha` la misma cantidad de días, para que `hasta === hoyStr`.
  - `obtenerVentasReposicion() -> Promise<{ hasta, totales: Map } | null>` en `servidor.js`:
    - **en modo local**, lee `ventas.ejemplo.json`, le aplica `desplazarAHoy` con la fecha local de hoy y luego `totalesPorCodigo`. Si el archivo no existe, devuelve `null`;
    - **con Supabase**, lee `ventas_corte` (id 1; si no hay fila, devuelve `null`) y todas las filas de `ventas_diarias`, **paginando con `.range()` en bloques de 1000** hasta que un bloque llegue incompleto.
  - `obtenerProductosReposicion()` también pagina con el mismo helper (*ruling*: arregla el tope latente de 1000 filas de la fase 1, porque hoy hay unos 588 productos).
  - `GET .../datos` responde `{ productos, ventas: { hasta } | null }`, con `productos` ya pasados por `unirVentas`. Si falla la lectura de ventas, se registra el error y responde con `ventas: null`, para que la página de stock siga funcionando.
- `ventas.ejemplo.json` tiene la forma de una carga `{ "nota": "DATOS INVENTADOS SOLO PARA PROBAR EN LOCAL", hasta, filas }`. Se genera una vez con un script descartable (el script no se versiona). Debe traer entre 40 y 80 códigos reales de `inventario.json` con `PUBLICAWEB` en true, repartidos en cuatro grupos:
  - unos que venden casi a diario;
  - unos de ventas esporádicas;
  - al menos 3 con poco disponible y ventas altas, para que aparezca "Reponer ya";
  - al menos 1 código a_consultar con ventas.

  Además lleva al menos una fila con unidades negativas (una devolución) y fechas dentro de los 30 días anteriores a `hasta`.

- [ ] **Step 1: Write the failing tests** (`unirVentas` y `desplazarAHoy`):
  - `unirVentas` con `null` devuelve todos los productos con `ventas: null`;
  - con un `Map` que tiene `"A1"`, el código `"A1 "` lo encuentra y un código ausente recibe ceros;
  - la entrada no se muta;
  - `desplazarAHoy({hasta:"2026-10-01", filas:[{codigo:"A", fecha:"2026-09-30", unidades:1}]}, "2026-10-21")` da `hasta:"2026-10-21"` y la fecha `"2026-10-20"`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** las funciones puras, después `servidor.js` y la ruta, y genera `ventas.ejemplo.json`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Verify** en local, sin `.env`:
  1. `npm run dev`;
  2. entra con `prueba` / `prueba-local-123` llamando a `POST /r-7cdc0e670a66b2d0f9dc/sesion` con un cuerpo JSON (curl con cookie jar);
  3. `GET /r-7cdc0e670a66b2d0f9dc/datos` responde 200, `ventas.hasta` es la fecha de hoy y algún producto trae `ventas.u30 > 0`;
  4. sin la cookie, la misma ruta responde 401.

  Detén el servidor al terminar.
- [ ] **Step 6: Commit** `feat(reposicion): ventas en la ruta de datos (con ejemplo local y paginación)`.

### Task 4: Panel — periodo, métricas, filtros y cifras

**Files:**
- Modify: `components/reposicion/PanelReposicion.jsx` (y extraer un componente hijo en `components/reposicion/` si el archivo pasa de unas 450 líneas)

**Interfaces:**
- Consumes:
  - `{ productos, ventas }` de la ruta de datos (Tarea 3);
  - `filtrarYOrdenar(..., { periodo })` y `resumen(..., periodo)` de la Tarea 2;
  - `metricasDe`, `PERIODOS`, `PERIODO_PREDETERMINADO`, `diasDesde` y `DIAS_DESACTUALIZADO` de `metricas.js`.
- Produces: la UI. No la consume ningún otro código.

Requisitos (del spec, metas 1–6):
- **Selector de periodo** "Semana" / "15 días" / "Mes", con Mes marcado de entrada. Al lado, "Ventas al DD/MM/AAAA". Si `diasDesde(hasta, hoy) > 2`, se muestra en color de alerta un aviso de que las ventas están desactualizadas.
- **Tarjetas tocables nuevas:** "Reponer ya", "Más vendidos" y "Sin movimiento", con los conteos del periodo. Al tocar una se aplica su filtro.
- **Chips de filtro nuevos y órdenes nuevos:** "Más vendidos" y "Se acaba antes". Al elegir el filtro "Más vendidos", el orden pasa a "Más vendidos".
- **En cada fila, dentro del formato denso actual:**
  - vendidos del periodo (hasta 2 decimales, sin ceros de sobra);
  - "alcanza N d", o "—" si no vendió;
  - última venta en DD/MM, o "sin ventas en 30 días";
  - "pedir N", solo si `sugerido` no es null.
  - Un producto a_consultar muestra vendidos y última venta, pero no "alcanza" ni "pedir".
- **Con `ventas === null`:** se ve el aviso "Aún no hay ventas cargadas" y no aparecen el selector ni los chips, tarjetas u órdenes de ventas. Todo lo de la fase 1 funciona igual.
- A 360 px de ancho no debe haber scroll horizontal.

- [ ] **Step 1: Implement** según los requisitos, leyendo antes `DESIGN.md` y el panel actual.
- [ ] **Step 2: Run** `npm test` y `npm run build`. Expected: PASS y compila.
- [ ] **Step 3: Verify** `ventas: null`: renombra temporalmente `ventas.ejemplo.json`, carga la página en local, comprueba que sale el aviso y que el panel de stock funciona, y restaura el archivo. Puede ser con curl y el HTML renderizado, o como permita el entorno. La verificación visual completa en navegador la hace el controlador después.
- [ ] **Step 4: Commit** `feat(reposicion): panel con ventas por periodo, filtros y cifras`.

### Task 5: Extractor de ventas + guía de despliegue

**Files:**
- Create: `scripts/extraer_ventas.py`
- Create: `scripts/config_ventas.ejemplo.ini`
- Create: `tests/test_extraer_ventas.py`
- Modify: `.gitignore` (agregar `scripts/config_ventas.ini`, `scripts/exportaciones/`, `scripts/logs/` y `ventas_*.json`)
- Modify: `docs/reposicion-despliegue.md` y `README.md` (una sección corta sobre el extractor de ventas)

**Interfaces:**
- Consumes: el contrato `POST /api/sync-ventas` de la Tarea 1, con `Authorization: Bearer <SYNC_SECRET>` y cuerpo `{ hasta, filas: [{codigo, fecha, unidades}] }`.
- Produces: `agregar(filas_sql, hasta: date) -> list[dict]`, pura y sin pyodbc.
  - Cada `filas_sql` es una tupla `(codigo, fecha: date, tipo: int, unidades: float)`.
  - Devuelve `[{ "codigo": str.strip(), "fecha": "AAAA-MM-DD", "unidades": float }]` con este cálculo:
    - el tipo 11 suma y el tipo 12 resta; cualquier otro tipo se ignora;
    - se descartan las filas fuera de `[hasta − 29 días, hasta]`;
    - se agrupa por `(codigo, fecha)`;
    - se omiten los netos iguales a 0;
    - se redondea a 4 decimales;
    - se ordena por `(codigo, fecha)`.

Comportamiento del script:
- Toma el estilo de `C:\Claude\Taxfree-Catalogo\scripts\extractor_taxfree.py`: config, logging, `ruta_absoluta` y conexión. Léelo, pero no lo modifiques.
- Importa `pyodbc` **dentro** de la función de conexión, para que las pruebas corran sin el driver.
- La cadena ODBC siempre lleva `ReadOnly=True` y se arma desde `[CONEXION]`, igual que Taxfree (`dsn` y/o `carpeta_datos`, más `user`/`password` opcionales).
- Consulta probada contra la base de laboratorio:
  ```sql
  SELECT FDI_CODIGO, FDI_FECHAOPERACION, FDI_TIPOOPERACION, SUM(FDI_CANTIDAD)
  FROM SDetalleVenta
  WHERE FDI_FECHAOPERACION >= '<hasta-29 en AAAA-MM-DD>' AND FDI_TIPOOPERACION IN (11,12)
  GROUP BY FDI_CODIGO, FDI_FECHAOPERACION, FDI_TIPOOPERACION
  ```
  DBISAM **no** soporta `TOP` ni `COUNT(DISTINCT)`.
- `hasta` es `date.today()` en la PC de la tienda.
- Siempre guarda `exportaciones/ventas_<AAAA-MM-DD_HHMMSS>.json` con la carga.
- `--solo-archivo` termina ahí, sin enviar. Sin esa opción, hace POST a `[WEB] api_url` con un timeout de 60 s.
- Si `agregar` da una lista vacía, registra una advertencia, **no envía** y sale con código 2.
- Un error de conexión o de HTTP se registra y sale con código 1, sin reintentos.
- `--config` es opcional; por defecto usa `config_ventas.ini` junto al script.
- `config_ventas.ejemplo.ini`:
  - `api_url = http://localhost:3000/api/sync-ventas`;
  - `sync_secret = <PEGAR_SYNC_SECRET>`;
  - `carpeta_datos` de ejemplo con la ruta de la tienda;
  - comentarios en español, como el de Taxfree.

- [ ] **Step 1: Write the failing tests** `tests/test_extraer_ventas.py` (`unittest`, con un import vía `importlib` desde `scripts/`):
  - tipo 11 con +3 y tipo 12 con −1 el mismo código y día dan neto 2;
  - el tipo 13 se ignora;
  - `" A1 "` y `"A1"` se agrupan;
  - una fila de `hasta − 30` se descarta y la de `hasta − 29` se queda;
  - un neto de 0 se omite;
  - la fecha sale como `"AAAA-MM-DD"`;
  - la salida viene ordenada.
- [ ] **Step 2: Run** `py -3-32 -m unittest discover -s tests -p "test_*.py"`. Expected: FAIL.
- [ ] **Step 3: Implement** `extraer_ventas.py` y el `.ini` de ejemplo.
- [ ] **Step 4: Run** el mismo comando. Expected: PASS. Corre también `npm test`, que debe seguir en verde.
- [ ] **Step 5: Verify** contra la base de laboratorio: crea `scripts/config_ventas.ini` (ignorado) con `carpeta_datos = C:\A2\A2imprimete\Empre001\Data` y corre `py -3-32 scripts/extraer_ventas.py --solo-archivo`. Expected: código de salida 0 y un JSON en `scripts/exportaciones/` con `hasta` de hoy. Puede traer 0 filas si en el laboratorio no hay ventas en 30 días; en ese caso el código de salida es 2 y queda anotado en el reporte. No se envía nada a ningún servidor. Borra el `config_ventas.ini` y las exportaciones al terminar.
- [ ] **Step 6: Update** `docs/reposicion-despliegue.md`, en español sencillo como el resto de la guía:
  - sección "Fase 2: ventas" con este orden: correr `db/08` en Supabase, desplegar, instalar Python de 32 bits + `pip install pyodbc requests` en la PC de la tienda (o solo `pyodbc` si el script usa `urllib`), copiar el `.ini`, probar con `--solo-archivo`, cambiar `api_url` a la de producción y programar la tarea después del export de inventario;
  - la lista de la primera corrida: comparar 3–5 productos contra el reporte de ventas por producto de A2 para 7 y 30 días, uno con devolución y uno vendido por caja o paquete si existe.

  En `README.md`, agrega una línea en la estructura y una sección corta.
- [ ] **Step 7: Commit** `feat(reposicion): extractor de ventas de A2 y guía de la fase 2`.
