"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tag, Printer } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { buildPrintHeader, reportCSS } from "@/lib/print-utils"

const inStockOf = (l: any) => !["SOLD", "DISPATCHED", "SETTLED", "CANCELLED"].includes(l.status)

export default function MarkhaReportPage() {
  const { t } = useLang()
  const [lots, setLots] = useState<any[]>([])
  const [markhas, setMarkhas] = useState<any[]>([])
  const [shop, setShop] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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

  function printReport() {
    const w = window.open("", "_blank")
    if (!w) return
    const date = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
    const body = rows.map((r, i) => `<tr>
      <td>${i + 1}</td>
      <td style="font-weight:700">${r.name}</td>
      <td style="text-align:right">${r.total}</td>
      <td style="text-align:right;color:#15803d;font-weight:700">${r.inStock}</td>
      <td style="text-align:right">${r.bags.toLocaleString()}</td>
      <td style="text-align:right;color:#15803d">${r.inStockBags.toLocaleString()}</td>
      <td style="text-align:right">${r.net.toLocaleString()} KG</td>
    </tr>`).join("")
    w.document.write(`<html><head><title>Markha Report</title><style>${reportCSS} body{max-width:820px;margin:0 auto}</style></head><body>
      ${buildPrintHeader(shop)}
      <div class="doc-header"><div><div class="doc-title">Markha Report</div><div class="doc-sub">${rows.length} markhas · ${totalLots} lots (${totalInStock} in stock) · ${date}</div></div></div>
      <div class="body-pad"><table>
        <thead><tr><th>#</th><th>Markha</th><th style="text-align:right">Total Lots</th><th style="text-align:right">In Stock</th><th style="text-align:right">Total Bags</th><th style="text-align:right">In-Stock Bags</th><th style="text-align:right">Net Wt</th></tr></thead>
        <tbody>${body || '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:16px">No markhas yet.</td></tr>'}</tbody>
      </table></div>
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
        <Button variant="outline" className="gap-2" onClick={printReport} disabled={rows.length === 0}>
          <Printer className="w-4 h-4" /> {t("Print")}
        </Button>
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
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">{t("No markhas yet. Add your first above.")}</td></tr>
                ) : rows.map((r, i) => (
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
    </div>
  )
}
