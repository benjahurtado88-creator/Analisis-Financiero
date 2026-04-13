import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

// Guardado fuera de public/ para que no sea accesible directamente como archivo estático
const DATA_FILE = path.join(process.cwd(), "data", "portfolio.json")

function ensureDir() {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// GET — devuelve el portfolio guardado en el servidor
export async function GET() {
  try {
    ensureDir()
    if (!fs.existsSync(DATA_FILE)) {
      return NextResponse.json({ portfolio: null })
    }
    const raw = fs.readFileSync(DATA_FILE, "utf-8")
    return NextResponse.json({ portfolio: JSON.parse(raw) })
  } catch {
    return NextResponse.json({ portfolio: null })
  }
}

// POST — guarda el portfolio en el servidor
export async function POST(req: NextRequest) {
  try {
    ensureDir()
    const body = await req.json()
    if (!body?.portfolio) {
      return NextResponse.json({ ok: false, error: "No portfolio data" }, { status: 400 })
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(body.portfolio, null, 2), "utf-8")
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
