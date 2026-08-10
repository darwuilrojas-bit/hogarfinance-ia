import { defineConfig, devices } from "@playwright/test";

/**
 * Tests end-to-end de HogarFinance IA.
 *
 * Cubren las rutas públicas y la protección de rutas privadas del proxy
 * de sesión. Los flujos que requieren sesión iniciada (cargar factura,
 * registrar pago) no se automatizan acá: necesitan credenciales de un
 * usuario de prueba, que no se versionan en el repositorio.
 */
export default defineConfig({
  testDir: "./e2e",
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
      // La app es móvil-first: se prueba con un viewport de celular.
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000/login",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
