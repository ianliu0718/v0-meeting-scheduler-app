"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import type { Language } from "../types"
import { getTranslation } from "./translations"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("zh-TW")

  useEffect(() => {
    const saved = localStorage.getItem("language") as Language
  if (saved && ["en", "zh-TW", "es", "tl"].includes(saved)) {
      setLanguageState(saved)
    } else {
      const browserLang = navigator.language
      if (browserLang.startsWith("zh")) {
        setLanguageState("zh-TW")
      } else if (browserLang.startsWith("es")) {
        setLanguageState("es")
      } else if (browserLang.startsWith("tl")) {
        setLanguageState("tl")
      } else {
        setLanguageState("en")
      }
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem("language", lang)
  }

  const t = (key: string) => getTranslation(language, key)

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider")
  }
  return context
}
