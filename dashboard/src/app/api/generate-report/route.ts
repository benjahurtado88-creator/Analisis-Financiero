import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import fs from "fs"
import Groq from "groq-sdk"

const execAsync = promisify(exec)
export const maxDuration = 300

// ── Tickers por sector — cada agente recibe datos Python de su especialidad ──
const SECTOR_TICKERS: Record<string, string[]> = {
  crypto:    ["BTC", "ETH", "SOL"],
  stocks:    ["NVDA", "AAPL", "AMZN", "KO"],
  startups:  ["MELI", "PLTR", "HOOD"],
  materials: ["GLD", "SLV", "XOM"],
  currencies: [],
}

// ── Todos los tickers únicos que hay que correr con Python ───────────────────
function getAllTickers(sectors: string[]): string[] {
  const all: string[] = []
  for (const s of sectors) {
    for (const t of SECTOR_TICKERS[s] ?? []) {
      if (!all.includes(t)) all.push(t)
    }
  }
  return all
}

// ── Resumen compacto de datos Python por ticker (para prompt del agente) ─────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summarizeTicker(ticker: string, data: any): string {
  const p   = data.precio       ?? {}
  const s   = data.sentimiento  ?? {}
  const f   = data.fundamentales ?? {}
  const fv  = data.fair_value   ?? {}
  const esc = data.escenarios   ?? {}
  const ev  = data.eventos      ?? {}
  const m   = data.moat         ?? {}
  const info = data.info        ?? {}

  const lines = [`▸ ${ticker} — datos Python/yfinance verificados`]
  if (p.precio_actual) {
    lines.push(`  Precio: $${p.precio_actual} | 24h: ${p.cambio_24h}% | 7d: ${p.cambio_7d}% | 30d: ${p.cambio_30d}% | YTD: ${p.cambio_ytd}%`)
    lines.push(`  RSI: ${p.rsi} | SMA trend: ${p.tendencia_sma} | MACD: ${p.macd_bullish ? "ALCISTA ↑" : "BAJISTA ↓"} | Vol rel: ${p.vol_relativo}x`)
    lines.push(`  Soporte: $${p.soporte} | Resistencia: $${p.resistencia} | 52w: $${p.low_52w}–$${p.high_52w}`)
  }
  if (f && Object.keys(f).length > 0) {
    const parts = [
      f.pe        != null ? `P/E: ${f.pe}` : "",
      f.roe       != null ? `ROE: ${(f.roe * 100).toFixed(1)}%` : "",
      f.net_margin != null ? `Margen neto: ${f.net_margin}%` : f.margin != null ? `Margen neto: ${(f.margin * 100).toFixed(1)}%` : "",
      f.fcf_yield != null ? `FCF Yield: ${f.fcf_yield != null && f.fcf_yield < 1 ? (f.fcf_yield * 100).toFixed(1) + "%" : f.fcf_yield + "%"}` : "",
      f.de        != null ? `D/E: ${f.de}` : "",
    ].filter(Boolean)
    if (parts.length) lines.push(`  Fundamentales: ${parts.join(" | ")}`)
  }
  if (info.analyst_target) {
    lines.push(`  Analistas: target $${info.analyst_target} | rec: ${info.analyst_rec} | ${info.analyst_count} analistas`)
  }
  if (fv.fair_value_pe && fv.fair_value_pe > 0) {
    lines.push(`  Fair Value P/E: $${fv.fair_value_pe} | Margen seguridad: ${fv.safety_margin_pct ?? fv.margen_seguridad}% | Compra agresiva: $${fv.buy_zone_aggressive ?? fv.zona_compra_agresiva}`)
  }
  if (esc.base) {
    lines.push(`  Escenarios — Bull: $${esc.bull} (+${esc.bull_upside}%) | Base: $${esc.base} (${esc.base_upside}%) | Bear: $${esc.bear} (${esc.bear_upside}%)`)
  }
  if (m.nivel) {
    lines.push(`  Moat: ${m.nivel} (${m.score}/${m.max})`)
  }
  if (s.label && !s._error) {
    lines.push(`  Sentimiento técnico: ${s.label} (${s.score}/10)`)
  }
  if (s.fear_greed && !s._error) {
    const fg = s.fear_greed as { value: number; classification: string }
    lines.push(`  Fear & Greed Index: ${fg.value}/100 (${fg.classification})`)
  }
  if (s.social_cripto && !s._error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sc = s.social_cripto as any
    if (sc.sentiment_bullish_pct != null) lines.push(`  CoinGecko sentiment: ${sc.sentiment_bullish_pct?.toFixed(1)}% bullish / ${sc.sentiment_bearish_pct?.toFixed(1)}% bearish`)
    if (sc.watchlist_users)               lines.push(`  Watchlists: ${sc.watchlist_users?.toLocaleString()} usuarios | Rank #${sc.market_cap_rank}`)
  }
  if (ev.earnings_fecha) {
    lines.push(`  Próximo earnings: ${ev.earnings_fecha} | EPS est: $${ev.earnings_eps_est}`)
  }
  lines.push(`  Veredicto Python: ${data.veredicto} (score: ${data.score}/10)`)
  return lines.join("\n")
}

// ── Carga JSONs de tickers desde disco ───────────────────────────────────────
function loadTickerData(tickers: string[], tickerDir: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const t of tickers) {
    const p = path.join(tickerDir, `${t}.json`)
    if (fs.existsSync(p)) {
      try { result[t] = JSON.parse(fs.readFileSync(p, "utf-8")) } catch { /* skip */ }
    }
  }
  return result
}

// ── Construye el contexto de datos para un agente ────────────────────────────
function buildDataContext(
  sectorTickers: string[],
  allTickerData: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  marketCtx: any
): string {
  const tickerLines = sectorTickers
    .filter(t => allTickerData[t])
    .map(t => summarizeTicker(t, allTickerData[t]))
    .join("\n\n")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fg = marketCtx?.fear_greed as any
  const macroLines = [
    ...(marketCtx?.insights ?? []),
    marketCtx?.macro?.["S&P 500"]  ? `S&P 500: $${marketCtx.macro["S&P 500"].price} (1W: ${marketCtx.macro["S&P 500"].w1}%)` : "",
    marketCtx?.macro?.["Nasdaq"]   ? `Nasdaq: $${marketCtx.macro["Nasdaq"].price} (1W: ${marketCtx.macro["Nasdaq"].w1}%)` : "",
    marketCtx?.macro?.["VIX (Fear Index)"] ? `VIX: ${marketCtx.macro["VIX (Fear Index)"].price}` : "",
    marketCtx?.macro?.["10Y Treasury Yield"] ? `10Y Treasury: ${marketCtx.macro["10Y Treasury Yield"].price}%` : "",
    fg?.value != null ? `Fear & Greed Index (Crypto): ${fg.value}/100 — ${fg.classification}` : "",
  ].filter(Boolean).join("\n")

  const sectorRot = marketCtx?.sectors
    ? Object.entries(marketCtx.sectors)
        .sort((a: [string, unknown], b: [string, unknown]) => ((b[1] as {w1:number}).w1 ?? 0) - ((a[1] as {w1:number}).w1 ?? 0))
        .map(([n, d]) => `${n}: ${(d as {w1:number}).w1 > 0 ? "+" : ""}${(d as {w1:number}).w1}% 1W`)
        .join(" | ")
    : ""

  return [
    tickerLines ? `══ DATOS PYTHON/YFINANCE (verificados) ══\n${tickerLines}` : "",
    macroLines  ? `══ CONTEXTO MACRO ══\n${macroLines}` : "",
    sectorRot   ? `Rotación sectorial 1W: ${sectorRot}` : "",
  ].filter(Boolean).join("\n\n")
}

// ── Prompts especializados por agente ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCryptoAgentPrompt(dataCtx: string, today: string): string {
  return `Eres el Agente Crypto de Finance.ia — especialista en criptomonedas, ciclos de mercado on-chain y momentum técnico. Fecha: ${today}.

PERFIL INVERSOR: AGRESIVO — 65% Growth / 35% Dividend. Todos los picks cripto son [GROWTH 🚀].

${dataCtx}

TU MISIÓN:
Analiza los activos crypto con los datos Python anteriores. Para cada uno:
1. Interpreta RSI, MACD, SMA trend: ¿hay señal técnica real?
2. Evalúa el momentum de precio (24h/7d/30d/YTD)
3. Usa el Fear & Greed Index (si aparece arriba) — es dato real de hoy, no estimado
4. Usa los datos de Reddit/Twitter (si aparecen arriba) — actividad real de la comunidad
5. Decide COMPRAR / MANTENER / VENDER con criterio cuantitativo

REGLAS DE DATOS:
- Los datos marcados "Python/yfinance" son verificados y reales → cítalos con números exactos
- El Fear & Greed Index y datos de Reddit/Twitter son reales de hoy → úsalos como evidencia directa
- Si el Fear & Greed NO aparece en los datos: no inventes un valor, di "F&G no disponible hoy"
- Si datos sociales NO aparecen: no inventes actividad de Reddit/Twitter, di que no hay datos en tiempo real

CALIBRACIÓN DE CONFIDENCE (MUY IMPORTANTE):
- Si tienes Fear & Greed + datos sociales + técnico: confidence puede llegar a 8-9
- Si solo tienes datos técnicos/precio (sin F&G ni social): confidence MÁXIMO 6
- Si RSI > 70: reduce confidence en 1 punto (sobrecompra)
- Si MACD bajista + SMA bearish: no recomendes BUY sin argumento técnico muy sólido
- Sé honesto en el reasoning: menciona explícitamente qué datos tienes y cuáles faltan

RESPONDE SOLO con este JSON (sin markdown, sin texto extra):
{
  "sector": "crypto",
  "timestamp": "${new Date().toISOString()}",
  "sector_summary": "2-3 oraciones con estado actual del mercado crypto basado en los datos",
  "sector_outlook": "bullish|bearish|neutral",
  "top_pick": "TICKER",
  "top_pick_reasoning": "Por qué este activo es el mejor pick crypto ahora",
  "assets": [
    {
      "name": "Nombre completo", "symbol": "TICKER",
      "current_price": "$X (de Python)", "change_24h": "+X%", "change_7d": "+X%",
      "change_30d": "+X%", "ytd_change": "+X%",
      "week_52_high": "$X", "week_52_low": "$X",
      "market_cap": "$XB", "volume_24h": "$XB",
      "sentiment": "bullish|bearish|neutral",
      "social_sentiment": "bullish|bearish|neutral|mixed",
      "social_buzz": "high|medium|low",
      "confidence": 7,
      "source_agreement": "high|medium|low",
      "sources_checked": ["python:yfinance", "python:alternative.me/fng", "python:cryptocompare"],
      "key_news": [],
      "social_highlights": [],
      "recommendation": "buy|hold|sell",
      "reasoning": "Tesis con métricas específicas. Ej: RSI=42 sobreventa + MACD alcista + F&G=28(Fear) + Reddit 45k activos. Riesgo: ..."
    }
  ]
}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildStocksAgentPrompt(dataCtx: string, today: string): string {
  return `Eres el Agente Acciones de Finance.ia — especialista en análisis fundamental, valoración DCF, earnings y rotación sectorial. Fecha: ${today}.

PERFIL INVERSOR: AGRESIVO — 65% Growth [GROWTH 🚀] / 35% Dividend [DIVIDENDO 💰].
→ Growth: revenue >15% YoY, TAM grande, ventaja competitiva. Tag: [GROWTH 🚀]
→ Dividend: payout <70%, FCF yield positivo, dividendo creciente. Tag: [DIVIDENDO 💰]

${dataCtx}

TU MISIÓN:
Analiza cada acción con los datos Python. Para cada una:
1. Fundamentales: P/E vs sector, FCF yield, ROE, márgenes
2. Valoración: ¿está cara o barata vs Fair Value Python?
3. Técnico: RSI, MACD, tendencia SMA
4. Catalizador: ¿hay earnings próximos, guidance, sector tailwind?
5. Asigna bucket: [GROWTH 🚀] o [DIVIDENDO 💰]

REGLAS:
- KO es candidata natural a [DIVIDENDO 💰] — verifica payout ratio y yield
- Para NVDA/AAPL/AMZN: foco en fundamentales y valoración, no en nombre
- Si P/E está muy por encima del Fair Value Python: reduce confidence o recomienda HOLD
- Cita mínimo 2 métricas en reasoning
- confidence máximo 8 sin datos web en tiempo real

RESPONDE SOLO con este JSON:
{
  "sector": "stocks",
  "timestamp": "${new Date().toISOString()}",
  "sector_summary": "2-3 oraciones sobre el estado del mercado de acciones",
  "sector_outlook": "bullish|bearish|neutral",
  "top_pick": "TICKER",
  "top_pick_reasoning": "Por qué este es el mejor pick en acciones ahora",
  "assets": [
    {
      "name": "Nombre", "symbol": "TICKER",
      "current_price": "$X", "change_24h": "+X%", "change_7d": "+X%",
      "change_30d": "+X%", "ytd_change": "+X%",
      "week_52_high": "$X", "week_52_low": "$X",
      "market_cap": "$XB", "volume_24h": "$XB",
      "sentiment": "bullish|bearish|neutral",
      "social_sentiment": "bullish|bearish|neutral|mixed",
      "social_buzz": "high|medium|low",
      "confidence": 7,
      "source_agreement": "high",
      "sources_checked": ["python:yfinance", "python:financetoolkit", "python:finnhub"],
      "key_news": [],
      "social_highlights": [],
      "recommendation": "buy|hold|sell",
      "reasoning": "[GROWTH 🚀] o [DIVIDENDO 💰] — tesis con métricas. Riesgo principal: ..."
    }
  ]
}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildStartupsAgentPrompt(dataCtx: string, today: string): string {
  return `Eres el Agente Startups/Growth de Finance.ia — especialista en small/mid caps (<$10B), empresas de alto crecimiento (revenue >40% YoY) y análisis de moat competitivo. Fecha: ${today}.

PERFIL INVERSOR: AGRESIVO. Todos los picks son [GROWTH 🚀] — buscar asimetría x5-x10.

${dataCtx}

TU MISIÓN:
Analiza cada empresa growth con los datos Python. Para cada una:
1. Crecimiento: ¿revenue growth justifica el múltiplo de valoración?
2. Moat: ¿tiene ventaja competitiva defensible? (red de efectos, switching costs, tech propietaria)
3. Tamaño: ¿sigue siendo small/mid cap con runway largo?
4. Técnico: ¿el precio está en zona de entrada favorable?
5. Evalúa múltiplo actual vs histórico del sector

REGLAS:
- Si market cap ya supera $10B, ajusta el tagging (puede ser mid/large)
- Revenue growth >40% YoY es el filtro mínimo para BUY agresivo
- Cita múltiplo actual (P/E o P/S si no hay earnings) en reasoning
- Menciona el riesgo de dilución o competencia en cada pick
- confidence máximo 8 sin datos web en tiempo real

RESPONDE SOLO con este JSON:
{
  "sector": "startups",
  "timestamp": "${new Date().toISOString()}",
  "sector_summary": "2-3 oraciones sobre el entorno de startups/growth",
  "sector_outlook": "bullish|bearish|neutral",
  "top_pick": "TICKER",
  "top_pick_reasoning": "Por qué es la mejor oportunidad growth ahora",
  "assets": [
    {
      "name": "Nombre", "symbol": "TICKER",
      "current_price": "$X", "change_24h": "+X%", "change_7d": "+X%",
      "change_30d": "+X%", "ytd_change": "+X%",
      "week_52_high": "$X", "week_52_low": "$X",
      "market_cap": "$XB", "volume_24h": "$XB",
      "market_cap_b": 0,
      "revenue_growth_yoy": "+X%",
      "moat": "descripción 1 línea de la ventaja competitiva",
      "valuation_vs_sector": "Xx revenue vs sector avg Xx",
      "sentiment": "bullish|bearish|neutral",
      "social_sentiment": "bullish|bearish|neutral|mixed",
      "social_buzz": "high|medium|low",
      "confidence": 7,
      "source_agreement": "medium",
      "sources_checked": ["python:yfinance", "python:financetoolkit"],
      "key_news": [],
      "social_highlights": [],
      "recommendation": "buy|hold|sell",
      "reasoning": "[GROWTH 🚀] — tesis: revenue growth X%, moat = X. Riesgo principal: ..."
    }
  ]
}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildMaterialsAgentPrompt(dataCtx: string, today: string): string {
  return `Eres el Agente Materias Primas de Finance.ia — especialista en commodities, metales preciosos, energía y análisis de oferta/demanda. Fecha: ${today}.

PERFIL INVERSOR: AGRESIVO — materias primas sirven como hedge y oportunidad táctica.

NOTA IMPORTANTE: Los datos Python son de ETFs proxy (GLD=Gold, SLV=Silver, XOM=Oil/Energy).
Los precios son del ETF, no del spot del commodity. El análisis técnico es válido para el vehículo de inversión.

${dataCtx}

TU MISIÓN:
Analiza cada commodity/ETF con los datos Python. Para cada uno:
1. Técnico: RSI, MACD, SMA trend del ETF
2. Contexto macro: ¿qué dice el VIX, DXY y 10Y sobre la demanda de commodities?
3. Rol en cartera: ¿es hedge inflacionario, cobertura geopolítica, o apuesta cíclica?
4. Gold/Silver: correlación inversa con USD y tasas
5. Energy (XOM): ciclo de petróleo, capex, dividend yield

REGLAS:
- GLD/SLV: si VIX > 20 o tasas bajan → suele ser bullish para metales
- XOM: evalúa FCF yield y dividend como [DIVIDENDO 💰] candidato
- Cita datos macro del contexto en reasoning
- confidence máximo 8 sin datos de spot price en tiempo real

RESPONDE SOLO con este JSON:
{
  "sector": "materials",
  "timestamp": "${new Date().toISOString()}",
  "sector_summary": "2-3 oraciones sobre el mercado de materias primas",
  "sector_outlook": "bullish|bearish|neutral",
  "top_pick": "TICKER",
  "top_pick_reasoning": "Por qué este commodity/ETF es el mejor pick ahora",
  "assets": [
    {
      "name": "Nombre (ETF)", "symbol": "TICKER",
      "current_price": "$X (ETF)", "change_24h": "+X%", "change_7d": "+X%",
      "change_30d": "+X%", "ytd_change": "+X%",
      "week_52_high": "$X", "week_52_low": "$X",
      "market_cap": "$XB", "volume_24h": "$XB",
      "sentiment": "bullish|bearish|neutral",
      "social_sentiment": "bullish|bearish|neutral|mixed",
      "social_buzz": "medium",
      "confidence": 7,
      "source_agreement": "high",
      "sources_checked": ["python:yfinance"],
      "key_news": [],
      "social_highlights": [],
      "recommendation": "buy|hold|sell",
      "reasoning": "Tesis basada en técnico + macro. Riesgo principal: ..."
    }
  ]
}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCurrenciesAgentPrompt(marketCtx: any, today: string): string {
  const macroStr = [
    ...(marketCtx?.insights ?? []),
    marketCtx?.macro?.["10Y Treasury Yield"] ? `US 10Y: ${marketCtx.macro["10Y Treasury Yield"].price}%` : "",
    marketCtx?.macro?.["VIX (Fear Index)"]   ? `VIX: ${marketCtx.macro["VIX (Fear Index)"].price}` : "",
    marketCtx?.macro?.["DXY (USD Index)"]    ? `DXY: ${marketCtx.macro["DXY (USD Index)"].price}` : "",
  ].filter(Boolean).join("\n")

  return `Eres el Agente Divisas de Finance.ia — especialista en forex, política monetaria de bancos centrales y macro global. Fecha: ${today}.

PERFIL INVERSOR: AGRESIVO — divisas como cobertura táctica o especulación macro.

CONTEXTO MACRO DISPONIBLE:
${macroStr || "Contexto macro no disponible — usa tu conocimiento actualizado"}

TU MISIÓN:
Selecciona 3 pares de divisas relevantes HOY basándote en:
1. Divergencia de política monetaria (Fed vs ECB, BoJ, etc.)
2. Datos macro recientes (inflación, empleo, PIB)
3. Pares técnicamente interesantes (tendencia clara, soporte/resistencia)
4. USD/CLP u otras divisas EM si son relevantes para un inversor latinoamericano

REGLAS:
- Cita el diferencial de tasas o política monetaria en reasoning
- social_buzz para divisas generalmente es "medium" o "low"
- No inventes precios exactos que no conoces — usa rangos aproximados si es necesario
- confidence máximo 6 para divisas (sin datos en tiempo real)
- Menciona el riesgo de volatilidad por eventos macro próximos

RESPONDE SOLO con este JSON:
{
  "sector": "currencies",
  "timestamp": "${new Date().toISOString()}",
  "sector_summary": "2-3 oraciones sobre el mercado forex y política monetaria actual",
  "sector_outlook": "bullish|bearish|neutral",
  "top_pick": "EUR/USD o similar",
  "top_pick_reasoning": "Por qué este par es el más interesante ahora",
  "assets": [
    {
      "name": "EUR/USD", "symbol": "EURUSD",
      "current_price": "X.XXXX (aprox)", "change_24h": "+X%", "change_7d": "+X%",
      "change_30d": "+X%", "ytd_change": "+X%",
      "week_52_high": "X.XXXX", "week_52_low": "X.XXXX",
      "market_cap": "N/A", "volume_24h": "$XB",
      "sentiment": "bullish|bearish|neutral",
      "social_sentiment": "neutral",
      "social_buzz": "medium",
      "confidence": 5,
      "source_agreement": "medium",
      "sources_checked": ["conocimiento-entrenamiento", "contexto-macro"],
      "key_news": [],
      "social_highlights": [],
      "recommendation": "buy|hold|sell",
      "reasoning": "Tesis: diferencial de tasas X vs Y, tendencia en las últimas semanas. Riesgo: ..."
    }
  ]
}`
}

function buildStrategyAgentPrompt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sectorOutputs: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  marketCtx: any,
  riskProfile: string,
  today: string
): string {
  const sectorSummaries = Object.entries(sectorOutputs)
    .map(([sector, data]) => {
      if (!data) return `${sector}: sin datos`
      const assets = (data.assets ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((a: any) => `  ${a.symbol}: ${a.recommendation?.toUpperCase()} (conf: ${a.confidence}) — ${a.reasoning?.slice(0, 120)}`)
        .join("\n")
      return `── ${sector.toUpperCase()} ──\nOutlook: ${data.sector_outlook} | Top pick: ${data.top_pick}\n${data.sector_summary}\n${assets}`
    })
    .join("\n\n")

  const macroStr = [
    ...(marketCtx?.insights ?? []),
    marketCtx?.macro?.["VIX (Fear Index)"]       ? `VIX: ${marketCtx.macro["VIX (Fear Index)"].price}` : "",
    marketCtx?.macro?.["10Y Treasury Yield"]      ? `10Y Treasury: ${marketCtx.macro["10Y Treasury Yield"].price}%` : "",
    marketCtx?.macro?.["S&P 500"]                 ? `S&P 500: ${marketCtx.macro["S&P 500"].price} (1W: ${marketCtx.macro["S&P 500"].w1}%)` : "",
  ].filter(Boolean).join("\n")

  return `Eres el Agente Estratega (Chief Investment Strategist) de Finance.ia. Fecha: ${today}.

Recibes los análisis de 5 agentes especializados y debes sintetizar todo en una estrategia coherente.

PERFIL: ${riskProfile.toUpperCase()} — 65% Growth [GROWTH 🚀] / 35% Dividend [DIVIDENDO 💰]
El inversor es joven, horizonte largo, busca asimetría x5-x10 en growth y cash flow en dividendos.

══ CONTEXTO MACRO ══
${macroStr || "No disponible"}

══ OUTPUTS DE LOS 5 AGENTES SECTORIALES ══
${sectorSummaries}

TU MISIÓN:
1. Analiza correlaciones cross-sector (¿Gold y Crypto subiendo juntos? ¿Acciones tech cayendo mientras materials sube?)
2. Detecta el régimen de mercado actual (risk-on, risk-off, rotación sectorial)
3. Rankea los mejores picks de todos los sectores en orden de convicción ajustada por riesgo
4. Define la allocación óptima de portfolio para el perfil agresivo
5. Identifica los warnings más importantes
6. Escribe el executive_summary del reporte

REGLAS:
- risk_adjusted_picks: EXACTAMENTE 5-8 picks, los mejores entre todos los sectores
- Cada pick incluye: rank, sector, confidence, risk_score (1-10), risk_adjusted_score, recommendation, reasoning, position_size
- portfolio_allocation: números enteros que sumen exactamente 100
- warnings: 2-4 advertencias CONCRETAS basadas en los datos, no genéricas
- executive_summary: 3-4 oraciones, empieza con el dato macro más importante HOY

RESPONDE SOLO con este JSON:
{
  "executive_summary": "...",
  "macro_environment": {
    "summary": "2-3 oraciones con datos concretos (VIX, yields, rotación)",
    "interest_rate_outlook": "rising|stable|falling",
    "inflation_outlook": "rising|stable|falling",
    "geopolitical_risk": "high|medium|low",
    "key_factors": ["factor concreto 1", "factor concreto 2", "factor concreto 3"]
  },
  "portfolio_allocation": {
    "crypto": 0, "stocks": 0, "startups": 0, "currencies": 0, "materials": 0, "cash": 0
  },
  "cross_sector_insights": [
    { "insight": "Observación no obvia entre sectores", "implication": "Qué hacer con esto" }
  ],
  "risk_adjusted_picks": [
    {
      "rank": 1, "name": "Nombre", "symbol": "TICKER", "sector": "sector",
      "confidence": 8, "risk_score": 5, "risk_adjusted_score": 7.5,
      "recommendation": "buy",
      "reasoning": "Por qué este es el mejor pick ajustado por riesgo para perfil agresivo",
      "position_size": "X-Y% del portfolio"
    }
  ],
  "warnings": ["Advertencia concreta 1", "Advertencia concreta 2"],
  "strategy_summary": "3-4 oraciones de resumen estratégico para el perfil agresivo"
}`
}

function buildCriticPrompt(reportJson: string): string {
  return `Eres el "abogado del diablo" de inversiones. Revisa este reporte multi-agente.

REPORTE:
${reportJson.substring(0, 5000)}

Responde SOLO con JSON:
{
  "warnings_adicionales": ["advertencia específica 1", "advertencia específica 2"],
  "picks_cuestionables": [
    { "symbol": "TICKER", "razon": "Por qué esta recomendación tiene problemas" }
  ],
  "sesgo_detectado": "¿hay sesgo bullish excesivo u otro?",
  "nivel_confianza_general": "LOW|MEDIUM|HIGH",
  "veredicto": "1-2 oraciones sobre calidad del análisis"
}`
}

// ── extractJson — robusto contra trailing commas y comentarios ────────────────
function extractJson(text: string): Record<string, unknown> {
  const start = text.indexOf("{")
  if (start === -1) throw new Error(`No se encontró JSON. Preview: ${text.slice(0, 200)}`)

  let depth = 0, inString = false, escape = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape)                 { escape = false; continue }
    if (ch === "\\" && inString) { escape = true;  continue }
    if (ch === '"')              { inString = !inString; continue }
    if (inString)                continue
    if (ch === "{")              depth++
    if (ch === "}") {
      depth--
      if (depth === 0) {
        const candidate = text.slice(start, i + 1)
        try { return JSON.parse(candidate) } catch { /* sigue */ }
        const fixed = candidate.replace(/,\s*([}\]])/g, "$1")
        try { return JSON.parse(fixed) } catch { /* sigue */ }
        const noComments = fixed.replace(/\/\/[^\n]*/g, "")
        return JSON.parse(noComments)
      }
    }
  }
  throw new Error(`JSON incompleto. Preview: ${text.slice(start, start + 300)}`)
}

// ── Llama a un agente Groq con reintentos en rate limit ─────────────────────
async function callAgent(
  groq: Groq,
  systemMsg: string,
  userMsg: string,
  maxTokens = 2500,
  retries = 2
): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemMsg },
          { role: "user",   content: userMsg },
        ],
        temperature: 0.3,
        max_tokens: maxTokens,
      })
      return extractJson(result.choices[0]?.message?.content ?? "")
    } catch (err: unknown) {
      const msg = String(err)
      const isRateLimit = msg.includes("429") || msg.includes("rate_limit") || msg.includes("Rate limit")
      if (isRateLimit && attempt < retries) {
        // Esperar antes de reintentar (backoff)
        await new Promise(r => setTimeout(r, 8000 * (attempt + 1)))
        continue
      }
      throw err
    }
  }
  throw new Error("Max retries reached")
}

// ════════════════════════════════════════════════════════════════════════════
// POST handler — SSE streaming
// ════════════════════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (step: string, msg: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step, msg })}\n\n`))
      }

      try {
        const body        = await request.json().catch(() => ({}))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const riskProfile = (body as any).risk_profile ?? "aggressive"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sectors: string[] = (body as any).sectors ?? ["crypto", "stocks", "startups", "currencies", "materials"]
        const rootDir    = path.join(process.cwd(), "..")
        const reportPath = path.join(rootDir, "dashboard", "public", "data", "report.json")
        const tickerDir  = path.join(rootDir, "dashboard", "public", "data", "ticker")
        const today      = new Date().toISOString().split("T")[0]
        const groq       = new Groq({ apiKey: process.env.GROQ_API_KEY })

        // ── PASO 1: Contexto macro ─────────────────────────────────────────
        send("macro", "Obteniendo VIX, yields, S&P 500 y rotación sectorial...")
        let marketCtx: Record<string, unknown> = {}
        try {
          const { stdout } = await execAsync("python market_context.py", {
            cwd: rootDir, env: { ...process.env, PYTHONUTF8: "1" }, timeout: 30000,
          })
          marketCtx = JSON.parse(stdout)
        } catch {
          send("macro", "Contexto macro parcial, continuando...")
        }

        // ── PASO 2: Análisis Python para todos los tickers de los sectores ──
        const allTickers = getAllTickers(sectors)
        send("deep", `Python analizando ${allTickers.length} tickers: ${allTickers.join(", ")}...`)
        try {
          await execAsync(`python analisis_maia.py ${allTickers.join(" ")}`, {
            cwd: rootDir, env: { ...process.env, PYTHONUTF8: "1" }, timeout: 240000,
          })
        } catch {
          send("deep", "Análisis Python parcial, continuando con datos disponibles...")
        }

        // ── PASO 3: Cargar JSONs generados ────────────────────────────────
        const allTickerData = loadTickerData(allTickers, tickerDir)

        // ── PASO 4: Ejecutar agentes secuencialmente (evitar rate limit Groq) ──
        const agentSystem = "You are a specialized financial analysis agent. Respond ONLY with a valid JSON object. No markdown, no code blocks, no text outside the JSON. Start with { and end with }."
        const sectorOutputs: Record<string, Record<string, unknown>> = {}

        type AgentDef = { key: string; label: string; prompt: string; maxTokens: number }
        const agentQueue: AgentDef[] = []

        if (sectors.includes("crypto")) {
          agentQueue.push({ key: "crypto", label: "Crypto (BTC, ETH, SOL)",
            prompt: buildCryptoAgentPrompt(buildDataContext(SECTOR_TICKERS.crypto, allTickerData, marketCtx), today),
            maxTokens: 2500 })
        }
        if (sectors.includes("stocks")) {
          agentQueue.push({ key: "stocks", label: "Acciones (NVDA, AAPL, AMZN, KO)",
            prompt: buildStocksAgentPrompt(buildDataContext(SECTOR_TICKERS.stocks, allTickerData, marketCtx), today),
            maxTokens: 2500 })
        }
        if (sectors.includes("startups")) {
          agentQueue.push({ key: "startups", label: "Growth/Startups (MELI, PLTR, HOOD)",
            prompt: buildStartupsAgentPrompt(buildDataContext(SECTOR_TICKERS.startups, allTickerData, marketCtx), today),
            maxTokens: 2500 })
        }
        if (sectors.includes("materials")) {
          agentQueue.push({ key: "materials", label: "Materias Primas (GLD, SLV, XOM)",
            prompt: buildMaterialsAgentPrompt(buildDataContext(SECTOR_TICKERS.materials, allTickerData, marketCtx), today),
            maxTokens: 2500 })
        }
        if (sectors.includes("currencies")) {
          agentQueue.push({ key: "currencies", label: "Divisas (EUR/USD, DXY...)",
            prompt: buildCurrenciesAgentPrompt(marketCtx, today),
            maxTokens: 2000 })
        }

        send("agents", `Ejecutando ${agentQueue.length} agentes especializados...`)

        for (const agent of agentQueue) {
          send("agents", `▶ Agente ${agent.label}...`)
          try {
            const result = await callAgent(groq, agentSystem, agent.prompt, agent.maxTokens)
            sectorOutputs[agent.key] = result
            const n = Array.isArray(result.assets) ? result.assets.length : 0
            send("agents", `✓ ${agent.label} — ${n} activos analizados`)
          } catch (err) {
            console.error(`[agent:${agent.key}]`, err)
            sectorOutputs[agent.key] = {
              sector: agent.key, assets: [], sector_summary: "Error al contactar agente",
              sector_outlook: "neutral", top_pick: "", top_pick_reasoning: "", _error: true,
            }
            send("agents", `⚠ ${agent.label} — error, continuando...`)
          }
        }

        const agentSummary = Object.entries(sectorOutputs).map(([k, v]) => {
          const n = Array.isArray(v.assets) ? v.assets.length : 0
          return `${k.toUpperCase()}(${(v as {_error?: boolean})._error ? "⚠" : n + " activos"})`
        }).join(", ")
        send("agents", `Completados: ${agentSummary}`)

        // ── PASO 5: Agente Estratega — síntesis cross-sector ──────────────
        send("strategy", "Agente Estratega sintetizando los 5 sectores...")
        let strategyOutput: Record<string, unknown> = {}
        try {
          strategyOutput = await callAgent(
            groq,
            agentSystem,
            buildStrategyAgentPrompt(sectorOutputs, marketCtx, riskProfile, today),
            4000
          )
        } catch (e) {
          send("strategy", "Error en agente estratega, usando fallback...")
          console.error("[strategy agent]", e)
        }

        // ── PASO 6: Pasada crítica ─────────────────────────────────────────
        send("critic", "Agente crítico verificando sesgos y advertencias...")
        let criticOutput: Record<string, unknown> = {}
        try {
          const previewStr = JSON.stringify({ strategy: strategyOutput, sectors: sectorOutputs }).slice(0, 4000)
          criticOutput = await callAgent(
            groq,
            "You are a financial risk analyst. Respond ONLY with valid JSON.",
            buildCriticPrompt(previewStr),
            800
          )
        } catch { /* falla silenciosamente */ }

        // ── PASO 7: Reemplazar key_news con noticias reales de Python ────
        for (const sectorData of Object.values(sectorOutputs)) {
          const assets = (sectorData as {assets?: {symbol?: string; key_news?: unknown[]}[]}).assets ?? []
          for (const asset of assets) {
            const symbol = (asset.symbol ?? "").toUpperCase()
            const tp = path.join(tickerDir, `${symbol}.json`)
            if (fs.existsSync(tp)) {
              try {
                const td = JSON.parse(fs.readFileSync(tp, "utf-8"))
                asset.key_news = td.noticias_ticker ?? []
              } catch { asset.key_news = [] }
            } else {
              asset.key_news = []
            }
          }
        }

        // ── PASO 8: Merge — construir report.json final ───────────────────
        send("saving", "Guardando reporte verificado...")

        const warningsBase: string[]  = (strategyOutput.warnings as string[])  ?? []
        const warningsExtra: string[] = (criticOutput.warnings_adicionales as string[]) ?? []

        // Marcar picks cuestionables del crítico
        if (Array.isArray(strategyOutput.risk_adjusted_picks)) {
          const badPicks = (criticOutput.picks_cuestionables as {symbol: string, razon: string}[]) ?? []
          strategyOutput.risk_adjusted_picks = (strategyOutput.risk_adjusted_picks as Record<string, unknown>[]).map(pick => {
            const issue = badPicks.find(p => p.symbol === pick.symbol)
            return issue ? { ...pick, _critic_note: issue.razon } : pick
          })
        }

        const reportJson: Record<string, unknown> = {
          brand:         "Finance.ia",
          creator:       "Benjamin Hurtado",
          generated_at:  new Date().toISOString(),
          risk_profile:  riskProfile,

          // De la capa Strategy Agent
          executive_summary:    strategyOutput.executive_summary    ?? "Análisis multi-agente completado.",
          macro_environment:    strategyOutput.macro_environment    ?? {},
          portfolio_allocation: strategyOutput.portfolio_allocation ?? {},
          cross_sector_insights: strategyOutput.cross_sector_insights ?? [],
          risk_adjusted_picks:  strategyOutput.risk_adjusted_picks  ?? [],
          warnings:             [...new Set([...warningsBase, ...warningsExtra])],
          strategy_summary:     strategyOutput.strategy_summary     ?? "",

          historical_accuracy: {
            previous_date: null, calls_made: 0, calls_correct: 0,
            accuracy_pct: 0, notable: `Análisis multi-agente — ${today}`,
          },

          // Los 5 sectores
          sectors: sectorOutputs,

          // Metadatos de generación
          _generated_by: "multi-agent: crypto+stocks+startups+currencies+materials+strategy",
          _agents_status: Object.fromEntries(
            Object.keys(sectorOutputs).map(k => [k, (sectorOutputs[k] as {_error?: boolean})._error ? "error" : "ok"])
          ),
          _market_context: {
            vix:             (marketCtx as {macro?: Record<string, {price: number}>})?.macro?.["VIX (Fear Index)"]?.price,
            tnx:             (marketCtx as {macro?: Record<string, {price: number}>})?.macro?.["10Y Treasury Yield"]?.price,
            insights:        (marketCtx as {insights?: string[]})?.insights ?? [],
            critic_veredicto: criticOutput.veredicto ?? null,
            critic_confianza: criticOutput.nivel_confianza_general ?? null,
            sesgo_detectado:  criticOutput.sesgo_detectado ?? null,
          },
        }

        fs.writeFileSync(reportPath, JSON.stringify(reportJson, null, 2), "utf-8")

        const confianza = criticOutput.nivel_confianza_general ?? "N/D"
        const nAgents   = Object.keys(sectorOutputs).filter(k => !(sectorOutputs[k] as {_error?: boolean})._error).length
        send("done", `¡Listo! ${nAgents}/${agentQueue.length} agentes exitosos. Confianza del crítico: ${confianza}. Recargando...`)
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
