# Reposición: rediseño visual compacto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que en el teléfono la página de reposición muestre productos al abrir: fila compacta con barra de color, foto, métricas en negrita y "pedir" grande; arriba, píldoras-filtro con su número, una línea de buscador/periodo/Filtros y un panel inferior para lo poco usado; abre en "Reponer ya".

**Architecture:** La lógica nueva (desempate del orden, color de urgencia, valores iniciales) va en `lib/reposicion/clasificar.js` como funciones puras con `node:test`. La fila se rehace en `components/reposicion/FilaProducto.jsx`; la parte de arriba en `PanelReposicion.jsx`, y el panel inferior en un componente nuevo `components/reposicion/PanelFiltros.jsx`. Ni rutas, ni datos, ni fórmulas cambian.

**Tech Stack:** Next.js 15 (app router, JSX), React 19, Tailwind 3, lucide-react, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-21-reposicion-visual-design.md`

## Global Constraints

- Solo presentación: fórmulas (`metricasDe`), filtros, `resumen`, rutas, sesión y seguridad no cambian, salvo el desempate de `alcanza_asc` y los valores iniciales de filtro/orden.
- Colores de `tailwind.config.js`: `brand-navy`, `brand-magenta` (solo barras/bordes), `brand-magentaDeep` (texto magenta), `brand-amber`, `brand-cyan`, `ink`, `ink-muted`, `ink-faint`, `paper`, `paper-dim`, `paper-line`. El texto en color debe leer ≥ 4.5:1 sobre su fondo (usar `magentaDeep`; para ámbar sobre fondo claro, un tono oscuro como `#7a5c00`, agregarlo a `brand` como `amberDeep` si hace falta).
- Texto ≥ 12 px (`text-xs` es 12 px; no usar `text-[11px]` ni menores en lo nuevo). Píldoras y botones tocables ≥ 40 px de alto.
- 360 px de ancho sin scroll horizontal; en pantallas anchas, el mismo diseño dentro de `max-w-3xl`.
- Imágenes: `<img loading="lazy">` normal (no `next/image`); `p.imagen` es URL completa o `null`.
- Textos en español, como el resto de la página.
- Nada se sube a GitHub ni se despliega. Commits solo locales en `feat/reposicion`.
- Pruebas: `npm test` (todas deben seguir pasando, hoy 59) y `npm run build`.

## Review Focus

- Producto agotado **sin** ventas cargadas: la barra sigue magenta y no aparece caja "pedir".
- Producto que no está en el archivo de ventas con ventas cargadas: caja "—" y `vend 0`, no error.
- Imagen que falla (404): se reemplaza por el cuadro gris sin mover la fila.
- Filtro escondido: departamento elegido o "Nuevos" activo → punto en "Filtros" y ninguna píldora marcada para Nuevos.
- Recarga sin ventas estando en "Reponer ya"/"Se acaba antes": vuelve a Todos/Menor existencia (no a nombre).

---

### Task 1: Lógica pura — desempate, urgencia y valores iniciales

**Files:**
- Modify: `lib/reposicion/clasificar.js`
- Test: `tests/reposicion-clasificar.test.mjs`

**Interfaces:**
- Consumes: `estadoDe`, `metricasDe(p, periodo)`, `FILTROS_VENTAS.reponer_ya` (interno).
- Produces:
  - `urgenciaDe(p, periodo)` → `"consultar" | "critico" | "bajo" | "ok"`. `periodo` es 7/15/30 o `null` (sin ventas cargadas).
  - `INICIAL = { conVentas: { filtro: "reponer_ya", orden: "alcanza_asc" }, sinVentas: { filtro: "todos", orden: "existencia_asc" } }` (exportado, congelado con `Object.freeze`).
  - `alcanza_asc` desempata por vendidos del periodo descendente y después por nombre.

- [ ] **Step 1: Escribir las pruebas que fallan** (agregar al final de `tests/reposicion-clasificar.test.mjs`, reutilizando `base` y `vt`):

```js
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
```

Agregar `urgenciaDe` e `INICIAL` al import del archivo de pruebas.

- [ ] **Step 2: Correr y ver que fallan**

Run: `npm test`
Expected: FAIL (`urgenciaDe` / `INICIAL` no exportados; el desempate da `["P1","P2","P3"]` o similar).

- [ ] **Step 3: Implementar en `lib/reposicion/clasificar.js`**

- En la rama `alcanza_asc`, cuando `ka === kb`, comparar `metricasDe(p, periodo)?.vendidos ?? 0` descendente y luego `porNombre`.
- `urgenciaDe(p, periodo)`: `estadoDe` a_consultar → `"consultar"`; agotado o sin_existencias → `"critico"`; si `periodo != null` y `FILTROS_VENTAS.reponer_ya(p, metricasDe(p, periodo))` → `"critico"`; bajo → `"bajo"`; si no → `"ok"`.
- `INICIAL` como en Interfaces, con `Object.freeze` en el objeto y en sus dos hijos.

- [ ] **Step 4: Correr y ver que pasan**

Run: `npm test`
Expected: PASS, 62 pruebas (59 + 3), incluida la de `alcanza_asc` existente sin cambios.

- [ ] **Step 5: Commit**

```bash
git add lib/reposicion/clasificar.js tests/reposicion-clasificar.test.mjs
git commit -m "feat(reposicion): urgencia por producto, desempate de alcanza y valores iniciales"
```

---

### Task 2: Fila compacta (opción C) con desplegado

**Files:**
- Modify: `components/reposicion/FilaProducto.jsx` (reescritura; mantener el export `ddmm`)
- Modify (si hace falta el tono): `tailwind.config.js` (`brand.amberDeep`)

**Interfaces:**
- Consumes: `urgenciaDe(p, periodo)` y `estadoDe(p)` de `clasificar.js`; `metricasDe(p, periodo)` de `metricas.js`.
- Produces: `FilaProducto({ p, periodo })` — misma firma que hoy (`periodo` = 7/15/30 o `null` cuando la página no tiene ventas). `PanelReposicion` no cambia su llamada.

- [ ] **Step 1: Reescribir la fila** según la sección "1. Fila de producto" del spec y su sección "Decisiones tras la revisión":
  - `<li>` con un `<button type="button" aria-expanded>` que ocupa toda la fila y alterna el desplegado (estado local `useState(false)`).
  - Barra izquierda de 5 px, alto completo: `critico` → `bg-brand-magenta`, `bajo` → `bg-brand-amber`, `ok` → `bg-brand-cyan`, `consultar` → gris (`bg-paper-line` o similar visible).
  - Foto 40×40 `rounded-md object-cover`, `loading="lazy"`, `alt=""`; si `p.imagen` es null o dispara `onError`, se muestra un `<div>` gris del mismo tamaño (estado local).
  - Centro: nombre `truncate` `text-sm font-semibold`; debajo, `text-xs`: 
    - agotado → **"Agotado"**, sin_existencias → **"Sin existencias"**, si no → `disp **N**`;
    - si `periodo != null` y no es a_consultar: ` · alcanza **N d**` (o `—`);
    - si `periodo != null`: ` · vend **N**` (cantidad con hasta 2 decimales, como hoy).
    - a_consultar: **"A CONSULTAR"** en lugar de la parte de stock.
    - Los números en negrita; con `critico` en `text-brand-magentaDeep`, con `bajo` en el ámbar oscuro; con `ok` en `text-ink`.
  - Derecha, solo si `periodo != null`: caja `min-w-[58px] rounded-lg text-center`; número `text-xl font-bold leading-none` y debajo "pedir" `text-xs font-semibold`. Con `m.sugerido != null` y no a_consultar → fondo `bg-brand-navy text-white`; a_consultar → "?"; si no → "—"; estas dos en gris (`bg-paper-dim text-ink-muted`).
  - Desplegado (debajo, dentro del `<li>`, alineado con el texto): precio (`$N.NN`), código, departamento, referencia (si hay), bruta, reservado (`p.pedido`), última venta (`DD/MM` con `ddmm`, o "sin ventas en 30 días"; solo si `periodo != null`). Sin dato → "—". En una grilla de 2 columnas de pares etiqueta/valor, `text-xs`.
  - Dejar de importar `StockGauge`.

- [ ] **Step 2: Verificar**

Run: `npm test` → PASS (62). Run: `npm run build` → compila sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/reposicion/FilaProducto.jsx tailwind.config.js
git commit -m "feat(reposicion): fila compacta con barra de urgencia, foto y pedir destacado"
```

---

### Task 3: Parte de arriba compactada, panel Filtros y apertura en "Reponer ya"

**Files:**
- Create: `components/reposicion/PanelFiltros.jsx`
- Modify: `components/reposicion/PanelReposicion.jsx`

**Interfaces:**
- Consumes: `INICIAL`, `FILTROS`, `ORDENES`, `filtrarYOrdenar`, `resumen` de `clasificar.js`; `PERIODOS`, `DIAS_DESACTUALIZADO`, `diasDesde` de `metricas.js`; `FilaProducto`.
- Produces: `PanelFiltros({ abierto, onCerrar, orden, ordenes, nombresOrden, onOrden, departamento, departamentos, onDepartamento, filtro, onFiltro, nuevos, porDepartamento, onDepto, cantidad })` — los nombres exactos de props quedan a criterio del implementador siempre que `PanelReposicion` sea el único que lo usa.

- [ ] **Step 1: Estado inicial y vuelta sin ventas** en `PanelReposicion.jsx`:
  - `filtro` y `orden` empiezan en `INICIAL.conVentas`.
  - En `cargar()`: si no llegan ventas y el filtro es de ventas → `INICIAL.sinVentas.filtro`; si el orden es de ventas → `INICIAL.sinVentas.orden`. Además, en la **primera** carga sin ventas (aún en los valores de `INICIAL.conVentas`), pasar a `INICIAL.sinVentas` completo.
  - Elegir "Más vendidos" sigue poniendo orden `vendidos_desc` (comportamiento actual).

- [ ] **Step 2: Reemplazar la parte de arriba** (entre `<main>` y la lista) por, en orden:
  1. **Píldoras** (`flex flex-wrap gap-2`), una por filtro en este orden: `reponer_ya, agotado, sin_existencias, bajo, mas_vendidos, sin_movimiento, a_consultar, todos` (sin ventas, se omiten las tres de ventas). Cada una: `rounded-full px-3 min-h-10`, nombre + número (`totales[f]`, y `totales.total` para Todos) en `font-mono font-semibold`. Colores: magenta claro con texto `magentaDeep` (reponer_ya, agotado, sin_existencias), ámbar claro con ámbar oscuro (bajo), azul claro con `brand-navy` (mas_vendidos), gris (resto). Activa: borde de 1.5–2 px de su color + `aria-pressed="true"`. Tocar la activa → `todos` (lógica actual de `tocarCifra`/`alternarFiltro`).
  2. **Línea de controles** (`flex gap-2`): buscador (crece), botón de periodo (solo con ventas) que es un `<select>` con estilo de botón mostrando "Semana"/"15 días"/"Mes", y botón **Filtros** (`SlidersHorizontal` de lucide + texto) con un punto `brand-magenta` cuando `departamento != null || filtro === "nuevos" || orden !== (hayVentas ? INICIAL.conVentas.orden : INICIAL.sinVentas.orden)`.
  3. **Línea de información** `text-xs`: izquierda "N productos" (`visibles.length`); derecha "ventas al DD/MM" (o, si `diasAtraso > DIAS_DESACTUALIZADO`, en `magentaDeep`: "ventas al DD/MM · N días sin actualizar"); sin ventas, los textos actuales "Aún no hay ventas cargadas" / "No se pudieron leer las ventas; intenta más tarde".
  4. La lista (sin cambios en su llamada a `FilaProducto`) y el estado vacío actual.
  - Eliminar: tarjetas `CIFRAS`/`CIFRAS_VENTAS`, la fila de botones de filtro, los tres botones de periodo, el `<details>` por departamento y los dos `<select>` de departamento/orden (pasan al panel).

- [ ] **Step 3: Crear `PanelFiltros.jsx`**: hoja inferior fija (`fixed inset-x-0 bottom-0`, `max-h-[85vh] overflow-y-auto`, esquinas superiores redondeadas) sobre un fondo `fixed inset-0 bg-ink/40`; `role="dialog" aria-modal="true" aria-label="Filtros"`. Contenido, en secciones con título `text-xs uppercase font-semibold text-ink-muted`:
  - **Ordenar por:** botones de los órdenes visibles (`aria-pressed`).
  - **Departamento:** el `<select>` actual.
  - **Otros:** botón "Nuevos (N)" que alterna `filtro` entre `nuevos` y `todos`.
  - **Resumen por departamento:** la tabla actual de la fase 1 (encabezado Agot./Sin ex./Bajo/Cons. y filas que alternan el departamento), movida tal cual.
  - Botón final "Ver N productos" (`bg-brand-navy text-white`, ancho completo) que cierra.
  - Cierra con el fondo, con Escape y con el botón final. Al abrir, foco al panel; al cerrar, foco de vuelta al botón Filtros (ref pasada desde `PanelReposicion`). Mientras está abierto, `document.body.style.overflow = "hidden"` y se restaura al cerrar.

- [ ] **Step 4: Verificar**

Run: `npm test` → PASS (62). Run: `npm run build` → compila. Limpiar imports que queden sin uso (`StockGauge` en el panel si estaba, `PackageX` se queda si el vacío lo usa).

- [ ] **Step 5: Commit**

```bash
git add components/reposicion/PanelReposicion.jsx components/reposicion/PanelFiltros.jsx
git commit -m "feat(reposicion): parte de arriba compacta con píldoras, panel de filtros y apertura en Reponer ya"
```

---

### Task 4: Verificación en el navegador (controlador)

No es de un implementador: la hace el controlador con Chrome en local (`npm run dev`, `/r-7cdc0e670a66b2d0f9dc`, `prueba` / `prueba-local-123`), a 360 px, con la lista de "Verificación" del spec, incluido el caso sin ventas (renombrar temporalmente `ventas.ejemplo.json` y restaurarlo). Lo que falle vuelve como corrección a la tarea dueña.
