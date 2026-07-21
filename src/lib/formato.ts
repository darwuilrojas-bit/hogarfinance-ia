/** Utilidades de formato compartidas (montos y fechas) en español. */

const formatoNumero = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatoCompacto = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 0,
});

export function formatMonto(valor: number): string {
  return `$ ${formatoNumero.format(valor)}`;
}

export function formatMontoCompacto(valor: number): string {
  return `$ ${formatoCompacto.format(valor)}`;
}

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export const MESES_CORTOS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

/** Período mes/año (mes en 1-12, como en la base de datos). */
export type Periodo = { mes: number; anio: number };

export function periodoActual(): Periodo {
  const hoy = new Date();
  return { mes: hoy.getMonth() + 1, anio: hoy.getFullYear() };
}

/** Suma (o resta) meses a un período. */
export function sumarMeses({ mes, anio }: Periodo, delta: number): Periodo {
  const total = anio * 12 + (mes - 1) + delta;
  return { mes: (total % 12) + 1, anio: Math.floor(total / 12) };
}

/** Los últimos `n` períodos terminando en `fin` (inclusive), en orden cronológico. */
export function ultimosPeriodos(fin: Periodo, n: number): Periodo[] {
  return Array.from({ length: n }, (_, i) => sumarMeses(fin, i - (n - 1)));
}
