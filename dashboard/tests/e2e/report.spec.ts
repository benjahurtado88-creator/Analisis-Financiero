import { test, expect } from "@playwright/test"

async function dismissLanguagePicker(page: import("@playwright/test").Page) {
  const picker = page.getByText("Choose your language")
  if (await picker.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByRole("button", { name: /english/i }).click()
    await page.waitForTimeout(400)
  }
}

async function gotoReport(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await dismissLanguagePicker(page)
  // #main-content solo aparece cuando los datos cargaron (no en el LoadingSkeleton)
  await expect(page.locator("#main-content")).toBeVisible({ timeout: 55000 })
}

// ─── Suite: Reporte Principal ─────────────────────────────────────────────────

test.describe("Report page", () => {
  test.beforeEach(async ({ page }) => {
    await gotoReport(page)
  })

  test("carga el reporte sin error visible", async ({ page }) => {
    await expect(page.getByText("No report data found")).not.toBeVisible()
    await expect(page.locator("#main-content")).toBeVisible()
  })

  test("muestra el executive summary", async ({ page }) => {
    const summary = page.locator("#main-content").locator("p").first()
    await expect(summary).toBeVisible({ timeout: 10000 })
    const text = await summary.textContent()
    expect((text ?? "").length).toBeGreaterThan(20)
  })

  test("muestra la sección Macro Environment", async ({ page }) => {
    await expect(page.locator("#main-content").getByText(/macro|environment|entorno/i).first()).toBeVisible()
  })

  test("muestra el Portfolio Allocation con porcentajes", async ({ page }) => {
    // Buscar cualquier elemento con % dentro del main
    const pct = page.locator("#main-content").getByText(/%/).first()
    await expect(pct).toBeVisible({ timeout: 10000 })
  })

  test("muestra Top Picks con al menos un asset", async ({ page }) => {
    const recommendation = page.locator("#main-content").getByText(/buy|hold|sell/i).first()
    await expect(recommendation).toBeVisible()
  })

  test("muestra Sector Overview con sectores conocidos", async ({ page }) => {
    const sectorLabel = page.locator("#main-content").getByText(/crypto|stocks|currencies|materials/i).first()
    await expect(sectorLabel).toBeVisible()
  })

  test("muestra Historical Accuracy", async ({ page }) => {
    const accuracy = page.locator("#main-content").getByText(/accuracy|precision|histor/i).first()
    await expect(accuracy).toBeVisible()
  })

  test("muestra el Disclaimer al final", async ({ page }) => {
    const disclaimer = page.locator("body").getByText(/not financial advice|no es asesor|educational/i)
    await expect(disclaimer.first()).toBeVisible()
  })
})

// ─── Suite: Language Toggle ───────────────────────────────────────────────────

test.describe("Language toggle", () => {
  test("cambia idioma a Español", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    const esBtnPicker = page.getByRole("button", { name: /español/i })
    if (await esBtnPicker.isVisible({ timeout: 3000 }).catch(() => false)) {
      await esBtnPicker.click()
    }
    await expect(page.getByText(/análisis|reporte|portafolio/i).first()).toBeVisible({ timeout: 15000 })
  })

  test("persiste idioma después de recargar", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    const esBtnPicker = page.getByRole("button", { name: /español/i })
    if (await esBtnPicker.isVisible({ timeout: 3000 }).catch(() => false)) {
      await esBtnPicker.click()
    }
    await page.reload({ waitUntil: "domcontentloaded" })
    await expect(page.getByText(/análisis|reporte|Cripto/i).first()).toBeVisible({ timeout: 15000 })
  })
})

// ─── Suite: Detailed Analysis (acordeón de sectores) ─────────────────────────

test.describe("Detailed Analysis accordion", () => {
  test.beforeEach(async ({ page }) => {
    await gotoReport(page)
  })

  test("el sector accordion existe en el DOM", async ({ page }) => {
    const accordion = page.locator("[id^='sector-']").first()
    await expect(accordion).toBeAttached({ timeout: 15000 })
  })
})
