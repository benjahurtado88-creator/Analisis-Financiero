import { NextRequest, NextResponse } from "next/server"
import { execSync } from "child_process"
import path from "path"
import fs from "fs"

export async function POST(req: NextRequest) {
  let ticker = ""
  try {
    const body = await req.json()
    ticker = (body.ticker ?? "").toUpperCase().trim()
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
  }

  if (!ticker || !/^[A-Z0-9.\-]{1,12}$/.test(ticker)) {
    return NextResponse.json({ error: "Ticker inválido" }, { status: 400 })
  }

  const projectRoot = path.resolve(process.cwd(), "..")
  const scriptPath  = path.join(projectRoot, "analisis_maia.py")

  if (!fs.existsSync(scriptPath)) {
    return NextResponse.json({ error: "Script analisis_maia.py no encontrado" }, { status: 500 })
  }

  try {
    execSync(`python "${scriptPath}" ${ticker}`, {
      cwd: projectRoot,
      timeout: 120_000,
      env: { ...process.env, PYTHONUTF8: "1" },
      stdio: "pipe",
    })
  } catch (err: unknown) {
    const e = err as { stderr?: Buffer; stdout?: Buffer; message?: string }
    const stderr = e.stderr?.toString("utf-8") ?? ""
    const stdout = e.stdout?.toString("utf-8") ?? ""
    const detail = [stderr, stdout].filter(Boolean).join("\n").trim() || e.message || "Error desconocido"
    console.error("[analyze]", detail)
    return NextResponse.json({
      error: `Error al analizar ${ticker}:\n${detail}`
    }, { status: 500 })
  }

  const jsonPath = path.join(process.cwd(), "public", "data", "ticker", `${ticker}.json`)
  if (!fs.existsSync(jsonPath)) {
    return NextResponse.json({ error: "El análisis no generó datos. Verifica que el ticker existe." }, { status: 500 })
  }

  return NextResponse.json({ success: true, ticker })
}
