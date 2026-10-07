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
import { billCSS, billFontLink, buildPrintHeader, escapeHtml } from "@/lib/print-utils"
import { recordCode } from "@/lib/record-code"
import { Plus, Minus, Search, Package, AlertTriangle, Edit, Trash2, Tag, ChevronDown, ChevronUp, ChevronRight, X, Printer, PlusCircle, History } from "lucide-react"
import { StockHistory } from "@/components/stock-history"

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [rooms, setRooms] = useState<any[]>([])
  const [form, setForm] = useState({
    name: "", categoryId: "", roomId: "", unit: "KG", currentStock: "",
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
  const [categoryFilter, setCategoryFilter] = useState("all")
  // Quick stock add / remove
  const [stockTarget, setStockTarget] = useState<any>(null)
  const [stockRoom, setStockRoom] = useState<{ name: string; items: any[] } | null>(null)
  const [stockQty, setStockQty] = useState("")
  const [stockMode, setStockMode] = useState<"INCREASE" | "DECREASE">("INCREASE")
  const [stockRate, setStockRate] = useState("")
  const [stockReason, setStockReason] = useState("")
  const [stockSaving, setStockSaving] = useState(false)
  // Stock history dialog: null = closed, "" = all products, otherwise one product id
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  // Products whose ledger is expanded inline under their row; bumped after stock changes to refetch
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [ledgerVersion, setLedgerVersion] = useState(0)

  async function loadData() {
    try {
      setLoading(true)
      const [pr, cr, rr, shr] = await Promise.all([
        // no-store: the API sends a short browser cache, which would hide stock changes made on this page
        fetch("/api/inventory", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/categories").then((r) => r.json()),
        fetch("/api/rooms").then((r) => r.json()),
        fetch("/api/settings").then((r) => r.json()),
      ])
      setProducts(pr.products || [])
      setLedgerVersion((v) => v + 1)
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
    setForm({ name: "", categoryId: "", roomId: "", unit: "KG", currentStock: "", minStock: "0", purchasePrice: "0", salePrice: "0" })
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
        currentStock: parseFloat(form.currentStock) || 0,
        minStock: parseFloat(form.minStock) || 0,
        purchasePrice: parseFloat(form.purchasePrice),
        salePrice: parseFloat(form.salePrice),
      }),
    })
    if (res.ok) {
      const d = await res.json().catch(() => ({}))
      setShowModal(false); loadData()
      if (!editing && d?.product?.id) alert(`Product added. ID: ${recordCode("product", d.product)}`)
    }
  }

  // Default price: purchase price when adding, sale price when removing
  const defaultRate = (p: any, mode: "INCREASE" | "DECREASE") => {
    const v = mode === "INCREASE" ? p?.purchasePrice : p?.salePrice
    return v ? String(v) : ""
  }

  function openStock(p: any) {
    setStockRoom(null); setStockTarget(p); setStockQty(""); setStockReason("")
    setStockMode("INCREASE"); setStockRate(defaultRate(p, "INCREASE"))
  }

  // Opened from a room heading: pick which product in that room to adjust
  function openRoomStock(g: { name: string; items: any[] }) {
    setStockRoom(g); setStockTarget(g.items[0]); setStockQty(""); setStockReason("")
    setStockMode("INCREASE"); setStockRate(defaultRate(g.items[0], "INCREASE"))
  }

  function switchStockMode(mode: "INCREASE" | "DECREASE") {
    setStockMode(mode); setStockRate(defaultRate(stockTarget, mode))
  }

  function closeStock() {
    setStockTarget(null); setStockRoom(null)
  }

  async function adjustStock(type: "INCREASE" | "DECREASE") {
    const qty = parseFloat(stockQty)
    if (!stockTarget || !(qty > 0)) return alert("Enter a quantity greater than 0")
    if (type === "DECREASE" && qty > stockTarget.currentStock) {
      if (!confirm(`Only ${stockTarget.currentStock} ${stockTarget.unit} in stock. Remove ${qty} anyway?`)) return
    }
    setStockSaving(true)
    try {
      const res = await fetch("/api/warehouse/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: stockTarget.id, type, quantity: qty, rate: stockRate, reason: stockReason.trim() || "Store quick adjust" }),
      })
      if (!res.ok) return alert("Failed to update stock")
      // Show the new stock right away, then reload to stay in sync
      const delta = type === "DECREASE" ? -qty : qty
      setProducts((prev) => prev.map((p) => (p.id === stockTarget.id ? { ...p, currentStock: p.currentStock + delta } : p)))
      closeStock()
      loadData()
    } finally {
      setStockSaving(false)
    }
  }

  function toggleLedger(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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

  // Stock report in the same Urdu bill layout as Bill Maker, one section per room.
  function printAllStock() {
    const e = (v: unknown) => escapeHtml(v ?? "—")
    const n = (v: number) => (v || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })
    const day = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "numeric", year: "2-digit" })
    const totalValue = filtered.reduce((s, p) => s + p.currentStock * p.purchasePrice, 0)
    const lowCount = filtered.filter((p) => p.currentStock <= p.minStock).length

    const sections = groupByRoom(filtered).map((g) => {
      const groupValue = g.items.reduce((s, p) => s + p.currentStock * p.purchasePrice, 0)
      const rows = g.items.map((p, i) => {
        const isLow = p.currentStock <= p.minStock
        return `<tr${isLow ? ' style="background:#fef2f2"' : ""}>
        <td>${i + 1}</td>
        <td>${recordCode("product", p)}</td>
        <td style="font-family:inherit">${e(p.name)}</td>
        <td style="font-family:inherit">${e(p.category?.name)}</td>
        <td${isLow ? ' style="color:#b91c1c;font-weight:700"' : ""}>${n(p.currentStock)} ${e(p.unit)}</td>
        <td>${n(p.purchasePrice)}</td>
        <td>${n(p.salePrice)}</td>
        <td>${n(p.purchaseAmount || 0)}</td>
        <td>${n(p.currentStock * p.purchasePrice)}</td>
        <td style="font-family:inherit">${isLow ? "کم اسٹاک" : "دستیاب"}</td>
      </tr>`
      }).join("")
      return `<div class="section">${e(g.name)} <small>— <span class="num">${g.items.length}</span> اشیاء · مقدار: <span class="num">${e(qtyByUnit(g.items))}</span></small></div>
<table>
  <thead><tr><th>#</th><th>آئی ڈی</th><th>جنس</th><th>کیٹیگری</th><th>اسٹاک</th><th>خرید ریٹ</th><th>فروخت ریٹ</th><th>کل خرید رقم</th><th>مالیت</th><th>حالت</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr><td colspan="7" style="font-family:inherit">میزان</td><td>${n(g.items.reduce((s, p) => s + (p.purchaseAmount || 0), 0))}</td><td>${n(groupValue)}</td><td></td></tr></tfoot>
</table>`
    }).join("")

    const filterLine = [roomFilterLabel && `کمرہ: ${e(roomFilterLabel)}`, categoryFilterLabel && `کیٹیگری: ${e(categoryFilterLabel)}`].filter(Boolean).join(" · ")
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<html dir="rtl"><head><title>Store Stock Report</title>
${billFontLink}
<style>${billCSS} body { max-width: 1000px; }</style></head><body>
<div dir="ltr">${buildPrintHeader(shop)}</div>
<div class="meta">
  <div>اسٹور اسٹاک رپورٹ${filterLine ? ` — <span style="font-size:12px">${filterLine}</span>` : ""}</div>
  <div>تاریخ: <b>${day}</b></div>
</div>
${sections || '<p style="text-align:center;color:#9ca3af;padding:20px">کوئی جنس نہیں۔</p>'}
<div class="sum">
  <div><span>کل اشیاء</span><span class="num">${filtered.length}</span></div>
  <div><span>کل مقدار</span><span class="num">${e(qtyByUnit(filtered))}</span></div>
  <div><span>کم اسٹاک</span><span class="num">${lowCount}</span></div>
  <div class="grand"><span>کل مالیت</span><span class="num">Rs ${n(totalValue)}</span></div>
</div>
<div class="sig"><span>دستخط: ____________</span><span>${e(shop?.name || "")}</span></div>
<script>document.fonts.ready.then(() => window.print())<\/script>
</body></html>`)
    w.document.close()
  }

  const filtered = products.filter((p) => {
    if (roomFilter === "unassigned" ? p.roomId : roomFilter !== "all" && p.roomId !== roomFilter) return false
    if (categoryFilter === "none" ? p.categoryId : categoryFilter !== "all" && p.categoryId !== categoryFilter) return false
    const q = search.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      (p.category?.name || "").toLowerCase().includes(q) ||
      (p.room?.name || "").toLowerCase().includes(q)
    )
  })

  const roomFilterLabel =
    roomFilter === "all" ? "" : roomFilter === "unassigned" ? "Unassigned" : rooms.find((r) => r.id === roomFilter)?.name || ""
  const categoryFilterLabel =
    categoryFilter === "all" ? "" : categoryFilter === "none" ? "No category" : categories.find((c) => c.id === categoryFilter)?.name || ""

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

  // Stock total per unit, e.g. "120 KG · 40 Bag"
  function qtyByUnit(list: any[]) {
    const totals = new Map<string, number>()
    for (const p of list) totals.set(p.unit, (totals.get(p.unit) || 0) + (p.currentStock || 0))
    return Array.from(totals.entries()).map(([u, q]) => `${q.toLocaleString("en-PK", { maximumFractionDigits: 2 })} ${u}`).join(" · ") || "0"
  }

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
          <Button variant="outline" onClick={() => setHistoryFor("")} className="gap-2">
            <History className="w-4 h-4" /> Stock History
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

      {/* Category totals by room */}
      {categoryFilter !== "all" && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-gray-800 mb-3">
              {categoryFilterLabel} — stock by room
              <span className="ml-2 font-normal text-gray-500">Total: {qtyByUnit(filtered)}</span>
            </p>
            {roomGroups.length === 0 ? (
              <p className="text-sm text-gray-400">No products in this category</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {roomGroups.map((g) => (
                  <button
                    key={g.name}
                    type="button"
                    onClick={() => {
                      const r = rooms.find((x) => x.name === g.name)
                      setRoomFilter(g.name === "Unassigned" ? "unassigned" : r?.id || "all")
                    }}
                    className="text-left rounded-lg border border-purple-200 bg-purple-50 p-3 hover:border-purple-400 transition-colors"
                  >
                    <p className="text-xs text-purple-600 font-medium">{g.name}</p>
                    <p className="text-lg font-bold text-purple-900 tabular-nums">{qtyByUnit(g.items)}</p>
                    <p className="text-[11px] text-gray-500">{g.items.length} product{g.items.length > 1 ? "s" : ""}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search product, category, room..."
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
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "all")}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom">
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
                <SelectItem value="none">No category</SelectItem>
              </SelectContent>
            </Select>
            {(roomFilter !== "all" || categoryFilter !== "all" || search) && (
              <Button variant="ghost" size="sm" onClick={() => { setRoomFilter("all"); setCategoryFilter("all"); setSearch("") }} className="gap-1 text-gray-500">
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
                    {["Product", "Category", "Stock", "Unit", "Purchase Price", "Sale Price", "Purchase Amount", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left py-3 px-3 text-gray-500 font-medium" title={h === "Purchase Amount" ? "Total spent on this product: opening stock, purchases and stock added (at the price entered)" : undefined}>{h}</th>
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
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span>
                                {g.name} <span className="text-purple-500 font-normal">({g.items.length})</span>
                                <span className="ml-3 text-xs font-normal text-purple-700">Qty: {qtyByUnit(g.items)}</span>
                                <span className="ml-3 text-xs font-normal text-purple-700">
                                  Purchase amount: <span className="font-semibold">{formatCurrency(g.items.reduce((s, p) => s + (p.purchaseAmount || 0), 0))}</span>
                                </span>
                              </span>
                              <button
                                onClick={() => openRoomStock(g)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-white text-purple-700 border border-purple-300 rounded hover:bg-purple-100"
                              >
                                <Plus className="w-3 h-3" />/<Minus className="w-3 h-3" /> Add / Remove qty
                              </button>
                            </div>
                          </td>
                        </tr>
                        {g.items.map((p) => (
                          <Fragment key={p.id}>
                          <tr className={`border-b border-gray-50 hover:bg-blue-50 ${expanded.has(p.id) ? "bg-blue-50/60" : ""}`}>
                            <td className="py-3 px-3 font-medium text-gray-800">
                              <div className="flex items-start gap-1.5">
                                <button
                                  onClick={() => toggleLedger(p.id)}
                                  className="mt-0.5 p-0.5 rounded text-gray-400 hover:text-purple-700 hover:bg-purple-100"
                                  title={expanded.has(p.id) ? "Hide ledger" : "Show ledger"}
                                >
                                  {expanded.has(p.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                <div>{p.name}<div className="font-mono text-[11px] text-purple-700 font-normal">{recordCode("product", p)}</div></div>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-gray-600">{p.category?.name}</td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className={p.currentStock <= p.minStock ? "text-red-600 font-semibold" : "text-gray-700"}>
                                  {p.currentStock}
                                </span>
                                <button onClick={() => openStock(p)} className="p-0.5 text-purple-500 hover:text-purple-700" title="Add / remove quantity">
                                  <PlusCircle className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-gray-500">{p.unit}</td>
                            <td className="py-3 px-3 text-gray-700">{formatCurrency(p.purchasePrice)}</td>
                            <td className="py-3 px-3 text-gray-700">{formatCurrency(p.salePrice)}</td>
                            <td className="py-3 px-3 font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(p.purchaseAmount || 0)}</td>
                            <td className="py-3 px-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${p.currentStock <= p.minStock ? "bg-red-100 text-red-700" : "bg-green-100 text-purple-700"}`}>
                                {p.currentStock <= p.minStock ? "Low Stock" : "In Stock"}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <button onClick={() => setHistoryFor(p.id)} className="p-1 text-gray-400 hover:text-purple-600" title="Stock history">
                                  <History className="w-4 h-4" />
                                </button>
                                <button onClick={() => openEdit(p)} className="p-1 text-gray-400 hover:text-blue-600">
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(p.id)} className="p-1 text-gray-400 hover:text-red-600">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expanded.has(p.id) && (
                            <tr className="border-b border-purple-100">
                              <td colSpan={9} className="p-0">
                                <ProductLedger product={p} version={ledgerVersion} onFullHistory={() => setHistoryFor(p.id)} />
                              </td>
                            </tr>
                          )}
                          </Fragment>
                        ))}
                        <tr className="border-b border-gray-100 bg-gray-50/60">
                          <td colSpan={6} className="py-2 px-3 text-right text-xs font-medium text-gray-500">
 subtotal ({g.items.length} product{g.items.length > 1 ? "s" : ""})
                          </td>
                          <td className="py-2 px-3 text-xs font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(g.items.reduce((s, p) => s + (p.purchaseAmount || 0), 0))}</td>
                          <td colSpan={2} className="py-2 px-3 text-xs text-gray-600 whitespace-nowrap">Stock value: <span className="font-semibold text-gray-700">{formatCurrency(groupValue)}</span></td>
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

      <StockHistory
        open={historyFor !== null}
        onClose={() => setHistoryFor(null)}
        products={products}
        productId={historyFor || ""}
        shop={shop}
        onChanged={loadData}
      />

      {/* Quick stock add / remove */}
      <Dialog open={!!stockTarget} onOpenChange={(o) => { if (!o) closeStock() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add / Remove Quantity{stockRoom ? ` — ${stockRoom.name}` : ""}</DialogTitle>
          </DialogHeader>
          {stockTarget && (
            <div className="space-y-4">
              {stockRoom && stockRoom.items.length > 1 && (
                <div>
                  <Label>Product</Label>
                  <select
                    value={stockTarget.id}
                    onChange={(e) => {
                      const p = stockRoom.items.find((x) => x.id === e.target.value) || stockTarget
                      setStockTarget(p); setStockRate(defaultRate(p, stockMode))
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  >
                    {stockRoom.items.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.currentStock} {p.unit})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="bg-purple-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between gap-2"><span className="text-gray-500">Product</span><span className="font-medium">{stockTarget.name}</span></div>
                <div className="flex justify-between gap-2"><span className="text-gray-500">Room</span><span>{stockTarget.room?.name || "Unassigned"}</span></div>
                <div className="flex justify-between gap-2"><span className="text-gray-500">Current stock</span><span className="font-bold">{stockTarget.currentStock} {stockTarget.unit}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => switchStockMode("INCREASE")}
                  className={`flex items-center justify-center gap-1 rounded-md border py-2 text-sm font-medium ${stockMode === "INCREASE" ? "bg-green-600 border-green-600 text-white" : "border-gray-300 text-gray-600"}`}>
                  <Plus className="w-4 h-4" /> Add
                </button>
                <button type="button" onClick={() => switchStockMode("DECREASE")}
                  className={`flex items-center justify-center gap-1 rounded-md border py-2 text-sm font-medium ${stockMode === "DECREASE" ? "bg-red-600 border-red-600 text-white" : "border-gray-300 text-gray-600"}`}>
                  <Minus className="w-4 h-4" /> Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantity ({stockTarget.unit})</Label>
                  <Input type="number" autoFocus value={stockQty} onChange={(e) => setStockQty(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label>{stockMode === "INCREASE" ? "Purchase price" : "Sale price"} / {stockTarget.unit}</Label>
                  <Input type="number" value={stockRate} onChange={(e) => setStockRate(e.target.value)} placeholder="0" />
                </div>
              </div>
              {(() => {
                const qty = parseFloat(stockQty) || 0
                const total = qty * (parseFloat(stockRate) || 0)
                const add = stockMode === "INCREASE"
                return (
                  <div className={`rounded-lg p-3 text-sm space-y-1 ${add ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-600">{add ? "Total purchase value" : "Total sale value"}</span>
                      <span className={`font-bold ${add ? "text-green-800" : "text-red-800"}`}>{formatCurrency(total)}</span>
                    </div>
                    {qty > 0 && (
                      <div className="flex justify-between gap-2 text-xs text-gray-500">
                        <span>Stock after {add ? "adding" : "removing"}</span>
                        <span className="font-semibold text-gray-700">{stockTarget.currentStock + (add ? qty : -qty)} {stockTarget.unit}</span>
                      </div>
                    )}
                  </div>
                )
              })()}
              <div>
                <Label>Note (optional)</Label>
                <Input value={stockReason} onChange={(e) => setStockReason(e.target.value)} placeholder="e.g. new arrival, damaged" />
              </div>
              <Button
                className={`w-full gap-1 ${stockMode === "DECREASE" ? "bg-red-600 hover:bg-red-700" : ""}`}
                disabled={stockSaving}
                onClick={() => adjustStock(stockMode)}
              >
                {stockMode === "INCREASE" ? <><Plus className="w-4 h-4" /> Add to stock</> : <><Minus className="w-4 h-4" /> Remove from stock</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                {!editing && (
                  <div>
                    <Label className="text-xs font-semibold text-gray-600">Stock Qty</Label>
                    <Input type="number" className="mt-1" placeholder="0" value={form.currentStock}
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


const LEDGER_TYPE: Record<string, { label: string; color: string }> = {
  OPENING: { label: "Opening", color: "bg-gray-100 text-gray-700" },
  PURCHASE: { label: "Purchase", color: "bg-blue-100 text-blue-700" },
  SALE: { label: "Sale", color: "bg-orange-100 text-orange-700" },
  ADD: { label: "Added", color: "bg-green-100 text-green-700" },
  REMOVE: { label: "Removed", color: "bg-red-100 text-red-700" },
}

// One product's stock ledger, shown under its row: every add / remove with price, amount and stock after it.
function ProductLedger({ product, version, onFullHistory }: { product: any; version: number; onFullHistory: () => void }) {
  const [entries, setEntries] = useState<any[] | null>(null)

  useEffect(() => {
    fetch(`/api/inventory/history?productId=${product.id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEntries(d.entries || []))
      .catch(() => setEntries([]))
  }, [product.id, version])

  if (entries === null) return <div className="px-6 py-4 text-xs text-gray-400">Loading ledger...</div>

  // API returns newest first; a ledger reads oldest first
  const rows = [...entries].reverse()
  const qty = (v: number) => v.toLocaleString("en-PK", { maximumFractionDigits: 2 })
  const totalIn = rows.filter((e) => e.qty > 0)
  const totalOut = rows.filter((e) => e.qty < 0)

  return (
    <div className="bg-purple-50/40 px-4 py-3 sm:pl-10">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <p className="text-xs font-semibold text-purple-800">
          Ledger — {product.name} <span className="font-normal text-gray-500">({rows.length} entries)</span>
        </p>
        <button onClick={onFullHistory} className="inline-flex items-center gap-1 text-xs text-purple-700 hover:text-purple-900 font-medium">
          <History className="w-3.5 h-3.5" /> Full history / print
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">No stock entries yet</p>
      ) : (
        <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-md border border-purple-100 bg-white">
          <table className="w-full text-xs">
            <thead className="bg-purple-50 sticky top-0">
              <tr className="text-gray-500">
                <th className="text-left py-2 px-3 font-medium">Date</th>
                <th className="text-left py-2 px-3 font-medium">Type</th>
                <th className="text-left py-2 px-3 font-medium">Detail</th>
                <th className="text-right py-2 px-3 font-medium">In</th>
                <th className="text-right py-2 px-3 font-medium">Out</th>
                <th className="text-right py-2 px-3 font-medium">Price / {product.unit}</th>
                <th className="text-right py-2 px-3 font-medium">Amount</th>
                <th className="text-right py-2 px-3 font-medium">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((e) => {
                const t = LEDGER_TYPE[e.type] || { label: e.type, color: "bg-gray-100 text-gray-700" }
                return (
                  <tr key={`${e.type}-${e.id}`}>
                    <td className="py-1.5 px-3 text-gray-600 whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="py-1.5 px-3"><span className={`px-1.5 py-0.5 rounded font-semibold ${t.color}`}>{t.label}</span></td>
                    <td className="py-1.5 px-3 text-gray-600">{[e.ref, e.party, e.note].filter(Boolean).join(" · ")}</td>
                    <td className="py-1.5 px-3 text-right text-green-700">{e.qty > 0 ? qty(e.qty) : "—"}</td>
                    <td className="py-1.5 px-3 text-right text-red-600">{e.qty < 0 ? qty(-e.qty) : "—"}</td>
                    <td className="py-1.5 px-3 text-right text-gray-700">{e.rate ? formatCurrency(e.rate) : "—"}</td>
                    <td className="py-1.5 px-3 text-right font-medium text-gray-800">{e.amount ? formatCurrency(e.amount) : "—"}</td>
                    <td className="py-1.5 px-3 text-right font-semibold text-gray-900">{e.balance != null ? `${qty(e.balance)} ${product.unit}` : ""}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-purple-50 font-semibold">
              <tr>
                <td colSpan={3} className="py-2 px-3 text-gray-700">Total</td>
                <td className="py-2 px-3 text-right text-green-700">{qty(totalIn.reduce((s, e) => s + e.qty, 0))}</td>
                <td className="py-2 px-3 text-right text-red-600">{qty(totalOut.reduce((s, e) => s - e.qty, 0))}</td>
                <td />
                <td className="py-2 px-3 text-right text-gray-800" title="Value of stock added">{formatCurrency(totalIn.reduce((s, e) => s + e.amount, 0))}</td>
                <td className="py-2 px-3 text-right text-gray-900">{qty(product.currentStock)} {product.unit}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
