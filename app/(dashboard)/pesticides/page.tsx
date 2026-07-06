"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatDateDMY } from "@/lib/utils"
import { buildPrintHeader, reportCSS, receiptCSS } from "@/lib/print-utils"
import { Plus, Search, AlertTriangle, ShoppingCart, Edit, Sprout, Trash2, Tag, Printer } from "lucide-react"

export default function PesticidesPage() {
  const [pesticides, setPesticides] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [selectedPesticide, setSelectedPesticide] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<"stock" | "sales">("stock")

  const [form, setForm] = useState({
    name: "", categoryId: "", manufacturer: "", batchNumber: "",
    expiryDate: "", quantity: "0", unit: "Litre",
    purchasePrice: "0", salePrice: "0", incentive: "0", minStock: "0",
  })
  const [newCategoryName, setNewCategoryName] = useState("")

  const PRESET_UNITS = ["Litre", "ML", "KG", "Gram", "Bottle", "Bag"]

  const [saleForm, setSaleForm] = useState({ quantity: "1", customerName: "", paidAmount: "0", notes: "" })
  const [showCatModal, setShowCatModal] = useState(false)
  const [newCatInput, setNewCatInput] = useState("")
  const [shop, setShop] = useState<any>(null)
  const [isPreviousRecord, setIsPreviousRecord] = useState(false)
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0])

  async function loadData() {
    try {
      setLoading(true)
      const [pr, cr, sr, shr] = await Promise.all([
        fetch("/api/pesticides").then((r) => r.json()),
        fetch("/api/pesticide-categories").then((r) => r.json()),
        fetch("/api/pesticides/sales").then((r) => r.json()),
        fetch("/api/settings").then((r) => r.json()),
      ])
      setPesticides(pr.pesticides || [])
      setCategories(cr.categories || [])
      setSales(sr.sales || [])
      setShop(shr.shop || null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  function isoToDMY(iso: string) {
    const [y, m, d] = iso.split("-")
    return `${d}/${m}/${y}`
  }

  function dmyToIso(dmy: string) {
    const [d, m, y] = dmy.split("/")
    return y && m && d ? `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}` : ""
  }

  function openAdd() {
    setEditing(null)
    setNewCategoryName("")
    setForm({ name: "", categoryId: "", manufacturer: "", batchNumber: "", expiryDate: "", quantity: "0", unit: "Litre", purchasePrice: "0", salePrice: "0", incentive: "0", minStock: "0" })
    setShowModal(true)
  }

  function openEdit(p: any) {
    setEditing(p)
    setNewCategoryName("")
    const isoExpiry = p.expiryDate ? new Date(p.expiryDate).toISOString().split("T")[0] : ""
    const subtotal = p.quantity * p.purchasePrice
    const savedPct = subtotal > 0 ? Math.round((p.incentive / subtotal) * 10000) / 100 : 0
    setForm({
      name: p.name, categoryId: p.categoryId || "", manufacturer: p.manufacturer || "",
      batchNumber: p.batchNumber || "",
      expiryDate: isoExpiry || "",
      quantity: String(p.quantity), unit: p.unit,
      purchasePrice: String(p.purchasePrice), salePrice: String(p.salePrice), incentive: String(savedPct), minStock: String(p.minStock),
    })
    setShowModal(true)
  }

  function openSale(p: any) {
    setSelectedPesticide(p)
    setSaleForm({ quantity: "1", customerName: "", paidAmount: "0", notes: "" })
    setShowSaleModal(true)
  }

  async function handleSave() {
    let categoryId = form.categoryId
    if (form.categoryId === "new") {
      if (!newCategoryName.trim()) return alert("Enter a category name")
      const cr = await fetch("/api/pesticide-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      })
      if (!cr.ok) return alert("Failed to create category")
      const cd = await cr.json()
      categoryId = cd.category.id
    }

    const isoExpiry = form.expiryDate || ""
    const qty = parseFloat(form.quantity) || 0
    const purchasePrice = parseFloat(form.purchasePrice) || 0
    const incentivePct = parseFloat(form.incentive) || 0
    const subtotal = qty * purchasePrice
    const incentiveAmt = Math.round((subtotal * incentivePct) / 100 * 100) / 100

    const url = editing ? `/api/pesticides/${editing.id}` : "/api/pesticides"
    const method = editing ? "PUT" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        categoryId: categoryId || null,
        expiryDate: isoExpiry || null,
        quantity: qty,
        purchasePrice,
        salePrice: parseFloat(form.salePrice),
        incentive: incentiveAmt,
        minStock: parseFloat(form.minStock),
      }),
    })
    if (res.ok) { setShowModal(false); loadData() }
  }

  function printAllPesticides() {
    const date = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
    const rows = filtered.map((p, i) => {
      const isExpired = p.expiryDate && new Date(p.expiryDate) < new Date()
      const expLabel = p.expiryDate ? formatDateDMY(p.expiryDate) : "—"
      return `<tr style="${isExpired ? "background:#fee2e2;" : i % 2 === 0 ? "background:#f9fdf9;" : ""}">
        <td>${i + 1}</td>
        <td><strong>${p.name}</strong></td>
        <td>${p.category?.name || "—"}</td>
        <td>${p.quantity}</td>
        <td>${p.unit}</td>
        <td>${p.batchNumber || "—"}</td>
        <td>${expLabel}</td>
        <td style="text-align:right">PKR ${(p.purchasePrice || 0).toLocaleString()}</td>
        <td style="text-align:right">${p.incentive > 0 ? `PKR ${(p.incentive || 0).toLocaleString()}` : "—"}</td>
        <td style="text-align:right">PKR ${(p.salePrice || 0).toLocaleString()}</td>
      </tr>`
    }).join("")
    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>Pesticide Stock List</title>
<style>${reportCSS}
  body { max-width: 900px; margin: 0 auto; }
  .section-title { font-size:13px; font-weight:800; color:#14532d; margin-bottom:10px; padding-bottom:6px; border-bottom:2px solid #166534; }
</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div><div class="doc-title">Pesticide Stock List</div><div class="doc-sub">Total: ${filtered.length} products</div></div>
  <div class="doc-meta"><div>Printed: ${date}</div></div>
</div>
<div class="body-pad">
  <table>
    <thead><tr>
      <th>#</th><th>Name</th><th>Category</th><th>Qty</th><th>Unit</th><th>Batch</th><th>Expiry</th>
      <th style="text-align:right">Purchase Price</th><th style="text-align:right">Incentive</th><th style="text-align:right">Sale Price</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="4"><strong>Total Products: ${filtered.length}</strong></td>
      <td colspan="5"></td>
    </tr></tfoot>
  </table>
  <div class="sig-row"><span>Generated on ${date}</span><span>${shop?.name || ""}</span></div>
</div>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`)
    w.document.close()
  }

  function printAllCategories() {
    const date = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
    const catRows = categories.map((c, i) => {
      const count = pesticides.filter((p) => p.categoryId === c.id).length
      return `<tr style="${i % 2 === 0 ? "background:#f9fdf9;" : ""}">
        <td>${i + 1}</td>
        <td><strong>${c.name}</strong></td>
        <td style="text-align:center">${count}</td>
        <td>${pesticides.filter((p) => p.categoryId === c.id).map((p) => p.name).join(", ") || "—"}</td>
      </tr>`
    }).join("")
    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>Pesticide Categories</title>
<style>${reportCSS}
  body { max-width: 700px; margin: 0 auto; }
</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div><div class="doc-title">Pesticide Categories</div><div class="doc-sub">Total: ${categories.length} categories</div></div>
  <div class="doc-meta"><div>Printed: ${date}</div></div>
</div>
<div class="body-pad">
  <table>
    <thead><tr>
      <th>#</th><th>Category Name</th><th style="text-align:center">Products</th><th>Products List</th>
    </tr></thead>
    <tbody>${catRows}</tbody>
    <tfoot><tr>
      <td colspan="2"><strong>Total Categories: ${categories.length}</strong></td>
      <td style="text-align:center"><strong>${pesticides.length}</strong></td>
      <td></td>
    </tr></tfoot>
  </table>
  <div class="sig-row"><span>Generated on ${date}</span><span>${shop?.name || ""}</span></div>
</div>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`)
    w.document.close()
  }

  async function handleAddCategory() {
    if (!newCatInput.trim()) return
    const res = await fetch("/api/pesticide-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatInput.trim() }),
    })
    if (res.ok) { setNewCatInput(""); loadData() }
  }

  async function handleDeleteCategory(id: string, name: string) {
    if (!confirm(`Delete category "${name}"? Pesticides in this category will have no category.`)) return
    await fetch(`/api/pesticide-categories/${id}`, { method: "DELETE" })
    loadData()
  }

  function printSinglePesticide(p: any) {
    const date = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
    const expiry = p.expiryDate ? formatDateDMY(p.expiryDate) : "—"
    const isExpired = p.expiryDate && new Date(p.expiryDate) < new Date()
    const netCost = p.purchasePrice * p.quantity - (p.incentive || 0)
    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>Stock Card — ${p.name}</title>
<style>${receiptCSS}
  body { max-width: 480px; margin: 0 auto; }
  .card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
  .card-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; }
  .card-lbl { font-size: 9px; color: #9ca3af; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
  .card-val { font-size: 14px; font-weight: 800; color: #111827; margin-top: 3px; }
  .stock-banner { background: ${p.quantity <= p.minStock ? "#fee2e2" : "#f0fdf4"}; border: 1px solid ${p.quantity <= p.minStock ? "#fca5a5" : "#86efac"}; border-radius: 8px; padding: 14px 16px; text-align: center; margin-bottom: 14px; }
  .stock-qty { font-size: 28px; font-weight: 900; color: ${p.quantity <= p.minStock ? "#b91c1c" : "#15803d"}; }
  .stock-unit { font-size: 13px; color: #6b7280; margin-top: 2px; }
</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div><div class="doc-title">${p.name}</div><div class="doc-sub">${p.category?.name || "No Category"} &nbsp;|&nbsp; Batch: ${p.batchNumber || "—"}</div></div>
  <div class="doc-meta"><div>Printed: ${date}</div>${isExpired ? '<div style="color:#b91c1c;font-weight:700">EXPIRED</div>' : ""}</div>
</div>
<div class="body-pad">
  <div class="stock-banner">
    <div class="stock-qty">${p.quantity} ${p.unit}</div>
    <div class="stock-unit">Current Stock${p.quantity <= p.minStock ? " — LOW STOCK" : ""}</div>
  </div>
  <div class="card-grid">
    <div class="card-item"><div class="card-lbl">Purchase Price</div><div class="card-val">PKR ${(p.purchasePrice || 0).toLocaleString()}</div></div>
    <div class="card-item"><div class="card-lbl">Sale Price</div><div class="card-val">PKR ${(p.salePrice || 0).toLocaleString()}</div></div>
    <div class="card-item"><div class="card-lbl">Incentive / Discount</div><div class="card-val">${p.incentive > 0 ? "PKR " + (p.incentive || 0).toLocaleString() : "—"}</div></div>
    <div class="card-item"><div class="card-lbl">Min Stock Level</div><div class="card-val">${p.minStock || 0} ${p.unit}</div></div>
    <div class="card-item"><div class="card-lbl">Expiry Date</div><div class="card-val" style="${isExpired ? "color:#b91c1c" : ""}">${expiry}</div></div>
    <div class="card-item"><div class="card-lbl">Manufacturer</div><div class="card-val" style="font-size:12px">${p.manufacturer || "—"}</div></div>
  </div>
  <div class="sig-row"><span>${shop?.name || ""}</span><span>Stock Card — ${date}</span></div>
</div>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`)
    w.document.close()
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this pesticide? This cannot be undone.")) return
    const res = await fetch(`/api/pesticides/${id}`, { method: "DELETE" })
    if (res.ok) loadData()
  }

  async function handleSale() {
    const res = await fetch("/api/pesticides/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pesticideId: selectedPesticide.id,
        quantity: parseFloat(saleForm.quantity),
        unitPrice: selectedPesticide.salePrice,
        customerName: saleForm.customerName,
        paidAmount: parseFloat(saleForm.paidAmount),
        notes: saleForm.notes,
        saleDate: isPreviousRecord ? saleDate : undefined,
      }),
    })
    if (res.ok) {
      setShowSaleModal(false)
      setSaleForm({ quantity: "1", customerName: "", paidAmount: "0", notes: "" })
      setIsPreviousRecord(false)
      setSaleDate(new Date().toISOString().split('T')[0])
      loadData()
    }
  }

  const now = new Date()
  const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const expiring = pesticides.filter((p) => p.expiryDate && new Date(p.expiryDate) <= thirtyDays)
  const filtered = pesticides.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pesticides</h2>
          <p className="text-gray-500 text-sm">{pesticides.length} products</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={printAllCategories}><Printer className="w-4 h-4" /> Print Categories</Button>
          <Button variant="outline" onClick={printAllPesticides}><Printer className="w-4 h-4" /> Print Pesticides</Button>
          <Button variant="outline" onClick={() => setShowCatModal(true)}><Tag className="w-4 h-4" /> Categories</Button>
          <Button onClick={openAdd}><Plus className="w-4 h-4" /> Add Pesticide</Button>
        </div>
      </div>

      {expiring.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-800 font-medium text-sm">Expiry Alerts</p>
            <p className="text-red-700 text-sm mt-1">
              {expiring.map((p) => `${p.name} (expires ${formatDateDMY(p.expiryDate)})`).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(["stock", "sales"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab ? "border-green-700 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "stock" ? "Stock" : "Sales History"}
          </button>
        ))}
      </div>

      {activeTab === "stock" ? (
        <Card>
          <CardHeader>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search pesticides..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </CardHeader>
          <CardContent>
            {loading && !pesticides.length ? (
              <div className="text-center py-8 text-gray-400">Loading...</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {["Name", "Category", "Qty", "Unit", "Batch", "Expiry", "Purchase", "Incentive", "Sale", "Actions"].map((h) => (
                      <th key={h} className="text-left py-3 px-3 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const isExpired = p.expiryDate && new Date(p.expiryDate) < now
                    const isExpiring = p.expiryDate && new Date(p.expiryDate) <= thirtyDays && !isExpired
                    return (
                      <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50 ${isExpired ? "bg-red-50" : ""}`}>
                        <td className="py-3 px-3 font-medium text-gray-800">{p.name}</td>
                        <td className="py-3 px-3 text-gray-600">{p.category?.name}</td>
                        <td className="py-3 px-3">
                          <span className={p.quantity <= p.minStock ? "text-red-600 font-semibold" : "text-gray-700"}>
                            {p.quantity}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-gray-500">{p.unit}</td>
                        <td className="py-3 px-3 text-gray-600">{p.batchNumber || "-"}</td>
                        <td className="py-3 px-3">
                          {p.expiryDate ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isExpired ? "bg-red-100 text-red-700" : isExpiring ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>
                              {formatDateDMY(p.expiryDate)}
                            </span>
                          ) : "-"}
                        </td>
                        <td className="py-3 px-3">{formatCurrency(p.purchasePrice)}</td>
                        <td className="py-3 px-3">
                          {p.incentive > 0 ? (
                            <span className="text-blue-600 font-medium">{formatCurrency(p.incentive)}</span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-3 px-3">{formatCurrency(p.salePrice)}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openSale(p)} className="p-1 text-gray-400 hover:text-green-600" title="Sell">
                              <ShoppingCart className="w-4 h-4" />
                            </button>
                            <button onClick={() => printSinglePesticide(p)} className="p-1 text-gray-400 hover:text-purple-600" title="Print Stock Card">
                              <Printer className="w-4 h-4" />
                            </button>
                            <button onClick={() => openEdit(p)} className="p-1 text-gray-400 hover:text-blue-600">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(p.id)} className="p-1 text-gray-400 hover:text-red-600" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-gray-400">No pesticides found</td></tr>}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {["Pesticide", "Qty", "Unit Price", "Total", "Customer", "Paid", "Incentive", "Date", "By"].map((h) => (
                    <th key={h} className="text-left py-3 px-3 text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-3 font-medium text-gray-800">{s.pesticide?.name}</td>
                    <td className="py-3 px-3">{s.quantity}</td>
                    <td className="py-3 px-3">{formatCurrency(s.unitPrice)}</td>
                    <td className="py-3 px-3 font-semibold">{formatCurrency(s.totalAmount)}</td>
                    <td className="py-3 px-3">{s.customerName || "-"}</td>
                    <td className="py-3 px-3 text-green-600">{formatCurrency(s.paidAmount)}</td>
                    <td className="py-3 px-3 text-blue-600">{s.incentive > 0 ? formatCurrency(s.incentive) : "—"}</td>
                    <td className="py-3 px-3 text-gray-500">{formatDateDMY(s.createdAt)}</td>
                    <td className="py-3 px-3 text-gray-500">{s.soldBy?.name}</td>
                  </tr>
                ))}
                {sales.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-gray-400">No sales yet</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Pesticide Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sprout className="w-5 h-5" /> {editing ? "Edit" : "Add"} Pesticide
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Category</Label>
              <Select value={form.categoryId || "none"} onValueChange={(v) => { setForm({ ...form, categoryId: v === "none" ? "" : v }); setNewCategoryName("") }}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No category —</SelectItem>
                  {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  <SelectItem value="new">+ Add New Category...</SelectItem>
                </SelectContent>
              </Select>
              {form.categoryId === "new" && (
                <Input className="mt-2" placeholder="Enter new category name..." value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)} autoFocus />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Manufacturer</Label><Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></div>
              <div><Label>Batch Number</Label><Input value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Expiry Date</Label>
                <Input type="date" value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
              </div>
              <div>
                <Label>Unit</Label>
                {(() => {
                  const isCustomUnit = !PRESET_UNITS.includes(form.unit)
                  return (
                    <>
                      <Select
                        value={isCustomUnit ? "custom" : (form.unit || "Litre")}
                        onValueChange={(v) => setForm({ ...form, unit: v === "custom" ? "" : v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PRESET_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                          <SelectItem value="custom">Custom...</SelectItem>
                        </SelectContent>
                      </Select>
                      {isCustomUnit && (
                        <Input className="mt-2" placeholder="Enter unit..." value={form.unit}
                          onChange={(e) => setForm({ ...form, unit: e.target.value })} autoFocus />
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
              <div><Label>Purchase Price (per unit)</Label><Input type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} /></div>
            </div>
            {(() => {
              const qty = parseFloat(form.quantity || "0")
              const purchasePrice = parseFloat(form.purchasePrice || "0")
              const incentivePct = parseFloat(form.incentive || "0")
              const subtotal = qty * purchasePrice
              const incentiveAmt = Math.round((subtotal * incentivePct) / 100 * 100) / 100
              const netCost = Math.max(0, subtotal - incentiveAmt)
              return (
                <>
                  <div className="flex justify-between text-sm text-gray-500 px-1">
                    <span>Subtotal ({qty} × {formatCurrency(purchasePrice)})</span>
                    <span className="font-medium text-gray-700">{formatCurrency(subtotal)}</span>
                  </div>
                  <div>
                    <Label>Incentive / Discount from Supplier (%)</Label>
                    <div className="relative">
                      <Input type="number" min="0" max="100" placeholder="0" value={form.incentive}
                        onChange={(e) => setForm({ ...form, incentive: e.target.value })}
                        className="pr-10" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">%</span>
                    </div>
                    {incentiveAmt > 0 && (
                      <p className="text-xs text-blue-600 mt-1 px-1">= {formatCurrency(incentiveAmt)} discount on this purchase</p>
                    )}
                  </div>
                  <div className="bg-blue-50 rounded-lg px-4 py-3 flex justify-between items-center border border-blue-200">
                    <span className="text-sm font-semibold text-blue-800">Net Purchase Cost</span>
                    <span className="text-xl font-bold text-blue-700">{formatCurrency(netCost)}</span>
                  </div>
                  <div><Label>Sale Price (per unit)</Label><Input type="number" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} /></div>
                </>
              )
            })()}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} className="flex-1">{editing ? "Update" : "Add"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Categories Modal */}
      <Dialog open={showCatModal} onOpenChange={setShowCatModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Tag className="w-4 h-4" /> Pesticide Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="New category name..."
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
              />
              <Button onClick={handleAddCategory} disabled={!newCatInput.trim()}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto rounded-lg border border-gray-200">
              {categories.length === 0 && (
                <p className="text-center py-6 text-gray-400 text-sm">No categories yet</p>
              )}
              {categories.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-800">{c.name}</span>
                  <button onClick={() => handleDeleteCategory(c.id, c.name)} className="p-1 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCatModal(false)}>Close</Button>
              <Button variant="outline" className="flex-1" onClick={printAllCategories}><Printer className="w-4 h-4 mr-1" /> Print</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sale Modal */}
      <Dialog open={showSaleModal} onOpenChange={setShowSaleModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sell: {selectedPesticide?.name}</DialogTitle>
          </DialogHeader>
          {(() => {
            const qty = parseFloat(saleForm.quantity || "0")
            const unitPrice = selectedPesticide?.salePrice || 0
            const totalAmount = qty * unitPrice
            return (
              <div className="space-y-4">
                {/* Previous Record Toggle */}
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <input
                    type="checkbox"
                    checked={isPreviousRecord}
                    onChange={(e) => setIsPreviousRecord(e.target.checked)}
                    className="w-4 h-4 cursor-pointer"
                    id="isPreviousRecordPesticide"
                  />
                  <label htmlFor="isPreviousRecordPesticide" className="text-sm font-medium text-blue-900 cursor-pointer">
                    Previous Record? (Backdated Entry)
                  </label>
                </div>

                {/* Date Picker */}
                {isPreviousRecord && (
                  <div>
                    <Label>Sale Date *</Label>
                    <Input
                      type="date"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 flex justify-between">
                  <span>Available: <strong>{selectedPesticide?.quantity} {selectedPesticide?.unit}</strong></span>
                  <span>Unit Price: <strong>{formatCurrency(unitPrice)}</strong></span>
                </div>
                <div><Label>Quantity</Label><Input type="number" value={saleForm.quantity} onChange={(e) => setSaleForm({ ...saleForm, quantity: e.target.value })} /></div>
                <div className="bg-green-50 rounded-lg px-4 py-3 flex justify-between items-center border border-green-200">
                  <span className="text-sm font-semibold text-green-800">Total Amount</span>
                  <span className="text-xl font-bold text-green-700">{formatCurrency(totalAmount)}</span>
                </div>
                <div><Label>Customer Name</Label><Input value={saleForm.customerName} onChange={(e) => setSaleForm({ ...saleForm, customerName: e.target.value })} /></div>
                <div><Label>Amount Paid</Label><Input type="number" value={saleForm.paidAmount} onChange={(e) => setSaleForm({ ...saleForm, paidAmount: e.target.value })} /></div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowSaleModal(false)} className="flex-1">Cancel</Button>
                  <Button onClick={handleSale} className="flex-1">Sell</Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
