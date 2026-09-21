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

type Row = { date: string; weight: string; jali: string }

const todayStr = () => new Date().toISOString().slice(0, 10)
const emptyRow = (): Row => ({ date: todayStr(), weight: "", jali: "" })
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
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [cutPerJali, setCutPerJali] = useState("0.5")
  const [cutOverride, setCutOverride] = useState("")
  const [rate, setRate] = useState("")

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setShop(d.shop || null)).catch(() => {})
    try {
      const saved = localStorage.getItem(BILL_NO_KEY)
      if (saved) setBillNo(saved)
    } catch {}
  }, [])

  const totalJali = rows.reduce((s, r) => s + num(r.jali), 0)
  const totalWeight = rows.reduce((s, r) => s + num(r.weight), 0)
  const autoCut = Math.round(totalJali * num(cutPerJali) * 100) / 100
  const cut = cutOverride !== "" ? num(cutOverride) : autoCut
  const netWeight = totalWeight - cut
  const amount = Math.round(netWeight * num(rate))

  function updateRow(i: number, field: keyof Row, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }

  function newBill() {
    if (!confirm(t("Clear this bill and start a new one?"))) return
    setName(""); setProduct(""); setRows([emptyRow()]); setCutOverride(""); setRate(""); setBillDate(todayStr())
  }

  function printBill() {
    const filled = rows.filter((r) => num(r.weight) || num(r.jali))
    if (!name.trim()) return alert(t("Enter the name"))
    if (filled.length === 0) return alert(t("Add at least one row"))

    const rowHtml = filled.map((r) => `
      <tr><td>${escapeHtml(fmtDate(r.date))}</td><td>${fmt(num(r.weight))}</td><td>${fmt(num(r.jali))}</td></tr>`).join("")

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
  <thead><tr><th>تاریخ</th><th>وزن (کلو)</th><th>تعداد جالی</th></tr></thead>
  <tbody>${rowHtml}</tbody>
</table>
<div class="sum">
  <div><span>کل جالی</span><span class="num">${fmt(totalJali)}</span></div>
  <div><span>کل وزن</span><span class="num">${fmt(totalWeight)}</span></div>
  <div><span>جالی کاٹ</span><span class="num">− ${fmt(cut)}</span></div>
  <div><span>خالص وزن</span><span class="num">${fmt(netWeight)}</span></div>
  <div><span>ریٹ (فی کلو)</span><span class="num">${fmt(num(rate))}</span></div>
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
            <div className="flex items-center justify-between mb-2 gap-2">
              <Label>{t("Entries")}</Label>
              <Button size="sm" variant="outline" onClick={() => setRows((prev) => [...prev, emptyRow()])} className="gap-1">
                <Plus className="w-3 h-3" /> {t("Add Row")}
              </Button>
            </div>
            <div className="hidden sm:grid grid-cols-12 gap-2 px-1 pb-1 text-xs text-gray-500">
              <span className="col-span-4">{t("Date")}</span>
              <span className="col-span-4">{t("Weight (KG)")}</span>
              <span className="col-span-3">{t("Jali")}</span>
            </div>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-12 sm:col-span-4" type="date" value={r.date} onChange={(e) => updateRow(i, "date", e.target.value)} />
                  <Input className="col-span-6 sm:col-span-4" type="number" placeholder={t("Weight (KG)")} value={r.weight} onChange={(e) => updateRow(i, "weight", e.target.value)} />
                  <Input className="col-span-5 sm:col-span-3" type="number" placeholder={t("Jali")} value={r.jali} onChange={(e) => updateRow(i, "jali", e.target.value)} />
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>{t("Cut per jali (KG)")}</Label>
              <Input type="number" value={cutPerJali} onChange={(e) => setCutPerJali(e.target.value)} />
            </div>
            <div>
              <Label>{t("Jali cut (KG)")}</Label>
              <Input type="number" value={cutOverride} placeholder={fmt(autoCut)} onChange={(e) => setCutOverride(e.target.value)} />
              <p className="text-[11px] text-gray-400 mt-1">{t("Leave empty to calculate automatically")}</p>
            </div>
            <div>
              <Label>{t("Rate (per KG)")}</Label>
              <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="rounded-lg bg-purple-50 p-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span>{t("Total jali")}</span><span className="font-medium tabular-nums">{fmt(totalJali)}</span></div>
            <div className="flex justify-between"><span>{t("Total weight")}</span><span className="font-medium tabular-nums">{fmt(totalWeight)}</span></div>
            <div className="flex justify-between"><span>{t("Jali cut")}</span><span className="font-medium tabular-nums">− {fmt(cut)}</span></div>
            <div className="flex justify-between"><span>{t("Net weight")}</span><span className="font-semibold tabular-nums">{fmt(netWeight)}</span></div>
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
