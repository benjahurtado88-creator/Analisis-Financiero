type RawNewsItem = { title: string; url?: string; source?: string; date?: string; sentiment?: string } | string

function normalize(n: RawNewsItem): { title: string; url: string; source: string; date: string; sentiment: string } {
  if (typeof n === "object" && n !== null) {
    return {
      title:     n.title ?? "",
      url:       n.url ?? "",
      source:    n.source ?? "",
      date:      n.date ?? "",
      sentiment: n.sentiment ?? "neutral",
    }
  }
  // Parsear formato legado: "[fecha] Fuente (score:N): Titulo — Resumen"
  const match = String(n).match(/^\[(\d{4}-\d{2}-\d{2})\] ([^(:]+?)(?:\s*\(score:\d+\))?\s*:\s*(.+?)(?:\s*—\s*.+)?$/)
  if (match) {
    return { title: match[3].trim(), url: "", source: match[2].trim(), date: match[1], sentiment: "neutral" }
  }
  return { title: String(n), url: "", source: "", date: "", sentiment: "neutral" }
}

const sentimentDot: Record<string, string> = {
  bullish: "bg-green-500",
  bearish: "bg-red-500",
  neutral: "bg-zinc-300",
}

export function NewsCard({ noticias_ticker, noticias_macro }: {
  noticias_ticker: RawNewsItem[]
  noticias_macro: RawNewsItem[]
}) {
  if (!noticias_ticker?.length && !noticias_macro?.length) return null

  const renderItem = (raw: RawNewsItem, i: number) => {
    const n = normalize(raw)
    if (!n.title) return null
    return (
      <li key={i} className="border-b border-zinc-50 pb-3 last:border-0 last:pb-0">
        <div className="flex items-start gap-2">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${sentimentDot[n.sentiment] ?? "bg-zinc-300"}`}
            title={n.sentiment}
          />
          <div className="min-w-0 flex-1">
            {n.url ? (
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-zinc-800 hover:text-zinc-500 hover:underline"
              >
                {n.title}
              </a>
            ) : (
              <p className="text-sm font-medium text-zinc-800">{n.title}</p>
            )}
            <p className="mt-0.5 text-xs text-zinc-400">
              {n.source}{n.date ? ` · ${n.date}` : ""}
            </p>
          </div>
          {n.date && (
            <div className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">{n.date}</div>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-zinc-500">Noticias Recientes</p>
        {noticias_ticker?.length > 0 ? (
          <ul className="space-y-3">{noticias_ticker.map(renderItem)}</ul>
        ) : (
          <p className="text-sm text-zinc-400 italic">No se encontraron noticias al respecto.</p>
        )}
      </div>

      {noticias_macro?.filter(n => {
        const t = typeof n === "string" ? n : (n as {title?: string}).title ?? ""
        return t !== "MarketWatch.com - Top Stories" && t.length > 0
      }).length > 0 && (
        <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-zinc-500">Contexto Macro del Mercado</p>
          <ul className="space-y-3">
            {noticias_macro
              .filter(n => {
                const t = typeof n === "string" ? n : (n as {title?: string}).title ?? ""
                return t !== "MarketWatch.com - Top Stories" && t.length > 0
              })
              .map(renderItem)}
          </ul>
        </div>
      )}
    </div>
  )
}
