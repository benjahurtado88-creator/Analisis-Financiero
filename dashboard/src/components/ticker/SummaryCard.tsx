"use client"

import { useEffect, useState } from "react"
import { Loader2, TrendingUp, TrendingDown, Minus, ShieldAlert, CheckCircle, Bot } from "lucide-react"

interface AgentAnalysis {
  agent_type: string
  veredicto_agente: string
  bucket: string
  confianza: number
  resumen_simple: string
  tesis: string
  puntos_clave: string[]
  riesgos_principales: string[]
  accion_recomendada: string
}

const AGENT_LABELS: Record<string, string> = {
  crypto:    "Agente Crypto",
  stocks:    "Agente Acciones",
  startups:  "Agente Growth / Startups",
  materials: "Agente Materias Primas",
  currencies:"Agente Divisas",
}

const VEREDICTO_STYLE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  "COMPRA FUERTE": { bg: "bg-emerald-100", text: "text-emerald-800", icon: <TrendingUp size={14} /> },
  "COMPRA":        { bg: "bg-green-100",   text: "text-green-800",   icon: <TrendingUp size={14} /> },
  "MANTENER":      { bg: "bg-amber-100",   text: "text-amber-800",   icon: <Minus size={14} /> },
  "VENDER":        { bg: "bg-red-100",     text: "text-red-800",     icon: <TrendingDown size={14} /> },
  "EVITAR":        { bg: "bg-red-200",     text: "text-red-900",     icon: <TrendingDown size={14} /> },
}

export function SummaryCard({ ticker }: { ticker: string }) {
  const [analysis, setAnalysis] = useState<AgentAnalysis | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    setAnalysis(null)
    fetch("/api/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: ticker }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.veredicto_agente) setAnalysis(d as AgentAnalysis)
        else setError(true)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [ticker])

  const agentLabel = analysis ? (AGENT_LABELS[analysis.agent_type] ?? "Agente Especializado") : "Agente Especializado"
  const vStyle = analysis ? (VEREDICTO_STYLE[analysis.veredicto_agente] ?? VEREDICTO_STYLE["MANTENER"]) : null

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3 border-b border-indigo-100">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100">
          <Bot size={14} className="text-indigo-600" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-indigo-800">{agentLabel}</h2>
          <p className="text-xs text-indigo-400">Análisis especializado con datos Python + IA</p>
        </div>
        {analysis && (
          <div className="flex items-center gap-1.5">
            <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${vStyle?.bg} ${vStyle?.text}`}>
              {vStyle?.icon}
              {analysis.veredicto_agente}
            </span>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {analysis.confianza}/10
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-zinc-400 py-2">
            <Loader2 size={14} className="animate-spin text-indigo-400" />
            <span>Agente analizando {ticker}...</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <p className="text-sm text-zinc-400 italic py-2">
            No se pudo obtener el análisis del agente. El detalle técnico está disponible abajo.
          </p>
        )}

        {/* Analysis */}
        {!loading && !error && analysis && (
          <>
            {/* Bucket tag */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-700">{analysis.bucket}</span>
            </div>

            {/* Resumen simple */}
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Para entender fácil</p>
              <p className="text-sm leading-relaxed text-zinc-700">{analysis.resumen_simple}</p>
            </div>

            {/* Tesis */}
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Tesis de inversión</p>
              <p className="text-sm leading-relaxed text-zinc-600 italic">{analysis.tesis}</p>
            </div>

            {/* Puntos clave + Riesgos */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Puntos clave</p>
                <ul className="space-y-1.5">
                  {(analysis.puntos_clave ?? []).map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-zinc-700">
                      <CheckCircle size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Riesgos a monitorear</p>
                <ul className="space-y-1.5">
                  {(analysis.riesgos_principales ?? []).map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-zinc-600">
                      <ShieldAlert size={12} className="text-amber-500 mt-0.5 shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Acción recomendada */}
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">
              <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">¿Qué hacer?</p>
              <p className="text-sm font-medium text-indigo-900">{analysis.accion_recomendada}</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
