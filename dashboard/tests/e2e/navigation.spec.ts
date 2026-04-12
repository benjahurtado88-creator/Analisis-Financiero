import { test, expect } from "@playwright/test"

test.describe("Navegación general", () => {
  test("/ carga y muestra el brand tododeia", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await expect(page.getByText("tododeia", { exact: false })).toBeVisible({ timeout: 55000 })
  })

  test("/analyze carga correctamente", async ({ page }) => {
    await page.goto("/analyze", { waitUntil: "domcontentloaded" })
    await expect(page).toHaveURL(/analyze/)
    await expect(page.getByRole("heading").first()).toBeVisible()
  })

  test("/portfolio carga sin Application error", async ({ page }) => {
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" })
    await expect(page.getByText(/Application error|unhandled error/i)).not.toBeVisible()
  })

  test("link 'volver al reporte' en /analyze lleva a /", async ({ page }) => {
    await page.goto("/analyze", { waitUntil: "domcontentloaded" })
    await page.getByText(/volver/i).click()
    await expect(page).toHaveURL("/")
  })

  test("titulo del browser no está vacío", async ({ page }) => {
    await page.goto("/analyze", { waitUntil: "domcontentloaded" })
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })

  test("no hay errores de consola graves en /analyze", async ({ page }) => {
    const errors: string[] = []
    page.on("console", msg => {
      if (msg.type() === "error") errors.push(msg.text())
    })
    await page.goto("/analyze", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(2000)

    const criticalErrors = errors.filter(e =>
      !e.includes("hydrat") &&
      !e.includes("Warning") &&
      !e.includes("favicon") &&
      !e.includes("NEXT_") &&
      !e.includes("webpack")
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test("no hay errores de consola graves en /", async ({ page }) => {
    const errors: string[] = []
    page.on("console", msg => {
      if (msg.type() === "error") errors.push(msg.text())
    })
    await page.goto("/", { waitUntil: "domcontentloaded" })
    // Esperar solo domcontentloaded — no networkidle (Yahoo Finance requests en background)
    await page.waitForTimeout(3000)

    const criticalErrors = errors.filter(e =>
      !e.includes("hydrat") &&
      !e.includes("Warning") &&
      !e.includes("favicon") &&
      !e.includes("NEXT_") &&
      !e.includes("webpack")
    )
    expect(criticalErrors).toHaveLength(0)
  })
})
