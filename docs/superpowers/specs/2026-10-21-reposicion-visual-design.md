# Reposición: rediseño visual compacto — diseño

Fecha: 2026-10-21 · Estado: borrador para aprobación · Sigue a la fase 2
(`2026-10-21-reposicion-ventas-design.md`), en la misma rama local `feat/reposicion`.

## Por qué

El usuario probó la página en local y la ve bien, pero **hay que deslizar mucho para
llegar a los productos agotados o por reponer**. Hoy, en un teléfono, la parte de arriba
(periodo, 8 tarjetas de cifras, desglose por departamento, 9 botones de filtro, buscador,
departamento y orden) ocupa la pantalla entera: no se ve ningún producto sin deslizar. Las
tarjetas y los botones de filtro repiten lo mismo dos veces.

Pidió que cada producto muestre **la imagen, aunque sea pequeña**, y que **las
existencias, el disponible y lo que hay que reponer se vean más grandes y resalten en
color**, para que sea agradable, legible y sirva para decidir.

Se mostraron bocetos en el navegador. El usuario eligió la **fila "C" (lista compacta con
"pedir" a la derecha)** y la **parte de arriba "compactada"**, y pidió que la página
**abra en "Reponer ya"**.

## Metas

### 1. Fila de producto (opción C, elegida por el usuario)

De izquierda a derecha:

- **Barra de color** de unos 5 px, de alto completo, que marca la urgencia:
  - magenta: agotado, sin existencias, o "Reponer ya" (vende y alcanza < 7 días);
  - ámbar: bajo (disponible ≤ 5) y no está en el caso anterior;
  - cyan: ok;
  - gris: A CONSULTAR.
- **Foto pequeña**, unos 40 px, esquinas redondeadas, carga diferida. Si no hay imagen o
  falla la carga, un cuadro gris claro del mismo tamaño (sin texto roto ni ícono de imagen
  rota). En modo local `imagen` es `null`: siempre se ve el cuadro gris.
- **Centro:**
  - el nombre en **una línea**, cortado con "…";
  - debajo, en una línea: `disp N · alcanza N d · vend N` (vendidos del periodo). Los
    números van en negrita; cuando hay problema, en el color de la urgencia (magenta o
    ámbar). Si el disponible es 0 por "agotado" o "sin existencias", la primera parte dice
    la palabra ("Agotado", "Sin existencias") en vez de `disp 0`.
  - Cuando se muestra la palabra ("Agotado" / "Sin existencias") se omite la parte `alcanza N d`, que ahí es 0 o no aplica y partía la línea (*decisión de Claude tras probar en el navegador*).
  - A CONSULTAR: `A CONSULTAR · vend N`.
  - Sin datos de ventas: solo la parte de stock (`disp N`, o la palabra).
- **Derecha, grande:** el número a **pedir** (el "sugerido" de la fase 2, sin cambios en
  la fórmula), en una caja azul marino con texto blanco y la palabra "pedir" debajo.
  - Sin sugerido (no hace falta pedir, o no vendió): "—" en una caja gris.
  - A CONSULTAR: "?" en caja gris.
  - Sin datos de ventas: no se muestra la caja.
- **Tocar la fila la despliega** (*decisión de Claude*, aceptada por el usuario) y muestra
  lo que salió de la vista principal: precio, código, departamento, referencia, existencia
  bruta, reservado y fecha de la última venta (o "sin ventas en 30 días"). Tocar otra vez
  la cierra. Cada fila se despliega por su cuenta.
- El indicador circular de stock de la fase 1 (`StockGauge`) deja de usarse en la fila: la
  barra de color lo reemplaza.

### 2. Parte de arriba compactada (elegida por el usuario)

En este orden, debajo del encabezado actual (logo, "Reposición", Salir), que no cambia:

1. **Píldoras de color con su número**, que **reemplazan a la vez las tarjetas de cifras y
   los botones de filtro**. Van en **una sola fila con scroll lateral**, sin barra visible y con un degradado en el borde derecho que avisa que hay más; la píldora activa se desplaza a la vista (*decisión de Claude tras probar en el navegador*: en varias líneas ocupaban cuatro y dejaban solo 5 filas de producto visibles). Orden:
   Reponer ya, Agotados, Sin existencias, Stock bajo, Más vendidos, Sin movimiento,
   A consultar, Todos. Colores: magenta para las tres primeras, ámbar para Stock bajo, azul
   para Más vendidos, gris para el resto. La píldora activa se marca con un borde del mismo
   color y `aria-pressed`. Tocar la activa vuelve a "Todos" (como hoy). Sin ventas, no
   aparecen las de ventas (Reponer ya, Más vendidos, Sin movimiento).
2. **Una línea con:** el buscador, el **periodo** como un solo botón desplegable ("Mes ▾",
   con Semana / 15 días / Mes) y el botón **"Filtros"**. Sin ventas, el botón de periodo no
   aparece.
3. **Línea de información:** "N productos" a la izquierda y "ventas al DD/MM" a la derecha.
   Si las ventas están desactualizadas (más de 2 días), ese texto pasa a magenta y dice
   cuántos días. Sin ventas, dice "Aún no hay ventas cargadas" o "No se pudieron leer las
   ventas" (los textos de la fase 2).
4. La lista.

**Panel "Filtros"** (sube desde abajo, sobre un fondo oscurecido):

- Ordenar por: los órdenes que ya existen, como botones.
- Departamento: el selector actual.
- Otros: "Nuevos" con su número (la píldora de Nuevos sale de la parte de arriba).
- Resumen por departamento: la tabla actual de la fase 1, igual, con su toque para filtrar.
- Un botón "Ver N productos" que cierra el panel.
- Se cierra también tocando el fondo o con Escape. El foco entra al panel al abrirse y
  vuelve al botón "Filtros" al cerrarse.
- El botón "Filtros" muestra un punto cuando hay un departamento elegido o un orden
  distinto del predeterminado, para que no quede un filtro escondido sin aviso.

### 3. Al abrir la página (pedido por el usuario)

- **Con datos de ventas:** filtro **"Reponer ya"**, orden **"Se acaba antes"**
  (`alcanza_asc`).
- **Sin datos de ventas** (*decisión de Claude*): filtro "Todos", orden "Menor
  existencia". Es lo más parecido a "lo urgente primero" que se puede sin ventas.
- Si al cargar llegan sin ventas y el filtro o el orden actual son de ventas, se vuelve a
  los de sin ventas (ya existe esa lógica; solo cambian los valores de destino).
- **Apertura sin nada que reponer** (*decisión de Claude tras la revisión final*): si hay ventas pero "Reponer ya" tiene 0 en la primera carga, abre en "Todos" con el mismo orden "Se acaba antes", para no mostrar una lista vacía. El estado vacío tiene un botón "Ver todos" (filtro Todos, sin departamento, sin búsqueda).
- El orden "Se acaba antes" desempata por **más vendidos primero** y después por nombre
  (*decisión de Claude*): entre dos productos que se acaban el mismo día, primero el que
  más se vende. En el boceto se mostró como "Más urgentes"; se mantiene el nombre actual
  "Se acaba antes" para no tener dos órdenes casi iguales.

## Restricciones

- Solo cambia la presentación. Las fórmulas (alcanza, sugerido), los filtros, la ruta de
  datos, la sesión y la seguridad de las fases 1 y 2 no cambian, salvo el desempate del
  orden `alcanza_asc` y los valores iniciales de filtro y orden.
- Mismo stack y estilo: Next.js, Tailwind, los colores de marca de `tailwind.config`
  (`brand-navy`, `brand-magenta`/`magentaDeep`, `brand-amber`, `brand-cyan`, `ink-*`).
  Para texto en color, usar los tonos que pasan 4.5:1 sobre su fondo (`magentaDeep`, ámbar
  oscuro); la magenta y el amarillo puros solo para barras y bordes.
- Texto de al menos 12 px. Botones y píldoras tocables de al menos 40 px de alto.
- A 360 px de ancho, sin scroll horizontal. En pantallas anchas, el mismo diseño dentro del
  ancho actual (`max-w-3xl`).
- **Nada se sube a GitHub ni se despliega** hasta que el usuario lo confirme.

## Lo que la haría un fracaso

- Que en un teléfono, al abrir, no se vea por lo menos media pantalla de productos.
- Que el color sea lo único que dice la urgencia (siempre hay palabra o número al lado).
- Que un filtro de departamento quede activo y escondido en el panel sin ningún aviso.
- Que se pierda algún dato que hoy se ve (todo lo que sale de la fila va al desplegado).
- Que una imagen que falla deje un ícono roto o mueva la fila.

## Verificación

- Pruebas `node:test` para el desempate de `alcanza_asc` y para la regla de color de la
  barra (si se saca a una función pura).
- Prueba en Chrome en local, a 360 px:
  - al abrir, filtro "Reponer ya" y al menos 6 productos visibles sin deslizar;
  - píldoras: números iguales a `resumen`, filtran, tocar la activa vuelve a Todos;
  - periodo desde el desplegable cambia las cifras;
  - panel Filtros: abre, cierra con fondo y Escape, el punto aparece con un departamento;
  - desplegar una fila muestra precio, código, bruta, reservado y última venta;
  - sin scroll horizontal.
- Revisar también el caso sin ventas (por ejemplo, quitando temporalmente
  `ventas.ejemplo.json`).

## Decisiones tras la revisión (*decisiones de Claude*)

- **Conteos de las píldoras:** son los de `resumen` tal cual, sin cambios. Los estados de
  stock (agotado, sin existencias, bajo, ok, a consultar) son excluyentes entre sí, porque
  `estadoDe` da uno solo. "Reponer ya", "Más vendidos" y "Sin movimiento" se cruzan con
  ellos (un agotado que se vende también está en "Reponer ya"). Eso está bien: cada píldora
  es un filtro, no una parte de un total.
- **Prioridad del color de la barra:**
  1. a consultar → gris;
  2. agotado o sin existencias → magenta, haya ventas o no;
  3. "Reponer ya" → magenta;
  4. bajo → ámbar;
  5. el resto → cyan.
- **Caja "pedir":** depende de si la página tiene ventas cargadas (un dato de toda la
  página), no de cada producto.
  - Con ventas cargadas, siempre hay caja: el número, "—" o "?".
  - Sin ventas cargadas, no hay caja.
  - Un producto sin filas de ventas, con ventas cargadas, vendió 0: muestra "—".
- **"N productos"** y **"Ver N productos"** cuentan la lista ya filtrada, incluida la
  búsqueda, igual que el "N de M" de hoy.
- **Nuevos:** es un valor más del mismo filtro. Al activarlo desde el panel, ninguna
  píldora queda marcada. El punto del botón "Filtros" se enciende si hay departamento, si el
  orden no es el predeterminado del modo actual (con o sin ventas) o si el filtro es Nuevos.
- **Imágenes:** `p.imagen` ya es una URL completa del bucket público, o `null`. Se usa un
  `<img loading="lazy">` normal, con `onError` que lo cambia por el cuadro gris, igual que
  el catálogo, que también usa `<img>`. No se usa `next/image`.

## A criterio del constructor

- Medidas exactas, sombras y animaciones (sin exagerar).
- Si el panel es un componente aparte y cómo se maneja el foco.
- Si la regla de color vive en `clasificar.js` o en un archivo nuevo de `lib/reposicion/`.
