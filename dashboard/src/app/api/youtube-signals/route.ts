import { NextResponse } from "next/server"
import path from "path"
import fs from "fs"

interface RawTickerMention {
  ticker: string
  contexto?: string
  sentimiento?: string
}

interface RawAnalysis {
  relevante?: boolean
  resumen_breve?: string
  tesis_principal?: string
  sentimiento_general?: string
  horizonte?: string
  tickers_mencionados?: RawTickerMention[]
  macro_temas?: string[]
  claims_clave?: string[]
  riesgos_mencionados?: string[]
  _error?: string
}

interface RawVideo {
  video_id: string
  title: string
  channel: string
  url: string
  published_text?: string
  fetched_at: string
  transcript_chars?: number
  lang?: string
  analysis?: RawAnalysis
  error?: string
  error_detail?: string
}

interface RawSignalsState {
  last_run: string | null
  channels: Record<string, { channel_id: string; last_checked: string; last_video_ids: string[] }>
  videos: Record<string, RawVideo>
}

export interface CrossMatch {
  ticker: string
  source: "portfolio" | "macro_opportunity"
  mentions: {
    video_id: string
    title: string
    channel: string
    url: string
    contexto: string
    sentimiento: string
    fetched_at: string
  }[]
}

export async function GET() {
  try {
    const rootDir   = path.join(process.cwd(), "..")
    const stateFile = path.join(rootDir, "youtube_signals.json")

    if (!fs.existsSync(stateFile)) {
      return NextResponse.json({
        last_run: null,
        videos: [],
        cross_matches: [],
        message: "Aún no hay señales — corre `python youtube_signals.py`",
      })
    }

    const state = JSON.parse(fs.readFileSync(stateFile, "utf-8")) as RawSignalsState

    // ── Tickers a cruzar: portfolio del usuario + macro_opportunities del reporte ──
    const portfolioTickers = new Set<string>()
    try {
      const pfPath = path.join(process.cwd(), "data", "portfolio.json")
      if (fs.existsSync(pfPath)) {
        const pf = JSON.parse(fs.readFileSync(pfPath, "utf-8"))
        for (const cat of pf.categories ?? []) {
          for (const s of cat.stocks ?? []) portfolioTickers.add(s.ticker.toUpperCase())
        }
      }
    } catch { /* sin portfolio */ }

    const macroOppTickers = new Set<string>()
    try {
      const reportPath = path.join(rootDir, "dashboard", "public", "data", "report.json")
      if (fs.existsSync(reportPath)) {
        const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"))
        const opps = report.macro_opportunities
        if (opps) {
          for (const horizon of ["short", "medium", "long"] as const) {
            for (const o of (opps[horizon] ?? []) as { tickers?: string[] }[]) {
              for (const t of o.tickers ?? []) macroOppTickers.add(t.toUpperCase())
            }
          }
          for (const g of (opps.hidden_gems ?? []) as { ticker: string }[]) {
            if (g.ticker) macroOppTickers.add(g.ticker.toUpperCase())
          }
        }
      }
    } catch { /* sin reporte */ }

    // ── Videos ordenados por fetched_at desc, solo con análisis exitoso ──────
    const videos = Object.values(state.videos)
      .filter(v => v.analysis && !v.analysis._error)
      .sort((a, b) => b.fetched_at.localeCompare(a.fetched_at))

    // ── Cross-match: por cada ticker en portfolio o macro_opps, busca menciones ──
    const matches = new Map<string, CrossMatch>()
    for (const v of videos) {
      for (const m of v.analysis?.tickers_mencionados ?? []) {
        const t = (m.ticker ?? "").toUpperCase().trim()
        if (!t) continue
        const inPortfolio = portfolioTickers.has(t)
        const inMacroOpp  = macroOppTickers.has(t)
        if (!inPortfolio && !inMacroOpp) continue

        const source: CrossMatch["source"] = inPortfolio ? "portfolio" : "macro_opportunity"
        const key = `${t}:${source}`
        if (!matches.has(key)) {
          matches.set(key, { ticker: t, source, mentions: [] })
        }
        matches.get(key)!.mentions.push({
          video_id:    v.video_id,
          title:       v.title,
          channel:     v.channel,
          url:         v.url,
          contexto:    m.contexto ?? "",
          sentimiento: m.sentimiento ?? "neutral",
          fetched_at:  v.fetched_at,
        })
      }
    }

    return NextResponse.json({
      last_run:      state.last_run,
      channels:      state.channels,
      videos:        videos.map(v => ({
        video_id:       v.video_id,
        title:          v.title,
        channel:        v.channel,
        url:            v.url,
        published_text: v.published_text ?? "",
        fetched_at:     v.fetched_at,
        analysis:       v.analysis,
      })),
      cross_matches: Array.from(matches.values())
        .sort((a, b) => b.mentions.length - a.mentions.length),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    )
  }
}
