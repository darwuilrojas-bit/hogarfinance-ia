import { expect, test } from "@playwright/test";
import { textoComprobante } from "@/app/api/ocr/campos";

/**
 * Regresión: una factura de AySA se guardó sin número de comprobante.
 * El modelo devolvía el "LSP" como número JSON y el guard, que sólo
 * aceptaba string, lo descartaba en silencio.
 */

test("acepta el numero de comprobante cuando llega como numero JSON", () => {
  // El caso de AySA: el LSP es puramente numérico.
  expect(textoComprobante(123456789)).toBe("123456789");
});

test("acepta el numero de comprobante cuando llega como texto", () => {
  expect(textoComprobante("0001-00123456")).toBe("0001-00123456");
  expect(textoComprobante("  12345678  ")).toBe("12345678");
});

test("acepta identificadores con letras, como el LSP de AySA", () => {
  expect(textoComprobante("0111B15587107")).toBe("0111B15587107");
});

test("descarta la etiqueta del campo cuando el modelo la devuelve en lugar del valor", () => {
  // Caso real: el modelo devolvió "LSP" (el rótulo) en vez del número.
  // Un identificador de factura siempre tiene al menos un dígito.
  expect(textoComprobante("LSP")).toBeNull();
  expect(textoComprobante("N° de factura")).toBeNull();
  expect(textoComprobante("Nro. de liquidación")).toBeNull();
});

test("descarta valores que no sirven", () => {
  expect(textoComprobante(null)).toBeNull();
  expect(textoComprobante(undefined)).toBeNull();
  expect(textoComprobante("")).toBeNull();
  expect(textoComprobante("   ")).toBeNull();
  expect(textoComprobante({})).toBeNull();
  expect(textoComprobante(Number.NaN)).toBeNull();
});
