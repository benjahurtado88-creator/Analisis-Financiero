import { test, expect } from "@playwright/test"

const TICKERS_WITH_DATA = ["NVDA", "BTC", "KO"]

test.describe("Ticker deep-dive page", () => {
  for (const ticker of TICKERS_WITH_DATA) {
    test(`/ticker/${ticker} carga sin error`, async ({ page }) => {
      await page.goto(`/ticker/${ticker}`)
      // No debe mostrar el Application error de Next.js (error 500 real)
      await expect(page.getByText(/Application error|unhandled error/i)).not.toBeVisible({ timeout: 5000 })
      // El ticker debe aparecer en la página
      await expect(page.getByText(ticker, { exact: false }).first()).toBeVisible({ timeout: 20000 })
    })
  }

  test("/ticker/NVDA muestra precio actual con $", async ({ page }) => {
    await page.goto("/ticker/NVDA")
    // Precio con formato $X,XXX
    const price = page.getByText(/\$[\d,]+/).first()
    await expect(price).toBeVisible({ timeout: 20000 })
  })

  test("/ticker/NVDA muestra RSI", async ({ page }) => {
    await page.goto("/ticker/NVDA")
    await expect(page.getByText(/RSI/i).first()).toBeVisible({ timeout: 20000 })
  })

  test("/ticker/NVDA muestra veredicto (COMPRA/MANTENER/VENDER)", async ({ page }) => {
    await page.goto("/ticker/NVDA")
    const verdict = page.getByText(/compra fuerte|compra|mantener|vender/i).first()
    await expect(verdict).toBeVisible({ timeout: 20000 })
  })

  test("/ticker/KO muestra sección de dividendos", async ({ page }) => {
    await page.goto("/ticker/KO")
    const dividendSection = page.getByText(/dividend|dividendo/i).first()
    await expect(dividendSection).toBeVisible({ timeout: 20000 })
  })

  test("/ticker/BTC carga sin Application error (crash de servidor)", async ({ page }) => {
    // El bug de MoatRisksCard con moat={} estaba crasheando — verifica que esté fijo
    const response = await page.goto(`/ticker/BTC`)
    // El status HTTP no debe ser 500
    expect(response?.status()).not.toBe(500)
    // La página no debe mostrar el error de Next.js (distinto de texto "500" en contenido)
    await expect(page.getByText(/Application error/i)).not.toBeVisible({ timeout: 10000 })
    await expect(page.getByText("BTC", { exact: false }).first()).toBeVisible({ timeout: 20000 })
  })

  test("ticker inválido muestra mensaje de error de análisis", async ({ page }) => {
    await page.goto("/ticker/XYZINVALIDTICKER999")
    // El ticker page muestra "No se pudo cargar el análisis" cuando no existe el JSON
    const errMsg = page.getByText(/no se pudo cargar|ticker no encontrado|no encontrado/i).first()
    await expect(errMsg).toBeVisible({ timeout: 30000 })
  })
})
