"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"
import { Plus, Warehouse, ArrowLeftRight, Settings2, Package, AlertTriangle } from "lucide-react"

export default function WarehousePage() {
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [transfers, setTransfers] = useState<any[]>([])
  const [adjustments, setAdjustments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"godowns" | "transfers" | "adjustments">("godowns")
  const [showWarehouseModal, setShowWarehouseModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [wForm, setWForm] = useState({ id: "", name: "", location: "", capacity: "", manager: "" })
  const [tForm, setTForm] = useState({ fromWarehouseId: "", toWarehouseId: "", productId: "", quantity: "", notes: "" })
  const [aForm, setAForm] = useState({ warehouseId: "", productId: "", type: "INCREASE", quantity: "", reason: "" })

  async function loadData() {
    setLoading(true)
    const [w, tr, adj, pr] = await Promise.all([
      fetch("/api/warehouse").then((r) => r.json()),
      fetch("/api/warehouse/transfer").then((r) => r.json()),
      fetch("/api/warehouse/adjust").then((r) => r.json()),
      fetch("/api/inventory").then((r) => r.json()),
    ])
    setWarehouses(w.warehouses || [])
    setTransfers(tr.transfers || [])
    setAdjustments(adj.adjustments || [])
    setProducts(pr.products || [])
    setLoading(false)
  }
  useEffect(() => { loadData() }, [])

  async function handleSaveWarehouse() {
    if (!wForm.name.trim()) return alert("Name required")
    const url = wForm.id ? "/api/warehouse" : "/api/warehouse"
    const method = wForm.id ? "PUT" : "POST"
    await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...wForm, capacity: wForm.capacity ? parseFloat(wForm.capacity) : null }),
    })
    setShowWarehouseModal(false); loadData()
  }

  async function handleTransfer() {
    if (!tForm.fromWarehouseId || !tForm.toWarehouseId || !tForm.productId || !tForm.quantity) return alert("All fields required")
    const res = await fetch("/api/warehouse/transfer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...tForm, quantity: parseFloat(tForm.quantity) }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      return alert(d?.error || "Failed to create transfer")
    }
    setShowTransferModal(false); loadData()
  }

  async function handleApproveTransfer(transferId: string) {
    if (!confirm("Approve this transfer? This will move stock between godowns and deduct from main inventory.")) return
    const res = await fetch("/api/warehouse/transfer", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transferId }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      return alert(d?.error || "Failed to approve transfer")
    }
    loadData()
  }

  async function handleAdjust() {
    if (!tForm.productId || !aForm.quantity) return alert("Product and quantity required")
    await fetch("/api/warehouse/adjust", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...aForm, quantity: parseFloat(aForm.quantity) }),
    })
    setShowAdjustModal(false); loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Warehouse / Godown Management</h2>
          <p className="text-gray-500 text-sm">Multi-location inventory, stock transfers & adjustments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setAForm({ warehouseId: "", productId: "", type: "INCREASE", quantity: "", reason: "" }); setShowAdjustModal(true) }} className="gap-2">
            <Settings2 className="w-4 h-4" /> Adjust Stock
          </Button>
          <Button variant="outline" onClick={() => { setTForm({ fromWarehouseId: "", toWarehouseId: "", productId: "", quantity: "", notes: "" }); setShowTransferModal(true) }} className="gap-2">
            <ArrowLeftRight className="w-4 h-4" /> Transfer
          </Button>
          <Button onClick={() => { setWForm({ id: "", name: "", location: "", capacity: "", manager: "" }); setShowWarehouseModal(true) }}
            className="bg-blue-700 hover:bg-blue-800 gap-2">
            <Plus className="w-4 h-4" /> Add Godown
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {([["godowns", "Godowns", warehouses.length], ["transfers", "Stock Transfers", transfers.length], ["adjustments", "Adjustments", adjustments.length]] as const).map(([key, label, count]) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 ${tab === key ? "border-blue-700 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {label} <span className="text-xs text-gray-400 ml-1">({count})</span>
          </button>
        ))}
      </div>

      {/* Godowns Tab */}
      {tab === "godowns" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? <p className="text-gray-400 col-span-3">Loading...</p> : warehouses.map((w) => (
            <Card key={w.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Warehouse className="w-4 h-4 text-blue-600" /> {w.name}
                  </CardTitle>
                  <button onClick={() => { setWForm({ id: w.id, name: w.name, location: w.location || "", capacity: w.capacity ? String(w.capacity) : "", manager: w.manager || "" }); setShowWarehouseModal(true) }}
                    className="text-xs text-gray-400 hover:text-blue-600">Edit</button>
                </div>
                <p className="text-xs text-gray-500">{w.location || "No location set"}</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-600 font-medium">Items</p>
                    <p className="text-xl font-bold text-blue-700">{w.totalItems}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-green-600 font-medium">Value</p>
                    <p className="text-lg font-bold text-green-700">{formatCurrency(w.totalValue)}</p>
                  </div>
                </div>
                {w.capacity && (
                  <p className="text-xs text-gray-500">Capacity: {w.capacity} units{w.manager ? ` · Manager: ${w.manager}` : ""}</p>
                )}
                {/* Stock details */}
                {w.stock?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {w.stock.slice(0, 5).map((s: any) => (
                      <div key={s.id} className="flex justify-between text-xs">
                        <span className="text-gray-600">{s.product.name}</span>
                        <span className={`font-medium ${s.quantity <= 2 ? "text-red-600" : "text-gray-700"}`}>
                          {s.quantity} {s.product.unit} {s.quantity <= 2 && <AlertTriangle className="inline w-3 h-3" />}
                        </span>
                      </div>
                    ))}
                    {w.stock.length > 5 && <p className="text-xs text-gray-400">+{w.stock.length - 5} more items</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {!loading && warehouses.length === 0 && (
            <div className="col-span-3 text-center py-12 text-gray-400">
              <Warehouse className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No warehouses yet. Add your first godown.</p>
            </div>
          )}
        </div>
      )}

      {/* Transfers Tab */}
      {tab === "transfers" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Transfer #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">From</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">To</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Qty</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transfers.map((t) => (
                    <tr key={t.id} className={`hover:bg-gray-50 ${t.status === "PENDING" ? "bg-yellow-50/40" : ""}`}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.transferNo}</td>
                      <td className="px-4 py-3 text-gray-700">{t.fromWarehouse.name}</td>
                      <td className="px-4 py-3 text-gray-700">{t.toWarehouse.name}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">{t.product.name}</td>
                      <td className="px-4 py-3 text-right font-medium">{t.quantity} {t.product.unit}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          t.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                          t.status === "APPROVED" ? "bg-green-100 text-green-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>{t.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{t.createdBy?.name}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(t.createdAt).toLocaleDateString("en-PK")}</td>
                      <td className="px-4 py-3 text-center">
                        {t.status === "PENDING" && (
                          <button
                            onClick={() => handleApproveTransfer(t.id)}
                            className="text-xs bg-green-700 hover:bg-green-800 text-white px-3 py-1 rounded font-medium"
                          >
                            Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {transfers.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No transfers yet</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Adjustments Tab */}
      {tab === "adjustments" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Adj #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Warehouse</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Reason</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {adjustments.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.adjustNo}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{a.product.name}</td>
                      <td className="px-4 py-3 text-gray-600">{a.warehouse?.name || "Main"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${a.type === "INCREASE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {a.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{a.quantity} {a.product.unit}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{a.reason || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{a.createdBy?.name}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(a.createdAt).toLocaleDateString("en-PK")}</td>
                    </tr>
                  ))}
                  {adjustments.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No adjustments yet</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Warehouse Modal */}
      <Dialog open={showWarehouseModal} onOpenChange={setShowWarehouseModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{wForm.id ? "Edit Godown" : "Add Godown"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Godown Name *</Label>
              <Input value={wForm.name} onChange={(e) => setWForm({ ...wForm, name: e.target.value })} autoFocus /></div>
            <div><Label>Location</Label>
              <Input value={wForm.location} onChange={(e) => setWForm({ ...wForm, location: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Capacity</Label>
                <Input type="number" value={wForm.capacity} onChange={(e) => setWForm({ ...wForm, capacity: e.target.value })} /></div>
              <div><Label>Manager</Label>
                <Input value={wForm.manager} onChange={(e) => setWForm({ ...wForm, manager: e.target.value })} /></div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowWarehouseModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSaveWarehouse} className="flex-1 bg-blue-700 hover:bg-blue-800">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Stock Transfer Between Godowns</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>From Godown *</Label>
              <Select value={tForm.fromWarehouseId} onValueChange={(v) => setTForm({ ...tForm, fromWarehouseId: v })}>
                <SelectTrigger><SelectValue placeholder="Select godown" /></SelectTrigger>
                <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>To Godown *</Label>
              <Select value={tForm.toWarehouseId} onValueChange={(v) => setTForm({ ...tForm, toWarehouseId: v })}>
                <SelectTrigger><SelectValue placeholder="Select godown" /></SelectTrigger>
                <SelectContent>{warehouses.filter((w) => w.id !== tForm.fromWarehouseId).map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Product *</Label>
              <Select value={tForm.productId} onValueChange={(v) => setTForm({ ...tForm, productId: v })}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Quantity *</Label>
              <Input type="number" value={tForm.quantity} onChange={(e) => setTForm({ ...tForm, quantity: e.target.value })} /></div>
            <div><Label>Notes</Label>
              <Input value={tForm.notes} onChange={(e) => setTForm({ ...tForm, notes: e.target.value })} /></div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowTransferModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleTransfer} className="flex-1">Transfer Stock</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adjust Modal */}
      <Dialog open={showAdjustModal} onOpenChange={setShowAdjustModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Stock Adjustment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Product *</Label>
              <Select value={aForm.productId} onValueChange={(v) => setAForm({ ...aForm, productId: v })}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.currentStock} {p.unit})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Godown (optional)</Label>
              <Select value={aForm.warehouseId} onValueChange={(v) => setAForm({ ...aForm, warehouseId: v })}>
                <SelectTrigger><SelectValue placeholder="Main inventory" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Main Inventory</SelectItem>
                  {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Adjustment Type</Label>
              <Select value={aForm.type} onValueChange={(v) => setAForm({ ...aForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCREASE">Increase Stock</SelectItem>
                  <SelectItem value="DECREASE">Decrease Stock</SelectItem>
                  <SelectItem value="CORRECTION">Correction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Quantity *</Label>
              <Input type="number" value={aForm.quantity} onChange={(e) => setAForm({ ...aForm, quantity: e.target.value })} /></div>
            <div><Label>Reason</Label>
              <Input value={aForm.reason} onChange={(e) => setAForm({ ...aForm, reason: e.target.value })} placeholder="Damaged, expired, recount..." /></div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowAdjustModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleAdjust} className="flex-1">Save Adjustment</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
