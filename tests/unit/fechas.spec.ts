import { expect, test } from "@playwright/test";
import { mesDeIso, rangoMes } from "@/lib/fechas";

test("el rango de un mes va del dia 1 al dia 1 del mes siguiente", () => {
  expect(rangoMes(8, 2026)).toEqual({
    desde: "2026-08-01",
    hasta: "2026-09-01",
  });
});

test("diciembre cierra contra enero del anio siguiente", () => {
  expect(rangoMes(12, 2026)).toEqual({
    desde: "2026-12-01",
    hasta: "2027-01-01",
  });
});

test("los meses de un digito se rellenan con cero", () => {
  expect(rangoMes(1, 2026)).toEqual({
    desde: "2026-01-01",
    hasta: "2026-02-01",
  });
  expect(rangoMes(9, 2026)).toEqual({
    desde: "2026-09-01",
    hasta: "2026-10-01",
  });
});

test("febrero funciona igual en anio bisiesto y en anio comun", () => {
  // El rango es exclusivo por arriba, asi que no importa si febrero tiene
  // 28 o 29 dias: en los dos casos termina el 1 de marzo.
  expect(rangoMes(2, 2024)).toEqual({
    desde: "2024-02-01",
    hasta: "2024-03-01",
  });
  expect(rangoMes(2, 2026)).toEqual({
    desde: "2026-02-01",
    hasta: "2026-03-01",
  });
});

test("el ultimo dia del mes entra en el rango", () => {
  const { desde, hasta } = rangoMes(8, 2026);
  const ultimoDia = "2026-08-31";
  expect(ultimoDia >= desde && ultimoDia < hasta).toBe(true);
  // Y el primero del mes siguiente queda afuera.
  expect("2026-09-01" < hasta).toBe(false);
});

test("mesDeIso extrae mes y anio de una fecha", () => {
  expect(mesDeIso("2026-08-13")).toEqual({ mes: 8, anio: 2026 });
  expect(mesDeIso("2025-01-01")).toEqual({ mes: 1, anio: 2025 });
});
