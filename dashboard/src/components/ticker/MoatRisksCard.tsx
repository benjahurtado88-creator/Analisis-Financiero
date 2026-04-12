import { cn } from "@/lib/utils"
import { Shield, AlertTriangle } from "lucide-react"

interface Moat {
  score: number; max: number; nivel: string; factores: string[]
}

interface Riesgo {
  tipo: string; nivel: "HIGH" | "MEDIUM" | "LOW"; desc: string
}

export function MoatCard({ moat }: { moat?: Moat }) {
  if (!moat || moat.score === undefined || !moat.factores?.length) return null

  const pct = moat.score / moat.max
  const color = pct >= 0.8 ? "text-emerald-600" : pct >= 0.5 ? "text-yellow-600" : "text-red-500"
  const bg    = pct >= 0.8 ? "bg-emerald-50 border-emerald-200" : pct >= 0.5 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"

  return (
    <div className={cn("rounded-xl border p-5", bg)}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={15} className={color} />
          <p className="text-sm font-semibold text-zinc-600">Foso Competitivo (Moat)</p>
        </div>
        <div className="text-right">
          <span className={cn("text-xl font-bold", color)}>{moat.score}/{moat.max}</span>
          <p className={cn("text-xs font-semibold", color)}>{moat.nivel}</p>
        </div>
      </div>
      <div className="mb-3 flex gap-1">
        {Array.from({ length: moat.max }).map((_, i) => (
          <div key={i} className={cn("h-2 flex-1 rounded-full", i < moat.score ? color.replace("text-", "bg-") : "bg-zinc-200")} />
        ))}
      </div>
      <ul className="space-y-1">
        {moat.factores.map((f, i) => (
          <li key={i} className={cn("text-xs",
            f.startsWith("[+]") ? "text-emerald-700" :
            f.startsWith("[-]") ? "text-red-600" : "text-yellow-700"
          )}>
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function RisksCard({ riesgos }: { riesgos?: Riesgo[] }) {
  if (!riesgos?.length) return null

  const high = riesgos.filter(r => r.nivel === "HIGH")
  const med  = riesgos.filter(r => r.nivel === "MEDIUM")

  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle size={15} className="text-amber-500" />
        <p className="text-sm font-semibold text-zinc-500">Riesgos Detectados</p>
      </div>
      <div className="space-y-2">
        {[...high, ...med].map((r, i) => (
          <div key={i} className={cn(
            "flex items-start gap-2 rounded-lg px-3 py-2",
            r.nivel === "HIGH" ? "bg-red-50" : "bg-amber-50"
          )}>
            <span className={cn("mt-0.5 flex-shrink-0 text-xs font-bold rounded px-1.5 py-0.5",
              r.nivel === "HIGH" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
            )}>
              {r.tipo}
            </span>
            <p className="text-xs text-zinc-600">{r.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
