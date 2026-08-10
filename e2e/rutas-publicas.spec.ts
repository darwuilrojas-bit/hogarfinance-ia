import { expect, test } from "@playwright/test";

/**
 * Pantallas accesibles sin sesión iniciada: login, registro y recuperación
 * de contraseña. Se usan selectores accesibles (roles y etiquetas) para que
 * los tests no se rompan al cambiar clases de Tailwind.
 */

test.describe("Inicio de sesión", () => {
  test("muestra el formulario con sus campos", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: /HogarFinance/i })).toBeVisible();
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
  });

  test("lleva a registro y vuelve a login", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("link", { name: "Registrate" }).click();
    await expect(page).toHaveURL(/\/registro$/);
    await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeVisible();

    await page.getByRole("link", { name: "Iniciá sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("Registro", () => {
  test("rechaza una contraseña de menos de 6 caracteres", async ({ page }) => {
    await page.goto("/registro");

    await page.getByLabel("Correo electrónico").fill("prueba@ejemplo.com");
    await page.getByLabel("Contraseña", { exact: true }).fill("123");
    await page.getByLabel("Confirmar contraseña").fill("123");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(
      page.getByText("La contraseña debe tener al menos 6 caracteres.")
    ).toBeVisible();
  });

  test("avisa cuando las contraseñas no coinciden", async ({ page }) => {
    await page.goto("/registro");

    await page.getByLabel("Correo electrónico").fill("prueba@ejemplo.com");
    await page.getByLabel("Contraseña", { exact: true }).fill("claveSegura1");
    await page.getByLabel("Confirmar contraseña").fill("otraDistinta1");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page.getByText("Las contraseñas no coinciden.")).toBeVisible();
  });
});

test.describe("Recuperación de contraseña", () => {
  test("es accesible desde el login y pide el correo", async ({ page }) => {
    await page.goto("/recuperar");

    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Enviar enlace de recuperación" })
    ).toBeVisible();

    await page.getByRole("link", { name: "Volver a iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
