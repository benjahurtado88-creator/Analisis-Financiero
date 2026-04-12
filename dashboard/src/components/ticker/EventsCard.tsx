import { cn } from "@/lib/utils"
import { Calendar } from "lucide-react"

interface Eventos {
  earnings_fecha?: string
  earnings_eps_est?: number
  earnings_eps_low?: number
  earnings_eps_high?: number
  ex_dividendo?: string
  pago_dividendo?: string
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function DateRow({ label, date, urgency, detail }: {
  label: string; date?: string; urgency?: boolean; detail?: string
}) {
  if (!date) return null
  const days = daysUntil(date)
  const past  = days !== null && days < 0

  return (
    <div className={cn(
      "flex items-start justify-between rounded-lg px-3 py-2.5",
      urgency && !past && days !== null && days <= 14 ? "bg-amber-50" : "bg-zinc-50"
    )}>
      <div>
        <p className="text-xs font-semibold text-zinc-600">{label}</p>
        {detail && <p className="text-xs text-zinc-400 mt-0.5">{detail}</p>}
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-zinc-800">{date}</p>
        {days !== null && (
          <p className={cn("text-xs", past ? "text-zinc-400" : days <= 14 ? "text-amber-600 font-medium" : "text-zinc-400")}>
            {past ? "ya pasó" : days === 0 ? "¡hoy!" : `en ${days}d`}
          </p>
        )}
      </div>
    </div>
  )
}

export function EventsCard({ eventos }: { eventos?: Eventos }) {
  if (!eventos) return null
  const hasAny = eventos.earnings_fecha || eventos.ex_dividendo || eventos.pago_dividendo
  if (!hasAny) return null

  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Calendar size={15} className="text-zinc-400" />
        <p className="text-sm font-semibold text-zinc-500">Eventos Próximos</p>
      </div>
      <div className="space-y-2">
        <DateRow
          label="Earnings"
          date={eventos.earnings_fecha}
          urgency
          detail={eventos.earnings_eps_est
            ? `EPS est: $${eventos.earnings_eps_est?.toFixed(2)} (rango $${eventos.earnings_eps_low?.toFixed(2)}–$${eventos.earnings_eps_high?.toFixed(2)})`
            : undefined}
        />
        <DateRow label="Ex-Dividendo" date={eventos.ex_dividendo} urgency />
        <DateRow label="Pago Dividendo" date={eventos.pago_dividendo} />
      </div>
    </div>
  )
}
