"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { FileText, Plus, Trash2, Printer, RotateCcw, Save, FolderOpen, Search } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { recordCode } from "@/lib/record-code"
import { billCSS, billFontLink, buildPrintHeader, escapeHtml } from "@/lib/print-utils"

// Bill maker: bills can be saved to the database (Saved Bills list) and printed.
// The next bill number is remembered in this browser and follows the highest saved bill.

type Row = { date: string; weight: string }
type UnitType = "Jali" | "Bori" | "Bag"
type RateUnit = "kg" | "mound"

const MOUND_KG = 40 // 1 mound = 40 kg

// Fixed product list (English value → Urdu for the printed bill)
const PRODUCTS: { value: string; ur: string }[] = [
  { value: "Munji", ur: "مونجی" },
  { value: "Potato", ur: "آلو" },
  { value: "Makki", ur: "مکئی" },
]

// Labels that change with the chosen packing unit (Jali / Bori / Bag)
const UNIT_LABELS: Record<UnitType, { cutPerLabel: string; unitCutLabel: string; cutSummaryLabel: string; ur: string }> = {
  Jali: { cutPerLabel: "Cut per jali (KG)", unitCutLabel: "Jali cut (KG)", cutSummaryLabel: "Jali cut", ur: "جالی" },
  Bori: { cutPerLabel: "Cut per bori (KG)", unitCutLabel: "Bori cut (KG)", cutSummaryLabel: "Bori cut", ur: "بوری" },
  Bag: { cutPerLabel: "Cut per bag (KG)", unitCutLabel: "Bag cut (KG)", cutSummaryLabel: "Bag cut", ur: "بیگ" },
}

const todayStr = () => new Date().toISOString().slice(0, 10)
const emptyRow = (): Row => ({ date: todayStr(), weight: "" })
const num = (v: string) => parseFloat(v) || 0
const fmt = (n: number) => n.toLocaleString("en-PK", { maximumFractionDigits: 2 })
const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "numeric", year: "2-digit" }) : "")
const BILL_NO_KEY = "billMaker.nextBillNo"

function readStoredNext() {
  try { return parseInt(localStorage.getItem(BILL_NO_KEY) || "", 10) || 1 } catch { return 1 }
}

export default function BillMakerPage() {
  const { t } = useLang()
  const [shop, setShop] = useState<any>(null)
  const [savedBills, setSavedBills] = useState<any[]>([])
  const [billSearch, setBillSearch] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [billNo, setBillNo] = useState("1")
  const [billDate, setBillDate] = useState(todayStr())
  const [name, setName] = useState("")          // trader name, used on the printed bill
  const [customerId, setCustomerId] = useState("") // trader the bill is charged to (goes to their ledger)
  const [traders, setTraders] = useState<any[]>([])
  const [product, setProduct] = useState("")
  const [unitType, setUnitType] = useState<UnitType>("Jali")
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [cutPerUnit, setCutPerUnit] = useState("")
  const [cutOverride, setCutOverride] = useState("")
  const [vehicleCut, setVehicleCut] = useState("")
  const [rateUnit, setRateUnit] = useState<RateUnit>("kg")
  const [rate, setRate] = useState("")

  // Next free bill number: after the highest numeric saved bill and the number stored in this browser.
  function nextBillNo(bills = savedBills) {
    const maxSaved = bills.reduce((m, b) => {
      const n = parseInt(b.billNo, 10)
      return !isNaN(n) && String(n) === String(b.billNo).trim() ? Math.max(m, n) : m
    }, 0)
    return String(Math.max(readStoredNext(), maxSaved + 1))
  }

  async function loadBills() {
    try {
      const r = await fetch("/api/bills")
      if (!r.ok) return savedBills
      const d = await r.json()
      setSavedBills(d.bills || [])
      return d.bills || []
    } catch {
      return savedBills
    }
  }

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setShop(d.shop || null)).catch(() => {})
    fetch("/api/customers").then((r) => r.json()).then((d) => setTraders(d.customers || [])).catch(() => {})
    setBillNo(nextBillNo([]))
    loadBills().then((bills) => setBillNo(nextBillNo(bills)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ul = UNIT_LABELS[unitType]

  const totalWeight = rows.reduce((s, r) => s + num(r.weight), 0)
  // Unit cut (KG) = total weight ÷ cut per unit
  const autoCut = num(cutPerUnit) > 0 ? Math.round((totalWeight / num(cutPerUnit)) * 100) / 100 : 0
  const cut = cutOverride !== "" ? num(cutOverride) : autoCut
  const weightAfterCut = totalWeight - cut
  const safiWeight = weightAfterCut - num(vehicleCut)
  const mounds = safiWeight > 0 ? safiWeight / MOUND_KG : 0
  const ratePerKg = rateUnit === "mound" ? num(rate) / MOUND_KG : num(rate)
  const amount = Math.round(rateUnit === "mound" ? mounds * num(rate) : safiWeight * num(rate))

  const productUr = PRODUCTS.find((p) => p.value === product)?.ur || product

  function updateRow(i: number, value: string, field: keyof Row) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }

  // Remember that this bill number is used, so the next new bill gets the following one.
  function markBillNoUsed(no: string) {
    const n = parseInt(no, 10)
    if (isNaN(n) || String(n) !== no.trim()) return
    try { localStorage.setItem(BILL_NO_KEY, String(Math.max(readStoredNext(), n + 1))) } catch {}
  }

  function resetForm(bills = savedBills) {
    setEditingId(null)
    setName(""); setCustomerId(""); setProduct(""); setUnitType("Jali"); setRows([emptyRow()])
    setCutPerUnit(""); setCutOverride(""); setVehicleCut("")
    setRate(""); setRateUnit("kg"); setBillDate(todayStr())
    setBillNo(nextBillNo(bills))
  }

  function newBill() {
    if (!confirm(t("Clear this bill and start a new one?"))) return
    resetForm()
  }

  function validate() {
    if (!customerId) { alert(t("Select a trader")); return null }
    const filled = rows.filter((r) => num(r.weight))
    if (filled.length === 0) { alert(t("Add at least one row")); return null }
    return filled
  }

  async function saveBill() {
    const filled = validate()
    if (!filled) return
    setSaving(true)
    try {
      const payload = {
        billNo, billDate, name, customerId, product,
        totalWeight, safiWeight, amount,
        data: { rows: filled, unitType, cutPerUnit, cutOverride, vehicleCut, rateUnit, rate, cut, mounds },
      }
      const res = await fetch(editingId ? `/api/bills/${editingId}` : "/api/bills", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) return alert(d?.error || t("Failed to save bill"))
      setEditingId(d.bill.id)
      markBillNoUsed(billNo)
      loadBills()
      alert(`${editingId ? t("Bill updated") : t("Bill saved")} — ID: ${recordCode("bill", d.bill.id)}`)
    } finally {
      setSaving(false)
    }
  }

  function openBill(b: any) {
    const d = b.data || {}
    setEditingId(b.id)
    setBillNo(b.billNo)
    setBillDate(new Date(b.billDate).toISOString().slice(0, 10))
    setName(b.name || "")
    setCustomerId(b.customerId || "")
    setProduct(b.product || "")
    setUnitType((d.unitType as UnitType) || "Jali")
    setRows(Array.isArray(d.rows) && d.rows.length ? d.rows.map((r: any) => ({ date: r.date || todayStr(), weight: String(r.weight ?? "") })) : [emptyRow()])
    setCutPerUnit(d.cutPerUnit ?? "")
    setCutOverride(d.cutOverride ?? "")
    setVehicleCut(d.vehicleCut ?? "")
    setRateUnit(d.rateUnit === "mound" ? "mound" : "kg")
    setRate(d.rate ?? "")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function deleteBill(b: any) {
    if (!confirm(`${t("Delete bill")} #${b.billNo} (${b.name})?`)) return
    const res = await fetch(`/api/bills/${b.id}`, { method: "DELETE" })
    if (!res.ok) return alert(t("Failed to delete bill"))
    const bills = await loadBills()
    if (editingId === b.id) resetForm(bills)
  }

  function printBill() {
    const filled = validate()
    if (!filled) return

    const rowHtml = filled.map((r) => `
      <tr><td>${escapeHtml(fmtDate(r.date))}</td><td>${fmt(num(r.weight))}</td></tr>`).join("")

    const rateLine = rateUnit === "mound"
      ? `<div><span>ریٹ (فی من)</span><span class="num">${fmt(num(rate))}</span></div>
         <div><span>وزن فی من</span><span class="num">${MOUND_KG} کلو</span></div>
         <div><span>من</span><span class="num">${fmt(mounds)}</span></div>`
      : `<div><span>ریٹ (فی کلو)</span><span class="num">${fmt(num(rate))}</span></div>`

    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<html dir="rtl"><head><title>Bill ${escapeHtml(billNo)}</title>
${billFontLink}
<style>${billCSS}</style></head><body>
<div dir="ltr">${buildPrintHeader(shop)}</div>
<div class="meta">
  <div>نمبر: <b>${escapeHtml(billNo)}</b>${editingId ? ` <span style="font-size:11px;color:#6b7280">(ID: <b>${recordCode("bill", editingId)}</b>)</span>` : ""}</div>
  <div>تاریخ: <b>${escapeHtml(fmtDate(billDate))}</b></div>
</div>
<div class="name">بنام: <strong>${escapeHtml(name.trim())}</strong>${product ? `<span style="margin-inline-start:28px">جنس: <strong>${escapeHtml(productUr)}</strong></span>` : ""}</div>
<table>
  <thead><tr><th>تاریخ</th><th>وزن (کلو)</th></tr></thead>
  <tbody>${rowHtml}</tbody>
</table>
<div class="sum">
  <div><span>کل وزن</span><span class="num">${fmt(totalWeight)}</span></div>
  <div><span>فی ${ul.ur} کاٹ (کلو)</span><span class="num">${fmt(num(cutPerUnit))}</span></div>
  <div><span>${ul.ur} کاٹ</span><span class="num">− ${fmt(cut)}</span></div>
  <div><span>وزن (کاٹ کے بعد)</span><span class="num">${fmt(weightAfterCut)}</span></div>
  <div><span>گاڑی کاٹ</span><span class="num">− ${fmt(num(vehicleCut))}</span></div>
  <div><span>صافی وزن</span><span class="num">${fmt(safiWeight)}</span></div>
  ${rateLine}
  <div class="grand"><span>کل رقم</span><span class="num">Rs ${fmt(amount)}</span></div>
</div>
<div class="sig"><span>دستخط وصول کنندہ: ____________</span><span>دستخط: ____________</span></div>
<script>document.fonts.ready.then(() => window.print())</script>
</body></html>`)
    w.document.close()
    markBillNoUsed(billNo)
  }

  const q = billSearch.trim().toLowerCase()
  const filteredBills = savedBills.filter((b) =>
    !q || String(b.billNo).toLowerCase().includes(q) || (b.name || "").toLowerCase().includes(q) || (b.product || "").toLowerCase().includes(q))

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-purple-600" /> {t("Bill Maker")}
          </h2>
          <p className="text-gray-500 text-sm">
            {editingId ? <>{t("Editing saved bill")} #{billNo} · ID <span className="font-mono text-purple-700">{recordCode("bill", editingId)}</span></> : t("Make, save and print a weight bill.")}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2" onClick={newBill}><RotateCcw className="w-4 h-4" /> {t("New Bill")}</Button>
          <Button className="gap-2" onClick={printBill}><Printer className="w-4 h-4" /> {t("Print")}</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div><Label>{t("Bill No")}</Label><Input value={billNo} onChange={(e) => setBillNo(e.target.value)} /></div>
            <div><Label>{t("Date")}</Label><Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} /></div>
            <div>
              <Label>{t("Trader")} *</Label>
              <SearchableSelect
                value={customerId}
                onValueChange={(v) => { setCustomerId(v); setName(traders.find((c) => c.id === v)?.name || "") }}
                placeholder={t("Select trader...")}
                options={traders.map((c) => ({ value: c.id, label: c.name, sub: c.phone || undefined }))}
              />
            </div>
            <div>
              <Label>{t("Product")}</Label>
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                <option value="">{t("Select product")}</option>
                {PRODUCTS.map((p) => <option key={p.value} value={p.value}>{t(p.value)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <Label>{t("Entries")}</Label>
              <Button size="sm" variant="outline" onClick={() => setRows((prev) => [...prev, emptyRow()])} className="gap-1">
                <Plus className="w-3 h-3" /> {t("Add Row")}
              </Button>
            </div>
            <div className="hidden sm:grid grid-cols-12 gap-2 px-1 pb-1 text-xs text-gray-500">
              <span className="col-span-5">{t("Date")}</span>
              <span className="col-span-6">{t("Weight (KG)")}</span>
            </div>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-6 sm:col-span-5" type="date" value={r.date} onChange={(e) => updateRow(i, e.target.value, "date")} />
                  <Input className="col-span-5 sm:col-span-6" type="number" placeholder={t("Weight (KG)")} value={r.weight} onChange={(e) => updateRow(i, e.target.value, "weight")} />
                  <button
                    type="button"
                    onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : [emptyRow()]))}
                    className="col-span-1 p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 justify-self-center"
                    title={t("Delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="px-1 pt-2 text-xs text-gray-600">
              {t("Total weight")}: <span className="font-semibold text-gray-900 tabular-nums">{fmt(totalWeight)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <Label>{t("Packing")}</Label>
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value as UnitType)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                <option value="Jali">{t("Jali")}</option>
                <option value="Bori">{t("Bori")}</option>
                <option value="Bag">{t("Bag")}</option>
              </select>
            </div>
            <div>
              <Label>{t(ul.cutPerLabel)}</Label>
              <Input type="number" value={cutPerUnit} onChange={(e) => setCutPerUnit(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>{t(ul.unitCutLabel)}</Label>
              <Input type="number" value={cutOverride} placeholder={fmt(autoCut)} onChange={(e) => setCutOverride(e.target.value)} />
              <p className="text-[11px] text-gray-400 mt-1">{t("Auto: total weight ÷ cut per unit")}</p>
            </div>
            <div>
              <Label>{t("Vehicle cut (KG)")}</Label>
              <Input type="number" value={vehicleCut} onChange={(e) => setVehicleCut(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>{t("Weight after cut")}</Label>
              <Input readOnly value={fmt(weightAfterCut)} className="bg-gray-50 font-medium" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <Label>{t("Rate unit")}</Label>
              <select
                value={rateUnit}
                onChange={(e) => setRateUnit(e.target.value as RateUnit)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                <option value="kg">{t("Per kg")}</option>
                <option value="mound">{t("Per Mound (40 kg)")}</option>
              </select>
            </div>
            <div>
              <Label>{rateUnit === "mound" ? t("Rate / Mound") : t("Rate (per KG)")}</Label>
              <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" />
              {rateUnit === "mound" && num(rate) > 0 && (
                <p className="text-[11px] text-gray-400 mt-1">= Rs {fmt(ratePerKg)} / kg</p>
              )}
            </div>
            {rateUnit === "mound" && (
              <div>
                <Label>{t("Mounds")} <span className="font-normal text-gray-400 text-[11px]">({t("Safi weight")} ÷ 40)</span></Label>
                <Input readOnly value={mounds ? mounds.toFixed(2) : ""} className="bg-gray-50 font-medium" />
              </div>
            )}
            <div>
              <Label>{t("Safi weight")}</Label>
              <Input readOnly value={fmt(safiWeight)} className="bg-gray-50 font-semibold" />
            </div>
          </div>

          <div className="rounded-lg bg-purple-50 p-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span>{t("Total weight")}</span><span className="font-medium tabular-nums">{fmt(totalWeight)}</span></div>
            <div className="flex justify-between"><span>{t(ul.cutSummaryLabel)}</span><span className="font-medium tabular-nums">− {fmt(cut)}</span></div>
            <div className="flex justify-between"><span>{t("Weight after cut")}</span><span className="font-medium tabular-nums">{fmt(weightAfterCut)}</span></div>
            <div className="flex justify-between"><span>{t("Vehicle cut")}</span><span className="font-medium tabular-nums">− {fmt(num(vehicleCut))}</span></div>
            <div className="flex justify-between"><span>{t("Safi weight")}</span><span className="font-semibold tabular-nums">{fmt(safiWeight)}</span></div>
            {rateUnit === "mound" && (
              <div className="flex justify-between"><span>{t("Mounds")} (40 kg)</span><span className="font-medium tabular-nums">{fmt(mounds)}</span></div>
            )}
            <div className="flex justify-between border-t border-purple-200 pt-2 mt-2 text-base">
              <span className="font-semibold">{t("Total amount")}</span>
              <span className="font-bold text-purple-700 tabular-nums">Rs {fmt(amount)}</span>
            </div>
          </div>

          <Button className="w-full gap-2" onClick={saveBill} disabled={saving}>
            <Save className="w-4 h-4" /> {saving ? t("Saving...") : editingId ? t("Update Bill") : t("Save Bill")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">{t("Saved Bills")} <span className="text-gray-400 font-normal text-sm">({savedBills.length})</span></CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input className="pl-9" placeholder={t("Search bill no, name, product...")} value={billSearch} onChange={(e) => setBillSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 px-2 font-medium">{t("Bill No")}</th>
                  <th className="py-2 px-2 font-medium">{t("Date")}</th>
                  <th className="py-2 px-2 font-medium">{t("Name")}</th>
                  <th className="py-2 px-2 font-medium">{t("Product")}</th>
                  <th className="py-2 px-2 font-medium text-right">{t("Safi weight")}</th>
                  <th className="py-2 px-2 font-medium text-right">{t("Total amount")}</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((b) => (
                  <tr key={b.id} className={`border-b border-gray-50 hover:bg-purple-50 ${editingId === b.id ? "bg-purple-50" : ""}`}>
                    <td className="py-2 px-2 font-medium">#{b.billNo}<div className="font-mono text-[11px] text-purple-700 font-normal">{recordCode("bill", b.id)}</div></td>
                    <td className="py-2 px-2 text-gray-600 whitespace-nowrap">{fmtDate(b.billDate)}</td>
                    <td className="py-2 px-2">{b.name}</td>
                    <td className="py-2 px-2 text-gray-600">{b.product ? t(b.product) : "—"}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{fmt(b.safiWeight)}</td>
                    <td className="py-2 px-2 text-right tabular-nums font-medium">Rs {fmt(b.amount)}</td>
                    <td className="py-2 px-2">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openBill(b)} className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100 whitespace-nowrap">
                          <FolderOpen className="w-3 h-3" /> {t("Open")}
                        </button>
                        <button onClick={() => deleteBill(b)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title={t("Delete")}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredBills.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-6 text-gray-400">{t("No saved bills")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
