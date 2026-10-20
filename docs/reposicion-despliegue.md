# Página de reposición: guía de despliegue

Página interna, con usuario y clave, para ver qué productos hay que reponer.
Se entra por una ruta secreta: `https://<dominio>/r-7cdc0e670a66b2d0f9dc`.

Antes de empezar, dos advertencias:

- **El repositorio debe seguir privado.** La ruta secreta está escrita en el código fuente; si el repo fuera público, cualquiera la vería (igual necesitaría usuario y clave, pero ya no sería secreta).
- **Hay que correr un sync después del despliegue** (paso 5). Sin eso, los productos sin precio bruta no pasan a "A consultar".

## Paso 1. Crear las tablas en Supabase

1. Abrir Supabase, ir a **SQL Editor**.
2. Pegar y ejecutar el contenido de `db/06_existencia_nullable.sql`.
3. Pegar y ejecutar el contenido de `db/07_usuarios_reposicion.sql` (crea la tabla `public.usuarios_reposicion`).

## Paso 2. Generar el secreto de sesión

En una terminal, dentro de la carpeta del proyecto:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copiar el texto que imprime (64 caracteres). En Vercel, ir a **Settings → Environment Variables** y crear:

- Nombre: `REPOSICION_SESSION_SECRET`
- Valor: el texto copiado

Debe tener mínimo 32 caracteres. Si falta o es más corto, el servidor rechaza el ingreso con error 503.

## Paso 3. Crear un usuario

En la terminal, dentro de la carpeta del proyecto (cambiar `ana` por el nombre de usuario):

```
node scripts/crear_usuario_reposicion.mjs ana
```

Pide la clave y no la muestra mientras se escribe (mínimo 10 caracteres). También se puede enviar por pipe: `echo la-clave-larga | node scripts/crear_usuario_reposicion.mjs ana`, aunque así queda en el historial de la terminal.

El script imprime una sentencia SQL. Copiarla completa y ejecutarla en **Supabase → SQL Editor**. Es seguro repetirlo: si el usuario ya existe, cambia su clave y lo reactiva. Puede aparecer un aviso `MODULE_TYPELESS_PACKAGE_JSON`; es inofensivo.

No guardar ese SQL en el repositorio ni compartirlo: contiene el hash de la clave.

## Paso 4. Desplegar

Desplegar en Vercel como siempre (push a la rama de producción, o **Redeploy** si solo se agregó la variable del paso 2; las variables nuevas solo se aplican en un despliegue nuevo).

## Paso 5. Correr un sync

Ejecutar una vez el script de sincronización de siempre (`scripts/subir_inventario.py`). Así los productos que no tienen precio bruta pasan a estar vacíos (`null`) y se muestran como "A consultar".

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

Para reactivarlo, poner `activo = true` o volver a correr el script del paso 3.

Nota: si esa persona tiene una sesión abierta, puede seguir dentro hasta que venza (hasta 12 horas). Para cortar el acceso de inmediato hoy habría que cambiar `REPOSICION_SESSION_SECRET` y redesplegar, lo que cierra la sesión de todos.
