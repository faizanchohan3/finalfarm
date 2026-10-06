"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, Printer, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { billCSS, billFontLink, buildPrintHeader, escapeHtml } from "@/lib/print-utils"
import { useLang } from "@/lib/i18n"

type Result = { type: string; code: string; title: string; href: string; fields: [string, string][] }

// Urdu labels for the printed record (same layout as the Bill Maker bill)
const UR_TYPE: Record<string, string> = { Commission: "کمیشن", Bill: "بل", "Potato Store": "آلو اسٹور", Store: "اسٹور", "Gala Mandi": "غلہ منڈی" }
const UR_LABEL: Record<string, string> = {
  "Date": "تاریخ", "Seller": "فروخت کنندہ", "Buyer": "خریدار", "Commodity": "جنس", "Vehicle No": "گاڑی نمبر",
  "Bags": "تعداد", "Net weight": "صافی وزن", "Rate": "ریٹ", "Commission": "کمیشن", "Labour": "مزدوری",
  "Total amount": "کل رقم", "Seller payable": "فروخت کنندہ کو قابل ادا", "Paid": "ادا شدہ", "Balance": "بقایا",
  "Status": "حالت", "Bill No": "بل نمبر", "Name": "نام", "Product": "جنس", "Entries": "اندراجات",
  "Total weight": "کل وزن", "Cut": "کاٹ", "Vehicle cut": "گاڑی کاٹ", "Safi weight": "صافی وزن",
  "Category": "کیٹیگری", "Room": "کمرہ", "Stock": "اسٹاک", "Min stock": "کم از کم اسٹاک",
  "Purchase price": "خرید ریٹ", "Sale price": "فروخت ریٹ", "Stock value": "مالیت", "Active": "فعال",
  "Lot No": "لاٹ نمبر", "Farmer": "کسان", "Godown": "گودام", "Markha": "مارکہ",
  "Gross / Tare / Net": "کل / خالی / صافی وزن", "Sale rate": "فروخت ریٹ", "Sale amount": "فروخت رقم", "Payment": "ادائیگی",
  "Entry No": "اندراج نمبر", "Products": "اجناس", "Received from buyer": "خریدار سے وصول", "Paid to seller": "فروخت کنندہ کو ادا",
}
// Field shown in the purple total bar at the bottom, per record type
const GRAND_FIELD: Record<string, string> = { Commission: "Total amount", Bill: "Total amount", Store: "Stock value", "Potato Store": "Sale amount", "Gala Mandi": "Total amount" }

// Dashboard box: type a record ID (SRM-12, a Gala Mandi / bill number, LOT-…, or an old CM-… / BL-… / ST-… / GM-… one) to see it in a modal and print it.
export function RecordLookup() {
  const { t } = useLang()
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Result[] | null>(null)
  const [error, setError] = useState("")

  async function lookup(e?: React.FormEvent) {
    e?.preventDefault()
    if (!code.trim()) return
    setLoading(true); setError("")
    try {
      const res = await fetch(`/api/lookup?code=${encodeURIComponent(code.trim())}`, { cache: "no-store" })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d?.error || t("Lookup failed")); return }
      setResults(d.results || [])
    } catch {
      setError(t("Lookup failed"))
    } finally {
      setLoading(false)
    }
  }

  const [shop, setShop] = useState<any>(undefined)
  async function print(r: Result) {
    let s = shop
    if (s === undefined) {
      s = await fetch("/api/settings").then((x) => x.json()).then((d) => d.shop || null).catch(() => null)
      setShop(s)
    }
    const w = window.open("", "_blank")
    if (!w) return
    const grandKey = GRAND_FIELD[r.type]
    const grand = r.fields.find(([l]) => l === grandKey)
      || (r.type === "Potato Store" ? r.fields.find(([l]) => l === "Gross / Tare / Net") : undefined)
    const date = r.fields.find(([l]) => l === "Date")?.[1] || new Date().toLocaleDateString("en-PK")
    const rows = r.fields
      .filter((f) => f !== grand && f[0] !== "Date")
      .map(([l, v]) => `<div><span>${escapeHtml(UR_LABEL[l] || l)}</span><span class="num">${escapeHtml(v)}</span></div>`)
      .join("")
    w.document.write(`<html dir="rtl"><head><title>${escapeHtml(r.code)}</title>
${billFontLink}
<style>${billCSS}</style></head><body>
<div dir="ltr">${buildPrintHeader(s)}</div>
<div class="meta">
  <div>${escapeHtml(UR_TYPE[r.type] || r.type)} آئی ڈی: <b>${escapeHtml(r.code)}</b></div>
  <div>تاریخ: <b>${escapeHtml(date)}</b></div>
</div>
<div class="name"><strong style="font-family:'Segoe UI', Arial, sans-serif" dir="ltr">${escapeHtml(r.title)}</strong></div>
<div class="sum">
  ${rows}
  ${grand ? `<div class="grand"><span>${escapeHtml(UR_LABEL[grand[0]] || grand[0])}</span><span class="num">${escapeHtml(grand[1])}</span></div>` : ""}
</div>
<div class="sig"><span>دستخط وصول کنندہ: ____________</span><span>دستخط: ____________</span></div>
<script>document.fonts.ready.then(() => window.print())<\/script>
</body></html>`)
    w.document.close()
  }

  return (
    <>
      <form onSubmit={lookup} className="flex items-center gap-2 flex-wrap rounded-xl border border-gray-200 bg-white px-3.5 py-3">
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-700">{t("Find record by ID")}</span>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="SRM-12 · #12 · LOT-2026-00012"
          className="flex-1 min-w-[200px] font-mono uppercase"
        />
        <Button type="submit" size="sm" disabled={loading || !code.trim()}>{loading ? t("Searching...") : t("Find")}</Button>
        {error && <span className="text-xs text-red-600 w-full">{error}</span>}
      </form>

      <Dialog open={results !== null} onOpenChange={(o) => { if (!o) setResults(null) }}>
        <DialogContent className="w-[96vw] max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("Record")} {code.trim().toUpperCase()}</DialogTitle></DialogHeader>
          {results && results.length === 0 && (
            <p className="text-sm text-gray-500 py-4 text-center">{t("No record found with this ID.")}</p>
          )}
          <div className="space-y-4">
            {results?.map((r) => (
              <div key={r.type + r.code} className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-purple-50 px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-xs text-purple-600 font-medium">{t(r.type)} · <span className="font-mono">{r.code}</span></p>
                    <p className="text-sm font-semibold text-gray-900">{r.title}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Link href={r.href} className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 bg-white rounded hover:bg-gray-50">
                      <ExternalLink className="w-3 h-3" /> {t("Open page")}
                    </Link>
                    <button onClick={() => print(r)} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700">
                      <Printer className="w-3 h-3" /> {t("Print")}
                    </button>
                  </div>
                </div>
                <dl className="divide-y divide-gray-100 text-sm">
                  {r.fields.map(([l, v]) => (
                    <div key={l} className="flex justify-between gap-3 px-4 py-1.5">
                      <dt className="text-gray-500">{t(l)}</dt>
                      <dd className="font-medium text-gray-900 text-right">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
