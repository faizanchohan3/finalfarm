"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Plus, Boxes, User, Warehouse as WarehouseIcon, Settings2, XCircle, Truck, Receipt, Printer, Tag, Search, X } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { billCSS, billFontLink, buildPrintHeader, escapeHtml } from "@/lib/print-utils"
import { LotStockSale } from "@/components/lot-stock-sale"

// Lots are shown as just Stored or Sold. The database keeps its detailed statuses:
// sold / dispatched / settled count as Sold, cancelled stays Cancelled, everything else is Stored.
const SOLD_STAGE = ["SOLD", "DISPATCHED", "SETTLED"]
const simpleStatus = (s: string) => (s === "CANCELLED" ? "CANCELLED" : SOLD_STAGE.includes(s) ? "SOLD" : "STORED")
const FILTERS = ["ALL", "STORED", "SOLD"] as const
const FILTER_LABELS: Record<string, string> = { ALL: "All", STORED: "Stored", SOLD: "Sold" }

// Markha 1 is a fixed list of potato grades — not shop-editable like Markha 2.
// Always in Urdu (saved and shown the same in every language, on screen and in prints).
const MARKHA1_OPTIONS = ["سفید بیگ", "سرخ بیگ", "سفید راشن", "سرخ راشن", "سفید گولی", "سرخ گولی"]

const STATUS_COLORS: Record<string, string> = {
  ARRIVED: "bg-blue-100 text-blue-700",
  WEIGHED: "bg-indigo-100 text-indigo-700",
  STORED: "bg-amber-100 text-amber-700",
  AVAILABLE: "bg-teal-100 text-teal-700",
  IN_AUCTION: "bg-purple-100 text-purple-700",
  SOLD: "bg-green-100 text-green-700",
  DISPATCHED: "bg-cyan-100 text-cyan-700",
  SETTLED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
}
const PAY_COLORS: Record<string, string> = {
  PENDING: "text-amber-600", PARTIAL: "text-blue-600", PAID: "text-green-600", CANCELLED: "text-red-500",
}

// Lots are potatoes by default; the category can still be changed or a new one added with +.
const DEFAULT_LOT_CATEGORY = "Potato"
// Extra lot categories added with the + button, remembered in this browser.
const LOT_CATEGORIES_KEY = "lots.extraCategories"
function readLotCategories(): string[] {
  try { const v = JSON.parse(localStorage.getItem(LOT_CATEGORIES_KEY) || "[]"); return Array.isArray(v) ? v : [] } catch { return [] }
}

const EMPTY = {
  farmerId: "", categoryName: DEFAULT_LOT_CATEGORY, warehouseId: "",
  markha1: "", markha2: "", billNo: "", vehicleNo: "",
  bagType: "bori", bags: "",
  grossWeight: "", tareWeight: "", notes: "",
}

// Maps stored bagType to a translatable label; used for the card display.
const BAG_TYPE_LABEL: Record<string, string> = { bori: "Bori", jali: "Jali", tora: "Tora" }

// Radix Select disallows "" as an item value, so "None" uses a sentinel.
const NO_MARKHA = "__none__"

export default function LotsPage() {
  const { t } = useLang()
  const [lots, setLots] = useState<any[]>([])
  const [shop, setShop] = useState<any>(null)
  const [farmers, setFarmers] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [addingCat, setAddingCat] = useState(false)
  const [extraCats, setExtraCats] = useState<string[]>([])
  useEffect(() => { setExtraCats(readLotCategories()) }, [])

  // Add a category from the + button: remember it and select it for this lot.
  function addLotCategory(name: string) {
    const clean = name.trim()
    if (!clean) return
    const exists = [DEFAULT_LOT_CATEGORY, ...extraCats].find((c) => c.toLowerCase() === clean.toLowerCase())
    if (!exists) {
      const next = [...extraCats, clean]
      setExtraCats(next)
      try { localStorage.setItem(LOT_CATEGORIES_KEY, JSON.stringify(next)) } catch {}
    }
    set("categoryName", exists || clean)
    setAddingCat(false)
  }
  const [newCat, setNewCat] = useState("")
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [buyers, setBuyers] = useState<any[]>([])
  const [markhas, setMarkhas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("ALL")
  const [markhaFilter, setMarkhaFilter] = useState("ALL")
  const [reportGodown, setReportGodown] = useState("ALL")
  const [search, setSearch] = useState("")


  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [manage, setManage] = useState<any | null>(null)
  const [mStatus, setMStatus] = useState("")
  const [mBuyer, setMBuyer] = useState("")
  const [mRate, setMRate] = useState("")
  const [mQty, setMQty] = useState("")
  const [mUnit, setMUnit] = useState("bag") // bag | kg | mound — what the rate is per
  const [mPay, setMPay] = useState("PENDING")
  const [mPaid, setMPaid] = useState("") // amount received when payment is PARTIAL

  const [settle, setSettle] = useState<any | null>(null)
  const [sCommRate, setSCommRate] = useState("2.5")
  const [sLabour, setSLabour] = useState("")
  const [sNotes, setSNotes] = useState("")
  const [settleError, setSettleError] = useState<string | null>(null)

  async function loadLots() {
    setLoading(true)
    try {
      const res = await fetch("/api/lots?status=ALL")
      const data = await res.json()
      setLots(data.lots || [])
    } catch { setLots([]) }
    setLoading(false)
  }

  async function loadRefs() {
    const [f, c, w, b, s, m] = await Promise.all([
      fetch("/api/farmers").then((r) => r.json()).catch(() => ({})),
      fetch("/api/categories").then((r) => r.json()).catch(() => ({})),
      fetch("/api/warehouse").then((r) => r.json()).catch(() => ({})),
      fetch("/api/customers").then((r) => r.json()).catch(() => ({})),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({})),
      fetch("/api/markhas").then((r) => r.json()).catch(() => ({})),
    ])
    setFarmers(f.farmers || [])
    setCategories(c.categories || [])
    setWarehouses(w.warehouses || [])
    setBuyers(b.customers || [])
    setShop(s.shop || null)
    setMarkhas(m.markhas || [])
  }

  useEffect(() => { loadRefs() }, [])
  useEffect(() => { loadLots() }, [])

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const netPreview = (() => {
    const g = parseFloat(form.grossWeight); const tare = parseFloat(form.tareWeight) || 0
    return isNaN(g) ? null : g - tare
  })()

  async function handleCreate() {
    if (!form.categoryName.trim()) { setError("Please enter a category."); return }
    if (!form.billNo.trim()) { setError("Please enter a bill no."); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/lots", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d?.error || "Failed to create lot.")
      } else {
        // A newly typed category was created server-side; add it to the suggestions.
        const { lot } = await res.json().catch(() => ({}))
        if (lot?.category && !categories.some((c) => c.id === lot.category.id)) {
          setCategories((prev) => [...prev, lot.category].sort((a, b) => a.name.localeCompare(b.name)))
        }
        setForm({ ...EMPTY }); setShowCreate(false); loadLots()
        if (lot?.lotNo) alert(`Lot saved. ID: ${lot.lotNo}`)
      }
    } catch { setError("Network error. Please try again.") }
    setSaving(false)
  }

  function openManage(lot: any) {
    setManage(lot)
    setMStatus(simpleStatus(lot.status))
    setMBuyer(lot.buyer?.id || "")
    setMRate(lot.saleRate != null ? String(lot.saleRate) : "")
    // Quantity sold defaults to the lot's bag count, rate per bag
    setMQty(lot.saleQty != null ? String(lot.saleQty) : lot.bags != null ? String(lot.bags) : "")
    setMUnit(lot.saleUnit || "bag")
    setMPay(lot.paymentStatus || "PENDING")
    setMPaid(lot.paymentStatus === "PARTIAL" && lot.paidAmount ? String(lot.paidAmount) : "")
  }

  const isSaleStage = mStatus === "SOLD"
  const mAmount = (parseFloat(mQty) || 0) * (parseFloat(mRate) || 0)

  async function saveManage() {
    if (!manage) return
    const payload: any = { status: mStatus === simpleStatus(manage.status) ? manage.status : mStatus }
    if (isSaleStage) {
      if (!mBuyer) return alert("Select the buyer")
      if (!(parseFloat(mQty) > 0)) return alert("Enter the quantity sold")
      if (!(parseFloat(mRate) > 0)) return alert("Enter the rate")
      payload.buyerId = mBuyer
      payload.saleQty = mQty
      payload.saleUnit = mUnit
      payload.saleRate = mRate
      if (mPay === "PARTIAL" && !(parseFloat(mPaid) > 0 && parseFloat(mPaid) < mAmount)) {
        return alert("Enter the amount paid (more than 0 and less than the sale amount)")
      }
      payload.paymentStatus = mPay
      if (mPay === "PARTIAL") payload.paidAmount = mPaid
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/lots/${manage.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        return alert(d?.error || "Failed to save")
      }
      setManage(null); loadLots()
    } finally {
      setSaving(false)
    }
  }

  async function cancelLot(lot: any) {
    if (!confirm(`Cancel ${lot.lotNo}? Its status will be set to CANCELLED.`)) return
    await fetch(`/api/lots/${lot.id}`, { method: "DELETE" })
    loadLots()
  }


  // ── Prints: same Urdu bill layout as Bill Maker ──
  const UR_STATUS: Record<string, string> = { STORED: "اسٹور میں", SOLD: "فروخت شدہ", CANCELLED: "منسوخ" }
  const UR_BAG: Record<string, string> = { bori: "بوری", jali: "جالی", tora: "توڑا" }
  const UR_PAY: Record<string, string> = { PENDING: "باقی", PARTIAL: "جزوی", PAID: "ادا شدہ" }
  const e = (v: unknown) => escapeHtml(v ?? "—")
  const n = (v: number | null | undefined) => (v != null ? Number(v).toLocaleString("en-PK", { maximumFractionDigits: 2 }) : "—")
  const d = (v: string | Date | null | undefined) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "numeric", year: "2-digit" }) : "—")
  const bagUr = (lot: any) => UR_BAG[lot.bagType] || "بوری"
  const statusUr = (lot: any) => UR_STATUS[simpleStatus(lot.status)] || lot.status

  function openBillWindow(title: string, body: string) {
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<html dir="rtl"><head><title>${escapeHtml(title)}</title>
${billFontLink}
<style>${billCSS}</style></head><body>
<div dir="ltr">${buildPrintHeader(shop)}</div>
${body}
<script>document.fonts.ready.then(() => window.print())<\/script>
</body></html>`)
    w.document.close()
  }

  // Print a single lot slip. For sold lots it also shows the sale/buyer block.
  function printLot(lot: any) {
    const sold = simpleStatus(lot.status) === "SOLD"
    const markha = [lot.markha1, lot.markha2].filter(Boolean).join("، ")
    openBillWindow(lot.lotNo, `
<div class="meta">
  <div>لاٹ نمبر: <b>${e(lot.lotNo)}</b></div>
  <div>تاریخ: <b>${e(d(lot.createdAt))}</b></div>
</div>
<div class="name">کسان: <strong>${e(lot.farmer?.name)}</strong><span style="margin-inline-start:28px">جنس: <strong>${e(lot.category?.name)}</strong></span></div>
<table>
  <thead><tr><th>تعداد ${bagUr(lot)}</th><th>کل وزن (کلو)</th><th>خالی وزن (کلو)</th><th>صافی وزن (کلو)</th></tr></thead>
  <tbody><tr><td>${n(lot.bags)}</td><td>${n(lot.grossWeight)}</td><td>${n(lot.tareWeight)}</td><td>${n(lot.netWeight)}</td></tr></tbody>
</table>
<div class="sum">
  <div><span>حالت</span><span>${statusUr(lot)}</span></div>
  <div><span>گودام</span><span>${e(lot.warehouse?.name)}</span></div>
  <div><span>گاڑی نمبر</span><span class="num">${e(lot.vehicleNo)}</span></div>
  <div><span>بل نمبر</span><span class="num">${e(lot.billNo)}</span></div>
  ${markha ? `<div><span>مارکہ</span><span>${e(markha)}</span></div>` : ""}
  ${sold ? `
  <div><span>خریدار</span><span>${e(lot.buyer?.name)}</span></div>
  <div><span>ریٹ</span><span class="num">${n(lot.saleRate)}</span></div>
  <div><span>ادائیگی</span><span>${UR_PAY[lot.paymentStatus] || e(lot.paymentStatus)}</span></div>
  <div class="grand"><span>کل رقم</span><span class="num">Rs ${n(lot.saleAmount || 0)}</span></div>`
  : `<div class="grand"><span>صافی وزن</span><span class="num">${n(lot.netWeight)} KG</span></div>`}
</div>
<div class="sig"><span>دستخط وصول کنندہ: ____________</span><span>دستخط: ____________</span></div>`)
  }

  // Print the current (filtered) list of lots: heading shows the filters in use, totals match the screen.
  function printAllLots(list: any[]) {
    const rows = list.map((lot, i) => `<tr${lot.status === "CANCELLED" ? ' style="color:#9ca3af"' : ""}>
      <td>${i + 1}</td><td>${e(lot.lotNo)}</td><td>${e(d(lot.createdAt))}</td>
      <td style="font-family:inherit">${e(lot.farmer?.name)}</td>
      <td style="font-family:inherit">${e(lot.warehouse?.name)}</td>
      <td style="font-family:inherit">${e([lot.markha1, lot.markha2].filter(Boolean).join("، ") || "—")}</td>
      <td>${lot.bags != null ? n(lot.bags) : "—"} <span style="font-family:inherit">${bagUr(lot)}</span></td><td>${n(lot.netWeight)}</td>
      <td style="font-family:inherit">${statusUr(lot)}</td><td style="font-family:inherit">${e(lot.buyer?.name)}</td>
      <td>${lot.saleAmount ? n(lot.saleAmount) : "—"}</td>
    </tr>`).join("")

    // Totals leave out cancelled lots (same as the totals bar on screen)
    const counted = list.filter((l) => l.status !== "CANCELLED")
    const bagsOf = (type: string) => counted.filter((l) => (l.bagType || "bori") === type).reduce((s, l) => s + (l.bags || 0), 0)
    const totalNet = counted.reduce((s, l) => s + (l.netWeight || 0), 0)
    const totalSale = counted.reduce((s, l) => s + (l.saleAmount || 0), 0)
    const totalPaid = counted.reduce((s, l) => s + (l.paidAmount || 0), 0)
    const cancelled = list.length - counted.length

    const godownLabel = reportGodown === "ALL" ? "" : reportGodown === "NONE" ? "بغیر گودام" : warehouses.find((w) => w.id === reportGodown)?.name || ""
    const filters = [
      `حالت: <b>${filter === "ALL" ? "تمام" : UR_STATUS[filter] || filter}</b>`,
      godownLabel && `گودام: <b>${e(godownLabel)}</b>`,
      markhaFilter !== "ALL" && `مارکہ: <b>${e(markhaFilter)}</b>`,
      q && `تلاش: <b>${e(q)}</b>`,
    ].filter(Boolean).join(" · ")

    openBillWindow("Lots Report", `
<style>body { max-width: 1100px; } td, th { font-size: 12px; padding: 6px 5px; }</style>
<div class="meta">
  <div>لاٹ رپورٹ</div>
  <div>تاریخ: <b>${e(d(new Date()))}</b></div>
</div>
<div class="name" style="font-size:13px">${filters}</div>
<table>
  <thead><tr><th>#</th><th>لاٹ نمبر</th><th>تاریخ</th><th>کسان</th><th>گودام</th><th>مارکہ</th><th>تعداد</th><th>صافی وزن</th><th>حالت</th><th>خریدار</th><th>رقم</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="11">کوئی لاٹ نہیں</td></tr>'}</tbody>
</table>
<div class="sum">
  <div><span>کل لاٹ</span><span class="num">${counted.length}${cancelled ? ` (+${cancelled} منسوخ)` : ""}</span></div>
  ${bagsOf("jali") ? `<div><span>کل جالی</span><span class="num">${n(bagsOf("jali"))}</span></div>` : ""}
  ${bagsOf("bori") ? `<div><span>کل بوری</span><span class="num">${n(bagsOf("bori"))}</span></div>` : ""}
  ${bagsOf("tora") ? `<div><span>کل توڑا</span><span class="num">${n(bagsOf("tora"))}</span></div>` : ""}
  <div><span>کل صافی وزن</span><span class="num">${n(totalNet)} KG</span></div>
  <div><span>کل فروخت</span><span class="num">${n(totalSale)}</span></div>
  <div><span>وصول شدہ</span><span class="num">${n(totalPaid)}</span></div>
  <div class="grand"><span>بقایا</span><span class="num">Rs ${n(totalSale - totalPaid)}</span></div>
</div>`)
  }

  // Complete report grouped by godown: which lots are stored where, and when sold.
  async function printGodownReport() {
    const data = await fetch("/api/lots?status=ALL").then((r) => r.json()).catch(() => ({ lots: [] }))
    let all: any[] = data.lots || []
    // Separate report: limit to the chosen godown (or all).
    if (reportGodown !== "ALL") {
      all = all.filter((l) => (reportGodown === "NONE" ? !l.warehouse : l.warehouse?.id === reportGodown))
    }
    const godownName = reportGodown === "ALL" ? "تمام گودام" : reportGodown === "NONE" ? "بغیر گودام" : (warehouses.find((w) => w.id === reportGodown)?.name || "گودام")

    const groups = new Map<string, any[]>()
    for (const lot of all) {
      const key = lot.warehouse?.name || "بغیر گودام"
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(lot)
    }

    const sections = [...groups.entries()].map(([name, list]) => {
      const rows = list.map((lot, i) => `<tr>
        <td>${i + 1}</td><td>${e(lot.lotNo)}</td>
        <td style="font-family:inherit">${e(lot.category?.name)}</td><td style="font-family:inherit">${e(lot.farmer?.name)}</td>
        <td>${lot.bags != null ? n(lot.bags) : "—"}</td><td>${n(lot.netWeight)}</td>
        <td style="font-family:inherit">${statusUr(lot)}</td><td>${lot.soldAt ? e(d(lot.soldAt)) : "—"}</td>
        <td style="font-family:inherit">${e(lot.buyer?.name)}</td><td>${lot.saleAmount ? n(lot.saleAmount) : "—"}</td>
      </tr>`).join("")
      const stored = list.filter((l) => simpleStatus(l.status) === "STORED").length
      const netTotal = list.reduce((s, l) => s + (l.netWeight || 0), 0)
      const saleTotal = list.reduce((s, l) => s + (l.saleAmount || 0), 0)
      return `<div class="section">${e(name)} <small>— <span class="num">${list.length}</span> لاٹ · <span class="num">${stored}</span> اسٹور میں</small></div>
<table>
  <thead><tr><th>#</th><th>لاٹ نمبر</th><th>جنس</th><th>کسان</th><th>تعداد</th><th>صافی وزن</th><th>حالت</th><th>فروخت تاریخ</th><th>خریدار</th><th>رقم</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr><td colspan="5" style="font-family:inherit">میزان</td><td>${n(netTotal)} KG</td><td colspan="3"></td><td>${n(saleTotal)}</td></tr></tfoot>
</table>`
    }).join("")

    const allNet = all.reduce((s, l) => s + (l.netWeight || 0), 0)
    const allSale = all.reduce((s, l) => s + (l.saleAmount || 0), 0)
    openBillWindow(`Godown Report — ${godownName}`, `
<style>body { max-width: 1000px; }</style>
<div class="meta">
  <div>گودام رپورٹ — <b style="font-family:inherit">${e(godownName)}</b></div>
  <div>تاریخ: <b>${e(d(new Date()))}</b></div>
</div>
${sections || '<p style="text-align:center;color:#9ca3af;padding:20px">اس گودام کے لیے کوئی لاٹ نہیں۔</p>'}
<div class="sum">
  <div><span>کل لاٹ</span><span class="num">${all.length}</span></div>
  <div><span>کل صافی وزن</span><span class="num">${n(allNet)} KG</span></div>
  <div class="grand"><span>کل فروخت</span><span class="num">Rs ${n(allSale)}</span></div>
</div>`)
  }

  function openSettle(lot: any) {
    setSettle(lot)
    setSCommRate("2.5")
    setSLabour("")
    setSNotes("")
    setSettleError(null)
  }

  const sTotal = settle?.saleAmount || 0
  const sCommAmount = sTotal * (parseFloat(sCommRate) || 0) / 100
  const sFarmerPayable = sTotal - sCommAmount

  async function submitSettle() {
    if (!settle) return
    setSaving(true); setSettleError(null)
    try {
      const res = await fetch(`/api/lots/${settle.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionRate: sCommRate, labourAmount: sLabour, notes: sNotes }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setSettleError(d?.error || "Failed to settle lot.")
      } else {
        setSettle(null); loadLots()
      }
    } catch { setSettleError("Network error. Please try again.") }
    setSaving(false)
  }

  const q = search.trim().toLowerCase()
  const visibleLots = lots.filter((l) => {
    if (filter !== "ALL" && simpleStatus(l.status) !== filter) return false
    if (markhaFilter !== "ALL" && l.markha1 !== markhaFilter && l.markha2 !== markhaFilter) return false
    if (reportGodown === "NONE" && l.warehouse) return false
    if (reportGodown !== "ALL" && reportGodown !== "NONE" && l.warehouse?.id !== reportGodown) return false
    if (q) {
      const created = new Date(l.createdAt)
      const haystack = [
        l.lotNo, l.billNo, l.vehicleNo,
        formatDate(l.createdAt),
        created.toISOString().slice(0, 10),               // 2026-09-18
        created.toLocaleDateString("en-PK"),              // 18/9/2026
        l.farmer?.name, l.buyer?.name, l.markha1, l.markha2,
      ].filter(Boolean).join(" ").toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-purple-600" /> {t("Potato Store")}
          </h2>
          <p className="text-gray-500 text-sm">{t("Track each lot from arrival through sale and settlement")}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end items-center">
          <Button variant="outline" className="gap-2" onClick={printGodownReport}>
            <WarehouseIcon className="w-4 h-4" /> {t("Godown Report")}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => printAllLots(visibleLots)} disabled={visibleLots.length === 0}>
            <Printer className="w-4 h-4" /> {t("Print list")}
          </Button>
          <Button className="gap-2" onClick={() => { setForm({ ...EMPTY }); setError(null); setShowCreate(true) }}>
            <Plus className="w-4 h-4" /> {t("New Lot")}
          </Button>
          {/* Sell from stock: choose product, markha and bags from each lot */}
          <LotStockSale buyers={buyers} shop={shop} onChanged={loadLots} />
        </div>
      </div>

      {/* Search by bill no / vehicle no / date */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("Search by bill no, vehicle no, date, lot no...")}
          className="pl-9"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Status + markha filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2 overflow-x-auto pb-1 flex-1 min-w-0">
          {FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                filter === s ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t(FILTER_LABELS[s])}{" "}
              <span className="opacity-75">({s === "ALL" ? lots.length : lots.filter((l) => simpleStatus(l.status) === s).length})</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <WarehouseIcon className="w-4 h-4 text-gray-400" />
          <select
            value={reportGodown}
            onChange={(e) => setReportGodown(e.target.value)}
            className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-ring/20"
            title={t("Filter by godown")}
          >
            <option value="ALL">{t("All Godowns")}</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            <option value="NONE">{t("No godown")}</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Tag className="w-4 h-4 text-gray-400" />
          <select
            value={markhaFilter}
            onChange={(e) => setMarkhaFilter(e.target.value)}
            className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-ring/20"
            title={t("Filter by markha")}
          >
            <option value="ALL">{t("All markhas")}</option>
            <optgroup label={t("Markha 1")}>
              {MARKHA1_OPTIONS.map((name) => <option key={name} value={name}>{name}</option>)}
            </optgroup>
            <optgroup label={t("Markha 2")}>
              {markhas.filter((m) => m.slot === 2).map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
            </optgroup>
          </select>
        </div>
      </div>

      {/* Totals for the lots currently shown (follows status, godown, markha and search filters) */}
      {!loading && (() => {
        const counted = visibleLots.filter((l) => l.status !== "CANCELLED")
        const cancelled = visibleLots.length - counted.length
        const byType = new Map<string, { bags: number; lots: number }>()
        for (const l of counted) {
          const k = l.bagType || "bori"
          const cur = byType.get(k) || { bags: 0, lots: 0 }
          byType.set(k, { bags: cur.bags + (l.bags || 0), lots: cur.lots + 1 })
        }
        const net = counted.reduce((s, l) => s + (l.netWeight || 0), 0)
        const fmtN = (v: number) => v.toLocaleString("en-PK", { maximumFractionDigits: 2 })
        return (
          <div className="flex flex-wrap gap-3">
            {["jali", "bori", "tora"].filter((k) => byType.has(k)).map((k) => (
              <div key={k} className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-2">
                <p className="text-xs text-purple-600 font-medium">{t("Total")} {t(BAG_TYPE_LABEL[k])}</p>
                <p className="text-lg font-bold text-purple-900 tabular-nums">{fmtN(byType.get(k)!.bags)}</p>
                <p className="text-[11px] text-gray-500">{byType.get(k)!.lots} {t("lots")}</p>
              </div>
            ))}
            <button
              type="button"
              onClick={() => printAllLots(visibleLots)}
              disabled={visibleLots.length === 0}
              className="order-last self-center inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-white px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-40"
              title={t("Print the lots shown")}
            >
              <Printer className="w-4 h-4" /> {t("Print")}
            </button>
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-2">
              <p className="text-xs text-gray-500 font-medium">{t("Net wt")}</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums">{fmtN(net)} KG</p>
              <p className="text-[11px] text-gray-500">{counted.length} {t("lots")}{cancelled ? ` · ${cancelled} ${t("cancelled not counted")}` : ""}</p>
            </div>
          </div>
        )
      })()}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading lots...</div>
      ) : visibleLots.length === 0 ? (
        <Card><CardContent className="text-center py-12">
          <Boxes className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">
            {markhaFilter !== "ALL" || reportGodown !== "ALL" || q
              ? `No lots match your search / filters.`
              : `No lots${filter !== "ALL" ? ` with status ${FILTER_LABELS[filter]}` : ""} yet.`}
          </p>
          <p className="text-gray-400 text-sm">Create a lot when goods arrive at your mandi.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleLots.map((lot) => (
            <Card key={lot.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-gray-900">{lot.lotNo}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[simpleStatus(lot.status)]}`}>
                        {t(FILTER_LABELS[simpleStatus(lot.status)] || "Cancelled")}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900">{lot.category?.name || "—"}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{lot.farmer?.name || t("No farmer")}</span>
                      {lot.warehouse && <span className="flex items-center gap-1"><WarehouseIcon className="w-3.5 h-3.5" />{lot.warehouse.name}</span>}
                      {lot.vehicleNo && <span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5" />{lot.vehicleNo}</span>}
                      {lot.billNo && <span className="flex items-center gap-1"><Receipt className="w-3.5 h-3.5" />{t("Bill")} #{lot.billNo}</span>}
                      {lot.netWeight != null && <span>{lot.netWeight} KG</span>}
                      {lot.bags ? (
                        <span>{lot.bags} {t(BAG_TYPE_LABEL[lot.bagType] || "bags")}</span>
                      ) : null}
                      {lot.soldBags > 0 && lot.bags ? (
                        <span className="text-purple-700 font-medium">{lot.soldBags} sold · {Math.max(lot.bags - lot.soldBags, 0)} left</span>
                      ) : null}
                    </div>
                    {(lot.markha1 || lot.markha2) && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-xs text-gray-400">{t("Markha")}:</span>
                        {[lot.markha1, lot.markha2].filter(Boolean).map((mk: string, i: number) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2 py-0.5">
                            <Tag className="w-3 h-3" /> {mk}
                          </span>
                        ))}
                      </div>
                    )}
                    {["SOLD", "DISPATCHED", "SETTLED"].includes(lot.status) && (
                      <p className="text-xs text-gray-600 pt-1">
                        Sold to <b>{lot.buyer?.name || "—"}</b> · {formatCurrency(lot.saleAmount || 0)} ·{" "}
                        <span className={PAY_COLORS[lot.paymentStatus]}>{lot.paymentStatus}</span>
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">{formatDate(lot.createdAt)}</p>
                    <div className="flex gap-1 justify-end mt-2 items-center">
                      <button onClick={() => printLot(lot)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title={t("Print")}>
                        <Printer className="w-4 h-4" />
                      </button>
                      {["SOLD", "DISPATCHED"].includes(lot.status) && (
                        <button
                          onClick={() => openSettle(lot)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-md bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700"
                          title="Settle lot"
                        >
                          Settle
                        </button>
                      )}
                      {simpleStatus(lot.status) === "STORED" && (
                        <button
                          onClick={() => { openManage(lot); setMStatus("SOLD") }}
                          className="text-xs font-semibold px-2.5 py-1 rounded-md bg-green-600 text-white hover:bg-green-700"
                          title="Mark this lot as sold"
                        >
                          {t("Sold")}
                        </button>
                      )}
                      {lot.status !== "CANCELLED" && lot.status !== "SETTLED" && (
                        <>
                          <button onClick={() => openManage(lot)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Manage">
                            <Settings2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => cancelLot(lot)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Cancel">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader><DialogTitle>{t("New Lot")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("Category")} *</Label>
                {addingCat ? (
                  <div className="flex gap-1.5">
                    <Input
                      autoFocus
                      value={newCat}
                      onChange={(e) => setNewCat(e.target.value)}
                      placeholder={t("New category")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newCat.trim()) { e.preventDefault(); addLotCategory(newCat) }
                        if (e.key === "Escape") { e.preventDefault(); setAddingCat(false) }
                      }}
                    />
                    <Button type="button" size="sm" className="h-9" disabled={!newCat.trim()}
                      onClick={() => addLotCategory(newCat)}>
                      {t("Add")}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-9 px-2" onClick={() => setAddingCat(false)} title={t("Cancel")}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <select
                      value={form.categoryName}
                      onChange={(e) => set("categoryName", e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    >
                      {Array.from(new Set([DEFAULT_LOT_CATEGORY, ...extraCats, form.categoryName].filter(Boolean))).map((name) => (
                        <option key={name} value={name}>{t(name)}</option>
                      ))}
                    </select>
                    <Button type="button" size="sm" variant="outline" className="h-9 px-2.5" title={t("Add category")}
                      onClick={() => { setNewCat(""); setAddingCat(true) }}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <Label>{t("Farmer")}</Label>
                <Select value={form.farmerId} onValueChange={(v) => set("farmerId", v)}>
                  <SelectTrigger><SelectValue placeholder={t("Select farmer")} /></SelectTrigger>
                  <SelectContent>
                    {farmers.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("Godown")}</Label>
                <Select value={form.warehouseId} onValueChange={(v) => set("warehouseId", v)}>
                  <SelectTrigger><SelectValue placeholder={t("Select godown")} /></SelectTrigger>
                  <SelectContent>
                    {warehouses.filter((w) => w.isPotato).map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {!warehouses.some((w) => w.isPotato) && (
                  <p className="text-xs text-gray-400 mt-1">{t("No potato godown yet. Mark one in Warehouse.")}</p>
                )}
              </div>
              <div><Label>{t("Vehicle No")}</Label><Input value={form.vehicleNo} onChange={(e) => set("vehicleNo", e.target.value)} placeholder="e.g. LES-1234" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label>{t("Bill No")} *</Label><Input value={form.billNo} onChange={(e) => set("billNo", e.target.value)} /></div>
              <div>
                <Label>{t("Markha 1")}</Label>
                <select value={form.markha1} onChange={(e) => set("markha1", e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-xs focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-ring/20">
                  <option value="">— {t("None")} —</option>
                  {MARKHA1_OPTIONS.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
              <div>
                <Label>{t("Markha 2")}</Label>
                <SearchableSelect
                  value={form.markha2}
                  onValueChange={(v) => set("markha2", v === NO_MARKHA ? "" : v)}
                  placeholder={`— ${t("None")} —`}
                  searchPlaceholder={t("Search markha...")}
                  emptyText={t("No markhas")}
                  options={[
                    { value: NO_MARKHA, label: `— ${t("None")} —` },
                    ...markhas.filter((m) => m.slot === 2).map((m) => ({ value: m.name, label: m.name })),
                  ]}
                  className="mt-1 h-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("Bag Type")}</Label>
                <Select value={form.bagType} onValueChange={(v) => set("bagType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bori">{t("Bori")}</SelectItem>
                    <SelectItem value="jali">{t("Jali")}</SelectItem>
                    <SelectItem value="tora">{t("Tora")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("Bags")}</Label><Input type="number" value={form.bags} onChange={(e) => set("bags", e.target.value)} placeholder="0" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label>{t("Gross wt")}</Label><Input type="number" value={form.grossWeight} onChange={(e) => set("grossWeight", e.target.value)} placeholder="0" /></div>
              <div><Label>{t("Tare wt")}</Label><Input type="number" value={form.tareWeight} onChange={(e) => set("tareWeight", e.target.value)} placeholder="0" /></div>
              <div>
                <Label>{t("Net wt")}</Label>
                <Input value={netPreview != null ? String(netPreview) : ""} readOnly placeholder={t("auto")} className="bg-gray-50" />
              </div>
            </div>
            <div><Label>{t("Notes")}</Label><Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder={t("Optional")} /></div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1" disabled={saving}>{t("Cancel")}</Button>
              <Button onClick={handleCreate} className="flex-1" disabled={saving}>{saving ? t("Saving...") : t("Create Lot")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage dialog */}
      <Dialog open={!!manage} onOpenChange={(o) => !o && setManage(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Manage {manage?.lotNo}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Status</Label>
              <Select value={mStatus} onValueChange={setMStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STORED">{t("Stored")}</SelectItem>
                  <SelectItem value="SOLD">{t("Sold")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isSaleStage && (
              <div className="space-y-3 rounded-lg border border-gray-200 p-3 bg-gray-50">
                <p className="text-xs font-medium text-gray-500">Sale details</p>
                <div>
                  <Label>Buyer (Trader)</Label>
                  <Select value={mBuyer} onValueChange={setMBuyer}>
                    <SelectTrigger><SelectValue placeholder="Select buyer" /></SelectTrigger>
                    <SelectContent>
                      {buyers.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Quantity *</Label>
                    <Input type="number" value={mQty} onChange={(e) => setMQty(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <select
                      value={mUnit}
                      onChange={(e) => setMUnit(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm"
                    >
                      <option value="bag">{t(BAG_TYPE_LABEL[manage?.bagType] || "Bori")}</option>
                      <option value="kg">KG</option>
                      <option value="mound">{t("Mound")} (40 kg)</option>
                    </select>
                  </div>
                  <div>
                    <Label>Rate * <span className="font-normal text-gray-400 text-[11px]">/ {mUnit === "bag" ? t(BAG_TYPE_LABEL[manage?.bagType] || "Bori") : mUnit === "kg" ? "kg" : t("Mound")}</span></Label>
                    <Input type="number" value={mRate} onChange={(e) => setMRate(e.target.value)} placeholder="0" />
                  </div>
                </div>
                <div className="rounded-md bg-white border border-purple-200 px-3 py-2 flex justify-between items-center text-sm">
                  <span className="text-gray-500">Amount <span className="text-xs">({mQty || 0} × {mRate || 0})</span></span>
                  <span className="font-bold text-purple-700 tabular-nums">{formatCurrency(mAmount)}</span>
                </div>
                <p className="text-[11px] text-gray-400">This amount is charged to the buyer&apos;s ledger.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Payment</Label>
                    <Select value={mPay} onValueChange={setMPay}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["PENDING", "PARTIAL", "PAID"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {mPay === "PARTIAL" && (
                    <div>
                      <Label>Amount paid *</Label>
                      <Input type="number" autoFocus value={mPaid} onChange={(e) => setMPaid(e.target.value)} placeholder="0" />
                    </div>
                  )}
                </div>
                {mAmount > 0 && (
                  <div className="text-xs text-gray-600 flex justify-between">
                    <span>Paid: <b className="text-green-700">{formatCurrency(mPay === "PAID" ? mAmount : mPay === "PARTIAL" ? parseFloat(mPaid) || 0 : 0)}</b></span>
                    <span>Balance due: <b className="text-red-600">{formatCurrency(Math.max(mAmount - (mPay === "PAID" ? mAmount : mPay === "PARTIAL" ? parseFloat(mPaid) || 0 : 0), 0))}</b></span>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setManage(null)} className="flex-1" disabled={saving}>Close</Button>
              <Button onClick={saveManage} className="flex-1" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settle dialog */}
      <Dialog open={!!settle} onOpenChange={(o) => !o && setSettle(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Settle {settle?.lotNo}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Sold to <b className="text-gray-700">{settle?.buyer?.name || "—"}</b> for{" "}
              <b className="text-gray-700">{formatCurrency(sTotal)}</b>. Settling posts the buyer receivable,
              farmer payable and commission income.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Commission rate (%)</Label><Input type="number" value={sCommRate} onChange={(e) => setSCommRate(e.target.value)} placeholder="2.5" /></div>
              <div><Label>Labour (Rs)</Label><Input type="number" value={sLabour} onChange={(e) => setSLabour(e.target.value)} placeholder="0" /></div>
            </div>
            <div><Label>Notes</Label><Input value={sNotes} onChange={(e) => setSNotes(e.target.value)} placeholder="Optional" /></div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm space-y-1">
              <div className="flex justify-between gap-2 flex-wrap"><span className="text-gray-500">Sale value</span><span className="font-medium">{formatCurrency(sTotal)}</span></div>
              <div className="flex justify-between gap-2 flex-wrap"><span className="text-gray-500">Commission ({sCommRate || 0}%)</span><span className="font-medium text-emerald-700">− {formatCurrency(sCommAmount)}</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-1 mt-1 gap-2 flex-wrap"><span className="text-gray-700 font-semibold">Farmer payable</span><span className="font-bold text-gray-900">{formatCurrency(sFarmerPayable)}</span></div>
            </div>

            {settleError && <p className="text-sm text-red-600">{settleError}</p>}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setSettle(null)} className="flex-1" disabled={saving}>Cancel</Button>
              <Button
                onClick={submitSettle}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
                disabled={saving}
              >
                {saving ? "Settling..." : "Confirm Settlement"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
