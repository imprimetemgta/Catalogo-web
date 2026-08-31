"""
Sube las imágenes de productos a Supabase Storage.

Los archivos se llaman FI_IMAGEN<codigo>.jpg (o .jpeg) y se suben al bucket
como <codigo>.jpg. Solo sube las que cambiaron (guarda un hash por archivo),
así puede correr seguido sin resubir todo.

Corre en el SERVIDOR de la oficina (donde están las imágenes).

Requiere:
    pip install requests

Variables de entorno:
    SUPABASE_URL                 -> https://TU-PROYECTO.supabase.co
    SUPABASE_SERVICE_ROLE_KEY    -> llave service_role (secreta)
    CARPETA_IMAGENES             -> carpeta donde están los FI_IMAGEN*.jpg
    BUCKET_IMAGENES              -> nombre del bucket (opcional, def: productos)
"""

import os
import re
import sys
import glob
import json
import hashlib

import requests

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
CARPETA_IMAGENES = os.environ["CARPETA_IMAGENES"]
BUCKET = os.environ.get("BUCKET_IMAGENES", "productos")

CACHE = os.path.join(CARPETA_IMAGENES, ".subidas_cache.json")


def safe_name(codigo):
    # Mismo saneo que usa el backend para armar la URL.
    return re.sub(r"[^A-Za-z0-9._-]", "_", codigo)


def cargar_cache():
    try:
        with open(CACHE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def guardar_cache(c):
    try:
        with open(CACHE, "w", encoding="utf-8") as f:
            json.dump(c, f)
    except Exception as e:
        print("[AVISO] no se pudo guardar el cache:", e)


def subir(codigo, ruta):
    with open(ruta, "rb") as f:
        data = f.read()
    nombre = f"{safe_name(codigo)}.jpg"
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{nombre}"
    return requests.post(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
            "Content-Type": "image/jpeg",
            "x-upsert": "true",  # sobrescribe si ya existe
        },
        timeout=60,
    )


def main():
    archivos = []
    for patron in ("FI_IMAGEN*.jpg", "FI_IMAGEN*.jpeg"):
        archivos += glob.glob(os.path.join(CARPETA_IMAGENES, patron))

    if not archivos:
        print("No se encontraron imágenes FI_IMAGEN*.jpg en", CARPETA_IMAGENES)
        return

    cache = cargar_cache()
    subidas = saltadas = errores = 0

    for ruta in archivos:
        base = os.path.basename(ruta)
        m = re.match(r"FI_IMAGEN(.+)\.(jpg|jpeg)$", base, re.IGNORECASE)
        if not m:
            continue
        codigo = m.group(1)

        with open(ruta, "rb") as f:
            h = hashlib.md5(f.read()).hexdigest()

        if cache.get(codigo) == h:
            saltadas += 1
            continue  # sin cambios desde la última subida

        r = subir(codigo, ruta)
        if r.status_code in (200, 201):
            cache[codigo] = h
            subidas += 1
        else:
            errores += 1
            print(f"[ERROR] {codigo}: {r.status_code} {r.text[:200]}")

    guardar_cache(cache)
    print(f"Subidas: {subidas} · Sin cambios: {saltadas} · Errores: {errores}")


if __name__ == "__main__":
    main()
