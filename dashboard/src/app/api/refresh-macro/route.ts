import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import fs from "fs"
import Groq from "groq-sdk"

const execAsync = promisify(exec)
export const maxDuration = 90

export async function POST() {
  try {
    const rootDir    = path.join(process.cwd(), "..")
    const reportPath = path.join(rootDir, "dashboard", "public", "data", "report.json")

    // Leer reporte existente
    const existing: Record<string, unknown> = fs.existsSync(reportPath)
      ? JSON.parse(fs.readFileSync(reportPath, "utf-8"))
      : {}

    // ── 1. Contexto macro fresco (VIX, yields, sector rotation + noticias RSS) ──
    let marketCtx: Record<string, unknown> = {}
    try {
      const { stdout } = await execAsync("python market_context.py", {
        cwd: rootDir,
        env: { ...process.env, PYTHONUTF8: "1" },
        timeout: 45000,  // más tiempo por el fetch de noticias en paralelo
      })
      marketCtx = JSON.parse(stdout)
    } catch { /* continúa con contexto vacío */ }

    // ── 2. Portfolio del usuario (para personalizar oportunidades) ───────────
    let portfolioTickers: string[] = []
    try {
      const pfPath = path.join(process.cwd(), "data", "portfolio.json")
      if (fs.existsSync(pfPath)) {
        const pf = JSON.parse(fs.readFileSync(pfPath, "utf-8"))
        portfolioTickers = (pf.categories ?? [])
          .flatMap((c: { stocks: { ticker: string }[] }) => c.stocks.map((s) => s.ticker))
      }
    } catch { /* sin portfolio */ }

    // ── 3. Construir contexto para el prompt ─────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const macro = marketCtx as any
    const insights: string[] = macro.insights ?? []
    const news: { title: string; url: string; source: string }[] = macro.news ?? []

    const sp500  = macro.macro?.["S&P 500"]            ? `S&P 500: $${macro.macro["S&P 500"].price} (1W: ${macro.macro["S&P 500"].w1}%)` : ""
    const nasdaq = macro.macro?.["Nasdaq"]             ? `Nasdaq: $${macro.macro["Nasdaq"].price} (1W: ${macro.macro["Nasdaq"].w1}%)` : ""
    const vix    = macro.macro?.["VIX (Fear Index)"]   ? `VIX: ${macro.macro["VIX (Fear Index)"].price}` : ""
    const tnx    = macro.macro?.["10Y Treasury Yield"] ? `10Y yield: ${macro.macro["10Y Treasury Yield"].price}%` : ""
    const gold   = macro.macro?.["Gold ETF"]           ? `Gold: $${macro.macro["Gold ETF"].price} (1W: ${macro.macro["Gold ETF"].w1}%)` : ""
    const btc    = macro.macro?.["Bitcoin"]            ? `Bitcoin: $${macro.macro["Bitcoin"].price} (1W: ${macro.macro["Bitcoin"].w1}%)` : ""
    const dxy    = macro.macro?.["Dollar Index (DXY)"] ? `DXY: ${macro.macro["Dollar Index (DXY)"].price} (1W: ${macro.macro["Dollar Index (DXY)"].w1}%)` : ""

    const sectorRotation = macro.sectors
      ? Object.entries(macro.sectors as Record<string, { w1: number }>)
          .sort((a, b) => (b[1].w1 ?? 0) - (a[1].w1 ?? 0))
          .map(([name, d]) => `${name}: ${d.w1 > 0 ? "+" : ""}${d.w1}% 1W`)
          .join(" | ")
      : ""

    const newsBlock = news.length > 0
      ? news.slice(0, 8).map((n, i) => `${i + 1}. [${n.source}] ${n.title}`).join("\n")
      : "Sin noticias disponibles en este momento."

    const today = new Date().toISOString().split("T")[0]

    const portfolioBlock = portfolioTickers.length > 0
      ? `Portfolio actual del usuario: ${portfolioTickers.join(", ")}`
      : "Portfolio del usuario: vacío"

    // ── 4. Prompt mejorado ───────────────────────────────────────────────────
    const prompt = `Eres un macro strategist senior con perfil de inversión AGRESIVO (65% growth / 35% dividend).
Fecha de hoy: ${today}.
${portfolioBlock}

═══════════════════════════════════════
NOTICIAS FINANCIERAS REALES (últimas 48h):
${newsBlock}

═══════════════════════════════════════
DATOS DE MERCADO EN TIEMPO REAL:
${[vix, tnx, sp500, nasdaq, gold, btc, dxy, ...insights].filter(Boolean).join("\n")}

Rotación sectorial (1 semana):
${sectorRotation || "Sin datos"}

═══════════════════════════════════════
INSTRUCCIONES:
Basándote SOLO en las noticias y datos reales de arriba (no inventes eventos), genera:
1. Un executive_summary que conecte las noticias más importantes con su impacto directo en el mercado (cita números reales)
2. macro_environment con los drivers actuales
3. macro_opportunities con oportunidades concretas en 3 horizontes temporales
   - "short": días a 4 semanas (basado en noticias/eventos actuales)
   - "medium": 1 a 6 meses (tendencias en curso)
   - "long": 6 a 24 meses (mega-tendencias estructurales)
4. hidden_gems: 2-3 activos que el mercado está pasando por alto pero que tienen catalizado por estas noticias
5. avoid: qué activos/sectores evitar ahora y por qué

Reglas:
- Solo menciona tickers que existan y sean relevantes para el tema
- En hidden_gems: busca empresas que SE BENEFICIEN de la misma tendencia que todos están comprando, pero que están en la sombra
- Para el usuario: si ya tiene algo en su portfolio, puedes mencionar si debe agregar más o reducir
- Sé directo y accionable. Sin eufemismos.

Responde SOLO con JSON válido (sin markdown, sin explicaciones):
{
  "executive_summary": "3-4 oraciones. Empieza con el evento más importante HOY y su impacto de mercado concreto.",
  "macro_environment": {
    "summary": "2-3 oraciones con números reales del mercado actual.",
    "interest_rate_outlook": "rising|stable|falling",
    "inflation_outlook": "rising|stable|falling",
    "geopolitical_risk": "high|medium|low",
    "key_factors": ["factor con dato real 1", "factor con dato real 2", "factor con dato real 3", "factor 4"]
  },
  "macro_opportunities": {
    "short": [
      { "theme": "nombre del tema", "idea": "explicación concisa de la oportunidad y por qué ahora", "tickers": ["TICK1","TICK2"], "conviction": "high|medium|low" }
    ],
    "medium": [
      { "theme": "nombre del tema", "idea": "...", "tickers": ["TICK1"], "conviction": "high|medium|low" }
    ],
    "long": [
      { "theme": "nombre del tema", "idea": "...", "tickers": ["TICK1","TICK2"], "conviction": "high|medium|low" }
    ],
    "hidden_gems": [
      { "ticker": "TICK", "name": "Nombre empresa", "reason": "Por qué está siendo ignorado y por qué es una oportunidad real", "theme": "Tema al que está expuesto" }
    ],
    "avoid": ["sector/activo a evitar con razón concisa"]
  }
}`

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const result = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1800,
    })

    const text = result.choices[0]?.message?.content ?? ""
    let parsed: Record<string, unknown> = {}
    try {
      const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim()
      const match = cleaned.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(match ? match[0] : cleaned)
    } catch {
      return Response.json({ ok: false, error: "Failed to parse AI response" }, { status: 500 })
    }

    // ── 5. Guardar en report.json ─────────────────────────────────────────────
    const updated = {
      ...existing,
      executive_summary:    parsed.executive_summary    ?? existing.executive_summary,
      macro_environment:    parsed.macro_environment    ?? existing.macro_environment,
      macro_opportunities:  parsed.macro_opportunities  ?? existing.macro_opportunities,
      _macro_refreshed_at:  new Date().toISOString(),
      _macro_news_used:     news.slice(0, 5).map(n => ({ title: n.title, source: n.source, url: n.url })),
    }

    fs.writeFileSync(reportPath, JSON.stringify(updated, null, 2), "utf-8")

    // También actualizar report-es.json si existe (misma data, el texto ya saldrá en español del prompt)
    const esPath = path.join(rootDir, "dashboard", "public", "data", "report-es.json")
    if (fs.existsSync(esPath)) {
      try {
        const esExisting = JSON.parse(fs.readFileSync(esPath, "utf-8"))
        fs.writeFileSync(esPath, JSON.stringify({
          ...esExisting,
          executive_summary:   updated.executive_summary,
          macro_environment:   updated.macro_environment,
          macro_opportunities: updated.macro_opportunities,
          _macro_refreshed_at: updated._macro_refreshed_at,
        }, null, 2), "utf-8")
      } catch { /* no crítico */ }
    }

    return Response.json({
      ok: true,
      refreshedAt:         updated._macro_refreshed_at,
      executive_summary:   updated.executive_summary,
      macro_environment:   updated.macro_environment,
      macro_opportunities: updated.macro_opportunities,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}
