import { exec } from "child_process"
import { promisify } from "util"
import path from "path"

const execAsync = promisify(exec)
export const maxDuration = 120

export async function POST() {
  try {
    const rootDir = path.join(process.cwd(), "..")
    await execAsync("python update_report_prices.py", {
      cwd: rootDir,
      env: { ...process.env, PYTHONUTF8: "1" },
      timeout: 90000,
    })
    return Response.json({ ok: true, updatedAt: new Date().toISOString() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}
