"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useLanguage } from "@/hooks/use-language"
import type { ReportData } from "@/types/report"
import Link from "next/link"
import { Search, RefreshCw, Sparkles, X, CheckCircle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const profileStyles: Record<string, string> = {
  conservative: "bg-blue-50 text-blue-700 border-blue-200",
  moderate: "bg-amber-50 text-amber-700 border-amber-200",
  aggressive: "bg-red-50 text-red-700 border-red-200",
}

const STEPS: Record<string, string> = {
  prices: "Actualizando precios con yfinance...",
  deep:   "Análisis profundo (Python + FinanceToolkit)...",
  reading:"Preparando datos...",
  gemini: "Generando análisis con Gemini Flash...",
  saving: "Guardando reporte...",
  done:   "¡Listo! Recargando...",
  error:  "Error",
}

type GenStatus = { step: string; msg: string } | null

export function ReportHeader({ data }: { data: ReportData }) {
  const { t } = useLanguage()
  const date = new Date(data.generated_at).toLocaleDateString("es-CL", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  })

  const [refreshing, setRefreshing] = useState(false)
  const [genStatus, setGenStatus] = useState<GenStatus>(null)
  const [genDone, setGenDone] = useState(false)
  const [riskProfile, setRiskProfile] = useState<string>("moderate")
  const [showRiskModal, setShowRiskModal] = useState(false)
  const [sectors, setSectors] = useState<string[]>(["crypto", "stocks", "startups", "currencies", "materials"])

  const SECTOR_OPTIONS = [
    { key: "crypto",     label: "Crypto",          desc: "BTC, ETH, altcoins con momentum" },
    { key: "stocks",     label: "Acciones",         desc: "Grandes caps con catalizadores" },
    { key: "startups",   label: "Growth / Startups", desc: "Potencial x5-10, disruptivas" },
    { key: "currencies", label: "Divisas",           desc: "Forex, bancos centrales, macro" },
    { key: "materials",  label: "Materias primas",   desc: "Gold, Oil, commodities" },
  ]

  function toggleSector(key: string) {
    setSectors(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    )
  }

  // ── Actualizar precios (rápido, gratis) ──────────────────────────────
  async function handleRefresh() {
    setRefreshing(true)
    try {
      const res = await fetch("/api/refresh-report", { method: "POST" })
      if (res.ok) window.location.reload()
    } finally {
      setRefreshing(false)
    }
  }

  // ── Generar reporte completo con Gemini (SSE) ─────────────────────────
  async function handleGenerate() {
    setShowRiskModal(false)
    setGenDone(false)
    setGenStatus({ step: "start", msg: "Iniciando..." })

    const res = await fetch("/api/generate-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ risk_profile: riskProfile, sectors }),
    })

    if (!res.body) return
    const reader = res.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value)
      const lines = text.split("\n").filter(l => l.startsWith("data: "))
      for (const line of lines) {
        const payload = JSON.parse(line.replace("data: ", ""))
        setGenStatus(payload)
        if (payload.step === "done") {
          setGenDone(true)
          setTimeout(() => window.location.reload(), 1500)
        }
      }
    }
  }

  const genRunning = genStatus !== null && !genDone && genStatus.step !== "error"
  const genError   = genStatus?.step === "error"

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="border-b border-[#E6E6E4] pb-6 pt-8"
      >
        {/* Barra superior de botones */}
        <div className="mb-4 flex items-center justify-end gap-2 flex-wrap">
          {/* Actualizar precios */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Actualizando..." : "Actualizar precios"}
          </button>

          {/* Generar nuevo análisis */}
          <button
            onClick={() => setShowRiskModal(true)}
            disabled={genRunning}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            <Sparkles size={13} />
            {genRunning ? "Generando..." : "Nuevo análisis Gemini"}
          </button>

          {/* Analizar empresa */}
          <Link
            href="/analyze"
            className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
          >
            <Search size={13} />
            Analizar empresa / cripto
          </Link>
        </div>

        {/* Barra de progreso de generación */}
        {genStatus && (
          <div className={cn(
            "mb-4 rounded-xl border px-4 py-3 text-sm flex items-center gap-3",
            genError ? "border-red-200 bg-red-50 text-red-700"
              : genDone ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-violet-200 bg-violet-50 text-violet-700"
          )}>
            {genDone
              ? <CheckCircle size={15} className="flex-shrink-0" />
              : genError
              ? <AlertCircle size={15} className="flex-shrink-0" />
              : <Sparkles size={15} className="flex-shrink-0 animate-pulse" />
            }
            <span className="flex-1">
              {STEPS[genStatus.step] ?? genStatus.msg}
            </span>
            {genError && (
              <button onClick={() => setGenStatus(null)} className="ml-auto">
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {/* Título y fecha */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-[#252420] sm:text-5xl">
              Financial Intelligence.
            </h1>
            <p className="mt-1 text-sm text-[#8B8B85]">
              Personal analysis for <strong className="text-[#37352F]">Benjamin Hurtado</strong> · {data.risk_profile} risk profile
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm text-[#8B8B85]">
              <strong className="block text-base font-semibold text-[#37352F]">{date}</strong>
              {t("header.report")}
            </p>
            <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${profileStyles[data.risk_profile]}`}>
              {data.risk_profile} {t("header.profile")}
            </span>
          </div>
        </div>
      </motion.header>

      {/* Modal — perfil de riesgo + sectores */}
      {showRiskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-800">Buscar oportunidades</h2>
              <button onClick={() => setShowRiskModal(false)}>
                <X size={16} className="text-zinc-400" />
              </button>
            </div>

            {/* Perfil de riesgo */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Perfil de riesgo</p>
            <div className="space-y-2 mb-5">
              {[
                { key: "conservative", label: "Conservador", desc: "Capital preservation, blue chips, dividendos" },
                { key: "moderate",     label: "Moderado",    desc: "Crecimiento balanceado, diversificado (recomendado)" },
                { key: "aggressive",   label: "Agresivo",    desc: "Máximo crecimiento, crypto, growth stocks" },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setRiskProfile(opt.key)}
                  className={cn(
                    "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                    riskProfile === opt.key
                      ? "border-violet-400 bg-violet-50"
                      : "border-zinc-200 hover:bg-zinc-50"
                  )}
                >
                  <p className="text-sm font-semibold text-zinc-700">{opt.label}</p>
                  <p className="text-xs text-zinc-400">{opt.desc}</p>
                </button>
              ))}
            </div>

            {/* Sectores a analizar */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">¿Dónde buscar? (3-4 por sector)</p>
            <div className="space-y-1.5 mb-5">
              {SECTOR_OPTIONS.map(opt => {
                const active = sectors.includes(opt.key)
                return (
                  <button
                    key={opt.key}
                    onClick={() => toggleSector(opt.key)}
                    className={cn(
                      "w-full rounded-xl border px-4 py-2.5 text-left transition-colors flex items-center gap-3",
                      active
                        ? "border-violet-400 bg-violet-50"
                        : "border-zinc-200 hover:bg-zinc-50"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center",
                      active ? "border-violet-500 bg-violet-500" : "border-zinc-300"
                    )}>
                      {active && <CheckCircle size={10} className="text-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-700">{opt.label}</p>
                      <p className="text-xs text-zinc-400">{opt.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            <button
              onClick={handleGenerate}
              disabled={sectors.length === 0}
              className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-40"
            >
              Buscar oportunidades (~3 min)
            </button>
          </div>
        </div>
      )}
    </>
  )
}
