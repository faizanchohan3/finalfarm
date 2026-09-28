"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Archive, Eye, Printer, RotateCcw, Search } from "lucide-react"
import { billCSS, billFontLink, buildPrintHeader, escapeHtml } from "@/lib/print-utils"
import { DELETED_TYPE_LABEL, type DeletedType } from "@/lib/recycle-bin"

type Rec = {
  id: string; type: DeletedType; recordId: string; code: string; title: string; amount: number
  summary: [string, string][]; deletedByName: string | null; deletedAt: string
  restoredAt: string | null; restoredByName: string | null
}

const n = (v: number) => (v || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })
const when = (d: string) => new Date(d).toLocaleString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })

// Deleted Records (recycle bin): everything deleted from the main pages, with view, print and restore.
export default function DeletedRecordsPage() {
  const [records, setRecords] = useState<Rec[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState("")
  const [q, setQ] = useState("")
  const [show, setShow] = useState<"all" | "deleted" | "restored">("deleted")
  const [view, setView] = useState<Rec | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [shop, setShop] = useState<any>(null)

  async function load() {
    setLoading(true)
    const qs = new URLSearchParams()
    if (type) qs.set("type", type)
    if (q.trim()) qs.set("q", q.trim())
    try {
      const r = await fetch(`/api/deleted?${qs}`, { cache: "no-store" })
      const d = await r.json()
      setRecords(d.records || [])
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch("/api/settings").then((r) => r.json()).then((d) => setShop(d.shop || null)).catch(() => {}) }, [])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [type, q]) // eslint-disable-line react-hooks/exhaustive-deps

  async function restore(r: Rec) {
    if (!confirm(`Restore ${DELETED_TYPE_LABEL[r.type]} ${r.code} — ${r.title}?\n\nIts balances, stock and ledger entries will be put back.`)) return
    setRestoring(r.id)
    try {
      const res = await fetch(`/api/deleted/${r.id}/restore`, { method: "POST" })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) return alert(d?.error || "Failed to restore")
      setView(null)
      load()
      alert("Restored.")
    } finally {
      setRestoring(null)
    }
  }

  function print(r: Rec) {
    const w = window.open("", "_blank")
    if (!w) return
    const rows = (r.summary || []).map(([l, v]) => `<div><span style="font-family:'Segoe UI',Arial,sans-serif">${escapeHtml(l)}</span><span class="num">${escapeHtml(v)}</span></div>`).join("")
    w.document.write(`<html dir="rtl"><head><title>Deleted ${escapeHtml(r.code)}</title>
${billFontLink}
<style>${billCSS}</style></head><body>
<div dir="ltr">${buildPrintHeader(shop)}</div>
<div class="meta">
  <div>حذف شدہ ریکارڈ — <b>${escapeHtml(r.code)}</b></div>
  <div>حذف تاریخ: <b>${escapeHtml(when(r.deletedAt))}</b></div>
</div>
<div class="name" dir="ltr" style="text-align:left;font-family:'Segoe UI',Arial,sans-serif"><strong>${escapeHtml(DELETED_TYPE_LABEL[r.type] || r.type)}</strong> — ${escapeHtml(r.title)}</div>
<div class="sum" dir="ltr">
  ${rows}
  <div><span style="font-family:'Segoe UI',Arial,sans-serif">Deleted by</span><span class="num">${escapeHtml(r.deletedByName || "—")}</span></div>
  ${r.restoredAt ? `<div><span style="font-family:'Segoe UI',Arial,sans-serif">Restored</span><span class="num">${escapeHtml(when(r.restoredAt))} — ${escapeHtml(r.restoredByName || "")}</span></div>` : ""}
  <div class="grand"><span style="font-family:'Segoe UI',Arial,sans-serif">Amount</span><span class="num">Rs ${n(r.amount)}</span></div>
</div>
<div class="sig"><span>دستخط: ____________</span><span>${escapeHtml(shop?.name || "")}</span></div>
<script>document.fonts.ready.then(() => window.print())<\/script>
</body></html>`)
    w.document.close()
  }

  const shown = records.filter((r) => (show === "all" ? true : show === "restored" ? !!r.restoredAt : !r.restoredAt))
  const select = "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Archive className="w-6 h-6 text-purple-600" /> Deleted Records</h2>
        <p className="text-gray-500 text-sm">Everything deleted from bills, commissions, potato lots, store, purchases, traders, farmers, suppliers and payments. View, print or restore.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input className="pl-9" placeholder="Search name or ID..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select value={type} onChange={(e) => setType(e.target.value)} className={select}>
              <option value="">All types</option>
              {(Object.keys(DELETED_TYPE_LABEL) as DeletedType[]).map((k) => <option key={k} value={k}>{DELETED_TYPE_LABEL[k]}</option>)}
            </select>
            <select value={show} onChange={(e) => setShow(e.target.value as typeof show)} className={select}>
              <option value="deleted">Still deleted</option>
              <option value="restored">Restored</option>
              <option value="all">All</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 px-2 font-medium">Deleted on</th>
                  <th className="py-2 px-2 font-medium">Type</th>
                  <th className="py-2 px-2 font-medium">ID</th>
                  <th className="py-2 px-2 font-medium">Record</th>
                  <th className="py-2 px-2 font-medium text-right">Amount</th>
                  <th className="py-2 px-2 font-medium">Deleted by</th>
                  <th className="py-2 px-2 font-medium">Status</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-purple-50">
                    <td className="py-2 px-2 whitespace-nowrap text-gray-600">{when(r.deletedAt)}</td>
                    <td className="py-2 px-2 whitespace-nowrap">{DELETED_TYPE_LABEL[r.type] || r.type}</td>
                    <td className="py-2 px-2 font-mono text-xs text-purple-700">{r.code}</td>
                    <td className="py-2 px-2 font-medium text-gray-800">{r.title}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{n(r.amount)}</td>
                    <td className="py-2 px-2 text-gray-600">{r.deletedByName || "—"}</td>
                    <td className="py-2 px-2">
                      {r.restoredAt
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700" title={`${when(r.restoredAt)} — ${r.restoredByName || ""}`}>Restored</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Deleted</span>}
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setView(r)} className="p-1.5 text-gray-500 hover:text-purple-700 hover:bg-purple-100 rounded" title="View"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => print(r)} className="p-1.5 text-gray-500 hover:text-purple-700 hover:bg-purple-100 rounded" title="Print"><Printer className="w-4 h-4" /></button>
                        {!r.restoredAt && (
                          <button onClick={() => restore(r)} disabled={restoring === r.id} className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50" title="Restore">
                            <RotateCcw className="w-3 h-3" /> {restoring === r.id ? "..." : "Restore"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && shown.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">No deleted records</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading...</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!view} onOpenChange={(o) => { if (!o) setView(null) }}>
        <DialogContent className="w-[96vw] max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{view && `${DELETED_TYPE_LABEL[view.type] || view.type} · ${view.code}`}</DialogTitle></DialogHeader>
          {view && (
            <div className="space-y-4">
              <p className="font-semibold text-gray-900">{view.title}</p>
              <dl className="divide-y divide-gray-100 text-sm rounded-lg border">
                {(view.summary || []).map(([l, v]) => (
                  <div key={l} className="flex justify-between gap-3 px-3 py-1.5"><dt className="text-gray-500">{l}</dt><dd className="font-medium text-right">{v}</dd></div>
                ))}
                <div className="flex justify-between gap-3 px-3 py-1.5 bg-red-50"><dt className="text-gray-500">Deleted</dt><dd className="text-right">{when(view.deletedAt)} — {view.deletedByName || "—"}</dd></div>
                {view.restoredAt && (
                  <div className="flex justify-between gap-3 px-3 py-1.5 bg-green-50"><dt className="text-gray-500">Restored</dt><dd className="text-right">{when(view.restoredAt)} — {view.restoredByName || "—"}</dd></div>
                )}
              </dl>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" className="gap-1" onClick={() => print(view)}><Printer className="w-4 h-4" /> Print</Button>
                {!view.restoredAt && (
                  <Button className="gap-1 bg-green-600 hover:bg-green-700" disabled={restoring === view.id} onClick={() => restore(view)}>
                    <RotateCcw className="w-4 h-4" /> Restore
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
