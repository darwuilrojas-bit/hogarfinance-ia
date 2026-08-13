import { expect, test } from "@playwright/test";
import { rotuloEsDeFactura, textoComprobante } from "@/app/api/ocr/campos";

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

test("acepta los rotulos que identifican al numero de factura", () => {
  expect(rotuloEsDeFactura("LIQUIDACION DE SERVICIOS PÚBLICOS")).toBe(true);
  expect(rotuloEsDeFactura("LSP")).toBe(true);
  expect(rotuloEsDeFactura("LSP - LIQUIDACIÓN DE SERVICIOS PÚBLICOS B18 N°")).toBe(true);
  expect(rotuloEsDeFactura("N° de comprobante")).toBe(true);
  expect(rotuloEsDeFactura("Nro. de liquidación")).toBe(true);
  expect(rotuloEsDeFactura("Número de factura")).toBe(true);
});

test("rechaza los rotulos que acompanan a otros numeros de la factura", () => {
  // El caso real de MetroGas: el modelo no puede leer el LSP en gris claro
  // y devuelve el numero del codigo de barras, que si esta nitido.
  expect(rotuloEsDeFactura("código de barras")).toBe(false);
  expect(rotuloEsDeFactura("Número de cliente")).toBe(false);
  expect(rotuloEsDeFactura("Cuenta de Servicios")).toBe(false);
  expect(rotuloEsDeFactura("Código de pago electrónico / débito automático")).toBe(false);
  expect(rotuloEsDeFactura("Para pagos Link")).toBe(false);
  expect(rotuloEsDeFactura("CUIT")).toBe(false);
  expect(rotuloEsDeFactura("Número de medidor")).toBe(false);
});

test("descarta el numero cuando no hay rotulo", () => {
  expect(rotuloEsDeFactura(null)).toBe(false);
  expect(rotuloEsDeFactura(undefined)).toBe(false);
  expect(rotuloEsDeFactura("")).toBe(false);
  expect(rotuloEsDeFactura("   ")).toBe(false);
  expect(rotuloEsDeFactura(123)).toBe(false);
});
