"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Download, Upload, Loader2 } from "lucide-react"

export function ShopDataActions() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch("/api/shop/export")
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d?.error || "Export failed")
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition") || ""
      const match = disposition.match(/filename="(.+?)"/)
      const filename = match?.[1] || `shop-backup-${new Date().toISOString().slice(0, 10)}.json`
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert("Export failed. Please try again.")
    } finally {
      setExporting(false)
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ""
    if (!file) return

    if (!confirm(`Import "${file.name}" into this shop? Records will be ADDED to your current data.`)) return

    setImporting(true)
    try {
      const text = await file.text()
      let json: any
      try {
        json = JSON.parse(text)
      } catch {
        alert("That file is not valid JSON.")
        return
      }
      const res = await fetch("/api/shop/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data?.error || "Import failed")
        return
      }
      alert(`Import complete — ${data.total} records added to this shop.`)
      router.refresh()
    } catch {
      alert("Import failed. Please try again.")
    } finally {
      setImporting(false)
    }
  }

  const btn =
    "inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors disabled:opacity-50"

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button onClick={handleExport} disabled={exporting} className={`${btn} text-gray-700 bg-white border-gray-200 hover:bg-gray-50`}>
        {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        {exporting ? "Exporting…" : "Export Data"}
      </button>
      <button onClick={() => fileRef.current?.click()} disabled={importing} className={`${btn} text-gray-700 bg-white border-gray-200 hover:bg-gray-50`}>
        {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        {importing ? "Importing…" : "Import Data"}
      </button>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />
    </div>
  )
}
