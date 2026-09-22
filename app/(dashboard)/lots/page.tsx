"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { CreatableCombobox } from "@/components/ui/creatable-combobox"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Plus, Boxes, User, Warehouse as WarehouseIcon, Settings2, XCircle, Truck, Receipt, Printer, Tag, Search } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { buildPrintHeader, receiptCSS, reportCSS } from "@/lib/print-utils"

const STATUSES = ["ARRIVED", "WEIGHED", "STORED", "AVAILABLE", "IN_AUCTION", "SOLD", "DISPATCHED", "SETTLED", "CANCELLED"] as const

// Markha 1 is a fixed list of potato grades — not shop-editable like Markha 2.
const MARKHA1_OPTIONS = ["Safaid Beeg", "Surkh Beeg", "Safaid Rashan", "Surkh Rashan", "Safaid Goli", "Surkh Goli"]

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

const EMPTY = {
  farmerId: "", categoryName: "", warehouseId: "",
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
  const [mPay, setMPay] = useState("PENDING")

  const [settle, setSettle] = useState<any | null>(null)
  const [sCommRate, setSCommRate] = useState("2.5")
  const [sLabour, setSLabour] = useState("")
  const [sNotes, setSNotes] = useState("")
  const [settleError, setSettleError] = useState<string | null>(null)

  async function loadLots() {
    setLoading(true)
    try {
      const res = await fetch(`/api/lots?status=${filter}`)
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
  useEffect(() => { loadLots() }, [filter])

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
      }
    } catch { setError("Network error. Please try again.") }
    setSaving(false)
  }

  function openManage(lot: any) {
    setManage(lot)
    setMStatus(lot.status)
    setMBuyer(lot.buyer?.id || "")
    setMRate(lot.saleRate != null ? String(lot.saleRate) : "")
    setMPay(lot.paymentStatus || "PENDING")
  }

  const isSaleStage = ["SOLD", "DISPATCHED", "SETTLED"].includes(mStatus)

  async function saveManage() {
    if (!manage) return
    setSaving(true)
    const payload: any = { status: mStatus }
    if (isSaleStage) {
      payload.buyerId = mBuyer || null
      payload.saleRate = mRate
      payload.paymentStatus = mPay
    }
    await fetch(`/api/lots/${manage.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    })
    setManage(null); setSaving(false); loadLots()
  }

  async function cancelLot(lot: any) {
    if (!confirm(`Cancel ${lot.lotNo}? Its status will be set to CANCELLED.`)) return
    await fetch(`/api/lots/${lot.id}`, { method: "DELETE" })
    loadLots()
  }

  const money = (n: number) => "PKR " + (n || 0).toLocaleString()
  const bagLabel = (lot: any) => t(BAG_TYPE_LABEL[lot.bagType] || "bags")

  // Print a single lot slip. For sold lots it also shows the sale/buyer block.
  function printLot(lot: any) {
    const w = window.open("", "_blank")
    if (!w) return
    const sold = ["SOLD", "DISPATCHED", "SETTLED"].includes(lot.status)
    const info: [string, string][] = [
      ["Lot No", lot.lotNo],
      ["Date", new Date(lot.createdAt).toLocaleDateString("en-PK")],
      ["Status", String(lot.status).replace("_", " ")],
      ["Category", lot.category?.name || "—"],
      ["Farmer", lot.farmer?.name || "—"],
      ["Godown", lot.warehouse?.name || "—"],
      ["Vehicle No", lot.vehicleNo || "—"],
      ["Bill No", lot.billNo || "—"],
      ["Markha", [lot.markha1, lot.markha2].filter(Boolean).join(", ") || "—"],
      ["Bags", lot.bags != null ? `${lot.bags} ${bagLabel(lot)}` : "—"],
      ["Gross / Tare / Net", `${lot.grossWeight ?? "—"} / ${lot.tareWeight ?? "—"} / ${lot.netWeight ?? "—"} KG`],
    ]
    if (sold) {
      info.push(
        ["Buyer (Trader)", lot.buyer?.name || "—"],
        ["Sale Rate", lot.saleRate != null ? money(lot.saleRate) : "—"],
        ["Payment", lot.paymentStatus || "—"],
      )
    }
    const infoHtml = info.map(([l, v]) => `<div><div class="lbl">${l}</div><div class="val">${v}</div></div>`).join("")
    w.document.write(`<html><head><title>${lot.lotNo}</title><style>${receiptCSS}</style></head><body>
      ${buildPrintHeader(shop)}
      <div class="doc-header"><div><div class="doc-title">Lot Slip — ${lot.lotNo}</div><div class="doc-sub">${sold ? "Sold lot" : "Lot record"}</div></div>
      <div class="doc-meta">${new Date().toLocaleString("en-PK")}</div></div>
      <div class="body-pad"><div class="info-grid">${infoHtml}</div>
      ${sold && lot.saleAmount ? `<div class="totals-box"><table><tr><td>Sale Amount</td><td style="text-align:right" class="grand">${money(lot.saleAmount)}</td></tr></table></div>` : ""}
      <div class="sig-row"><span>Received by ______________</span><span>${shop?.name || ""}</span></div>
      </div>
      <script>window.onload=()=>window.print()<\/script></body></html>`)
    w.document.close()
  }

  // Print the current (filtered) list of lots as a report.
  function printAllLots(list: any[]) {
    const w = window.open("", "_blank")
    if (!w) return
    const date = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
    const rows = list.map((lot, i) => `<tr>
      <td>${i + 1}</td>
      <td>${lot.lotNo}</td>
      <td>${new Date(lot.createdAt).toLocaleDateString("en-PK")}</td>
      <td>${lot.category?.name || "—"}</td>
      <td>${lot.farmer?.name || "—"}</td>
      <td>${lot.bags != null ? `${lot.bags} ${bagLabel(lot)}` : "—"}</td>
      <td style="text-align:right">${lot.netWeight != null ? lot.netWeight : "—"}</td>
      <td>${String(lot.status).replace("_", " ")}</td>
      <td>${lot.buyer?.name || "—"}</td>
      <td style="text-align:right">${lot.saleAmount ? money(lot.saleAmount) : "—"}</td>
    </tr>`).join("")
    const totalSale = list.reduce((s, l) => s + (l.saleAmount || 0), 0)
    w.document.write(`<html><head><title>Lots Report</title><style>${reportCSS} body{max-width:1000px;margin:0 auto}</style></head><body>
      ${buildPrintHeader(shop)}
      <div class="doc-header"><div><div class="doc-title">Lots Report</div><div class="doc-sub">${list.length} lots · ${filter === "ALL" ? "All statuses" : String(filter).replace("_", " ")} · ${date}</div></div></div>
      <div class="body-pad"><table>
        <thead><tr><th>#</th><th>Lot No</th><th>Date</th><th>Category</th><th>Farmer</th><th>Bags</th><th style="text-align:right">Net (KG)</th><th>Status</th><th>Buyer</th><th style="text-align:right">Sale Amount</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="9">Total Sale Value</td><td style="text-align:right">${money(totalSale)}</td></tr></tfoot>
      </table></div>
      <script>window.onload=()=>window.print()<\/script></body></html>`)
    w.document.close()
  }

  // Complete report grouped by godown: which lots are stored where, and when sold.
  async function printGodownReport() {
    const data = await fetch("/api/lots?status=ALL").then((r) => r.json()).catch(() => ({ lots: [] }))
    let all: any[] = data.lots || []
    // Separate report: limit to the chosen godown (or all).
    if (reportGodown !== "ALL") {
      all = all.filter((l) => (reportGodown === "NONE" ? !l.warehouse : l.warehouse?.id === reportGodown))
    }
    const godownName = reportGodown === "ALL" ? "All Godowns" : reportGodown === "NONE" ? "No godown" : (warehouses.find((w) => w.id === reportGodown)?.name || "Godown")
    const w = window.open("", "_blank")
    if (!w) return
    const date = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })

    const groups = new Map<string, any[]>()
    for (const lot of all) {
      const key = lot.warehouse?.name || "— No godown —"
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(lot)
    }

    const sections = [...groups.entries()].map(([name, list]) => {
      const rows = list.map((lot, i) => `<tr>
        <td>${i + 1}</td>
        <td>${lot.lotNo}</td>
        <td>${lot.category?.name || "—"}</td>
        <td>${lot.farmer?.name || "—"}</td>
        <td>${lot.bags != null ? `${lot.bags} ${bagLabel(lot)}` : "—"}</td>
        <td style="text-align:right">${lot.netWeight != null ? lot.netWeight : "—"}</td>
        <td>${String(lot.status).replace("_", " ")}</td>
        <td>${lot.soldAt ? new Date(lot.soldAt).toLocaleDateString("en-PK") : "—"}</td>
        <td>${lot.buyer?.name || "—"}</td>
        <td style="text-align:right">${lot.saleAmount ? money(lot.saleAmount) : "—"}</td>
      </tr>`).join("")
      const stored = list.filter((l) => !["SOLD", "DISPATCHED", "SETTLED", "CANCELLED"].includes(l.status)).length
      const netTotal = list.reduce((s, l) => s + (l.netWeight || 0), 0)
      const saleTotal = list.reduce((s, l) => s + (l.saleAmount || 0), 0)
      return `<div style="margin-bottom:22px">
        <div style="font-weight:800;color:#5b21b6;font-size:13px;margin-bottom:5px">🏬 ${name}
          <span style="font-weight:500;color:#6b7280;font-size:11px">— ${list.length} lots · ${stored} in stock</span></div>
        <table>
          <thead><tr><th>#</th><th>Lot No</th><th>Category</th><th>Farmer</th><th>Bags</th><th style="text-align:right">Net (KG)</th><th>Status</th><th>Sold On</th><th>Buyer</th><th style="text-align:right">Sale</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="5">Subtotal</td><td style="text-align:right">${netTotal.toLocaleString()} KG</td><td colspan="3"></td><td style="text-align:right">${money(saleTotal)}</td></tr></tfoot>
        </table>
      </div>`
    }).join("")

    w.document.write(`<html><head><title>Godown Report — ${godownName}</title><style>${reportCSS} body{max-width:1000px;margin:0 auto}</style></head><body>
      ${buildPrintHeader(shop)}
      <div class="doc-header"><div><div class="doc-title">Godown Report — ${godownName}</div><div class="doc-sub">${groups.size} godown(s) · ${all.length} lots · ${date}</div></div></div>
      <div class="body-pad">${sections || '<p style="text-align:center;color:#9ca3af;padding:20px">No lots for this godown.</p>'}</div>
      <script>window.onload=()=>window.print()<\/script></body></html>`)
    w.document.close()
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
            <Printer className="w-4 h-4" /> {t("Print All")}
          </Button>
          <Button className="gap-2" onClick={() => { setForm({ ...EMPTY }); setError(null); setShowCreate(true) }}>
            <Plus className="w-4 h-4" /> {t("New Lot")}
          </Button>
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
          {["ALL", ...STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                filter === s ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "ALL" ? "All" : s.replace("_", " ")}
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
              {MARKHA1_OPTIONS.map((name) => <option key={name} value={name}>{t(name)}</option>)}
            </optgroup>
            <optgroup label={t("Markha 2")}>
              {markhas.filter((m) => m.slot === 2).map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
            </optgroup>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading lots...</div>
      ) : visibleLots.length === 0 ? (
        <Card><CardContent className="text-center py-12">
          <Boxes className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">
            {markhaFilter !== "ALL" || reportGodown !== "ALL" || q
              ? `No lots match your search / filters.`
              : `No lots${filter !== "ALL" ? ` with status ${filter.replace("_", " ")}` : ""} yet.`}
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
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[lot.status]}`}>
                        {lot.status.replace("_", " ")}
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
                <CreatableCombobox
                  value={form.categoryName}
                  onChange={(v) => set("categoryName", v)}
                  options={categories.map((c) => c.name)}
                  placeholder={t("Search or type category")}
                  newLabel={t("New category")}
                />
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
                  {MARKHA1_OPTIONS.map((name) => <option key={name} value={name}>{t(name)}</option>)}
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
                  {STATUSES.filter((s) => s !== "CANCELLED" && s !== "SETTLED").map((s) => (
                    <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                  ))}
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
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Sale rate (per unit)</Label><Input type="number" value={mRate} onChange={(e) => setMRate(e.target.value)} placeholder="0" /></div>
                  <div>
                    <Label>Payment</Label>
                    <Select value={mPay} onValueChange={setMPay}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["PENDING", "PARTIAL", "PAID"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {mRate && manage?.netWeight != null && (
                  <p className="text-xs text-gray-500">Amount ≈ <b>{formatCurrency(parseFloat(mRate) * manage.netWeight)}</b> ({manage.netWeight} × {mRate})</p>
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
