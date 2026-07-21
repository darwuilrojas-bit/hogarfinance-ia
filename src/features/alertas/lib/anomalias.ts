import { formatMontoCompacto, sumarMeses } from "@/lib/formato";
import type { Periodo } from "@/lib/formato";

type GastoMin = {
  proveedor: string;
  monto: number;
  periodo_mes: number;
  periodo_anio: number;
};

export type EvaluacionAnomalia = {
  esAnomalia: boolean;
  /** Gasto esperado (línea base con componente estacional). */
  baseline: number;
  /** Exceso mínimo sobre la línea base para considerar anomalía. */
  umbral: number;
  /** Desvío relativo del monto respecto de la línea base (0.25 = +25 %). */
  desvio: number;
};

function media(valores: number[]): number {
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

function desviacionEstandar(valores: number[], mu: number): number {
  if (valores.length < 2) return 0;
  const varianza =
    valores.reduce((s, v) => s + (v - mu) ** 2, 0) / (valores.length - 1);
  return Math.sqrt(varianza);
}

/**
 * Evaluación formal de anomalías (ver docs/especificacion-analitica.md):
 *
 *   B = 0.5·μ₃ + 0.5·m₁₂   (línea base: ventana reciente + mismo mes
 *                            del año anterior, si existe)
 *   U = max(0.2·B, σ)       (umbral: piso del 20 % o la variabilidad
 *                            natural del proveedor, lo que sea mayor)
 *   anomalía ⇔ monto > B + U
 *
 * Devuelve null si no hay historial reciente (sin línea base no hay
 * anomalía definible).
 */
export function evaluarAnomalia(
  gastos: GastoMin[],
  proveedor: string,
  monto: number,
  ref: Periodo
): EvaluacionAnomalia | null {
  // Ventana reciente: los 3 períodos anteriores a la referencia
  const ventana = [1, 2, 3].map((n) => sumarMeses(ref, -n));
  const recientes = gastos
    .filter(
      (g) =>
        g.proveedor === proveedor &&
        ventana.some((p) => p.mes === g.periodo_mes && p.anio === g.periodo_anio)
    )
    .map((g) => Number(g.monto));
  if (recientes.length === 0) return null;

  const mu3 = media(recientes);
  const sigma = desviacionEstandar(recientes, mu3);

  // Componente estacional: mismo mes del año anterior
  const anioPasado = gastos
    .filter(
      (g) =>
        g.proveedor === proveedor &&
        g.periodo_mes === ref.mes &&
        g.periodo_anio === ref.anio - 1
    )
    .map((g) => Number(g.monto));

  const baseline =
    anioPasado.length > 0 ? 0.5 * mu3 + 0.5 * media(anioPasado) : mu3;
  const umbral = Math.max(0.2 * baseline, sigma);

  return {
    esAnomalia: monto > baseline + umbral,
    baseline,
    umbral,
    desvio: monto / baseline - 1,
  };
}

/**
 * Mensaje único de alerta de anomalía. Lo comparten el guardado de
 * gastos y el motor de alertas, así el deduplicado por mensaje evita
 * avisos repetidos.
 */
export function mensajeAnomalia(
  proveedor: string,
  monto: number,
  baseline: number
): string {
  const pct = Math.round((monto / baseline - 1) * 100);
  return `⚠️ El gasto de ${proveedor} de este mes (${formatMontoCompacto(monto)}) es un ${pct}% mayor al promedio reciente (${formatMontoCompacto(baseline)}). ¿Lo revisaste?`;
}
