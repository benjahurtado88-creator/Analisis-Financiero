import { notFound } from "next/navigation"
import { VerdictBadge } from "@/components/ticker/VerdictBadge"
import { PriceCard } from "@/components/ticker/PriceCard"
import { FundamentalsCard } from "@/components/ticker/FundamentalsCard"
import { DividendCard } from "@/components/ticker/DividendCard"
import { EntryZoneCard } from "@/components/ticker/EntryZoneCard"
import { NewsCard } from "@/components/ticker/NewsCard"
import { ScenariosCard } from "@/components/ticker/ScenariosCard"
import { EventsCard } from "@/components/ticker/EventsCard"
import { MoatCard, RisksCard } from "@/components/ticker/MoatRisksCard"
import { SentimentCard } from "@/components/ticker/SentimentCard"
import { ArrowLeft, Search } from "lucide-react"
import Link from "next/link"
import fs from "fs"
import path from "path"

async function getTickerData(symbol: string): Promise<{ data: unknown; error?: string } | null> {
  const sym = symbol.toUpperCase()
  const tickerPath = path.join(process.cwd(), "public", "data", "ticker", `${sym}.json`)

  console.log("[ticker] cwd:", process.cwd())
  console.log("[ticker] looking for:", tickerPath)

  try {
    if (fs.existsSync(tickerPath)) {
      const raw = fs.readFileSync(tickerPath, "utf-8")
      return { data: JSON.parse(raw) }
    }

    // Fallback: output/history del proyecto raíz
    const historyDir = path.join(process.cwd(), "..", "output", "history")
    if (fs.existsSync(historyDir)) {
      const files = fs.readdirSync(historyDir)
        .filter(f => f.includes(`_${sym}.json`))
        .sort().reverse()
      if (files.length > 0) {
        const raw = fs.readFileSync(path.join(historyDir, files[0]), "utf-8")
        return { data: JSON.parse(raw) }
      }
    }

    return { data: null, error: `No se encontró análisis para ${sym}. Ejecuta primero: python analisis_maia.py ${sym}` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[ticker] error:", msg)
    return { data: null, error: msg }
  }
}

export default async function TickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params
  const result = await getTickerData(symbol)

  // Error explícito — mostrar pantalla de error con detalle
  if (!result || !result.data) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
        <div className="absolute inset-0 -z-10 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="w-full max-w-lg">
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-6">
            <p className="text-lg font-bold text-red-700 mb-2">⚠️ No se pudo cargar el análisis de {symbol.toUpperCase()}</p>
            <p className="text-sm text-red-600 mb-4">{result?.error ?? "Archivo no encontrado"}</p>
            <div className="rounded-xl bg-white border border-red-100 p-4 font-mono text-xs text-zinc-600">
              <p className="font-semibold mb-1 text-zinc-700">Solución — ejecuta en terminal:</p>
              <p>PYTHONUTF8=1 python analisis_maia.py {symbol.toUpperCase()}</p>
              <p className="mt-2 text-zinc-400">Directorio: maia-skill/</p>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <a href="/analyze" className="flex-1 flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors">
              Intentar de nuevo
            </a>
            <a href="/" className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
              Volver
            </a>
          </div>
        </div>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = result.data as any
  const { ticker, veredicto, score, precio, fundamentales, fair_value, info,
          noticias_ticker, noticias_macro, es_cripto, fecha,
          dcf, escenarios, moat, riesgos, eventos, sentimiento } = data

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="absolute inset-0 -z-10 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px]" />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-600">
            <ArrowLeft size={16} />
            volver
          </Link>
          <Link href="/analyze" className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors">
            <Search size={14} />
            Analizar otro
          </Link>
          <div className="text-right">
            <p className="text-xs text-zinc-400">Análisis generado</p>
            <p className="text-xs text-zinc-500">{new Date(fecha).toLocaleString("es-CL")}</p>
          </div>
        </div>

        {/* Título */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900">{ticker}</h1>
          {info?.sector && <p className="mt-1 text-sm text-zinc-400">{info.sector} · {info.industria ?? ""}</p>}
        </div>

        {/* Veredicto */}
        <div className="mb-6">
          <VerdictBadge verdict={veredicto} score={score} />
        </div>

        {/* Grid principal */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Columna izquierda */}
          <div className="space-y-6">
            <PriceCard ticker={ticker} precio={precio} info={info ?? {}} />
            {!es_cripto && fair_value && (
              <EntryZoneCard
                precio_actual={precio.precio_actual}
                fair_value={fair_value}
                soporte={precio.soporte}
              />
            )}
            <EventsCard eventos={eventos} />
            <ScenariosCard escenarios={escenarios} dcf={dcf} precio_actual={precio?.precio_actual ?? 0} />
            <DividendCard fundamentales={fundamentales ?? {}} esCripto={es_cripto} />
          </div>

          {/* Columna derecha */}
          <div className="space-y-6">
            {!es_cripto && fundamentales && (
              <FundamentalsCard fundamentales={fundamentales} info={info ?? {}} />
            )}
            <SentimentCard sentimiento={sentimiento} />
            <MoatCard moat={moat} />
            <RisksCard riesgos={riesgos} />
            <NewsCard noticias_ticker={noticias_ticker ?? []} noticias_macro={noticias_macro ?? []} />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 border-t border-zinc-200 pt-6 text-center text-xs text-zinc-400">
          <p>Análisis generado por <strong>Finance.ia</strong> — Solo con fines educativos. No es asesoría financiera.</p>
          <p className="mt-1">Los datos provienen de yfinance y FinanceToolkit. Siempre verifica antes de invertir.</p>
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params
  return { title: `${symbol.toUpperCase()} — Análisis Experto | Finance.ia` }
}
