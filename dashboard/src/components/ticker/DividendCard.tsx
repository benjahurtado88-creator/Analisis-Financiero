import { cn } from "@/lib/utils"
import { FinancialTooltip } from "./Tooltip"
import { GLOSSARY } from "./Glossary"

export function DividendCard({ fundamentales, esCripto }: {
  fundamentales: Record<string, number>
  esCripto: boolean
}) {
  if (esCripto) {
    return (
      <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-zinc-500">Dividendos</p>
        <p className="mt-2 text-sm text-zinc-400">Las criptomonedas no pagan dividendos. El retorno viene únicamente de la apreciación del precio.</p>
      </div>
    )
  }

  const f = fundamentales
  const yield_pct = (f.yield * 100).toFixed(2)
  const payout_pct = (f.payout * 100).toFixed(1)
  const sostenible = f.payout < 0.70 && f.fcf_yield > 0.04 ? "SÓLIDO" : f.payout > 0.80 ? "RIESGO" : "MODERADO"
  const sostenibleColor = sostenible === "SÓLIDO" ? "text-emerald-600 bg-emerald-50" : sostenible === "RIESGO" ? "text-red-600 bg-red-50" : "text-yellow-600 bg-yellow-50"

  // Estimación años para doblar yield (regla del 72 aproximada con crecimiento del 5% anual del dividendo)
  const yearsToDouble = Math.round(72 / 5)

  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
      <p className="mb-4 text-sm font-semibold text-zinc-500">Dividendos — Tu flujo de ingresos pasivos</p>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-zinc-50 p-3 text-center">
          <FinancialTooltip term="Dividend Yield" definition={GLOSSARY["Dividend Yield"].definition} example={GLOSSARY["Dividend Yield"].example}>
            <p className="text-xs text-zinc-400">Yield anual</p>
          </FinancialTooltip>
          <p className="mt-1 text-2xl font-bold text-zinc-800">{yield_pct}%</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3 text-center">
          <FinancialTooltip term="Payout Ratio" definition={GLOSSARY["Payout Ratio"].definition} example={GLOSSARY["Payout Ratio"].example}>
            <p className="text-xs text-zinc-400">Payout Ratio</p>
          </FinancialTooltip>
          <p className="mt-1 text-2xl font-bold text-zinc-800">{payout_pct}%</p>
        </div>
        <div className={cn("rounded-lg p-3 text-center", sostenibleColor.split(" ")[1])}>
          <p className="text-xs text-zinc-500">Sostenibilidad</p>
          <p className={cn("mt-1 text-sm font-bold", sostenibleColor.split(" ")[0])}>{sostenible}</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-blue-50 p-3">
        <p className="text-xs font-medium text-blue-700">Para tu objetivo de vivir de dividendos</p>
        <p className="mt-1 text-xs text-blue-600">
          Con un yield del {yield_pct}% y reinvirtiendo dividendos, podrías doblar el ingreso en ~{yearsToDouble} años asumiendo crecimiento histórico del dividendo del 5% anual.
        </p>
      </div>

      {sostenible === "RIESGO" && (
        <div className="mt-3 rounded-lg bg-red-50 p-3">
          <p className="text-xs font-medium text-red-700">⚠️ Advertencia</p>
          <p className="mt-1 text-xs text-red-600">El payout ratio supera el 80%. La empresa está repartiendo casi todas sus ganancias — si los ingresos caen, el dividendo podría reducirse.</p>
        </div>
      )}
    </div>
  )
}
