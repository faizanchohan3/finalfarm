"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Plus, Boxes, User, Warehouse as WarehouseIcon, Settings2, XCircle } from "lucide-react"

const STATUSES = ["ARRIVED", "WEIGHED", "STORED", "AVAILABLE", "IN_AUCTION", "SOLD", "DISPATCHED", "SETTLED", "CANCELLED"] as const

const STATUS_COLORS: Record<string, string> = {
  ARRIVED: "bg-blue-100 text-blue-700",
  WEIGHED: "bg-indigo-100 text-indigo-700",
  STORED: "bg-amber-100 text-amber-700",
  AVAILABLE: "bg-teal-100 text-teal-700",
  IN_AUCTION: "bg-purple-100 text-purple-700",
  SOLD: "bg-green-100 text-green-700",
  DISPATCHED: "bg-cyan-100 text-cyan-700",
  SETTLED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
}
const PAY_COLORS: Record<string, string> = {
  PENDING: "text-amber-600", PARTIAL: "text-blue-600", PAID: "text-green-600", CANCELLED: "text-red-500",
}

const EMPTY = { farmerId: "", commodityId: "", warehouseId: "", bags: "", grossWeight: "", tareWeight: "", grade: "", notes: "" }

export default function LotsPage() {
  const [lots, setLots] = useState<any[]>([])
  const [farmers, setFarmers] = useState<any[]>([])
  const [commodities, setCommodities] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [buyers, setBuyers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("ALL")

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [manage, setManage] = useState<any | null>(null)
  const [mStatus, setMStatus] = useState("")
  const [mBuyer, setMBuyer] = useState("")
  const [mRate, setMRate] = useState("")
  const [mPay, setMPay] = useState("PENDING")

  async function loadLots() {
    setLoading(true)
    try {
      const res = await fetch(`/api/lots?status=${filter}`)
      const data = await res.json()
      setLots(data.lots || [])
    } catch { setLots([]) }
    setLoading(false)
  }

  async function loadRefs() {
    const [f, c, w, b] = await Promise.all([
      fetch("/api/farmers").then((r) => r.json()).catch(() => ({})),
      fetch("/api/commodities").then((r) => r.json()).catch(() => ({})),
      fetch("/api/warehouse").then((r) => r.json()).catch(() => ({})),
      fetch("/api/customers").then((r) => r.json()).catch(() => ({})),
    ])
    setFarmers(f.farmers || [])
    setCommodities(c.commodities || [])
    setWarehouses(w.warehouses || [])
    setBuyers(b.customers || [])
  }

  useEffect(() => { loadRefs() }, [])
  useEffect(() => { loadLots() }, [filter])

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const netPreview = (() => {
    const g = parseFloat(form.grossWeight); const t = parseFloat(form.tareWeight) || 0
    return isNaN(g) ? null : g - t
  })()

  async function handleCreate() {
    if (!form.commodityId) { setError("Please select a commodity."); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/lots", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d?.error || "Failed to create lot.")
      } else {
        setForm({ ...EMPTY }); setShowCreate(false); loadLots()
      }
    } catch { setError("Network error. Please try again.") }
    setSaving(false)
  }

  function openManage(lot: any) {
    setManage(lot)
    setMStatus(lot.status)
    setMBuyer(lot.buyer?.id || "")
    setMRate(lot.saleRate != null ? String(lot.saleRate) : "")
    setMPay(lot.paymentStatus || "PENDING")
  }

  const isSaleStage = ["SOLD", "DISPATCHED", "SETTLED"].includes(mStatus)

  async function saveManage() {
    if (!manage) return
    setSaving(true)
    const payload: any = { status: mStatus }
    if (isSaleStage) {
      payload.buyerId = mBuyer || null
      payload.saleRate = mRate
      payload.paymentStatus = mPay
    }
    await fetch(`/api/lots/${manage.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    })
    setManage(null); setSaving(false); loadLots()
  }

  async function cancelLot(lot: any) {
    if (!confirm(`Cancel ${lot.lotNo}? Its status will be set to CANCELLED.`)) return
    await fetch(`/api/lots/${lot.id}`, { method: "DELETE" })
    loadLots()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-purple-600" /> Lots
          </h2>
          <p className="text-gray-500 text-sm">Track each lot from arrival through sale and settlement</p>
        </div>
        <Button className="gap-2" onClick={() => { setForm({ ...EMPTY }); setError(null); setShowCreate(true) }}>
          <Plus className="w-4 h-4" /> New Lot
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {["ALL", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
              filter === s ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "ALL" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading lots...</div>
      ) : lots.length === 0 ? (
        <Card><CardContent className="text-center py-12">
          <Boxes className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No lots{filter !== "ALL" ? ` with status ${filter.replace("_", " ")}` : ""} yet.</p>
          <p className="text-gray-400 text-sm">Create a lot when goods arrive at your mandi.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {lots.map((lot) => (
            <Card key={lot.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-gray-900">{lot.lotNo}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[lot.status]}`}>
                        {lot.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900">{lot.commodity?.name || "—"}{lot.grade ? ` · ${lot.grade}` : ""}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{lot.farmer?.name || "No farmer"}</span>
                      {lot.warehouse && <span className="flex items-center gap-1"><WarehouseIcon className="w-3.5 h-3.5" />{lot.warehouse.name}</span>}
                      {lot.netWeight != null && <span>{lot.netWeight} {lot.commodity?.unit || "KG"}</span>}
                      {lot.bags ? <span>{lot.bags} bags</span> : null}
                    </div>
                    {["SOLD", "DISPATCHED", "SETTLED"].includes(lot.status) && (
                      <p className="text-xs text-gray-600 pt-1">
                        Sold to <b>{lot.buyer?.name || "—"}</b> · {formatCurrency(lot.saleAmount || 0)} ·{" "}
                        <span className={PAY_COLORS[lot.paymentStatus]}>{lot.paymentStatus}</span>
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">{formatDate(lot.createdAt)}</p>
                    <div className="flex gap-1 justify-end mt-2">
                      {lot.status !== "CANCELLED" && (
                        <>
                          <button onClick={() => openManage(lot)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Manage">
                            <Settings2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => cancelLot(lot)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Cancel">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Lot</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Commodity *</Label>
                <Select value={form.commodityId} onValueChange={(v) => set("commodityId", v)}>
                  <SelectTrigger><SelectValue placeholder="Select commodity" /></SelectTrigger>
                  <SelectContent>
                    {commodities.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Farmer</Label>
                <Select value={form.farmerId} onValueChange={(v) => set("farmerId", v)}>
                  <SelectTrigger><SelectValue placeholder="Select farmer" /></SelectTrigger>
                  <SelectContent>
                    {farmers.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Godown</Label>
                <Select value={form.warehouseId} onValueChange={(v) => set("warehouseId", v)}>
                  <SelectTrigger><SelectValue placeholder="Select godown" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Bags</Label><Input type="number" value={form.bags} onChange={(e) => set("bags", e.target.value)} placeholder="0" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Gross wt</Label><Input type="number" value={form.grossWeight} onChange={(e) => set("grossWeight", e.target.value)} placeholder="0" /></div>
              <div><Label>Tare wt</Label><Input type="number" value={form.tareWeight} onChange={(e) => set("tareWeight", e.target.value)} placeholder="0" /></div>
              <div>
                <Label>Net wt</Label>
                <Input value={netPreview != null ? String(netPreview) : ""} readOnly placeholder="auto" className="bg-gray-50" />
              </div>
            </div>
            <div><Label>Grade / quality</Label><Input value={form.grade} onChange={(e) => set("grade", e.target.value)} placeholder="e.g. A / Fine (optional)" /></div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" /></div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1" disabled={saving}>Cancel</Button>
              <Button onClick={handleCreate} className="flex-1" disabled={saving}>{saving ? "Saving..." : "Create Lot"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage dialog */}
      <Dialog open={!!manage} onOpenChange={(o) => !o && setManage(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Manage {manage?.lotNo}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Status</Label>
              <Select value={mStatus} onValueChange={setMStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.filter((s) => s !== "CANCELLED").map((s) => (
                    <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isSaleStage && (
              <div className="space-y-3 rounded-lg border border-gray-200 p-3 bg-gray-50">
                <p className="text-xs font-medium text-gray-500">Sale details</p>
                <div>
                  <Label>Buyer (Trader)</Label>
                  <Select value={mBuyer} onValueChange={setMBuyer}>
                    <SelectTrigger><SelectValue placeholder="Select buyer" /></SelectTrigger>
                    <SelectContent>
                      {buyers.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Sale rate (per {manage?.commodity?.unit || "unit"})</Label><Input type="number" value={mRate} onChange={(e) => setMRate(e.target.value)} placeholder="0" /></div>
                  <div>
                    <Label>Payment</Label>
                    <Select value={mPay} onValueChange={setMPay}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["PENDING", "PARTIAL", "PAID"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {mRate && manage?.netWeight != null && (
                  <p className="text-xs text-gray-500">Amount ≈ <b>{formatCurrency(parseFloat(mRate) * manage.netWeight)}</b> ({manage.netWeight} × {mRate})</p>
                )}
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setManage(null)} className="flex-1" disabled={saving}>Close</Button>
              <Button onClick={saveManage} className="flex-1" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
