"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tag, Plus, Trash2 } from "lucide-react"
import { useLang } from "@/lib/i18n"

export default function MarkhaPage() {
  const { t } = useLang()
  const [markhas, setMarkhas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newMarkha, setNewMarkha] = useState("")
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const m = await fetch("/api/markhas").then((r) => r.json()).catch(() => ({}))
    setMarkhas(m.markhas || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function addMarkha() {
    const name = newMarkha.trim()
    if (!name) return
    setSaving(true)
    const res = await fetch("/api/markhas", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
    })
    setSaving(false)
    if (res.ok) { setNewMarkha(""); load() }
    else { const d = await res.json().catch(() => ({})); alert(d?.error || "Failed to add markha") }
  }

  async function deleteMarkha(id: string, name: string) {
    if (!confirm(`Remove markha "${name}"? Existing lots keep their markha.`)) return
    setMarkhas((prev) => prev.filter((m) => m.id !== id))
    await fetch(`/api/markhas/${id}`, { method: "DELETE" })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Tag className="w-6 h-6 text-purple-600" /> {t("Markhas")}
        </h2>
        <p className="text-gray-500 text-sm">{t("Saved markhas appear as options in the Add Lot form and the Markha report.")}</p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">{t("Add")} {t("Markhas")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder={t("New markha name (e.g. A, B, Lal Sona)")}
              value={newMarkha}
              onChange={(e) => setNewMarkha(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMarkha()}
              autoFocus
            />
            <Button onClick={addMarkha} disabled={saving} className="gap-1">
              <Plus className="w-4 h-4" /> {t("Add")}
            </Button>
          </div>

          <div className="rounded-lg border border-gray-200 divide-y">
            {loading ? (
              <p className="text-sm text-gray-400 text-center py-6">{t("Loading...")}</p>
            ) : markhas.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">{t("No markhas yet. Add your first above.")}</p>
            ) : markhas.map((m, i) => (
              <div key={m.id} className="flex items-center justify-between px-3 py-2.5">
                <span className="text-sm text-gray-800 flex items-center gap-2">
                  <span className="text-gray-400 text-xs">{i + 1}</span>
                  <Tag className="w-3.5 h-3.5 text-purple-500" />
                  {m.name}
                </span>
                <button onClick={() => deleteMarkha(m.id, m.name)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title={t("Delete")}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
