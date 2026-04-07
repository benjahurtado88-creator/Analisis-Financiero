import { cn } from "@/lib/utils"
import { TrendingUp } from "lucide-react"

interface SentimentSignal {
  factor: string
  valor: string
  señal: "BULLISH" | "BEARISH" | "NEUTRAL"
  peso: string
  desc: string
}

interface Sentimiento {
  score: number
  max: number
  label: string
  fuente: string
  señales?: SentimentSignal[]
}

function signalColor(señal: string) {
  if (señal === "BULLISH") return "text-emerald-600 bg-emerald-50"
  if (señal === "BEARISH") return "text-red-600 bg-red-50"
  return "text-zinc-500 bg-zinc-50"
}

export function SentimentCard({ sentimiento }: { sentimiento?: Sentimiento }) {
  if (!sentimiento || sentimiento.score === undefined) return null

  const pct = (sentimiento.score + 10) / 20  // normalize -10..+10 → 0..1
  const scoreColor =
    sentimiento.score >= 4 ? "text-emerald-600" :
    sentimiento.score >= 2 ? "text-emerald-500" :
    sentimiento.score >= -1 ? "text-zinc-500" :
    sentimiento.score >= -3 ? "text-amber-600" : "text-red-600"

  const barColor =
    sentimiento.score >= 4 ? "bg-emerald-500" :
    sentimiento.score >= 2 ? "bg-emerald-400" :
    sentimiento.score >= -1 ? "bg-zinc-400" :
    sentimiento.score >= -3 ? "bg-amber-500" : "bg-red-500"

  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-zinc-400" />
          <p className="text-sm font-semibold text-zinc-500">Sentimiento de Mercado</p>
        </div>
        <div className="text-right">
          <span className={cn("text-xl font-bold", scoreColor)}>
            {sentimiento.score > 0 ? "+" : ""}{sentimiento.score}/{sentimiento.max}
          </span>
          <p className={cn("text-xs font-semibold", scoreColor)}>{sentimiento.label}</p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="mb-4 h-2 w-full rounded-full bg-zinc-100">
        <div
          className={cn("h-2 rounded-full transition-all", barColor)}
          style={{ width: `${Math.max(4, pct * 100)}%` }}
        />
      </div>

      {/* Señales */}
      {sentimiento.señales && sentimiento.señales.length > 0 && (
        <div className="space-y-1.5">
          {sentimiento.señales.map((s, i) => (
            <div key={i} className="flex items-start justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-700">{s.factor}</p>
                <p className="text-xs text-zinc-400 leading-snug">{s.desc}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={cn("text-xs font-semibold rounded px-1.5 py-0.5", signalColor(s.señal))}>
                  {s.señal}
                </span>
                <span className="text-xs font-bold text-zinc-500">{s.peso}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-300">{sentimiento.fuente}</p>
    </div>
  )
}
