"use client"

import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { VoiceInputButton } from "@/components/voice-input-button"
import { cn } from "@/lib/utils"

const LANG_KEY = "voiceSearchLang"

// Search box with a mic: speak to fill the search. A small switch picks Urdu or English speech
// (names may be saved in either); the choice is remembered on this browser.
export function VoiceSearch({ value, onChange, placeholder, className }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [lang, setLang] = useState<"ur-PK" | "en-US">("ur-PK")

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY)
      if (saved === "en-US" || saved === "ur-PK") setLang(saved)
    } catch {}
  }, [])

  function switchLang() {
    const next = lang === "ur-PK" ? "en-US" : "ur-PK"
    setLang(next)
    try { localStorage.setItem(LANG_KEY, next) } catch {}
  }

  return (
    <div className={cn("flex items-center gap-2 max-w-md", className)}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="pl-9" dir="auto" />
      </div>
      <button
        type="button"
        onClick={switchLang}
        title="Voice language — click to switch"
        className="h-9 px-2 rounded-md border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50 flex-shrink-0"
      >
        {lang === "ur-PK" ? "اردو" : "EN"}
      </button>
      <VoiceInputButton key={lang} lang={lang} what="to search" onResult={onChange} />
    </div>
  )
}
