"use client"

import { useState, useEffect, useCallback } from "react"

export interface PortfolioStock {
  ticker: string
  addedAt: string
  shares?: number
  avgPrice?: number
}

export interface PortfolioCategory {
  id: string
  name: string
  color: string
  stocks: PortfolioStock[]
}

export interface Portfolio {
  categories: PortfolioCategory[]
}

const STORAGE_KEY = "finance_ia_portfolio"

const DEFAULT_PORTFOLIO: Portfolio = {
  categories: [
    { id: "dividends", name: "Portafolio Dividendos", color: "emerald", stocks: [] },
    { id: "growth",    name: "Portafolio Growth",     color: "blue",    stocks: [] },
  ],
}

const COLOR_OPTIONS = ["emerald", "blue", "purple", "amber", "rose", "cyan"]

// ── Persistencia en servidor ──────────────────────────────────────────────────

async function loadFromServer(): Promise<Portfolio | null> {
  try {
    const res = await fetch("/api/portfolio", { cache: "no-store" })
    if (!res.ok) return null
    const data = await res.json()
    return data.portfolio ?? null
  } catch {
    return null
  }
}

async function saveToServer(portfolio: Portfolio): Promise<void> {
  try {
    await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portfolio }),
    })
  } catch {
    // Silencioso — localStorage ya tiene la copia local
  }
}

// ── Hook principal ────────────────────────────────────────────────────────────

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio>(DEFAULT_PORTFOLIO)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // 1. Carga localStorage instantáneamente (para no mostrar vacío)
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setPortfolio(JSON.parse(raw))
    } catch {}

    // 2. Carga desde el servidor (fuente de verdad) — sobreescribe si hay datos
    loadFromServer().then((serverData) => {
      if (serverData) {
        setPortfolio(serverData)
        // Sincronizar localStorage con la versión del servidor
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData)) } catch {}
      }
      setLoaded(true)
    })
  }, [])

  const save = useCallback((p: Portfolio) => {
    setPortfolio(p)
    // Guardar en localStorage (inmediato)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)) } catch {}
    // Guardar en servidor (backup persistente)
    saveToServer(p)
  }, [])

  const addStock = useCallback((categoryId: string, ticker: string, shares?: number, avgPrice?: number) => {
    setPortfolio(prev => {
      const next = structuredClone(prev)
      const cat = next.categories.find(c => c.id === categoryId)
      if (!cat) return prev
      if (cat.stocks.some(s => s.ticker === ticker.toUpperCase())) return prev
      cat.stocks.push({ ticker: ticker.toUpperCase(), addedAt: new Date().toISOString(), shares, avgPrice })
      save(next)
      return next
    })
  }, [save])

  const removeStock = useCallback((categoryId: string, ticker: string) => {
    setPortfolio(prev => {
      const next = structuredClone(prev)
      const cat = next.categories.find(c => c.id === categoryId)
      if (!cat) return prev
      cat.stocks = cat.stocks.filter(s => s.ticker !== ticker)
      save(next)
      return next
    })
  }, [save])

  const addCategory = useCallback((name: string) => {
    setPortfolio(prev => {
      const next = structuredClone(prev)
      const color = COLOR_OPTIONS[next.categories.length % COLOR_OPTIONS.length]
      next.categories.push({
        id: `cat_${Date.now()}`,
        name,
        color,
        stocks: [],
      })
      save(next)
      return next
    })
  }, [save])

  const removeCategory = useCallback((id: string) => {
    setPortfolio(prev => {
      const next = { ...prev, categories: prev.categories.filter(c => c.id !== id) }
      save(next)
      return next
    })
  }, [save])

  const renameCategory = useCallback((id: string, name: string) => {
    setPortfolio(prev => {
      const next = structuredClone(prev)
      const cat = next.categories.find(c => c.id === id)
      if (cat) cat.name = name
      save(next)
      return next
    })
  }, [save])

  return { portfolio, loaded, addStock, removeStock, addCategory, removeCategory, renameCategory }
}
