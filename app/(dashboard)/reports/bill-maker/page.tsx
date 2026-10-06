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
import { FileText, Printer, X } from "lucide-react"

const n = (v: number) => (v || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })

// Bill Maker report: filter by date, trader name and search (bill no, ID, product, name).
export default function BillMakerReportPage() {
  const [bills, setBills] = useState<any[]>([])
  const [traders, setTraders] = useState<any[]>([])
  const [shop, setShop] = useState<any>(null)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/customers?all=true").then((r) => r.json()).then((d) => setTraders(d.customers || [])).catch(() => {})
    fetch("/api/settings").then((r) => r.json()).then((d) => setShop(d.shop || null)).catch(() => {})
  }, [])

  useEffect(() => {
    const qs = new URLSearchParams()
    if (from) qs.set("from", from)
    if (to) qs.set("to", to)
    if (customerId) qs.set("customerId", customerId)
    setLoading(true)
    fetch(`/api/reports/bills?${qs}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setBills(d.bills || []))
      .catch(() => setBills([]))
      .finally(() => setLoading(false))
  }, [from, to, customerId])

  const traderName = (b: any) => b.customer?.name || b.name || "—"
  const q = search.trim().toLowerCase()
  const shown = bills.filter((b) =>
    !q ||
    traderName(b).toLowerCase().includes(q) ||
    String(b.name || "").toLowerCase().includes(q) ||
    String(b.billNo || "").toLowerCase().includes(q) ||
    recordCode("bill", b).toLowerCase().includes(q) ||
    String(b.product || "").toLowerCase().includes(q),
  )
  const sum = (k: string) => shown.reduce((s, b) => s + (b[k] || 0), 0)
  const trader = traders.find((t) => t.id === customerId)
  const period = from || to ? `${from ? formatDate(from) : "Start"} — ${to ? formatDate(to) : "Today"}` : "All time"
  const hasFilters = !!(from || to || customerId || search)

  function print() {
    const x = (v: unknown) => escapeHtml(v ?? "—")
    const rows = shown.map((b, i) => `<tr>
      <td>${i + 1}</td><td>${formatDate(b.billDate)}</td><td>${x(b.billNo)}<div style="font-size:9px;color:#7c3aed">${recordCode("bill", b)}</div></td>
      <td>${x(traderName(b))}</td><td>${x(b.product)}</td>
      <td style="text-align:right">${n(b.totalWeight)}</td><td style="text-align:right">${n(b.safiWeight)}</td>
      <td style="text-align:right">${n(b.amount)}</td>
    </tr>`).join("")
    const filters = [`Period: ${period}`, trader && `Trader: ${trader.name}`, search && `Search: "${search}"`].filter(Boolean).map((f) => x(f)).join(" · ")
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<html><head><title>Bill Maker Report</title>
<style>${reportCSS} body { max-width: 1000px; margin: 0 auto; }</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div><div class="doc-title">Bill Maker Report</div><div class="doc-sub">${filters}</div></div>
  <div class="doc-meta"><div>${shown.length} bills</div><div>Printed: ${formatDate(new Date())}</div></div>
</div>
<div class="body-pad">
  <table>
    <thead><tr><th>#</th><th>Date</th><th>Bill No / ID</th><th>Trader</th><th>Product</th><th style="text-align:right">Total Wt (KG)</th><th style="text-align:right">Safi Wt (KG)</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="8" style="text-align:center">No bills</td></tr>`}</tbody>
    <tfoot><tr><td colspan="5"><strong>Total</strong></td>
      <td style="text-align:right"><strong>${n(sum("totalWeight"))}</strong></td><td style="text-align:right"><strong>${n(sum("safiWeight"))}</strong></td>
      <td style="text-align:right"><strong>PKR ${n(sum("amount"))}</strong></td></tr></tfoot>
  </table>
</div>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`)
    w.document.close()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bill Maker Report</h2>
          <p className="text-gray-500 text-sm">Bills by date and trader, with search by bill no, ID, product or name</p>
        </div>
        <Button onClick={print} variant="outline" className="gap-2" disabled={loading || shown.length === 0}>
          <Printer className="w-4 h-4" /> Print Report
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500 font-medium">From Date</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">To Date</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 font-medium">Trader</label>
              <SearchableSelect
                value={customerId || "all"}
                onValueChange={(v) => setCustomerId(v === "all" ? "" : v)}
                searchPlaceholder="Search trader..."
                options={[{ value: "all", label: "All traders" }, ...traders.map((t: any) => ({ value: t.id, label: t.name, sub: t.phone || undefined }))]}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <VoiceSearch value={search} onChange={setSearch} placeholder="Search name, bill no, ID, product..." className="flex-1" />
            {hasFilters && (
              <Button variant="ghost" size="sm" className="gap-1 text-gray-500" onClick={() => { setFrom(""); setTo(""); setCustomerId(""); setSearch("") }}>
                <X className="w-4 h-4" /> Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500 font-medium uppercase">Bills</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{shown.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500 font-medium uppercase">Total Weight</p>
          <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">{n(sum("totalWeight"))} KG</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500 font-medium uppercase">Safi Weight</p>
          <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">{n(sum("safiWeight"))} KG</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500 font-medium uppercase">Total Amount</p>
          <p className="text-xl font-bold text-purple-700 mt-1">{formatCurrency(sum("amount"))}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" /> Bills
            <span className="text-gray-400 font-normal text-sm">({period}{trader ? ` · ${trader.name}` : ""})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-blue-50 border-b border-t">
                <tr className="text-xs uppercase text-gray-600">
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Bill No / ID</th>
                  <th className="px-4 py-3 text-left font-semibold">Trader</th>
                  <th className="px-4 py-3 text-left font-semibold">Product</th>
                  <th className="px-4 py-3 text-right font-semibold">Total Wt (KG)</th>
                  <th className="px-4 py-3 text-right font-semibold">Safi Wt (KG)</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map((b) => (
                  <tr key={b.id} className="hover:bg-blue-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(b.billDate)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{b.billNo}</div>
                      <div className="font-mono text-[11px] text-purple-700">{recordCode("bill", b)}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900" dir="auto">{traderName(b)}</td>
                    <td className="px-4 py-3 text-gray-600" dir="auto">{b.product || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{n(b.totalWeight)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{n(b.safiWeight)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(b.amount)}</td>
                  </tr>
                ))}
                {!loading && shown.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No bills found for these filters</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
                )}
              </tbody>
              {shown.length > 0 && (
                <tfoot className="bg-blue-50 border-t-2 border-blue-300 font-bold">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-gray-700">Total — {shown.length} bills</td>
                    <td className="px-4 py-3 text-right tabular-nums">{n(sum("totalWeight"))}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{n(sum("safiWeight"))}</td>
                    <td className="px-4 py-3 text-right text-purple-700 tabular-nums">{formatCurrency(sum("amount"))}</td>
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
