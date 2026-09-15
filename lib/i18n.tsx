"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { tr, type Lang } from "@/lib/i18n-dict"

export type { Lang }

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (s: string) => string; dir: "ltr" | "rtl" }

const LangContext = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (s) => s, dir: "ltr" })

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en")
  const router = useRouter()

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lang")
      if (saved === "ur" || saved === "en") setLangState(saved)
    } catch {}
  }, [])

  useEffect(() => {
    const el = document.documentElement
    el.lang = lang
    el.dir = lang === "ur" ? "rtl" : "ltr"
  }, [lang])

  const setLang = (l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem("lang", l)
    } catch {}
    // Cookie lets server components render in the chosen language.
    document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`
    // Re-render server components (dashboard, etc.) with the new language.
    router.refresh()
  }

  const t = (s: string) => tr(lang, s)

  return (
    <LangContext.Provider value={{ lang, setLang, t, dir: lang === "ur" ? "rtl" : "ltr" }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
