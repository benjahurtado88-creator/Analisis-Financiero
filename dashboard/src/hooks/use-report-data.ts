"use client"

import { useState, useEffect } from "react"
import type { ReportData } from "@/types/report"
import type { Language } from "@/lib/translations"

export function useReportData(lang: Language = "en") {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    // Llama a /api/report que inyecta precios en tiempo real desde Yahoo Finance
    fetch(`/api/report?lang=${lang}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`Error ${res.status} al cargar el reporte`)
        return res.json()
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [lang])

  return { data, loading, error }
}
