"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { Youtube, ExternalLink, TrendingUp, TrendingDown, Minus, Star } from "lucide-react"

interface TickerMention {
  ticker: string
  contexto?: string
  sentimiento?: string
}

interface VideoAnalysis {
  relevante?: boolean
  resumen_breve?: string
  tesis_principal?: string
  sentimiento_general?: string
  horizonte?: string
  tickers_mencionados?: TickerMention[]
  macro_temas?: string[]
  claims_clave?: string[]
  riesgos_mencionados?: string[]
}

interface SignalVideo {
  video_id: string
  title: string
  channel: string
  url: string
  published_text: string
  fetched_at: string
  analysis: VideoAnalysis
}

interface CrossMatchMention {
  video_id: string
  title: string
  channel: string
  url: string
  contexto: string
  sentimiento: string
  fetched_at: string
}

interface CrossMatch {
  ticker: string
  source: "portfolio" | "macro_opportunity"
  mentions: CrossMatchMention[]
}

interface SignalsResponse {
  last_run: string | null
  videos: SignalVideo[]
  cross_matches: CrossMatch[]
  message?: string
}

const SENT_STYLE: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode; label: string }> = {
  bullish: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: <TrendingUp size={11} />, label: "Bullish" },
  bearish: { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",     icon: <TrendingDown size={11} />, label: "Bearish" },
  mixto:   { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   icon: <Minus size={11} />, label: "Mixto" },
  neutral: { bg: "bg-zinc-50",    text: "text-zinc-600",    border: "border-zinc-200",    icon: <Minus size={11} />, label: "Neutral" },
}

const SOURCE_LABEL: Record<CrossMatch["source"], string> = {
  portfolio:         "En tu portfolio",
  macro_opportunity: "En oportunidades macro",
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `hace ${days}d`
}

function SentimentPill({ sentiment }: { sentiment?: string }) {
  const s = SENT_STYLE[sentiment ?? "neutral"] ?? SENT_STYLE.neutral
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${s.bg} ${s.text} ${s.border} px-2 py-0.5 text-[10px] font-semibold`}>
      {s.icon}
      {s.label}
    </span>
  )
}

function TickerPill({ mention }: { mention: TickerMention }) {
  const s = SENT_STYLE[mention.sentimiento ?? "neutral"] ?? SENT_STYLE.neutral
  return (
    <Link
      href={`/ticker/${mention.ticker}`}
      title={mention.contexto}
      className={`inline-flex items-center gap-1 rounded-full border ${s.bg} ${s.text} ${s.border} px-2.5 py-0.5 text-xs font-semibold transition hover:opacity-80`}
    >
      {s.icon}
      {mention.ticker}
    </Link>
  )
}

function CrossMatchCard({ match }: { match: CrossMatch }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-violet-200 bg-violet-50/60 p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <Star size={14} className="text-violet-600" />
        <Link
          href={`/ticker/${match.ticker}`}
          className="text-base font-bold text-violet-700 hover:underline"
        >
          {match.ticker}
        </Link>
        <span className="rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
          {SOURCE_LABEL[match.source]}
        </span>
        <span className="ml-auto text-[11px] text-violet-700">
          {match.mentions.length} {match.mentions.length === 1 ? "mención" : "menciones"}
        </span>
      </div>
      <ul className="space-y-2">
        {match.mentions.slice(0, 3).map(m => (
          <li key={m.video_id} className="rounded-lg border border-violet-100 bg-white p-2.5">
            <div className="mb-1 flex items-center gap-2 text-[11px] text-violet-700">
              <span className="font-semibold">@{m.channel}</span>
              <SentimentPill sentiment={m.sentimiento} />
              <a
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-violet-600 hover:underline"
              >
                Ver video <ExternalLink size={10} />
              </a>
            </div>
            <p className="text-[12px] leading-relaxed text-[#4D4A44]">
              <span className="font-medium text-[#252420]">{m.title}</span>
              {m.contexto && <span> — {m.contexto}</span>}
            </p>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

function VideoCard({ v, delay }: { v: SignalVideo; delay: number }) {
  const a = v.analysis
  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-xl border border-[#E6E6E4] bg-white p-4"
    >
      <header className="mb-2 flex items-center gap-2 text-[11px] text-[#4D4A44]">
        <Youtube size={13} className="text-red-600" />
        <span className="font-semibold">@{v.channel}</span>
        {v.published_text && <span>· {v.published_text}</span>}
        <SentimentPill sentiment={a.sentimiento_general} />
        {a.horizonte && (
          <span className="rounded-full border border-[#E6E6E4] bg-[#F7F7F5] px-2 py-0.5 text-[10px]">
            {a.horizonte}
          </span>
        )}
        <a
          href={v.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-[#4D4A44] hover:text-[#252420]"
        >
          Abrir <ExternalLink size={10} />
        </a>
      </header>

      <a
        href={v.url}
        target="_blank"
        rel="noreferrer"
        className="text-[14px] font-semibold leading-snug text-[#252420] hover:underline"
      >
        {v.title}
      </a>

      {a.resumen_breve && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-[#4D4A44]">
          {a.resumen_breve}
        </p>
      )}

      {a.tickers_mencionados && a.tickers_mencionados.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {a.tickers_mencionados.map(t => (
            <TickerPill key={t.ticker} mention={t} />
          ))}
        </div>
      )}

      {a.claims_clave && a.claims_clave.length > 0 && (
        <details className="mt-3 text-[12px] text-[#4D4A44]">
          <summary className="cursor-pointer font-semibold text-[#252420]">Claims clave</summary>
          <ul className="ml-4 mt-1.5 list-disc space-y-1">
            {a.claims_clave.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </details>
      )}

      {a.riesgos_mencionados && a.riesgos_mencionados.length > 0 && (
        <details className="mt-1.5 text-[12px] text-[#4D4A44]">
          <summary className="cursor-pointer font-semibold text-[#252420]">Riesgos</summary>
          <ul className="ml-4 mt-1.5 list-disc space-y-1">
            {a.riesgos_mencionados.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </details>
      )}
    </motion.article>
  )
}

export function YoutubeSignals() {
  const [data, setData]       = useState<SignalsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/youtube-signals")
      .then(r => r.json())
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (error) return null

  const videos  = data?.videos        ?? []
  const matches = data?.cross_matches ?? []
  if (videos.length === 0 && !data?.message) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="space-y-5"
    >
      <header className="flex items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#252420]">
            Señales YouTube
          </h2>
          <p className="text-[12px] text-[#4D4A44]">
            Análisis de los canales que sigues · {videos.length} {videos.length === 1 ? "video" : "videos"}
            {data?.last_run && <> · actualizado {timeAgo(data.last_run)}</>}
          </p>
        </div>
      </header>

      {data?.message && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
          {data.message}
        </p>
      )}

      {matches.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[#252420]">
            Tickers cruzados con tu portfolio y oportunidades macro
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {matches.map(m => (
              <CrossMatchCard key={`${m.ticker}:${m.source}`} match={m} />
            ))}
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[#252420]">Últimos videos analizados</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {videos.map((v, i) => (
              <VideoCard key={v.video_id} v={v} delay={i * 0.05} />
            ))}
          </div>
        </div>
      )}
    </motion.section>
  )
}
