"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils"
import { Plus, Wheat, Pencil, Trash2, Scale } from "lucide-react"

type Commodity = {
  id: string
  name: string
  unit: string
  standardWeight: number | null
  marketRate: number
  notes: string | null
}

const EMPTY = { name: "", unit: "KG", standardWeight: "", marketRate: "", notes: "" }

export default function CommoditiesPage() {
  const [items, setItems] = useState<Commodity[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    try {
      const res = await fetch("/api/commodities")
      const data = await res.json()
      setItems(data.commodities || [])
    } catch {
      setItems([])
    }
    setLoading(false)
  }
  useEffect(() => { loadData() }, [])

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function openNew() {
    setEditId(null)
    setForm({ ...EMPTY })
    setError(null)
    setShowModal(true)
  }

  function openEdit(c: Commodity) {
    setEditId(c.id)
    setForm({
      name: c.name,
      unit: c.unit,
      standardWeight: c.standardWeight != null ? String(c.standardWeight) : "",
      marketRate: c.marketRate ? String(c.marketRate) : "",
      notes: c.notes || "",
    })
    setError(null)
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Commodity name is required.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const url = editId ? `/api/commodities/${editId}` : "/api/commodities"
      const method = editId ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d?.error || "Failed to save commodity.")
      } else {
        setShowModal(false)
        loadData()
      }
    } catch {
      setError("Network error. Please try again.")
    }
    setSaving(false)
  }

  async function handleDelete(c: Commodity) {
    if (!confirm(`Deactivate "${c.name}"? It will be hidden from lists but historical records are kept.`)) return
    await fetch(`/api/commodities/${c.id}`, { method: "DELETE" })
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wheat className="w-6 h-6 text-amber-600" /> Commodities
          </h2>
          <p className="text-gray-500 text-sm">Master list of crops and goods traded in your mandi</p>
        </div>
        <Button className="gap-2" onClick={openNew}>
          <Plus className="w-4 h-4" /> Add Commodity
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading commodities...</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="text-center py-12">
          <Wheat className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No commodities yet.</p>
          <p className="text-gray-400 text-sm">Add wheat, rice, cotton and the goods you trade.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{c.name}</h3>
                    <p className="text-xs text-gray-400">Unit: {c.unit}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(c)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Deactivate">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5" />
                    {c.standardWeight ? `${c.standardWeight} ${c.unit}/unit` : "—"}
                  </span>
                  <span className="font-semibold text-gray-900">
                    {c.marketRate ? formatCurrency(c.marketRate) : "No rate"}
                  </span>
                </div>
                {c.notes && <p className="text-xs text-gray-400 mt-2">{c.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit Commodity" : "Add Commodity"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Wheat" autoFocus /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="KG" /></div>
              <div><Label>Standard weight</Label><Input type="number" value={form.standardWeight} onChange={(e) => set("standardWeight", e.target.value)} placeholder="e.g. 40" /></div>
            </div>
            <div><Label>Market rate (per unit)</Label><Input type="number" value={form.marketRate} onChange={(e) => set("marketRate", e.target.value)} placeholder="0" /></div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" /></div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1" disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} className="flex-1" disabled={saving}>{saving ? "Saving..." : editId ? "Save Changes" : "Add Commodity"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
