# Página de reposición de stock — diseño

Fecha: 2026-10-20 · Estado: borrador para aprobación

## Por qué

En Imprimete, la persona encargada de reponer mercancía usa el catálogo web como guía,
porque sacar esa información de A2 es complicado. Hoy solo tiene el catálogo público
(`/`), pensado para clientes: no muestra la existencia bruta ni lo reservado, no tiene
orden y no deja ver de un vistazo qué falta. Lo que se busca es **mantener un stock
continuo**: ver rápido qué está agotado, qué no tiene existencias y qué está por
acabarse, y más adelante qué se vende más.

## Metas

- Una página interna, separada del catálogo público, para la persona que repone.
- **Botones de filtro:**
  - **Agotados (todo reservado):** `existencia_disponible <= 0` y `existencia_bruta > 0`.
    Hay mercancía física, pero toda está comprometida en pedidos.
  - **Sin existencias:** `existencia_bruta <= 0`. No queda nada físico.
  - **Stock bajo:** `0 < existencia_disponible <= 5`. **El mínimo es 5 unidades** (lo
    decidió el usuario).
  - **Nuevos:** el mismo criterio de 30 días que ya usa el catálogo (`creado_en`).
  - **A consultar:** productos para los que A2 no manda existencia bruta (hoy son 23,
    casi todos de SERVICIOS, COMBOS y REMANUFACTURA). El usuario indicó que sí manejan
    existencias, pero A2 los tiene en 0 porque son servicios o se arman a pedido. Se
    muestran con la etiqueta **"A CONSULTAR"** en lugar de números, y **no** cuentan
    en agotados, sin existencias ni stock bajo.
- **Orden:** menor precio, mayor precio, menor existencia disponible y nombre (el orden
  por defecto).
- **Pequeñas estadísticas arriba:** cuántos productos hay agotados, sin existencias y en
  stock bajo, más un desglose por departamento. Tocar una cifra aplica ese filtro.
- También se puede filtrar por departamento y buscar por nombre o código, igual que en el
  catálogo.

## Fuera de alcance por ahora

- **Más vendido.** El archivo de A2 hoy solo trae una foto del inventario, sin ventas.
  A2 sí puede exportar ventas, pero falta averiguar de qué tablas o base de datos saldrían
  y con qué formato. Queda como **fase 2**, con su propio diseño, cuando eso se sepa. La
  página se arma de forma que agregar una columna u orden por "vendidos" después no
  obligue a rehacerla.
- No se cambia el catálogo público (`/`), ni su umbral de "bajo" (3), ni el carrito de
  WhatsApp.
- No hay pedidos a proveedores ni exportar a Excel o PDF.
- **Durante esta fase nada se sube a GitHub ni se despliega.** El proyecto está en
  producción, con su propia base de Supabase y su dominio. Se trabaja en un clon local y
  se prueba en local. Recién cuando el usuario confirme que todo está bien se sube y se
  configuran las credenciales de producción. Ese paso lo decide el usuario y no forma
  parte de la construcción.

## Lo que la haría un fracaso

- Que se cuele al catálogo público información interna (bruta, reservado) o que cambie lo
  que ve un cliente.
- Que los números no cuadren con A2. Las definiciones de arriba tienen que ser
  exactamente esas, y cada tarjeta muestra disponible, bruta y reservado para que la
  persona lo pueda contrastar.
- Que alguien sin credenciales vea datos internos, por cualquier camino: la página, la
  API o la dirección filtrada.
- Que el cambio al sync rompa o altere el catálogo público en producción.
- Que sea lenta o incómoda en el teléfono. Es una lista de trabajo y tiene que leerse
  rápido.

## Restricciones y contexto técnico

- Next.js (app router, JSX) + Tailwind + Supabase. Hoy hay unos 588 productos, así que
  filtrar y ordenar en el cliente sobre la lista completa es suficiente; es el mismo
  patrón que `components/CatalogoWhatsApp.jsx`.
- `/api/productos` es público y no expone bruta ni reservado. **No se modifica.** La
  página nueva usa su propia ruta de API protegida (ver Seguridad), que devuelve además
  `existencia_bruta`, `existencia_pedido` y `referencia`.
- Esa ruta solo devuelve productos con `publicaweb = true`. Los ocultos son inválidos o ya
  no vienen en el export, así que no interesa reponerlos (*decisión de Claude*).
- Modo local sin Supabase: igual que `/api/productos`, si no hay `SUPABASE_URL` la ruta lee
  `inventario.json`, que ya trae `EXISTENCIA_BRUTA` y `EXISTENCIA_PEDIDO`. Así se puede
  probar todo en local sin credenciales.
- **"A consultar" de punta a punta** (*decisión de Claude*). El criterio es
  `existencia_bruta` nula. Hoy el sync convierte un valor ausente en 0 (`aInt` en
  `app/api/sync/route.js`) y la columna es `not null default 0`, así que en producción no
  se podría distinguir. Por eso hacen falta dos cambios:
  1. Una migración nueva, `db/06_...sql`, para que `existencia_bruta` y
     `existencia_pedido` acepten `null`. Los `check >= 0` siguen valiendo.
  2. En el sync, guardar `null` en esas dos columnas cuando A2 no manda el campo.
     `existencia_disponible` no cambia: el catálogo público sigue igual.

  Los productos que ya existen en Supabase quedan en 0 hasta el próximo sync, que los
  corrige solo. La alternativa descartada era marcar como "a consultar" por departamento:
  se perdían casos como el tóner 02029 y el archivador 15107.
- Negativos: el JSON trae 5, y tras el sync quedan en 0. En ambos casos se aplica `<= 0`,
  así que no cambia nada.

## Seguridad y acceso

El usuario dijo "seguridad ante todo". El encargado entra desde cualquier lugar (teléfono,
fuera de la tienda), así que la página va a estar en internet y necesita dos capas:

1. **Dirección secreta.** La página vive en una ruta no adivinable (un segmento aleatorio
   largo, por ejemplo `/r-<hex de 16+ caracteres>`), no en `/reposicion`. Su API
   también está bajo un segmento no adivinable o protegida por la sesión. Lo que debe
   evitarse es cualquier ruta adivinable que devuelva bruta o reservado. La ruta no se
   enlaza desde ningún lado y lleva `noindex`.
2. **Pantalla de credenciales con la clave guardada en la base de datos.**
   - Tabla nueva en Supabase (migración en `db/`) con usuario y **hash** de la clave.
     Nunca se guarda la clave en texto plano. El hash es scrypt de `node:crypto`, con
     sal por usuario, sin dependencias nuevas. Usuario + clave en vez de clave única, para
     poder dar acceso a más de una persona (*decisión de Claude*).
   - RLS activado sin políticas para `anon`. Solo el servidor la lee, con el cliente
     service role.
   - Al entrar bien se crea una cookie de sesión `httpOnly`, `secure` y `sameSite=strict`,
     firmada con HMAC y con un secreto de entorno nuevo (`REPOSICION_SESSION_SECRET`).
     Vence en unas 12 horas.
   - La API de reposición verifica la cookie en **cada** petición y responde 401 sin ella.
     La página sin sesión muestra solo el formulario.
   - Límite de intentos de entrada por IP con el `rate_limit_check` que ya existe en
     `db/02_rate_limit.sql`. Mensaje de error genérico, sin decir si falló el usuario o la
     clave. Comparación en tiempo constante.
   - Botón de salir que borra la cookie.
   - Para crear o cambiar un usuario, un script local en `scripts/` genera el hash y el
     SQL `insert`/`update`, que se pega en Supabase. No hay pantalla para administrar
     usuarios (*decisión de Claude*).
- **Modo local sin Supabase:** igual que con los productos, si no hay `SUPABASE_URL` la
  entrada valida contra un usuario y hash de prueba definidos en variables de entorno
  locales (o un valor fijo solo de desarrollo). Así se prueba todo el flujo sin
  credenciales de producción. Ese atajo nunca se activa en producción porque ahí
  `SUPABASE_URL` siempre existe.
- **Para subir a producción** (cuando el usuario lo decida): correr las migraciones
  nuevas en Supabase, crear el primer usuario con el script y agregar
  `REPOSICION_SESSION_SECRET` en Vercel. La construcción entrega estos pasos escritos.
- Visual: hay que seguir `DESIGN.md` del repo y reusar piezas existentes donde encajen
  (`StockGauge` en `components/RefillLoop.jsx` con `umbralBajo = 5`, formato de moneda en
  `lib/moneda.js`). Es una herramienta de trabajo, no una vitrina: tiene que ser densa y
  legible.
- El repo no tiene tests ni eslint instalado. La verificación es `npm run build` + probarlo
  en el navegador en local.

## Lo que queda a criterio del constructor

- El layout exacto, los componentes y el nombre de los archivos.
- Si el filtro, el orden y el departamento se guardan en la URL (útil para guardar un
  marcador) o en estado de React.
- El texto de los botones y de los estados vacíos.
