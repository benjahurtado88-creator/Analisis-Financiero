"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { ReportData, MacroOpportunities } from "@/types/report"
import type { Language } from "@/lib/translations"

const MACRO_REFRESH_INTERVAL_MS = 15 * 60 * 1000 // 15 minutos
const AUTO_REFRESH_STALE_MS     =  4 * 60 * 60 * 1000 // 4 horas

export function useReportData(lang: Language = "en") {
  const [data, setData]           = useState<ReportData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [macroRefreshing, setMacroRefreshing] = useState(false)
  const [macroRefreshedAt, setMacroRefreshedAt] = useState<string | null>(null)

  // Carga inicial del reporte completo
  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/report?lang=${lang}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`Error ${res.status} al cargar el reporte`)
        return res.json()
      })
      .then((d) => {
        setData(d)
        if (d._macro_refreshed_at) setMacroRefreshedAt(d._macro_refreshed_at as string)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [lang])

  // Llama a /api/refresh-macro y actualiza macro en el estado
  const refreshMacro = useCallback(async () => {
    if (macroRefreshing) return
    setMacroRefreshing(true)
    try {
      const res = await fetch("/api/refresh-macro", { method: "POST", cache: "no-store" })
      if (!res.ok) return
      const json = await res.json() as {
        ok: boolean
        refreshedAt?: string
        executive_summary?: string
        macro_environment?: ReportData["macro_environment"]
        macro_opportunities?: MacroOpportunities
      }
      if (json.ok && json.executive_summary) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                executive_summary:   json.executive_summary!,
                macro_environment:   json.macro_environment   ?? prev.macro_environment,
                macro_opportunities: json.macro_opportunities ?? prev.macro_opportunities,
              }
            : prev
        )
        if (json.refreshedAt) setMacroRefreshedAt(json.refreshedAt)
      }
    } catch { /* silencioso */ } finally {
      setMacroRefreshing(false)
    }
  }, [macroRefreshing])

  // Auto-refresh si el análisis macro es más viejo que 4 horas (solo una vez por carga)
  const autoRefreshedRef = useRef(false)
  useEffect(() => {
    if (!data || macroRefreshing || autoRefreshedRef.current) return
    const refreshedAt = data._macro_refreshed_at
    const ageMs = refreshedAt
      ? Date.now() - new Date(refreshedAt).getTime()
      : Infinity
    if (ageMs > AUTO_REFRESH_STALE_MS) {
      autoRefreshedRef.current = true
      refreshMacro()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // Auto-refresh de macro cada 15 min (solo cuando el tab está activo y ya hay datos)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!data) return
    intervalRef.current = setInterval(() => {
      if (!document.hidden) refreshMacro()
    }, MACRO_REFRESH_INTERVAL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [data, refreshMacro])

  return { data, loading, error, macroRefreshing, macroRefreshedAt, refreshMacro }
}
