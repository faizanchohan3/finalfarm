"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { formatCurrency, formatDate } from "@/lib/utils"
import { billCSS, billFontLink, buildPrintHeader, escapeHtml } from "@/lib/print-utils"
import { lotSaleAmount, splitByBags } from "@/lib/lot-sale"
import { ShoppingCart, Printer, Trash2, Receipt } from "lucide-react"

const n = (v: number | null | undefined) => (v || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })
const today = () => new Date().toISOString().slice(0, 10)
const UNIT_LABEL: Record<string, string> = { bag: "Per bag", kg: "Per KG", mound: "Per mound (40 kg)" }
const BAG_LABEL: Record<string, string> = { bori: "Bori", jali: "Jali", tora: "Tora" }

// Potato Store: sell from the total stock of a product instead of lot by lot.
// Shows stock per product with a Sell button, the sale form (choose lots and bags from each),
// and the list of sales. Each sale puts the amount in the buyer's ledger and makes the farmer owed his full share (no commission).
export function LotStockSale({ buyers, shop, onChanged }: { buyers: any[]; shop: any; onChanged: () => void }) {
  const [products, setProducts] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showSales, setShowSales] = useState(false)
  // Sales report filters
  const [sFrom, setSFrom] = useState("")
  const [sTo, setSTo] = useState("")
  const [sProduct, setSProduct] = useState("")
  const [sMarkha, setSMarkha] = useState("")

  // Sale form
  const [showSell, setShowSell] = useState(false)
  const [productId, setProductId] = useState("")      // category id of the product being sold
  const [markha, setMarkha] = useState("")            // "" = all markhas
  const [bagsBy, setBagsBy] = useState<Record<string, string>>({})
  const [buyerId, setBuyerId] = useState("")
  const [saleDate, setSaleDate] = useState(today())
  const [rateUnit, setRateUnit] = useState("bag")
  const [rate, setRate] = useState("")
  const [weight, setWeight] = useState("")
  const [paid, setPaid] = useState("")
  const [method, setMethod] = useState("CASH")
  const [bankId, setBankId] = useState("")
  const [banks, setBanks] = useState<any[]>([])
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [st, sa, bk] = await Promise.all([
        fetch("/api/lots/stock", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/lots/sales", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/banks").then((r) => r.json()).catch(() => ({})),
      ])
      setProducts(st.products || [])
      setSales(sa.sales || [])
      setBanks(bk.banks || [])
    } catch {
      setProducts([]); setSales([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function openSell() {
    await load()
    setShowSell(true); setMarkha(""); setBagsBy({}); setBuyerId(""); setSaleDate(today())
    setRateUnit("bag"); setRate(""); setWeight(""); setPaid(""); setMethod("CASH"); setBankId(""); setNotes("")
  }
  // Default to the first product in stock
  useEffect(() => {
    if (showSell && !products.some((p) => p.categoryId === productId)) setProductId(products[0]?.categoryId || "")
  }, [showSell, products, productId])

  const sellFor = products.find((p) => p.categoryId === productId) || null
  // Markhas of this product's stock, with bags left under each
  const markhaOptions = (() => {
    const m = new Map<string, number>()
    for (const l of sellFor?.lots || []) for (const mk of l.markhas || []) m.set(mk, (m.get(mk) || 0) + l.left)
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  })()
  // Lots shown (and sold from): the product's lots, narrowed to the chosen markha
  const shownLots: any[] = (sellFor?.lots || []).filter((l: any) => !markha || (l.markhas || []).includes(markha))
  // Bags left by type (bori / jali / tora) — each lot is one bag type
  const byType = (list: any[], qty: (l: any) => number) => {
    const t: Record<string, number> = { bori: 0, jali: 0, tora: 0 }
    for (const l of list) t[l.bagType || "bori"] = (t[l.bagType || "bori"] || 0) + qty(l)
    return t
  }

  // ── Live figures for the form ──
  const chosen = shownLots
    .map((l: any) => ({ ...l, bags: Math.max(0, Math.floor(Number(bagsBy[l.id]) || 0)) }))
    .filter((l: any) => l.bags > 0)
  const stockByType = byType(shownLots, (l) => l.left)
  const sellByType = byType(chosen, (l) => l.bags)
  const totalBags = chosen.reduce((s: number, l: any) => s + l.bags, 0)
  const amount = lotSaleAmount(rateUnit, Number(rate) || 0, totalBags, Number(weight) || 0)
  const over = chosen.filter((l: any) => l.bags > l.left)
  // Each farmer's share (by bags) — the farmer is owed his full share (no commission)
  const farmerRows = (() => {
    const groups = new Map<string, { name: string; bags: number }>()
    for (const l of chosen) {
      const k = l.farmerId || "none"
      const g = groups.get(k) ?? { name: l.farmer || "No farmer", bags: 0 }
      g.bags += l.bags
      groups.set(k, g)
    }
    const parts = Array.from(groups.values())
    const shares = splitByBags(amount, parts)
    return parts.map((g, i) => {
      return { ...g, share: shares[i], payable: shares[i] }
    })
  })()

  async function save() {
    if (!buyerId) return alert("Select the buyer")
    if (totalBags === 0) return alert("Enter bags to sell from at least one lot")
    if (over.length) return alert(`${over[0].lotNo} has only ${over[0].left} bags left`)
    if (!(Number(rate) > 0)) return alert("Enter the rate")
    if (rateUnit !== "bag" && !(Number(weight) > 0)) return alert("Enter the weight in KG")
    if ((Number(paid) || 0) > amount) return alert("Paid can't be more than the sale amount")
    if (method === "BANK_TRANSFER" && (Number(paid) || 0) > 0 && !bankId) return alert("Select the bank account")
    const productName = sellFor?.name
    setSaving(true)
    try {
      const res = await fetch("/api/lots/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId, saleDate, rateUnit, rate, weight, paidAmount: paid, paymentMethod: method, bankId: method === "BANK_TRANSFER" ? bankId : null, notes,
          items: chosen.map((l: any) => ({ lotId: l.id, bags: l.bags })),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) return alert(d?.error || "Failed to save the sale")
      setShowSell(false)
      await load()
      onChanged()
      if (d.sale) printSale({ ...d.sale, buyer: buyers.find((b) => b.id === buyerId), product: productName, items: chosen.map((l: any) => ({ bags: l.bags, amount: 0, lot: { lotNo: l.lotNo, markha1: l.markha, farmer: { name: l.farmer } } })) })
    } finally {
      setSaving(false)
    }
  }

  async function removeSale(s: any) {
    if (!confirm(`Delete sale ${s.code || ""} — ${s.totalBags} bags to ${s.buyer?.name || "buyer"}?\n\nThe bags go back to their lots and the buyer / farmer balances are reversed.`)) return
    const res = await fetch(`/api/lots/sales/${s.id}`, { method: "DELETE" })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return alert(d?.error || "Failed to delete")
    await load()
    onChanged()
  }

  // Urdu sale bill, like the other Potato Store prints
  function printSale(s: any) {
    const e = (v: unknown) => escapeHtml(v ?? "—")
    const per = s.rateUnit === "kg" ? "فی کلو" : s.rateUnit === "mound" ? "فی من" : "فی بوری"
    const rows = (s.items || []).map((i: any, idx: number) => `<tr>
      <td>${idx + 1}</td><td>${e(i.lot?.lotNo)}</td><td style="font-family:inherit">${e(i.lot?.farmer?.name)}</td>
      <td style="font-family:inherit">${e([i.lot?.markha1, i.lot?.markha2].filter(Boolean).join(" / ") || "—")}</td><td>${n(i.bags)}</td>
    </tr>`).join("")
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<html dir="rtl"><head><title>Potato Sale ${e(s.code || "")}</title>
${billFontLink}
<style>${billCSS}</style></head><body>
<div dir="ltr">${buildPrintHeader(shop)}</div>
<div class="meta">
  <div>آلو فروخت — آئی ڈی: <b>${e(s.code || "—")}</b></div>
  <div>تاریخ: <b>${formatDate(s.saleDate)}</b></div>
</div>
<div class="name">خریدار: <strong>${e(s.buyer?.name)}</strong><span style="margin-inline-start:28px">جنس: <strong>${e(s.product || "آلو")}</strong></span></div>
<table>
  <thead><tr><th>#</th><th>لاٹ</th><th>زمیندار</th><th>مارکہ</th><th>بوری</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="sum">
  <div><span>کل بوری</span><span class="num">${n(s.totalBags)}</span></div>
  ${s.weight ? `<div><span>وزن</span><span class="num">${n(s.weight)} KG</span></div>` : ""}
  <div><span>ریٹ (${per})</span><span class="num">${n(s.rate)}</span></div>
  <div class="grand"><span>کل رقم</span><span class="num">Rs ${n(s.amount)}</span></div>
  <div><span>ادا شدہ</span><span class="num">${n(s.paidAmount)}</span></div>
  <div><span>بقایا</span><span class="num">Rs ${n((s.amount || 0) - (s.paidAmount || 0))}</span></div>
</div>
<div class="sig"><span>دستخط: ____________</span><span>${e(shop?.name || "")}</span></div>
<script>document.fonts.ready.then(() => window.print())<\/script>
</body></html>`)
    w.document.close()
  }

  // ── Sales report filters: date, product, markha ──
  const lotMarkhas = (lot: any) => [lot?.markha1, lot?.markha2].map((m: any) => (m || "").trim()).filter(Boolean)
  const saleProducts = Array.from(new Set(sales.map((s) => s.product).filter(Boolean))).sort() as string[]
  const saleMarkhas = Array.from(new Set(sales.flatMap((s) => s.items.flatMap((i: any) => lotMarkhas(i.lot))))).sort() as string[]
  const salesFiltered = !!(sFrom || sTo || sProduct || sMarkha)
  // A sale as shown: with a markha chosen, only its bags / amount / received from that markha
  function viewOf(list: any[], mk: string) {
    return list.map((s) => {
      const items = mk ? s.items.filter((i: any) => lotMarkhas(i.lot).includes(mk)) : s.items
      const amount = mk ? items.reduce((t: number, i: any) => t + (i.amount || 0), 0) : s.amount
      const paid = mk ? (s.amount ? (s.paidAmount * amount) / s.amount : 0) : s.paidAmount
      return { ...s, view: { items, bags: items.reduce((t: number, i: any) => t + i.bags, 0), amount, paid } }
    }).filter((s) => s.view.items.length > 0)
  }
  const shownSales = viewOf(
    sales.filter((s) => {
      const d = new Date(s.saleDate).toISOString().slice(0, 10)
      return (!sFrom || d >= sFrom) && (!sTo || d <= sTo) && (!sProduct || s.product === sProduct)
    }),
    sMarkha,
  )
  const totalsOf = (list: any[]) => ({
    bags: list.reduce((t, s) => t + s.view.bags, 0),
    amount: list.reduce((t, s) => t + s.view.amount, 0),
    paid: list.reduce((t, s) => t + s.view.paid, 0),
  })
  const viewTotals = totalsOf(shownSales)

  // Sales report print (Urdu layout like the other Potato Store prints)
  function printSalesReport(list: any[], filtered: boolean) {
    const e = (v: unknown) => escapeHtml(v ?? "—")
    const t = totalsOf(list)
    const per: Record<string, string> = { bag: "فی بوری", kg: "فی کلو", mound: "فی من" }
    const rows = list.map((s, i) => `<tr>
      <td>${i + 1}</td><td>${formatDate(s.saleDate)}</td><td>${e(s.code)}</td>
      <td style="font-family:inherit">${e(s.buyer?.name)}</td><td style="font-family:inherit">${e(s.product)}</td>
      <td style="font-family:inherit;font-size:11px">${e(s.view.items.map((it: any) => `${it.lot?.lotNo} (${it.bags})${lotMarkhas(it.lot).length ? ` ${lotMarkhas(it.lot).join("/")}` : ""}`).join("، "))}</td>
      <td>${n(s.view.bags)}</td><td>${n(s.rate)} <span style="font-family:inherit;font-size:10px">${per[s.rateUnit] || ""}</span></td>
      <td>${n(s.view.amount)}</td><td>${n(s.view.paid)}</td><td>${n(s.view.amount - s.view.paid)}</td>
    </tr>`).join("")
    const filters = filtered
      ? [sFrom && `از ${formatDate(sFrom)}`, sTo && `تا ${formatDate(sTo)}`, sProduct && `جنس: ${sProduct}`, sMarkha && `مارکہ: ${sMarkha}`].filter(Boolean).map((f) => e(f)).join(" · ")
      : "تمام"
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<html dir="rtl"><head><title>Potato Store Sales Report</title>
${billFontLink}
<style>${billCSS} body { max-width: 1100px; }</style></head><body>
<div dir="ltr">${buildPrintHeader(shop)}</div>
<div class="meta">
  <div>آلو فروخت رپورٹ — <span style="font-size:12px">${filters}</span></div>
  <div>تاریخ: <b>${formatDate(new Date())}</b></div>
</div>
<table>
  <thead><tr><th>#</th><th>تاریخ</th><th>آئی ڈی</th><th>خریدار</th><th>جنس</th><th>لاٹ (بوری) مارکہ</th><th>بوری</th><th>ریٹ</th><th>رقم</th><th>وصول</th><th>بقایا</th></tr></thead>
  <tbody>${rows || `<tr><td colspan="11">کوئی ریکارڈ نہیں</td></tr>`}</tbody>
  <tfoot><tr><td colspan="6" style="font-family:inherit">میزان (${list.length})</td><td>${n(t.bags)}</td><td></td><td>${n(t.amount)}</td><td>${n(t.paid)}</td><td>${n(t.amount - t.paid)}</td></tr></tfoot>
</table>
<div class="sum">
  <div><span>کل بوری</span><span class="num">${n(t.bags)}</span></div>
  <div class="grand"><span>کل رقم</span><span class="num">Rs ${n(t.amount)}</span></div>
  <div><span>وصول</span><span class="num">${n(t.paid)}</span></div>
  <div><span>بقایا</span><span class="num">Rs ${n(t.amount - t.paid)}</span></div>
</div>
<div class="sig"><span>دستخط: ____________</span><span>${e(shop?.name || "")}</span></div>
<script>document.fonts.ready.then(() => window.print())<\/script>
</body></html>`)
    w.document.close()
  }

  const buyerOptions = buyers.map((b: any) => ({ value: b.id, label: b.name, sub: b.phone || undefined }))

  return (
    <>
      {/* Header buttons (shown at the top of the Potato Store page) */}
      <Button variant="outline" className="gap-2" onClick={() => setShowSales(true)}>
        <Receipt className="w-4 h-4" /> Sales{sales.length ? ` (${sales.length})` : ""}
      </Button>
      <Button className="gap-2 bg-green-700 hover:bg-green-800" onClick={openSell} disabled={loading}>
        <ShoppingCart className="w-4 h-4" /> Sell
      </Button>

      {/* Sale form */}
      <Dialog open={showSell} onOpenChange={setShowSell}>
        <DialogContent className="w-[96vw] max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Sell from stock</DialogTitle></DialogHeader>
          {products.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No bags in stock to sell.</p>
          ) : sellFor && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Product</Label>
                  <SearchableSelect
                    value={productId}
                    onValueChange={(v) => { setProductId(v); setMarkha(""); setBagsBy({}) }}
                    searchPlaceholder="Search product..."
                    options={products.map((p) => ({ value: p.categoryId, label: p.name, sub: `${n(p.left)} bags left · ${p.lots.length} lot${p.lots.length > 1 ? "s" : ""}` }))}
                  />
                </div>
                <div>
                  <Label>Markha</Label>
                  <SearchableSelect
                    value={markha || "all"}
                    onValueChange={(v) => setMarkha(v === "all" ? "" : v)}
                    searchPlaceholder="Search markha..."
                    options={[
                      { value: "all", label: "All markhas", sub: `${n(sellFor.left)} bags left` },
                      ...markhaOptions.map(([mk, left]) => ({ value: mk, label: mk, sub: `${n(left)} bags left` })),
                    ]}
                  />
                </div>
              </div>

              {/* Stock of this product / markha by bag type, and what is left after this sale */}
              <div className="grid grid-cols-3 gap-3">
                {(["bori", "jali", "tora"] as const).map((k) => (
                  <div key={k} className={`rounded-lg border p-3 ${stockByType[k] ? "border-purple-200 bg-purple-50/60" : "border-gray-200 bg-gray-50 opacity-60"}`}>
                    <p className="text-xs text-gray-500">{BAG_LABEL[k]} in stock</p>
                    <p className="text-xl font-bold text-gray-900 tabular-nums">{n(stockByType[k])}</p>
                    {sellByType[k] > 0 && (
                      <p className="text-xs mt-0.5">
                        <span className="text-red-600">− {n(sellByType[k])}</span>
                        <span className="text-gray-500"> → after sale </span>
                        <b className="text-gray-900">{n(stockByType[k] - sellByType[k])}</b>
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Label>Buyer (Trader) *</Label>
                  <SearchableSelect value={buyerId} onValueChange={setBuyerId} placeholder="Select buyer..." searchPlaceholder="Search buyer..." options={buyerOptions} />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Bags from each lot</Label>
                  <span className="text-xs text-gray-500">Total: <b className="text-gray-900">{n(totalBags)}</b> bags</span>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-xs text-gray-500">
                        <th className="px-3 py-2 text-left font-medium">Lot</th>
                        <th className="px-3 py-2 text-left font-medium">Farmer</th>
                        <th className="px-3 py-2 text-left font-medium">Markha</th>
                        <th className="px-3 py-2 text-left font-medium">Godown</th>
                        <th className="px-3 py-2 text-left font-medium">Type</th>
                        <th className="px-3 py-2 text-right font-medium">Left</th>
                        <th className="px-3 py-2 text-left font-medium w-36">Sell bags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {shownLots.length === 0 && (
                        <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">No lots with this markha in stock</td></tr>
                      )}
                      {shownLots.map((l: any) => {
                        const v = Number(bagsBy[l.id]) || 0
                        return (
                          <tr key={l.id} className={v > 0 ? "bg-purple-50/60" : ""}>
                            <td className="px-3 py-2 font-mono text-xs">{l.lotNo}<div className="text-[11px] text-gray-400">{formatDate(l.createdAt)}</div></td>
                            <td className="px-3 py-2" dir="auto">{l.farmer || "—"}</td>
                            <td className="px-3 py-2 text-gray-600" dir="auto">{l.markha || "—"}</td>
                            <td className="px-3 py-2 text-gray-600">{l.warehouse || "—"}</td>
                            <td className="px-3 py-2 text-gray-600">{BAG_LABEL[l.bagType] || "Bori"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{n(l.left)}{l.soldBags ? <div className="text-[11px] text-gray-400">of {n(l.bags)}</div> : null}</td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                <Input type="number" min={0} max={l.left} value={bagsBy[l.id] ?? ""} placeholder="0"
                                  onChange={(e) => setBagsBy((b) => ({ ...b, [l.id]: e.target.value }))}
                                  className={`h-8 ${v > l.left ? "border-red-500" : ""}`} />
                                <button type="button" className="text-xs px-1.5 rounded border border-gray-300 hover:bg-gray-50" title="All bags left"
                                  onClick={() => setBagsBy((b) => ({ ...b, [l.id]: String(l.left) }))}>All</button>
                              </div>
                              {v > l.left && <div className="text-[11px] text-red-600">Only {l.left} left</div>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label>Rate</Label>
                  <select value={rateUnit} onChange={(e) => setRateUnit(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                    {Object.entries(UNIT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Rate (Rs) *</Label>
                  <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" />
                </div>
                {rateUnit !== "bag" && (
                  <div>
                    <Label>Weight (KG) *</Label>
                    <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label>Received now (Rs)</Label>
                  <Input type="number" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label>Method</Label>
                  <select value={method} onChange={(e) => setMethod(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                {method === "BANK_TRANSFER" ? (
                  <div className="col-span-2">
                    <Label>Received into bank account *</Label>
                    {banks.length === 0 ? (
                      <p className="text-xs text-red-600 mt-2">No bank accounts yet — add one on the Banks page first.</p>
                    ) : (
                      <SearchableSelect
                        value={bankId}
                        onValueChange={setBankId}
                        placeholder="Select bank..."
                        searchPlaceholder="Search bank or account no..."
                        emptyText="No banks"
                        options={banks.map((b: any) => ({ value: b.id, label: b.name, sub: b.accountNumber || undefined }))}
                      />
                    )}
                  </div>
                ) : (
                  <div className="col-span-2">
                    <Label>Notes</Label>
                    <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional..." />
                  </div>
                )}
              </div>
              {method === "BANK_TRANSFER" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Notes</Label>
                    <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional..." />
                  </div>
                  {bankId && (Number(paid) || 0) > 0 && (
                    <p className="text-xs text-gray-500 self-end pb-2">
                      {formatCurrency(Number(paid) || 0)} goes into {banks.find((b: any) => b.id === bankId)?.name} (shows in the bank ledger).
                    </p>
                  )}
                </div>
              )}

              <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-sm space-y-2">
                <div className="flex justify-between"><span className="text-gray-600">{n(totalBags)} bags{rateUnit !== "bag" && weight ? ` · ${n(Number(weight))} KG` : ""} × Rs {n(Number(rate))} {UNIT_LABEL[rateUnit].toLowerCase()}</span><span className="font-bold text-lg">{formatCurrency(amount)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">Buyer owes after payment</span><span className="font-semibold">{formatCurrency(Math.max(amount - (Number(paid) || 0), 0))}</span></div>
                {farmerRows.length > 0 && (
                  <table className="w-full text-xs mt-1">
                    <thead><tr className="text-gray-500"><th className="text-left font-medium py-1">Farmer</th><th className="text-right font-medium">Bags</th><th className="text-right font-medium">Farmer payable</th></tr></thead>
                    <tbody>
                      {farmerRows.map((f, i) => (
                        <tr key={i} className="border-t border-purple-100">
                          <td className="py-1" dir="auto">{f.name}</td><td className="text-right">{n(f.bags)}</td><td className="text-right font-semibold">{n(f.payable)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowSell(false)} disabled={saving}>Cancel</Button>
                <Button className="flex-1 gap-1" onClick={save} disabled={saving || totalBags === 0}>
                  <ShoppingCart className="w-4 h-4" /> {saving ? "Saving..." : `Sell ${n(totalBags)} bags`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sales list */}
      <Dialog open={showSales} onOpenChange={setShowSales}>
        <DialogContent className="w-[96vw] max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap pr-8">
              <DialogTitle>Potato Store Sales (from total)</DialogTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1" onClick={() => printSalesReport(viewOf(sales, ""), false)} disabled={sales.length === 0}>
                  <Printer className="w-4 h-4" /> Print all
                </Button>
                <Button size="sm" className="gap-1" onClick={() => printSalesReport(shownSales, true)} disabled={shownSales.length === 0 || !salesFiltered}>
                  <Printer className="w-4 h-4" /> Print filtered
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={sFrom} onChange={(e) => setSFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={sTo} onChange={(e) => setSTo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Product</Label>
              <SearchableSelect value={sProduct || "all"} onValueChange={(v) => setSProduct(v === "all" ? "" : v)} searchPlaceholder="Search product..."
                options={[{ value: "all", label: "All products" }, ...saleProducts.map((p) => ({ value: p, label: p }))]} />
            </div>
            <div>
              <Label className="text-xs">Markha</Label>
              <SearchableSelect value={sMarkha || "all"} onValueChange={(v) => setSMarkha(v === "all" ? "" : v)} searchPlaceholder="Search markha..."
                options={[{ value: "all", label: "All markhas" }, ...saleMarkhas.map((m) => ({ value: m, label: m }))]} />
            </div>
            <div>
              {salesFiltered && (
                <Button variant="ghost" size="sm" className="text-gray-500" onClick={() => { setSFrom(""); setSTo(""); setSProduct(""); setSMarkha("") }}>Clear filters</Button>
              )}
            </div>
          </div>
          {sMarkha && <p className="text-xs text-gray-500">Bags, amount and received show the part of each sale from markha <b>{sMarkha}</b>.</p>}

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-xs text-gray-500">
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">ID</th>
                  <th className="px-3 py-2 text-left font-medium">Buyer</th>
                  <th className="px-3 py-2 text-left font-medium">Lots (bags)</th>
                  <th className="px-3 py-2 text-right font-medium">Bags</th>
                  <th className="px-3 py-2 text-right font-medium">Rate</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 text-right font-medium">Received</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shownSales.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{formatDate(s.saleDate)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-purple-700">{s.code || "—"}</td>
                    <td className="px-3 py-2" dir="auto">{s.buyer?.name || "—"}<div className="text-[11px] text-gray-400">{s.product}</div></td>
                    <td className="px-3 py-2 text-xs text-gray-600">{s.view.items.map((i: any) => `${i.lot?.lotNo} (${i.bags})`).join(", ")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n(s.view.bags)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{n(s.rate)} <span className="text-[11px] text-gray-400">/{s.rateUnit}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(s.view.amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(s.view.paid)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => printSale(s)} className="p-1 text-gray-400 hover:text-blue-600" title="Print"><Printer className="w-4 h-4" /></button>
                        <button onClick={() => removeSale(s)} className="p-1 text-gray-400 hover:text-red-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {shownSales.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">{sales.length ? "No sales for these filters" : "No sales yet"}</td></tr>}
              </tbody>
              {shownSales.length > 0 && (
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td colSpan={4} className="px-3 py-2">Total — {shownSales.length} sales</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n(viewTotals.bags)}</td>
                    <td />
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(viewTotals.amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(viewTotals.paid)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-xs text-gray-500">Each sale is in the buyer&apos;s ledger and creates the farmer&apos;s payable (shown on the Commission page). Received later is recorded from the Commission page.</p>
        </DialogContent>
      </Dialog>
    </>
  )
}
