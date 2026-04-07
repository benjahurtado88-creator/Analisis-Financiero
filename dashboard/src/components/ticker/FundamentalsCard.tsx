import { cn } from "@/lib/utils"
import { FinancialTooltip } from "./Tooltip"
import { GLOSSARY } from "./Glossary"

interface Row {
  term: string
  value: string
  benchmark: string
  signal: "good" | "bad" | "neutral"
  trend?: string
}

function MetricRow({ term, value, benchmark, signal, trend }: Row) {
  const dot = signal === "good" ? "bg-emerald-400" : signal === "bad" ? "bg-red-400" : "bg-yellow-400"
  const g = GLOSSARY[term]
  return (
    <tr className="border-b border-zinc-50 last:border-0">
      <td className="py-2.5 pr-4 text-sm text-zinc-600">
        {g ? (
          <FinancialTooltip term={term} definition={g.definition} example={g.example}>
            {term}
          </FinancialTooltip>
        ) : term}
      </td>
      <td className="py-2.5 pr-4 text-right text-sm font-semibold text-zinc-800">{value}</td>
      <td className="py-2.5 pr-4 text-right text-xs text-zinc-400">{benchmark}</td>
      <td className="py-2.5 text-right">
        <span className={cn("inline-block h-2.5 w-2.5 rounded-full", dot)} title={signal} />
      </td>
      {trend && <td className="py-2.5 pl-3 text-xs text-zinc-400">{trend}</td>}
    </tr>
  )
}

export function FundamentalsCard({ fundamentales, info }: {
  fundamentales: Record<string, number>
  info: { ev_ebitda?: number; revenue_growth?: number; earnings_growth?: number }
}) {
  const f = fundamentales

  const signal = (val: number, good: number, bad: number, lowerIsBetter = false): "good" | "bad" | "neutral" => {
    if (lowerIsBetter) return val <= good ? "good" : val >= bad ? "bad" : "neutral"
    return val >= good ? "good" : val <= bad ? "bad" : "neutral"
  }

  const pct = (v: number) => `${(v * 100).toFixed(1)}%`
  const x = (v: number) => `${v?.toFixed(1)}x`

  return (
    <div className="space-y-4">
      {/* Valoración */}
      <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-zinc-500">Valoración — ¿Está cara o barata?</p>
        <p className="mb-3 text-xs text-zinc-400">El punto verde significa que el indicador está en zona favorable. Rojo = zona de precaución.</p>
        <table className="w-full">
          <tbody>
            <MetricRow term="P/E Ratio" value={x(f.pe)} benchmark="~20-25x ideal" signal={signal(f.pe, 0, 30, true)} />
            <MetricRow term="P/B Ratio" value={x(f.pb)} benchmark="~3x ideal" signal={signal(f.pb, 0, 10, true)} />
            <MetricRow term="P/FCF" value={x(f.pfcf)} benchmark="~20x ideal" signal={signal(f.pfcf, 0, 40, true)} />
            <MetricRow term="EV/EBITDA" value={x(info.ev_ebitda ?? 0)} benchmark="~15x ideal" signal={signal(info.ev_ebitda ?? 0, 0, 25, true)} />
            <MetricRow term="FCF Yield" value={pct(f.fcf_yield)} benchmark=">4% ideal" signal={signal(f.fcf_yield, 0.04, 0.01)} />
          </tbody>
        </table>
      </div>

      {/* Calidad */}
      <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-zinc-500">Calidad del Negocio</p>
        <table className="w-full">
          <tbody>
            <MetricRow term="Margen Bruto" value={pct(f.gross)} benchmark=">40% bueno" signal={signal(f.gross, 0.40, 0.15)} />
            <MetricRow term="Margen Neto" value={pct(f.margin)} benchmark=">15% bueno" signal={signal(f.margin, 0.15, 0.05)} />
            <MetricRow term="ROE" value={pct(f.roe)} benchmark=">15% bueno" signal={signal(f.roe, 0.15, 0.05)} />
            <MetricRow term="EPS" value={`$${f.eps?.toFixed(2)}`} benchmark=">$0" signal={f.eps > 0 ? "good" : "bad"} />
          </tbody>
        </table>
        {info.revenue_growth !== undefined && (
          <div className="mt-3 flex gap-4 border-t border-zinc-100 pt-3">
            <div>
              <p className="text-xs text-zinc-400">Crecimiento ingresos</p>
              <p className={cn("text-sm font-semibold", (info.revenue_growth ?? 0) > 0 ? "text-emerald-600" : "text-red-500")}>
                {info.revenue_growth !== undefined ? `${(info.revenue_growth * 100).toFixed(1)}% YoY` : "N/D"}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Crecimiento ganancias</p>
              <p className={cn("text-sm font-semibold", (info.earnings_growth ?? 0) > 0 ? "text-emerald-600" : "text-red-500")}>
                {info.earnings_growth !== undefined ? `${(info.earnings_growth * 100).toFixed(1)}% YoY` : "N/D"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Solidez */}
      <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-zinc-500">Solidez Financiera — ¿Puede pagar sus deudas?</p>
        <table className="w-full">
          <tbody>
            <MetricRow term="Deuda/Equity" value={x(f.de)} benchmark="<1x ideal" signal={signal(f.de, 0, 2, true)} />
            <MetricRow term="Cobertura de Intereses" value={x(f.int_cov)} benchmark=">5x seguro" signal={signal(f.int_cov, 5, 2)} />
          </tbody>
        </table>
      </div>
    </div>
  )
}
