"use client"

import { Languages } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function LanguageToggle({ collapsed, dark }: { collapsed?: boolean; dark?: boolean }) {
  const { lang, setLang } = useLang()
  const next = lang === "en" ? "ur" : "en"

  return (
    <button
      onClick={() => setLang(next)}
      title={lang === "en" ? "اردو میں دیکھیں" : "View in English"}
      className={cn(
        "flex items-center gap-2 rounded-lg border text-sm font-medium transition-colors",
        dark
          ? "border-white/10 bg-white/5 hover:bg-white/10 text-gray-200"
          : "border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700",
        collapsed ? "justify-center px-0 py-2 w-10 h-10 mx-auto" : "px-3 py-2 w-full"
      )}
    >
      <Languages className={cn("w-4 h-4 flex-shrink-0", dark ? "text-gray-400" : "text-gray-500")} />
      {!collapsed && (
        <span className="flex-1 text-left">
          {lang === "en" ? "اردو" : "English"}
        </span>
      )}
    </button>
  )
}
