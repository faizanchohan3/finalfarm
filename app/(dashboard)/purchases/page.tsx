"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils"
import { buildPrintHeader, receiptCSS, reportCSS } from "@/lib/print-utils"
import { Plus, Search, Trash2, ShoppingBag, Printer, Percent, Package } from "lucide-react"

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [farmers, setFarmers] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [shop, setShop] = useState<any>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // Purchase type toggle
  const [purchaseType, setPurchaseType] = useState<"stock" | "commission">("stock")

  // Stock path state
  const [partyId, setPartyId] = useState("")
  const [walkinSellerName, setWalkinSellerName] = useState("")
  const [paidAmount, setPaidAmount] = useState("0")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState([{ productId: "", quantity: "1", price: "0", customName: "" }])
  const [isPreviousRecord, setIsPreviousRecord] = useState(false)
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [isPreviousRecordCommission, setIsPreviousRecordCommission] = useState(false)
  const [commissionDate, setCommissionDate] = useState(new Date().toISOString().split('T')[0])

  // Commission path state
  const [cPartyId, setCPartyId] = useState("")
  const [cWalkInSeller, setCWalkInSeller] = useState("")
  const [cCustomerId, setCCustomerId] = useState("")
  const [cWalkInCustomer, setCWalkInCustomer] = useState("")
  const [cProductId, setCProductId] = useState("")
  const [cBags, setCBags] = useState("")
  const [cWeight, setCWeight] = useState("")
  const [cRate, setCRate] = useState("")
  const [cTotalValue, setCTotalValue] = useState("")
  const [cCommissionRate, setCCommissionRate] = useState("2.5")
  const [cPaidAmount, setCPaidAmount] = useState("0")
  const [cNotes, setCNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  async function confirmDeletePurchase() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch(`/api/purchases/${deleteTarget.id}`, { method: "DELETE" })
    setDeleting(false)
    if (!res.ok) { alert("Failed to delete purchase"); return }
    setDeleteTarget(null)
    loadData()
  }

  async function safeFetch(url: string, fallback: any = {}) {
    try {
      const r = await fetch(url)
      if (!r.ok) return fallback
      return await r.json()
    } catch { return fallback }
  }

  async function loadData() {
    setLoading(true)
    const [pr, prod, sup, fr, cu, sh] = await Promise.all([
      safeFetch("/api/purchases", { purchases: [] }),
      safeFetch("/api/inventory", { products: [] }),
      safeFetch("/api/suppliers", { suppliers: [] }),
      safeFetch("/api/farmers", { farmers: [] }),
      safeFetch("/api/customers", { customers: [] }),
      safeFetch("/api/settings", { shop: null }),
    ])
    setPurchases(pr.purchases || [])
    setProducts(prod.products || [])
    setSuppliers(sup.suppliers || [])
    setFarmers(fr.farmers || [])
    setCustomers(cu.customers || [])
    setShop(sh.shop || null)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // Auto-compute commission total from weight × rate
  useEffect(() => {
    const w = parseFloat(cWeight)
    const r = parseFloat(cRate)
    if (w > 0 && r > 0) setCTotalValue((w * r).toFixed(2))
  }, [cWeight, cRate])

  // Auto-fill rate from product salePrice
  useEffect(() => {
    if (cProductId) {
      const prod = products.find((p: any) => p.id === cProductId)
      if (prod?.salePrice) setCRate(String(prod.salePrice))
    }
  }, [cProductId])

  function addItem() { setItems([...items, { productId: "", quantity: "1", price: "0", customName: "" }]) }
  function removeItem(i: number) { setItems(items.filter((_, idx) => idx !== i)) }
  function updateItem(i: number, field: string, val: string) {
    const updated = [...items]
    updated[i] = { ...updated[i], [field]: val }
    if (field === "productId") {
      if (val === "manual") {
        updated[i].customName = ""
      } else {
        const prod = products.find((p) => p.id === val)
        if (prod) updated[i].price = String(prod.purchasePrice)
        updated[i].customName = ""
      }
    }
    setItems(updated)
  }

  const stockTotal = items.reduce((s, i) => s + parseFloat(i.quantity || "0") * parseFloat(i.price || "0"), 0)
  const stockBalance = stockTotal - parseFloat(paidAmount || "0")

  const cTotal = parseFloat(cTotalValue || "0")
  const cCommAmt = cTotal > 0 ? parseFloat(((cTotal * parseFloat(cCommissionRate || "0")) / 100).toFixed(2)) : 0
  const cSellerPayable = cTotal > 0 ? parseFloat((cTotal - cCommAmt).toFixed(2)) : 0
  const cBalance = cTotal - parseFloat(cPaidAmount || "0")

  function resetModal() {
    setPurchaseType("stock")
    setPartyId(""); setWalkinSellerName(""); setPaidAmount("0"); setNotes("")
    setItems([{ productId: "", quantity: "1", price: "0", customName: "" }])
    setCPartyId(""); setCWalkInSeller(""); setCCustomerId(""); setCWalkInCustomer("")
    setCProductId(""); setCBags(""); setCWeight(""); setCRate(""); setCTotalValue("")
    setCCommissionRate("2.5"); setCPaidAmount("0"); setCNotes("")
    setIsPreviousRecord(false); setPurchaseDate(new Date().toISOString().split('T')[0])
    setIsPreviousRecordCommission(false); setCommissionDate(new Date().toISOString().split('T')[0])
  }

  async function handleSaveStock() {
    if (!items[0].productId) return alert("Add at least one item")
    for (const item of items) {
      if (item.productId === "manual" && !item.customName.trim()) return alert("Enter a product name for manual entries")
    }
    const isFarmer = partyId.startsWith("farmer_")
    const isCustomer = partyId.startsWith("customer_")
    const isWalkin = partyId === "walkin"
    const supplierId = (!isFarmer && !isCustomer && !isWalkin && partyId) ? partyId : null
    const farmerId = isFarmer ? partyId.replace("farmer_", "") : null
    const sellerCustomerId = isCustomer ? partyId.replace("customer_", "") : null
    const walkinSeller = isWalkin ? walkinSellerName.trim() || null : null

    const res = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId, farmerId, sellerCustomerId, walkinSeller,
        items: items.filter((i) => i.productId).map((i) => ({
          productId: i.productId === "manual" ? null : i.productId,
          customName: i.productId === "manual" ? i.customName.trim() : undefined,
          quantity: parseFloat(i.quantity),
          price: parseFloat(i.price),
        })),
        paidAmount: parseFloat(paidAmount),
        notes,
        purchaseDate: isPreviousRecord ? purchaseDate : undefined,
      }),
    })
    if (res.ok) {
      setShowModal(false); resetModal(); loadData()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d?.error || "Failed to create purchase")
    }
  }

  async function handleSaveCommission() {
    const hasCustomer = cCustomerId && cCustomerId !== "walkin"
    const hasWalkIn = cCustomerId === "walkin" && cWalkInCustomer.trim()
    if (!hasCustomer && !hasWalkIn) return alert("Please select or enter a buyer")
    if (!cTotalValue || parseFloat(cTotalValue) <= 0) return alert("Total value is required")

    setSaving(true)
    try {
      const isFarmer = cPartyId.startsWith("farmer_")
      const isWalkIn = cPartyId === "walkin"
      const farmerId = isFarmer ? cPartyId.replace("farmer_", "") : null
      const supplierId = (!isFarmer && !isWalkIn && cPartyId) ? cPartyId : null
      const selectedProduct = products.find((p: any) => p.id === cProductId)

      const res = await fetch("/api/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: hasCustomer ? cCustomerId : null,
          walkInCustomer: hasWalkIn ? cWalkInCustomer.trim() : null,
          farmerId, supplierId,
          walkInSeller: isWalkIn ? cWalkInSeller.trim() || null : null,
          commodity: selectedProduct?.name || null,
          bags: cBags, weight: cWeight, rate: cRate,
          totalValue: cTotalValue, commissionRate: cCommissionRate,
          paidAmount: cPaidAmount, notes: cNotes,
          commissionDate: isPreviousRecordCommission ? commissionDate : undefined,
        }),
      })
      if (res.ok) {
        setShowModal(false); resetModal(); loadData()
      } else {
        const d = await res.json().catch(() => ({}))
        alert(d?.error || "Failed to create commission")
      }
    } finally { setSaving(false) }
  }

  function printPurchase(p: any) {
    const from = p.farmer?.name || p.supplier?.name || p.sellerCustomer?.name || p.walkinSeller || "Direct"
    const ref = p.id.slice(-6).toUpperCase()
    const date = new Date(p.createdAt).toLocaleDateString("en-PK")
    const statusCls = p.status === "PAID" ? "PAID" : p.status === "PARTIAL" ? "PARTIAL" : "PENDING"
    const itemRows = (p.items || []).map((i: any) => `
      <tr>
        <td>${i.product?.name || "—"}</td>
        <td style="text-align:center">${i.quantity} ${i.product?.unit || ""}</td>
        <td style="text-align:right">PKR ${(i.price || 0).toLocaleString()}</td>
        <td style="text-align:right">PKR ${(i.total || 0).toLocaleString()}</td>
      </tr>`).join("")
    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>Purchase — ${ref}</title>
<style>${receiptCSS}</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div>
    <div class="doc-title">Purchase Receipt</div>
    <div class="doc-sub">Ref: #${ref} &nbsp;|&nbsp; By: ${p.createdBy?.name || "—"}</div>
  </div>
  <div class="doc-meta"><div>${date}</div><span class="badge badge-${statusCls}">${p.status}</span></div>
</div>
<div class="body-pad">
  <div class="info-grid">
    <div><div class="lbl">From</div><div class="val">${from}</div>${p.farmer?.phone || p.supplier?.phone ? `<div style="color:#6b7280;font-size:10px;margin-top:2px">${p.farmer?.phone || p.supplier?.phone}</div>` : ""}</div>
    <div><div class="lbl">Type</div><div class="val">${p.farmer ? "Farmer" : p.supplier ? "Supplier" : p.sellerCustomer ? "Trader" : p.walkinSeller ? "Walk-in" : "Direct"}</div></div>
    <div><div class="lbl">Date</div><div class="val">${date}</div></div>
  </div>
  <table>
    <thead><tr><th>Product</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="totals-box">
    <table>
      <tbody>
        <tr><td>Subtotal</td><td style="text-align:right">PKR ${(p.totalAmount || 0).toLocaleString()}</td></tr>
        <tr><td>Paid</td><td style="text-align:right;color:#15803d">PKR ${(p.paidAmount || 0).toLocaleString()}</td></tr>
      </tbody>
      <tfoot><tr class="grand"><td>Balance Due</td><td style="text-align:right;color:${p.balance > 0 ? "#b91c1c" : "#15803d"}">PKR ${(p.balance || 0).toLocaleString()}</td></tr></tfoot>
    </table>
  </div>
  ${p.notes ? `<p style="font-size:11px;color:#555;margin-top:12px"><strong>Notes:</strong> ${p.notes}</p>` : ""}
  <div class="sig-row">
    <span>Received By: _______________________</span>
    <span>Authorized By: _______________________</span>
  </div>
</div>
</body></html>`)
    w.print()
  }

  function printAllPurchases(list: any[]) {
    const rows = list.map((p, i) => {
      const from = p.farmer?.name || p.supplier?.name || p.sellerCustomer?.name || p.walkinSeller || "Direct"
      const type = p.farmer ? "Farmer" : p.supplier ? "Supplier" : p.sellerCustomer ? "Trader" : p.walkinSeller ? "Walk-in" : "Direct"
      const its = (p.items || []).map((it: any) => `${it.quantity} ${it.product?.unit || ""} ${it.product?.name || ""}`).join(", ")
      const statusCls = p.status === "PAID" ? "PAID" : p.status === "PARTIAL" ? "PARTIAL" : "PENDING"
      return `<tr>
        <td>${i + 1}</td><td>${from}</td><td>${type}</td>
        <td style="font-size:9px;color:#555">${its || "—"}</td>
        <td style="text-align:right">PKR ${(p.totalAmount || 0).toLocaleString()}</td>
        <td style="text-align:right;color:#15803d">PKR ${(p.paidAmount || 0).toLocaleString()}</td>
        <td style="text-align:right;color:${p.balance > 0 ? "#b91c1c" : "#15803d"}">PKR ${(p.balance || 0).toLocaleString()}</td>
        <td><span class="badge badge-${statusCls}">${p.status}</span></td>
        <td>${new Date(p.createdAt).toLocaleDateString("en-PK")}</td>
        <td>${p.createdBy?.name || "—"}</td>
      </tr>`
    }).join("")
    const totalAmt = list.reduce((s, p) => s + (p.totalAmount || 0), 0)
    const totalPaid = list.reduce((s, p) => s + (p.paidAmount || 0), 0)
    const totalBal = list.reduce((s, p) => s + (p.balance || 0), 0)
    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>All Purchases</title>
<style>${reportCSS}</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div>
    <div class="doc-title">Purchase Report</div>
    <div class="doc-sub">Printed on ${new Date().toLocaleDateString("en-PK")} &nbsp;|&nbsp; ${list.length} purchases</div>
  </div>
  <div class="doc-meta"><div>${new Date().toLocaleString("en-PK")}</div></div>
</div>
<div class="body-pad">
<table>
  <thead><tr><th>#</th><th>From</th><th>Type</th><th>Items</th>
    <th style="text-align:right">Total</th><th style="text-align:right">Paid</th>
    <th style="text-align:right">Balance</th><th>Status</th>
    <th>Date</th><th>By</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr>
    <td colspan="4" style="text-align:right">Totals</td>
    <td style="text-align:right">PKR ${totalAmt.toLocaleString()}</td>
    <td style="text-align:right">PKR ${totalPaid.toLocaleString()}</td>
    <td style="text-align:right">PKR ${totalBal.toLocaleString()}</td>
    <td colspan="3"></td>
  </tr></tfoot>
</table>
</div>
</body></html>`)
    w.print()
  }

  const filtered = purchases.filter((p) =>
    (p.supplier?.name || p.farmer?.name || p.sellerCustomer?.name || p.walkinSeller || "").toLowerCase().includes(search.toLowerCase()) ||
    p.status.toLowerCase().includes(search.toLowerCase())
  )

  const sellerOptions = [
    { value: "walkin", label: "Walk-in / Direct (enter name)" },
    ...farmers.map((f: any) => ({ value: `farmer_${f.id}`, label: f.name, sub: f.village || f.phone || undefined })),
    ...suppliers.map((s: any) => ({ value: s.id, label: s.name, sub: s.phone || undefined })),
  ]

  const customerOptions = [
    { value: "walkin", label: "Walk-in / Direct (enter name)" },
    ...customers.map((c: any) => ({ value: c.id, label: c.name, sub: c.phone || undefined })),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Purchases</h2>
          <p className="text-gray-500 text-sm">{purchases.length} total purchases</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => printAllPurchases(filtered)}>
            <Printer className="w-4 h-4" /> Print All
          </Button>
          <Button onClick={() => { resetModal(); setShowModal(true) }}>
            <Plus className="w-4 h-4" /> New Purchase
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search purchases..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          {loading && !purchases.length ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-200">
                    {["#", "From", "Type", "Total", "Paid", "Balance", "Status", "Date", "By", ""].map((h) => (
                      <th key={h} className="text-left py-3 px-3 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-amber-50">
                      <td className="py-3 px-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="py-3 px-3 font-medium text-gray-800">{p.farmer?.name || p.supplier?.name || p.sellerCustomer?.name || p.walkinSeller || "Direct"}</td>
                      <td className="py-3 px-3">
                        {p.farmer ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Farmer</span>
                        ) : p.supplier ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Supplier</span>
                        ) : p.sellerCustomer ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Trader</span>
                        ) : p.walkinSeller ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Walk-in</span>
                        ) : (
                          <span className="text-xs text-gray-400">Direct</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-gray-700">{formatCurrency(p.totalAmount)}</td>
                      <td className="py-3 px-3 text-green-600">{formatCurrency(p.paidAmount)}</td>
                      <td className="py-3 px-3 text-red-600">{formatCurrency(p.balance)}</td>
                      <td className="py-3 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(p.status)}`}>{p.status}</span>
                      </td>
                      <td className="py-3 px-3 text-gray-500">{formatDate(p.createdAt)}</td>
                      <td className="py-3 px-3 text-gray-500">{p.createdBy?.name}</td>
                      <td className="py-3 px-3">
                        <div className="flex gap-1">
                          <button onClick={() => printPurchase(p)} className="p-1.5 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded" title="Print">
                            <Printer className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteTarget(p)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete Purchase">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={10} className="text-center py-8 text-gray-400">No purchases found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" /> New Purchase
            </DialogTitle>
          </DialogHeader>

          {/* Previous Record Toggle */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <input
              type="checkbox"
              checked={isPreviousRecord}
              onChange={(e) => setIsPreviousRecord(e.target.checked)}
              className="w-4 h-4 cursor-pointer"
              id="isPreviousRecordPurchase"
            />
            <label htmlFor="isPreviousRecordPurchase" className="text-sm font-medium text-blue-900 cursor-pointer">
              Previous Record? (Backdated Entry)
            </label>
          </div>

          {/* Date Picker (Only shows if Previous Record is checked) */}
          {isPreviousRecord && (
            <div>
              <Label>Purchase Date *</Label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="mt-1"
              />
            </div>
          )}

          {/* Type toggle */}
          <div className="flex rounded-lg border border-amber-200 p-1 gap-1">
            <button
              onClick={() => setPurchaseType("stock")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                purchaseType === "stock"
                  ? "bg-green-700 text-amber-950 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Package className="w-4 h-4" /> Add to Stock
            </button>
        
          </div>

          {/* ── ADD TO STOCK path ── */}
          {purchaseType === "stock" && (
            <div className="space-y-4">
              <div>
                <Label>From (Supplier / Farmer / Trader)</Label>
                <SearchableSelect
                  value={partyId}
                  onValueChange={(v) => { setPartyId(v); setWalkinSellerName("") }}
                  placeholder="Select source..."
                  options={[{ value: "walkin", label: "Walk-in / Direct (enter name)" }]}
                  groups={[
                    { label: "Suppliers", options: suppliers.map((s: any) => ({ value: s.id, label: s.name, sub: s.phone || undefined })) },
                    { label: "Farmers", options: farmers.map((f: any) => ({ value: `farmer_${f.id}`, label: f.name, sub: f.village || f.phone || undefined })) },
                    { label: "Traders / Customers", options: customers.map((c: any) => ({ value: `customer_${c.id}`, label: c.name, sub: c.phone || undefined })) },
                  ]}
                />
                {partyId === "walkin" && (
                  <Input
                    className="mt-2"
                    placeholder="Enter seller name..."
                    value={walkinSellerName}
                    onChange={(e) => setWalkinSellerName(e.target.value)}
                  />
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Items</Label>
                  <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-3 h-3" /> Add Row</Button>
                </div>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <SearchableSelect
                          value={item.productId}
                          onValueChange={(v) => updateItem(i, "productId", v)}
                          placeholder="Select product"
                          options={[
                            { value: "manual", label: "✏ Manual / Custom Entry" },
                            ...products.map((p: any) => ({ value: p.id, label: p.name }))
                          ]}
                        />
                        {item.productId === "manual" && (
                          <Input
                            className="mt-1"
                            placeholder="Type product name..."
                            value={item.customName}
                            onChange={(e) => updateItem(i, "customName", e.target.value)}
                          />
                        )}
                      </div>
                      <div className="col-span-2">
                        <Input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} />
                      </div>
                      <div className="col-span-3">
                        <Input type="number" placeholder="Price" value={item.price} onChange={(e) => updateItem(i, "price", e.target.value)} />
                      </div>
                      <div className="col-span-1 text-xs text-right text-gray-500">
                        {formatCurrency(parseFloat(item.quantity || "0") * parseFloat(item.price || "0"))}
                      </div>
                      <div className="col-span-1">
                        <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-amber-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total:</span><span className="font-bold">{formatCurrency(stockTotal)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="whitespace-nowrap">Amount Paid:</Label>
                  <Input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="max-w-[150px]" />
                </div>
                <div className="flex justify-between text-sm">
                  <span>Balance:</span>
                  <span className={`font-bold ${stockBalance > 0 ? "text-red-600" : "text-green-600"}`}>{formatCurrency(stockBalance)}</span>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleSaveStock} className="flex-1 bg-green-700 hover:bg-green-800">Add to Stock</Button>
              </div>
            </div>
          )}

          {/* ── COMMISSION path ── */}
          {purchaseType === "commission" && (
            <div className="space-y-4">
              {/* Previous Record Toggle for Commission */}
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <input
                  type="checkbox"
                  checked={isPreviousRecordCommission}
                  onChange={(e) => setIsPreviousRecordCommission(e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                  id="isPreviousRecordCommission"
                />
                <label htmlFor="isPreviousRecordCommission" className="text-sm font-medium text-blue-900 cursor-pointer">
                  Previous Record? (Backdated Entry)
                </label>
              </div>

              {/* Date Picker for Commission */}
              {isPreviousRecordCommission && (
                <div>
                  <Label>Commission Date *</Label>
                  <Input
                    type="date"
                    value={commissionDate}
                    onChange={(e) => setCommissionDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}

              <div>
                <Label>Seller (Farmer / Supplier) <span className="text-gray-400 font-normal">— optional</span></Label>
                <SearchableSelect
                  value={cPartyId}
                  onValueChange={(v) => { setCPartyId(v); if (v !== "walkin") setCWalkInSeller("") }}
                  placeholder="Select seller or walk-in..."
                  options={sellerOptions}
                />
                {cPartyId === "walkin" && (
                  <Input className="mt-2" placeholder="Enter seller name..." value={cWalkInSeller} onChange={(e) => setCWalkInSeller(e.target.value)} />
                )}
              </div>
              <div>
                <Label>Buyer (Customer) <span className="text-red-500">*</span></Label>
                <SearchableSelect
                  value={cCustomerId}
                  onValueChange={(v) => { setCCustomerId(v); if (v !== "walkin") setCWalkInCustomer("") }}
                  placeholder="Select customer or walk-in..."
                  options={customerOptions}
                />
                {cCustomerId === "walkin" && (
                  <Input className="mt-2" placeholder="Enter buyer name..." value={cWalkInCustomer} onChange={(e) => setCWalkInCustomer(e.target.value)} />
                )}
              </div>
              <div>
                <Label>Product / Commodity</Label>
                <SearchableSelect
                  value={cProductId}
                  onValueChange={setCProductId}
                  placeholder="Select product..."
                  options={products.map((p: any) => ({ value: p.id, label: p.name, sub: p.unit }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Bags</Label><Input type="number" placeholder="0" value={cBags} onChange={(e) => setCBags(e.target.value)} /></div>
                <div><Label>Weight (KG)</Label><Input type="number" placeholder="0" value={cWeight} onChange={(e) => setCWeight(e.target.value)} /></div>
                <div><Label>Rate (per KG)</Label><Input type="number" placeholder="0" value={cRate} onChange={(e) => setCRate(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Total Value <span className="text-red-500">*</span></Label>
                  <Input type="number" placeholder="0" value={cTotalValue} onChange={(e) => setCTotalValue(e.target.value)} />
                  <p className="text-xs text-gray-400 mt-1">Auto-filled from weight × rate</p>
                </div>
                <div><Label>Commission %</Label><Input type="number" placeholder="2.5" value={cCommissionRate} onChange={(e) => setCCommissionRate(e.target.value)} /></div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 space-y-1.5 text-sm border border-orange-100">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Value (buyer owes):</span>
                  <span className="font-medium">{formatCurrency(cTotal)}</span>
                </div>
                <div className="flex justify-between text-green-700">
                  <span>Your Commission ({cCommissionRate}%):</span>
                  <span className="font-bold">{formatCurrency(cCommAmt)}</span>
                </div>
                <div className="flex justify-between text-blue-700 border-t border-orange-200 pt-1.5">
                  <span>Seller Payable:</span>
                  <span className="font-semibold">{formatCurrency(cSellerPayable)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label className="whitespace-nowrap">Initial Payment:</Label>
                <Input type="number" value={cPaidAmount} onChange={(e) => setCPaidAmount(e.target.value)} className="max-w-[150px]" />
                <span className="text-sm text-gray-500">Balance: {formatCurrency(cBalance)}</span>
              </div>
              <div><Label>Notes</Label><Textarea value={cNotes} onChange={(e) => setCNotes(e.target.value)} rows={2} /></div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleSaveCommission} disabled={saving} className="flex-1 bg-orange-600 hover:bg-orange-700">
                  {saving ? "Saving..." : "Create Commission"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Purchase Confirmation Modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              Delete Purchase Entry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Reference</span>
                <span className="font-semibold">#{deleteTarget?.id?.slice(-8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Supplier / Party</span>
                <span className="font-semibold">{deleteTarget?.supplier?.name || deleteTarget?.farmer?.name || deleteTarget?.sellerCustomer?.name || deleteTarget?.walkinSeller || "Walk-in"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount</span>
                <span className="font-bold text-red-600">{formatCurrency(deleteTarget?.totalAmount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span>{deleteTarget ? formatDate(deleteTarget.createdAt) : ""}</span>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">What happens when deleted:</p>
              <p>✓ Purchase removed from supplier/farmer ledger</p>
              <p>✓ Stock quantities reversed</p>
              <p>✗ This cannot be undone</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 gap-2" onClick={confirmDeletePurchase} disabled={deleting}>
                <Trash2 className="w-4 h-4" />{deleting ? "Deleting..." : "Delete Purchase"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
