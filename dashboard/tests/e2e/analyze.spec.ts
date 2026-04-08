import { test, expect } from "@playwright/test"

test.describe("Analyze page", () => {
  test.beforeEach(async ({ page }) => {
    // networkidle garantiza que React completó la hidratación y adjuntó event handlers
    await page.goto("/analyze", { waitUntil: "networkidle", timeout: 30000 })
  })

  test("carga la página correctamente", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /analizar/i })).toBeVisible()
    await expect(page.getByText(/ticker/i).first()).toBeVisible()
  })

  test("muestra el input de búsqueda activo", async ({ page }) => {
    const input = page.getByRole("textbox")
    await expect(input).toBeVisible()
    await expect(input).toBeEnabled()
  })

  test("el link 'volver al reporte' navega a /", async ({ page }) => {
    await Promise.all([
      page.waitForURL("/", { waitUntil: "commit", timeout: 30000 }),
      page.getByText("volver al reporte").click(),
    ])
    await expect(page).toHaveURL("/")
  })

  test("muestra instrucciones '¿Cómo funciona?' con los 3 pasos", async ({ page }) => {
    await expect(page.getByText(/cómo funciona/i)).toBeVisible()
    await expect(page.getByText("Escribes el ticker")).toBeVisible()
    await expect(page.getByText("El sistema analiza")).toBeVisible()
    await expect(page.getByText("Ver el informe")).toBeVisible()
  })

  test("muestra chips de sugerencias (AAPL, BTC, etc.)", async ({ page }) => {
    const chip = page.getByRole("button", { name: /^(AAPL|BTC|MSFT|NVDA)$/ }).first()
    await expect(chip).toBeVisible()
  })

  test("escribir un ticker activa el botón de analizar", async ({ page }) => {
    const input = page.getByRole("textbox")
    await input.click()
    // pressSequentially dispara eventos por carácter que React procesa correctamente
    await input.pressSequentially("NVDA", { delay: 50 })
    const btn = page.getByRole("button", { name: /^Analizar$/ })
    await expect(btn).toBeEnabled({ timeout: 5000 })
  })

  test("click en chip de sugerencia navega a /ticker/AAPL", async ({ page }) => {
    // Mockear /api/analyze para respuesta inmediata sin ejecutar Python
    await page.route("**/api/analyze", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ticker: "AAPL" }),
      })
    })
    await page.getByRole("button", { name: /^AAPL$/ }).click()
    await expect(page).toHaveURL(/ticker\/AAPL/, { timeout: 10000 })
  })

  test("submit con botón Analizar navega a /ticker/MSFT", async ({ page }) => {
    // Mockear /api/analyze — evita ejecutar Python en tests de flujo UI
    await page.route("**/api/analyze", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ticker: "MSFT" }),
      })
    })
    const input = page.getByRole("textbox")
    await input.click()
    await input.pressSequentially("MSFT", { delay: 50 })
    const btn = page.getByRole("button", { name: /^Analizar$/ })
    await expect(btn).toBeEnabled({ timeout: 5000 })
    await btn.click()
    await expect(page).toHaveURL(/ticker\/MSFT/, { timeout: 10000 })
  })
})
