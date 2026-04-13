"use client"

import { useEffect, useState } from "react"
import { BookOpen, Loader2 } from "lucide-react"

interface SummaryCardProps {
  ticker: string
}

export function SummaryCard({ ticker }: SummaryCardProps) {
  const [summary, setSummary] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    fetch("/api/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: ticker }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.summary) setSummary(d.summary)
        else setError(true)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [ticker])

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100">
          <BookOpen size={14} className="text-indigo-600" />
        </div>
        <h2 className="text-sm font-semibold text-indigo-800 uppercase tracking-wide">
          Resumen para todos
        </h2>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-400 py-2">
          <Loader2 size={14} className="animate-spin" />
          <span>Generando resumen en lenguaje simple...</span>
        </div>
      )}

      {!loading && error && (
        <p className="text-sm text-zinc-400 italic">
          No se pudo generar el resumen. El análisis detallado está disponible abajo.
        </p>
      )}

      {!loading && !error && summary && (
        <p className="text-sm leading-relaxed text-zinc-700">{summary}</p>
      )}
    </div>
  )
}
