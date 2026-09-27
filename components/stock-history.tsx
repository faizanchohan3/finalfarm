"use client"

import { useEffect, useState } from "react"
import { Printer, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { billCSS, billFontLink, buildPrintHeader, escapeHtml } from "@/lib/print-utils"

type Entry = {
  id: string; date: string; type: "OPENING" | "PURCHASE" | "SALE" | "ADD" | "REMOVE"
  productId: string; productName: string; productCode: string; unit: string
  qty: number; rate: number; amount: number; ref: string; party: string; note: string; by: string; balance?: number
}
type Totals = Record<"in" | "out" | "purchases" | "sales", { qty: number; amount: number; count: number }>

const TYPE_LABEL: Record<Entry["type"], string> = { OPENING: "Opening", PURCHASE: "Purchase", SALE: "Sale", ADD: "Added", REMOVE: "Removed" }
const TYPE_UR: Record<Entry["type"], string> = { OPENING: "ابتدائی اسٹاک", PURCHASE: "خریداری", SALE: "فروخت", ADD: "اضافہ", REMOVE: "کمی" }
const TYPE_COLOR: Record<Entry["type"], string> = {
  OPENING: "bg-gray-100 text-gray-700", PURCHASE: "bg-blue-100 text-blue-700", SALE: "bg-orange-100 text-orange-700",
  ADD: "bg-green-100 text-green-700", REMOVE: "bg-red-100 text-red-700",
}
const n = (v: number) => (v || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })
const day = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "numeric", year: "2-digit" })
const time = (d: string) => new Date(d).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" })

// Store "Stock History": every add / remove of inventory with quantity, rate and amount.
export function StockHistory({ open, onClose, products, productId: initialProductId, shop }: {
  open: boolean; onClose: () => void; products: any[]; productId?: string; shop: any
}) {
  const [productId, setProductId] = useState("")
  const [type, setType] = useState("ALL")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [entries, setEntries] = useState<Entry[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (open) { setProductId(initialProductId || ""); setType("ALL") } }, [open, initialProductId])

  useEffect(() => {
    if (!open) return
    const qs = new URLSearchParams()
    if (productId) qs.set("productId", productId)
    if (from) qs.set("from", from)
    if (to) qs.set("to", to)
    setLoading(true)
    fetch(`/api/inventory/history?${qs}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setEntries(d.entries || []); setTotals(d.totals || null) })
      .catch(() => { setEntries([]); setTotals(null) })
      .finally(() => setLoading(false))
  }, [open, productId, from, to])

  const shown = type === "ALL" ? entries : type === "IN" ? entries.filter((e) => e.qty > 0) : type === "OUT" ? entries.filter((e) => e.qty < 0) : entries.filter((e) => e.type === type)
  const showBalance = !!productId && !from && !to
  const product = products.find((p) => p.id === productId)

  function print() {
    const w = window.open("", "_blank")
    if (!w) return
    const rows = shown.map((e, i) => `<tr>
      <td>${i + 1}</td><td>${day(e.date)}</td>
      <td style="font-family:inherit">${escapeHtml(e.productName)}</td>
      <td style="font-family:inherit">${TYPE_UR[e.type]}</td>
      <td style="color:${e.qty < 0 ? "#b91c1c" : "#15803d"}">${e.qty > 0 ? "+" : "−"}${n(Math.abs(e.qty))} ${escapeHtml(e.unit)}</td>
      <td>${n(e.rate)}</td><td>${n(e.amount)}</td>
      ${showBalance ? `<td>${n(e.balance ?? 0)}</td>` : ""}
      <td style="font-family:inherit">${escapeHtml([e.ref, e.party, e.note].filter(Boolean).join(" · "))}</td>
    </tr>`).join("")
    const inQty = shown.filter((e) => e.qty > 0), outQty = shown.filter((e) => e.qty < 0)
    const sumAmt = (l: Entry[]) => l.reduce((s, e) => s + e.amount, 0)
    const range = [from && `از ${day(from)}`, to && `تا ${day(to)}`].filter(Boolean).join(" ")
    w.document.write(`<html dir="rtl"><head><title>Stock History</title>
${billFontLink}
<style>${billCSS} body { max-width: 1000px; }</style></head><body>
<div dir="ltr">${buildPrintHeader(shop)}</div>
<div class="meta">
  <div>اسٹاک ریکارڈ — <b style="font-family:inherit">${escapeHtml(product ? product.name : "تمام اشیاء")}</b>${range ? ` <span style="font-size:12px">(${range})</span>` : ""}</div>
  <div>تاریخ: <b>${day(new Date().toISOString())}</b></div>
</div>
<table>
  <thead><tr><th>#</th><th>تاریخ</th><th>جنس</th><th>قسم</th><th>مقدار</th><th>ریٹ</th><th>رقم</th>${showBalance ? "<th>باقی اسٹاک</th>" : ""}<th>تفصیل</th></tr></thead>
  <tbody>${rows || `<tr><td colspan="9">کوئی ریکارڈ نہیں</td></tr>`}</tbody>
</table>
<div class="sum">
  <div><span>کل اندراجات</span><span class="num">${shown.length}</span></div>
  <div><span>کل آمد (مقدار / رقم)</span><span class="num">${n(inQty.reduce((s, e) => s + e.qty, 0))} / Rs ${n(sumAmt(inQty))}</span></div>
  <div><span>کل اخراج (مقدار / رقم)</span><span class="num">${n(outQty.reduce((s, e) => s - e.qty, 0))} / Rs ${n(sumAmt(outQty))}</span></div>
  ${product ? `<div class="grand"><span>موجودہ اسٹاک</span><span class="num">${n(product.currentStock)} ${escapeHtml(product.unit)}</span></div>` : ""}
</div>
<div class="sig"><span>دستخط: ____________</span><span>${escapeHtml(shop?.name || "")}</span></div>
<script>document.fonts.ready.then(() => window.print())<\/script>
</body></html>`)
    w.document.close()
  }

  const select = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="w-[96vw] max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History className="w-5 h-5 text-purple-600" /> Stock History</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div className="col-span-2">
            <Label>Product</Label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={select}>
              <option value="">All products</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.currentStock} {p.unit})</option>)}
            </select>
          </div>
          <div>
            <Label>Type</Label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={select}>
              <option value="ALL">All</option>
              <option value="IN">Stock in (all)</option>
              <option value="OUT">Stock out (all)</option>
              <option value="PURCHASE">Purchases</option>
              <option value="SALE">Sales</option>
              <option value="ADD">Added manually</option>
              <option value="REMOVE">Removed manually</option>
              <option value="OPENING">Opening stock</option>
            </select>
          </div>
          <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>

        {totals && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg bg-green-50 border border-green-200 p-3">
              <p className="text-xs text-green-700">Stock in</p>
              <p className="font-bold text-green-900 tabular-nums">{n(totals.in.qty)}</p>
              <p className="text-xs text-gray-500">Rs {n(totals.in.amount)} · {totals.in.count} entries</p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-xs text-red-700">Stock out</p>
              <p className="font-bold text-red-900 tabular-nums">{n(totals.out.qty)}</p>
              <p className="text-xs text-gray-500">Rs {n(totals.out.amount)} · {totals.out.count} entries</p>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-xs text-blue-700">Purchases</p>
              <p className="font-bold text-blue-900 tabular-nums">Rs {n(totals.purchases.amount)}</p>
              <p className="text-xs text-gray-500">{n(totals.purchases.qty)} qty · {totals.purchases.count} entries</p>
            </div>
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
              <p className="text-xs text-orange-700">Sales</p>
              <p className="font-bold text-orange-900 tabular-nums">Rs {n(totals.sales.amount)}</p>
              <p className="text-xs text-gray-500">{n(totals.sales.qty)} qty · {totals.sales.count} entries</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-gray-500">
            {loading ? "Loading..." : `${shown.length} entries`}
            {product && <> · Current stock: <b className="text-gray-800">{n(product.currentStock)} {product.unit}</b></>}
          </p>
          <Button size="sm" variant="outline" className="gap-1" onClick={print} disabled={loading || shown.length === 0}>
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500">
                <th className="py-2 px-2 font-medium">Date</th>
                <th className="py-2 px-2 font-medium">Product</th>
                <th className="py-2 px-2 font-medium">Type</th>
                <th className="py-2 px-2 font-medium text-right">Qty</th>
                <th className="py-2 px-2 font-medium text-right">Rate</th>
                <th className="py-2 px-2 font-medium text-right">Amount</th>
                {showBalance && <th className="py-2 px-2 font-medium text-right">Stock after</th>}
                <th className="py-2 px-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.type + e.id} className="border-t border-gray-100">
                  <td className="py-2 px-2 whitespace-nowrap text-gray-600">{day(e.date)} <span className="text-[11px] text-gray-400">{time(e.date)}</span></td>
                  <td className="py-2 px-2">
                    <span className="font-medium text-gray-800">{e.productName}</span>
                    <div className="font-mono text-[11px] text-purple-700">{e.productCode}</div>
                  </td>
                  <td className="py-2 px-2"><span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLOR[e.type]}`}>{TYPE_LABEL[e.type]}</span></td>
                  <td className={`py-2 px-2 text-right tabular-nums font-semibold whitespace-nowrap ${e.qty < 0 ? "text-red-600" : "text-green-700"}`}>
                    {e.qty > 0 ? "+" : "−"}{n(Math.abs(e.qty))} <span className="font-normal text-gray-400 text-xs">{e.unit}</span>
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">{n(e.rate)}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-medium">{n(e.amount)}</td>
                  {showBalance && <td className="py-2 px-2 text-right tabular-nums">{n(e.balance ?? 0)}</td>}
                  <td className="py-2 px-2 text-xs text-gray-600">
                    {e.ref}
                    {e.party && <> · <span className="text-gray-800">{e.party}</span></>}
                    {e.note && <> · {e.note}</>}
                    {e.by && <span className="text-gray-400"> · by {e.by}</span>}
                  </td>
                </tr>
              ))}
              {!loading && shown.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">No stock records</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-400">
          Purchases and sales use the price on the bill. Opening stock and manual add/remove are valued at the product&apos;s current purchase price.
        </p>
      </DialogContent>
    </Dialog>
  )
}
