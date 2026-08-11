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
 * o como número.
 *
 * Rechaza los valores sin ningún dígito: todo identificador de factura los
 * tiene, así que un valor puramente alfabético significa que el modelo
 * devolvió la etiqueta del campo ("LSP", "N° de factura") en lugar de su
 * valor. Es preferible dejarlo vacío, que el usuario ve y completa, antes
 * que guardar una etiqueta como si fuera el número.
 */
export function textoComprobante(v: unknown): string | null {
  let texto: string;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    texto = String(v);
  } else if (typeof v === "string") {
    texto = v.trim();
  } else {
    return null;
  }
  if (!texto) return null;
  if (!/\d/.test(texto)) return null;
  return texto;
}
