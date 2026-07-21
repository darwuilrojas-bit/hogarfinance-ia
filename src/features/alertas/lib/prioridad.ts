import type { Alerta, TipoAlerta } from "@/lib/supabase/types";

/**
 * Peso base por tipo de alerta: refleja el impacto económico de
 * ignorar cada aviso (ver docs/especificacion-analitica.md §3).
 */
const PESO_TIPO: Record<TipoAlerta, number> = {
  presupuesto: 100,
  vencimiento: 80,
  anomalia: 60,
  resumen: 40,
};

/** Puntos de urgencia que pierde una alerta por cada día de antigüedad. */
const DECAIMIENTO_POR_DIA = 2;

/**
 * Puntaje de urgencia:  S(a) = W(tipo) − 2·días_de_antigüedad.
 * El decaimiento evita que una alerta urgente vieja tape
 * indefinidamente a una nueva de menor peso.
 */
export function puntajeUrgencia(a: Alerta, ahora: Date = new Date()): number {
  const dias = Math.max(
    0,
    (ahora.getTime() - new Date(a.fecha_alerta).getTime()) / 86_400_000
  );
  return PESO_TIPO[a.tipo] - DECAIMIENTO_POR_DIA * dias;
}

/**
 * Orden del panel: no leídas primero (por puntaje de urgencia
 * descendente), después las leídas (por fecha descendente).
 */
export function ordenarPorUrgencia(alertas: Alerta[]): Alerta[] {
  const ahora = new Date();
  return [...alertas].sort((x, y) => {
    if (x.leida !== y.leida) return x.leida ? 1 : -1;
    if (x.leida) {
      return (
        new Date(y.fecha_alerta).getTime() - new Date(x.fecha_alerta).getTime()
      );
    }
    return puntajeUrgencia(y, ahora) - puntajeUrgencia(x, ahora);
  });
}
