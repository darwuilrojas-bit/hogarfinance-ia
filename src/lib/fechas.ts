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
