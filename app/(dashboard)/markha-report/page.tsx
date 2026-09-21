"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tag, Printer } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { formatDate } from "@/lib/utils"
import { buildPrintHeader, reportCSS } from "@/lib/print-utils"

const inStockOf = (l: any) => !["SOLD", "DISPATCHED", "SETTLED", "CANCELLED"].includes(l.status)

export default function MarkhaReportPage() {
  const { t } = useLang()
  const [lots, setLots] = useState<any[]>([])
  const [markhas, setMarkhas] = useState<any[]>([])
  const [shop, setShop] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [markhaFilter, setMarkhaFilter] = useState("ALL")

  async function load() {
    setLoading(true)
    const [l, m, s] = await Promise.all([
      fetch("/api/lots?status=ALL").then((r) => r.json()).catch(() => ({ lots: [] })),
      fetch("/api/markhas").then((r) => r.json()).catch(() => ({ markhas: [] })),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({ shop: null })),
    ])
    setLots(l.lots || [])
    setMarkhas(m.markhas || [])
    setShop(s.shop || null)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Build the set of markha names: saved markhas ∪ any used on lots.
  const names = (() => {
    const set = new Set<string>()
    markhas.forEach((m) => set.add(m.name))
    lots.forEach((l) => { if (l.markha1) set.add(l.markha1); if (l.markha2) set.add(l.markha2) })
    return [...set].sort()
  })()

  // Which list a name belongs to: saved slot, else whichever lot field it was used in.
  const slotOf = (name: string): 1 | 2 => {
    const saved = markhas.find((m) => m.name === name)
    if (saved) return saved.slot === 2 ? 2 : 1
    return lots.some((l) => l.markha1 === name) ? 1 : 2
  }

  const rows = names.map((name) => {
    const matched = lots.filter((l) => l.markha1 === name || l.markha2 === name)
    const stock = matched.filter(inStockOf)
    return {
      name,
      total: matched.length,
      inStock: stock.length,
      bags: matched.reduce((s, l) => s + (l.bags || 0), 0),
      inStockBags: stock.reduce((s, l) => s + (l.bags || 0), 0),
      net: matched.reduce((s, l) => s + (l.netWeight || 0), 0),
    }
  })

  const totalLots = lots.length
  const totalInStock = lots.filter(inStockOf).length

  // Filter the report to a single markha (or all)
  const shownRows = markhaFilter === "ALL" ? rows : rows.filter((r) => r.name === markhaFilter)
  // When a specific markha is selected, list its individual lots
  const detailLots = markhaFilter === "ALL"
    ? []
    : lots.filter((l) => l.markha1 === markhaFilter || l.markha2 === markhaFilter)

  function printReport() {
    const w = window.open("", "_blank")
    if (!w) return
    const date = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
    const scope = markhaFilter === "ALL" ? "All markhas" : markhaFilter
    const body = shownRows.map((r, i) => `<tr>
      <td>${i + 1}</td>
      <td style="font-weight:700">${r.name}</td>
      <td style="text-align:right">${r.total}</td>
      <td style="text-align:right;color:#15803d;font-weight:700">${r.inStock}</td>
      <td style="text-align:right">${r.bags.toLocaleString()}</td>
      <td style="text-align:right;color:#15803d">${r.inStockBags.toLocaleString()}</td>
      <td style="text-align:right">${r.net.toLocaleString()} KG</td>
    </tr>`).join("")
    const detail = markhaFilter !== "ALL" && detailLots.length > 0 ? `
      <div style="margin-top:18px;font-weight:800;color:#5b21b6;font-size:12px">Lots in ${markhaFilter}</div>
      <table style="margin-top:6px">
        <thead><tr><th>#</th><th>Lot No</th><th>Category</th><th>Farmer</th><th>Godown</th><th style="text-align:right">Bags</th><th style="text-align:right">Net KG</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>${detailLots.map((l, i) => `<tr>
          <td>${i + 1}</td><td>${l.lotNo}</td><td>${l.category?.name || "—"}</td><td>${l.farmer?.name || "—"}</td>
          <td>${l.warehouse?.name || "—"}</td><td style="text-align:right">${l.bags ?? "—"}</td>
          <td style="text-align:right">${l.netWeight ?? "—"}</td><td>${String(l.status).replace("_", " ")}</td>
          <td>${new Date(l.createdAt).toLocaleDateString("en-PK")}</td></tr>`).join("")}</tbody>
      </table>` : ""
    w.document.write(`<html><head><title>Markha Report — ${scope}</title><style>${reportCSS} body{max-width:900px;margin:0 auto}</style></head><body>
      ${buildPrintHeader(shop)}
      <div class="doc-header"><div><div class="doc-title">Markha Report — ${scope}</div><div class="doc-sub">${shownRows.length} markha(s) · ${date}</div></div></div>
      <div class="body-pad"><table>
        <thead><tr><th>#</th><th>Markha</th><th style="text-align:right">Total Lots</th><th style="text-align:right">In Stock</th><th style="text-align:right">Total Bags</th><th style="text-align:right">In-Stock Bags</th><th style="text-align:right">Net Wt</th></tr></thead>
        <tbody>${body || '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:16px">No markhas yet.</td></tr>'}</tbody>
      </table>${detail}</div>
      <script>window.onload=()=>window.print()<\/script></body></html>`)
    w.document.close()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-6 h-6 text-purple-600" /> {t("Markha Report")}
          </h2>
          <p className="text-gray-500 text-sm">{rows.length} markhas · {totalLots} lots ({totalInStock} in stock)</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-gray-400" />
            <select
              value={markhaFilter}
              onChange={(e) => setMarkhaFilter(e.target.value)}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-xs focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-ring/20"
              title={t("Filter by markha")}
            >
              <option value="ALL">{t("All markhas")}</option>
              {([1, 2] as const).map((slot) => (
                <optgroup key={slot} label={t(`Markha ${slot}`)}>
                  {names.filter((n) => slotOf(n) === slot).map((n) => <option key={n} value={n}>{n}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <Button variant="outline" className="gap-2" onClick={printReport} disabled={shownRows.length === 0}>
            <Printer className="w-4 h-4" /> {t("Print")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-blue-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t("Markhas")}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total Lots</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">In Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total Bags</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">In-Stock Bags</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Net Wt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">{t("Loading...")}</td></tr>
                ) : shownRows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">{t("No markhas yet. Add your first above.")}</td></tr>
                ) : shownRows.map((r, i) => (
                  <tr key={r.name} className="hover:bg-blue-50">
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-800 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-purple-500" />{r.name}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.total}</td>
                    <td className="px-4 py-3 text-right font-bold text-purple-700">{r.inStock}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.bags.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-purple-600">{r.inStockBags.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.net.toLocaleString()} KG</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Lots detail for the selected markha */}
      {markhaFilter !== "ALL" && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b bg-purple-50 text-sm font-semibold text-purple-800 flex items-center gap-1.5">
              <Tag className="w-4 h-4" /> {t("Lots in")} {markhaFilter} <span className="text-gray-400 font-normal">({detailLots.length})</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-blue-50 border-b">
                  <tr>
                    {["#", "Lot No", "Category", "Farmer", "Godown", "Bags", "Net KG", "Status", "Date"].map((h) => (
                      <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-600 uppercase ${["Bags", "Net KG"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detailLots.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">{t("No lots match your search / filters.")}</td></tr>
                  ) : detailLots.map((l, i) => (
                    <tr key={l.id} className="hover:bg-blue-50">
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{l.lotNo}</td>
                      <td className="px-4 py-2.5 text-gray-700">{l.category?.name || "—"}</td>
                      <td className="px-4 py-2.5 text-gray-600">{l.farmer?.name || "—"}</td>
                      <td className="px-4 py-2.5 text-gray-600">{l.warehouse?.name || "—"}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{l.bags ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{l.netWeight ?? "—"}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{String(l.status).replace("_", " ")}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{formatDate(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
