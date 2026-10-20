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
