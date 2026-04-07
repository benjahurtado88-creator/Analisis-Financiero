import { ExternalLink } from "lucide-react"

export function NewsCard({ noticias_ticker, noticias_macro }: {
  noticias_ticker: string[]
  noticias_macro: string[]
}) {
  if (!noticias_ticker?.length && !noticias_macro?.length) return null

  return (
    <div className="space-y-4">
      {noticias_ticker?.length > 0 && (
        <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-zinc-500">Noticias Recientes</p>
          <ul className="space-y-3">
            {noticias_ticker.map((n, i) => {
              // Soporta ambos formatos:
              // Nuevo: "[fecha] Fuente (score:12): Titulo — Resumen"
              // Viejo: "[fecha] Fuente: Titulo — Resumen"
              const match = n.match(/^\[(\d{4}-\d{2}-\d{2})\] ([^(:]+?)(?:\s*\(score:\d+\))?\s*:\s*(.+?)(?:\s*—\s*(.+))?$/)
              if (match) {
                const [, fecha, fuente, titulo, resumen] = match
                return (
                  <li key={i} className="border-b border-zinc-50 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex-shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">{fecha}</div>
                      <div>
                        <p className="text-sm font-medium text-zinc-800">{titulo}</p>
                        {resumen && <p className="mt-0.5 text-xs text-zinc-400 line-clamp-2">{resumen}</p>}
                        <p className="mt-1 text-xs text-zinc-300">{fuente.trim()}</p>
                      </div>
                    </div>
                  </li>
                )
              }
              return (
                <li key={i} className="text-sm text-zinc-600">{n}</li>
              )
            })}
          </ul>
        </div>
      )}

      {noticias_macro?.filter(n => n !== "MarketWatch.com - Top Stories").length > 0 && (
        <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-zinc-500">Contexto Macro del Mercado</p>
          <ul className="space-y-2">
            {noticias_macro
              .filter(n => n !== "MarketWatch.com - Top Stories")
              .map((n, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                  <span className="mt-1 flex-shrink-0 text-zinc-300">•</span>
                  {n}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}
