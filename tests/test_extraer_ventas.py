import importlib.util
import os
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


if __name__ == "__main__":
    unittest.main()
