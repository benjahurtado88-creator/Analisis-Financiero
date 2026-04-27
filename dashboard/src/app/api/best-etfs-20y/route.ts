import { NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import Groq from "groq-sdk"

// ── Cache en memoria 4 horas ───────────────────────────────────────────────
const CACHE_TTL_MS = 4 * 60 * 60 * 1000

// Cache para "mejor 20 años" (global)
let cache20y: { data: AiEtf[]; ts: number; context_summary: string } | null = null

// Cache por categoría: clave = categoryId
const categoryCache = new Map<string, { data: AiEtf[]; ts: number; context_summary: string }>()

export interface AiEtf {
  ticker: string
  name: string
  tag: string
  reason_current: string
  reason_20y: string
  watch_out: string
  conviction: "high" | "medium"
}

// ── Universo para "mejor 20 años" ─────────────────────────────────────────
const ETF_CANDIDATES_20Y = [
  { ticker: "VTI",  name: "Vanguard Total Market",        category: "Mercado total EE.UU." },
  { ticker: "VOO",  name: "Vanguard S&P 500",             category: "S&P 500" },
  { ticker: "QQQ",  name: "Invesco Nasdaq-100",           category: "Tech / Nasdaq" },
  { ticker: "SCHD", name: "Schwab Dividend Equity",       category: "Dividendos crecientes" },
  { ticker: "VGT",  name: "Vanguard Info Tech",           category: "Tecnología S&P 500" },
  { ticker: "VT",   name: "Vanguard Total World",         category: "Mundo entero" },
  { ticker: "SOXX", name: "iShares Semiconductors",       category: "Semiconductores" },
  { ticker: "XLE",  name: "Energy Select SPDR",           category: "Energía / Petróleo" },
  { ticker: "ICLN", name: "iShares Clean Energy",         category: "Energía limpia" },
  { ticker: "IBB",  name: "iShares Biotechnology",        category: "Biotecnología" },
  { ticker: "VHT",  name: "Vanguard Health Care",         category: "Salud" },
  { ticker: "VNQ",  name: "Vanguard Real Estate",         category: "REITs / Inmobiliario" },
  { ticker: "BND",  name: "Vanguard Total Bond",          category: "Bonos EE.UU." },
  { ticker: "TLT",  name: "20+ Year Treasury",            category: "Bonos largo plazo" },
  { ticker: "EEM",  name: "iShares Emerging Markets",     category: "Mercados emergentes" },
  { ticker: "GLD",  name: "SPDR Gold Shares",             category: "Oro" },
]

// ── Leer contexto macro del reporte guardado ──────────────────────────────
function getMacroContext(): { macroCtx: string; newsCtx: string; oppsCtx: string; hasContext: boolean } {
  const reportPath = path.join(process.cwd(), "public", "data", "report.json")
  let macroCtx = "", newsCtx = "", oppsCtx = ""

  if (fs.existsSync(reportPath)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const report: any = JSON.parse(fs.readFileSync(reportPath, "utf-8"))
      const keyFactors: string[] = report.macro_environment?.key_factors ?? []
      macroCtx = [
        report.executive_summary ?? "",
        report.macro_environment?.summary ?? "",
        keyFactors.length > 0 ? `Factores clave: ${keyFactors.join(" | ")}` : "",
        report.macro_environment?.interest_rate_outlook ? `Tasas: ${report.macro_environment.interest_rate_outlook}` : "",
        report.macro_environment?.geopolitical_risk     ? `Riesgo geopolítico: ${report.macro_environment.geopolitical_risk}` : "",
      ].filter(Boolean).join("\n")

      const newsUsed: { title: string; source: string }[] = report._macro_news_used ?? []
      if (newsUsed.length > 0)
        newsCtx = newsUsed.map((n, i) => `${i + 1}. [${n.source}] ${n.title}`).join("\n")

      const longOpps: { theme: string; idea: string }[] = report.macro_opportunities?.long ?? []
      if (longOpps.length > 0)
        oppsCtx = longOpps.map(o => `• ${o.theme}: ${o.idea}`).join("\n")
    } catch { /* sin contexto */ }
  }

  return { macroCtx, newsCtx, oppsCtx, hasContext: macroCtx.length > 50 }
}

// ── Llamar a Groq con prompt configurable ────────────────────────────────
async function callGroq(prompt: string): Promise<AiEtf[]> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const result = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: "Eres un estratega de inversiones senior. Responde SOLO con JSON válido, sin markdown, sin explicaciones adicionales.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 2200,
  })
  const text = result.choices[0]?.message?.content ?? ""
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim()
  const match = cleaned.match(/\[[\s\S]*\]/)
  return JSON.parse(match ? match[0] : cleaned) as AiEtf[]
}

// ── Prompt base compartido ────────────────────────────────────────────────
function buildBaseContext(macroCtx: string, newsCtx: string, oppsCtx: string, hasContext: boolean): string {
  if (!hasContext) return "Sin contexto macro disponible — usa tu conocimiento del mercado actual."
  return [
    "═══ CONTEXTO MACRO ACTUAL ═══",
    macroCtx,
    newsCtx ? `\nNOTICIAS QUE MUEVEN EL MERCADO HOY:\n${newsCtx}` : "",
    oppsCtx ? `\nTENDENCIAS ESTRUCTURALES DETECTADAS:\n${oppsCtx}` : "",
  ].filter(Boolean).join("\n")
}

const PROMPT_RULES = `Reglas:
- Tus razones deben conectar con el contexto macro actual (cita eventos, datos y noticias reales si los tienes)
- NO des respuestas genéricas tipo "tiene buen historial". Di POR QUÉ dado lo que pasa HOY
- El watch_out debe ser un riesgo ESPECÍFICO y ACTUAL (no genérico)
- reason_current: conecta con noticias/datos del contexto dado
- reason_20y: por qué estructuralmente tiene sentido a largo plazo
- Solo JSON. Sin texto adicional.`

const RESPONSE_SCHEMA = `[
  {
    "ticker": "...",
    "name": "...",
    "tag": "Núcleo|Crecimiento|Rentas|Diversificación|Hedge|Ciclo largo",
    "reason_current": "Por qué dado el contexto actual tiene sentido AHORA (cita datos reales si los tienes)",
    "reason_20y": "Por qué estructuralmente es buena apuesta a largo plazo",
    "watch_out": "Riesgo específico y actual que el inversor debe tener en mente",
    "conviction": "high|medium"
  }
]`

// ═══════════════════════════════════════════════════════════════
// GET — Mejor para 20 años (universo completo)
// ═══════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1"

  if (!forceRefresh && cache20y && Date.now() - cache20y.ts < CACHE_TTL_MS) {
    return NextResponse.json({ ok: true, etfs: cache20y.data, context_summary: cache20y.context_summary, cached: true })
  }

  const { macroCtx, newsCtx, oppsCtx, hasContext } = getMacroContext()
  const today = new Date().toISOString().split("T")[0]
  const candidateList = ETF_CANDIDATES_20Y.map(e => `  - ${e.ticker}: ${e.name} (${e.category})`).join("\n")

  const prompt = `Eres un estratega de inversiones con 20 años de experiencia. Perfil: AGRESIVO (65% growth / 35% dividend). Fecha: ${today}.

${buildBaseContext(macroCtx, newsCtx, oppsCtx, hasContext)}

═══ TU TAREA ═══
Del siguiente universo, selecciona los MEJORES 5 o 6 ETFs para mantener 20 años sin mirar atrás.
Cada uno debe tener un rol claro: núcleo, crecimiento, renta, hedge, diversificación global.

ETFs candidatos:
${candidateList}

${PROMPT_RULES}

Responde con este schema:
${RESPONSE_SCHEMA}`

  try {
    const etfs = await callGroq(prompt)
    const context_summary = hasContext
      ? `Análisis basado en contexto real del ${today}: VIX, tasas, rotación sectorial${newsCtx ? " y noticias recientes" : ""}.`
      : `Análisis basado en conocimiento del mercado (ejecuta el refresh macro para incluir noticias del día).`

    cache20y = { data: etfs, ts: Date.now(), context_summary }
    return NextResponse.json({ ok: true, etfs, context_summary, cached: false })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════
// POST — Análisis profundo por categoría
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  let categoryId = "", categoryLabel = ""
  let etfList: { ticker: string; name: string }[] = []
  let forceRefresh = false

  try {
    const body = await req.json()
    categoryId    = body.categoryId    ?? ""
    categoryLabel = body.categoryLabel ?? ""
    etfList       = body.etfs          ?? []
    forceRefresh  = body.refresh       === true
  } catch {
    return NextResponse.json({ ok: false, error: "Payload inválido" }, { status: 400 })
  }

  if (!categoryId || etfList.length === 0)
    return NextResponse.json({ ok: false, error: "Faltan categoryId o etfs" }, { status: 400 })

  // Cache por categoría
  const cached = categoryCache.get(categoryId)
  if (!forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json({ ok: true, etfs: cached.data, context_summary: cached.context_summary, cached: true })
  }

  const { macroCtx, newsCtx, oppsCtx, hasContext } = getMacroContext()
  const today = new Date().toISOString().split("T")[0]
  const candidateList = etfList.map(e => `  - ${e.ticker}: ${e.name}`).join("\n")

  const prompt = `Eres un estratega de inversiones senior especializado en ETFs. Perfil del inversor: AGRESIVO (65% growth / 35% dividend). Fecha: ${today}.

${buildBaseContext(macroCtx, newsCtx, oppsCtx, hasContext)}

═══ TU TAREA ═══
Analiza en profundidad los siguientes ETFs del sector "${categoryLabel}".

Para CADA ETF de la lista, haz un análisis completo que responda:
1. ¿Qué está pasando HOY en este sector y cómo afecta a este ETF? (cita datos del contexto si los tienes)
2. ¿Por qué tiene sentido estructuralmente a largo plazo?
3. ¿Cuál es el riesgo principal AHORA MISMO para este ETF?

Además, asigna un "tag" que refleje su rol ideal: "Núcleo", "Crecimiento", "Rentas", "Hedge", "Diversificación", "Ciclo largo"
Y "conviction": "high" si lo recomiendas con fuerza, "medium" si depende del perfil.

ETFs a analizar (analiza TODOS, no selecciones):
${candidateList}

${PROMPT_RULES}

Responde con este schema (un objeto por cada ETF de la lista):
${RESPONSE_SCHEMA}`

  try {
    const etfs = await callGroq(prompt)
    const context_summary = hasContext
      ? `Análisis del sector "${categoryLabel}" con contexto del ${today}${newsCtx ? " · incluye noticias recientes" : ""}.`
      : `Análisis del sector "${categoryLabel}" — ejecuta el refresh macro para incluir noticias del día.`

    categoryCache.set(categoryId, { data: etfs, ts: Date.now(), context_summary })
    return NextResponse.json({ ok: true, etfs, context_summary, cached: false })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
