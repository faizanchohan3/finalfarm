"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tag, Plus, Trash2 } from "lucide-react"
import { useLang } from "@/lib/i18n"

type Slot = 1 | 2

export default function MarkhaPage() {
  const { t } = useLang()
  const [markhas, setMarkhas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newMarkha, setNewMarkha] = useState<Record<Slot, string>>({ 1: "", 2: "" })
  const [saving, setSaving] = useState<Slot | null>(null)

  async function load() {
    setLoading(true)
    const m = await fetch("/api/markhas").then((r) => r.json()).catch(() => ({}))
    setMarkhas(m.markhas || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function addMarkha(slot: Slot) {
    const name = newMarkha[slot].trim()
    if (!name) return
    const clash = markhas.find((m) => m.name.toLowerCase() === name.toLowerCase())
    if (clash) { alert(`"${clash.name}" already exists in Markha ${clash.slot ?? 1}`); return }
    setSaving(slot)
    const res = await fetch("/api/markhas", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slot }),
    })
    setSaving(null)
    if (res.ok) { setNewMarkha((prev) => ({ ...prev, [slot]: "" })); load() }
    else { const d = await res.json().catch(() => ({})); alert(d?.error || "Failed to add markha") }
  }

  async function deleteMarkha(id: string, name: string) {
    if (!confirm(`Remove markha "${name}"? Existing lots keep their markha.`)) return
    setMarkhas((prev) => prev.filter((m) => m.id !== id))
    await fetch(`/api/markhas/${id}`, { method: "DELETE" })
  }

  function renderList(slot: Slot) {
    const list = markhas.filter((m) => (m.slot ?? 1) === slot)
    return (
      <Card key={slot}>
        <CardHeader>
          <CardTitle className="text-base">{t(`Markha ${slot}`)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder={t("New markha name (e.g. A, B, Lal Sona)")}
              value={newMarkha[slot]}
              onChange={(e) => setNewMarkha((prev) => ({ ...prev, [slot]: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && addMarkha(slot)}
              autoFocus={slot === 1}
            />
            <Button onClick={() => addMarkha(slot)} disabled={saving === slot} className="gap-1">
              <Plus className="w-4 h-4" /> {t("Add")}
            </Button>
          </div>

          <div className="rounded-lg border border-gray-200 divide-y">
            {loading ? (
              <p className="text-sm text-gray-400 text-center py-6">{t("Loading...")}</p>
            ) : list.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">{t("No markhas yet. Add your first above.")}</p>
            ) : list.map((m, i) => (
              <div key={m.id} className="flex items-center justify-between px-3 py-2.5 gap-2 flex-wrap">
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
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Tag className="w-6 h-6 text-purple-600" /> {t("Markhas")}
        </h2>
        <p className="text-gray-500 text-sm">{t("Saved markhas appear as options in the Add Lot form and the Markha report.")}</p>
        <p className="text-gray-500 text-sm">{t("A markha can be in Markha 1 or Markha 2, not both.")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        {renderList(1)}
        {renderList(2)}
      </div>
    </div>
  )
}
