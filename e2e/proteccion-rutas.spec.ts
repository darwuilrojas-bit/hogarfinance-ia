import { expect, test } from "@playwright/test";

/**
 * El proxy de sesión (src/proxy.ts) debe mandar al login a cualquier visitante
 * sin sesión que intente abrir una ruta privada. Es la primera línea de defensa
 * del control de acceso: la segunda son las políticas RLS de PostgreSQL, que no
 * se pueden verificar desde el navegador.
 */

const RUTAS_PRIVADAS = [
  "/",
  "/gastos",
  "/facturas",
  "/facturas/nueva",
  "/comprobantes",
  "/comprobantes/nuevo",
  "/reportes",
  "/alertas",
  "/perfil",
  "/ayuda",
];

for (const ruta of RUTAS_PRIVADAS) {
  test(`redirige al login al entrar sin sesión a ${ruta}`, async ({ page }) => {
    await page.goto(ruta);

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
  });
}

test("las rutas públicas no redirigen", async ({ page }) => {
  for (const ruta of ["/login", "/registro", "/recuperar"]) {
    await page.goto(ruta);
    await expect(page).toHaveURL(new RegExp(`${ruta}$`));
  }
});
