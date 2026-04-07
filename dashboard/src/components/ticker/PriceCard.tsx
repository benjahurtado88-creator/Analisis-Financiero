import { cn } from "@/lib/utils"
import { FinancialTooltip } from "./Tooltip"
import { GLOSSARY } from "./Glossary"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

function Change({ value, label }: { value: number; label: string }) {
  const up = value > 0
  const flat = value === 0
  return (
    <div className="flex flex-col items-center">
      <span className={cn("flex items-center gap-0.5 text-sm font-semibold",
        up ? "text-emerald-600" : flat ? "text-zinc-400" : "text-red-500"
      )}>
        <TrendingUp size={14} className={up ? "" : "hidden"} />
        <Minus size={14} className={flat ? "" : "hidden"} />
        <TrendingDown size={14} className={!up && !flat ? "" : "hidden"} />
        {up ? "+" : ""}{value.toFixed(2)}%
      </span>
      <span className="text-xs text-zinc-400">{label}</span>
    </div>
  )
}

interface PriceCardProps {
  ticker: string
  precio: {
    precio_actual: number
    cambio_24h: number
    cambio_7d: number
    cambio_30d: number
    cambio_ytd?: number
    high_52w: number
    low_52w: number
    vol_hoy?: number
    vol_20d_avg?: number
    vol_relativo?: number
    sma_20: number
    sma_50: number
    sma_200: number
    soporte: number
    resistencia: number
    tendencia_sma: string
    rsi: number
    macd_bullish?: boolean
  }
  info: {
    sector?: string
    market_cap?: number
    analyst_target?: number
    analyst_rec?: string
    analyst_count?: number
    analyst_low?: number
    analyst_high?: number
    beta?: number
  }
}

function fmt(n: number, decimals = 2) {
  return n?.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtB(n: number) {
  if (!n) return "N/D"
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  return `$${(n / 1e6).toFixed(0)}M`
}

export function PriceCard({ ticker, precio, info }: PriceCardProps) {
  const rsiColor = precio.rsi < 30 ? "text-emerald-600" : precio.rsi > 70 ? "text-red-500" : "text-zinc-700"
  const rsiLabel = precio.rsi < 30 ? "Sobrevendida — posible oportunidad" : precio.rsi > 70 ? "Sobrecomprada — precaución" : "Zona neutral"
  const tendenciaColor = precio.tendencia_sma === "ALCISTA" ? "text-emerald-600" : precio.tendencia_sma === "BAJISTA" ? "text-red-500" : "text-yellow-600"

  return (
    <div className="space-y-4">
      {/* Header precio */}
      <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-zinc-400">{info.sector ?? ""} · {fmtB(info.market_cap ?? 0)}</p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-zinc-900">${fmt(precio.precio_actual)}</p>
          </div>
          <div className="rounded-lg bg-zinc-50 px-3 py-2 text-right">
            <p className="text-xs text-zinc-400">
              <FinancialTooltip term="Beta" definition={GLOSSARY["Beta"].definition} example={GLOSSARY["Beta"].example}>
                Beta
              </FinancialTooltip>
            </p>
            <p className="text-lg font-semibold text-zinc-700">{info.beta?.toFixed(2) ?? "N/D"}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-around border-t border-zinc-100 pt-4">
          <Change value={precio.cambio_24h} label="24h" />
          <Change value={precio.cambio_7d} label="7 días" />
          <Change value={precio.cambio_30d} label="30 días" />
          {precio.cambio_ytd !== undefined && <Change value={precio.cambio_ytd} label="YTD" />}
        </div>
      </div>

      {/* 52 semanas */}
      <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-zinc-500">Rango 52 semanas</p>
        <div className="relative h-3 rounded-full bg-zinc-100">
          {(() => {
            const pct = ((precio.precio_actual - precio.low_52w) / (precio.high_52w - precio.low_52w)) * 100
            return (
              <>
                <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-300 via-yellow-300 to-emerald-400" style={{ width: "100%" }} />
                <div className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-zinc-800 shadow" style={{ left: `${Math.min(Math.max(pct, 0), 100)}%` }} />
              </>
            )
          })()}
        </div>
        <div className="mt-2 flex justify-between text-xs text-zinc-400">
          <span>Mín ${fmt(precio.low_52w)}</span>
          <span className="font-medium text-zinc-700">Actual ${fmt(precio.precio_actual)}</span>
          <span>Máx ${fmt(precio.high_52w)}</span>
        </div>
      </div>

      {/* Técnico */}
      <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-zinc-500">Análisis Técnico</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <FinancialTooltip term="RSI" definition={GLOSSARY["RSI"].definition} example={GLOSSARY["RSI"].example}>
              <span className="text-sm text-zinc-600">RSI (14d)</span>
            </FinancialTooltip>
            <span className={cn("text-sm font-semibold", rsiColor)}>{precio.rsi.toFixed(1)} — {rsiLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <FinancialTooltip term="MACD" definition={GLOSSARY["MACD"].definition} example={GLOSSARY["MACD"].example}>
              <span className="text-sm text-zinc-600">MACD</span>
            </FinancialTooltip>
            <span className={cn("text-sm font-semibold", precio.macd_bullish ? "text-emerald-600" : "text-red-500")}>
              {precio.macd_bullish ? "Alcista" : "Bajista"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <FinancialTooltip term="SMA" definition={GLOSSARY["SMA"].definition} example={GLOSSARY["SMA"].example}>
              <span className="text-sm text-zinc-600">Tendencia SMA</span>
            </FinancialTooltip>
            <span className={cn("text-sm font-semibold", tendenciaColor)}>{precio.tendencia_sma}</span>
          </div>

          <div className="border-t border-zinc-100 pt-3">
            {[
              { label: "SMA 20", val: precio.sma_20 },
              { label: "SMA 50", val: precio.sma_50 },
              { label: "SMA 200", val: precio.sma_200 },
            ].map(({ label, val }) => (
              <div key={label} className="mb-1 flex items-center justify-between">
                <span className="text-xs text-zinc-400">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-600">${fmt(val)}</span>
                  <span className={cn("text-xs", precio.precio_actual >= val ? "text-emerald-500" : "text-red-400")}>
                    {precio.precio_actual >= val ? "↑ arriba" : "↓ abajo"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between border-t border-zinc-100 pt-3">
            <div>
              <FinancialTooltip term="Soporte" definition={GLOSSARY["Soporte"].definition} example={GLOSSARY["Soporte"].example}>
                <span className="text-xs text-zinc-400">Soporte</span>
              </FinancialTooltip>
              <p className="text-sm font-semibold text-emerald-600">${fmt(precio.soporte)}</p>
            </div>
            <div className="text-right">
              <FinancialTooltip term="Resistencia" definition={GLOSSARY["Resistencia"].definition} example={GLOSSARY["Resistencia"].example}>
                <span className="text-xs text-zinc-400">Resistencia</span>
              </FinancialTooltip>
              <p className="text-sm font-semibold text-red-400">${fmt(precio.resistencia)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Consenso analistas */}
      <div className={info.analyst_target ? "rounded-xl border border-zinc-100 bg-white p-5 shadow-sm" : "hidden"}>
          <p className="mb-3 text-sm font-semibold text-zinc-500">Consenso de Analistas ({info.analyst_count} analistas)</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-zinc-800">${fmt(info.analyst_target ?? 0)}</p>
              <p className="text-xs text-zinc-400">precio objetivo</p>
            </div>
            <div className={cn("rounded-lg px-4 py-2 text-sm font-bold",
              info.analyst_rec === "BUY" ? "bg-emerald-50 text-emerald-700" :
              info.analyst_rec === "SELL" ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"
            )}>
              {info.analyst_rec}
            </div>
          </div>
          <div className="mt-2 text-xs text-zinc-400">
            Rango: ${fmt(info.analyst_low ?? 0)} — ${fmt(info.analyst_high ?? 0)}
          </div>
          <div className="mt-2 text-xs font-medium text-emerald-600">
            +{((((info.analyst_target ?? 0) - precio.precio_actual) / precio.precio_actual) * 100).toFixed(1)}% upside desde precio actual
          </div>
        </div>
    </div>
  )
}
