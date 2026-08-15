/** DD/MM/YYYY (como devuelve el OCR) → YYYY-MM-DD (formato del input date). */
export function fechaAIso(f: string): string | null {
  const m = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

/** YYYY-MM-DD → DD/MM/YYYY (para comparar contra lo leído por el OCR). */
export function isoAFecha(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${Number(d).toString().padStart(2, "0")}/${m}/${a}`;
}

/**
 * Rango de un mes calendario, para filtrar por fecha de pago en Supabase:
 * `.gte("fecha_pago", desde).lt("fecha_pago", hasta)`.
 *
 * `hasta` es el día 1 del mes siguiente y el filtro es EXCLUSIVO, así no hay
 * que saber cuántos días tiene el mes ni preocuparse por los bisiestos.
 *
 * Se comparan cadenas YYYY-MM-DD, que ordenan igual que las fechas, para no
 * introducir zonas horarias: una fecha de pago es un día del calendario, no
 * un instante.
 */
export function rangoMes(mes: number, anio: number): {
  desde: string;
  hasta: string;
} {
  const mm = String(mes).padStart(2, "0");
  const siguienteMes = mes === 12 ? 1 : mes + 1;
  const siguienteAnio = mes === 12 ? anio + 1 : anio;
  const mmSiguiente = String(siguienteMes).padStart(2, "0");
  return {
    desde: `${anio}-${mm}-01`,
    hasta: `${siguienteAnio}-${mmSiguiente}-01`,
  };
}

/** Mes y año de una fecha YYYY-MM-DD, para agrupar del lado del cliente. */
export function mesDeIso(iso: string): { mes: number; anio: number } {
  const [a, m] = iso.split("-");
  return { mes: Number(m), anio: Number(a) };
}
