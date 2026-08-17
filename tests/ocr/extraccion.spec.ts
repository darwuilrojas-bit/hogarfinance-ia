import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { PROMPT_OCR } from "@/app/api/ocr/prompt";
import {
  rotuloEsDeFactura,
  textoComprobante,
  textoOperacion,
} from "@/app/api/ocr/campos";

/**
 * Banco de pruebas del OCR contra facturas reales.
 *
 * Este es el único test que ejercita el prompt de verdad: llama al modelo de
 * visión con una imagen y compara lo extraído contra lo que dice la factura.
 * Lint, build y los unitarios no prueban nada del prompt.
 *
 * Es opt-in porque cuesta tokens y necesita imágenes con datos reales, que
 * NO se versionan. Para correrlo:
 *
 *   1. Guardar las imágenes en  pruebas-ocr/   (ignorada por git)
 *   2. Describir lo esperado en pruebas-ocr/esperado.json:
 *
 *      [
 *        {
 *          "archivo": "metrogas.jpg",
 *          "proveedor": "MetroGas",
 *          "numero_comprobante": "B-0064-43054306",
 *          "monto": 40500.40,
 *          "no_debe_devolver": ["250002922059", "30010937466"]
 *        }
 *      ]
 *
 *   3. npm run test:ocr
 *
 * Sin carpeta o sin OPENAI_API_KEY, los tests se saltean.
 */

type CasoEsperado = {
  archivo: string;
  /** Alcanza con que el nombre leído contenga alguna de estas variantes. */
  proveedor?: string | string[];
  /** Debe salir exactamente este valor. */
  numero_comprobante?: string | null;
  /**
   * El valor correcto, para facturas donde el modelo a veces no puede leerlo.
   * Acepta ese valor o null (el sistema no debe inventar), pero nunca otro.
   * Es la garantía honesta cuando la impresión es ilegible para el modelo.
   */
  numero_comprobante_o_null?: string;
  monto?: number;
  fecha_vencimiento?: string;
  /** null si la factura no tiene segundo vencimiento. */
  fecha_vencimiento_2?: string | null;
  categoria?: string;
  /** Comprobantes de pago: número que asigna el medio de pago. */
  numero_operacion?: string | null;
  /** Comprobantes de pago: fecha en que se pagó, DD/MM/YYYY. */
  fecha_pago?: string | null;
  /** Valores que el modelo suele confundir y NO debe devolver como número. */
  no_debe_devolver?: string[];
};

const CARPETA = path.join(process.cwd(), "pruebas-ocr");
const CATALOGO = path.join(CARPETA, "esperado.json");

/** Solo corre si se pidió explícitamente: `npm run test:ocr`. */
const pedido = process.env.OCR_REAL === "1";
const hayClave = Boolean(process.env.OPENAI_API_KEY);
const hayCasos = fs.existsSync(CATALOGO);

const casos: CasoEsperado[] = hayCasos
  ? JSON.parse(fs.readFileSync(CATALOGO, "utf8"))
  : [];

const TIPOS: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

async function extraer(rutaImagen: string) {
  const ext = path.extname(rutaImagen).toLowerCase();
  const tipo = TIPOS[ext];
  if (!tipo) throw new Error(`Formato no soportado: ${ext}`);
  const base64 = fs.readFileSync(rutaImagen).toString("base64");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 500,
      // Mismos parámetros que producción: sin temperatura 0 el resultado
      // cambia en cada corrida y el banco de pruebas se vuelve inútil.
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT_OCR },
            {
              type: "image_url",
              // Mismo detalle que producción: sin "high" el modelo ve la
              // imagen en baja resolución y no lee la letra chica.
              image_url: {
                url: `data:${tipo};base64,${base64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI respondió ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const texto: string = data.choices?.[0]?.message?.content ?? "";
  const limpio = texto.replace(/```json\s*|```/g, "").trim();
  return JSON.parse(limpio);
}

test.describe("Extracción sobre facturas reales", () => {
  // Siempre existe al menos un test, para que la corrida explique qué falta
  // en vez de terminar con un críptico "No tests found".
  test("hay casos de prueba configurados", () => {
    test.skip(!pedido, "Banco de OCR: correr con `npm run test:ocr`");
    test.skip(
      !hayClave,
      "Falta OPENAI_API_KEY (se lee de .env.local al correr con --project=ocr)"
    );
    test.skip(
      !hayCasos,
      `Falta ${CATALOGO}: guardá las imágenes en pruebas-ocr/ y describí lo esperado en esperado.json (ver el encabezado de este archivo)`
    );
    expect(casos.length, "esperado.json no tiene casos").toBeGreaterThan(0);
  });

  for (const caso of casos) {
    test(`lee ${caso.archivo}`, async () => {
      test.skip(!pedido || !hayClave, "Banco de OCR: `npm run test:ocr`");
      test.setTimeout(90_000);
      const ruta = path.join(CARPETA, caso.archivo);
      expect(fs.existsSync(ruta), `Falta la imagen ${ruta}`).toBe(true);

      const crudo = await extraer(ruta);
      // Imprimir lo crudo: cuando un caso falla, lo primero que se necesita
      // ver es qué devolvió realmente el modelo.
      console.log(`\n${caso.archivo} →`, JSON.stringify(crudo, null, 2));

      // Misma validación que /api/ocr: el número solo vale si vino con un
      // rótulo de factura al lado.
      const numero = rotuloEsDeFactura(crudo.numero_comprobante_rotulo)
        ? textoComprobante(crudo.numero_comprobante)
        : null;

      if (caso.numero_comprobante !== undefined) {
        expect(numero, "número de factura").toBe(caso.numero_comprobante);
      }
      if (caso.numero_comprobante_o_null !== undefined) {
        expect(
          numero === caso.numero_comprobante_o_null || numero === null,
          `número de factura: se esperaba "${caso.numero_comprobante_o_null}" o null, salió "${numero}"`
        ).toBe(true);
      }
      for (const prohibido of caso.no_debe_devolver ?? []) {
        expect(numero, `no debe devolver ${prohibido}`).not.toBe(prohibido);
      }
      if (caso.proveedor !== undefined) {
        const leido = String(crudo.proveedor ?? "").toLowerCase();
        const variantes = Array.isArray(caso.proveedor)
          ? caso.proveedor
          : [caso.proveedor];
        expect(
          variantes.some((v) => leido.includes(v.toLowerCase())),
          `proveedor "${leido}" no coincide con ninguna de ${JSON.stringify(variantes)}`
        ).toBe(true);
      }
      if (caso.monto !== undefined) {
        expect(Number(crudo.monto), "monto").toBeCloseTo(caso.monto, 2);
      }
      if (caso.fecha_vencimiento !== undefined) {
        expect(crudo.fecha_vencimiento, "1er vencimiento").toBe(
          caso.fecha_vencimiento
        );
      }
      if (caso.fecha_vencimiento_2 !== undefined) {
        expect(crudo.fecha_vencimiento_2 ?? null, "2do vencimiento").toBe(
          caso.fecha_vencimiento_2
        );
      }
      if (caso.categoria !== undefined) {
        expect(crudo.categoria, "categoría").toBe(caso.categoria);
      }
      if (caso.numero_operacion !== undefined) {
        expect(
          textoOperacion(crudo.numero_operacion),
          "número de operación"
        ).toBe(caso.numero_operacion);
      }
      if (caso.fecha_pago !== undefined) {
        expect(crudo.fecha_pago ?? null, "fecha de pago").toBe(caso.fecha_pago);
      }
    });
  }
});
