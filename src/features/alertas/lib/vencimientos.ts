/** Utilidades compartidas para calcular vencimientos de servicios. */

/**
 * Próxima fecha de vencimiento para un día habitual del mes (1-31),
 * a partir de `hoy`. Si el mes no tiene ese día (p. ej. 31 en
 * febrero), usa el último día del mes.
 */
export function proximaFecha(diaHabitual: number, hoy: Date): Date {
  const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  if (diaHabitual < hoy.getDate()) {
    fecha.setMonth(fecha.getMonth() + 1);
  }
  const ultimoDia = new Date(
    fecha.getFullYear(),
    fecha.getMonth() + 1,
    0
  ).getDate();
  fecha.setDate(Math.min(diaHabitual, ultimoDia));
  return fecha;
}

/**
 * Fecha efectiva de una factura con hasta dos vencimientos:
 * el 1° si todavía no pasó; si pasó y el 2° sigue vigente, el 2°;
 * si ambos pasaron, el 1° (la deuda quedó vencida desde entonces).
 */
export function vencimientoEfectivo(
  fecha1: string,
  fecha2: string | null,
  hoy: Date
): Date {
  const f1 = new Date(`${fecha1}T00:00:00`);
  if (!fecha2) return f1;
  const base = new Date(hoy);
  base.setHours(0, 0, 0, 0);
  if (f1 >= base) return f1;
  const f2 = new Date(`${fecha2}T00:00:00`);
  if (f2 >= base) return f2;
  return f1;
}

/** Días de diferencia entre `hoy` (a medianoche) y `fecha`. */
export function diasHasta(fecha: Date, hoy: Date): number {
  const base = new Date(hoy);
  base.setHours(0, 0, 0, 0);
  return Math.round((fecha.getTime() - base.getTime()) / 86_400_000);
}

export type NivelUrgencia = {
  texto: string;
  fondo: string;
};

/**
 * Clases de color según urgencia: rojo 1-3 días, naranja 4-7,
 * amarillo 8-15, verde más de 15.
 */
export function urgenciaPorDias(dias: number): NivelUrgencia {
  if (dias <= 3) return { texto: "text-red-600", fondo: "bg-red-50" };
  if (dias <= 7) return { texto: "text-orange-600", fondo: "bg-orange-50" };
  if (dias <= 15) return { texto: "text-amber-600", fondo: "bg-amber-50" };
  return { texto: "text-secondary", fondo: "bg-secondary-light" };
}

/** Texto corto de días restantes: "Hoy", "Mañana", "En N días". */
export function textoDias(dias: number): string {
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Mañana";
  return `En ${dias} días`;
}
