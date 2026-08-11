/**
 * Normalización defensiva de campos devueltos por el modelo de visión.
 *
 * El modelo devuelve JSON libre: un mismo campo puede llegar como texto o
 * como número según lo que "vea" en la factura. Los identificadores
 * puramente numéricos (el "LSP" de AySA, por ejemplo) suelen llegar como
 * número JSON, así que un guard que sólo acepte string descarta datos
 * válidos en silencio.
 */

/**
 * Convierte a texto el identificador de un comprobante, venga como string
 * o como número. Devuelve null si no hay un valor utilizable.
 */
export function textoComprobante(v: unknown): string | null {
  if (typeof v === "number") {
    return Number.isFinite(v) ? String(v) : null;
  }
  if (typeof v === "string") {
    const limpio = v.trim();
    return limpio ? limpio : null;
  }
  return null;
}
