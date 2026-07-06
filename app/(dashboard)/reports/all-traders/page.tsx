"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { buildPrintHeader, reportCSS } from "@/lib/print-utils"
import { Printer, Search, Users, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function AllTradersReportPage() {
  const { data: session } = useSession()
  const [traders, setTraders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [shop, setShop] = useState<any>(null)

  const isRestrictedRole = session?.user?.role && ["CASHIER", "AUDITOR"].includes(session.user.role)

  useEffect(() => {
    Promise.all([
      fetch("/api/reports/all-traders").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({ shop: null })),
    ]).then(([td, sd]) => {
      setTraders(td.customers || [])
      setShop(sd.shop || null)
      setLoading(false)
    })
  }, [])

  const filtered = traders.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.phone || "").includes(search) ||
      (t.address || "").toLowerCase().includes(search.toLowerCase())
  )

  const totalPayable = filtered.filter((t) => {
    const bal = (t.totalDebit || 0) - (t.totalCredit || 0)
    return bal > 0
  }).reduce((s, t) => {
    const bal = (t.totalDebit || 0) - (t.totalCredit || 0)
    return s + bal
  }, 0)
  const totalAdvance = filtered.filter((t) => {
    const bal = (t.totalDebit || 0) - (t.totalCredit || 0)
    return bal < 0
  }).reduce((s, t) => {
    const bal = (t.totalDebit || 0) - (t.totalCredit || 0)
    return s + Math.abs(bal)
  }, 0)
  const settled = filtered.filter((t) => (t.totalDebit || 0) === (t.totalCredit || 0)).length

  function printReport() {
    const date = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })

    if (isRestrictedRole) {
      // Summary print for restricted roles (no Dr/Cr)
      const rows = filtered.map((t, i) => `<tr style="${i % 2 === 0 ? "background:#f9fdf9" : ""}">
        <td>${i + 1}</td>
        <td><strong>${t.name}</strong></td>
        <td>${t.phone || "—"}</td>
        <td>${t.address || "—"}</td>
      </tr>`).join("")

      const w = window.open("", "_blank")!
      w.document.write(`<html><head><title>All Traders Report</title>
<style>${reportCSS}
  body { max-width: 900px; margin: 0 auto; }
</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
  <div><div class="doc-title">All Traders Report — Profile Summary</div><div class="doc-sub">Total: ${filtered.length} traders</div></div>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
  <div class="doc-meta"><div>Printed: ${date}</div></div>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
</div>
<div class="body-pad">
  <table>
    <thead><tr>
      <th>#</th><th>Name</th><th>Phone</th><th>Address</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="4"><strong>Total: ${filtered.length} traders</strong></td>
    </tr></tfoot>
  </table>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
  <div class="sig-row"><span>Generated on ${date}</span><span>${shop?.name || ""}</span></div>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
</div>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`)
      w.document.close()
      return
    }

    // Full print for admin roles (with Dr/Cr)
    const rows = filtered.map((t, i) => {
      const bal = (t.totalDebit || 0) - (t.totalCredit || 0)
      const status = bal > 0 ? "Receivable" : bal < 0 ? "Payable" : "Settled"
      const statusColor = bal > 0 ? "#15803d" : bal < 0 ? "#b91c1c" : "#6b7280"
      return `<tr style="${i % 2 === 0 ? "background:#f9fdf9" : ""}">
        <td>${i + 1}</td>
        <td><strong>${t.name}</strong></td>
        <td>${t.phone || "—"}</td>
        <td>${t.address || "—"}</td>
        <td style="text-align:right">PKR ${(t.totalDebit || 0).toLocaleString()}</td>
        <td style="text-align:right">PKR ${(t.totalCredit || 0).toLocaleString()}</td>
        <td style="text-align:right;font-weight:700;color:${statusColor}">
          PKR ${Math.abs(bal).toLocaleString()}
        </td>
        <td style="text-align:center">
          <span style="font-size:9px;padding:2px 7px;border-radius:99px;background:${bal > 0 ? "#dcfce7" : bal < 0 ? "#fee2e2" : "#f3f4f6"};color:${statusColor};font-weight:700">
            ${status}
          </span>
        </td>
      </tr>`
    }).join("")

    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>All Traders Report</title>
<style>${reportCSS}
  body { max-width: 900px; margin: 0 auto; }
</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
  <div><div class="doc-title">All Traders Report</div><div class="doc-sub">Total: ${filtered.length} traders</div></div>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
  <div class="doc-meta"><div>Printed: ${date}</div></div>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
</div>
<div class="body-pad">
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
    <div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:12px 16px">
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
      <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;font-weight:700">Receivable from Traders</div>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
      <div style="font-size:16px;font-weight:900;color:#15803d;margin-top:3px">PKR ${totalPayable.toLocaleString()}</div>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
    </div>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px">
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
      <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;font-weight:700">Payable to Traders</div>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
      <div style="font-size:16px;font-weight:900;color:#b91c1c;margin-top:3px">PKR ${totalAdvance.toLocaleString()}</div>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px">
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
      <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;font-weight:700">Settled / Clear</div>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
      <div style="font-size:16px;font-weight:900;color:#374151;margin-top:3px">${settled} traders</div>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
    </div>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
  </div>
  <table>
    <thead><tr>
      <th>#</th><th>Name</th><th>Phone</th><th>Address</th>
      <th style="text-align:right">Sales (Dr)</th>
      <th style="text-align:right">Payments (Cr)</th>
      <th style="text-align:right">Outstanding</th>
      <th style="text-align:center">Status</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="4"><strong>Total: ${filtered.length} traders</strong></td>
      <td style="text-align:right"><strong>PKR ${filtered.reduce((s, f) => s + (f.totalDebit || 0), 0).toLocaleString()}</strong></td>
      <td style="text-align:right"><strong>PKR ${filtered.reduce((s, f) => s + (f.totalCredit || 0), 0).toLocaleString()}</strong></td>
      <td style="text-align:right;color:#15803d"><strong>PKR ${totalPayable.toLocaleString()}</strong></td>
      <td></td>
    </tr></tfoot>
  </table>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
  <div class="sig-row"><span>Generated on ${date}</span><span>${shop?.name || ""}</span></div>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
</div>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`)
    w.document.close()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">All Traders Report</h2>
          <p className="text-gray-500 text-sm">{isRestrictedRole ? "Profile details for all traders" : "Balance summary for all traders (buyers/sellers)"}</p>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
        </div>
        <Button variant="outline" onClick={printReport} className="gap-2">
          <Printer className="w-4 h-4" /> Print Report
        </Button>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium uppercase">Total Traders</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{loading ? "—" : filtered.length}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/40">
          <CardContent className="p-4">
            <p className="text-xs text-green-600 font-medium uppercase">Receivable</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{loading ? "—" : formatCurrency(totalPayable)}</p>
            <p className="text-xs text-green-500 mt-0.5">{filtered.filter((t) => ((t.totalDebit || 0) - (t.totalCredit || 0)) > 0).length} traders</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="p-4">
            <p className="text-xs text-red-500 font-medium uppercase">Payable</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{loading ? "—" : formatCurrency(totalAdvance)}</p>
            <p className="text-xs text-red-400 mt-0.5">{filtered.filter((t) => ((t.totalDebit || 0) - (t.totalCredit || 0)) < 0).length} traders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium uppercase">Settled</p>
            <p className="text-2xl font-bold text-gray-700 mt-1">{loading ? "—" : settled}</p>
            <p className="text-xs text-gray-400 mt-0.5">no balance</p>
          </CardContent>
        </Card>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
      </div>

      {/* Total Dr/Cr Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="p-4">
            <p className="text-xs text-blue-600 font-medium uppercase">Total Sales (Dr)</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">
              {loading ? "—" : formatCurrency(filtered.reduce((s, t) => s + (t.totalDebit || 0), 0))}
            </p>
            <p className="text-xs text-blue-500 mt-0.5">all sales & commissions</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/40">
          <CardContent className="p-4">
            <p className="text-xs text-green-600 font-medium uppercase">Total Payments (Cr)</p>
            <p className="text-2xl font-bold text-green-700 mt-1">
              {loading ? "—" : formatCurrency(filtered.reduce((s, t) => s + (t.totalCredit || 0), 0))}
            </p>
            <p className="text-xs text-green-500 mt-0.5">received & paid</p>
          </CardContent>
        </Card>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
      </div>

      {/* Table */}
      <Card>
        <div className="p-4 border-b">
          <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search by name, phone, address..." value={search}
                onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
            </div>
            {isRestrictedRole && (
              <div className="text-xs text-gray-500 bg-amber-50 px-3 py-1.5 rounded">
                Summary view only
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
              </div>
            )}
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
          </div>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 border-b border-t">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">#</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">Phone</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">Address</th>
                  {!isRestrictedRole && (
                    <>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Sales (Dr)</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Payments (Cr)</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Outstanding</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Status</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-center"></th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={isRestrictedRole ? 4 : 9} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={isRestrictedRole ? 4 : 9} className="px-4 py-16 text-center text-gray-400">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No traders found
                    </td>
                  </tr>
                ) : filtered.map((t, i) => {
                  const bal = (t.totalDebit || 0) - (t.totalCredit || 0)
                  return (
                    <tr key={t.id} className="hover:bg-amber-50">
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{t.phone || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{t.address || "—"}</td>
                      {!isRestrictedRole && (
                        <>
                          <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(t.totalDebit || 0)}</td>
                          <td className="px-4 py-3 text-right text-green-700">{formatCurrency(t.totalCredit || 0)}</td>
                          <td className={`px-4 py-3 text-right font-bold ${bal > 0 ? "text-green-700" : bal < 0 ? "text-red-600" : "text-gray-400"}`}>
                            {formatCurrency(Math.abs(bal))}
                            {bal !== 0 && <span className="text-xs font-normal ml-1">{bal > 0 ? "Dr" : "Cr"}</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              bal > 0 ? "bg-green-100 text-green-700"
                              : bal < 0 ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-gray-500"
                            }`}>
                              {bal > 0 ? "Receivable" : bal < 0 ? "Payable" : "Settled"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`/reports/customer-ledger?id=${t.id}`}
                              className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-medium">
                              Ledger <ArrowRight className="w-3 h-3" />
                            </Link>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              {!loading && filtered.length > 0 && (
                <tfoot className="bg-amber-50 border-t-2 border-amber-200">
                  <tr>
                    <td colSpan={isRestrictedRole ? 4 : 4} className="px-4 py-3 font-bold text-gray-700">{filtered.length} traders</td>
                    {!isRestrictedRole && (
                      <>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">
                          {formatCurrency(filtered.reduce((s, f) => s + (f.totalDebit || 0), 0))}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-700">
                          {formatCurrency(filtered.reduce((s, f) => s + (f.totalCredit || 0), 0))}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-700">
                          {formatCurrency(totalPayable)}
                        </td>
                        <td colSpan={2} />
                      </>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
          </div>
        </CardContent>
      </Card>
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
    </div>
  )
}
