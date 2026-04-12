"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { TRANSLATIONS, type Language } from "@/lib/translations"

const STORAGE_KEY = "finance-ia-lang-v2"

interface LanguageContextValue {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string) => string
  showPicker: boolean
  dismissPicker: () => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en")
  const [showPicker, setShowPicker] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null
    if (stored && (stored === "en" || stored === "es")) {
      setLangState(stored)
    } else {
      setShowPicker(true)
    }
  }, [])

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang)
    localStorage.setItem(STORAGE_KEY, newLang)
  }, [])

  const dismissPicker = useCallback(() => {
    setShowPicker(false)
  }, [])

  const t = useCallback(
    (key: string): string => {
      return TRANSLATIONS[lang][key] ?? TRANSLATIONS.en[key] ?? key
    },
    [lang]
  )

  // Don't show picker until client mounts to avoid hydration mismatch
  const effectiveShowPicker = mounted && showPicker

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, showPicker: effectiveShowPicker, dismissPicker }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return ctx
}
