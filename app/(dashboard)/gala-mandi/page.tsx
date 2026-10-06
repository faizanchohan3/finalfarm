"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { formatCurrency, formatDate } from "@/lib/utils"
import { buildPrintHeader, escapeHtml, reportCSS } from "@/lib/print-utils"
import { recordCode } from "@/lib/record-code"
import { RATE_PER, galaRowAmount, itemRatePer, itemToKgRow } from "@/lib/gala"
import { Plus, Search, Scale, Printer, Edit, Trash2, X } from "lucide-react"

// Weight is always KG (like Bill Maker); the rate is per KG or per Mound (40 kg)
type Row = { product: string; qty: string; ratePer: string; rate: string }
const emptyRow = (): Row => ({ product: "", qty: "", ratePer: "KG", rate: "" })
const today = () => new Date().toISOString().slice(0, 10)
const n = (v: number) => (v || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })

// Weight total per unit, e.g. "1,200 KG · 40 Bag"
function weightByUnit(rows: { qty: number; unit: string }[]) {
  const totals = new Map<string, number>()
  for (const r of rows) if (r.qty) totals.set(r.unit, (totals.get(r.unit) || 0) + r.qty)
  return Array.from(totals.entries()).map(([u, q]) => `${n(q)} ${u}`).join(" · ") || "0"
}

export default function GalaMandiPage() {
  const [entries, setEntries] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [farmers, setFarmers] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [banks, setBanks] = useState<any[]>([])
  const [shop, setShop] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Entry form
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [entryDate, setEntryDate] = useState(today())
  const [buyerId, setBuyerId] = useState("")      // customer id, or "walkin"
  const [walkInBuyer, setWalkInBuyer] = useState("")
  const [sellerId, setSellerId] = useState("")    // "farmer_<id>", "supplier_<id>" or "walkin"
  const [walkInSeller, setWalkInSeller] = useState("")
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  // Received (from buyer) / Paid (to seller)
  const [savedEntry, setSavedEntry] = useState<any>(null)          // "entry saved" prompt with Received / Paid buttons
  const [payFor, setPayFor] = useState<{ entry: any; kind: "RECEIVE" | "PAY" } | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState("CASH")
  const [payNotes, setPayNotes] = useState("")
  const [payBankId, setPayBankId] = useState("")
  const [paying, setPaying] = useState(false)

  async function safeFetch(url: string, fallback: any) {
    try {
      const r = await fetch(url, { cache: "no-store" })
      return r.ok ? await r.json() : fallback
    } catch {
      return fallback
    }
  }

  async function loadData() {
    setLoading(true)
    const [g, cu, fa, su, pr, sh, bk] = await Promise.all([
      safeFetch("/api/gala", { entries: [] }),
      safeFetch("/api/customers", { customers: [] }),
      safeFetch("/api/farmers", { farmers: [] }),
      safeFetch("/api/suppliers", { suppliers: [] }),
      safeFetch("/api/inventory", { products: [] }),
      safeFetch("/api/settings", { shop: null }),
      safeFetch("/api/banks", { banks: [] }),
    ])
    setEntries(g.entries || [])
    setCustomers(cu.customers || [])
    setFarmers(fa.farmers || [])
    setSuppliers(su.suppliers || [])
    setProducts(pr.products || [])
    setShop(sh.shop || null)
    setBanks(bk.banks || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // ── Form rows and totals ──
  const parsed = rows.map((r) => {
    const qty = parseFloat(r.qty) || 0
    const rate = parseFloat(r.rate) || 0
    return { ...r, qtyN: qty, rateN: rate, amount: galaRowAmount(qty, r.ratePer, rate) }
  })
  const totalWeight = parsed.reduce((s, r) => s + r.qtyN, 0)
  const totalRate = parsed.reduce((s, r) => s + r.rateN, 0)
  const totalAmount = parsed.reduce((s, r) => s + r.amount, 0)

  function updateRow(i: number, key: keyof Row, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)))
  }

  function openNew() {
    setEditingId(null)
    setEntryDate(today())
    setBuyerId(""); setWalkInBuyer("")
    setSellerId(""); setWalkInSeller("")
    setRows([emptyRow()]); setNotes("")
    setShowForm(true)
  }

  function openEdit(e: any) {
    setEditingId(e.id)
    setEntryDate(new Date(e.entryDate).toISOString().slice(0, 10))
    setBuyerId(e.customerId || (e.walkInBuyer ? "walkin" : "")); setWalkInBuyer(e.walkInBuyer || "")
    setSellerId(e.farmerId ? `farmer_${e.farmerId}` : e.supplierId ? `supplier_${e.supplierId}` : e.walkInSeller ? "walkin" : "")
    setWalkInSeller(e.walkInSeller || "")
    const items = Array.isArray(e.items) ? e.items : []
    setRows(items.length ? items.map((i: any) => { const k = itemToKgRow(i); return { product: i.product || "", qty: String(k.qty ?? ""), ratePer: k.ratePer, rate: String(k.rate ?? "") } }) : [emptyRow()])
    setNotes(e.notes || "")
    setShowForm(true)
  }

  async function handleSave() {
    if (!buyerId || (buyerId === "walkin" && !walkInBuyer.trim())) return alert("Select or enter a buyer")
    if (!sellerId || (sellerId === "walkin" && !walkInSeller.trim())) return alert("Select or enter a seller")
    const filled = rows.filter((r) => r.product.trim() || r.qty || r.rate)
    if (filled.length === 0) return alert("Add at least one product row")
    if (filled.some((r) => !r.product.trim())) return alert("Every row needs a product")
    if (filled.some((r) => !(parseFloat(r.qty) > 0))) return alert("Every row needs a weight greater than 0")

    setSaving(true)
    try {
      const res = await fetch(editingId ? `/api/gala/${editingId}` : "/api/gala", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryDate,
          customerId: buyerId !== "walkin" ? buyerId : null,
          walkInBuyer: buyerId === "walkin" ? walkInBuyer.trim() : null,
          farmerId: sellerId.startsWith("farmer_") ? sellerId.slice(7) : null,
          supplierId: sellerId.startsWith("supplier_") ? sellerId.slice(9) : null,
          walkInSeller: sellerId === "walkin" ? walkInSeller.trim() : null,
          items: filled,
          notes,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) return alert(d?.error || "Failed to save entry")
      setShowForm(false)
      // New entry: offer Received / Paid right away
      if (!editingId && d?.entry) setSavedEntry(d.entry)
      loadData()
    } finally {
      setSaving(false)
    }
  }

  const leftToReceive = (e: any) => Math.max(0, Math.round(((e.totalAmount || 0) - (e.receivedAmount || 0)) * 100) / 100)
  const leftToPay = (e: any) => Math.max(0, Math.round(((e.totalAmount || 0) - (e.paidAmount || 0)) * 100) / 100)

  function openPay(entry: any, kind: "RECEIVE" | "PAY") {
    setSavedEntry(null)
    setPayFor({ entry, kind })
    setPayAmount(String(kind === "RECEIVE" ? leftToReceive(entry) : leftToPay(entry)))
    setPayMethod("CASH"); setPayNotes(""); setPayBankId("")
  }

  async function handlePay() {
    if (!payFor) return
    const amt = parseFloat(payAmount)
    if (!(amt > 0)) return alert("Enter an amount greater than 0")
    if (payMethod === "BANK_TRANSFER" && !payBankId) return alert("Select the bank account")
    setPaying(true)
    try {
      const res = await fetch(`/api/gala/${payFor.entry.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: payFor.kind, amount: amt, method: payMethod, notes: payNotes, bankId: payMethod === "BANK_TRANSFER" ? payBankId : null }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) return alert(d?.error || "Failed to save payment")
      setPayFor(null)
      loadData()
    } finally {
      setPaying(false)
    }
  }

  async function handleDelete(e: any) {
    if (!confirm(`Delete Gala Mandi #${e.entryNo}?\n\nThe buyer's and seller's balances will be reversed. It can be restored from Deleted Records.`)) return
    const res = await fetch(`/api/gala/${e.id}`, { method: "DELETE" })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      return res.status === 403 ? undefined : alert(d?.error || "Failed to delete entry")
    }
    loadData()
  }

  const buyerName = (e: any) => e.customer?.name || e.walkInBuyer || "—"
  const sellerName = (e: any) => e.farmer?.name || e.supplier?.name || e.walkInSeller || "—"
  const itemsOf = (e: any): any[] => (Array.isArray(e.items) ? e.items : [])

  function printEntry(e: any) {
    const x = (v: unknown) => escapeHtml(v ?? "—")
    const items = itemsOf(e)
    const rowsHtml = items.map((i, idx) => `<tr>
      <td>${idx + 1}</td><td>${x(i.product)}</td>
      <td style="text-align:right">${n(i.qty)}${i.unit && i.unit !== "KG" ? ` ${x(i.unit)}` : ""}</td><td>Per ${x(itemRatePer(i))}</td>
      <td style="text-align:right">${n(i.rate)}</td><td style="text-align:right">${n(i.amount)}</td>
    </tr>`).join("")
    // Total weight under Weight (KG); older entries with other units list them together
    const allKg = items.every((i) => !i.unit || i.unit === "KG")
    const totalKg = items.reduce((s, i) => s + (i.qty || 0), 0)
    const weightCells = allKg
      ? `<td style="text-align:right"><strong>${n(totalKg)} KG</strong></td><td>${n(totalKg / 40)} mound</td>`
      : `<td style="text-align:right"><strong>${x(weightByUnit(items))}</strong></td><td></td>`
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<html><head><title>Gala Mandi #${x(e.entryNo)}</title>
<style>${reportCSS} body { max-width: 800px; margin: 0 auto; }</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div><div class="doc-title">Gala Mandi #${x(e.entryNo)}</div><div class="doc-sub">${recordCode("gala", e)}</div></div>
  <div class="doc-meta"><div>Date: ${formatDate(e.entryDate)}</div></div>
</div>
<div class="body-pad">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px"><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;font-weight:700">Seller</div><div style="font-size:14px;font-weight:800">${x(sellerName(e))}</div></div>
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px"><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;font-weight:700">Buyer</div><div style="font-size:14px;font-weight:800">${x(buyerName(e))}</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Product</th><th style="text-align:right">Weight (KG)</th><th>Rate per</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr>
      <td colspan="2"><strong>Total</strong></td>
      ${weightCells}
      <td style="text-align:right"><strong>${n(e.totalRate)}</strong></td>
      <td style="text-align:right"><strong>PKR ${n(e.totalAmount)}</strong></td>
    </tr></tfoot>
  </table>
  ${e.notes ? `<p style="font-size:11px;color:#4b5563;margin-top:10px">Notes: ${x(e.notes)}</p>` : ""}
  <div style="margin-top:36px;display:flex;justify-content:space-between;font-size:11px;color:#6b7280;padding-top:10px;border-top:1px dashed #e5e7eb"><span>Signature: ____________</span><span>${x(shop?.name || "")}</span></div>
</div>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`)
    w.document.close()
  }

  const q = search.toLowerCase()
  const filtered = entries.filter((e) =>
    !q ||
    buyerName(e).toLowerCase().includes(q) ||
    sellerName(e).toLowerCase().includes(q) ||
    String(e.entryNo).includes(q) ||
    itemsOf(e).some((i) => String(i.product || "").toLowerCase().includes(q)),
  )
  const grandTotal = filtered.reduce((s, e) => s + (e.totalAmount || 0), 0)
  const totalUnreceived = filtered.reduce((s, e) => s + leftToReceive(e), 0)
  const totalUnpaid = filtered.reduce((s, e) => s + leftToPay(e), 0)

  const buyerOptions = [
    { value: "walkin", label: "Walk-in (enter name)" },
    ...customers.map((c: any) => ({ value: c.id, label: c.name, sub: c.phone || undefined })),
  ]
  const sellerGroups = [
    { label: "Walk-in", options: [{ value: "walkin", label: "Walk-in (enter name)" }] },
    { label: "Farmers", options: farmers.map((f: any) => ({ value: `farmer_${f.id}`, label: f.name, sub: f.village || f.phone || undefined })) },
    { label: "Suppliers", options: suppliers.map((s: any) => ({ value: `supplier_${s.id}`, label: s.name, sub: s.phone || undefined })) },
  ].filter((g) => g.options.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gala Mandi</h2>
          <p className="text-gray-500 text-sm">Buyer and seller deals with product weight, rate and amount</p>
        </div>
        <Button onClick={openNew} className="gap-1">
          <Plus className="w-4 h-4" /> New Entry
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Entries</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{filtered.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Total Weight</p>
          <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">{weightByUnit(filtered.flatMap(itemsOf))}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Total Amount</p>
          <p className="text-xl font-bold text-purple-700 mt-1">{formatCurrency(grandTotal)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Unreceived (buyers)</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{formatCurrency(totalUnreceived)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Unpaid (sellers)</p>
          <p className="text-xl font-bold text-orange-700 mt-1">{formatCurrency(totalUnpaid)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search buyer, seller, product, entry no..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          {loading && !entries.length ? (
            <div className="text-center py-10 text-gray-400">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-blue-300">
                    {["#", "Date", "Seller", "Buyer", "Products", "Total Weight", "Total Amount", "Received (buyer)", "Paid (seller)", ""].map((h) => (
                      <th key={h} className={`py-3 px-3 text-gray-500 font-medium ${["Total Amount", "Received (buyer)", "Paid (seller)"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id} className="border-b border-gray-50 hover:bg-blue-50 align-top">
                      <td className="py-3 px-3 text-gray-500">
                        {e.entryNo}
                        <div className="font-mono text-[11px] text-purple-700">{recordCode("gala", e)}</div>
                      </td>
                      <td className="py-3 px-3 text-gray-600 whitespace-nowrap">{formatDate(e.entryDate)}</td>
                      <td className="py-3 px-3 font-medium text-gray-800">{sellerName(e)}</td>
                      <td className="py-3 px-3 font-medium text-gray-800">{buyerName(e)}</td>
                      <td className="py-3 px-3 text-xs text-gray-600">
                        {itemsOf(e).map((i, idx) => (
                          <div key={idx}>{i.product} — {n(i.qty)} {i.unit} × {n(i.rate)}{itemRatePer(i) !== i.unit ? ` /${itemRatePer(i)}` : ""}</div>
                        ))}
                      </td>
                      <td className="py-3 px-3 text-gray-700 whitespace-nowrap">{weightByUnit(itemsOf(e))}</td>
                      <td className="py-3 px-3 text-right font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(e.totalAmount)}</td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="font-medium text-gray-800 tabular-nums">{formatCurrency(e.receivedAmount || 0)}</div>
                        {leftToReceive(e) > 0
                          ? <div className="text-[11px] text-blue-700">Unreceived {formatCurrency(leftToReceive(e))}</div>
                          : <div className="text-[11px] text-green-700">Fully received</div>}
                        {leftToReceive(e) > 0 && (
                          <button onClick={() => openPay(e, "RECEIVE")} className="mt-1 text-xs px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700">Received</button>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="font-medium text-gray-800 tabular-nums">{formatCurrency(e.paidAmount || 0)}</div>
                        {leftToPay(e) > 0
                          ? <div className="text-[11px] text-orange-700">Unpaid {formatCurrency(leftToPay(e))}</div>
                          : <div className="text-[11px] text-green-700">Fully paid</div>}
                        {leftToPay(e) > 0 && (
                          <button onClick={() => openPay(e, "PAY")} className="mt-1 text-xs px-2 py-0.5 rounded bg-orange-600 text-white hover:bg-orange-700">Paid</button>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => printEntry(e)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Print">
                            <Printer className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEdit(e)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(e)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={10} className="text-center py-12 text-gray-400">
                      <Scale className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      {entries.length ? "No entries match your search" : "No entries yet — click New Entry"}
                    </td></tr>
                  )}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot className="bg-purple-50 border-t-2 border-purple-200 font-semibold">
                    <tr>
                      <td colSpan={5} className="py-3 px-3 text-gray-800">Total ({filtered.length} entries)</td>
                      <td className="py-3 px-3 text-gray-900 whitespace-nowrap tabular-nums">{weightByUnit(filtered.flatMap(itemsOf))}</td>
                      <td className="py-3 px-3 text-right text-purple-800 whitespace-nowrap tabular-nums">{formatCurrency(grandTotal)}</td>
                      <td className="py-3 px-3 text-right whitespace-nowrap tabular-nums">
                        {formatCurrency(grandTotal - totalUnreceived)}
                        <div className="text-[11px] font-normal text-blue-700">Unreceived {formatCurrency(totalUnreceived)}</div>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap tabular-nums">
                        {formatCurrency(grandTotal - totalUnpaid)}
                        <div className="text-[11px] font-normal text-orange-700">Unpaid {formatCurrency(totalUnpaid)}</div>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New / Edit entry */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="w-[96vw] max-w-4xl max-h-[92vh] overflow-y-auto p-0">
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                <Scale className="w-5 h-5 text-brand-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold">{editingId ? "Edit Gala Mandi Entry" : "New Gala Mandi Entry"}</h2>
                <p className="text-gray-500 text-xs">Seller, buyer and product rows</p>
              </div>
            </div>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg p-1.5" title="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Parties */}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-300 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-600">Seller (Farmer / Supplier) *</Label>
                <div className="mt-1">
                  <SearchableSelect value={sellerId} onValueChange={(v) => { setSellerId(v); if (v !== "walkin") setWalkInSeller("") }}
                    placeholder="Select seller..." groups={sellerGroups} searchPlaceholder="Search sellers..." emptyText="No sellers" />
                </div>
                {sellerId === "walkin" && (
                  <Input className="mt-2" placeholder="Enter seller name..." value={walkInSeller} onChange={(e) => setWalkInSeller(e.target.value)} />
                )}
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-600">Buyer (Trader) *</Label>
                <div className="mt-1">
                  <SearchableSelect value={buyerId} onValueChange={(v) => { setBuyerId(v); if (v !== "walkin") setWalkInBuyer("") }}
                    placeholder="Select buyer..." options={buyerOptions} searchPlaceholder="Search buyers..." emptyText="No buyers" />
                </div>
                {buyerId === "walkin" && (
                  <Input className="mt-2" placeholder="Enter buyer name..." value={walkInBuyer} onChange={(e) => setWalkInBuyer(e.target.value)} />
                )}
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-600">Date</Label>
                <Input type="date" className="mt-1" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              </div>
            </div>

            {/* Product rows */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Products</h3>
              <div className="overflow-x-auto rounded-xl border border-blue-300">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-blue-50">
                    <tr className="text-xs text-gray-600">
                      <th className="text-left py-2 px-2 font-semibold w-8">#</th>
                      <th className="text-left py-2 px-2 font-semibold">Product</th>
                      <th className="text-left py-2 px-2 font-semibold w-28">Weight (KG)</th>
                      <th className="text-left py-2 px-2 font-semibold w-32">Rate per</th>
                      <th className="text-left py-2 px-2 font-semibold w-28">Rate</th>
                      <th className="text-right py-2 px-2 font-semibold w-32">Amount</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="py-1.5 px-2 text-gray-400 text-xs">{i + 1}</td>
                        <td className="py-1.5 px-2">
                          <Input list="gala-products" value={r.product} onChange={(e) => updateRow(i, "product", e.target.value)} placeholder="e.g. Wheat" className="h-8" />
                        </td>
                        <td className="py-1.5 px-2">
                          <Input type="number" value={r.qty} onChange={(e) => updateRow(i, "qty", e.target.value)} placeholder="0" className="h-8" />
                        </td>
                        <td className="py-1.5 px-2">
                          <select value={r.ratePer} onChange={(e) => updateRow(i, "ratePer", e.target.value)}
                            className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm">
                            {RATE_PER.map((u) => <option key={u} value={u}>{u === "Mound" ? "Per Mound (40 kg)" : "Per KG"}</option>)}
                          </select>
                        </td>
                        <td className="py-1.5 px-2">
                          <Input type="number" value={r.rate} onChange={(e) => updateRow(i, "rate", e.target.value)} placeholder="0" className="h-8" />
                          {r.ratePer === "Mound" && r.rateN > 0 && <div className="text-[10px] text-gray-400 mt-0.5">= Rs {n(r.rateN / 40)} / kg</div>}
                        </td>
                        <td className="py-1.5 px-2 text-right font-medium text-gray-800 tabular-nums whitespace-nowrap">{formatCurrency(r.amount)}
                          {r.ratePer === "Mound" && r.qtyN > 0 && <div className="text-[10px] font-normal text-gray-400">{n(r.qtyN / 40)} mound × {n(r.rateN)}</div>}
                        </td>
                        <td className="py-1.5 px-1">
                          <button onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))} disabled={rows.length === 1}
                            className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30" title="Remove row">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-purple-50 border-t-2 border-purple-200 font-semibold">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-2 text-gray-800">Total</td>
                      <td className="py-2.5 px-2 text-gray-800 tabular-nums whitespace-nowrap">{n(totalWeight)} KG</td>
                      <td className="py-2.5 px-2 text-xs font-normal text-gray-500 whitespace-nowrap">{n(totalWeight / 40)} mound</td>
                      <td className="py-2.5 px-2 text-gray-800 tabular-nums">{n(totalRate)}</td>
                      <td className="py-2.5 px-2 text-right text-purple-800 tabular-nums whitespace-nowrap">{formatCurrency(totalAmount)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <datalist id="gala-products">
                {products.map((p: any) => <option key={p.id} value={p.name} />)}
              </datalist>
              <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={() => setRows((prev) => [...prev, emptyRow()])}>
                <Plus className="w-4 h-4" /> Add Row
              </Button>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-600">Notes (optional)</Label>
              <Textarea className="mt-1" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional details..." />
            </div>

            <p className="text-xs text-gray-500">
              On save, {formatCurrency(totalAmount)} goes to the buyer&apos;s ledger as unreceived and to the seller&apos;s ledger as unpaid.
              Use the Received / Paid buttons after saving to record the money.
            </p>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1" disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
                {saving ? "Saving..." : editingId ? "Update Entry" : "Save Entry"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* After saving a new entry: Received / Paid */}
      <Dialog open={!!savedEntry} onOpenChange={(o) => { if (!o) setSavedEntry(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Entry #{savedEntry?.entryNo} saved</DialogTitle></DialogHeader>
          {savedEntry && (
            <div className="space-y-4">
              <div className="rounded-lg bg-purple-50 p-3 text-sm space-y-1">
                <div className="flex justify-between gap-2"><span className="text-gray-500">Total</span><span className="font-bold">{formatCurrency(savedEntry.totalAmount)}</span></div>
                <div className="flex justify-between gap-2"><span className="text-gray-500">Buyer — {buyerName(savedEntry)}</span><span className="text-blue-700">Unreceived</span></div>
                <div className="flex justify-between gap-2"><span className="text-gray-500">Seller — {sellerName(savedEntry)}</span><span className="text-orange-700">Unpaid</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => openPay(savedEntry, "RECEIVE")}>Received</Button>
                <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => openPay(savedEntry, "PAY")}>Paid</Button>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setSavedEntry(null)}>Later</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Received from buyer / Paid to seller */}
      <Dialog open={!!payFor} onOpenChange={(o) => { if (!o) setPayFor(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{payFor?.kind === "RECEIVE" ? "Received from Buyer" : "Paid to Seller"}{payFor ? ` — #${payFor.entry.entryNo}` : ""}</DialogTitle>
          </DialogHeader>
          {payFor && (() => {
            const receive = payFor.kind === "RECEIVE"
            const party = receive ? buyerName(payFor.entry) : sellerName(payFor.entry)
            const hasLedger = receive ? !!payFor.entry.customerId : !!(payFor.entry.farmerId || payFor.entry.supplierId)
            const left = receive ? leftToReceive(payFor.entry) : leftToPay(payFor.entry)
            return (
              <div className="space-y-4">
                <div className={`rounded-lg p-3 text-sm space-y-1 ${receive ? "bg-blue-50" : "bg-orange-50"}`}>
                  <div className="flex justify-between gap-2"><span className="text-gray-500">{receive ? "Buyer" : "Seller"}</span><span className="font-medium">{party}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Total</span><span>{formatCurrency(payFor.entry.totalAmount)}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-gray-500">{receive ? "Unreceived" : "Unpaid"}</span><span className="font-bold">{formatCurrency(left)}</span></div>
                </div>
                <div>
                  <Label>Amount</Label>
                  <Input type="number" autoFocus value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                </div>
                <div>
                  <Label>Method</Label>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                {payMethod === "BANK_TRANSFER" && (
                  <div>
                    <Label>{receive ? "Received into bank account *" : "Paid from bank account *"}</Label>
                    {banks.length === 0 ? (
                      <p className="text-xs text-red-600 mt-1">No bank accounts yet — add one on the Banks page first.</p>
                    ) : (
                      <div className="mt-1">
                        <SearchableSelect
                          value={payBankId}
                          onValueChange={setPayBankId}
                          placeholder="Select bank..."
                          searchPlaceholder="Search bank or account no..."
                          emptyText="No banks"
                          options={banks.map((b: any) => ({ value: b.id, label: b.name, sub: b.accountNumber || undefined }))}
                        />
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <Label>Notes (optional)</Label>
                  <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Optional..." />
                </div>
                <p className="text-xs text-gray-500">
                  {hasLedger
                    ? `Goes to ${party}'s ledger as ${receive ? "received" : "paid"}.`
                    : `${party} is walk-in (no ledger) — only this entry is updated.`}
                  {payMethod === "BANK_TRANSFER" && payBankId && (() => {
                    const b = banks.find((x: any) => x.id === payBankId)
                    const amt = parseFloat(payAmount) || 0
                    return b ? ` ${formatCurrency(amt)} ${receive ? "goes into" : "comes out of"} ${b.name}.` : ""
                  })()}
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setPayFor(null)} disabled={paying}>Cancel</Button>
                  <Button className={`flex-1 ${receive ? "bg-blue-600 hover:bg-blue-700" : "bg-orange-600 hover:bg-orange-700"}`} onClick={handlePay} disabled={paying}>
                    {paying ? "Saving..." : receive ? "Save Received" : "Save Paid"}
                  </Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
