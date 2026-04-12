"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

// ──────────────────────────────────────────────
// DATA
// ──────────────────────────────────────────────

type ETF = {
  ticker: string
  name: string
  desc: string
  tag?: string
}

type Category = {
  id: string
  label: string
  emoji: string
  etfs: ETF[]
}

const CATEGORIES: Category[] = [
  {
    id: "sp500",
    label: "S&P 500 / Mercado total",
    emoji: "🏦",
    etfs: [
      { ticker: "VOO",  name: "Vanguard S&P 500",         desc: "Las 500 empresas más grandes de EE.UU. Costo bajísimo (0.03%)." },
      { ticker: "SPY",  name: "SPDR S&P 500",             desc: "El ETF más negociado del mundo. Idéntico a VOO, algo más costoso." },
      { ticker: "VTI",  name: "Vanguard Total Market",    desc: "Todo el mercado accionario de EE.UU. — pequeñas, medianas y grandes." },
      { ticker: "IVV",  name: "iShares Core S&P 500",     desc: "Alternativa de BlackRock al VOO. Igual de barato y líquido." },
    ],
  },
  {
    id: "tech",
    label: "Tecnología",
    emoji: "💻",
    etfs: [
      { ticker: "QQQ",  name: "Invesco Nasdaq-100",       desc: "Las 100 mayores tech del Nasdaq: Apple, NVDA, Microsoft, Meta..." },
      { ticker: "VGT",  name: "Vanguard Info Tech",       desc: "Sector tecnología puro del S&P 500. Más concentrado que QQQ." },
      { ticker: "SOXX", name: "iShares Semiconductors",   desc: "Solo semiconductores: NVDA, AMD, TSMC, Broadcom." },
      { ticker: "IGV",  name: "iShares Expanded Tech-SW", desc: "Software puro: Salesforce, Adobe, SAP, Oracle." },
      { ticker: "ARKK", name: "ARK Innovation",           desc: "Tech disruptiva de alto riesgo: IA, genómica, fintech, robótica." },
    ],
  },
  {
    id: "dividendos",
    label: "Dividendos",
    emoji: "💰",
    etfs: [
      { ticker: "SCHD", name: "Schwab US Dividend Equity", desc: "Dividendos crecientes de alta calidad. El favorito para rentas." },
      { ticker: "VYM",  name: "Vanguard High Dividend",    desc: "Alta rentabilidad por dividendo con baja volatilidad." },
      { ticker: "DVY",  name: "iShares Select Dividend",   desc: "Top 100 acciones por dividendo de EE.UU." },
      { ticker: "HDV",  name: "iShares Core High Dividend",desc: "Empresas sólidas con dividendo alto: JNJ, XOM, Verizon..." },
    ],
  },
  {
    id: "global",
    label: "Mercado global",
    emoji: "🌍",
    etfs: [
      { ticker: "VT",   name: "Vanguard Total World",      desc: "Todo el mundo en un ETF: EE.UU. + mercados desarrollados + emergentes." },
      { ticker: "VEA",  name: "Vanguard Dev Markets ex-US",desc: "Europa, Japón, Australia. Diversificación fuera de EE.UU." },
      { ticker: "EEM",  name: "iShares MSCI Emerging Mkt", desc: "China, India, Brasil, Corea del Sur. Alto potencial, alta volatilidad." },
      { ticker: "MELI", name: "MercadoLibre",              desc: "Latam: el Amazon + Mercado Pago de América Latina." },
    ],
  },
  {
    id: "salud",
    label: "Salud",
    emoji: "🏥",
    etfs: [
      { ticker: "XLV",  name: "Health Care Select SPDR",   desc: "Todo el sector salud del S&P 500: JNJ, UNH, Pfizer..." },
      { ticker: "VHT",  name: "Vanguard Health Care",      desc: "Versión más amplia de XLV, incluye medianas." },
      { ticker: "IBB",  name: "iShares Biotechnology",     desc: "Biotecnología pura. Alto riesgo y alto potencial." },
    ],
  },
  {
    id: "energia",
    label: "Energía",
    emoji: "⚡",
    etfs: [
      { ticker: "XLE",  name: "Energy Select SPDR",        desc: "Petróleo y gas del S&P 500: ExxonMobil, Chevron..." },
      { ticker: "ICLN", name: "iShares Clean Energy",      desc: "Energías renovables: solar, eólica, hidrógeno." },
      { ticker: "GLD",  name: "SPDR Gold Shares",          desc: "Oro físico. Refugio en crisis e inflación." },
    ],
  },
  {
    id: "bonos",
    label: "Bonos / Renta fija",
    emoji: "🔒",
    etfs: [
      { ticker: "BND",  name: "Vanguard Total Bond Market", desc: "Todo el mercado de bonos EE.UU. Conservador y estable." },
      { ticker: "AGG",  name: "iShares Core US Aggregate",  desc: "Bonos investment-grade. El benchmark de renta fija." },
      { ticker: "TLT",  name: "iShares 20+ Year Treasury",  desc: "Bonos del tesoro largo plazo. Muy sensible a tasas de interés." },
      { ticker: "SGOV", name: "iShares 0-3 Month Treasury", desc: "Casi equivalente a efectivo. Rendimiento similar a tasa Fed." },
    ],
  },
  {
    id: "inmobiliario",
    label: "Inmobiliario (REITs)",
    emoji: "🏢",
    etfs: [
      { ticker: "VNQ",  name: "Vanguard Real Estate",      desc: "REITs diversificados: centros comerciales, oficinas, logística." },
      { ticker: "XLRE", name: "Real Estate Select SPDR",   desc: "REITs del S&P 500 más grandes." },
    ],
  },
]

const VEINTE_ANIOS: ETF[] = [
  { ticker: "VTI",  name: "Vanguard Total Market",     desc: "Todo EE.UU. en un ETF. Rendimiento histórico ~10%/año. El núcleo de cualquier portafolio de largo plazo.",             tag: "Núcleo" },
  { ticker: "VOO",  name: "Vanguard S&P 500",          desc: "Las 500 empresas más grandes. Consistency histórica brutal. Warren Buffett lo recomienda para casi todo el mundo.",     tag: "Núcleo" },
  { ticker: "QQQ",  name: "Nasdaq-100",                desc: "Tech en su máxima expresión. Más volátil pero mayor retorno en los últimos 20 años. Ideal si tienes tolerancia al riesgo.", tag: "Crecimiento" },
  { ticker: "SCHD", name: "Schwab Dividend Equity",    desc: "Dividendos crecientes + revalorización. El mejor ETF para vivir de rentas a largo plazo sin sacrificar crecimiento.",  tag: "Rentas" },
  { ticker: "VGT",  name: "Vanguard Info Tech",        desc: "Tecnología concentrada. Si crees que la revolución digital continúa, este es tu ETF estructural.",                      tag: "Crecimiento" },
  { ticker: "VT",   name: "Vanguard Total World",      desc: "Todo el mundo. Máxima diversificación geográfica. Para quien no quiere apostar solo a EE.UU.",                         tag: "Diversificación" },
]

// ──────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────

export function ETFExplorer() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [mode, setMode]                     = useState<"categorias" | "20anios">("categorias")
  const [loadingTicker, setLoadingTicker]   = useState<string | null>(null)
  const router = useRouter()

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

  const selectedCategory = CATEGORIES.find(c => c.id === activeCategory)
  const etfsToShow = mode === "20anios" ? VEINTE_ANIOS : selectedCategory?.etfs ?? []

  return (
    <div className="w-full space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => { setMode("categorias"); setActiveCategory(null) }}
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
          <Sparkles size={14} />
          Mejor para 20 años
        </button>
      </div>

      {/* Categories */}
      {mode === "categorias" && (
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
      )}

      {/* ETF List */}
      {(mode === "20anios" || (mode === "categorias" && activeCategory)) && (
        <div className="space-y-2">
          {mode === "20anios" && (
            <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <Sparkles size={12} />
              Los ETFs con mejor historial para crecer 20 años y no mirar atrás
            </p>
          )}
          {etfsToShow.map(etf => (
            <div
              key={etf.ticker}
              className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-white p-3 shadow-sm hover:border-zinc-300 transition-all"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-50 border border-zinc-100">
                <TrendingUp size={16} className="text-zinc-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-900 text-sm">{etf.ticker}</span>
                  <span className="text-xs text-zinc-400 truncate">{etf.name}</span>
                  {etf.tag && (
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      etf.tag === "Núcleo"          && "bg-zinc-100 text-zinc-600",
                      etf.tag === "Crecimiento"     && "bg-blue-50 text-blue-600",
                      etf.tag === "Rentas"          && "bg-green-50 text-green-600",
                      etf.tag === "Diversificación" && "bg-purple-50 text-purple-600",
                    )}>
                      {etf.tag}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-zinc-400 leading-snug">{etf.desc}</p>
              </div>
              <button
                onClick={() => analyze(etf.ticker)}
                disabled={loadingTicker === etf.ticker}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  loadingTicker === etf.ticker
                    ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                    : "bg-zinc-900 text-white hover:bg-zinc-700"
                )}
              >
                {loadingTicker === etf.ticker
                  ? <Loader2 size={12} className="animate-spin" />
                  : "Analizar"
                }
              </button>
            </div>
          ))}
        </div>
      )}

      {mode === "categorias" && !activeCategory && (
        <p className="text-center text-xs text-zinc-400 pt-2">
          Selecciona una categoría para ver los ETFs disponibles
        </p>
      )}
    </div>
  )
}
