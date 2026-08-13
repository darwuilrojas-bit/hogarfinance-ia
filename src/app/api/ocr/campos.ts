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
/**
 * Rótulos que identifican legítimamente al número de factura.
 * Normalizados: sin tildes, sin puntuación, en minúsculas.
 */
const ROTULOS_VALIDOS = [
  "liquidacion de servicios publicos",
  "lsp",
  "comprobante",
  "factura",
  "liquidacion",
  "nro de liquidacion",
];

/** Deja el rótulo comparable: sin tildes, sin símbolos, minúsculas. */
function normalizarRotulo(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * ¿El rótulo que el modelo dice haber visto junto al número corresponde
 * realmente al número de factura?
 *
 * El modelo de visión no siempre puede leer el identificador (en MetroGas
 * está impreso en gris muy claro) y entonces devuelve el número del código
 * de barras, que sí está nítido. Pedirle que además copie el rótulo permite
 * detectarlo: si lo que acompaña al número no es un rótulo de factura, el
 * valor se descarta y el usuario lo completa.
 */
export function rotuloEsDeFactura(rotulo: unknown): boolean {
  if (typeof rotulo !== "string") return false;
  const limpio = normalizarRotulo(rotulo);
  if (!limpio) return false;
  // "codigo de barras" contiene "codigo", no "factura": queda fuera solo.
  return ROTULOS_VALIDOS.some((valido) => limpio.includes(valido));
}

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
