import { test, expect } from "@playwright/test"

test.describe("API /api/report", () => {
  test("GET /api/report?lang=en devuelve JSON válido", async ({ request }) => {
    const res = await request.get("/api/report?lang=en", { timeout: 90000 })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty("sectors")
    expect(body).toHaveProperty("risk_profile")
    expect(body).toHaveProperty("portfolio_allocation")
  })

  test("GET /api/report incluye al menos un sector con assets", async ({ request }) => {
    const res = await request.get("/api/report?lang=en", { timeout: 90000 })
    const body = await res.json()

    const sectors = body.sectors as Record<string, { assets: unknown[] }>
    const sectorKeys = Object.keys(sectors)
    expect(sectorKeys.length).toBeGreaterThan(0)

    const hasAssets = sectorKeys.some(k => sectors[k]?.assets?.length > 0)
    expect(hasAssets).toBe(true)
  })

  test("GET /api/report — los assets tienen current_price (string con $ o número)", async ({ request }) => {
    const res = await request.get("/api/report?lang=en", { timeout: 90000 })
    const body = await res.json()

    const sectors = body.sectors as Record<string, { assets: { current_price: string | number }[] }>
    for (const sector of Object.values(sectors)) {
      for (const asset of (sector?.assets ?? [])) {
        const cp = asset.current_price
        if (cp !== undefined && cp !== null && cp !== "ver mercado") {
          // Si es string formateado debe empezar con $; si es número debe ser positivo
          if (typeof cp === "string") {
            expect(cp).toMatch(/^\$|ver mercado/)
          } else {
            expect(typeof cp).toBe("number")
            expect(cp).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  test("GET /api/report?lang=es devuelve JSON válido", async ({ request }) => {
    const res = await request.get("/api/report?lang=es", { timeout: 90000 })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty("sectors")
  })

  test("GET /api/report — portfolio_allocation suma 100", async ({ request }) => {
    const res = await request.get("/api/report?lang=en", { timeout: 90000 })
    const body = await res.json()

    const allocation = body.portfolio_allocation as Record<string, number>
    const total = Object.values(allocation).reduce((a, b) => a + b, 0)
    expect(total).toBeGreaterThanOrEqual(99)
    expect(total).toBeLessThanOrEqual(101)
  })

  test("GET /api/report — risk_adjusted_picks tiene al menos 3 picks", async ({ request }) => {
    const res = await request.get("/api/report?lang=en", { timeout: 90000 })
    const body = await res.json()

    expect(Array.isArray(body.risk_adjusted_picks)).toBe(true)
    expect((body.risk_adjusted_picks as unknown[]).length).toBeGreaterThanOrEqual(3)
  })
})

test.describe("API /api/analyze", () => {
  // Este test llama a Python analisis_maia.py — puede tardar 60-120s
  test("POST /api/analyze con ticker AAPL devuelve análisis", async ({ request }) => {
    test.setTimeout(180000)
    const res = await request.post("/api/analyze", {
      data: { ticker: "AAPL" },
      timeout: 150000,
    })

    expect([200, 202]).toContain(res.status())
    const body = await res.json()
    expect(body).toBeTruthy()
  })
})
