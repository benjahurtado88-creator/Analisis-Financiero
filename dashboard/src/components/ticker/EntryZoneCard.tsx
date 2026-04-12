import { cn } from "@/lib/utils"
import { FinancialTooltip } from "./Tooltip"
import { GLOSSARY } from "./Glossary"

interface EntryZoneProps {
  precio_actual: number
  fair_value: {
    fair_value_pe?: number
    graham?: number
    fair_ev?: number
    nota?: string
  }
  soporte: number
}

function fmt(n: number) {
  return n?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function EntryZoneCard({ precio_actual, fair_value, soporte }: EntryZoneProps) {
  const fv = fair_value.fair_value_pe ?? 0
  const zona_min = fv > 0 ? Math.min(soporte, fv * 0.95) : soporte * 0.97
  const zona_max = soporte * 1.03
  const descuento = fv > 0 ? (((fv - precio_actual) / precio_actual) * 100) : null
  const enZona = precio_actual >= zona_min && precio_actual <= zona_max

  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
      <p className="mb-1 text-sm font-semibold text-zinc-500">Zona de Entrada Recomendada</p>
      <p className="mb-4 text-xs text-zinc-400">Rango de precio donde los números dicen que es un buen momento para comprar.</p>

      {/* Zona visual */}
      <div className={cn(
        "mb-4 rounded-xl border-2 p-4 text-center",
        enZona ? "border-emerald-300 bg-emerald-50" : "border-zinc-200 bg-zinc-50"
      )}>
        <p className="text-xs text-zinc-500">Entrada ideal</p>
        <p className="text-3xl font-bold text-zinc-800">${fmt(zona_min)} — ${fmt(zona_max)}</p>
        {enZona
          ? <p className="mt-1 text-xs font-medium text-emerald-600">✓ El precio actual está en zona de compra</p>
          : <p className="mt-1 text-xs text-zinc-400">El precio actual (${fmt(precio_actual)}) está fuera de la zona ideal. Esperar pullback.</p>
        }
      </div>

      <div className="space-y-3">
        {fv > 0 && (
          <div className="flex items-center justify-between">
            <FinancialTooltip term="Fair Value" definition={GLOSSARY["Fair Value"].definition} example={GLOSSARY["Fair Value"].example}>
              <span className="text-sm text-zinc-600">Fair Value P/E</span>
            </FinancialTooltip>
            <div className="text-right">
              <span className="text-sm font-semibold text-zinc-800">${fmt(fv)}</span>
              {descuento !== null && (
                <span className={cn("ml-2 text-xs", descuento < 0 ? "text-red-400" : "text-emerald-500")}>
                  {descuento > 0 ? `+${descuento.toFixed(1)}%` : `${descuento.toFixed(1)}%`} vs precio actual
                </span>
              )}
            </div>
          </div>
        )}

        {(fair_value.graham ?? 0) > 0 && (
          <div className="flex items-center justify-between">
            <FinancialTooltip term="Graham Number" definition={GLOSSARY["Graham Number"].definition} example={GLOSSARY["Graham Number"].example}>
              <span className="text-sm text-zinc-600">Graham Number</span>
            </FinancialTooltip>
            <span className="text-sm font-semibold text-zinc-800">${fmt(fair_value.graham ?? 0)}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <FinancialTooltip term="Soporte" definition={GLOSSARY["Soporte"].definition} example={GLOSSARY["Soporte"].example}>
            <span className="text-sm text-zinc-600">Soporte técnico</span>
          </FinancialTooltip>
          <span className="text-sm font-semibold text-emerald-600">${fmt(soporte)}</span>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
        <strong>Estrategia sugerida:</strong> No entrar todo de una. Dividir en 2-3 compras escalonadas en la zona ${fmt(zona_min)}–${fmt(zona_max)} reduce el riesgo de timing.
      </div>
    </div>
  )
}
