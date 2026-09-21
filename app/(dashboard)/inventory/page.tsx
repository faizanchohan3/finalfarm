"use client"

import { Fragment, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatDate } from "@/lib/utils"
import { buildPrintHeader, reportCSS } from "@/lib/print-utils"
import { Plus, Search, Package, AlertTriangle, Edit, Trash2, Tag, ChevronDown, ChevronUp, X, Printer } from "lucide-react"

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [rooms, setRooms] = useState<any[]>([])
  const [form, setForm] = useState({
    name: "", categoryId: "", roomId: "", unit: "KG", currentStock: "0",
    minStock: "0", purchasePrice: "0", salePrice: "0",
  })
  const [showCategories, setShowCategories] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [catSaving, setCatSaving] = useState(false)
  const [showRooms, setShowRooms] = useState(false)
  const [newRoomName, setNewRoomName] = useState("")
  const [roomSaving, setRoomSaving] = useState(false)
  const [shop, setShop] = useState<any>(null)
  const [categorySearch, setCategorySearch] = useState("")
  const [roomSearch, setRoomSearch] = useState("")
  const [roomFilter, setRoomFilter] = useState("all")

  async function loadData() {
    try {
      setLoading(true)
      const [pr, cr, rr, shr] = await Promise.all([
        fetch("/api/inventory").then((r) => r.json()),
        fetch("/api/categories").then((r) => r.json()),
        fetch("/api/rooms").then((r) => r.json()),
        fetch("/api/settings").then((r) => r.json()),
      ])
      setProducts(pr.products || [])
      setCategories(cr.categories || [])
      setRooms(rr.rooms || [])
      setShop(shr.shop || null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  function openAdd() {
    setEditing(null)
    setForm({ name: "", categoryId: "", roomId: "", unit: "KG", currentStock: "0", minStock: "0", purchasePrice: "0", salePrice: "0" })
    setShowModal(true)
  }

  function openEdit(p: any) {
    setEditing(p)
    setForm({
      name: p.name, categoryId: p.categoryId, roomId: p.roomId || "", unit: p.unit,
      currentStock: String(p.currentStock), minStock: String(p.minStock),
      purchasePrice: String(p.purchasePrice), salePrice: String(p.salePrice),
    })
    setShowModal(true)
  }

  async function handleSave() {
    const url = editing ? `/api/inventory/${editing.id}` : "/api/inventory"
    const method = editing ? "PUT" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        currentStock: parseFloat(form.currentStock),
        minStock: parseFloat(form.minStock),
        purchasePrice: parseFloat(form.purchasePrice),
        salePrice: parseFloat(form.salePrice),
      }),
    })
    if (res.ok) { setShowModal(false); loadData() }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this product?")) return
    await fetch(`/api/inventory/${id}`, { method: "DELETE" })
    loadData()
  }

  async function addCategory() {
    if (!newCatName.trim()) return
    setCatSaving(true)
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName.trim() }),
    })
    setNewCatName("")
    setCatSaving(false)
    loadData()
  }

  async function deleteCategory(id: string) {
    if (!confirm("Delete this category? Products in this category will lose their category.")) return
    await fetch(`/api/categories/${id}`, { method: "DELETE" })
    loadData()
  }

  async function addRoom() {
    if (!newRoomName.trim()) return
    setRoomSaving(true)
    await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRoomName.trim() }),
    })
    setNewRoomName("")
    setRoomSaving(false)
    loadData()
  }

  async function deleteRoom(id: string) {
    if (!confirm("Delete this room? Products in this room will move to Unassigned.")) return
    await fetch(`/api/rooms/${id}`, { method: "DELETE" })
    loadData()
  }

  function printAllStock() {
    const date = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
    const totalValue = filtered.reduce((s, p) => s + p.currentStock * p.purchasePrice, 0)
    let idx = 0
    const rows = groupByRoom(filtered).map((g) => {
      const groupValue = g.items.reduce((s, p) => s + p.currentStock * p.purchasePrice, 0)
      const itemRows = g.items.map((p) => {
        idx++
        const isLow = p.currentStock <= p.minStock
        return `<tr style="${isLow ? "background:#fef2f2;" : idx % 2 === 0 ? "background:#f9fdf9;" : ""}">
        <td>${idx}</td>
        <td><strong>${p.name}</strong></td>
        <td>${p.category?.name || "—"}</td>
        <td style="text-align:right;${isLow ? "color:#b91c1c;font-weight:700;" : ""}">${p.currentStock}</td>
        <td>${p.unit}</td>
        <td style="text-align:right">${p.minStock}</td>
        <td style="text-align:right">PKR ${(p.purchasePrice || 0).toLocaleString()}</td>
        <td style="text-align:right">PKR ${(p.salePrice || 0).toLocaleString()}</td>
        <td style="text-align:right">PKR ${(p.currentStock * p.purchasePrice).toLocaleString()}</td>
        <td style="text-align:center"><span style="font-size:10px;padding:2px 8px;border-radius:99px;background:${isLow ? "#fee2e2" : "#dcfce7"};color:${isLow ? "#b91c1c" : "#15803d"};font-weight:600">${isLow ? "Low Stock" : "In Stock"}</span></td>
      </tr>`
      }).join("")
      return `<tr style="background:#f5f3ff">
        <td colspan="10" style="font-weight:800;color:#5b21b6;padding:6px 8px">${g.name} (${g.items.length})</td>
      </tr>${itemRows}<tr style="background:#faf9fc">
        <td colspan="8" style="text-align:right;font-weight:600;color:#6b7280">${g.name} subtotal (${g.items.length} product${g.items.length > 1 ? "s" : ""})</td>
        <td style="text-align:right;font-weight:700">PKR ${groupValue.toLocaleString()}</td>
        <td></td>
      </tr>`
    }).join("")
    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>Store Stock Report</title>
<style>${reportCSS}
  body { max-width: 960px; margin: 0 auto; }
  .section-title { font-size:13px; font-weight:800; color:#1e3a5f; margin-bottom:10px; padding-bottom:6px; border-bottom:2px solid #1e3a5f; }
</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div><div class="doc-title">Store Stock Report</div><div class="doc-sub">${roomFilterLabel ? `Room: ${roomFilterLabel} · ` : ""}Total: ${filtered.length} products</div></div>
  <div class="doc-meta"><div>Printed: ${date}</div></div>
</div>
<div class="body-pad">
  <table>
    <thead><tr>
      <th>#</th><th>Product</th><th>Category</th>
      <th style="text-align:right">Stock</th><th>Unit</th>
      <th style="text-align:right">Min Stock</th>
      <th style="text-align:right">Purchase Price</th>
      <th style="text-align:right">Sale Price</th>
      <th style="text-align:right">Stock Value</th>
      <th style="text-align:center">Status</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="3"><strong>Total: ${filtered.length} products</strong></td>
      <td colspan="5"></td>
      <td style="text-align:right"><strong>PKR ${totalValue.toLocaleString()}</strong></td>
      <td></td>
    </tr></tfoot>
  </table>
  <div class="sig-row"><span>Generated on ${date}</span><span>${shop?.name || ""}</span></div>
</div>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`)
    w.document.close()
  }

  const filtered = products.filter((p) => {
    if (roomFilter === "unassigned" ? p.roomId : roomFilter !== "all" && p.roomId !== roomFilter) return false
    return (
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.name.toLowerCase().includes(search.toLowerCase())
    )
  })

  const roomFilterLabel =
    roomFilter === "all" ? "" : roomFilter === "unassigned" ? "Unassigned" : rooms.find((r) => r.id === roomFilter)?.name || ""

  // Group products by room; rooms alphabetical, "Unassigned" last
  function groupByRoom(list: any[]) {
    const map = new Map<string, any[]>()
    for (const p of list) {
      const key = p.room?.name || "Unassigned"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    const names = Array.from(map.keys()).filter((n) => n !== "Unassigned").sort((a, b) => a.localeCompare(b))
    const groups = names.map((n) => ({ name: n, items: map.get(n)! }))
    if (map.has("Unassigned")) groups.push({ name: "Unassigned", items: map.get("Unassigned")! })
    return groups
  }

  const roomGroups = groupByRoom(filtered)

  const lowStock = products.filter((p) => p.currentStock <= p.minStock)
  const criticalStock = products.filter((p) => p.currentStock <= 2)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Store</h2>
          <p className="text-gray-500 text-sm">{products.length} products total</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={printAllStock} className="gap-2">
            <Printer className="w-4 h-4" /> Print Stock
          </Button>
          <Button variant="outline" onClick={() => setShowCategories((v) => !v)} className="gap-2">
            <Tag className="w-4 h-4" />
            Categories ({categories.length})
            {showCategories ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="outline" onClick={() => setShowRooms((v) => !v)} className="gap-2">
            <Package className="w-4 h-4" />
            Rooms ({rooms.length})
            {showRooms ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
          <Button onClick={openAdd} className="gap-1">
            <Plus className="w-4 h-4" /> Add Product
          </Button>
        </div>
      </div>

      {/* Category Management Panel */}
      {showCategories && (
        <div className="bg-blue-50 border border-blue-300 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Tag className="w-4 h-4 text-purple-600" />
            Manage Categories
          </h3>

          {/* Add new category */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="New category name (e.g. Grains, Vegetables)"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
              className="flex-1"
            />
            <Button onClick={addCategory} disabled={catSaving || !newCatName.trim()} className="gap-1">
              <Plus className="w-4 h-4" />
              {catSaving ? "Adding..." : "Add"}
            </Button>
          </div>

          {/* Category list */}
          {categories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No categories yet. Add one above to get started.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 text-purple-800 text-sm px-3 py-1.5 rounded-full">
                  <span className="font-medium">{c.name}</span>
                  <button
                    onClick={() => deleteCategory(c.id)}
                    className="text-purple-400 hover:text-red-600 transition-colors ml-1"
                    title="Delete category"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Room Management Panel */}
      {showRooms && (
        <div className="bg-blue-50 border border-blue-300 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-purple-600" />
            Manage Rooms
          </h3>

          {/* Add new room */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="New room number/name (e.g. Room 1, Room 2)"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRoom()}
              className="flex-1"
            />
            <Button onClick={addRoom} disabled={roomSaving || !newRoomName.trim()} className="gap-1">
              <Plus className="w-4 h-4" />
              {roomSaving ? "Adding..." : "Add"}
            </Button>
          </div>

          {/* Room list */}
          {rooms.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No rooms yet. Add one above to get started.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {rooms.map((r) => (
                <div key={r.id} className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 text-purple-800 text-sm px-3 py-1.5 rounded-full">
                  <span className="font-medium">{r.name}</span>
                  <button
                    onClick={() => deleteRoom(r.id)}
                    className="text-purple-400 hover:text-red-600 transition-colors ml-1"
                    title="Delete room"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Critical Stock Alert (≤ 2 units) */}
      {criticalStock.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800 font-semibold text-sm">
              Critical Stock Alert — {criticalStock.length} product{criticalStock.length > 1 ? "s" : ""} almost out of stock!
            </p>
            <p className="text-red-600 text-xs mt-0.5">
              {criticalStock.map((p) => `${p.name} (${p.currentStock} ${p.unit} left)`).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* Low Stock Alert (below minStock, excluding critical) */}
      {lowStock.filter((p) => p.currentStock > 2).length > 0 && (
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <p className="text-blue-800 text-sm">
            <strong>{lowStock.filter((p) => p.currentStock > 2).length} products</strong> are below minimum stock levels:{" "}
            {lowStock.filter((p) => p.currentStock > 2).map((p) => p.name).join(", ")}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Products", value: products.length, icon: Package, color: "bg-blue-50 text-blue-600" },
          { label: "Low Stock", value: lowStock.length, icon: AlertTriangle, color: lowStock.length > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-purple-600" },
          { label: "Categories", value: categories.length, icon: Package, color: "bg-purple-50 text-purple-600" },
          { label: "Total Value", value: formatCurrency(products.reduce((s, p) => s + p.currentStock * p.purchasePrice, 0)), icon: Package, color: "bg-green-50 text-purple-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className={`inline-flex p-2 rounded-lg ${s.color} mb-2`}>
                <s.icon className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roomFilter} onValueChange={(v) => setRoomFilter(v ?? "all")}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Rooms" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom">
                <SelectItem value="all">All Rooms</SelectItem>
                {rooms.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
            {roomFilter !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setRoomFilter("all")} className="gap-1 text-gray-500">
                <X className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading && !products.length ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-blue-300">
                    {["Product", "Category", "Stock", "Unit", "Min Stock", "Purchase Price", "Sale Price", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left py-3 px-3 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roomGroups.map((g) => {
                    const groupValue = g.items.reduce((s, p) => s + p.currentStock * p.purchasePrice, 0)
                    return (
                      <Fragment key={g.name}>
                        <tr className="bg-purple-50 border-b border-purple-200">
                          <td colSpan={9} className="py-2 px-3 font-semibold text-purple-800">
                            {g.name} <span className="text-purple-500 font-normal">({g.items.length})</span>
                          </td>
                        </tr>
                        {g.items.map((p) => (
                          <tr key={p.id} className="border-b border-gray-50 hover:bg-blue-50">
                            <td className="py-3 px-3 font-medium text-gray-800">{p.name}</td>
                            <td className="py-3 px-3 text-gray-600">{p.category?.name}</td>
                            <td className="py-3 px-3">
                              <span className={p.currentStock <= p.minStock ? "text-red-600 font-semibold" : "text-gray-700"}>
                                {p.currentStock}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-gray-500">{p.unit}</td>
                            <td className="py-3 px-3 text-gray-600">{p.minStock}</td>
                            <td className="py-3 px-3 text-gray-700">{formatCurrency(p.purchasePrice)}</td>
                            <td className="py-3 px-3 text-gray-700">{formatCurrency(p.salePrice)}</td>
                            <td className="py-3 px-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${p.currentStock <= p.minStock ? "bg-red-100 text-red-700" : "bg-green-100 text-purple-700"}`}>
                                {p.currentStock <= p.minStock ? "Low Stock" : "In Stock"}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <button onClick={() => openEdit(p)} className="p-1 text-gray-400 hover:text-blue-600">
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(p.id)} className="p-1 text-gray-400 hover:text-red-600">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        <tr className="border-b border-gray-100 bg-gray-50/60">
                          <td colSpan={8} className="py-2 px-3 text-right text-xs font-medium text-gray-500">
                            {g.name} subtotal ({g.items.length} product{g.items.length > 1 ? "s" : ""})
                          </td>
                          <td className="py-2 px-3 text-xs font-semibold text-gray-700">{formatCurrency(groupValue)}</td>
                        </tr>
                      </Fragment>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-8 text-gray-400">No products found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="w-[96vw] max-w-2xl max-h-[92vh] overflow-y-auto p-0">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200 text-gray-900 px-6 py-4 rounded-t-2xl flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-brand-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold">{editing ? "Edit Product" : "Add Product"}</h2>
                <p className="text-gray-500 text-xs">Fill in product details and pricing</p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg p-1.5 transition-colors flex-shrink-0"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-5">

            {/* ── Section 1: Basic Info ── */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Product Info</h3>
              <div className="bg-blue-50 rounded-xl p-4 space-y-3 border border-blue-300">
              <div>
                <Label className="text-xs font-semibold text-gray-600">Product Name *</Label>
                <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Wheat, Rice, Cotton..." />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-600">Category *</Label>
                {categories.length === 0 ? (
                  <div className="mt-1 text-xs text-blue-600 bg-blue-50 border border-blue-300 rounded-lg px-3 py-2.5">
                    📂 No categories yet. Go to <strong>Categories</strong> tab above to add one.
                  </div>
                ) : (
                  <Select value={form.categoryId} onValueChange={(v) => { setForm({ ...form, categoryId: v }); setCategorySearch("") }}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent side="bottom" sideOffset={8} className="p-0">
                      <div className="sticky top-0 bg-blue-50 border-b p-2">
                        <Input placeholder="Search categories..." value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} className="h-8 text-xs" autoFocus />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {categories.filter((c: any) => c.name.toLowerCase().includes(categorySearch.toLowerCase())).length === 0 ? (
                          <div className="px-2 py-4 text-xs text-gray-500 text-center">No categories found</div>
                        ) : (
                          categories.filter((c: any) => c.name.toLowerCase().includes(categorySearch.toLowerCase())).map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))
                        )}
                      </div>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-600">Room</Label>
                {rooms.length === 0 ? (
                  <div className="mt-1 text-xs text-blue-600 bg-blue-50 border border-blue-300 rounded-lg px-3 py-2.5">
                    No rooms yet. Go to <strong>Rooms</strong> tab above to add one.
                  </div>
                ) : (
                  <Select value={form.roomId || "none"} onValueChange={(v) => { setForm({ ...form, roomId: v === "none" ? "" : v }); setRoomSearch("") }}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a room" />
                    </SelectTrigger>
                    <SelectContent side="bottom" sideOffset={8} className="p-0">
                      <div className="sticky top-0 bg-blue-50 border-b p-2">
                        <Input placeholder="Search rooms..." value={roomSearch} onChange={(e) => setRoomSearch(e.target.value)} className="h-8 text-xs" autoFocus />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        <SelectItem value="none">Unassigned</SelectItem>
                        {rooms.filter((r: any) => r.name.toLowerCase().includes(roomSearch.toLowerCase())).length === 0 ? (
                          <div className="px-2 py-4 text-xs text-gray-500 text-center">No rooms found</div>
                        ) : (
                          rooms.filter((r: any) => r.name.toLowerCase().includes(roomSearch.toLowerCase())).map((r: any) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))
                        )}
                      </div>
                    </SelectContent>
                  </Select>
                )}
              </div>
              </div>
            </div>

            {/* ── Section 2: Unit & Stock ── */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Unit & Stock</h3>
              <div className="bg-blue-50 rounded-xl p-4 space-y-3 border border-blue-300">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-600">Unit *</Label>
                  {(() => {
                    const PRESETS = ["KG", "Quintal", "Maund", "Bag", "Litre", "Piece"]
                    const isCustom = !PRESETS.includes(form.unit)
                    return (
                      <>
                        <Select
                          value={isCustom ? "Custom" : form.unit}
                          onValueChange={(v) => setForm({ ...form, unit: v === "Custom" ? "" : v })}
                        >
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent position="popper" side="bottom">
                            {PRESETS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            <SelectItem value="Custom">Custom...</SelectItem>
                          </SelectContent>
                        </Select>
                        {isCustom && (
                          <Input className="mt-2" placeholder="Enter unit..." value={form.unit}
                            onChange={(e) => setForm({ ...form, unit: e.target.value })} autoFocus />
                        )}
                      </>
                    )
                  })()}
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-600">Min Stock</Label>
                  <Input type="number" className="mt-1" value={form.minStock}
                    onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
                </div>
                {!editing && (
                  <div>
                    <Label className="text-xs font-semibold text-gray-600">Opening Stock</Label>
                    <Input type="number" className="mt-1" value={form.currentStock}
                      onChange={(e) => setForm({ ...form, currentStock: e.target.value })} />
                  </div>
                )}
              </div>
              </div>
            </div>

            {/* ── Section 3: Pricing ── */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Pricing</h3>
              <div className="bg-blue-50 rounded-xl p-4 space-y-3 border border-blue-300">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-600">Purchase Price (PKR)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">PKR</span>
                    <Input type="number" className="pl-9" value={form.purchasePrice}
                      onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-600">Sale Price (PKR)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">PKR</span>
                    <Input type="number" className="pl-9" value={form.salePrice}
                      onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
                  </div>
                </div>
              </div>
              </div>
            </div>

            {/* ── Action Buttons ── */}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2">
                <Package className="w-4 h-4" />
                {editing ? "Update Product" : "Add Product"}
              </Button>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

