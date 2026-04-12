import { AnalyzeSearch } from "@/components/ticker/AnalyzeSearch"
import { ETFExplorer }   from "@/components/ticker/ETFExplorer"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = { title: "Analizar — Finance.ia" }

export default function AnalyzePage() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="absolute inset-0 -z-10 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px]" />

      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <Link href="/" className="mb-8 flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-600">
          <ArrowLeft size={16} />
          volver al reporte
        </Link>

        {/* ── BUSCAR TICKER ────────────────────────── */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Analizar empresa o cripto</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Escribe el ticker y obtendrás un análisis completo con técnico, fundamentales, dividendos y zona de entrada.
          </p>
        </div>

        <AnalyzeSearch />

        <div className="mt-8 rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">¿Cómo funciona?</p>
          <div className="space-y-3">
            {[
              { n: "1", t: "Escribes el ticker",   d: "Ejemplo: AAPL para Apple, BTC para Bitcoin, KO para Coca-Cola" },
              { n: "2", t: "El sistema analiza",   d: "Obtiene precios reales, calcula indicadores técnicos y fundamentales automáticamente" },
              { n: "3", t: "Ver el informe",        d: "Dashboard interactivo con zona de entrada, semáforos y explicaciones en simple" },
            ].map(({ n, t, d }) => (
              <div key={n} className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">{n}</span>
                <div>
                  <p className="text-sm font-medium text-zinc-800">{t}</p>
                  <p className="text-xs text-zinc-400">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── EXPLORADOR DE ETFs ───────────────────── */}
        <div className="mt-12">
          <div className="mb-5 text-center">
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">Explorar ETFs</h2>
            <p className="mt-1 text-sm text-zinc-500">
              No sabes qué ticker poner? Elige una categoría o déjanos sugerirte los mejores para 20 años.
            </p>
          </div>
          <ETFExplorer />
        </div>

        <p className="mt-10 text-center text-xs text-zinc-400">
          Solo con fines educativos. No es asesoría financiera.
        </p>
      </div>
    </div>
  )
}
