"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Check, ChevronDown, Plus } from "lucide-react"

type Props = {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  newLabel?: string
  className?: string
}

// Text input with a searchable dropdown of saved options. Typing a name that
// isn't in the list is allowed — it becomes a new entry when the form is saved.
export function CreatableCombobox({ value, onChange, options, placeholder, newLabel = "New", className }: Props) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  const query = value.trim().toLowerCase()
  const filtered = query ? options.filter((o) => o.toLowerCase().includes(query)) : options
  const exact = options.some((o) => o.toLowerCase() === query)

  function pick(v: string) {
    onChange(v)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(0) }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHighlight((h) => Math.min(h + 1, filtered.length - 1)) }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)) }
          else if (e.key === "Enter" && open && filtered[highlight]) { e.preventDefault(); pick(filtered[highlight]) }
          else if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false) }
        }}
        className="pr-8"
        autoComplete="off"
      />
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />

      {open && (filtered.length > 0 || (query && !exact)) && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1">
          {filtered.map((o, i) => (
            <button
              key={o}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o)}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-1.5 text-sm text-left text-gray-900",
                i === highlight && "bg-blue-50",
              )}
            >
              {o}
              {o.toLowerCase() === query && <Check className="w-4 h-4 text-purple-600" />}
            </button>
          ))}
          {query && !exact && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 border-t border-gray-100">
              <Plus className="w-3.5 h-3.5" /> {newLabel}: <span className="font-medium text-gray-800">{value.trim()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
