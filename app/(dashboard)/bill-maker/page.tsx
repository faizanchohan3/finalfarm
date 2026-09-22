"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileText, Plus, Trash2, Printer, RotateCcw } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { buildPrintHeader, escapeHtml } from "@/lib/print-utils"

// Standalone bill maker: nothing is saved to the database, the bill is only printed.
// Only the next bill number is remembered in this browser.

type Row = { date: string; weight: string; qty: string }
type UnitType = "Jali" | "Bori" | "Bag"
type RateUnit = "kg" | "mound"

// Labels that change with the chosen packing unit (Jali / Bori / Bag)
const UNIT_LABELS: Record<UnitType, { cutPerLabel: string; unitCutLabel: string; totalLabel: string; cutSummaryLabel: string; ur: string }> = {
  Jali: { cutPerLabel: "Cut per jali (KG)", unitCutLabel: "Jali cut (KG)", totalLabel: "Total jali", cutSummaryLabel: "Jali cut", ur: "جالی" },
  Bori: { cutPerLabel: "Cut per bori (KG)", unitCutLabel: "Bori cut (KG)", totalLabel: "Total bori", cutSummaryLabel: "Bori cut", ur: "بوری" },
  Bag: { cutPerLabel: "Cut per bag (KG)", unitCutLabel: "Bag cut (KG)", totalLabel: "Total bag", cutSummaryLabel: "Bag cut", ur: "بیگ" },
}

const todayStr = () => new Date().toISOString().slice(0, 10)
const emptyRow = (): Row => ({ date: todayStr(), weight: "", qty: "" })
const num = (v: string) => parseFloat(v) || 0
const fmt = (n: number) => n.toLocaleString("en-PK", { maximumFractionDigits: 2 })
const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "numeric", year: "2-digit" }) : "")
const BILL_NO_KEY = "billMaker.nextBillNo"

export default function BillMakerPage() {
  const { t } = useLang()
  const [shop, setShop] = useState<any>(null)
  const [billNo, setBillNo] = useState("1")
  const [billDate, setBillDate] = useState(todayStr())
  const [name, setName] = useState("")
  const [product, setProduct] = useState("")
  const [unitType, setUnitType] = useState<UnitType>("Jali")
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [cutPerUnit, setCutPerUnit] = useState("0.5")
  const [cutOverride, setCutOverride] = useState("")
  const [vehicleCut, setVehicleCut] = useState("")
  const [rateUnit, setRateUnit] = useState<RateUnit>("kg")
  const [kgPerMound, setKgPerMound] = useState("60")
  const [rate, setRate] = useState("")

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setShop(d.shop || null)).catch(() => {})
    try {
      const saved = localStorage.getItem(BILL_NO_KEY)
      if (saved) setBillNo(saved)
    } catch {}
  }, [])

  const ul = UNIT_LABELS[unitType]

  const totalQty = rows.reduce((s, r) => s + num(r.qty), 0)
  const totalWeight = rows.reduce((s, r) => s + num(r.weight), 0)
  const autoCut = Math.round(totalQty * num(cutPerUnit) * 100) / 100
  const cut = cutOverride !== "" ? num(cutOverride) : autoCut
  const weightAfterCut = totalWeight - cut
  const safiWeight = weightAfterCut - num(vehicleCut)
  const moundDivisor = num(kgPerMound) || 1
  const mounds = safiWeight > 0 ? safiWeight / moundDivisor : 0
  const amount = Math.round(rateUnit === "mound" ? mounds * num(rate) : safiWeight * num(rate))

  function updateRow(i: number, field: keyof Row, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }

  function newBill() {
    if (!confirm(t("Clear this bill and start a new one?"))) return
    setName(""); setProduct(""); setRows([emptyRow()]); setCutOverride(""); setVehicleCut("")
    setRate(""); setRateUnit("kg"); setKgPerMound("60"); setBillDate(todayStr())
  }

  function printBill() {
    const filled = rows.filter((r) => num(r.weight) || num(r.qty))
    if (!name.trim()) return alert(t("Enter the name"))
    if (filled.length === 0) return alert(t("Add at least one row"))

    const rowHtml = filled.map((r) => `
      <tr><td>${escapeHtml(fmtDate(r.date))}</td><td>${fmt(num(r.weight))}</td><td>${fmt(num(r.qty))}</td></tr>`).join("")

    const rateLine = rateUnit === "mound"
      ? `<div><span>ریٹ (فی من)</span><span class="num">${fmt(num(rate))}</span></div>
         <div><span>وزن فی من</span><span class="num">${fmt(moundDivisor)} کلو</span></div>
         <div><span>من</span><span class="num">${fmt(mounds)}</span></div>`
      : `<div><span>ریٹ (فی کلو)</span><span class="num">${fmt(num(rate))}</span></div>`

    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<html dir="rtl"><head><title>Bill ${escapeHtml(billNo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Noto Nastaliq Urdu', 'Segoe UI', Arial, sans-serif; margin: 0 auto; max-width: 640px; color: #1f2937; font-size: 13px; }
  .num { font-family: 'Segoe UI', Arial, sans-serif; direction: ltr; unicode-bidi: embed; }
  .meta { display: flex; justify-content: space-between; align-items: center; padding: 14px 24px 4px; }
  .meta b { font-family: 'Segoe UI', Arial, sans-serif; }
  .name { padding: 4px 24px 12px; border-bottom: 1px solid #e5e7eb; font-size: 15px; }
  table { width: calc(100% - 48px); margin: 14px 24px; border-collapse: collapse; }
  th { background: #f5f3ff; color: #5b21b6; padding: 8px; font-weight: 700; border-bottom: 2px solid #c4b5fd; }
  td { padding: 7px 8px; text-align: center; border-bottom: 1px solid #f3f4f6; font-family: 'Segoe UI', Arial, sans-serif; }
  .sum { width: calc(100% - 48px); margin: 4px 24px; }
  .sum div { display: flex; justify-content: space-between; align-items: center; padding: 7px 10px; border-bottom: 1px dashed #e5e7eb; }
  .sum span:last-child { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 700; }
  .grand { background: #5b21b6; color: #fff; border-radius: 6px; margin-top: 8px; font-size: 16px; border: 0 !important; }
  .sig { display: flex; justify-content: space-between; padding: 40px 24px 20px; font-size: 12px; color: #6b7280; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div dir="ltr">${buildPrintHeader(shop)}</div>
<div class="meta">
  <div>نمبر: <b>${escapeHtml(billNo)}</b></div>
  <div>تاریخ: <b>${escapeHtml(fmtDate(billDate))}</b></div>
</div>
<div class="name">بنام: <strong>${escapeHtml(name.trim())}</strong>${product.trim() ? `<span style="margin-inline-start:28px">جنس: <strong>${escapeHtml(product.trim())}</strong></span>` : ""}</div>
<table>
  <thead><tr><th>تاریخ</th><th>وزن (کلو)</th><th>تعداد ${ul.ur}</th></tr></thead>
  <tbody>${rowHtml}</tbody>
</table>
<div class="sum">
  <div><span>کل ${ul.ur}</span><span class="num">${fmt(totalQty)}</span></div>
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

    // Next bill gets the following number (only when the bill number is numeric).
    const n = parseInt(billNo, 10)
    if (!isNaN(n) && String(n) === billNo.trim()) {
      const next = String(n + 1)
      setBillNo(next)
      try { localStorage.setItem(BILL_NO_KEY, next) } catch {}
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-purple-600" /> {t("Bill Maker")}
          </h2>
          <p className="text-gray-500 text-sm">{t("Make and print a simple weight bill. Nothing is saved.")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={newBill}><RotateCcw className="w-4 h-4" /> {t("New Bill")}</Button>
          <Button className="gap-2" onClick={printBill}><Printer className="w-4 h-4" /> {t("Print")}</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div><Label>{t("Bill No")}</Label><Input value={billNo} onChange={(e) => setBillNo(e.target.value)} /></div>
            <div><Label>{t("Date")}</Label><Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} /></div>
            <div><Label>{t("Name")} *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Party name")} /></div>
            <div><Label>{t("Product")}</Label><Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder={t("e.g. Potato")} /></div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <Label>{t("Entries")}</Label>
              <div className="flex items-center gap-2">
                <select
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value as UnitType)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium shadow-sm"
                  title={t("Packing")}
                >
                  <option value="Jali">{t("Jali")}</option>
                  <option value="Bori">{t("Bori")}</option>
                  <option value="Bag">{t("Bag")}</option>
                </select>
                <Button size="sm" variant="outline" onClick={() => setRows((prev) => [...prev, emptyRow()])} className="gap-1">
                  <Plus className="w-3 h-3" /> {t("Add Row")}
                </Button>
              </div>
            </div>
            <div className="hidden sm:grid grid-cols-12 gap-2 px-1 pb-1 text-xs text-gray-500">
              <span className="col-span-4">{t("Date")}</span>
              <span className="col-span-4">{t("Weight (KG)")}</span>
              <span className="col-span-3">{t(unitType)}</span>
            </div>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-12 sm:col-span-4" type="date" value={r.date} onChange={(e) => updateRow(i, "date", e.target.value)} />
                  <Input className="col-span-6 sm:col-span-4" type="number" placeholder={t("Weight (KG)")} value={r.weight} onChange={(e) => updateRow(i, "weight", e.target.value)} />
                  <Input className="col-span-5 sm:col-span-3" type="number" placeholder={t(unitType)} value={r.qty} onChange={(e) => updateRow(i, "qty", e.target.value)} />
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
            <div className="flex flex-wrap gap-x-6 gap-y-1 px-1 pt-2 text-xs text-gray-600">
              <span>{t("Total weight")}: <span className="font-semibold text-gray-900 tabular-nums">{fmt(totalWeight)}</span></span>
              <span>{t(ul.totalLabel)}: <span className="font-semibold text-gray-900 tabular-nums">{fmt(totalQty)}</span></span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <Label>{t(ul.cutPerLabel)}</Label>
              <Input type="number" value={cutPerUnit} onChange={(e) => setCutPerUnit(e.target.value)} />
            </div>
            <div>
              <Label>{t(ul.unitCutLabel)}</Label>
              <Input type="number" value={cutOverride} placeholder={fmt(autoCut)} onChange={(e) => setCutOverride(e.target.value)} />
              <p className="text-[11px] text-gray-400 mt-1">{t("Leave empty to calculate automatically")}</p>
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
                <option value="mound">{t("Per Mound")}</option>
              </select>
            </div>
            {rateUnit === "mound" && (
              <div>
                <Label>{t("KG per Mound")}</Label>
                <Input type="number" value={kgPerMound} onChange={(e) => setKgPerMound(e.target.value)} />
              </div>
            )}
            <div>
              <Label>{rateUnit === "mound" ? t("Rate / Mound") : t("Rate (per KG)")}</Label>
              <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" />
            </div>
            {rateUnit === "mound" && (
              <div>
                <Label>{t("Mounds")} <span className="font-normal text-gray-400 text-[11px]">({t("auto")})</span></Label>
                <Input readOnly value={mounds ? mounds.toFixed(2) : ""} className="bg-gray-50 font-medium" />
              </div>
            )}
            <div>
              <Label>{t("Safi weight")}</Label>
              <Input readOnly value={fmt(safiWeight)} className="bg-gray-50 font-semibold" />
            </div>
          </div>

          <div className="rounded-lg bg-purple-50 p-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span>{t(ul.totalLabel)}</span><span className="font-medium tabular-nums">{fmt(totalQty)}</span></div>
            <div className="flex justify-between"><span>{t("Total weight")}</span><span className="font-medium tabular-nums">{fmt(totalWeight)}</span></div>
            <div className="flex justify-between"><span>{t(ul.cutSummaryLabel)}</span><span className="font-medium tabular-nums">− {fmt(cut)}</span></div>
            <div className="flex justify-between"><span>{t("Weight after cut")}</span><span className="font-medium tabular-nums">{fmt(weightAfterCut)}</span></div>
            <div className="flex justify-between"><span>{t("Vehicle cut")}</span><span className="font-medium tabular-nums">− {fmt(num(vehicleCut))}</span></div>
            <div className="flex justify-between"><span>{t("Safi weight")}</span><span className="font-semibold tabular-nums">{fmt(safiWeight)}</span></div>
            {rateUnit === "mound" && (
              <div className="flex justify-between"><span>{t("Mounds")}</span><span className="font-medium tabular-nums">{fmt(mounds)}</span></div>
            )}
            <div className="flex justify-between border-t border-purple-200 pt-2 mt-2 text-base">
              <span className="font-semibold">{t("Total amount")}</span>
              <span className="font-bold text-purple-700 tabular-nums">Rs {fmt(amount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
