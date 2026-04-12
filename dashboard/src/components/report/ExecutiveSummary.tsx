"use client"

import { motion } from "framer-motion"
import { useLanguage } from "@/hooks/use-language"

interface ExecutiveSummaryProps {
  summary: string
  refreshing?: boolean
  refreshedAt?: string | null
  onRefresh?: () => void
}

export function ExecutiveSummary({ summary, refreshing, refreshedAt, onRefresh }: ExecutiveSummaryProps) {
  const { t } = useLanguage()

  const timeLabel = refreshedAt
    ? new Date(refreshedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-xl border border-[#E6E6E4] bg-[#FCFCFB] p-6"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8B8B85]">
          {t("executive.label")}
        </p>
        <div className="flex items-center gap-2">
          {timeLabel && (
            <span className="text-[11px] text-[#8B8B85]">
              {refreshing ? "actualizando..." : `actualizado ${timeLabel}`}
            </span>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              title="Regenerar resumen y macro con datos en tiempo real"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-[#E6E6E4] bg-white text-[#8B8B85] transition hover:border-[#fa8625] hover:text-[#fa8625] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg
                className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-3.22-6.94" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <motion.p
        key={summary}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-[15px] leading-7 text-[#4D4A44]"
      >
        {summary}
      </motion.p>
    </motion.section>
  )
}
