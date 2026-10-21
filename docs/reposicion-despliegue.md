# Página de reposición: guía de despliegue

Página interna, con usuario y clave, para ver qué productos hay que reponer.
Se entra por una ruta secreta: `https://<dominio>/r-7cdc0e670a66b2d0f9dc`.

> **IMPORTANTE: primero el paso 1 (Supabase), después el código.**
> Hay que ejecutar `db/06_existencia_nullable.sql` en Supabase **antes** de unir
> (merge) o desplegar esta versión. Si el código nuevo llega primero, la
> sincronización de inventario falla y **el catálogo público deja de actualizarse**
> hasta que se ejecute ese archivo. Ejecutarlo antes no rompe nada: la versión
> actual del sitio sigue funcionando igual.

Antes de empezar, otras dos advertencias:

- **El repositorio debe seguir privado.** La ruta secreta está escrita en el código fuente; si el repo fuera público, cualquiera la vería (igual necesitaría usuario y clave, pero ya no sería secreta).
- **Hay que correr una sincronización después del despliegue** (paso 5). Sin eso, los productos sin existencia bruta no pasan a "A consultar".

## Paso 1. Crear las tablas en Supabase (antes de desplegar)

1. Abrir Supabase, ir a **SQL Editor**.
2. Pegar y ejecutar el contenido de `db/06_existencia_nullable.sql`. **Este va siempre primero, antes del merge o despliegue del código.**
3. Pegar y ejecutar el contenido de `db/07_usuarios_reposicion.sql` (crea la tabla `public.usuarios_reposicion`, donde se guardan los usuarios).

## Paso 2. Generar el secreto de sesión

En una terminal, dentro de la carpeta del proyecto:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copiar el texto que imprime (64 caracteres). En Vercel, ir a **Settings → Environment Variables** y crear:

- Nombre: `REPOSICION_SESSION_SECRET`
- Valor: el texto copiado

Debe tener mínimo 32 caracteres. Si falta o es más corto, la página no deja entrar a nadie (muestra "Servicio no disponible").

## Paso 3. Crear un usuario

En la terminal, dentro de la carpeta del proyecto (cambiar `ana` por el nombre de usuario):

```
npm run crear-usuario -- ana
```

Pide la clave y no la muestra mientras se escribe. Debe tener entre 10 y 200 caracteres. Si te equivocas al escribirla, presiona Ctrl+C y vuelve a empezar.

El programa muestra un texto que empieza con `insert into`. Copiarlo completo y ejecutarlo en **Supabase → SQL Editor**. Es seguro repetirlo: si el usuario ya existe, cambia su clave y lo reactiva.

No guardar ese texto en el repositorio ni compartirlo: contiene la clave cifrada, y aunque no se puede leer directamente, no debe circular.

## Paso 4. Desplegar

Desplegar en Vercel como siempre (push a la rama de producción, o **Redeploy** si solo se agregó la variable del paso 2; las variables nuevas solo se aplican en un despliegue nuevo).

Recordatorio: el paso 1 (`db/06_existencia_nullable.sql`) ya debe estar hecho.

## Paso 5. Correr una sincronización

Ejecutar una vez el script de sincronización de siempre (`scripts/subir_inventario.py`). Así los productos que no tienen existencia bruta quedan sin cantidad y se muestran como "A consultar".

## Paso 6. Probar la entrada

1. Abrir `https://<dominio>/r-7cdc0e670a66b2d0f9dc`.
2. Ingresar con el usuario y la clave del paso 3.
3. Verificar que se ve la lista de reposición.

La sesión dura 12 horas; pasado ese tiempo hay que volver a ingresar.

## Dar de baja a alguien

En **Supabase → SQL Editor**:

```sql
update public.usuarios_reposicion set activo = false where usuario = 'ana';
```

El acceso se corta de inmediato: aunque esa persona tenga la página abierta, la próxima vez que la recargue o actualice la lista ya no podrá entrar.

Para reactivarlo, poner `activo = true` o volver a crear el usuario con el paso 3.

---

# Fase 2: ventas

La Fase 2 agrega las ventas de los últimos 30 días a la página de reposición. Un programa pequeño (`scripts/extraer_ventas.py`) corre en la PC de la tienda, lee las ventas de A2 (solo lectura, no modifica nada en A2) y las envía al catálogo. Cada venta suma y cada devolución resta.

Hacer los pasos en este orden.

## Paso 1. Crear la tabla de ventas en Supabase (antes de desplegar)

En **Supabase → SQL Editor**, pegar y ejecutar el contenido de `db/08_ventas_diarias.sql`. Igual que en la Fase 1, va **antes** de desplegar el código. Ejecutarlo antes no rompe nada.

## Paso 2. Desplegar

Desplegar en Vercel como siempre. Verificar que la variable `SYNC_SECRET` ya existe (es la misma que usa el inventario); el envío de ventas usa esa misma clave.

## Paso 3. Instalar lo necesario en la PC de la tienda

1. Instalar **Python de 32 bits** (el driver de A2, "DBISAM 4 ODBC Driver", es de 32 bits; con Python de 64 bits no conecta). Al instalar, marcar "Add python.exe to PATH".
2. Abrir una terminal y ejecutar:

   ```
   pip install pyodbc
   ```

   Es lo único que se instala; el resto viene con Python.
3. Copiar a la PC la carpeta `scripts` del proyecto (o al menos `extraer_ventas.py` y `config_ventas.ejemplo.ini`).

## Paso 4. Preparar la configuración

1. En esa carpeta, copiar `config_ventas.ejemplo.ini` como `config_ventas.ini`.
2. Abrir `config_ventas.ini` y revisar:
   - `carpeta_datos`: la carpeta `Data` de la empresa en A2 (en la tienda: `C:\A2\A2imprimete\Empre001\Data`).
   - `sync_secret`: pegar el valor de `SYNC_SECRET` de Vercel.
   - `api_url`: por ahora dejar la de prueba.

El archivo `config_ventas.ini` tiene la clave: no se sube a GitHub ni se comparte.

## Paso 5. Probar sin enviar nada

En la terminal, dentro de la carpeta `scripts`:

```
py -3-32 extraer_ventas.py --solo-archivo
```

Esto lee A2 y guarda un archivo en `exportaciones\ventas_FECHA.json`, pero **no envía nada**. Abrirlo y ver que tiene códigos de productos, fechas y unidades. Si dice "No hay ventas en los últimos 30 días", el programa termina con código 2 y no envía nada (es normal en una base sin ventas recientes).

## Paso 6. Pasar a producción

1. En `config_ventas.ini`, cambiar `api_url` a la dirección real: `https://<dominio>/api/sync-ventas`.
2. Correr una vez, sin `--solo-archivo`:

   ```
   py -3-32 extraer_ventas.py
   ```

   Si todo sale bien, el programa muestra la respuesta del catálogo con `"ok": true` y cuántas filas se guardaron.
3. Programar la tarea en el **Programador de tareas de Windows**: una vez al día, **después** de la exportación de inventario, con el mismo comando. Si algo falla, el programa lo anota en la carpeta `logs`.

## Primera corrida: comprobar que los números son correctos

Antes de confiar en la página, comparar 3 a 5 productos contra el reporte de **ventas por producto de A2**, para los últimos **7 días** y los últimos **30 días**:

- [ ] Un producto de venta normal: las unidades coinciden.
- [ ] Un producto que tuvo una **devolución**: la cifra de la página es la venta menos la devolución.
- [ ] Un producto que se vende por **caja o paquete** (si existe): confirmar que A2 y la página cuentan la misma unidad.
- [ ] Un producto sin ventas: no aparece o muestra cero.

Si alguna cifra no coincide, no usar la página para decidir compras hasta revisarlo.
