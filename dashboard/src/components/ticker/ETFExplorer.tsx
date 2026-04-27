"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles, RefreshCw, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { AiEtf } from "@/app/api/best-etfs-20y/route"

// ──────────────────────────────────────────────
// DATA ESTÁTICA (categorías)
// ──────────────────────────────────────────────

export type CategoryETF = { ticker: string; name: string }

export type Category = {
  id: string
  label: string
  emoji: string
  etfs: CategoryETF[]
}

export const CATEGORIES: Category[] = [
  {
    id: "sp500", label: "S&P 500 / Mercado total", emoji: "🏦",
    etfs: [
      { ticker: "VOO",  name: "Vanguard S&P 500" },
      { ticker: "SPY",  name: "SPDR S&P 500" },
      { ticker: "VTI",  name: "Vanguard Total Market" },
      { ticker: "IVV",  name: "iShares Core S&P 500" },
    ],
  },
  {
    id: "tech", label: "Tecnología", emoji: "💻",
    etfs: [
      { ticker: "QQQ",  name: "Invesco Nasdaq-100" },
      { ticker: "VGT",  name: "Vanguard Info Tech" },
      { ticker: "SOXX", name: "iShares Semiconductors" },
      { ticker: "IGV",  name: "iShares Expanded Tech-SW" },
      { ticker: "ARKK", name: "ARK Innovation" },
    ],
  },
  {
    id: "dividendos", label: "Dividendos", emoji: "💰",
    etfs: [
      { ticker: "SCHD", name: "Schwab US Dividend Equity" },
      { ticker: "VYM",  name: "Vanguard High Dividend" },
      { ticker: "DVY",  name: "iShares Select Dividend" },
      { ticker: "HDV",  name: "iShares Core High Dividend" },
    ],
  },
  {
    id: "global", label: "Mercado global", emoji: "🌍",
    etfs: [
      { ticker: "VT",   name: "Vanguard Total World" },
      { ticker: "VEA",  name: "Vanguard Dev Markets ex-US" },
      { ticker: "EEM",  name: "iShares MSCI Emerging Mkt" },
    ],
  },
  {
    id: "salud", label: "Salud", emoji: "🏥",
    etfs: [
      { ticker: "XLV",  name: "Health Care Select SPDR" },
      { ticker: "VHT",  name: "Vanguard Health Care" },
      { ticker: "IBB",  name: "iShares Biotechnology" },
    ],
  },
  {
    id: "energia", label: "Energía", emoji: "⚡",
    etfs: [
      { ticker: "XLE",  name: "Energy Select SPDR" },
      { ticker: "ICLN", name: "iShares Clean Energy" },
      { ticker: "GLD",  name: "SPDR Gold Shares" },
    ],
  },
  {
    id: "bonos", label: "Bonos / Renta fija", emoji: "🔒",
    etfs: [
      { ticker: "BND",  name: "Vanguard Total Bond Market" },
      { ticker: "AGG",  name: "iShares Core US Aggregate" },
      { ticker: "TLT",  name: "iShares 20+ Year Treasury" },
      { ticker: "SGOV", name: "iShares 0-3 Month Treasury" },
    ],
  },
  {
    id: "inmobiliario", label: "Inmobiliario (REITs)", emoji: "🏢",
    etfs: [
      { ticker: "VNQ",  name: "Vanguard Real Estate" },
      { ticker: "XLRE", name: "Real Estate Select SPDR" },
    ],
  },
]

const TAG_STYLES: Record<string, string> = {
  "Núcleo":          "bg-zinc-100 text-zinc-600",
  "Crecimiento":     "bg-blue-50 text-blue-600",
  "Rentas":          "bg-green-50 text-green-600",
  "Diversificación": "bg-purple-50 text-purple-600",
  "Hedge":           "bg-amber-50 text-amber-600",
  "Ciclo largo":     "bg-rose-50 text-rose-600",
}

// ──────────────────────────────────────────────
// ESTADO AI POR CATEGORÍA / MODO
// ──────────────────────────────────────────────

type AiState = { etfs: AiEtf[]; context: string } | "loading" | "error" | null

// ──────────────────────────────────────────────
// TARJETA DE ETF CON ANÁLISIS AI
// ──────────────────────────────────────────────

function AiEtfCard({ etf, onAnalyze, loading }: { etf: AiEtf; onAnalyze: (t: string) => void; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-zinc-900">{etf.ticker}</span>
            <span className="text-sm text-zinc-400">{etf.name}</span>
          </div>
          {etf.tag && (
            <span className={cn("mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold", TAG_STYLES[etf.tag] ?? "bg-zinc-100 text-zinc-600")}>
              {etf.tag}
            </span>
          )}
        </div>
        <button
          onClick={() => onAnalyze(etf.ticker)}
          disabled={loading}
          className={cn(
            "shrink-0 flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
            loading ? "bg-zinc-100 text-zinc-400 cursor-not-allowed" : "bg-zinc-900 text-white hover:bg-zinc-700"
          )}
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : "Analizar"}
        </button>
      </div>

      {/* Contexto actual */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-blue-400">Contexto actual</p>
        <p className="text-[13px] leading-relaxed text-blue-800">{etf.reason_current}</p>
      </div>

      {/* A largo plazo */}
      <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-500">A largo plazo</p>
        <p className="text-[13px] leading-relaxed text-emerald-800">{etf.reason_20y}</p>
      </div>

      {/* Watch out */}
      {etf.watch_out && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" />
          <p className="text-[12px] leading-relaxed text-amber-700">{etf.watch_out}</p>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// SKELETON DE CARGA
// ──────────────────────────────────────────────

function LoadingSkeleton({ count = 4, label = "" }: { count?: number; label?: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 animate-pulse space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-14 rounded bg-zinc-200" />
            <div className="h-3 w-32 rounded bg-zinc-200" />
            <div className="ml-2 h-4 w-20 rounded-full bg-zinc-200" />
          </div>
          <div className="rounded-xl bg-blue-50/60 p-3 space-y-1.5">
            <div className="h-2.5 w-24 rounded bg-blue-100" />
            <div className="h-3 w-full rounded bg-blue-100" />
            <div className="h-3 w-4/5 rounded bg-blue-100" />
          </div>
          <div className="rounded-xl bg-emerald-50/60 p-3 space-y-1.5">
            <div className="h-2.5 w-20 rounded bg-emerald-100" />
            <div className="h-3 w-full rounded bg-emerald-100" />
          </div>
        </div>
      ))}
      <p className="text-center text-xs text-zinc-400 animate-pulse pt-1">
        {label || "Analizando con contexto de mercado actual..."}
      </p>
    </div>
  )
}

// ──────────────────────────────────────────────
// PANEL AI (compartido entre modos)
// ──────────────────────────────────────────────

function AiPanel({
  state, context, onRetry, onRefresh, onAnalyze, loadingTicker, skeletonCount, skeletonLabel,
}: {
  state: AiState
  context: string | null
  onRetry: () => void
  onRefresh: () => void
  onAnalyze: (t: string) => void
  loadingTicker: string | null
  skeletonCount?: number
  skeletonLabel?: string
}) {
  return (
    <div className="space-y-3">
      {/* Header del panel */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-amber-600 flex items-center gap-1">
            <Sparkles size={12} /> Análisis con contexto de mercado actual
          </p>
          {context && (
            <p className="text-[11px] text-zinc-400 mt-0.5">{context}</p>
          )}
        </div>
        {(state !== null && state !== "loading") && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-500 hover:border-zinc-400 transition-all"
          >
            <RefreshCw size={11} /> Regenerar
          </button>
        )}
      </div>

      {state === "loading" && <LoadingSkeleton count={skeletonCount} label={skeletonLabel} />}

      {state === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm text-red-600 font-medium">Error al analizar</p>
          <p className="text-xs text-red-400 mt-1">Verifica que el servidor Next.js tenga GROQ_API_KEY configurada.</p>
          <button onClick={onRetry} className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
            Reintentar
          </button>
        </div>
      )}

      {state !== null && state !== "loading" && state !== "error" && (
        <>
          <div className="space-y-3">
            {state.etfs.map(etf => (
              <AiEtfCard
                key={etf.ticker}
                etf={etf}
                onAnalyze={onAnalyze}
                loading={loadingTicker === etf.ticker}
              />
            ))}
          </div>
          <p className="text-center text-[11px] text-zinc-300 pt-1">
            <Link href="/analyze" className="hover:text-zinc-500 transition-colors">
              Analizar cualquier ETF o acción →
            </Link>
          </p>
        </>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ──────────────────────────────────────────────

export function ETFExplorer() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [mode, setMode]                     = useState<"categorias" | "20anios">("categorias")
  const [loadingTicker, setLoadingTicker]   = useState<string | null>(null)
  const router = useRouter()

  // Estado AI para "20 años"
  const [state20y, setState20y]       = useState<AiState>(null)
  const [context20y, setContext20y]   = useState<string | null>(null)

  // Estado AI por categoría (key = categoryId)
  const [catStates, setCatStates]         = useState<Record<string, AiState>>({})
  const [catContexts, setCatContexts]     = useState<Record<string, string>>({})

  // ── Fetch "mejor 20 años" ────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "20anios" || state20y !== null) return
    fetch20y(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  async function fetch20y(forceRefresh: boolean) {
    setState20y("loading")
    try {
      const url  = forceRefresh ? "/api/best-etfs-20y?refresh=1" : "/api/best-etfs-20y"
      const res  = await fetch(url, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Error en el análisis")
      setState20y({ etfs: data.etfs, context: data.context_summary ?? "" })
      setContext20y(data.context_summary ?? null)
    } catch {
      setState20y("error")
    }
  }

  // ── Fetch análisis por categoría ─────────────────────────────────────
  useEffect(() => {
    if (!activeCategory) return
    const existing = catStates[activeCategory]
    if (existing !== null && existing !== undefined) return
    fetchCategory(activeCategory, false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory])

  async function fetchCategory(categoryId: string, forceRefresh: boolean) {
    const cat = CATEGORIES.find(c => c.id === categoryId)
    if (!cat) return
    setCatStates(prev => ({ ...prev, [categoryId]: "loading" }))
    try {
      const res  = await fetch("/api/best-etfs-20y", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          categoryId,
          categoryLabel: cat.label,
          etfs:          cat.etfs,
          refresh:       forceRefresh,
        }),
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Error en el análisis")
      setCatStates(prev   => ({ ...prev, [categoryId]: { etfs: data.etfs, context: data.context_summary ?? "" } }))
      setCatContexts(prev => ({ ...prev, [categoryId]: data.context_summary ?? "" }))
    } catch {
      setCatStates(prev => ({ ...prev, [categoryId]: "error" }))
    }
  }

  async function analyze(ticker: string) {
    setLoadingTicker(ticker)
    try {
      const res  = await fetch("/api/analyze", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ticker }),
      })
      const data = await res.json()
      if (res.ok) router.push(`/ticker/${data.ticker}`)
    } finally {
      setLoadingTicker(null)
    }
  }

  const catState   = activeCategory ? catStates[activeCategory]   ?? null : null
  const catContext = activeCategory ? catContexts[activeCategory]  ?? null : null

  return (
    <div className="w-full space-y-4">
      {/* ── Mode toggle ── */}
      <div className="flex gap-2">
        <button
          onClick={() => { setMode("categorias") }}
          className={cn(
            "flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
            mode === "categorias"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-400"
          )}
        >
          Por categoría
        </button>
        <button
          onClick={() => setMode("20anios")}
          className={cn(
            "flex items-center justify-center gap-1.5 flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
            mode === "20anios"
              ? "border-amber-500 bg-amber-500 text-white"
              : "border-zinc-200 bg-white text-zinc-500 hover:border-amber-400 hover:text-amber-600"
          )}
        >
          <Sparkles size={14} /> Mejor para 20 años
        </button>
      </div>

      {/* ── MODO CATEGORÍAS ── */}
      {mode === "categorias" && (
        <>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-xs font-medium transition-all",
                  activeCategory === cat.id
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
                )}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>

          {activeCategory ? (
            <AiPanel
              state={catState}
              context={catContext}
              onRetry={() => {
                setCatStates(prev => ({ ...prev, [activeCategory]: null as unknown as AiState }))
                fetchCategory(activeCategory, false)
              }}
              onRefresh={() => fetchCategory(activeCategory, true)}
              onAnalyze={analyze}
              loadingTicker={loadingTicker}
              skeletonCount={CATEGORIES.find(c => c.id === activeCategory)?.etfs.length ?? 3}
              skeletonLabel={`Analizando ETFs de ${CATEGORIES.find(c => c.id === activeCategory)?.label ?? "la categoría"}...`}
            />
          ) : (
            <p className="text-center text-xs text-zinc-400 pt-2">
              Selecciona una categoría para ver el análisis contextualizado
            </p>
          )}
        </>
      )}

      {/* ── MODO 20 AÑOS ── */}
      {mode === "20anios" && (
        <AiPanel
          state={state20y}
          context={context20y}
          onRetry={() => { setState20y(null); fetch20y(false) }}
          onRefresh={() => fetch20y(true)}
          onAnalyze={analyze}
          loadingTicker={loadingTicker}
          skeletonCount={5}
          skeletonLabel="Seleccionando los mejores ETFs para 20 años según el mercado actual..."
        />
      )}
    </div>
  )
}
