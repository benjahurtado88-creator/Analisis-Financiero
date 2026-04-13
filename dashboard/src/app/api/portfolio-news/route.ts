import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import path from "path"
import fs from "fs"

const projectRoot = path.resolve(process.cwd(), "..")
const scriptPath  = path.join(projectRoot, "analisis_maia.py")
const tickerDir   = path.join(process.cwd(), "public", "data", "ticker")

// Refrescar si el archivo tiene más de 8 horas
const STALE_THRESHOLD_MS = 8 * 60 * 60 * 1000

function isStale(ticker: string): boolean {
  const jsonPath = path.join(tickerDir, `${ticker}.json`)
  if (!fs.existsSync(jsonPath)) return true
  const stat = fs.statSync(jsonPath)
  return (Date.now() - stat.mtimeMs) > STALE_THRESHOLD_MS
}

function readTickerJson(ticker: string) {
  const jsonPath = path.join(tickerDir, `${ticker}.json`)
  if (!fs.existsSync(jsonPath)) return null
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"))
    const stat = fs.statSync(jsonPath)
    return {
      noticias:   data.noticias_ticker ?? [],
      precio:     data.precio?.precio_actual,
      cambio_24h: data.precio?.cambio_24h,
      veredicto:  data.veredicto,
      _age_h:     Math.round((Date.now() - stat.mtimeMs) / 3600000),
    }
  } catch {
    return null
  }
}

function runScript(ticker: string): Promise<void> {
  return new Promise((resolve) => {
    exec(
      `python "${scriptPath}" ${ticker}`,
      { cwd: projectRoot, timeout: 90_000, env: { ...process.env, PYTHONUTF8: "1" } },
      () => resolve()
    )
  })
}

// GET — devuelve solo cache local, sin correr Python (instantáneo)
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const tickers = (url.searchParams.get("tickers") ?? "")
    .split(",").map(t => t.trim().toUpperCase()).filter(Boolean)

  if (!tickers.length) return NextResponse.json({ results: {} })

  const results: Record<string, ReturnType<typeof readTickerJson>> = {}
  for (const ticker of tickers) {
    results[ticker] = readTickerJson(ticker) ?? {
      noticias: [], precio: undefined, cambio_24h: undefined, veredicto: undefined, _age_h: -1
    }
  }
  return NextResponse.json({ results })
}

// POST — analiza tickers sin datos o con datos viejos (>8h) y devuelve todo
export async function POST(req: NextRequest) {
  let tickers: string[] = []
  try {
    const body = await req.json()
    tickers = (body.tickers ?? []).map((t: string) => t.toUpperCase().trim()).filter(Boolean)
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
  }

  if (!tickers.length) return NextResponse.json({ results: {} })

  // Analizar tickers sin JSON O con datos viejos (>8h) — en paralelo
  const toRefresh = tickers.filter(isStale)
  if (toRefresh.length > 0) {
    await Promise.all(toRefresh.map(runScript))
  }

  const results: Record<string, ReturnType<typeof readTickerJson>> = {}
  for (const ticker of tickers) {
    results[ticker] = readTickerJson(ticker) ?? {
      noticias: [], precio: undefined, cambio_24h: undefined, veredicto: undefined, _age_h: -1
    }
  }
  return NextResponse.json({ results })
}
