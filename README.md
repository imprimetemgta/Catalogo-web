# Catálogo web + carrito → WhatsApp, sincronizado con A2

Catálogo Next.js que muestra productos desde Supabase y arma un pedido que se
envía por WhatsApp a un asesor. El inventario se sincroniza desde A2.

## Estructura

```
catalogo-web/
├─ app/
│  ├─ api/
│  │  ├─ productos/route.js   → GET: lista pública (lo que lee el catálogo)
│  │  └─ sync/route.js        → POST: recibe el JSON de A2 y hace upsert
│  ├─ layout.jsx
│  ├─ page.jsx                → monta el catálogo en la página principal
│  └─ globals.css
├─ components/
│  └─ CatalogoWhatsApp.jsx    → el catálogo (lee /api/productos)
├─ lib/
│  ├─ supabase.js             → clientes anon (lectura) y service_role (escritura)
│  └─ rateLimit.js            → límite de peticiones para /api/sync
├─ db/                        → SQL de referencia (se corre en Supabase, NO se despliega)
│  ├─ 01_schema.sql
│  ├─ 02_rate_limit.sql
│  └─ 03_constraints.sql
├─ scripts/
│  └─ subir_inventario.py     → corre en el servidor de la OFICINA, NO en Vercel
├─ .env.example
└─ package.json
```

## Qué se despliega y qué no

- **A Vercel** va toda la app Next.js (`app/`, `components/`, `lib/`, configs).
- **NO** se despliega: la carpeta `db/` (se ejecuta en Supabase) ni `scripts/`
  (corre en la oficina). Están en el repo solo como referencia versionada.
- Las llaves **no** son archivos: van en las variables de entorno de Vercel.
  El `.env.local` con secretos NUNCA se sube (lo ignora `.gitignore`).

## Puesta en marcha (una sola vez)

### 1. Supabase — crear la base
En Supabase → SQL Editor, corre en este orden:
1. `db/01_schema.sql`      (tabla productos + RLS)
2. `db/02_rate_limit.sql`  (tabla y función del rate limit)
3. `db/03_constraints.sql` (restricciones CHECK)

### 2. Variables de entorno
Copia `.env.example` a `.env.local` para desarrollo local, y en Vercel ponlas en
Settings → Environment Variables:

| Variable | Dónde se obtiene | Uso |
|---|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API | servidor |
| `SUPABASE_ANON_KEY` | Supabase → API (llave anon) | servidor (lectura) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API (llave service_role, secreta) | servidor (escritura) |
| `SYNC_SECRET` | invéntalo, largo y aleatorio | protege /api/sync |
| `NEXT_PUBLIC_WHATSAPP_NUMERO` | número del asesor (internacional, sin "+") | navegador |

### 3. Desplegar en Vercel
1. Sube este proyecto a GitHub.
2. Vercel → Add New → Project → importa el repo (detecta Next.js solo).
3. Agrega las variables de entorno de arriba.
4. Deploy. Te da una URL, ej. `https://tu-app.vercel.app`.

### 4. Servidor de la oficina (sincronización)
En la máquina donde A2 exporta el JSON:
```
pip install requests
```
Variables de entorno:
- `API_SYNC_URL`  = `https://tu-app.vercel.app/api/sync`
- `SYNC_SECRET`   = el mismo valor que pusiste en Vercel
- `CARPETA_JSON`  = carpeta donde A2 deja los `inventario_*.json`

Programa una tarea que corra, tras el export de A2:
```
python scripts/subir_inventario.py
```

## Flujo completo (cómo verificar que todo está bien)

1. **A2 exporta** un `inventario_FECHA.json` en la oficina.
2. **El script** (`subir_inventario.py`) toma el más reciente y hace POST a
   `/api/sync` con el `SYNC_SECRET`.
3. **/api/sync** valida el secreto y el rate limit, sanea cada fila (convierte
   PUBLICAWEB, deduplica códigos, corrige negativos, oculta filas con precio o
   descripción inválidos) y hace upsert en Supabase. Responde un resumen:
   `{ ok, recibidos, sincronizados, ocultados, revisar }`.
4. **/api/productos** lee de Supabase solo los productos con `publicaweb = true`
   y los entrega mapeados.
5. **El catálogo** (`/`) hace fetch a `/api/productos` y muestra los productos;
   el cliente arma el carrito y el botón abre WhatsApp con el pedido.

### Pruebas rápidas
- Lectura: abre `https://tu-app.vercel.app/api/productos` → arreglo JSON.
- Escritura: `curl -X POST https://tu-app.vercel.app/api/sync -H "Authorization: Bearer TU_SYNC_SECRET" -H "Content-Type: application/json" --data @inventario_FECHA.json`
- Catálogo: abre `https://tu-app.vercel.app/` → deben verse los productos reales.

## Desarrollo local
```
npm install
npm run dev
```
Abre http://localhost:3000 (necesita `.env.local` con las variables).
