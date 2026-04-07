import { cn } from "@/lib/utils"

const VERDICT_CONFIG: Record<string, { color: string; bg: string; emoji: string; desc: string }> = {
  "COMPRA FUERTE": { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", emoji: "🟢", desc: "Los fundamentos y el técnico apuntan a una oportunidad clara." },
  "COMPRA":        { color: "text-green-700",   bg: "bg-green-50 border-green-200",     emoji: "🟢", desc: "Más señales positivas que negativas. Vale la pena considerar." },
  "MANTENER / ESPERAR": { color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", emoji: "🟡", desc: "No es momento ideal de entrar ni de salir. Esperar mejor precio." },
  "EVITAR":        { color: "text-red-700",     bg: "bg-red-50 border-red-200",         emoji: "🔴", desc: "Los riesgos superan las oportunidades en este momento." },
  "MOMENTUM FUERTE": { color: "text-purple-700", bg: "bg-purple-50 border-purple-200",  emoji: "🚀", desc: "Tendencia alcista fuerte en cripto. Alto riesgo, alta recompensa." },
  "NEUTRAL / VIGILAR": { color: "text-zinc-700", bg: "bg-zinc-50 border-zinc-200",      emoji: "👀", desc: "Sin señal clara. Monitorear de cerca antes de actuar." },
  "PRECAUCION":    { color: "text-orange-700",  bg: "bg-orange-50 border-orange-200",   emoji: "⚠️", desc: "Señales bajistas. Solo para inversores con alta tolerancia al riesgo." },
}

export function VerdictBadge({ verdict, score }: { verdict: string; score: number }) {
  const cfg = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG["NEUTRAL / VIGILAR"]
  return (
    <div className={cn("rounded-xl border-2 p-4", cfg.bg)}>
      <div className="flex items-center gap-3">
        <span className="text-3xl">{cfg.emoji}</span>
        <div>
          <p className={cn("text-xl font-bold tracking-tight", cfg.color)}>{verdict}</p>
          <p className="text-sm text-zinc-500">{cfg.desc}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-bold text-zinc-800">{score}<span className="text-sm font-normal text-zinc-400">/7</span></p>
          <p className="text-xs text-zinc-400">score</p>
        </div>
      </div>
      <div className="mt-3 flex gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className={cn("h-2 flex-1 rounded-full", i < score ? cfg.color.replace("text-", "bg-") : "bg-zinc-200")} />
        ))}
      </div>
    </div>
  )
}
