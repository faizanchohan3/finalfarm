"use client"

import { useState } from "react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Search, X } from "lucide-react"

export type SelectOption = {
  value: string
  label: string
  sub?: string
}

export type SelectGroup = {
  label: string
  options: SelectOption[]
}

type Props = {
  value: string
  onValueChange: (v: string) => void
  placeholder?: string
  options?: SelectOption[]
  groups?: SelectGroup[]
  className?: string
  disabled?: boolean
  side?: "top" | "right" | "bottom" | "left"
  searchable?: boolean
}

export function SearchableSelect({
  value,
  onValueChange,
  placeholder = "Select...",
  options = [],
  groups = [],
  className,
  disabled,
  side = "bottom",
  searchable = true,
}: Props) {
  const [search, setSearch] = useState("")

  // Filter options based on search
  const filteredOptions = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const filteredGroups = search
    ? groups.map(g => ({
        ...g,
        options: g.options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
      })).filter(g => g.options.length > 0)
    : groups

  const selectedLabel = [...options, ...groups.flatMap(g => g.options)].find(o => o.value === value)?.label

  return (
    <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={cn("w-full border-2 border-amber-200 hover:border-green-500 transition-colors", className)}>
        {value ? (
          <div className="flex items-center gap-2 w-full">
            <span className="text-sm font-medium">{selectedLabel}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-500">
            <Search className="w-4 h-4" />
            <span>{placeholder}</span>
          </div>
        )}
      </SelectTrigger>
      <SelectContent side={side} className="w-[--radix-select-trigger-width] min-w-[200px]">
        {searchable && (
          <div className="p-2 border-b sticky top-0 bg-amber-50 z-50">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm border-amber-200"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onKeyUp={(e) => e.stopPropagation()}
                autoFocus
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-2 p-0 h-4 w-4 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {filteredOptions.length === 0 && filteredGroups.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            {search ? "No categories found" : "No categories available"}
          </div>
        ) : (
          <>
            {filteredOptions.map(o => (
              <SelectItem key={o.value} value={o.value} className="cursor-pointer hover:bg-blue-50">
                <span className="font-medium">{o.label}</span>
                {o.sub && <span className="ml-2 text-xs text-gray-400">{o.sub}</span>}
              </SelectItem>
            ))}
            {filteredGroups.map(g => (
              <SelectGroup key={g.label}>
                <SelectLabel className="text-xs uppercase font-bold text-gray-600">{g.label}</SelectLabel>
                {g.options.map(o => (
                  <SelectItem key={o.value} value={o.value} className="cursor-pointer hover:bg-blue-50">
                    <span className="font-medium">{o.label}</span>
                    {o.sub && <span className="ml-2 text-xs text-gray-400">{o.sub}</span>}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  )
}
