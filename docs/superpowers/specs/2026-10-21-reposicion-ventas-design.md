# Reposición fase 2: ventas por periodo — diseño

Fecha: 2026-10-21 · Estado: borrador para aprobación · Sigue a
`2026-10-20-reposicion-design.md` (fase 1, ya construida en `feat/reposicion`).

## Por qué

El encargado de reponer decide mirando **cuánto se vendió y en qué periodo**: con eso
repone lo que se acaba o aumenta la existencia de lo que se mueve más. La fase 1 le
muestra el stock (agotados, sin existencias, bajo), pero no las ventas. El usuario pidió
métricas con filtro de **semana, 15 días y mes**, y dejó el resto a criterio de Claude
("toma tú la mejor recomendación").

## Lo que se averiguó de A2 (consultado en solo lectura)

- **`SDetalleVenta`**: una línea por producto vendido. Campos que se usan:
  - `FDI_CODIGO`: el mismo código que `CODIGO` del inventario.
  - `FDI_CANTIDAD`: unidades por línea (puede tener decimales).
  - `FDI_FECHAOPERACION`: fecha de la operación.
  - `FDI_TIPOOPERACION`: `11` = venta, `12` = devolución de venta. **Confirmado por el
    usuario (2026-10-21):** al devolver o anular, la línea de la venta original **no
    desaparece**; queda como tipo 11 y la devolución se guarda aparte con otro tipo (12).
    Por eso vendidos netos = tipo 11 − tipo 12, cada uno en su propia fecha.
- `SOperacionInv` es la cabecera y no hace falta para esto. Hay otros tipos que
  **no** cuentan:
  - `6`: pedidos o pendientes.
  - `13`: notas de entrega. **Confirmado por el usuario (2026-10-21):** en la tienda
    las notas de entrega se facturan después, y esa factura ya llega como tipo 11.
    Contarlas duplicaría la venta, así que solo cuentan las facturas.
- Conexión: driver ODBC DBISAM 4 de **32 bits**, igual que el extractor de inventario
  (en Taxfree es `extractor_taxfree.py`: Python de 32 bits + `pyodbc` + `config.ini`).
- La base `C:\A2\A2imprimete` de la PC de desarrollo **no tiene datos de Imprimete**: es
  de prueba, con ropa, y ningún código coincide con el catálogo. Sirve para probar que la
  consulta corre, no para validar números. Los números se validan con el A2 real de la
  tienda en la primera corrida (ver "Verificación").

## Metas

1. **Periodos 7 / 15 / 30 días.** En la página de reposición, un selector de tres
   botones: "Semana", "15 días", "Mes". **Mes** es el predeterminado. El periodo
   elegido gobierna todas las métricas de ventas de la página.
2. **Por producto** (en cada fila, además de lo que ya muestra la fase 1):
   - **Vendidos**: unidades netas del periodo (ventas − devoluciones), mínimo 0.
   - **Alcanza para**: días estimados hasta acabarse =
     `disponible ÷ (vendidos ÷ días del periodo)`. Se muestra "—" si no vendió nada en el
     periodo, y "0 días" si el disponible es ≤ 0. Se redondea hacia abajo.
   - **Última venta**: fecha de la última venta registrada en los 30 días cargados, o
     "sin ventas en 30 días".
   - **Sugerido a pedir** (*decisión de Claude*): lo que falta para cubrir **30 días** al
     ritmo del periodo elegido, sin bajar del mínimo de 5:
     `max(5, ceil(vendidos ÷ días × 30)) − disponible`. Solo se muestra si es > 0 y el
     producto vendió en el periodo. Es una guía, no un pedido automático.
3. **Filtros nuevos** (botones, junto a los de la fase 1):
   - **Más vendidos**: vendió > 0 en el periodo. Al elegirlo, el orden pasa a "más
     vendidos".
   - **Reponer ya** (*decisión de Claude*): vendió > 0 en el periodo **y** alcanza para
     **menos de 7 días** (incluye disponible ≤ 0). Es la lista corta de urgencias.
   - **Sin movimiento** (*decisión de Claude*): disponible > 0 y **ninguna venta en 30
     días**. Sirve para no aumentar existencias de lo que no rota.
   - Los productos "A CONSULTAR" de la fase 1 sí muestran sus ventas (son servicios que
     se venden), pero no entran en "Reponer ya" ni en "Sin movimiento", porque no tienen
     existencia confiable.
4. **Órdenes nuevos**: "Más vendidos" (vendidos desc) y "Se acaba antes" (alcanza para
   asc; los que no vendieron van al final).
5. **Cifras arriba**: se suman tarjetas tocables "Reponer ya", "Más vendidos" y "Sin
   movimiento", con el conteo según el periodo elegido. Junto al selector se muestra
   **"Ventas al <fecha>"**. Si esa fecha tiene más de 2 días, se muestra un aviso visible
   de que las ventas están desactualizadas.
6. **Sin datos de ventas** (todavía no se corrió el extractor): la página de la fase 1
   funciona igual. En lugar de las métricas aparece el aviso "Aún no hay ventas
   cargadas" y los filtros de ventas no aparecen.

## Cómo llegan las ventas

- **Extractor nuevo `scripts/extraer_ventas.py`** en este repo, mismo estilo que el de
  Taxfree: Python de 32 bits, `pyodbc`, `config.ini` (con su `config.ejemplo.ini`
  versionado y el real ignorado por git). Corre en la PC de la tienda con el Programador
  de tareas, después del export de inventario (ej. una vez al día o varias).
- Lee los **últimos 30 días** de `SDetalleVenta` (tipos 11 y 12), agrupa por código y
  fecha, y manda unidades netas por día: `{ hasta: "AAAA-MM-DD", filas: [{ codigo,
  fecha, unidades }] }`. `hasta` es la fecha del día de la corrida en la PC de la tienda.
  La consulta es **solo lectura** (`ReadOnly=True`), nunca escribe en A2.
- **Ruta nueva `POST /api/sync-ventas`**, protegida con el mismo `SYNC_SECRET` y el
  mismo rate limit que `/api/sync` (*decisión de Claude*: es el mismo nivel de
  confianza, la misma PC, y no agrega otro secreto que administrar). Valida cada fila
  (código no vacío, fecha válida dentro de los 30 días anteriores a `hasta`, unidades
  numéricas finitas en un rango razonable) y descarta las inválidas listándolas en la
  respuesta, igual que `/api/sync`.
- La ruta **reemplaza** la foto de ventas: lo que llega es la verdad de esos 30 días. Así
  una devolución o una corrección en A2 se refleja en la siguiente corrida.
- **Tabla nueva `ventas_diarias`** (migración `db/08_...sql`): `codigo`, `fecha`,
  `unidades` (numérico, puede ser negativo en un día con devoluciones), clave
  `(codigo, fecha)`. Más el dato de `hasta` de la última carga (en una fila de una tabla
  chica o donde convenga al constructor). RLS activado **sin políticas**: solo el
  servidor la lee con service role, igual que `usuarios_reposicion`.
- Las ventas **nunca** se exponen en `/api/productos` ni en el catálogo público. Solo
  las ve la ruta protegida de la página de reposición (la de datos de la fase 1, que
  verifica sesión en cada petición), que agrega las ventas a cada producto.
- **Modo local** sin Supabase: la ruta de datos lee un `ventas.ejemplo.json` versionado,
  con ventas **inventadas** sobre códigos reales del `inventario.json`, para probar la
  página en local. Se rotula como datos de ejemplo en el propio archivo. Nunca se usa en
  producción.

## Cálculo (dónde vive)

Todo el cálculo de periodos, "alcanza para", sugerido y filtros vive en JavaScript en
`lib/reposicion/` con pruebas `node:test`, como la fase 1. El extractor solo agrupa por
código y día; no decide nada. Las ventanas se cuentan desde `hasta`, no desde la hora del
servidor: "Semana" = las fechas de `hasta − 6` a `hasta`, inclusive (7 días), y lo mismo
para 15 y 30.

## Fuera de alcance

- Gráficos por día, comparaciones entre periodos, tendencias, periodos de 60/90 días.
- Ventas por monto (dinero); se trabaja en unidades.
- Pedidos a proveedores o exportar a Excel/PDF.
- Cambios al catálogo público o a `/api/sync`.
- **Nada se sube a GitHub ni se despliega** (igual que la fase 1) hasta que el usuario lo
  confirme.

## Lo que la haría un fracaso

- Que las ventas o cualquier dato interno se vean sin sesión, o en el catálogo público.
- Que el extractor escriba o bloquee algo en A2.
- Que los vendidos no cuadren con el reporte de ventas por producto de A2 para el mismo
  rango de fechas.
- Que una carga de ventas mala (vacía, de otra empresa) borre las ventas buenas sin
  aviso: una carga **sin filas** no reemplaza nada y responde error, igual que
  `/api/sync`.
- Que la página se vuelva lenta o confusa en el teléfono por agregar columnas: las
  métricas nuevas tienen que caber en la fila densa de la fase 1.

## Verificación

- Pruebas `node:test` para el cálculo y la validación de la ruta.
- Prueba en Chrome en local con `ventas.ejemplo.json`: periodos, filtros, órdenes,
  cifras, aviso de desactualizado, 360 px sin scroll horizontal, y sin sesión → 401.
- El extractor se prueba contra la base de laboratorio `C:\A2\A2imprimete` (solo
  lectura) para confirmar que la consulta corre y que el JSON sale bien formado, sin
  mandarlo a ningún servidor (modo "solo generar archivo").
- **Pendiente para la tienda**: en la primera corrida real, comparar los vendidos de 3–5
  productos contra el reporte de ventas de A2 del mismo rango. Lo confirma el usuario.

## Decisiones tras la revisión (*decisiones de Claude*)

- **Unidades:** `FDI_CANTIDAD` se toma en la misma unidad que la existencia. Los combos y
  servicios ya caen en "A CONSULTAR" y no entran en "Reponer ya". Esto se confirma en la
  lista de la primera corrida.
- **Códigos:** se recortan los espacios en los dos lados antes de cruzarlos. Se guardan
  todas las filas de ventas, aunque el código no esté publicado. El cruce simplemente
  ignora las que no tienen producto.
- **Carga vacía:** se rechaza, igual que en `/api/sync`. Que la tienda no venda nada en
  30 días es mucho menos probable que una consulta que falló, así que la página sigue
  mostrando la última fecha buena y el aviso de desactualizado.
- **A2 en horario de trabajo:** la lectura pasa por `a2Server`, que ordena el acceso, y
  es de solo lectura y corta (30 días agrupados). Se recomienda correrla fuera de las
  horas pico o un par de veces al día, con un tiempo máximo de consulta. Si falla, no
  reintenta en bucle: registra el error en el log y termina.
- **Destino del extractor:** tiene un modo "solo generar archivo" que no manda nada. En
  `config.ejemplo.ini` la URL apunta a `http://localhost:3000/api/sync-ventas`. La URL de
  producción se pone solo cuando el usuario decida subir.
- **Fechas de `ventas.ejemplo.json`:** en modo local se desplazan al cargar, para que
  `hasta` sea hoy. Así los periodos y el aviso de desactualizado se pueden probar
  cualquier día.
- **Lista para la primera corrida en la tienda** (va en la guía de despliegue):
  - comparar 3–5 productos contra el reporte de ventas por producto de A2 para 7 y 30
    días;
  - revisar un producto que haya tenido una devolución;
  - revisar uno vendido por caja o paquete, si existe.

## A criterio del constructor

- Layout exacto de las métricas en la fila y de las tarjetas.
- Si el periodo se guarda en la URL o en estado.
- Nombres de archivos y la forma de guardar `hasta`.
- Textos de botones y estados vacíos.
