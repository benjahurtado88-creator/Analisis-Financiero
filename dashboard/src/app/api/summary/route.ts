import { NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import Groq from "groq-sdk"

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

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  // Construir resumen de datos para el prompt
  const p = data.precio ?? {}
  const info = data.info ?? {}
  const f = data.fundamentales ?? {}
  const fv = data.fair_value ?? {}
  const esc = data.escenarios ?? {}
  const moat = data.moat ?? {}
  const riesgos: unknown[] = Array.isArray(data.riesgos) ? data.riesgos : []
  const dcf = data.dcf ?? {}

  const contexto = `
TICKER: ${data.ticker}
TIPO: ${data.es_cripto ? "Criptomoneda" : "Acción"}
SECTOR: ${info.sector ?? "N/A"} — ${info.industria ?? ""}
VEREDICTO: ${data.veredicto} (score ${data.score}/10)

PRECIO ACTUAL: $${p.precio_actual}
Cambio 24h: ${p.cambio_24h}% | 7d: ${p.cambio_7d}% | 30d: ${p.cambio_30d}% | YTD: ${p.cambio_ytd}%
RSI: ${p.rsi} | Tendencia SMA: ${p.tendencia_sma} | MACD: ${p.macd_bullish ? "ALCISTA" : "BAJISTA"}
Soporte: $${p.soporte} | Resistencia: $${p.resistencia}
Máx 52 semanas: $${p.high_52w} | Mín 52 semanas: $${p.low_52w}

FUNDAMENTOS (si aplica):
P/E: ${f.pe_ratio ?? "N/A"} | FCF Yield: ${f.fcf_yield ?? "N/A"}% | ROE: ${f.roe ?? "N/A"}% | Margen neto: ${f.net_margin ?? "N/A"}%
Deuda/Patrimonio: ${f.debt_to_equity ?? "N/A"} | Cobertura intereses: ${f.interest_coverage ?? "N/A"}x

VALOR JUSTO:
Fair Value P/E: $${fv.fair_value_pe ?? "N/A"} | Margen de seguridad: ${fv.safety_margin_pct ?? "N/A"}%
Zona compra agresiva: $${fv.buy_zone_aggressive ?? "N/A"} | Zona compra conservadora: $${fv.buy_zone_conservative ?? "N/A"}

ESCENARIOS DE PRECIO:
Bear (pesimista): $${esc.bear ?? "N/A"} (${esc.bear_upside ?? "N/A"}%)
Base (probable): $${esc.base ?? "N/A"} (${esc.base_upside ?? "N/A"}%)
Bull (optimista): $${esc.bull ?? "N/A"} (${esc.bull_upside ?? "N/A"}%)

FOSO COMPETITIVO: ${moat.nivel ?? "N/A"} (${moat.score ?? "N/A"}/${moat.max ?? 5})
Factores: ${(moat.factores ?? []).join(" | ")}

DCF/VALORACIÓN: ${dcf.metodo ?? "N/A"} → Valor intrínseco: $${dcf.valor_intrinseco ?? "N/A"} | Margen: ${dcf.margen_seguridad_pct ?? "N/A"}%

RIESGOS PRINCIPALES: ${riesgos.slice(0, 3).map((r: unknown) => {
    const risk = r as Record<string, unknown>
    return `${risk.categoria ?? ""}: ${risk.descripcion ?? ""}`
  }).join(" | ")}

ANALISTAS: Objetivo $${info.analyst_target ?? "N/A"} (${info.analyst_rec ?? "N/A"}, ${info.analyst_count ?? 0} analistas)
`.trim()

  const prompt = `Eres un analista financiero educador. Tu misión es explicar este análisis financiero de ${data.ticker} en UN solo párrafo de 180–240 palabras, escrito en español simple y claro para alguien que nunca ha invertido.

REGLAS IMPORTANTES:
- Empieza explicando brevemente qué hace o qué es este activo (1-2 oraciones)
- Explica la situación actual del precio y tendencia en palabras simples
- Explica qué significa el veredicto "${data.veredicto}" para el inversor
- Menciona el escenario más probable y qué upside/downside implica
- Cierra con el riesgo principal más importante que el lector debe conocer
- NUNCA uses jerga sin explicarla. Si dices "RSI", explica que es un indicador de si algo está sobrecomprado/sobrevendido
- Tono: cercano, claro, educativo — como si le hablaras a un amigo inteligente que quiere aprender
- NO uses bullet points. Solo prosa continua en UN párrafo

DATOS DEL ANÁLISIS:
${contexto}

Escribe SOLO el párrafo, sin título ni encabezado.`

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "Eres un analista financiero educador. Respondes solo con el párrafo solicitado, sin títulos, sin markdown, sin listas." },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 400,
    })

    const summary = completion.choices[0]?.message?.content?.trim() ?? ""
    return NextResponse.json({ summary })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[summary] Groq error:", msg)
    return NextResponse.json({ error: "Error generando resumen" }, { status: 500 })
  }
}
