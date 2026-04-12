import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import fs from "fs"
import { GoogleGenerativeAI } from "@google/generative-ai"

const execAsync = promisify(exec)
export const maxDuration = 300

// Tickers por sector para análisis profundo — se eligen 3 según los sectores seleccionados
const TICKERS_BY_SECTOR: Record<string, string[]> = {
  crypto:    ["BTC", "ETH", "SOL"],
  stocks:    ["NVDA", "AAPL", "AMZN"],
  startups:  ["AVGO", "MELI", "PLTR"],
  materials: ["GLD", "KO", "XOM"],
  currencies: [],   // Gemini maneja divisas sin datos Python
}

function pickTickers(sectors: string[], excluded: string[]): string[] {
  const candidates: string[] = []
  for (const s of sectors) {
    for (const t of TICKERS_BY_SECTOR[s] ?? []) {
      if (!candidates.includes(t) && !excluded.includes(t)) candidates.push(t)
    }
  }
  return candidates.slice(0, 3)
}

const SECTOR_INSTRUCTIONS: Record<string, string> = {
  crypto:    "CRYPTO (3-4 activos): prioriza los que tienen catalizadores técnicos HOY (RSI < 45 + MACD alcista, o sobreventa con volumen creciente). No copies los más grandes por default — busca el momentum real.",
  stocks:    "ACCIONES (3-4 activos): acciones con earnings beats recientes (<30 días), sector tailwinds claros confirmados por rotación sectorial, o señal técnica fuerte (por encima de SMA50, MACD alcista). Evita acciones donde el upside de analistas ya está descontado.",
  startups:  "GROWTH / STARTUPS (3-4 activos): empresas <$10B market cap, revenue growth >40% YoY, ventaja competitiva defensible. Cita el múltiplo de valoración actual vs histórico del sector.",
  currencies: "DIVISAS (3-4 pares): pares con divergencia de política monetaria clara o volatilidad técnica. Cita el diferencial de tasas y la dirección del par las últimas 4 semanas.",
  materials: "MATERIAS PRIMAS (3-4 activos): commodities con disrupciones de oferta/demanda activas. Cita precio spot HOY y comparación con promedio 6 meses.",
}

function summarizeTicker(ticker: string, data: Record<string, unknown>): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = data.precio as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = data.sentimiento as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = data.fundamentales as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fv = data.fair_value as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const esc = data.escenarios as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventos = data.eventos as any

  const lines = [`[${ticker}] — datos verificados yfinance`]

  if (p) {
    lines.push(`Precio: $${p.precio_actual} | 24h: ${p.cambio_24h}% | 7d: ${p.cambio_7d}% | 30d: ${p.cambio_30d}% | YTD: ${p.cambio_ytd}%`)
    lines.push(`RSI: ${p.rsi} | Tendencia SMA: ${p.tendencia_sma} | MACD: ${p.macd_bullish ? "ALCISTA" : "BAJISTA"} | Vol relativo: ${p.vol_relativo}x`)
    lines.push(`Soporte: $${p.soporte} | Resistencia: $${p.resistencia} | 52w High: $${p.high_52w} | 52w Low: $${p.low_52w}`)
  }

  if (s && !s._error) {
    const señales = (s.señales ?? []).filter((x: {señal: string}) => x.señal !== "NEUTRAL").map((x: {factor: string, señal: string, peso: string}) => `${x.factor}(${x.señal} ${x.peso})`).join(", ")
    lines.push(`Sentimiento cuantitativo: ${s.label} ${s.score}/10${señales ? ` | Señales: ${señales}` : ""}`)
  }

  if (f && Object.keys(f).length > 0) {
    const roe  = f.roe  != null ? `ROE: ${(f.roe * 100).toFixed(1)}%` : ""
    const pe   = f.pe   != null ? `P/E: ${f.pe}` : ""
    const mg   = f.margin != null ? `Margen neto: ${(f.margin * 100).toFixed(1)}%` : ""
    const fcf  = f.fcf_yield != null ? `FCF Yield: ${(f.fcf_yield * 100).toFixed(1)}%` : ""
    lines.push([pe, roe, mg, fcf].filter(Boolean).join(" | "))
  }

  if (fv && (fv.fair_value_pe > 0 || fv.fair_ev > 0)) {
    const fvPe = fv.fair_value_pe > 0 ? `FV P/E: $${fv.fair_value_pe}` : ""
    const margen = fv.margen_seguridad != null ? ` (${fv.margen_seguridad}% margen)` : ""
    lines.push(`${fvPe}${margen} | Zona compra: $${fv.zona_compra_agresiva}–$${fv.zona_compra_conservadora}`)
  }

  if (esc && (esc.bull || esc.bear)) {
    lines.push(`Escenarios — Bull: $${esc.bull?.precio} | Base: $${esc.base?.precio} | Bear: $${esc.bear?.precio}`)
  }

  if (eventos?.earnings_fecha) {
    lines.push(`Próximo earnings: ${eventos.earnings_fecha} | EPS est: $${eventos.earnings_eps_est}`)
  }

  lines.push(`Veredicto Python: ${data.veredicto} (score: ${data.score}/10)`)
  return lines.join("\n")
}

function buildMainPrompt(
  tickerDeep: Record<string, unknown>,
  marketCtx: Record<string, unknown>,
  riskProfile: string,
  sectors: string[],
  excluded: string[] = []
): string {
  const today = new Date().toISOString().split("T")[0]

  const deepLines = Object.entries(tickerDeep)
    .map(([t, d]) => summarizeTicker(t, d as Record<string, unknown>))
    .join("\n\n")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insights: string[] = (marketCtx as any).insights ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const macro = marketCtx as any

  const macroLines = [
    ...insights,
    macro.macro?.["S&P 500"] ? `S&P 500: $${macro.macro["S&P 500"].price} (1W: ${macro.macro["S&P 500"].w1}%)` : "",
    macro.macro?.["Nasdaq"] ? `Nasdaq: $${macro.macro["Nasdaq"].price} (1W: ${macro.macro["Nasdaq"].w1}%)` : "",
  ].filter(Boolean).join("\n")

  const sectorRotation = macro.sectors
    ? Object.entries(macro.sectors)
        .sort((a: [string, unknown], b: [string, unknown]) => ((b[1] as {w1: number}).w1 ?? 0) - ((a[1] as {w1: number}).w1 ?? 0))
        .map(([name, d]) => `${name}: ${(d as {w1: number}).w1 > 0 ? "+" : ""}${(d as {w1: number}).w1}% 1W`)
        .join(" | ")
    : ""

  const sectorInstructions = sectors
    .map((s, i) => `${i + 1}. ${SECTOR_INSTRUCTIONS[s] ?? s}`)
    .join("\n")

  const outputSectors = sectors
    .map(s => s === "startups" ? "stocks" : s)
    .filter((s, i, arr) => arr.indexOf(s) === i)

  const sectorJsonTemplate = outputSectors.map(s => `
    "${s}": {
      "sector": "${s}", "timestamp": "${new Date().toISOString()}",
      "sector_summary": "2-3 oraciones con contexto actual del sector. Cita datos concretos.",
      "sector_outlook": "bullish|bearish|neutral",
      "top_pick": "SYMBOL", "top_pick_reasoning": "Por qué este y no otro en el sector",
      "assets": [
        {
          "name": "Nombre completo", "symbol": "TICKER",
          "current_price": "precio actual (toma de datos Python si disponible, sino investiga)",
          "change_24h": "+0.00%", "change_7d": "+0.00%", "change_30d": "+0.00%", "ytd_change": "+0.00%",
          "week_52_high": "0", "week_52_low": "0", "market_cap": "$0B", "volume_24h": "$0B",
          "sentiment": "bullish|bearish|neutral",
          "social_sentiment": "bullish|bearish|neutral|mixed",
          "social_buzz": "high|medium|low",
          "confidence": 8,
          "source_agreement": "high|medium|low",
          "sources_checked": ["yfinance/Python", "conocimiento de mercado"],
          "key_news": ["[FECHA] Noticia real o catalizador conocido"],
          "social_highlights": [],
          "recommendation": "buy|hold|sell",
          "reasoning": "OBLIGATORIO: cita al menos 2 métricas específicas (ej: RSI=42 sobreventa, MACD alcista, P/E=18x vs sector 25x). Incluye el catalizador principal y el riesgo más importante."
        }
      ]
    }`).join(",")

  return `Eres un analista cuantitativo senior de hedge fund. Tu ventaja es combinar datos duros con contexto de mercado para encontrar oportunidades antes que el consenso. Fecha de análisis: ${today}.

PERFIL DEL INVERSOR: ${riskProfile.toUpperCase()}
${riskProfile === "aggressive" ? "→ Buscar asimetría: alto upside, aceptar volatilidad. Evitar activos ya con precio perfecto." : ""}
${riskProfile === "conservative" ? "→ Priorizar calidad sobre precio. P/E razonable, dividendo sostenible, balance sólido." : ""}
${riskProfile === "moderate" ? "→ Balance riesgo/retorno. Quality at a reasonable price. Diversificación real entre sectores." : ""}

══ DATOS DUROS — VERIFICADOS POR PYTHON/YFINANCE ══
Estos números son reales. Úsalos directamente. NO los inventes ni redondees de forma diferente.

${deepLines}

══ CONTEXTO MACRO REAL — HOY ══
${macroLines}

Rotación sectorial 1 semana (datos reales):
${sectorRotation}

══ TAREA: ENCONTRAR LAS MEJORES OPORTUNIDADES ══
Analiza estos sectores con ojo crítico:
${sectorInstructions}

REGLAS DE CALIDAD — OBLIGATORIAS:
1. CITA DATOS: En cada reasoning, nombra mínimo 2 métricas específicas de los datos Python o del mercado real.
2. BEAR CASE: Para cada BUY, el reasoning debe incluir "Riesgo principal: [X]".
3. SÉ SELECTIVO: Si un sector no tiene oportunidades claras HOY, dilo en sector_summary. No fuerces recomendaciones.
4. CONFIDENCE HONESTO: Si no tienes datos Python del activo, max confidence = 6. Si tienes datos Python, puede ser 7-9.
5. SIN PRECIO INVENTADO: Si no sabes el precio exacto, escribe "ver mercado" no un número inventado.
6. ANTI-SESGO: Primero busca razones para NO comprar. Solo recomienda BUY si supera ese filtro.
7. TOP 3 PICKS: risk_adjusted_picks debe contener EXACTAMENTE 3 picks — los mejores entre todos los sectores.
8. EXCLUIR TICKERS: NO incluyas en risk_adjusted_picks ni en assets estos tickers ya mostrados: ${excluded.length > 0 ? excluded.join(", ") : "ninguno"}. Busca activos diferentes.

══ FORMATO DE SALIDA — JSON PURO ══
Responde SOLO con JSON válido, sin markdown, sin comentarios:
{
  "brand": "Financial Intelligence",
  "creator": "Benjamin Hurtado",
  "generated_at": "${new Date().toISOString()}",
  "risk_profile": "${riskProfile}",
  "executive_summary": "3-4 oraciones. Empieza con el dato más importante del mercado HOY. Sé directo, no uses eufemismos.",
  "macro_environment": {
    "summary": "2-3 oraciones basadas en los datos macro reales provistos. Cita VIX, yields o rotación sectorial.",
    "interest_rate_outlook": "rising|stable|falling",
    "inflation_outlook": "rising|stable|falling",
    "geopolitical_risk": "high|medium|low",
    "key_factors": ["factor concreto 1", "factor concreto 2", "factor concreto 3"]
  },
  "portfolio_allocation": { ${outputSectors.map(s => `"${s}": 0`).join(", ")}, "cash": 0 },
  "cross_sector_insights": [
    { "insight": "Observación no obvia entre sectores", "implication": "Qué hacer con esto" }
  ],
  "risk_adjusted_picks": [
    {
      "rank": 1, "name": "Nombre", "symbol": "TICKER", "sector": "sector",
      "confidence": 8, "risk_score": 5, "risk_adjusted_score": 7,
      "recommendation": "buy|hold|sell",
      "reasoning": "Tesis específica con métricas. Riesgo principal: X",
      "position_size": "X-Y%"
    }
  ],
  "excluded_tickers": ${JSON.stringify(excluded)},
  "historical_accuracy": { "previous_date": null, "calls_made": 0, "calls_correct": 0, "accuracy_pct": 0, "notable": "Análisis cuantitativo — ${today}" },
  "warnings": ["Advertencia real basada en datos (no genérica)"],
  "sectors": { ${sectorJsonTemplate} }
}

portfolio_allocation suma exactamente 100. risk_adjusted_picks: 5-8 mejores entre todos los sectores. SOLO JSON.`
}

function buildCriticPrompt(reportJson: string): string {
  return `Eres el "abogado del diablo" de inversiones. Te acaban de dar un reporte de análisis de mercado.
Tu trabajo es identificar EXACTAMENTE qué está mal, qué falta y qué podría fallar.

REPORTE A REVISAR:
${reportJson.substring(0, 6000)}

Responde con un JSON con esta estructura EXACTA:
{
  "warnings_adicionales": ["advertencia específica 1", "advertencia específica 2"],
  "picks_cuestionables": [
    { "symbol": "TICKER", "razon": "Por qué esta recomendación tiene problemas o asunciones débiles" }
  ],
  "sesgo_detectado": "descripción de si el análisis está sesgado en alguna dirección",
  "oportunidades_omitidas": ["sector o activo que debería haberse considerado y no está"],
  "nivel_confianza_general": "LOW|MEDIUM|HIGH",
  "veredicto": "1-2 oraciones sobre la calidad general del análisis"
}
Solo JSON, sin texto adicional.`
}

function extractJson(text: string): Record<string, unknown> {
  // 1. Limpiar markdown
  let cleaned = text
    .replace(/^```json\s*/i, "").replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "").trim()

  // 2. Extraer el bloque JSON más externo si hay texto alrededor
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (match) cleaned = match[0]

  // 3. Primer intento: JSON estricto
  try { return JSON.parse(cleaned) } catch { /* sigue */ }

  // 4. Segundo intento: eliminar trailing commas (bug más común de Gemini)
  const fixed = cleaned.replace(/,\s*([}\]])/g, "$1")
  return JSON.parse(fixed)
}

export async function POST(request: Request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (step: string, msg: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step, msg })}\n\n`))
      }

      try {
        const body = await request.json().catch(() => ({}))
        const riskProfile: string  = (body as Record<string, string>).risk_profile ?? "moderate"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sectors: string[]    = (body as any).sectors   ?? ["crypto", "stocks", "currencies", "materials"]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const excluded: string[]   = (body as any).excluded  ?? []   // tickers ya mostrados (para "siguientes 3")
        const rootDir   = path.join(process.cwd(), "..")
        const reportPath = path.join(rootDir, "dashboard", "public", "data", "report.json")
        const tickerDir  = path.join(rootDir, "dashboard", "public", "data", "ticker")

        const macroTickers = pickTickers(sectors, excluded)

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

        // ── PASO 1: Contexto macro real (VIX, yields, sector rotation) ─────────
        send("macro", "Obteniendo VIX, yields y rotación sectorial...")
        let marketCtx: Record<string, unknown> = {}
        try {
          const { stdout } = await execAsync("python market_context.py", {
            cwd: rootDir,
            env: { ...process.env, PYTHONUTF8: "1" },
            timeout: 30000,
          })
          marketCtx = JSON.parse(stdout)
        } catch {
          send("macro", "Contexto macro parcial, continuando...")
        }

        // ── PASO 2: Análisis profundo de 3 tickers seleccionados ────────────────
        send("deep", `Análisis profundo de ${macroTickers.length} tickers: ${macroTickers.join(", ")}...`)
        try {
          await execAsync(`python analisis_maia.py ${macroTickers.join(" ")}`, {
            cwd: rootDir,
            env: { ...process.env, PYTHONUTF8: "1" },
            timeout: 240000,
          })
        } catch {
          send("deep", "Análisis parcial, continuando con datos disponibles...")
        }

        // ── PASO 3: Leer JSONs generados ───────────────────────────────────────
        send("reading", "Preparando contexto para Gemini...")
        const tickerDeep: Record<string, unknown> = {}
        for (const ticker of macroTickers) {
          const p = path.join(tickerDir, `${ticker}.json`)
          if (fs.existsSync(p)) {
            try { tickerDeep[ticker] = JSON.parse(fs.readFileSync(p, "utf-8")) } catch { /* skip */ }
          }
        }

        // ── PASO 4: Gemini — generación principal ──────────────────────────────
        send("gemini", "Gemini buscando oportunidades (análisis cuantitativo + contexto)...")
        const mainPrompt = buildMainPrompt(tickerDeep, marketCtx, riskProfile, sectors, excluded)
        const mainResult = await model.generateContent(mainPrompt)
        const mainText   = mainResult.response.text()
        const reportJson = extractJson(mainText) as Record<string, unknown>

        // ── PASO 5: Gemini — crítico (abogado del diablo) ──────────────────────
        send("critic", "Pasada crítica — verificando sesgos y advertencias...")
        let criticOutput: Record<string, unknown> = {}
        try {
          const criticResult = await model.generateContent(buildCriticPrompt(mainText))
          criticOutput = extractJson(criticResult.response.text())
        } catch {
          /* crítico falla silenciosamente — no bloquea el reporte */
        }

        // ── PASO 6: Merge — incorporar feedback del crítico ────────────────────
        const warningsExistentes: string[] = (reportJson.warnings as string[]) ?? []
        const warningsAdicionales: string[] = (criticOutput.warnings_adicionales as string[]) ?? []
        const picksProblematicos: {symbol: string, razon: string}[] = (criticOutput.picks_cuestionables as {symbol: string, razon: string}[]) ?? []

        // Marcar picks cuestionables en risk_adjusted_picks
        if (picksProblematicos.length > 0 && Array.isArray(reportJson.risk_adjusted_picks)) {
          reportJson.risk_adjusted_picks = (reportJson.risk_adjusted_picks as Record<string, unknown>[]).map(pick => {
            const critica = picksProblematicos.find(p => p.symbol === pick.symbol)
            if (critica) {
              return { ...pick, _critic_note: critica.razon }
            }
            return pick
          })
        }

        reportJson.warnings = [...new Set([...warningsExistentes, ...warningsAdicionales])]
        reportJson.generated_at = new Date().toISOString()
        reportJson._generated_by = "gemini-2.0-flash + critic-pass"
        reportJson._market_context = {
          vix: (marketCtx as {macro?: {[k: string]: {price: number}}})?.macro?.["VIX (Fear Index)"]?.price,
          tnx: (marketCtx as {macro?: {[k: string]: {price: number}}})?.macro?.["10Y Treasury Yield"]?.price,
          insights: (marketCtx as {insights?: string[]})?.insights ?? [],
          critic_veredicto: criticOutput.veredicto ?? null,
          critic_confianza: criticOutput.nivel_confianza_general ?? null,
          sesgo_detectado: criticOutput.sesgo_detectado ?? null,
        }

        // ── PASO 7: Guardar ────────────────────────────────────────────────────
        send("saving", "Guardando reporte verificado...")
        fs.writeFileSync(reportPath, JSON.stringify(reportJson, null, 2), "utf-8")

        send("done", `Listo. Confianza del crítico: ${criticOutput.nivel_confianza_general ?? "N/D"}. Recargando...`)
        controller.close()
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        send("error", msg)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
