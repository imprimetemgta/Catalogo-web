import importlib.util
import os
import tempfile
import unittest
from datetime import date, timedelta

RUTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts", "extraer_ventas.py")
spec = importlib.util.spec_from_file_location("extraer_ventas", RUTA)
ev = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ev)

HASTA = date(2026, 10, 21)


class AgregarTest(unittest.TestCase):
    def test_venta_menos_devolucion_da_neto(self):
        filas = [("A1", HASTA, 11, 3.0), ("A1", HASTA, 12, 1.0)]
        self.assertEqual(
            ev.agregar(filas, HASTA),
            [{"codigo": "A1", "fecha": "2026-10-21", "unidades": 2.0}],
        )

    def test_otros_tipos_se_ignoran(self):
        self.assertEqual(ev.agregar([("A1", HASTA, 13, 5.0)], HASTA), [])

    def test_codigo_con_espacios_se_agrupa(self):
        filas = [(" A1 ", HASTA, 11, 1.0), ("A1", HASTA, 11, 2.0)]
        self.assertEqual(
            ev.agregar(filas, HASTA),
            [{"codigo": "A1", "fecha": "2026-10-21", "unidades": 3.0}],
        )

    def test_ventana_de_30_dias(self):
        filas = [
            ("A1", HASTA - timedelta(days=30), 11, 1.0),
            ("B1", HASTA - timedelta(days=29), 11, 1.0),
        ]
        self.assertEqual(
            ev.agregar(filas, HASTA),
            [{"codigo": "B1", "fecha": "2026-09-22", "unidades": 1.0}],
        )

    def test_fechas_futuras_se_descartan(self):
        self.assertEqual(ev.agregar([("A1", HASTA + timedelta(days=1), 11, 1.0)], HASTA), [])

    def test_neto_cero_se_omite(self):
        filas = [("A1", HASTA, 11, 2.0), ("A1", HASTA, 12, 2.0)]
        self.assertEqual(ev.agregar(filas, HASTA), [])

    def test_redondea_a_4_decimales(self):
        r = ev.agregar([("A1", HASTA, 11, 0.123456)], HASTA)
        self.assertEqual(r[0]["unidades"], 0.1235)

    def test_salida_ordenada(self):
        d1 = HASTA - timedelta(days=1)
        filas = [("B", HASTA, 11, 1.0), ("A", HASTA, 11, 1.0), ("A", d1, 11, 1.0)]
        r = ev.agregar(filas, HASTA)
        self.assertEqual([(x["codigo"], x["fecha"]) for x in r],
                         [("A", "2026-10-20"), ("A", "2026-10-21"), ("B", "2026-10-21")])


class LogsTest(unittest.TestCase):
    def test_limpiar_logs_borra_solo_los_viejos_de_ventas(self):
        with tempfile.TemporaryDirectory() as d:
            for nombre in ("ventas_20260801.log", "ventas_20260822.log", "ventas_20261021.log",
                           "ventas_malo.log", "otro_20200101.log"):
                open(os.path.join(d, nombre), "w").close()
            borrados = ev.limpiar_logs(d, 60, HASTA)  # limite: 22/08/2026
            self.assertEqual(borrados, ["ventas_20260801.log"])
            self.assertEqual(sorted(os.listdir(d)),
                             ["otro_20200101.log", "ventas_20260822.log", "ventas_20261021.log", "ventas_malo.log"])

    def test_limpiar_exportaciones_borra_solo_las_viejas(self):
        with tempfile.TemporaryDirectory() as d:
            for nombre in ("ventas_2026-08-01_090000.json", "ventas_2026-10-21_170000.json",
                           "ventas_x.json", "inventario_2020-01-01.json"):
                open(os.path.join(d, nombre), "w").close()
            self.assertEqual(ev.limpiar_exportaciones(d, 60, HASTA), ["ventas_2026-08-01_090000.json"])
            self.assertEqual(len(os.listdir(d)), 3)

    def test_limpiar_logs_sin_carpeta(self):
        self.assertEqual(ev.limpiar_logs(os.path.join(tempfile.gettempdir(), "no-existe-xyz"), 60, HASTA), [])


class RespuestaTest(unittest.TestCase):
    def test_resumen_con_descartadas(self):
        self.assertEqual(ev.resumir_respuesta('{"ok":true,"hasta":"2026-10-21","guardadas":600,"descartadas":6}'),
                         "600 filas guardadas, 6 descartadas, ventas hasta 2026-10-21")

    def test_resumen_sin_descartadas(self):
        self.assertEqual(ev.resumir_respuesta('{"ok":true,"hasta":"2026-10-21","guardadas":10,"descartadas":0}'),
                         "10 filas guardadas, ventas hasta 2026-10-21")

    def test_resumen_no_json(self):
        self.assertTrue(ev.resumir_respuesta("<html>").startswith("respuesta sin formato JSON"))

    def test_pistas_http(self):
        self.assertIn("SYNC_SECRET", ev.pista_http(401))
        self.assertIn("/api/sync-ventas", ev.pista_http(404))
        self.assertIn("catalogo", ev.pista_http(503))
        self.assertIn("api_url", ev.pista_http(418))


if __name__ == "__main__":
    unittest.main()
