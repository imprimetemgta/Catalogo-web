#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EXTRACTOR DE VENTAS A2SOFTWAY -> CATALOGO (pagina de reposicion)
================================================================
Corre en la PC de la tienda donde esta A2:

  1. Lee las ventas de los ultimos 30 dias de A2 por ODBC (DBISAM 4, solo lectura).
  2. Suma las ventas (tipo 11), resta las devoluciones (tipo 12) y agrupa
     por producto y dia.
  3. Guarda el JSON en la carpeta de exportaciones.
  4. Lo envia a /api/sync-ventas del catalogo.

Es independiente del extractor de inventario: se programa por separado en el
Programador de tareas. Se puede correr como script o compilado a
ExtraerVentasImprimete.exe (ver compilar_extractor_ventas.bat).

Ninguna clave vive en este archivo: todo se lee de config_ventas.ini, que va
junto al script o al .exe. El config_ventas.ini con claves reales nunca se sube
a GitHub.

Uso:
    ExtraerVentasImprimete.exe                       (config_ventas.ini junto al .exe)
    ExtraerVentasImprimete.exe -c C:\\ruta\\config_ventas.ini
    ExtraerVentasImprimete.exe --solo-archivo        (extrae y guarda, no envia nada)
    (o lo mismo con: py -3-32 extraer_ventas.py ...)

Codigos de salida: 0 = listo, 1 = error de conexion/configuracion/envio,
2 = no hubo ventas en los ultimos 30 dias (no se envia nada).

Logs: un archivo por dia en logs\\ventas_AAAAMMDD.log. Cada corrida empieza con
INICIO y termina con una linea FIN que dice el resultado. Los logs de mas de
60 dias se borran solos.

Requiere Python de 32 bits (el driver DBISAM 4 ODBC es de 32 bits) y:
    pip install pyodbc
"""

import os
import sys
import json
import time
import argparse
import logging
import configparser
import urllib.request
import urllib.error
from collections import defaultdict
from datetime import date, datetime, timedelta

VERSION = "1.1"

# Compilado con PyInstaller, __file__ apunta a una carpeta temporal: el config
# y los logs van junto al .exe.
if getattr(sys, "frozen", False):
    DIR_SCRIPT = os.path.dirname(os.path.abspath(sys.executable))
else:
    DIR_SCRIPT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CONFIG = os.path.join(DIR_SCRIPT, "config_ventas.ini")

DIAS_VENTANA = 30          # hasta - 29 dias .. hasta, ambos incluidos
TIPO_VENTA = 11
TIPO_DEVOLUCION = 12
# El 13 (nota de entrega) NO se cuenta: en la tienda se factura despues, y esa
# factura ya llega como tipo 11; contarla duplicaria la venta (confirmado 2026-10-21).
TIMEOUT_HTTP = 60          # segundos
TIMEOUT_CONEXION = 30      # segundos para conectar con A2
TIMEOUT_CONSULTA = 120     # segundos maximos de la consulta
DIAS_LOGS = 60             # los logs mas viejos se borran

SQL_VENTAS = (
    "SELECT FDI_CODIGO, FDI_FECHAOPERACION, FDI_TIPOOPERACION, SUM(FDI_CANTIDAD) "
    "FROM SDetalleVenta "
    "WHERE FDI_FECHAOPERACION >= '{desde}' AND FDI_TIPOOPERACION IN (11,12) "
    "GROUP BY FDI_CODIGO, FDI_FECHAOPERACION, FDI_TIPOOPERACION"
)

# Que revisar segun la respuesta del catalogo.
PISTAS_HTTP = {
    401: "La clave sync_secret del config_ventas.ini no coincide con SYNC_SECRET de Vercel.",
    400: "El catalogo rechazo los datos; el detalle de arriba dice por que.",
    404: "La direccion api_url no existe: revisa que termine en /api/sync-ventas.",
    429: "Demasiadas corridas seguidas; espera un minuto y vuelve a intentar.",
}


def ruta_absoluta(ruta):
    # Rutas relativas del config se resuelven junto al script, no segun la
    # carpeta desde donde se lance (el Programador de tareas arranca en System32).
    return ruta if os.path.isabs(ruta) else os.path.join(DIR_SCRIPT, ruta)


def limpiar_logs(carpeta, dias, hoy):
    """Borra ventas_AAAAMMDD.log con mas de `dias` dias. Devuelve los borrados."""
    borrados = []
    if not os.path.isdir(carpeta):
        return borrados
    limite = hoy - timedelta(days=dias)
    for nombre in os.listdir(carpeta):
        if not (nombre.startswith("ventas_") and nombre.endswith(".log")):
            continue
        try:
            fecha = datetime.strptime(nombre[7:-4], "%Y%m%d").date()
        except ValueError:
            continue
        if fecha < limite:
            os.remove(os.path.join(carpeta, nombre))
            borrados.append(nombre)
    return borrados


def limpiar_exportaciones(carpeta, dias, hoy):
    """Borra ventas_AAAA-MM-DD_HHMMSS.json con mas de `dias` dias (4 corridas al dia acumulan)."""
    borrados = []
    if not os.path.isdir(carpeta):
        return borrados
    limite = hoy - timedelta(days=dias)
    for nombre in os.listdir(carpeta):
        if not (nombre.startswith("ventas_") and nombre.endswith(".json")):
            continue
        try:
            fecha = datetime.strptime(nombre[7:17], "%Y-%m-%d").date()
        except ValueError:
            continue
        if fecha < limite:
            os.remove(os.path.join(carpeta, nombre))
            borrados.append(nombre)
    return borrados


def setup_logging(carpeta_logs, nivel, archivar):
    handlers = [logging.StreamHandler(sys.stdout)]
    if archivar:
        os.makedirs(carpeta_logs, exist_ok=True)
        fecha = datetime.now().strftime("%Y%m%d")
        handlers.append(logging.FileHandler(os.path.join(carpeta_logs, f"ventas_{fecha}.log"), encoding='utf-8'))

    logging.basicConfig(
        level=getattr(logging, nivel.upper(), logging.INFO),
        format='%(asctime)s  %(levelname)-7s  %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
        handlers=handlers,
        force=True,
    )
    return logging.getLogger("ventas")


def cargar_config(ruta_config):
    if not os.path.exists(ruta_config):
        raise FileNotFoundError(f"No se encontro el archivo de configuracion: {ruta_config}")

    config = configparser.ConfigParser()
    config.read(ruta_config, encoding='utf-8')

    for seccion in ('CONEXION', 'WEB'):
        if seccion not in config:
            raise ValueError(f"El config_ventas.ini debe tener la seccion [{seccion}]")
    return config


def leer_web(config):
    web = config['WEB']
    datos = {
        'api_url': web.get('api_url', '').strip(),
        'sync_secret': web.get('sync_secret', '').strip(),
    }
    # Un placeholder del config de ejemplo cuenta como vacio.
    for k, v in datos.items():
        if v.startswith('<') or 'PEGAR' in v.upper():
            datos[k] = ''
    return datos


def cadena_conexion(config):
    dsn = config.get('CONEXION', 'dsn', fallback='').strip()
    catalogo = config.get('CONEXION', 'carpeta_datos', fallback='').strip()
    user = config.get('CONEXION', 'user', fallback='').strip()
    password = config.get('CONEXION', 'password', fallback='').strip()
    if not dsn and not catalogo:
        raise ValueError("Falta 'dsn' o 'carpeta_datos' en [CONEXION]")

    partes = [f'DSN={dsn}' if dsn else 'Driver={DBISAM 4 ODBC Driver}']
    if catalogo:
        partes.append(f'CatalogName={catalogo}')
    if user:
        partes.append(f'UID={user}')
    if password:
        partes.append(f'PWD={password}')
    partes.append('ReadOnly=True')   # este script nunca escribe en A2
    return ';'.join(partes) + ';'


def descripcion_conexion(config):
    """Para el log: de donde se lee, sin usuario ni clave."""
    dsn = config.get('CONEXION', 'dsn', fallback='').strip()
    catalogo = config.get('CONEXION', 'carpeta_datos', fallback='').strip()
    return f"DSN {dsn}" if dsn else f"carpeta {catalogo}"


def get_conn(config):
    import pyodbc  # aqui y no arriba: las pruebas corren sin el driver
    conn = pyodbc.connect(cadena_conexion(config), timeout=TIMEOUT_CONEXION)
    conn.timeout = TIMEOUT_CONSULTA   # el driver DBISAM puede ignorarlo; ver docs (tiempo maximo de la tarea)
    return conn


def leer_ventas(conn, hasta):
    desde = hasta - timedelta(days=DIAS_VENTANA - 1)
    cursor = conn.cursor()
    cursor.execute(SQL_VENTAS.format(desde=desde.isoformat()))
    return [tuple(f) for f in cursor.fetchall()]


def _a_fecha(valor):
    return valor.date() if isinstance(valor, datetime) else valor


def agregar(filas_sql, hasta):
    """filas_sql: tuplas (codigo, fecha, tipo, unidades). Devuelve el neto por (codigo, fecha)."""
    desde = hasta - timedelta(days=DIAS_VENTANA - 1)
    netos = defaultdict(float)
    for codigo, fecha, tipo, unidades in filas_sql:
        if tipo == TIPO_VENTA:
            signo = 1
        elif tipo == TIPO_DEVOLUCION:
            signo = -1
        else:
            continue
        fecha = _a_fecha(fecha)
        if not (desde <= fecha <= hasta):
            continue
        codigo = str(codigo).strip()
        if not codigo:
            continue
        netos[(codigo, fecha)] += signo * float(unidades or 0)

    resultado = []
    for (codigo, fecha) in sorted(netos):
        neto = round(netos[(codigo, fecha)], 4)
        if neto != 0:
            resultado.append({"codigo": codigo, "fecha": fecha.isoformat(), "unidades": neto})
    return resultado


def guardar_json(payload, config, logger):
    carpeta = ruta_absoluta(config.get('SALIDA', 'carpeta_salida', fallback='exportaciones'))
    os.makedirs(carpeta, exist_ok=True)
    ruta = os.path.join(carpeta, f"ventas_{datetime.now().strftime('%Y-%m-%d_%H%M%S')}.json")
    with open(ruta, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    logger.info(f"Copia guardada en: {ruta}")
    return ruta


def resumir_respuesta(texto):
    """Respuesta 200 de /api/sync-ventas en una linea legible."""
    try:
        r = json.loads(texto)
    except ValueError:
        return f"respuesta sin formato JSON: {texto[:200]}"
    if not isinstance(r, dict):
        return f"respuesta inesperada: {texto[:200]}"
    partes = [f"{r.get('guardadas', '?')} filas guardadas"]
    descartadas = r.get('descartadas') or 0
    if descartadas:
        partes.append(f"{descartadas} descartadas")
    if r.get('hasta'):
        partes.append(f"ventas hasta {r['hasta']}")
    return ", ".join(partes)


def pista_http(codigo):
    if codigo in PISTAS_HTTP:
        return PISTAS_HTTP[codigo]
    if codigo >= 500:
        return "Falla del lado del catalogo (Vercel/Supabase); la proxima corrida lo reintenta."
    return "Revisa api_url y sync_secret en el config_ventas.ini."


def enviar(payload, web, logger):
    """POST a /api/sync-ventas. Devuelve True si el servidor respondio 200."""
    if not web['api_url'] or not web['sync_secret']:
        logger.error("Falta api_url o sync_secret en [WEB] del config_ventas.ini. No se envia nada.")
        return False

    logger.info(f"Enviando {len(payload['filas'])} filas a {web['api_url']} ...")
    req = urllib.request.Request(
        web['api_url'],
        data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
        headers={
            "Authorization": f"Bearer {web['sync_secret']}",
            "Content-Type": "application/json; charset=utf-8",
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_HTTP) as resp:
            texto = resp.read().decode('utf-8', errors='replace')
            logger.info(f"Catalogo respondio OK: {resumir_respuesta(texto)}")
            logger.debug(f"Respuesta completa: {texto}")
            return True
    except urllib.error.HTTPError as e:
        logger.error(f"El catalogo respondio con error {e.code}: {e.read().decode('utf-8', errors='replace')[:500]}")
        logger.error(f"Que revisar: {pista_http(e.code)}")
    except Exception as e:
        logger.error(f"No se pudo conectar con el catalogo: {e}")
        logger.error("Que revisar: que la PC tenga internet y que api_url este bien escrita.")
    return False


def ejecutar(args, config, logger):
    """Una corrida completa. Devuelve (codigo_salida, resumen para la linea FIN)."""
    web = leer_web(config)
    hasta = date.today()
    desde = hasta - timedelta(days=DIAS_VENTANA - 1)
    logger.info(f"Leyendo ventas de A2 ({descripcion_conexion(config)}) del {desde:%d/%m/%Y} al {hasta:%d/%m/%Y} ...")

    try:
        conn = get_conn(config)
        try:
            filas_sql = leer_ventas(conn, hasta)
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"No se pudo leer A2 por ODBC: {e}")
        logger.error("Que revisar: que el driver DBISAM 4 este instalado (32 bits) y que 'carpeta_datos' "
                     "apunte a la carpeta Data de la empresa.")
        return 1, "ERROR leyendo A2"

    try:
        filas = agregar(filas_sql, hasta)
    except Exception as e:
        logger.error(f"Error procesando las ventas leidas de A2: {e}")
        return 1, "ERROR procesando ventas"
    logger.info(f"A2 devolvio {len(filas_sql)} lineas -> {len(filas)} filas netas por producto y dia")
    if not filas:
        logger.warning("No hay ventas en los ultimos 30 dias. No se envia nada (la pagina conserva los datos anteriores).")
        return 2, "SIN VENTAS"

    payload = {"hasta": hasta.isoformat(), "filas": filas}
    guardar_json(payload, config, logger)

    if args.solo_archivo:
        logger.info("Modo --solo-archivo: no se envio nada al catalogo.")
        return 0, f"OK solo archivo, {len(filas)} filas"

    if enviar(payload, web, logger):
        return 0, f"OK, {len(filas)} filas enviadas"
    return 1, "ERROR enviando al catalogo"


def main():
    parser = argparse.ArgumentParser(description='Extractor de ventas A2Softway -> Catalogo (reposicion)')
    parser.add_argument('--config', '-c', default=DEFAULT_CONFIG, help=f'Ruta del config_ventas.ini (default: {DEFAULT_CONFIG})')
    parser.add_argument('--solo-archivo', action='store_true', help='Extrae y guarda el JSON; no envia nada a la web')
    args = parser.parse_args()
    inicio = time.monotonic()

    try:
        config = cargar_config(args.config)
    except Exception as e:
        # Sin config igual queda registro en logs\ junto al programa: corriendo
        # desde el Programador de tareas nadie ve la consola.
        logger = setup_logging(ruta_absoluta('logs'), 'INFO', True)
        logger.info(f"===== INICIO extractor de ventas v{VERSION} =====")
        logger.error(f"{e}")
        logger.error("Que revisar: copia config_ventas.ejemplo.ini como config_ventas.ini junto al programa y completalo.")
        logger.info("===== FIN: ERROR de configuracion =====")
        sys.exit(1)

    carpeta_logs = ruta_absoluta(config.get('LOG', 'carpeta_logs', fallback='logs'))
    logger = setup_logging(
        carpeta_logs,
        config.get('LOG', 'nivel', fallback='INFO'),
        config.get('LOG', 'archivar', fallback='si').lower() == 'si',
    )
    modo = "solo archivo" if args.solo_archivo else "envio al catalogo"
    logger.info(f"===== INICIO extractor de ventas v{VERSION} ({modo}) =====")

    try:
        for nombre in limpiar_logs(carpeta_logs, DIAS_LOGS, date.today()):
            logger.info(f"Log viejo borrado: {nombre}")
        carpeta_salida = ruta_absoluta(config.get('SALIDA', 'carpeta_salida', fallback='exportaciones'))
        borradas = limpiar_exportaciones(carpeta_salida, DIAS_LOGS, date.today())
        if borradas:
            logger.info(f"Copias viejas borradas de {carpeta_salida}: {len(borradas)}")
        codigo, resumen = ejecutar(args, config, logger)
    except Exception:
        logger.exception("Error inesperado:")
        codigo, resumen = 1, "ERROR inesperado"

    nivel = logging.INFO if codigo == 0 else (logging.WARNING if codigo == 2 else logging.ERROR)
    logger.log(nivel, f"===== FIN: {resumen} ({time.monotonic() - inicio:.0f} s) =====")
    sys.exit(codigo)


if __name__ == '__main__':
    main()
