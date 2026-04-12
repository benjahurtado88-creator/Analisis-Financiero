import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import fs from "fs"
import Groq from "groq-sdk"

const execAsync = promisify(exec)
export const maxDuration = 60

export async function POST() {
  try {
    const rootDir    = path.join(process.cwd(), "..")
    const reportPath = path.join(rootDir, "dashboard", "public", "data", "report.json")

    // Leer reporte existente para no sobreescribir todo
    const existing: Record<string, unknown> = fs.existsSync(reportPath)
      ? JSON.parse(fs.readFileSync(reportPath, "utf-8"))
      : {}

    // 1. Contexto macro fresco (VIX, yields, rotación sectorial)
    let marketCtx: Record<string, unknown> = {}
    try {
      const { stdout } = await execAsync("python market_context.py", {
        cwd: rootDir,
        env: { ...process.env, PYTHONUTF8: "1" },
        timeout: 25000,
      })
      marketCtx = JSON.parse(stdout)
    } catch { /* continúa con contexto vacío */ }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const macro = marketCtx as any
    const insights: string[] = macro.insights ?? []
    const sp500  = macro.macro?.["S&P 500"]   ? `S&P 500: $${macro.macro["S&P 500"].price} (1W: ${macro.macro["S&P 500"].w1}%)` : ""
    const nasdaq = macro.macro?.["Nasdaq"]     ? `Nasdaq: $${macro.macro["Nasdaq"].price} (1W: ${macro.macro["Nasdaq"].w1}%)` : ""
    const vix    = macro.macro?.["VIX (Fear Index)"] ? `VIX: ${macro.macro["VIX (Fear Index)"].price}` : ""
    const tnx    = macro.macro?.["10Y Treasury Yield"] ? `10Y yield: ${macro.macro["10Y Treasury Yield"].price}%` : ""

    const sectorRotation = macro.sectors
      ? Object.entries(macro.sectors as Record<string, {w1: number}>)
          .sort((a, b) => (b[1].w1 ?? 0) - (a[1].w1 ?? 0))
          .map(([name, d]) => `${name}: ${d.w1 > 0 ? "+" : ""}${d.w1}% 1W`)
          .join(" | ")
      : ""

    const today = new Date().toISOString().split("T")[0]

    const prompt = `Eres un macro strategist senior. Fecha: ${today}.

DATOS DE MERCADO EN TIEMPO REAL:
${[vix, tnx, sp500, nasdaq, ...insights].filter(Boolean).join("\n")}

Rotación sectorial (1 semana):
${sectorRotation || "Sin datos de rotación"}

Genera un resumen macroeconómico actualizado y un executive summary para un inversor agresivo (65% growth, 35% dividend). Responde SOLO con JSON válido:
{
  "executive_summary": "3-4 oraciones. Empieza con el dato más importante HOY (cita VIX, yield o índice). Directo, sin eufemismos. Enfocado en oportunidad/riesgo concreto.",
  "macro_environment": {
    "summary": "2-3 oraciones citando VIX, yield y rotación sectorial con números reales.",
    "interest_rate_outlook": "rising|stable|falling",
    "inflation_outlook": "rising|stable|falling",
    "geopolitical_risk": "high|medium|low",
    "key_factors": ["factor concreto con número 1", "factor concreto con número 2", "factor concreto con número 3"]
  }
}
Solo JSON.`

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const result = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.25,
      max_tokens: 800,
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

    // Actualizar solo executive_summary y macro_environment en el report.json
    const updated = {
      ...existing,
      executive_summary: parsed.executive_summary ?? existing.executive_summary,
      macro_environment:  parsed.macro_environment  ?? existing.macro_environment,
      _macro_refreshed_at: new Date().toISOString(),
    }

    fs.writeFileSync(reportPath, JSON.stringify(updated, null, 2), "utf-8")

    return Response.json({
      ok: true,
      refreshedAt: updated._macro_refreshed_at,
      executive_summary: updated.executive_summary,
      macro_environment:  updated.macro_environment,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}
