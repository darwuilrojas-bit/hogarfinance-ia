import { expect, test } from "@playwright/test";
import { rotuloEsDeFactura, textoComprobante } from "@/app/api/ocr/campos";

/**
 * Regresión: una factura de AySA se guardó sin número de comprobante.
 * El modelo devolvía el "LSP" como número JSON y el guard, que sólo
 * aceptaba string, lo descartaba en silencio.
 */

test("acepta los identificadores reales de las tres facturas del banco", () => {
  expect(textoComprobante("0111B15587107")).toBe("0111B15587107"); // AySA
  expect(textoComprobante("B-0064-43054306")).toBe("B-0064-43054306"); // MetroGas
  expect(textoComprobante("B 0501-84370495 18")).toBe("B 0501-84370495 18"); // Edesur
  expect(textoComprobante("  0001-A00123456  ")).toBe("0001-A00123456");
});

test("descarta los numeros puramente numericos", () => {
  // Caso real de MetroGas: el modelo no puede leer el identificador (impreso
  // en gris claro) y devuelve el número del código de barras, que es puro
  // dígito. Las liquidaciones de servicios públicos llevan la clase de
  // comprobante (A/B/C), así que un valor sin letras no es el número.
  expect(textoComprobante("250009229205")).toBeNull();
  expect(textoComprobante("30010937466")).toBeNull(); // número de cliente
  expect(textoComprobante(123456789)).toBeNull();
});

test("saca el rotulo cuando el modelo lo antepone al valor", () => {
  expect(textoComprobante("LSP B-0064-43054306")).toBe("B-0064-43054306");
  expect(textoComprobante("N° 0001-A00123456")).toBe("0001-A00123456");
  expect(textoComprobante("Nro. B 0501-84370495 18")).toBe("B 0501-84370495 18");
});

test("descarta la lectura de Edesur a la que el modelo le perdio la clase", () => {
  // Caso real: el valor impreso es "B 0501-84370495 18" y el modelo devuelve
  // "LSP 8501-84370495 18" — cambió la B por el rótulo y leyó 8501 en lugar
  // de 0501. Sin la letra de clase no hay identificador válido: null, y el
  // usuario lo completa.
  expect(textoComprobante("LSP 8501-84370495 18")).toBeNull();
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
