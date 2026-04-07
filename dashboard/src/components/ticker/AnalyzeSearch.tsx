"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

const SUGGESTIONS = ["AAPL", "MSFT", "KO", "BTC", "ETH", "NVDA", "AMZN", "GOOGL", "PEP", "JNJ"]

export function AnalyzeSearch() {
  const [ticker, setTicker]   = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")
  const [focused, setFocused] = useState(false)
  const router  = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleAnalyze(symbol?: string) {
    const target = (symbol ?? ticker).toUpperCase().trim()
    if (!target) return
    setLoading(true)
    setError("")

    try {
      const res  = await fetch("/api/analyze", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ticker: target }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Error desconocido")
        setLoading(false)
        return
      }

      router.push(`/ticker/${data.ticker}`)
    } catch {
      setError("No se pudo conectar con el servidor")
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      {/* Search box */}
      <div className={cn(
        "flex items-center gap-2 rounded-2xl border-2 bg-white px-4 py-3 shadow-sm transition-all",
        focused ? "border-zinc-400 shadow-md" : "border-zinc-200"
      )}>
        <TrendingUp size={18} className="flex-shrink-0 text-zinc-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Escribe un ticker... (ej: AAPL, BTC, KO)"
          value={ticker}
          onChange={e => { setTicker(e.target.value.toUpperCase()); setError("") }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={e => e.key === "Enter" && handleAnalyze()}
          disabled={loading}
          className="flex-1 bg-transparent text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none"
        />
        <button
          onClick={() => handleAnalyze()}
          disabled={loading || !ticker.trim()}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-sm font-semibold transition-all",
            loading || !ticker.trim()
              ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
              : "bg-zinc-900 text-white hover:bg-zinc-700"
          )}
        >
          <Loader2 size={14} className={loading ? "animate-spin" : "hidden"} />
          <Search size={14} className={loading ? "hidden" : ""} />
          <span>{loading ? "Analizando..." : "Analizar"}</span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <span className="text-red-500 text-lg leading-none">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-red-700">Error al analizar</p>
              <p className="mt-1 text-xs text-red-600 whitespace-pre-wrap font-mono">{error}</p>
              <p className="mt-2 text-xs text-red-400">Verifica que el ticker existe (ej: AAPL, BTC, KO) y que el servidor Python está disponible.</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      <div className={loading ? "mt-3 rounded-xl border border-zinc-100 bg-white p-4" : "hidden"}>
        <div className="flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-zinc-400" />
          <div>
            <p className="text-sm font-medium text-zinc-700">Analizando {ticker}...</p>
            <p className="text-xs text-zinc-400">Obteniendo precios, fundamentales y noticias. Puede tomar 20–40 segundos.</p>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          {["Precios y técnico (yfinance)", "Fundamentales (FinanceToolkit)", "Noticias recientes"].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <Loader2 size={11} className="animate-spin text-zinc-300" />
              <span className="text-xs text-zinc-400">{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Suggestions */}
      <div className={loading ? "hidden" : "mt-3 flex flex-wrap gap-2"}>
        <span className="text-xs text-zinc-400">Sugerencias:</span>
        {SUGGESTIONS.map(s => (
          <button
            key={s}
            onClick={() => { setTicker(s); handleAnalyze(s) }}
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-800 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
