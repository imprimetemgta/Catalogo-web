"""
Envía el inventario exportado de A2 (JSON) al backend Next.js (/api/sync),
que hace el upsert en Supabase. Esta versión NO usa la llave de Supabase:
solo un secreto compartido, así la service_role vive únicamente en Vercel.

Uso:
    python subir_inventario.py                       # toma el JSON más reciente de la carpeta
    python subir_inventario.py ruta/al/archivo.json  # o un archivo específico

Requiere:
    pip install requests

Variables de entorno:
    API_SYNC_URL   -> https://TU-APP.vercel.app/api/sync
    SYNC_SECRET    -> el mismo secreto configurado en Vercel
    CARPETA_JSON   -> carpeta donde A2 deja los .json (opcional, def: actual)
"""

import os
import sys
import glob
import json

import requests

API_SYNC_URL = os.environ["API_SYNC_URL"]
SYNC_SECRET = os.environ["SYNC_SECRET"]
CARPETA_JSON = os.environ.get("CARPETA_JSON", ".")


def encontrar_json():
    if len(sys.argv) > 1:
        return sys.argv[1]
    archivos = sorted(glob.glob(os.path.join(CARPETA_JSON, "inventario_*.json")))
    if not archivos:
        sys.exit("No se encontró ningún archivo inventario_*.json en " + CARPETA_JSON)
    return archivos[-1]  # el nombre lleva la fecha: el último es el más nuevo


def main():
    ruta = encontrar_json()
    print("Enviando:", ruta)

    with open(ruta, encoding="utf-8") as f:
        registros = json.load(f)

    resp = requests.post(
        API_SYNC_URL,
        headers={
            "Authorization": f"Bearer {SYNC_SECRET}",
            "Content-Type": "application/json",
        },
        json=registros,
        timeout=120,
    )

    if resp.status_code != 200:
        sys.exit(f"Error {resp.status_code}: {resp.text}")

    print("Respuesta del backend:", resp.json())
    print("Sincronización completa.")


if __name__ == "__main__":
    main()
