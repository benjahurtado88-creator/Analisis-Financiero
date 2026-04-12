import { cn } from "@/lib/utils"

interface Scenarios {
  bear?: number; bear_fuente?: string; bear_upside?: number
  base?: number; base_fuente?: string; base_upside?: number
  bull?: number; bull_fuente?: string; bull_upside?: number
}

interface DCF {
  metodo?: string; base?: number; bear?: number; bull?: number
  base_upside?: number; wacc?: number; div_g?: number
}

function fmt(n: number) {
  return n?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ScenarioCol({ label, price, upside, fuente, color }: {
  label: string; price?: number; upside?: number; fuente?: string; color: string
}) {
  if (!price) return null
  return (
    <div className={cn("flex-1 rounded-xl p-3 text-center", color)}>
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-zinc-800">${fmt(price)}</p>
      {upside !== undefined && (
        <p className={cn("text-xs font-medium mt-0.5", upside >= 0 ? "text-emerald-600" : "text-red-500")}>
          {upside >= 0 ? "+" : ""}{upside.toFixed(1)}%
        </p>
      )}
      {fuente && <p className="mt-1 text-xs text-zinc-400 leading-tight">{fuente}</p>}
    </div>
  )
}

export function ScenariosCard({ escenarios, dcf, precio_actual }: {
  escenarios?: Scenarios; dcf?: DCF; precio_actual: number
}) {
  if (!escenarios && !dcf) return null

  return (
    <div className="space-y-4">
      {/* Escenarios de precio */}
      {escenarios && (
        <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
          <p className="mb-1 text-sm font-semibold text-zinc-500">Escenarios de Precio a 12 meses</p>
          <p className="mb-4 text-xs text-zinc-400">Basado en consenso de analistas o técnico según disponibilidad.</p>
          <div className="flex gap-2">
            <ScenarioCol label="BEAR" price={escenarios.bear} upside={escenarios.bear_upside} fuente={escenarios.bear_fuente} color="bg-red-50" />
            <ScenarioCol label="BASE" price={escenarios.base} upside={escenarios.base_upside} fuente={escenarios.base_fuente} color="bg-zinc-50" />
            <ScenarioCol label="BULL" price={escenarios.bull} upside={escenarios.bull_upside} fuente={escenarios.bull_fuente} color="bg-emerald-50" />
          </div>
        </div>
      )}

      {/* DCF */}
      {dcf && dcf.base && (
        <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
          <p className="mb-1 text-sm font-semibold text-zinc-500">Valoración DCF — {dcf.metodo}</p>
          <p className="mb-3 text-xs text-zinc-400">
            Flujo de caja descontado con WACC {(dcf.wacc ?? 0 * 100).toFixed(1)}%.
            Es un modelo — úsalo como referencia, no como verdad absoluta.
          </p>
          <div className="flex gap-2">
            {dcf.bear && <ScenarioCol label="Pesimista" price={dcf.bear} upside={dcf.bear ? ((dcf.bear - precio_actual) / precio_actual * 100) : undefined} fuente="Tasas +1%" color="bg-red-50" />}
            <ScenarioCol label="Base DCF" price={dcf.base} upside={dcf.base_upside} fuente={dcf.div_g ? `Div. growth ${(dcf.div_g * 100).toFixed(1)}%` : undefined} color="bg-blue-50" />
            {dcf.bull && <ScenarioCol label="Optimista" price={dcf.bull} upside={dcf.bull ? ((dcf.bull - precio_actual) / precio_actual * 100) : undefined} fuente="Tasas -1%" color="bg-emerald-50" />}
          </div>
        </div>
      )}
    </div>
  )
}
