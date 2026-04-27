import { NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import Groq from "groq-sdk"

// ── Detectar tipo de agente según el ticker ───────────────────────────────────
function detectAgentType(data: Record<string, unknown>): "crypto" | "stocks" | "startups" | "materials" | "currencies" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const info = data.info as any
  const esCripto = data.es_cripto as boolean

  if (esCripto) return "crypto"

  const sector = (info?.sector ?? "").toLowerCase()
  const industria = (info?.industria ?? "").toLowerCase()
  const marketCapB = (info?.market_cap ?? 0) / 1e9

  // ETFs de materiales/commodities
  const materialSymbols = ["GLD", "SLV", "GDX", "USO", "XOM", "DVN", "XLE", "COPX", "UNG", "CORN", "WEAT"]
  const ticker = (data.ticker as string ?? "").toUpperCase()
  if (materialSymbols.includes(ticker)) return "materials"

  // Startups: small/mid cap + growth
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const revGrowth = (info?.revenue_growth ?? 0) as number
  if (marketCapB > 0 && marketCapB < 15 && revGrowth > 0.25) return "startups"

  // Sector tecnología o healthcare con alta tasa de crecimiento
  if (sector.includes("tech") || sector.includes("communication") || sector.includes("health")) {
    if (revGrowth > 0.15 || marketCapB < 10) return "startups"
  }

  // Por defecto: stocks
  if (sector.includes("basic material") || sector.includes("energy") || industria.includes("gold") || industria.includes("oil")) {
    return "materials"
  }

  return "stocks"
}

// ── Construye contexto compacto con todos los datos Python del ticker ─────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTickerContext(data: any): string {
  const p    = data.precio        ?? {}
  const f    = data.fundamentales ?? {}
  const fv   = data.fair_value    ?? {}
  const esc  = data.escenarios    ?? {}
  const moat = data.moat          ?? {}
  const dcf  = data.dcf           ?? {}
  const ev   = data.eventos       ?? {}
  const s    = data.sentimiento   ?? {}
  const info = data.info          ?? {}
  const riesgos = Array.isArray(data.riesgos) ? data.riesgos : []

  const lines: string[] = [
    `TICKER: ${data.ticker} | TIPO: ${data.es_cripto ? "Cripto" : "Acción"} | SECTOR: ${info.sector ?? "N/A"} — ${info.industria ?? ""}`,
    `VEREDICTO PYTHON: ${data.veredicto} | Score: ${data.score}/10`,
    "",
    "── PRECIO Y TÉCNICOS ──",
    `Precio actual: $${p.precio_actual} | 24h: ${p.cambio_24h}% | 7d: ${p.cambio_7d}% | 30d: ${p.cambio_30d}% | YTD: ${p.cambio_ytd}%`,
    `RSI: ${p.rsi} | MACD: ${p.macd_bullish ? "ALCISTA ↑" : "BAJISTA ↓"} | SMA Trend: ${p.tendencia_sma}`,
    `Soporte: $${p.soporte} | Resistencia: $${p.resistencia} | 52w: $${p.low_52w} – $${p.high_52w}`,
    `Volumen relativo: ${p.vol_relativo}x`,
  ]

  if (Object.keys(f).length > 0) {
    lines.push("", "── FUNDAMENTALES ──")
    const fParts = [
      f.pe         != null ? `P/E: ${f.pe}` : "",
      f.forward_pe != null ? `P/E forward: ${f.forward_pe}` : "",
      f.roe        != null ? `ROE: ${(f.roe < 2 ? (f.roe * 100).toFixed(1) : f.roe)}%` : "",
      f.net_margin != null ? `Margen neto: ${f.net_margin}%` : f.margin != null ? `Margen neto: ${(f.margin * 100).toFixed(1)}%` : "",
      f.fcf_yield  != null ? `FCF Yield: ${f.fcf_yield < 1 ? (f.fcf_yield * 100).toFixed(1) : f.fcf_yield}%` : "",
      f.de         != null ? `D/E: ${f.de}` : "",
      f.int_cov    != null ? `Cobertura intereses: ${f.int_cov}x` : "",
    ].filter(Boolean)
    if (fParts.length) lines.push(fParts.join(" | "))
  }

  if (info.analyst_target) {
    lines.push("", "── CONSENSO ANALISTAS ──")
    lines.push(`Target: $${info.analyst_target} | Low: $${info.analyst_low} | High: $${info.analyst_high}`)
    lines.push(`Recomendación: ${info.analyst_rec} | Analistas: ${info.analyst_count}`)
  }

  if (fv.fair_value_pe || fv.fair_value_ev) {
    lines.push("", "── VALORACIÓN ──")
    if (fv.fair_value_pe) lines.push(`Fair Value P/E: $${fv.fair_value_pe} | Margen de seguridad: ${fv.safety_margin_pct ?? fv.margen_seguridad}%`)
    if (fv.buy_zone_aggressive) lines.push(`Zona compra agresiva: $${fv.buy_zone_aggressive} | Conservadora: $${fv.buy_zone_conservative}`)
  }

  if (dcf.valor_intrinseco) {
    lines.push(`DCF (${dcf.metodo ?? ""}): Valor intrínseco $${dcf.valor_intrinseco} | Margen: ${dcf.margen_seguridad_pct}%`)
  }

  if (esc.base) {
    lines.push("", "── ESCENARIOS ──")
    lines.push(`Bull: $${esc.bull} (+${esc.bull_upside}%) | Base: $${esc.base} (${esc.base_upside}%) | Bear: $${esc.bear} (${esc.bear_upside}%)`)
    if (esc.base_fuente) lines.push(`Fuente escenarios: ${esc.base_fuente}`)
  }

  if (moat.nivel) {
    lines.push("", "── MOAT COMPETITIVO ──")
    lines.push(`${moat.nivel} (${moat.score}/${moat.max})`)
    if (moat.factores?.length) lines.push(moat.factores.join(" | "))
  }

  if (riesgos.length > 0) {
    lines.push("", "── RIESGOS ESTRUCTURADOS ──")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    riesgos.slice(0, 4).forEach((r: any) => {
      lines.push(`[${r.nivel ?? "?"}] ${r.categoria}: ${r.descripcion}`)
    })
  }

  if (s.label && !s._error) {
    lines.push("", "── SENTIMIENTO TÉCNICO ──")
    lines.push(`${s.label} (${s.score}/10) | Buzz: ${s.buzz_level ?? "N/A"}`)
    if (s.reddit_bullish_pct) lines.push(`Reddit: ${s.reddit_bullish_pct}% bullish | Twitter/X: ${s.twitter_bullish_pct}% bullish`)
    if (s.fear_greed) {
      const fg = s.fear_greed as { value: number; classification: string }
      lines.push("", "── FEAR & GREED INDEX (dato real de hoy) ──")
      lines.push(`${fg.value}/100 — ${fg.classification}`)
    }
    if (s.social_cripto) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sc = s.social_cripto as any
      lines.push("", "── DATOS SOCIALES CRYPTO (dato real CoinGecko) ──")
      if (sc.sentiment_bullish_pct != null) lines.push(`Sentiment: ${sc.sentiment_bullish_pct?.toFixed(1)}% bullish / ${sc.sentiment_bearish_pct?.toFixed(1)}% bearish`)
      if (sc.watchlist_users != null)       lines.push(`Watchlists: ${sc.watchlist_users?.toLocaleString()} usuarios en cartera | Rank #${sc.market_cap_rank}`)
    }
  }

  if (ev.earnings_fecha) {
    lines.push("", "── PRÓXIMOS EVENTOS ──")
    lines.push(`Earnings: ${ev.earnings_fecha} | EPS estimado: $${ev.earnings_eps_est}`)
  }

  if (info.revenue_growth) {
    lines.push("", "── CRECIMIENTO ──")
    lines.push(`Revenue growth YoY: ${(info.revenue_growth * 100).toFixed(1)}% | Earnings growth: ${(info.earnings_growth * 100).toFixed(1)}%`)
    lines.push(`Market cap: $${(info.market_cap / 1e9).toFixed(1)}B | Beta: ${info.beta}`)
  }

  return lines.filter(l => l !== undefined).join("\n")
}

// ── Prompts especializados por tipo de agente ─────────────────────────────────
function buildAgentPrompt(agentType: string, tickerCtx: string, today: string): string {
  const base = `Fecha: ${today}. PERFIL INVERSOR: AGRESIVO — 65% Growth [GROWTH 🚀] / 35% Dividend [DIVIDENDO 💰].\n\n${tickerCtx}\n\n`

  const instrucciones: Record<string, string> = {
    crypto: `${base}Eres el Agente Crypto de Finance.ia. Analiza este activo crypto con criterio especializado:
1. Ciclo de mercado: ¿en qué fase está? (acumulación/distribución/tendencia)
2. Técnico: RSI, MACD, SMAs — ¿hay setup técnico válido?
3. Fear & Greed Index (si aparece en los datos): úsalo como evidencia directa del sentimiento real
4. Datos sociales Reddit/Twitter (si aparecen): úsalos para medir actividad real de la comunidad
5. Risk/reward: ¿el upside justifica el riesgo con este perfil agresivo?

CALIBRACIÓN DE CONFIANZA (CRÍTICO — no ignorar):
- Si tienes Fear & Greed + datos sociales reales en los datos: confianza puede llegar a 8-9
- Si solo tienes técnicos/precio sin F&G ni datos sociales: confianza MÁXIMO 6
- NO inventes sentimiento social si no aparece en los datos — di "sin datos en tiempo real"
- En resumen_simple y tesis: cita solo métricas que aparezcan en los datos, no inventes nada
- Bucket: siempre [GROWTH 🚀] para cripto`,

    stocks: `${base}Eres el Agente Acciones de Finance.ia. Analiza esta acción con criterio fundamental + técnico:
1. Valoración: P/E vs Fair Value, margen de seguridad, DCF
2. Calidad: ROE, márgenes, FCF yield, cobertura de intereses
3. Crecimiento: revenue/earnings growth, tendencia
4. Técnico: RSI, MACD, posición vs SMAs
5. Bucket: [GROWTH 🚀] si revenue >15% YoY o disruption tech; [DIVIDENDO 💰] si yield >2% + payout <70%`,

    startups: `${base}Eres el Agente Startups/Growth de Finance.ia. Analiza esta empresa de alto crecimiento:
1. Motor de crecimiento: ¿revenue >40% YoY? ¿escalable?
2. Moat: ventaja competitiva defensible (network effects, switching costs, tech propietaria)
3. Valoración vs crecimiento: ¿el múltiplo está justificado por el growth?
4. Runway: ¿cuánto tiempo puede crecer a esta tasa?
5. Bucket: [GROWTH 🚀] — asimetría x5-x10`,

    materials: `${base}Eres el Agente Materias Primas de Finance.ia. Analiza este activo de commodities/materiales:
1. Técnico del ETF: RSI, MACD, tendencia SMA
2. Macro: ¿cómo afectan tasas, DXY e inflación a este activo?
3. Rol en cartera: ¿hedge inflacionario, cobertura geopolítica, apuesta cíclica?
4. Supply/demand: con tu conocimiento de la situación actual del mercado
5. Bucket: materiales pueden ser [DIVIDENDO 💰] (XOM) o [GROWTH 🚀] según contexto`,

    currencies: `${base}Eres el Agente Divisas de Finance.ia. Analiza este par de divisas:
1. Política monetaria: diferenciales de tasas entre los bancos centrales involucrados
2. Macro: datos económicos relevantes (inflación, empleo, PIB)
3. Técnico: tendencia, niveles clave, momentum
4. Sentimiento: posicionamiento institucional conocido
5. Bucket: divisas como cobertura táctica`,
  }

  const prompt = instrucciones[agentType] ?? instrucciones.stocks

  return `${prompt}

RESPONDE con este JSON exacto (sin markdown, solo JSON):
{
  "agent_type": "${agentType}",
  "veredicto_agente": "COMPRA FUERTE|COMPRA|MANTENER|VENDER|EVITAR",
  "bucket": "GROWTH 🚀|DIVIDENDO 💰|COBERTURA 🛡️",
  "confianza": 8,
  "resumen_simple": "2-3 oraciones en lenguaje claro para alguien que no sabe de finanzas. Explica qué es el activo y por qué comprar/mantener/vender.",
  "tesis": "Tesis de inversión en 2-3 oraciones para un inversor informado. Cita métricas específicas.",
  "puntos_clave": [
    "Punto positivo o negativo más importante (cita métrica)",
    "Segundo punto con dato concreto",
    "Tercer punto relevante"
  ],
  "riesgos_principales": [
    "Riesgo más importante para esta posición",
    "Segundo riesgo a monitorear"
  ],
  "accion_recomendada": "Qué hacer exactamente: comprar en X zona, esperar catalizador Y, salir si Z"
}`
}

export async function POST(req: NextRequest) {
  let symbol = ""
  try {
    const body = await req.json()
    symbol = (body.symbol ?? "").toUpperCase().trim()
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
  }

  if (!symbol) return NextResponse.json({ error: "Symbol requerido" }, { status: 400 })

  const tickerPath = path.join(process.cwd(), "public", "data", "ticker", `${symbol}.json`)
  if (!fs.existsSync(tickerPath)) {
    return NextResponse.json({ error: "No hay datos para este ticker" }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any
  try {
    data = JSON.parse(fs.readFileSync(tickerPath, "utf-8"))
  } catch {
    return NextResponse.json({ error: "Error al leer datos del ticker" }, { status: 500 })
  }

  const groq    = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const today   = new Date().toISOString().split("T")[0]
  const agentType = detectAgentType(data)
  const tickerCtx = buildTickerContext(data)
  const prompt    = buildAgentPrompt(agentType, tickerCtx, today)

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are a specialized financial analysis agent for Finance.ia. Respond ONLY with a valid JSON object. No markdown, no code blocks, no text outside JSON. Start with { and end with }.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
    })

    const raw  = completion.choices[0]?.message?.content?.trim() ?? ""
    const start = raw.indexOf("{")
    const end   = raw.lastIndexOf("}")
    if (start === -1 || end === -1) throw new Error("No JSON en respuesta")

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw.slice(start, end + 1))
    } catch {
      const fixed = raw.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1")
      parsed = JSON.parse(fixed)
    }

    return NextResponse.json({ ...parsed, agent_type: agentType })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[summary] Groq error:", msg)
    return NextResponse.json({ error: "Error generando análisis del agente" }, { status: 500 })
  }
}
