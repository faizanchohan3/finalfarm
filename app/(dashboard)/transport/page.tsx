"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Plus, Truck, MapPin, Package, User } from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  DISPATCHED: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
}

const EMPTY = {
  walkInDriver: "", walkInVehicle: "", fromLocation: "", toLocation: "",
  commodity: "", bags: "", rate: "", freight: "", rent: "", notes: "",
}

export default function TransportPage() {
  const [slips, setSlips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY })

  async function loadData() {
    setLoading(true)
    try {
      const res = await fetch("/api/freight")
      const data = await res.json()
      setSlips(data.slips || [])
    } catch {
      setSlips([])
    }
    setLoading(false)
  }
  useEffect(() => { loadData() }, [])

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleCreate() {
    if (!form.fromLocation.trim() || !form.toLocation.trim()) {
      setError("From and To locations are required.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/freight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d?.error || "Failed to create freight slip.")
      } else {
        setForm({ ...EMPTY })
        setShowModal(false)
        loadData()
      }
    } catch {
      setError("Network error. Please try again.")
    }
    setSaving(false)
  }

  const totalFreight = slips.reduce((s, x) => s + (x.netAmount || x.freight || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-600" /> Transport / Freight
          </h2>
          <p className="text-gray-500 text-sm">Freight slips for goods dispatched and delivered</p>
        </div>
        <Button className="gap-2" onClick={() => { setForm({ ...EMPTY }); setError(null); setShowModal(true) }}>
          <Plus className="w-4 h-4" /> New Freight Slip
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Total Slips</p>
          <p className="text-xl font-bold text-gray-900">{slips.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Total Freight</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totalFreight)}</p>
        </CardContent></Card>
        <Card className="hidden sm:block"><CardContent className="p-4">
          <p className="text-xs text-gray-500">Pending</p>
          <p className="text-xl font-bold text-amber-600">{slips.filter((s) => s.status === "PENDING").length}</p>
        </CardContent></Card>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading freight slips...</div>
      ) : slips.length === 0 ? (
        <Card><CardContent className="text-center py-12">
          <Truck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No freight slips yet.</p>
          <p className="text-gray-400 text-sm">Create your first slip to record a dispatch.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {slips.map((s) => {
            const driver = s.driver?.name || s.walkInDriver || "—"
            const vehicle = s.vehicle?.vehicleNo || s.walkInVehicle || "—"
            return (
              <Card key={s.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-gray-400">{s.slipNo}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[s.status] || "bg-gray-100 text-gray-600"}`}>
                          {s.status}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-blue-500" />
                        {s.fromLocation} <span className="text-gray-400">→</span> {s.toLocation}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        {s.commodity && <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" />{s.commodity}</span>}
                        <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{driver}</span>
                        <span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5" />{vehicle}</span>
                        {s.bags ? <span>{s.bags} bags</span> : null}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(s.netAmount || s.freight || 0)}</p>
                      <p className="text-xs text-gray-400">{formatDate(s.createdAt)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Freight Slip</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>From *</Label><Input value={form.fromLocation} onChange={(e) => set("fromLocation", e.target.value)} placeholder="Origin" autoFocus /></div>
              <div><Label>To *</Label><Input value={form.toLocation} onChange={(e) => set("toLocation", e.target.value)} placeholder="Destination" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Driver</Label><Input value={form.walkInDriver} onChange={(e) => set("walkInDriver", e.target.value)} placeholder="Driver name" /></div>
              <div><Label>Vehicle</Label><Input value={form.walkInVehicle} onChange={(e) => set("walkInVehicle", e.target.value)} placeholder="Vehicle no." /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Commodity</Label><Input value={form.commodity} onChange={(e) => set("commodity", e.target.value)} placeholder="e.g. Wheat" /></div>
              <div><Label>Bags</Label><Input type="number" value={form.bags} onChange={(e) => set("bags", e.target.value)} placeholder="0" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label>Freight (Rs)</Label><Input type="number" value={form.freight} onChange={(e) => set("freight", e.target.value)} placeholder="0" /></div>
              <div><Label>Rent (Rs)</Label><Input type="number" value={form.rent} onChange={(e) => set("rent", e.target.value)} placeholder="0" /></div>
              <div><Label>Rate</Label><Input type="number" value={form.rate} onChange={(e) => set("rate", e.target.value)} placeholder="0" /></div>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" /></div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1" disabled={saving}>Cancel</Button>
              <Button onClick={handleCreate} className="flex-1" disabled={saving}>{saving ? "Saving..." : "Create Slip"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
