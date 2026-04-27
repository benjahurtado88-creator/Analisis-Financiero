"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import type { MacroOpportunities, MacroOpportunity, MacroHiddenGem } from "@/types/report"

const CONVICTION_STYLES: Record<string, string> = {
  high:   "bg-green-50 text-green-700 border-green-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low:    "bg-zinc-50  text-zinc-500  border-zinc-200",
}

const CONVICTION_LABELS: Record<string, string> = {
  high: "Alta convicción", medium: "Media", low: "Baja",
}

const HORIZON_CONFIG = {
  short:  { label: "Corto plazo",   sub: "días · semanas",  accent: "border-blue-400",   dot: "bg-blue-400" },
  medium: { label: "Mediano plazo", sub: "1 · 6 meses",     accent: "border-amber-400",  dot: "bg-amber-400" },
  long:   { label: "Largo plazo",   sub: "6 · 24 meses",    accent: "border-emerald-400",dot: "bg-emerald-400" },
}

function OpportunityCard({ opp, delay }: { opp: MacroOpportunity; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-xl border border-[#E6E6E4] bg-white p-4"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-[#252420]">{opp.theme}</span>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CONVICTION_STYLES[opp.conviction]}`}>
          {CONVICTION_LABELS[opp.conviction]}
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-[#4D4A44]">{opp.idea}</p>
      {opp.tickers && opp.tickers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {opp.tickers.map(t => (
            <Link
              key={t}
              href={`/ticker/${t}`}
              className="rounded-full border border-[#E6E6E4] bg-[#F7F7F5] px-2.5 py-0.5 text-xs font-semibold text-[#4D4A44] transition hover:border-zinc-400 hover:text-zinc-700"
            >
              {t}
            </Link>
          ))}
        </div>
      )}
    </motion.div>
  )
}

function HiddenGemCard({ gem, delay }: { gem: MacroHiddenGem; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-xl border border-purple-200 bg-purple-50 p-4"
    >
      <div className="mb-1 flex items-center gap-2">
        <Link
          href={`/ticker/${gem.ticker}`}
          className="text-base font-bold text-purple-700 hover:text-purple-600 hover:underline"
        >
          {gem.ticker}
        </Link>
        {gem.name && <span className="text-sm text-purple-600">{gem.name}</span>}
        <span className="ml-auto rounded-full border border-purple-200 bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-600">
          {gem.theme}
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-purple-800">{gem.reason}</p>
    </motion.div>
  )
}

interface Props {
  opportunities: MacroOpportunities
  refreshing?: boolean
}

export function MacroOpportunities({ opportunities, refreshing }: Props) {
  const horizons: Array<keyof typeof HORIZON_CONFIG> = ["short", "medium", "long"]

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className={refreshing ? "opacity-60 transition-opacity" : ""}
    >
      <h2 className="mb-5 text-2xl font-bold tracking-tight text-[#252420]">
        Oportunidades de mercado
      </h2>

      {/* ── Tres horizontes temporales ────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        {horizons.map((h, hi) => {
          const cfg  = HORIZON_CONFIG[h]
          const opps = opportunities[h] ?? []
          return (
            <div key={h} className={`rounded-xl border-t-4 border-[#E6E6E4] bg-[#FCFCFB] p-4 ${cfg.accent}`}>
              <div className="mb-3 flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
                <div>
                  <p className="text-sm font-semibold text-[#252420]">{cfg.label}</p>
                  <p className="text-[11px] text-[#8B8B85]">{cfg.sub}</p>
                </div>
              </div>
              {opps.length === 0 ? (
                <p className="text-xs text-[#8B8B85]">Sin oportunidades detectadas</p>
              ) : (
                <div className="space-y-3">
                  {opps.map((opp, i) => (
                    <OpportunityCard key={i} opp={opp} delay={0.4 + hi * 0.08 + i * 0.05} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Hidden Gems ──────────────────────────────────────────────────── */}
      {opportunities.hidden_gems?.length > 0 && (
        <div className="mt-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-base font-bold text-[#252420]">Hidden gems</span>
            <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-600">
              ignoradas por el mercado
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {opportunities.hidden_gems.map((gem, i) => (
              <HiddenGemCard key={gem.ticker} gem={gem} delay={0.5 + i * 0.06} />
            ))}
          </div>
        </div>
      )}

      {/* ── Qué evitar ───────────────────────────────────────────────────── */}
      {opportunities.avoid?.length > 0 && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="mb-2 text-sm font-semibold text-red-700">Qué evitar ahora</p>
          <ul className="space-y-1">
            {opportunities.avoid.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-red-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.section>
  )
}
