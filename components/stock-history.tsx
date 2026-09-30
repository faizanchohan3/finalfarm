"use client"

import { useEffect, useState } from "react"
import { Printer, History, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
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
// Manual entries (added / removed / opening) can be deleted here; purchases and sales from their own pages.
const DELETABLE: Entry["type"][] = ["ADD", "REMOVE", "OPENING"]

export function StockHistory({ open, onClose, products, productId: initialProductId, shop, onChanged }: {
  open: boolean; onClose: () => void; products: any[]; productId?: string; shop: any; onChanged?: () => void
}) {
  const [reload, setReload] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [productId, setProductId] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [type, setType] = useState("ALL")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [entries, setEntries] = useState<Entry[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<"entries" | "summary">("entries")

  useEffect(() => { if (open) { setProductId(initialProductId || ""); setCategoryId(""); setType("ALL"); setView("entries") } }, [open, initialProductId])

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
  }, [open, productId, from, to, reload])

  async function remove(e: Entry) {
    const what = `${TYPE_LABEL[e.type]} ${n(Math.abs(e.qty))} ${e.unit} — ${e.productName}`
    const effect = e.qty > 0 ? `Stock goes down by ${n(e.qty)}` : `Stock goes back up by ${n(-e.qty)}`
    if (!confirm(`Delete this entry?\n\n${what}\n${effect} ${e.unit}.\n\nIt can be restored from Deleted Records.`)) return
    setDeleting(e.id)
    try {
      const res = await fetch(`/api/inventory/history?type=${e.type}&id=${encodeURIComponent(e.id)}`, { method: "DELETE" })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) return alert(d.error || "Failed to delete")
      setReload((r) => r + 1)
      onChanged?.()
    } finally {
      setDeleting(null)
    }
  }

  // Category filter (done here: each product carries its category)
  const categories = Object.values(
    products.reduce<Record<string, { id: string; name: string }>>((acc, p) => {
      if (p.categoryId) acc[p.categoryId] ??= { id: p.categoryId, name: p.category?.name || "Uncategorised" }
      return acc
    }, {})
  ).sort((a, b) => a.name.localeCompare(b.name))
  const category = categories.find((c) => c.id === categoryId)
  const categoryOf = Object.fromEntries(products.map((p) => [p.id, p.categoryId]))
  const productOptions = categoryId ? products.filter((p) => p.categoryId === categoryId) : products

  function pickCategory(id: string) {
    setCategoryId(id)
    // Keep the chosen product only if it belongs to the new category
    if (id && productId && categoryOf[productId] !== id) setProductId("")
  }

  const inCategory = categoryId ? entries.filter((e) => categoryOf[e.productId] === categoryId) : entries
  const shown = type === "ALL" ? inCategory : type === "IN" ? inCategory.filter((e) => e.qty > 0) : type === "OUT" ? inCategory.filter((e) => e.qty < 0) : inCategory.filter((e) => e.type === type)
  const showBalance = !!productId && !from && !to
  const product = products.find((p) => p.id === productId)
  const scopeName = product ? product.name : category ? category.name : ""

  // Totals cards: from the API, or recounted here when a category narrows the list
  const count = (list: Entry[]) => ({ qty: list.reduce((s, e) => s + Math.abs(e.qty), 0), amount: list.reduce((s, e) => s + e.amount, 0), count: list.length })
  const cardTotals: Totals | null = !categoryId ? totals : {
    in: count(inCategory.filter((e) => e.qty > 0)),
    out: count(inCategory.filter((e) => e.qty < 0)),
    purchases: count(inCategory.filter((e) => e.type === "PURCHASE")),
    sales: count(inCategory.filter((e) => e.type === "SALE")),
  }

  // Summary report: one row per product with stock in / out (qty and value) for the filtered entries
  type SummaryRow = { productId: string; name: string; code: string; unit: string; inQty: number; inAmt: number; outQty: number; outAmt: number; current: number; value: number }
  const summary: SummaryRow[] = Object.values(
    shown.reduce<Record<string, SummaryRow>>((acc, e) => {
      const p = products.find((x) => x.id === e.productId)
      const r = (acc[e.productId] ??= {
        productId: e.productId, name: e.productName, code: e.productCode, unit: e.unit, inQty: 0, inAmt: 0, outQty: 0, outAmt: 0,
        current: p?.currentStock ?? 0, value: (p?.currentStock ?? 0) * (p?.purchasePrice ?? 0),
      })
      if (e.qty > 0) { r.inQty += e.qty; r.inAmt += e.amount } else { r.outQty += -e.qty; r.outAmt += e.amount }
      return acc
    }, {})
  ).sort((a, b) => a.name.localeCompare(b.name))
  const sumOf = (k: keyof SummaryRow) => summary.reduce((s, r) => s + (r[k] as number), 0)

  function printSummary() {
    const w = window.open("", "_blank")
    if (!w) return
    const rows = summary.map((r, i) => `<tr>
      <td>${i + 1}</td><td style="font-family:inherit">${escapeHtml(r.name)}</td>
      <td style="color:#15803d">${n(r.inQty)} ${escapeHtml(r.unit)}</td><td>${n(r.inAmt)}</td>
      <td style="color:#b91c1c">${n(r.outQty)} ${escapeHtml(r.unit)}</td><td>${n(r.outAmt)}</td>
      <td>${n(r.current)} ${escapeHtml(r.unit)}</td><td>${n(r.value)}</td>
    </tr>`).join("")
    const range = [from && `از ${day(from)}`, to && `تا ${day(to)}`].filter(Boolean).join(" ")
    w.document.write(`<html dir="rtl"><head><title>Stock Report</title>
${billFontLink}
<style>${billCSS} body { max-width: 1000px; }</style></head><body>
<div dir="ltr">${buildPrintHeader(shop)}</div>
<div class="meta">
  <div>اسٹاک رپورٹ — <b style="font-family:inherit">${escapeHtml(scopeName || "تمام اشیاء")}</b>${range ? ` <span style="font-size:12px">(${range})</span>` : ""}</div>
  <div>تاریخ: <b>${day(new Date().toISOString())}</b></div>
</div>
<table>
  <thead><tr><th>#</th><th>جنس</th><th>کل آمد</th><th>آمد رقم</th><th>کل اخراج</th><th>اخراج رقم</th><th>موجودہ اسٹاک</th><th>اسٹاک مالیت</th></tr></thead>
  <tbody>${rows || `<tr><td colspan="8">کوئی ریکارڈ نہیں</td></tr>`}</tbody>
  <tfoot><tr><td colspan="2" style="font-family:inherit">میزان</td><td></td><td>${n(sumOf("inAmt"))}</td><td></td><td>${n(sumOf("outAmt"))}</td><td></td><td>${n(sumOf("value"))}</td></tr></tfoot>
</table>
<div class="sum">
  <div><span>کل آمد رقم</span><span class="num">Rs ${n(sumOf("inAmt"))}</span></div>
  <div><span>کل اخراج رقم</span><span class="num">Rs ${n(sumOf("outAmt"))}</span></div>
  <div class="grand"><span>موجودہ اسٹاک مالیت</span><span class="num">Rs ${n(sumOf("value"))}</span></div>
</div>
<div class="sig"><span>دستخط: ____________</span><span>${escapeHtml(shop?.name || "")}</span></div>
<script>document.fonts.ready.then(() => window.print())<\/script>
</body></html>`)
    w.document.close()
  }

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
  <div>اسٹاک ریکارڈ — <b style="font-family:inherit">${escapeHtml(scopeName || "تمام اشیاء")}</b>${range ? ` <span style="font-size:12px">(${range})</span>` : ""}</div>
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

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <div>
            <Label>Category</Label>
            <SearchableSelect
              value={categoryId || "all"}
              onValueChange={(v) => pickCategory(v === "all" ? "" : v)}
              searchPlaceholder="Search category..."
              options={[
                { value: "all", label: "All categories" },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>
          <div className="col-span-2 md:col-span-2">
            <Label>Product</Label>
            <SearchableSelect
              value={productId || "all"}
              onValueChange={(v) => setProductId(v === "all" ? "" : v)}
              searchPlaceholder="Search product..."
              options={[
                { value: "all", label: category ? `All in ${category.name}` : "All products" },
                ...productOptions.map((p) => ({ value: p.id, label: p.name, sub: `${p.currentStock} ${p.unit}${p.room?.name ? ` · ${p.room.name}` : ""}` })),
              ]}
            />
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

        {cardTotals && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg bg-green-50 border border-green-200 p-3">
              <p className="text-xs text-green-700">Stock in</p>
              <p className="font-bold text-green-900 tabular-nums">{n(cardTotals.in.qty)}</p>
              <p className="text-xs text-gray-500">Rs {n(cardTotals.in.amount)} · {cardTotals.in.count} entries</p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-xs text-red-700">Stock out</p>
              <p className="font-bold text-red-900 tabular-nums">{n(cardTotals.out.qty)}</p>
              <p className="text-xs text-gray-500">Rs {n(cardTotals.out.amount)} · {cardTotals.out.count} entries</p>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-xs text-blue-700">Purchases</p>
              <p className="font-bold text-blue-900 tabular-nums">Rs {n(cardTotals.purchases.amount)}</p>
              <p className="text-xs text-gray-500">{n(cardTotals.purchases.qty)} qty · {cardTotals.purchases.count} entries</p>
            </div>
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
              <p className="text-xs text-orange-700">Sales</p>
              <p className="font-bold text-orange-900 tabular-nums">Rs {n(cardTotals.sales.amount)}</p>
              <p className="text-xs text-gray-500">{n(cardTotals.sales.qty)} qty · {cardTotals.sales.count} entries</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex rounded-md border border-gray-300 overflow-hidden text-sm">
              {([["entries", "All entries"], ["summary", "Summary by product"]] as const).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setView(k)}
                  className={`px-3 py-1.5 ${view === k ? "bg-purple-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              {loading ? "Loading..." : view === "entries" ? `${shown.length} entries` : `${summary.length} products`}
              {product && <> · Current stock: <b className="text-gray-800">{n(product.currentStock)} {product.unit}</b></>}
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-1" onClick={view === "entries" ? print : printSummary} disabled={loading || shown.length === 0}>
            <Printer className="w-3.5 h-3.5" /> {view === "entries" ? "Print" : "Print report"}
          </Button>
        </div>

        {view === "summary" && (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500">
                  <th className="py-2 px-2 font-medium">Product</th>
                  <th className="py-2 px-2 font-medium text-right">Stock in</th>
                  <th className="py-2 px-2 font-medium text-right">In value</th>
                  <th className="py-2 px-2 font-medium text-right">Stock out</th>
                  <th className="py-2 px-2 font-medium text-right">Out value</th>
                  <th className="py-2 px-2 font-medium text-right">Current stock</th>
                  <th className="py-2 px-2 font-medium text-right">Stock value</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((r) => (
                  <tr key={r.productId} className="border-t border-gray-100">
                    <td className="py-2 px-2">
                      <span className="font-medium text-gray-800">{r.name}</span>
                      <div className="font-mono text-[11px] text-purple-700">{r.code}</div>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-green-700 font-semibold">{n(r.inQty)} <span className="font-normal text-gray-400 text-xs">{r.unit}</span></td>
                    <td className="py-2 px-2 text-right tabular-nums">{n(r.inAmt)}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-red-600 font-semibold">{n(r.outQty)} <span className="font-normal text-gray-400 text-xs">{r.unit}</span></td>
                    <td className="py-2 px-2 text-right tabular-nums">{n(r.outAmt)}</td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold">{n(r.current)} <span className="font-normal text-gray-400 text-xs">{r.unit}</span></td>
                    <td className="py-2 px-2 text-right tabular-nums font-medium">{n(r.value)}</td>
                  </tr>
                ))}
                {!loading && summary.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">No stock records</td></tr>
                )}
              </tbody>
              {summary.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                  <tr>
                    <td className="py-2 px-2 text-gray-700">Total</td>
                    <td></td>
                    <td className="py-2 px-2 text-right tabular-nums">{n(sumOf("inAmt"))}</td>
                    <td></td>
                    <td className="py-2 px-2 text-right tabular-nums">{n(sumOf("outAmt"))}</td>
                    <td></td>
                    <td className="py-2 px-2 text-right tabular-nums">{n(sumOf("value"))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        <div className={`overflow-x-auto border rounded-lg ${view === "entries" ? "" : "hidden"}`}>
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
                <th className="py-2 px-2 w-8"></th>
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
                  <td className="py-2 px-2 text-center">
                    {DELETABLE.includes(e.type) ? (
                      <button onClick={() => remove(e)} disabled={deleting === e.id} className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-40" title="Delete entry (stock is reversed)">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-gray-300" title={`Delete this ${e.type === "SALE" ? "sale" : "purchase"} from the ${e.type === "SALE" ? "Sales" : "Purchases"} page`}>
                        <Trash2 className="w-4 h-4 inline" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && shown.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400">No stock records</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-400">
          Purchases and sales use the price on the bill. Manual add / remove use the price entered at the time (older entries without one, and opening stock, use the product&apos;s current purchase price). Stock value = current stock × purchase price.
        </p>
      </DialogContent>
    </Dialog>
  )
}
