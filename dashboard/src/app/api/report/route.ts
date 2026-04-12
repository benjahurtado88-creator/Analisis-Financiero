import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

// ── Mapa: símbolo del reporte → ticker Yahoo Finance ──────────────────────────
const TICKER_MAP: Record<string, string> = {
  // Crypto
  BTC:       "BTC-USD",
  ETH:       "ETH-USD",
  SOL:       "SOL-USD",
  TAO:       "TAO22974-USD",
  LINK:      "LINK-USD",
  XRP:       "XRP-USD",
  RENDER:    "RNDR-USD",
  RNDR:      "RNDR-USD",
  BNB:       "BNB-USD",
  ADA:       "ADA-USD",
  AVAX:      "AVAX-USD",
  DOGE:      "DOGE-USD",
  // Stocks & índices
  SPX:       "^GSPC",
  IXIC:      "^IXIC",
  DJI:       "^DJI",
  NVDA:      "NVDA",
  AVGO:      "AVGO",
  AMZN:      "AMZN",
  AAPL:      "AAPL",
  MSFT:      "MSFT",
  GOOGL:     "GOOGL",
  META:      "META",
  DVN:       "DVN",
  RKLB:      "RKLB",
  RYTM:      "RYTM",
  KO:        "KO",
  JNJ:       "JNJ",
  // Materiales (ETF proxies)
  XAU:       "GLD",   // Gold ETF
  CL:        "USO",   // Oil ETF
  XAG:       "SLV",   // Silver ETF
  HG:        "COPX",  // Copper miners ETF
  NG:        "UNG",   // Natural Gas ETF
  ZC:        "CORN",  // Corn ETF
  // Divisas
  DXY:       "DX-Y.NYB",
  "USD/MXN": "MXN=X",
  "USD/JPY": "JPY=X",
  "EUR/USD": "EURUSD=X",
  "GBP/USD": "GBPUSD=X",
  "USD/TRY": "TRY=X",
  "AUD/USD": "AUDUSD=X",
  "USD/CLP": "CLP=X",
}

// ── Cache en memoria: evita llamar Yahoo Finance en cada request ───────────────
const CACHE_TTL_MS = 60 * 1000  // 60 segundos
const priceCache = new Map<string, { price: number; ts: number }>()

function fmtChange(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`
}

function fmtPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (n >= 1)    return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

function fmtLarge(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`
  return `$${n.toFixed(2)}`
}

// ── Fetch precio desde Yahoo Finance v8 ───────────────────────────────────────
async function fetchYahooPrice(yfTicker: string): Promise<{
  price: number; change1d: number; change7d: number; change30d: number
  ytd: number; high52w: number; low52w: number; marketCap?: number; volume?: number
} | null> {
  // Revisar caché primero
  const cached = priceCache.get(yfTicker)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    // Solo cacheamos el precio exacto; los cambios siempre son frescos
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfTicker)}?interval=1d&range=1y`
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 60 },  // Next.js cache 60s
      signal: AbortSignal.timeout(8000),  // 8s max por ticker
    })
    if (!res.ok) return null

    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return null

    const closes: number[] = result.indicators?.quote?.[0]?.close ?? []
    const volumes: number[] = result.indicators?.quote?.[0]?.volume ?? []
    const meta = result.meta ?? {}

    // Filtrar nulls
    const validCloses = closes.filter((v: number) => v != null && !isNaN(v))
    if (validCloses.length < 2) return null

    const price    = validCloses[validCloses.length - 1]
    const prev1d   = validCloses[validCloses.length - 2]
    const prev7d   = validCloses.length > 7  ? validCloses[validCloses.length - 8]  : validCloses[0]
    const prev30d  = validCloses.length > 22 ? validCloses[validCloses.length - 23] : validCloses[0]

    // YTD: primer cierre del año actual
    const timestamps: number[] = result.timestamp ?? []
    const currentYear = new Date().getFullYear()
    let ytdStart = validCloses[0]
    for (let i = 0; i < timestamps.length; i++) {
      const yr = new Date(timestamps[i] * 1000).getFullYear()
      if (yr === currentYear && closes[i] != null) {
        ytdStart = closes[i]
        break
      }
    }

    const high52w = Math.max(...validCloses)
    const low52w  = Math.min(...validCloses)

    const pct = (a: number, b: number) => b ? ((a - b) / Math.abs(b)) * 100 : 0

    // Volume en USD (último día con datos)
    const validVols = volumes.filter((v: number) => v != null && v > 0)
    const vol = validVols.length > 0 ? validVols[validVols.length - 1] * price : undefined

    const marketCap = meta.marketCap ?? undefined

    priceCache.set(yfTicker, { price, ts: Date.now() })

    return {
      price,
      change1d:  pct(price, prev1d),
      change7d:  pct(price, prev7d),
      change30d: pct(price, prev30d),
      ytd:       pct(price, ytdStart),
      high52w,
      low52w,
      marketCap,
      volume: vol,
    }
  } catch {
    return null
  }
}

// ── API Route handler ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang") ?? "en"

  const reportFile = lang === "es" ? "report-es.json" : "report.json"
  let reportPath = path.join(process.cwd(), "public", "data", reportFile)

  if (!fs.existsSync(reportPath)) {
    // Fallback a inglés si no existe el español
    const fallback = path.join(process.cwd(), "public", "data", "report.json")
    if (!fs.existsSync(fallback)) {
      return NextResponse.json({ error: "No se encontró report.json" }, { status: 404 })
    }
    reportPath = fallback  // apuntar al fallback real
  }

  let report: Record<string, unknown>
  try {
    report = JSON.parse(fs.readFileSync(reportPath, "utf-8"))
  } catch {
    return NextResponse.json({ error: "Error leyendo report.json" }, { status: 500 })
  }

  // ── Actualizar precios en paralelo para todos los assets ──────────────────
  const sectors = report.sectors as Record<string, { assets: Record<string, unknown>[] }>
  if (sectors) {
    // Recopilar todos los fetch necesarios
    const tasks: Array<{
      sectorKey: string; assetIdx: number; yfTicker: string; symbol: string
    }> = []

    for (const [sectorKey, sectorData] of Object.entries(sectors)) {
      const assets = sectorData?.assets ?? []
      assets.forEach((asset, i) => {
        const sym = asset.symbol as string
        // Use TICKER_MAP if available; fall back to the symbol itself (works for most US stocks)
        const yf  = TICKER_MAP[sym] ?? sym
        if (yf && sym) tasks.push({ sectorKey, assetIdx: i, yfTicker: yf, symbol: sym })
      })
    }

    // Fetch todos en paralelo
    const results = await Promise.allSettled(
      tasks.map(t => fetchYahooPrice(t.yfTicker))
    )

    // Aplicar resultados a los assets
    results.forEach((result, idx) => {
      if (result.status !== "fulfilled" || !result.value) return
      const { sectorKey, assetIdx } = tasks[idx]
      const data = result.value
      const asset = sectors[sectorKey].assets[assetIdx]

      asset.current_price = fmtPrice(data.price)  // string formateado para los componentes
      asset.change_24h    = fmtChange(data.change1d)
      asset.change_7d     = fmtChange(data.change7d)
      asset.change_30d    = fmtChange(data.change30d)
      asset.ytd_change    = fmtChange(data.ytd)
      asset.week_52_high  = fmtPrice(data.high52w)
      asset.week_52_low   = fmtPrice(data.low52w)
      if (data.marketCap) asset.market_cap = fmtLarge(data.marketCap)
      if (data.volume)    asset.volume_24h  = fmtLarge(data.volume)
    })
  }

  report._prices_live    = true
  report._prices_updated = new Date().toISOString()

  return NextResponse.json(report, {
    headers: {
      "Cache-Control": "no-store",  // nunca cachear en browser
    },
  })
}
