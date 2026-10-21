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

Ninguna clave vive en este archivo: todo se lee de config_ventas.ini.
El config_ventas.ini con claves reales nunca se sube a GitHub.

Uso:
    py -3-32 extraer_ventas.py                       (config_ventas.ini junto al script)
    py -3-32 extraer_ventas.py -c C:\\ruta\\config_ventas.ini
    py -3-32 extraer_ventas.py --solo-archivo        (extrae y guarda, no envia nada)

Codigos de salida: 0 = listo, 1 = error de conexion/configuracion/envio,
2 = no hubo ventas en los ultimos 30 dias (no se envia nada).

Requiere Python de 32 bits (el driver DBISAM 4 ODBC es de 32 bits) y:
    pip install pyodbc
"""

import os
import sys
import json
import argparse
import logging
import configparser
import urllib.request
import urllib.error
from collections import defaultdict
from datetime import date, datetime, timedelta

DIR_SCRIPT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CONFIG = os.path.join(DIR_SCRIPT, "config_ventas.ini")

DIAS_VENTANA = 30          # hasta - 29 dias .. hasta, ambos incluidos
TIPO_VENTA = 11
TIPO_DEVOLUCION = 12
TIMEOUT_HTTP = 60          # segundos

SQL_VENTAS = (
    "SELECT FDI_CODIGO, FDI_FECHAOPERACION, FDI_TIPOOPERACION, SUM(FDI_CANTIDAD) "
    "FROM SDetalleVenta "
    "WHERE FDI_FECHAOPERACION >= '{desde}' AND FDI_TIPOOPERACION IN (11,12) "
    "GROUP BY FDI_CODIGO, FDI_FECHAOPERACION, FDI_TIPOOPERACION"
)


def ruta_absoluta(ruta):
    # Rutas relativas del config se resuelven junto al script, no segun la
    # carpeta desde donde se lance (el Programador de tareas arranca en System32).
    return ruta if os.path.isabs(ruta) else os.path.join(DIR_SCRIPT, ruta)


def setup_logging(carpeta_logs, nivel, archivar):
    handlers = [logging.StreamHandler(sys.stdout)]
    if archivar:
        os.makedirs(carpeta_logs, exist_ok=True)
        fecha = datetime.now().strftime("%Y%m%d")
        handlers.append(logging.FileHandler(os.path.join(carpeta_logs, f"ventas_{fecha}.log"), encoding='utf-8'))

    logging.basicConfig(
        level=getattr(logging, nivel.upper(), logging.INFO),
        format='[%(asctime)s] %(levelname)s: %(message)s',
        datefmt='%H:%M:%S',
        handlers=handlers
    )
    return logging.getLogger(__name__)


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


def get_conn(config):
    import pyodbc  # aqui y no arriba: las pruebas corren sin el driver
    return pyodbc.connect(cadena_conexion(config))


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
    logger.info(f"JSON guardado en: {ruta}")
    return ruta


def enviar(payload, web, logger):
    """POST a /api/sync-ventas. Devuelve True si el servidor respondio 200."""
    if not web['api_url'] or not web['sync_secret']:
        logger.error("Falta api_url o sync_secret en [WEB]. No se envia nada.")
        return False

    logger.info(f"Enviando {len(payload['filas'])} filas a {web['api_url']}...")
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
            logger.info(f"Respuesta {resp.getcode()}: {resp.read().decode('utf-8', errors='replace')}")
            return True
    except urllib.error.HTTPError as e:
        logger.error(f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')}")
    except Exception as e:
        logger.error(f"Error de red: {e}")
    return False


def main():
    parser = argparse.ArgumentParser(description='Extractor de ventas A2Softway -> Catalogo (reposicion)')
    parser.add_argument('--config', '-c', default=DEFAULT_CONFIG, help=f'Ruta del config_ventas.ini (default: {DEFAULT_CONFIG})')
    parser.add_argument('--solo-archivo', action='store_true', help='Extrae y guarda el JSON; no envia nada a la web')
    args = parser.parse_args()

    try:
        config = cargar_config(args.config)
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

    logger = setup_logging(
        ruta_absoluta(config.get('LOG', 'carpeta_logs', fallback='logs')),
        config.get('LOG', 'nivel', fallback='INFO'),
        config.get('LOG', 'archivar', fallback='si').lower() == 'si',
    )
    web = leer_web(config)
    hasta = date.today()

    try:
        conn = get_conn(config)
        try:
            filas_sql = leer_ventas(conn, hasta)
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error leyendo A2 por ODBC: {e}")
        logger.error("Revisa que Python sea de 32 bits, que el driver DBISAM 4 este instalado y que 'carpeta_datos' apunte a la carpeta Data de la empresa.")
        sys.exit(1)

    filas = agregar(filas_sql, hasta)
    logger.info(f"Filas de A2: {len(filas_sql)} -> filas netas por producto y dia: {len(filas)}")
    if not filas:
        logger.warning("No hay ventas en los ultimos 30 dias. No se envia nada.")
        sys.exit(2)

    payload = {"hasta": hasta.isoformat(), "filas": filas}
    guardar_json(payload, config, logger)

    if args.solo_archivo:
        logger.info("--solo-archivo: no se envio nada a la web.")
        return

    sys.exit(0 if enviar(payload, web, logger) else 1)


if __name__ == '__main__':
    main()
