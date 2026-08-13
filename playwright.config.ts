import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de HogarFinance IA. Tres proyectos:
 *
 *   unit          lógica pura, sin navegador ni red
 *   mobile-chrome end-to-end sobre viewport de celular
 *   ocr           banco de pruebas del prompt contra facturas reales
 *
 * El proyecto `ocr` solo existe cuando se lo pide explícitamente
 * (`--project=ocr`): llama al modelo de visión y cuesta tokens, así que no
 * debe colarse en una corrida normal.
 *
 * Los flujos que requieren sesión iniciada (cargar factura, registrar pago)
 * no se automatizan: necesitan credenciales de un usuario real, que no se
 * versionan en el repositorio.
 */

// El config también se evalúa dentro de cada worker, donde process.argv ya
// no trae los flags. Por eso lo que tiene que llegar al worker viaja por
// variables de entorno, que sí se heredan del proceso padre.
const pedidoOcr =
  process.argv.includes("--project=ocr") || process.env.OCR_REAL === "1";
const pedidoUnit = process.argv.includes("--project=unit");

// Ni los unitarios ni el banco de OCR necesitan el dev server.
const sinServidor = pedidoUnit || pedidoOcr;

// Marca que el banco de OCR fue pedido explícitamente. Sin esto, los tests
// se saltean: una corrida normal no debe gastar tokens.
if (pedidoOcr) process.env.OCR_REAL = "1";

// El banco de OCR necesita la clave de OpenAI, que vive en .env.local.
// Playwright no carga .env por su cuenta.
if (pedidoOcr && !process.env.OPENAI_API_KEY) {
  const env = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(env)) {
    for (const linea of fs.readFileSync(env, "utf8").split("\n")) {
      const m = linea.match(/^\s*OPENAI_API_KEY\s*=\s*(.+)\s*$/);
      if (m) {
        process.env.OPENAI_API_KEY = m[1].trim().replace(/^["']|["']$/g, "");
        break;
      }
    }
  }
}

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    locale: "es-AR",
  },
  projects: [
    {
      // Tests unitarios de lógica pura: no necesitan navegador.
      name: "unit",
      testDir: "./tests/unit",
    },
    {
      // Banco de pruebas del prompt contra facturas reales. Los tests se
      // saltean salvo que se pida con `npm run test:ocr`: cuestan tokens.
      name: "ocr",
      testDir: "./tests/ocr",
    },
    {
      // La app es móvil-first: se prueba con un viewport de celular.
      name: "mobile-chrome",
      testDir: "./e2e",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer:
    sinServidor || process.env.BASE_URL
      ? undefined
      : {
          command: "npm run dev",
          url: "http://localhost:3000/login",
          reuseExistingServer: !process.env.CI,
          // La primera compilación de Turbopack puede pasar los 2 minutos
          // en una notebook sin GPU dedicada.
          timeout: 180_000,
        },
});
