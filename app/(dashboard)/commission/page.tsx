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
import { Plus, Search, Percent, CreditCard, Printer, Trash2, X } from "lucide-react"

export default function CommissionPage() {
  const [commissions, setCommissions] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [farmers, setFarmers] = useState<any[]>([])
  const [shop, setShop] = useState<any>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  // New commission modal state
  const [showNew, setShowNew] = useState(false)
  const [customerId, setCustomerId] = useState("")        // "" = none selected, "walkin" = walk-in
  const [walkInCustomer, setWalkInCustomer] = useState("")
  const [partyId, setPartyId] = useState("")              // "" = none, "walkin" = walk-in, "farmer_X" or supplier id
  const [walkInSeller, setWalkInSeller] = useState("")
  const [commodity, setCommodity] = useState("")
  const [bags, setBags] = useState("")
  const [weight, setWeight] = useState("")
  const [mound, setMound] = useState("")
  const [rate, setRate] = useState("")
  const [totalValue, setTotalValue] = useState("")
  const [commissionRate, setCommissionRate] = useState("2.5")
  const [labourAmount, setLabourAmount] = useState("0")
  const [paidAmount, setPaidAmount] = useState("0")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  // Payment modal state
  const [payTarget, setPayTarget] = useState<any>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState("CASH")
  const [payNotes, setPayNotes] = useState("")
  const [paying, setPaying] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch(`/api/commissions/${deleteTarget.id}`, { method: "DELETE" })
    setDeleting(false)
    if (!res.ok) { alert("Failed to delete commission"); return }
    setDeleteTarget(null)
    loadData()
  }

  async function safeFetch(url: string, fallback: any = {}) {
    try {
      const r = await fetch(url)
      if (!r.ok) return fallback
      return await r.json()
    } catch {
      return fallback
    }
  }

  async function loadData() {
    setLoading(true)
    const [cm, cu, su, fa, sh] = await Promise.all([
      safeFetch("/api/commissions", { commissions: [] }),
      safeFetch("/api/customers", { customers: [] }),
      safeFetch("/api/suppliers", { suppliers: [] }),
      safeFetch("/api/farmers", { farmers: [] }),
      safeFetch("/api/settings", { shop: null }),
    ])
    setCommissions(cm.commissions || [])
    setCustomers(cu.customers || [])
    setSuppliers(su.suppliers || [])
    setFarmers(fa.farmers || [])
    setShop(sh.shop || null)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    const f = parseFloat(weight)
    const b = parseFloat(bags)
    if (f > 0 && b > 0) setMound(((f * b) / 40).toFixed(2))
    else setMound("")
  }, [weight, bags])

  useEffect(() => {
    const m = parseFloat(mound)
    const r = parseFloat(rate)
    if (m > 0 && r > 0) setTotalValue((m * r).toFixed(2))
  }, [mound, rate])

  const total = parseFloat(totalValue || "0")
  const commRate = commissionRate !== "" ? parseFloat(commissionRate) : 0
  const commAmount = total > 0 ? parseFloat(((total * commRate) / 100).toFixed(2)) : 0
  const labourAmt = parseFloat(labourAmount || "0")
  // Seller payable = total minus commission only (labour is deducted from commission, not from seller)
  const sellerPayable = total > 0 ? parseFloat((total - commAmount).toFixed(2)) : 0
  const netCommission = commAmount - labourAmt
  const balance = total - parseFloat(paidAmount || "0")

  function resetNewForm() {
    setCustomerId(""); setWalkInCustomer("")
    setPartyId(""); setWalkInSeller("")
    setCommodity(""); setBags(""); setWeight(""); setMound("")
    setRate(""); setTotalValue(""); setCommissionRate("2.5"); setLabourAmount("0"); setPaidAmount("0"); setNotes("")
  }

  async function handleSave() {
    const hasCustomer = customerId && customerId !== "walkin"
    const hasWalkIn = customerId === "walkin" && walkInCustomer.trim()
    if (!hasCustomer && !hasWalkIn) return alert("Please select or enter a buyer")
    if (!totalValue || parseFloat(totalValue) <= 0) return alert("Total value is required")

    setSaving(true)
    try {
      const isFarmer = partyId.startsWith("farmer_")
      const isWalkInSeller = partyId === "walkin"
      const farmerId = isFarmer ? partyId.replace("farmer_", "") : null
      const supplierId = (!isFarmer && !isWalkInSeller && partyId) ? partyId : null

      const res = await fetch("/api/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: hasCustomer ? customerId : null,
          walkInCustomer: hasWalkIn ? walkInCustomer.trim() : null,
          farmerId,
          supplierId,
          walkInSeller: isWalkInSeller ? walkInSeller.trim() || null : null,
          commodity,
          bags,
          weight,
          rate,
          totalValue,
          commissionRate,
          labourAmount,
          paidAmount,
          notes,
        }),
      })
      if (res.ok) {
        setShowNew(false)
        resetNewForm()
        loadData()
      } else {
        const d = await res.json().catch(() => ({}))
        alert(d?.error || "Failed to save commission")
      }
    } finally {
      setSaving(false)
    }
  }

  async function handlePay() {
    if (!payAmount || parseFloat(payAmount) <= 0) return alert("Enter a valid amount")
    setPaying(true)
    try {
      const res = await fetch(`/api/commissions/${payTarget.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(payAmount), method: payMethod, notes: payNotes }),
      })
      if (res.ok) {
        setPayTarget(null); setPayAmount(""); setPayMethod("CASH"); setPayNotes("")
        loadData()
      } else {
        const d = await res.json().catch(() => ({}))
        alert(d?.error || "Failed to record payment")
      }
    } finally {
      setPaying(false)
    }
  }

  const filtered = commissions.filter((c) => {
    const q = search.toLowerCase()
    const buyerName = c.customer?.name || c.walkInCustomer || ""
    const sellerName = c.farmer?.name || c.supplier?.name || c.walkInSeller || ""
    return (
      buyerName.toLowerCase().includes(q) ||
      sellerName.toLowerCase().includes(q) ||
      (c.commodity || "").toLowerCase().includes(q)
    )
  })

  const totalCommEarned = commissions.reduce((s, c) => s + c.commissionAmount, 0)
  const totalPending = commissions.filter((c) => c.status !== "PAID").reduce((s, c) => s + c.balance, 0)

  // Seller copy: shows only what seller will receive — buyer total and commission hidden
  function printForSeller(c: any) {
    const seller = c.farmer?.name || c.supplier?.name || c.walkInSeller || "—"
    const buyer = c.customer?.name || c.walkInCustomer || "—"
    const ref = c.id.slice(-6).toUpperCase()
    const date = new Date(c.createdAt).toLocaleDateString("en-PK")
    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>Seller Copy — ${ref}</title>
<style>${receiptCSS}</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div>
    <div class="doc-title">Seller Copy</div>
    <div class="doc-sub">Ref: #${ref} &nbsp;|&nbsp; ${date}</div>
  </div>
  <div class="doc-meta"><div>${date}</div></div>
</div>
<div class="body-pad">
  <div class="info-grid">
    <div><div class="lbl">Seller</div><div class="val">${seller}</div></div>
    <div><div class="lbl">Buyer</div><div class="val">${buyer}</div></div>
    ${c.commodity ? `<div><div class="lbl">Commodity</div><div class="val">${c.commodity}</div></div>` : ""}
    ${c.rate ? `<div><div class="lbl">Rate</div><div class="val">PKR ${c.rate}/kg</div></div>` : ""}
    ${c.bags ? `<div><div class="lbl">Bags</div><div class="val">${c.bags}</div></div>` : ""}
    ${c.weight ? `<div><div class="lbl">Weight</div><div class="val">${c.weight} KG</div></div>` : ""}
  </div>
  <table>
    <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      ${c.weight ? `<tr><td>Weight</td><td style="text-align:right">${c.weight} KG</td></tr>` : ""}
      ${c.bags ? `<tr><td>Bags</td><td style="text-align:right">${c.bags} bags</td></tr>` : ""}
    </tbody>
    <tfoot>
      <tr><td><strong>Amount Payable to You</strong></td><td style="text-align:right;color:#1d4ed8" class="amount-big">PKR ${(c.sellerPayable || 0).toLocaleString()}</td></tr>
    </tfoot>
  </table>
  ${c.notes ? `<p style="font-size:11px;color:#555;margin-top:8px"><strong>Notes:</strong> ${c.notes}</p>` : ""}
  <div class="sig-row">
    <span>Seller Signature: _______________________</span>
    <span>Authorized By: _______________________</span>
  </div>
</div>
</body></html>`)
    w.print()
  }

  // Buyer copy: shows only what buyer owes — seller amount and commission hidden
  function printForBuyer(c: any) {
    const seller = c.farmer?.name || c.supplier?.name || c.walkInSeller || "—"
    const buyer = c.customer?.name || c.walkInCustomer || "—"
    const ref = c.id.slice(-6).toUpperCase()
    const date = new Date(c.createdAt).toLocaleDateString("en-PK")
    const statusCls = c.status === "PAID" ? "PAID" : c.status === "PARTIAL" ? "PARTIAL" : "PENDING"
    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>Buyer Copy — ${ref}</title>
<style>${receiptCSS}</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div>
    <div class="doc-title">Buyer Copy</div>
    <div class="doc-sub">Ref: #${ref} &nbsp;|&nbsp; ${date}</div>
  </div>
  <div class="doc-meta"><div>${date}</div><span class="badge badge-${statusCls}">${c.status}</span></div>
</div>
<div class="body-pad">
  <div class="info-grid">
    <div><div class="lbl">Buyer</div><div class="val">${buyer}</div></div>
    <div><div class="lbl">Seller</div><div class="val">${seller}</div></div>
    ${c.commodity ? `<div><div class="lbl">Commodity</div><div class="val">${c.commodity}</div></div>` : ""}
    ${c.rate ? `<div><div class="lbl">Rate</div><div class="val">PKR ${c.rate}/kg</div></div>` : ""}
    ${c.bags ? `<div><div class="lbl">Bags</div><div class="val">${c.bags}</div></div>` : ""}
    ${c.weight ? `<div><div class="lbl">Weight</div><div class="val">${c.weight} KG</div></div>` : ""}
  </div>
  <table>
    <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      ${c.weight ? `<tr><td>Weight</td><td style="text-align:right">${c.weight} KG</td></tr>` : ""}
      ${c.bags ? `<tr><td>Bags</td><td style="text-align:right">${c.bags} bags</td></tr>` : ""}
      <tr><td>Total Amount</td><td style="text-align:right">PKR ${(c.totalValue || 0).toLocaleString()}</td></tr>
      <tr><td>Paid</td><td style="text-align:right;color:#15803d">PKR ${(c.paidAmount || 0).toLocaleString()}</td></tr>
    </tbody>
    <tfoot>
      <tr><td><strong>Balance Due</strong></td><td style="text-align:right;color:${c.balance > 0 ? "#b91c1c" : "#15803d"}" class="amount-big">PKR ${(c.balance || 0).toLocaleString()}</td></tr>
    </tfoot>
  </table>
  ${c.notes ? `<p style="font-size:11px;color:#555;margin-top:8px"><strong>Notes:</strong> ${c.notes}</p>` : ""}
  <div class="sig-row">
    <span>Buyer Signature: _______________________</span>
    <span>Authorized By: _______________________</span>
  </div>
</div>
</body></html>`)
    w.print()
  }

  function printAllCommissions(list: any[]) {
    const rows = list.map((c, i) => {
      const seller = c.farmer?.name || c.supplier?.name || c.walkInSeller || "—"
      const buyer = c.customer?.name || c.walkInCustomer || "—"
      const commodity = [c.commodity, c.bags ? `${c.bags} bags` : null, c.weight ? `${c.weight} kg` : null].filter(Boolean).join(", ")
      const statusCls = c.status === "PAID" ? "PAID" : c.status === "PARTIAL" ? "PARTIAL" : "PENDING"
      return `<tr>
        <td>${i + 1}</td>
        <td>${seller}</td>
        <td>${buyer}</td>
        <td>${commodity || "—"}</td>
        <td style="text-align:right">PKR ${(c.totalValue || 0).toLocaleString()}</td>
        <td style="text-align:right;color:#15803d">PKR ${(c.paidAmount || 0).toLocaleString()}</td>
        <td style="text-align:right;color:${c.balance > 0 ? "#b91c1c" : "#15803d"}">PKR ${(c.balance || 0).toLocaleString()}</td>
        <td><span class="badge badge-${statusCls}">${c.status}</span></td>
        <td>${new Date(c.createdAt).toLocaleDateString("en-PK")}</td>
      </tr>`
    }).join("")
    const totVal = list.reduce((s, c) => s + (c.totalValue || 0), 0)
    const totPaid = list.reduce((s, c) => s + (c.paidAmount || 0), 0)
    const totBal = list.reduce((s, c) => s + (c.balance || 0), 0)
    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>All Commissions</title>
<style>${reportCSS}</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div>
    <div class="doc-title">Commission Transactions</div>
    <div class="doc-sub">Printed on ${new Date().toLocaleDateString("en-PK")} &nbsp;|&nbsp; ${list.length} entries</div>
  </div>
  <div class="doc-meta"><div>${new Date().toLocaleString("en-PK")}</div></div>
</div>
<div class="body-pad">
<table>
  <thead><tr>
    <th>#</th><th>Seller</th><th>Buyer</th><th>Commodity</th>
    <th style="text-align:right">Total Value</th>
    <th style="text-align:right">Paid</th>
    <th style="text-align:right">Balance</th>
    <th>Status</th><th>Date</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr>
    <td colspan="4" style="text-align:right">Totals</td>
    <td style="text-align:right">PKR ${totVal.toLocaleString()}</td>
    <td style="text-align:right;color:#15803d">PKR ${totPaid.toLocaleString()}</td>
    <td style="text-align:right">PKR ${totBal.toLocaleString()}</td>
    <td colspan="2"></td>
  </tr></tfoot>
</table>
</div>
</body></html>`)
    w.print()
  }

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
          <h2 className="text-2xl font-bold text-gray-900">Commission</h2>
          <p className="text-gray-500 text-sm">{commissions.length} total transactions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => printAllCommissions(filtered)}>
            <Printer className="w-4 h-4" /> Print All
          </Button>
          <Button onClick={() => { resetNewForm(); setShowNew(true) }}>
            <Plus className="w-4 h-4" /> New Commission
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Total Commission Earned</p>
            <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalCommEarned)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Pending from Customers</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalPending)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search by customer, seller, commodity..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-200">
                    {["#", "Seller", "Buyer", "Commodity", "Total Value", "Comm %", "Commission", "Labour", "Seller Payable", "Paid", "Balance", "Status", "Date", "Action", ""].map((h) => (
                      <th key={h} className="text-left py-3 px-2 text-gray-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-amber-50">
                      <td className="py-3 px-2 text-gray-400 text-xs">{i + 1}</td>
                      <td className="py-3 px-2 font-medium text-gray-800">
                        {c.farmer?.name || c.supplier?.name || c.walkInSeller || <span className="text-gray-400">—</span>}
                        {c.walkInSeller && <span className="ml-1 text-xs text-orange-500">(walk-in)</span>}
                      </td>
                      <td className="py-3 px-2 font-medium text-gray-800">
                        {c.customer?.name || c.walkInCustomer}
                        {c.walkInCustomer && <span className="ml-1 text-xs text-orange-500">(walk-in)</span>}
                      </td>
                      <td className="py-3 px-2 text-gray-600">
                        {c.commodity || "—"}
                        {c.bags ? <span className="ml-1 text-xs text-gray-400">{c.bags} bags</span> : null}
                        {c.weight ? <span className="ml-1 text-xs text-gray-400">{c.weight} kg</span> : null}
                      </td>
                      <td className="py-3 px-2 text-gray-700">{formatCurrency(c.totalValue)}</td>
                      <td className="py-3 px-2 text-gray-600">{c.commissionRate}%</td>
                      <td className="py-3 px-2 text-purple-700 font-medium">{formatCurrency(c.commissionAmount)}</td>
                      <td className="py-3 px-2 text-orange-600">{c.labourAmount > 0 ? formatCurrency(c.labourAmount) : "—"}</td>
                      <td className="py-3 px-2 text-blue-700">{formatCurrency(c.sellerPayable)}</td>
                      <td className="py-3 px-2 text-purple-600">{formatCurrency(c.paidAmount)}</td>
                      <td className="py-3 px-2 text-red-600">{formatCurrency(c.balance)}</td>
                      <td className="py-3 px-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(c.status)}`}>{c.status}</span>
                      </td>
                      <td className="py-3 px-2 text-gray-500 whitespace-nowrap">{formatDate(c.createdAt)}</td>
                      <td className="py-3 px-2">
                        {c.status !== "PAID" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                            setPayTarget(c); setPayAmount(String(c.balance)); setPayMethod("CASH"); setPayNotes("")
                          }}>
                            <CreditCard className="w-3 h-3 mr-1" /> Pay
                          </Button>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex gap-1 flex-nowrap items-center">
                          <button onClick={() => printForSeller(c)} className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 whitespace-nowrap">
                            <Printer className="w-3 h-3" /> Seller
                          </button>
                          <button onClick={() => printForBuyer(c)} className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-purple-700 border border-green-200 rounded hover:bg-green-100 whitespace-nowrap">
                            <Printer className="w-3 h-3" /> Buyer
                          </button>
                          <button onClick={() => setDeleteTarget(c)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete Commission">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={15} className="text-center py-8 text-gray-400">No commissions found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Commission Modal — Redesigned */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="w-[96vw] max-w-2xl max-h-[92vh] overflow-y-auto p-0">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-600 to-orange-500 text-amber-950 px-6 py-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-50/20 flex items-center justify-center flex-shrink-0">
                <Percent className="w-5 h-5 text-amber-950" />
              </div>
              <div>
                <h2 className="text-lg font-bold">New Commission</h2>
                <p className="text-orange-100 text-xs">Fill seller, buyer, and transaction details</p>
              </div>
            </div>
            <button
              onClick={() => setShowNew(false)}
              className="text-amber-950 hover:bg-amber-50/20 rounded-lg p-1.5 transition-colors flex-shrink-0"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-5">

            {/* ── Section 1: Parties ── */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Seller & Buyer</h3>
              <div className="bg-amber-50 rounded-xl p-4 space-y-3 border border-amber-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-600">Seller (Farmer / Supplier)</Label>
                  <div className="mt-1">
                    <SearchableSelect
                      value={partyId}
                      onValueChange={(v) => { setPartyId(v); if (v !== "walkin") setWalkInSeller("") }}
                      placeholder="Select or walk-in..."
                      options={sellerOptions}
                    />
                  </div>
                  {partyId === "walkin" && (
                    <Input className="mt-2" placeholder="Enter seller name..." value={walkInSeller}
                      onChange={(e) => setWalkInSeller(e.target.value)} />
                  )}
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-600">Buyer (Customer) <span className="text-red-500">*</span></Label>
                  <div className="mt-1">
                    <SearchableSelect
                      value={customerId}
                      onValueChange={(v) => { setCustomerId(v); if (v !== "walkin") setWalkInCustomer("") }}
                      placeholder="Select or walk-in..."
                      options={customerOptions}
                    />
                  </div>
                  {customerId === "walkin" && (
                    <Input className="mt-2" placeholder="Enter buyer name..." value={walkInCustomer}
                      onChange={(e) => setWalkInCustomer(e.target.value)} />
                  )}
                </div>
              </div>
            </div>

            {/* ── Section 2: Commodity & Quantity ── */}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Commodity Details</h3>
              <div className="bg-amber-50 rounded-xl p-4 space-y-3 border border-amber-100">
              <div>
                <Label className="text-xs font-semibold text-gray-600">Commodity / Product</Label>
                <Input className="mt-1" placeholder="e.g. Wheat, Rice, Cotton, Sugar..." value={commodity}
                  onChange={(e) => setCommodity(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-600">Bags</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={bags}
                    onChange={(e) => setBags(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-600">Filling/Bag</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={weight}
                    onChange={(e) => setWeight(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-600">Mound <span className="font-normal text-gray-400">(auto)</span></Label>
                  <Input type="number" className="mt-1 bg-amber-50" placeholder="0" value={mound}
                    onChange={(e) => setMound(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-600">Rate / Bag</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={rate}
                    onChange={(e) => setRate(e.target.value)} />
                </div>
              </div>
            </div>

            {/* ── Section 3: Amounts ── */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Amounts & Commission</h3>
              <div className="bg-amber-50 rounded-xl p-4 space-y-3 border border-amber-100">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <Label className="text-xs font-semibold text-gray-600">Total Amount (PKR) <span className="text-red-500">*</span></Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">PKR</span>
                    <Input type="number" className="pl-9 font-bold" placeholder="0" value={totalValue}
                      onChange={(e) => setTotalValue(e.target.value)} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Mound × Rate</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-600">Commission %</Label>
                  <div className="relative mt-1">
                    <Input type="number" className="pr-8" placeholder="2.5" value={commissionRate}
                      onChange={(e) => setCommissionRate(e.target.value)} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-600">Labour (PKR)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">PKR</span>
                    <Input type="number" className="pl-9" placeholder="0" value={labourAmount}
                      onChange={(e) => setLabourAmount(e.target.value)} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Deducted from commission</p>
                </div>
              </div>

              {/* Live Summary */}
              {total > 0 && (
                <div className="bg-amber-50 rounded-lg border border-orange-100 p-3 mt-1">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-blue-50 rounded-lg p-2.5">
                      <p className="text-xs text-blue-500 font-medium">Buyer Owes</p>
                      <p className="font-bold text-blue-700 text-sm mt-0.5">{formatCurrency(total)}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2.5">
                      <p className="text-xs text-green-500 font-medium">Net Commission</p>
                      <p className="font-bold text-purple-700 text-sm mt-0.5">{formatCurrency(netCommission)}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2.5">
                      <p className="text-xs text-orange-500 font-medium">Seller Gets</p>
                      <p className="font-bold text-orange-700 text-sm mt-0.5">{formatCurrency(sellerPayable)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Section 4: Payment & Notes ── */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Payment & Notes</h3>
              <div className="bg-amber-50 rounded-xl p-4 space-y-3 border border-amber-100">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-600">Initial Payment (PKR)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">PKR</span>
                    <Input type="number" className="pl-9" value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-col justify-end">
                  <div className={`rounded-lg px-3 py-2.5 text-center ${balance > 0 ? "bg-red-50 border border-red-100" : "bg-green-50 border border-green-100"}`}>
                    <p className="text-xs text-gray-500">Balance Due</p>
                    <p className={`font-bold text-base ${balance > 0 ? "text-red-600" : "text-purple-600"}`}>{formatCurrency(balance)}</p>
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-600">Notes (optional)</Label>
                <Textarea className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  placeholder="Any additional details..." />
              </div>
            </div>

              </div>
            </div>

            {/* ── Action Buttons ── */}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowNew(false)} className="flex-1" disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-orange-600 hover:bg-orange-700 gap-2">
                {saving ? "Saving..." : "Create Commission"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={!!payTarget} onOpenChange={(o) => { if (!o) setPayTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {payTarget && (
            <div className="space-y-4">
              <div className="bg-amber-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Buyer:</span>
                  <span className="font-medium">{payTarget.customer?.name || payTarget.walkInCustomer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Outstanding:</span>
                  <span className="font-bold text-red-600">{formatCurrency(payTarget.balance)}</span>
                </div>
              </div>
              <div>
                <Label>Amount</Label>
                <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div>
                <Label>Method</Label>
                <SearchableSelect
                  value={payMethod}
                  onValueChange={setPayMethod}
                  options={[
                    { value: "CASH", label: "Cash" },
                    { value: "BANK_TRANSFER", label: "Bank Transfer" },
                    { value: "CHEQUE", label: "Cheque" },
                  ]}
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Optional..." />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setPayTarget(null)} className="flex-1">Cancel</Button>
                <Button onClick={handlePay} disabled={paying} className="flex-1">
                  {paying ? "Saving..." : "Record Payment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Commission Confirmation Modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              Delete Commission Entry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Reference</span>
                <span className="font-semibold">#{deleteTarget?.id?.slice(-6).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Commodity</span>
                <span className="font-semibold">{deleteTarget?.commodity || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Buyer</span>
                <span className="font-semibold">{deleteTarget?.customer?.name || deleteTarget?.walkInCustomer || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Seller</span>
                <span className="font-semibold">{deleteTarget?.farmer?.name || deleteTarget?.supplier?.name || deleteTarget?.walkInSeller || "—"}</span>
              </div>
              <div className="flex justify-between border-t pt-1.5">
                <span className="text-gray-500">Total Value</span>
                <span className="font-bold text-red-600">{formatCurrency(deleteTarget?.totalValue || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span>{deleteTarget ? formatDate(deleteTarget.createdAt) : ""}</span>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">What happens when deleted:</p>
              <p>✓ Removed from buyer (trader) ledger</p>
              <p>✓ Removed from seller (farmer/supplier) ledger</p>
              <p>✓ Commission income reversed from accounts</p>
              <p>✓ Labour expense reversed from accounts</p>
              <p>✗ This cannot be undone</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 gap-2" onClick={confirmDelete} disabled={deleting}>
                <Trash2 className="w-4 h-4" />{deleting ? "Deleting..." : "Delete Commission"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
