"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { VoiceSearch } from "@/components/voice-search"
import { formatCurrency, formatDate } from "@/lib/utils"
import { buildPrintHeader, escapeHtml, reportCSS } from "@/lib/print-utils"
import { recordCode } from "@/lib/record-code"
import { galaItemsText } from "@/lib/gala"
import { Printer, Scale, X } from "lucide-react"

const n = (v: number) => (v || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })

// Gala Mandi report: filter by date, buyer, seller and search (entry no, ID, product, name).
export default function GalaMandiReportPage() {
  const [entries, setEntries] = useState<any[]>([])
  const [traders, setTraders] = useState<any[]>([])
  const [farmers, setFarmers] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [shop, setShop] = useState<any>(null)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [seller, setSeller] = useState("")          // "farmer_<id>" | "supplier_<id>"
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const get = (url: string, key: string, set: (v: any[]) => void) =>
      fetch(url).then((r) => r.json()).then((d) => set(d[key] || [])).catch(() => {})
    get("/api/customers?all=true", "customers", setTraders)
    get("/api/farmers", "farmers", setFarmers)
    get("/api/suppliers", "suppliers", setSuppliers)
    fetch("/api/settings").then((r) => r.json()).then((d) => setShop(d.shop || null)).catch(() => {})
  }, [])

  useEffect(() => {
    const qs = new URLSearchParams()
    if (from) qs.set("from", from)
    if (to) qs.set("to", to)
    if (customerId) qs.set("customerId", customerId)
    if (seller) qs.set("seller", seller)
    setLoading(true)
    fetch(`/api/reports/gala?${qs}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEntries(d.entries || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [from, to, customerId, seller])

  const buyerName = (e: any) => e.customer?.name || e.walkInBuyer || "—"
  const sellerName = (e: any) => e.farmer?.name || e.supplier?.name || e.walkInSeller || "—"
  const unreceived = (e: any) => Math.max(0, (e.totalAmount || 0) - (e.receivedAmount || 0))
  const unpaid = (e: any) => Math.max(0, (e.totalAmount || 0) - (e.paidAmount || 0))

  const q = search.trim().toLowerCase()
  const shown = entries.filter((e) =>
    !q ||
    buyerName(e).toLowerCase().includes(q) ||
    sellerName(e).toLowerCase().includes(q) ||
    String(e.entryNo).toLowerCase() === q.replace(/^#/, "") ||
    recordCode("gala", e.id).toLowerCase().includes(q) ||
    galaItemsText(e.items).toLowerCase().includes(q),
  )
  const sum = (f: (e: any) => number) => shown.reduce((s, e) => s + (f(e) || 0), 0)
  const totals = {
    weight: sum((e) => e.totalWeight),
    amount: sum((e) => e.totalAmount),
    received: sum((e) => e.receivedAmount),
    paid: sum((e) => e.paidAmount),
    unreceived: sum(unreceived),
    unpaid: sum(unpaid),
  }

  const buyer = traders.find((t) => t.id === customerId)
  const sellerOptions = [
    ...farmers.map((f: any) => ({ value: `farmer_${f.id}`, label: f.name, sub: `Farmer${f.village ? ` · ${f.village}` : ""}` })),
    ...suppliers.map((s: any) => ({ value: `supplier_${s.id}`, label: s.name, sub: "Supplier" })),
  ]
  const sellerLabel = sellerOptions.find((o) => o.value === seller)?.label
  const period = from || to ? `${from ? formatDate(from) : "Start"} — ${to ? formatDate(to) : "Today"}` : "All time"
  const hasFilters = !!(from || to || customerId || seller || search)

  function print() {
    const x = (v: unknown) => escapeHtml(v ?? "—")
    const rows = shown.map((e, i) => `<tr>
      <td>${i + 1}</td><td>${formatDate(e.entryDate)}</td><td>#${x(e.entryNo)}<div style="font-size:9px;color:#7c3aed">${recordCode("gala", e.id)}</div></td>
      <td>${x(sellerName(e))}</td><td>${x(buyerName(e))}</td><td>${x(galaItemsText(e.items))}</td>
      <td style="text-align:right">${n(e.totalWeight)}</td><td style="text-align:right">${n(e.totalAmount)}</td>
      <td style="text-align:right">${n(e.receivedAmount)}</td><td style="text-align:right">${n(e.paidAmount)}</td>
    </tr>`).join("")
    const filters = [`Period: ${period}`, buyer && `Buyer: ${buyer.name}`, sellerLabel && `Seller: ${sellerLabel}`, search && `Search: "${search}"`]
      .filter(Boolean).map((f) => x(f)).join(" · ")
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<html><head><title>Gala Mandi Report</title>
<style>${reportCSS} body { max-width: 1100px; margin: 0 auto; }</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div><div class="doc-title">Gala Mandi Report</div><div class="doc-sub">${filters}</div></div>
  <div class="doc-meta"><div>${shown.length} entries</div><div>Printed: ${formatDate(new Date())}</div></div>
</div>
<div class="body-pad">
  <table>
    <thead><tr><th>#</th><th>Date</th><th>Entry / ID</th><th>Seller</th><th>Buyer</th><th>Products</th>
      <th style="text-align:right">Weight (KG)</th><th style="text-align:right">Amount</th><th style="text-align:right">Received</th><th style="text-align:right">Paid</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="10" style="text-align:center">No entries</td></tr>`}</tbody>
    <tfoot><tr><td colspan="6"><strong>Total</strong></td>
      <td style="text-align:right"><strong>${n(totals.weight)}</strong></td><td style="text-align:right"><strong>${n(totals.amount)}</strong></td>
      <td style="text-align:right"><strong>${n(totals.received)}</strong></td><td style="text-align:right"><strong>${n(totals.paid)}</strong></td></tr></tfoot>
  </table>
  <p style="font-size:11px;margin-top:10px">Unreceived from buyers: <strong>PKR ${n(totals.unreceived)}</strong> · Unpaid to sellers: <strong>PKR ${n(totals.unpaid)}</strong></p>
</div>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`)
    w.document.close()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gala Mandi Report</h2>
          <p className="text-gray-500 text-sm">Entries by date, buyer and seller, with search by entry no, ID, product or name</p>
        </div>
        <Button onClick={print} variant="outline" className="gap-2" disabled={loading || shown.length === 0}>
          <Printer className="w-4 h-4" /> Print Report
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500 font-medium">From Date</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">To Date</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 font-medium">Buyer (Trader)</label>
              <SearchableSelect
                value={customerId || "all"}
                onValueChange={(v) => setCustomerId(v === "all" ? "" : v)}
                searchPlaceholder="Search buyer..."
                options={[{ value: "all", label: "All buyers" }, ...traders.map((t: any) => ({ value: t.id, label: t.name, sub: t.phone || undefined }))]}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 font-medium">Seller (Farmer / Supplier)</label>
              <SearchableSelect
                value={seller || "all"}
                onValueChange={(v) => setSeller(v === "all" ? "" : v)}
                searchPlaceholder="Search seller..."
                options={[{ value: "all", label: "All sellers" }, ...sellerOptions]}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <VoiceSearch value={search} onChange={setSearch} placeholder="Search name, entry no, ID (GM-…), product..." className="flex-1" />
            {hasFilters && (
              <Button variant="ghost" size="sm" className="gap-1 text-gray-500" onClick={() => { setFrom(""); setTo(""); setCustomerId(""); setSeller(""); setSearch("") }}>
                <X className="w-4 h-4" /> Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500 font-medium uppercase">Entries</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{shown.length}</p>
          <p className="text-xs text-gray-500 mt-0.5 tabular-nums">{n(totals.weight)} KG</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500 font-medium uppercase">Total Amount</p>
          <p className="text-xl font-bold text-purple-700 mt-1">{formatCurrency(totals.amount)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500 font-medium uppercase">Received (buyers)</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totals.received)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500 font-medium uppercase">Unreceived</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{formatCurrency(totals.unreceived)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500 font-medium uppercase">Unpaid (sellers)</p>
          <p className="text-xl font-bold text-orange-700 mt-1">{formatCurrency(totals.unpaid)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Paid {formatCurrency(totals.paid)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="w-4 h-4" /> Gala Mandi Entries
            <span className="text-gray-400 font-normal text-sm">({period}{buyer ? ` · ${buyer.name}` : ""}{sellerLabel ? ` · ${sellerLabel}` : ""})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-blue-50 border-b border-t">
                <tr className="text-xs uppercase text-gray-600">
                  <th className="px-3 py-3 text-left font-semibold">Date</th>
                  <th className="px-3 py-3 text-left font-semibold">Entry / ID</th>
                  <th className="px-3 py-3 text-left font-semibold">Seller</th>
                  <th className="px-3 py-3 text-left font-semibold">Buyer</th>
                  <th className="px-3 py-3 text-left font-semibold">Products</th>
                  <th className="px-3 py-3 text-right font-semibold">Weight (KG)</th>
                  <th className="px-3 py-3 text-right font-semibold">Amount</th>
                  <th className="px-3 py-3 text-right font-semibold">Received</th>
                  <th className="px-3 py-3 text-right font-semibold">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map((e) => (
                  <tr key={e.id} className="hover:bg-blue-50 align-top">
                    <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{formatDate(e.entryDate)}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-900">#{e.entryNo}</div>
                      <div className="font-mono text-[11px] text-purple-700">{recordCode("gala", e.id)}</div>
                    </td>
                    <td className="px-3 py-3 font-medium text-gray-900" dir="auto">{sellerName(e)}</td>
                    <td className="px-3 py-3 font-medium text-gray-900" dir="auto">{buyerName(e)}</td>
                    <td className="px-3 py-3 text-xs text-gray-600" dir="auto">{galaItemsText(e.items) || "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{n(e.totalWeight)}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatCurrency(e.totalAmount)}</td>
                    <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                      {formatCurrency(e.receivedAmount || 0)}
                      {unreceived(e) > 0 && <div className="text-[11px] text-blue-700">Unreceived {formatCurrency(unreceived(e))}</div>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                      {formatCurrency(e.paidAmount || 0)}
                      {unpaid(e) > 0 && <div className="text-[11px] text-orange-700">Unpaid {formatCurrency(unpaid(e))}</div>}
                    </td>
                  </tr>
                ))}
                {!loading && shown.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No entries found for these filters</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
                )}
              </tbody>
              {shown.length > 0 && (
                <tfoot className="bg-blue-50 border-t-2 border-blue-300 font-bold">
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-gray-700">Total — {shown.length} entries</td>
                    <td className="px-3 py-3 text-right tabular-nums">{n(totals.weight)}</td>
                    <td className="px-3 py-3 text-right text-purple-700 tabular-nums">{formatCurrency(totals.amount)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(totals.received)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(totals.paid)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
