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

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio>(DEFAULT_PORTFOLIO)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setPortfolio(JSON.parse(raw))
    } catch {}
    setLoaded(true)
  }, [])

  const save = useCallback((p: Portfolio) => {
    setPortfolio(p)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
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
