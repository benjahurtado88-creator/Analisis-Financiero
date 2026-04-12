"use client"

import { useState, useEffect, useCallback } from "react"
import { usePortfolio } from "@/hooks/use-portfolio"
import { cn } from "@/lib/utils"
import Link from "next/link"
import {
  Plus, X, RefreshCw, TrendingUp, TrendingDown, Minus,
  Pencil, Check, Trash2, ChevronDown, ChevronUp, Newspaper
} from "lucide-react"

// ── Color map ────────────────────────────────────────────────
const COLOR: Record<string, { bg: string; border: string; badge: string; dot: string }> = {
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  blue:    { bg: "bg-blue-50",    border: "border-blue-200",    badge: "bg-blue-100 text-blue-700",       dot: "bg-blue-500"    },
  purple:  { bg: "bg-purple-50",  border: "border-purple-200",  badge: "bg-purple-100 text-purple-700",   dot: "bg-purple-500"  },
  amber:   { bg: "bg-amber-50",   border: "border-amber-200",   badge: "bg-amber-100 text-amber-700",     dot: "bg-amber-500"   },
  rose:    { bg: "bg-rose-50",    border: "border-rose-200",    badge: "bg-rose-100 text-rose-700",       dot: "bg-rose-500"    },
  cyan:    { bg: "bg-cyan-50",    border: "border-cyan-200",    badge: "bg-cyan-100 text-cyan-700",       dot: "bg-cyan-500"    },
}

const VERDICT_COLOR: Record<string, string> = {
  "COMPRA FUERTE":      "text-emerald-600",
  "COMPRA":             "text-green-600",
  "MANTENER / ESPERAR": "text-yellow-600",
  "EVITAR":             "text-red-600",
  "MOMENTUM FUERTE":    "text-purple-600",
}

interface NewsData {
  noticias:   string[]
  precio?:    number
  cambio_24h?: number
  veredicto?: string
}

// ── Add Stock Modal ─────────────────────────────────────────
function AddStockModal({ onAdd, onClose }: { onAdd: (ticker: string, shares?: number, avgPrice?: number) => void; onClose: () => void }) {
  const [ticker, setTicker]     = useState("")
  const [shares, setShares]     = useState("")
  const [avgPrice, setAvgPrice] = useState("")

  function submit() {
    const t = ticker.toUpperCase().trim()
    if (!t) return
    onAdd(t, shares ? parseFloat(shares) : undefined, avgPrice ? parseFloat(avgPrice) : undefined)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="mb-4 text-base font-bold text-zinc-800">Agregar acción / cripto</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Ticker *</label>
            <input
              autoFocus
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="Ej: AAPL, BTC, KO"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Acciones (opcional)</label>
              <input
                type="number"
                value={shares}
                onChange={e => setShares(e.target.value)}
                placeholder="Ej: 10"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Precio promedio $</label>
              <input
                type="number"
                value={avgPrice}
                onChange={e => setAvgPrice(e.target.value)}
                placeholder="Ej: 175.50"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
              />
            </div>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={submit} className="flex-1 rounded-xl bg-zinc-900 py-2 text-sm font-semibold text-white hover:bg-zinc-700">
            Agregar
          </button>
          <button onClick={onClose} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-500 hover:bg-zinc-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Stock Row ───────────────────────────────────────────────
function StockRow({
  ticker, shares, avgPrice, newsData, onRemove
}: {
  ticker: string; shares?: number; avgPrice?: number
  newsData?: NewsData; onRemove: () => void
}) {
  const [showNews, setShowNews] = useState(false)
  const precio    = newsData?.precio
  const cambio    = newsData?.cambio_24h
  const veredicto = newsData?.veredicto
  const noticias  = newsData?.noticias ?? []

  const ganancia = shares && avgPrice && precio
    ? ((precio - avgPrice) * shares)
    : null
  const gananciaP = avgPrice && precio ? ((precio - avgPrice) / avgPrice * 100) : null

  return (
    <div className="rounded-xl border border-zinc-100 bg-white shadow-sm">
      <div className="flex items-center gap-3 p-4">
        {/* Ticker */}
        <Link href={`/ticker/${ticker}`} className="min-w-[60px] text-sm font-bold text-zinc-900 hover:text-zinc-600 transition-colors">
          {ticker}
        </Link>

        {/* Precio */}
        <div className="flex-1">
          {precio ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-zinc-800">${precio.toFixed(2)}</span>
              {cambio !== undefined && (
                <span className={cn("flex items-center gap-0.5 text-xs font-medium",
                  cambio > 0 ? "text-emerald-600" : cambio < 0 ? "text-red-500" : "text-zinc-400"
                )}>
                  {cambio > 0 ? <TrendingUp size={11}/> : cambio < 0 ? <TrendingDown size={11}/> : <Minus size={11}/>}
                  {cambio > 0 ? "+" : ""}{cambio.toFixed(2)}%
                </span>
              )}
              {veredicto && (
                <span className={cn("text-xs font-medium", VERDICT_COLOR[veredicto] ?? "text-zinc-500")}>
                  {veredicto}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-zinc-400">Sin datos — analiza primero</span>
          )}
          {shares && avgPrice && (
            <p className="mt-0.5 text-xs text-zinc-400">
              {shares} acc · Costo: ${avgPrice.toFixed(2)}
              {ganancia !== null && (
                <span className={cn("ml-2 font-medium", ganancia >= 0 ? "text-emerald-600" : "text-red-500")}>
                  {ganancia >= 0 ? "+" : ""}${ganancia.toFixed(2)} ({gananciaP?.toFixed(1)}%)
                </span>
              )}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {noticias.length > 0 && (
            <button
              onClick={() => setShowNews(v => !v)}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
              title="Ver noticias"
            >
              <Newspaper size={13} />
              {noticias.length}
              {showNews ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
            </button>
          )}
          <Link href={`/ticker/${ticker}`} className="rounded-lg px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors">
            Ver análisis
          </Link>
          <button onClick={onRemove} className="rounded-lg p-1.5 text-zinc-300 hover:bg-red-50 hover:text-red-500 transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Noticias expandibles */}
      {showNews && noticias.length > 0 && (
        <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
          <p className="mb-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Noticias recientes</p>
          <ul className="space-y-2">
            {noticias.map((n, i) => {
              const match = n.match(/^\[(\d{4}-\d{2}-\d{2})\] ([^:]+): (.+?)(?:\s*—\s*(.+))?$/)
              if (match) {
                const [, fecha, fuente, titulo, resumen] = match
                return (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 flex-shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-400">{fecha}</span>
                    <div>
                      <p className="text-xs font-medium text-zinc-700">{titulo}</p>
                      {resumen && <p className="text-xs text-zinc-400 line-clamp-1">{resumen}</p>}
                      <p className="text-xs text-zinc-300">{fuente}</p>
                    </div>
                  </li>
                )
              }
              return <li key={i} className="text-xs text-zinc-500">{n}</li>
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Category Card ───────────────────────────────────────────
function CategoryCard({
  category, newsMap, onAddStock, onRemoveStock, onRemoveCategory, onRename
}: {
  category: ReturnType<typeof usePortfolio>["portfolio"]["categories"][0]
  newsMap: Record<string, NewsData>
  onAddStock: (ticker: string, shares?: number, avgPrice?: number) => void
  onRemoveStock: (ticker: string) => void
  onRemoveCategory: () => void
  onRename: (name: string) => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState(false)
  const [name, setName]           = useState(category.name)
  const c = COLOR[category.color] ?? COLOR.emerald

  function saveRename() {
    if (name.trim()) onRename(name.trim())
    setEditing(false)
  }

  return (
    <>
      {showModal && (
        <AddStockModal
          onAdd={(t, s, p) => onAddStock(t, s, p)}
          onClose={() => setShowModal(false)}
        />
      )}

      <div className={cn("rounded-2xl border-2 p-5", c.bg, c.border)}>
        {/* Header categoría */}
        <div className="mb-4 flex items-center gap-2">
          <div className={cn("h-3 w-3 rounded-full flex-shrink-0", c.dot)} />
          {editing ? (
            <div className="flex flex-1 items-center gap-2">
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") setEditing(false) }}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm font-semibold focus:outline-none"
              />
              <button onClick={saveRename} className="text-emerald-600 hover:text-emerald-700"><Check size={15}/></button>
            </div>
          ) : (
            <h2 className="flex-1 text-base font-bold text-zinc-800">{category.name}</h2>
          )}
          <div className="flex items-center gap-1">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", c.badge)}>
              {category.stocks.length} activos
            </span>
            <button onClick={() => setEditing(v => !v)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white hover:text-zinc-600 transition-colors">
              <Pencil size={13}/>
            </button>
            <button onClick={onRemoveCategory} className="rounded-lg p-1.5 text-zinc-300 hover:bg-white hover:text-red-500 transition-colors">
              <Trash2 size={13}/>
            </button>
          </div>
        </div>

        {/* Stocks */}
        <div className="space-y-2">
          {category.stocks.length === 0 && (
            <p className="py-3 text-center text-sm text-zinc-400">
              No hay activos aún. Agrega tu primera posición.
            </p>
          )}
          {category.stocks.map(s => (
            <StockRow
              key={s.ticker}
              ticker={s.ticker}
              shares={s.shares}
              avgPrice={s.avgPrice}
              newsData={newsMap[s.ticker]}
              onRemove={() => onRemoveStock(s.ticker)}
            />
          ))}
        </div>

        {/* Agregar stock */}
        <button
          onClick={() => setShowModal(true)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 bg-white/60 py-2.5 text-sm font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <Plus size={14}/> Agregar activo
        </button>
      </div>
    </>
  )
}

// ── Main Page ───────────────────────────────────────────────
export default function PortfolioPage() {
  const { portfolio, loaded, addStock, removeStock, addCategory, removeCategory, renameCategory } = usePortfolio()
  const [newsMap, setNewsMap]         = useState<Record<string, NewsData>>({})
  const [loadingNew, setLoadingNew]   = useState(false)   // solo para tickers nuevos
  const [refreshing, setRefreshing]   = useState(false)   // refresh manual
  const [lastUpdate, setLastUpdate]   = useState<string | null>(null)
  const [newCatName, setNewCatName]   = useState("")
  const [showCatInput, setShowCatInput] = useState(false)

  const allTickers = [...new Set(portfolio.categories.flatMap(c => c.stocks.map(s => s.ticker)))]

  // Paso 1: carga cache local instantáneamente (GET, sin Python)
  const loadCache = useCallback(async (tickers: string[]) => {
    if (!tickers.length) return
    try {
      const res  = await fetch(`/api/portfolio-news?tickers=${tickers.join(",")}`)
      const data = await res.json()
      setNewsMap(prev => ({ ...prev, ...data.results }))
      setLastUpdate(new Date().toLocaleTimeString("es-CL"))
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Paso 2: analiza en background solo tickers que no tienen datos
  const analyzeNew = useCallback(async (tickers: string[], map: Record<string, NewsData>) => {
    const sinDatos = tickers.filter(t => !map[t]?.precio)
    if (!sinDatos.length) return
    setLoadingNew(true)
    try {
      const res  = await fetch("/api/portfolio-news", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tickers: sinDatos }),
      })
      const data = await res.json()
      setNewsMap(prev => ({ ...prev, ...data.results }))
      setLastUpdate(new Date().toLocaleTimeString("es-CL"))
    } catch {}
    setLoadingNew(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refresh manual — fuerza re-análisis de todos (con Python)
  const handleRefresh = useCallback(async () => {
    if (!allTickers.length) return
    setRefreshing(true)
    try {
      const res  = await fetch("/api/portfolio-news", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tickers: allTickers }),
      })
      const data = await res.json()
      setNewsMap(data.results ?? {})
      setLastUpdate(new Date().toLocaleTimeString("es-CL"))
    } catch {}
    setRefreshing(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTickers.join(",")])

  // Al montar: cache inmediato → luego analiza nuevos en background
  useEffect(() => {
    if (!loaded || !allTickers.length) return
    loadCache(allTickers).then(() => {
      setNewsMap(prev => {
        analyzeNew(allTickers, prev)
        return prev
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, allTickers.join(",")])

  function handleAddCategory() {
    if (!newCatName.trim()) return
    addCategory(newCatName.trim())
    setNewCatName("")
    setShowCatInput(false)
  }

  if (!loaded) return null

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="absolute inset-0 -z-10 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px]" />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Mi Portafolio</h1>
            <p className="text-sm text-zinc-400">
              {allTickers.length} activos en {portfolio.categories.length} categorías
              {lastUpdate && <span className="ml-2">· {lastUpdate}</span>}
              {loadingNew && <span className="ml-2 text-amber-500">· analizando nuevos...</span>}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing || !allTickers.length}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
              refreshing ? "bg-zinc-100 text-zinc-400 cursor-not-allowed" : "bg-zinc-900 text-white hover:bg-zinc-700"
            )}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Actualizando..." : "Forzar actualización"}
          </button>
        </div>

        {/* Sin activos */}
        {allTickers.length === 0 && (
          <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <TrendingUp size={32} className="mx-auto mb-3 text-zinc-300" />
            <p className="text-sm font-medium text-zinc-600">Tu portafolio está vacío</p>
            <p className="mt-1 text-xs text-zinc-400">Agrega activos a cada categoría para ver su estado y noticias en tiempo real.</p>
          </div>
        )}

        {/* Categorías */}
        <div className="space-y-6">
          {portfolio.categories.map(cat => (
            <CategoryCard
              key={cat.id}
              category={cat}
              newsMap={newsMap}
              onAddStock={(t, s, p) => addStock(cat.id, t, s, p)}
              onRemoveStock={t => removeStock(cat.id, t)}
              onRemoveCategory={() => removeCategory(cat.id)}
              onRename={name => renameCategory(cat.id, name)}
            />
          ))}
        </div>

        {/* Nueva categoría */}
        <div className="mt-6">
          {showCatInput ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAddCategory(); if (e.key === "Escape") setShowCatInput(false) }}
                placeholder="Nombre de la categoría..."
                className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm focus:border-zinc-500 focus:outline-none"
              />
              <button onClick={handleAddCategory} className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700">
                Crear
              </button>
              <button onClick={() => setShowCatInput(false)} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-500">
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCatInput(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 py-4 text-sm font-medium text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <Plus size={16}/> Nueva categoría
            </button>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-zinc-400">
          Los datos se guardan en tu navegador. Las noticias se actualizan automáticamente al abrir la página.
        </p>
      </div>
    </div>
  )
}
