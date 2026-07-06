"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { buildPrintHeader, reportCSS } from "@/lib/print-utils"
import { Printer, Search, Store, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function AllSuppliersReportPage() {
  const { data: session } = useSession()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [shop, setShop] = useState<any>(null)

  const isRestrictedRole = session?.user?.role && ["CASHIER", "AUDITOR"].includes(session.user.role)

  useEffect(() => {
    Promise.all([
      fetch("/api/reports/all-suppliers").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({ shop: null })),
    ]).then(([sd, shr]) => {
      setSuppliers(sd.suppliers || [])
      setShop(shr.shop || null)
      setLoading(false)
    })
  }, [])

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone || "").includes(search) ||
      (s.address || "").toLowerCase().includes(search.toLowerCase())
  )

  const totalPayable = filtered.filter((s) => s.balance > 0).reduce((s, f) => s + f.balance, 0)
  const totalAdvance = filtered.filter((s) => s.balance < 0).reduce((s, f) => s + Math.abs(f.balance), 0)
  const settled = filtered.filter((s) => s.balance === 0).length

  function printReport() {
    const date = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })

    if (isRestrictedRole) {
      // Summary print for restricted roles (no Dr/Cr)
      const rows = filtered.map((s, i) => `<tr style="${i % 2 === 0 ? "background:#f9fdf9" : ""}">
        <td>${i + 1}</td>
        <td><strong>${s.name}</strong></td>
        <td>${s.phone || "—"}</td>
        <td>${s.otherPhone || "—"}</td>
        <td>${s.address || "—"}</td>
      </tr>`).join("")

      const w = window.open("", "_blank")!
      w.document.write(`<html><head><title>All Suppliers Report</title>
<style>${reportCSS}
  body { max-width: 960px; margin: 0 auto; }
</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div><div class="doc-title">All Suppliers Report — Profile Summary</div><div class="doc-sub">Total: ${filtered.length} suppliers</div></div>
  <div class="doc-meta"><div>Printed: ${date}</div></div>
</div>
<div class="body-pad">
  <table>
    <thead><tr>
      <th>#</th><th>Name</th><th>Phone</th><th>Other Phone</th><th>Address</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="5"><strong>Total: ${filtered.length} suppliers</strong></td>
    </tr></tfoot>
  </table>
  <div class="sig-row"><span>Generated on ${date}</span><span>${shop?.name || ""}</span></div>
</div>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`)
      w.document.close()
      return
    }

    // Full print for admin roles (with Dr/Cr)
    const rows = filtered.map((s, i) => {
      const bal = s.balance || 0
      const status = bal > 0 ? "Payable" : bal < 0 ? "Advance" : "Settled"
      const statusColor = bal > 0 ? "#b91c1c" : bal < 0 ? "#15803d" : "#6b7280"
      return `<tr style="${i % 2 === 0 ? "background:#f9fdf9" : ""}">
        <td>${i + 1}</td>
        <td><strong>${s.name}</strong></td>
        <td>${s.phone || "—"}</td>
        <td>${s.otherPhone || "—"}</td>
        <td>${s.address || "—"}</td>
        <td style="text-align:right">PKR ${(s.totalDebit || 0).toLocaleString()}</td>
        <td style="text-align:right">PKR ${(s.totalCredit || 0).toLocaleString()}</td>
        <td style="text-align:right;font-weight:700;color:${statusColor}">
          PKR ${Math.abs(bal).toLocaleString()}
        </td>
        <td style="text-align:center">
          <span style="font-size:9px;padding:2px 7px;border-radius:99px;background:${bal > 0 ? "#fee2e2" : bal < 0 ? "#dcfce7" : "#f3f4f6"};color:${statusColor};font-weight:700">
            ${status}
          </span>
        </td>
      </tr>`
    }).join("")

    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>All Suppliers Report</title>
<style>${reportCSS}
  body { max-width: 900px; margin: 0 auto; }
</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div><div class="doc-title">All Suppliers Report</div><div class="doc-sub">Total: ${filtered.length} suppliers</div></div>
  <div class="doc-meta"><div>Printed: ${date}</div></div>
</div>
<div class="body-pad">
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px">
      <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;font-weight:700">Payable to Suppliers</div>
      <div style="font-size:16px;font-weight:900;color:#b91c1c;margin-top:3px">PKR ${totalPayable.toLocaleString()}</div>
    </div>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px">
      <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;font-weight:700">Advance Paid</div>
      <div style="font-size:16px;font-weight:900;color:#15803d;margin-top:3px">PKR ${totalAdvance.toLocaleString()}</div>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px">
      <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;font-weight:700">Settled / Clear</div>
      <div style="font-size:16px;font-weight:900;color:#374151;margin-top:3px">${settled} suppliers</div>
    </div>
  </div>
  <table>
    <thead><tr>
      <th>#</th><th>Name</th><th>Phone</th><th>Other Phone</th><th>Address</th>
      <th style="text-align:right">Total Dr</th>
      <th style="text-align:right">Total Cr</th>
      <th style="text-align:right">Balance</th>
      <th style="text-align:center">Status</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="5"><strong>Total: ${filtered.length} suppliers</strong></td>
      <td style="text-align:right"><strong>PKR ${filtered.reduce((s, f) => s + (f.totalDebit || 0), 0).toLocaleString()}</strong></td>
      <td style="text-align:right"><strong>PKR ${filtered.reduce((s, f) => s + (f.totalCredit || 0), 0).toLocaleString()}</strong></td>
      <td style="text-align:right;color:#b91c1c"><strong>PKR ${totalPayable.toLocaleString()}</strong></td>
      <td></td>
    </tr></tfoot>
  </table>
  <div class="sig-row"><span>Generated on ${date}</span><span>${shop?.name || ""}</span></div>
</div>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`)
    w.document.close()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">All Suppliers Report</h2>
          <p className="text-gray-500 text-sm">{isRestrictedRole ? "Profile details for all suppliers" : "Balance summary for all registered suppliers"}</p>
        </div>
        <Button variant="outline" onClick={printReport} className="gap-2">
          <Printer className="w-4 h-4" /> Print Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium uppercase">Total Suppliers</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{loading ? "—" : filtered.length}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="p-4">
            <p className="text-xs text-red-500 font-medium uppercase">Payable to Suppliers</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{loading ? "—" : formatCurrency(totalPayable)}</p>
            <p className="text-xs text-red-400 mt-0.5">{filtered.filter((s) => s.balance > 0).length} suppliers</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/40">
          <CardContent className="p-4">
            <p className="text-xs text-purple-600 font-medium uppercase">Advance Paid</p>
            <p className="text-2xl font-bold text-purple-700 mt-1">{loading ? "—" : formatCurrency(totalAdvance)}</p>
            <p className="text-xs text-green-500 mt-0.5">{filtered.filter((s) => s.balance < 0).length} suppliers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium uppercase">Settled</p>
            <p className="text-2xl font-bold text-gray-700 mt-1">{loading ? "—" : settled}</p>
            <p className="text-xs text-gray-400 mt-0.5">no balance</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <div className="p-4 border-b">
          <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search by name, phone, address..." value={search}
                onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            {isRestrictedRole && (
              <div className="text-xs text-gray-500 bg-amber-50 px-3 py-1.5 rounded">
                Summary view only
              </div>
            )}
          </div>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 border-b border-t">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">#</th>
                  {isRestrictedRole && <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Photo</th>}
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">Phone</th>
                  {isRestrictedRole && <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">Other Phone</th>}
                  {!isRestrictedRole && <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">Other Phone</th>}
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-left">Address</th>
                  {!isRestrictedRole && (
                    <>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Total Dr</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Total Cr</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Balance</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Status</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-center"></th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center text-gray-400">
                      <Store className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No suppliers found
                    </td>
                  </tr>
                ) : filtered.map((s, i) => {
                  const bal = s.balance || 0
                  return (
                    <tr key={s.id} className="hover:bg-amber-50">
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      {isRestrictedRole && (
                        <td className="px-4 py-3 text-center">
                          {s.picture ? (
                            <img src={s.picture} alt={s.name} className="w-8 h-8 rounded-full object-cover mx-auto" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-amber-200 mx-auto flex items-center justify-center text-xs text-gray-500">
                              {s.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{s.phone || "—"}</td>
                      {isRestrictedRole && <td className="px-4 py-3 text-gray-500 text-xs">{s.otherPhone || "—"}</td>}
                      {!isRestrictedRole && <td className="px-4 py-3 text-gray-500 text-xs">{s.otherPhone || "—"}</td>}
                      <td className="px-4 py-3 text-gray-500 text-xs">{s.address || "—"}</td>
                      {!isRestrictedRole && (
                        <>
                          <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(s.totalDebit || 0)}</td>
                          <td className="px-4 py-3 text-right text-purple-700">{formatCurrency(s.totalCredit || 0)}</td>
                          <td className={`px-4 py-3 text-right font-bold ${bal > 0 ? "text-red-600" : bal < 0 ? "text-purple-700" : "text-gray-400"}`}>
                            {formatCurrency(Math.abs(bal))}
                            {bal !== 0 && <span className="text-xs font-normal ml-1">{bal > 0 ? "Dr" : "Cr"}</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              bal > 0 ? "bg-red-100 text-red-700"
                              : bal < 0 ? "bg-green-100 text-purple-700"
                              : "bg-amber-100 text-gray-500"
                            }`}>
                              {bal > 0 ? "Payable" : bal < 0 ? "Advance" : "Settled"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`/reports/supplier-ledger?id=${s.id}`}
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
                    <td colSpan={isRestrictedRole ? 4 : 4} className="px-4 py-3 font-bold text-gray-700">{filtered.length} suppliers</td>
                    {!isRestrictedRole && (
                      <>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">
                          {formatCurrency(filtered.reduce((s, f) => s + (f.totalDebit || 0), 0))}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-purple-700">
                          {formatCurrency(filtered.reduce((s, f) => s + (f.totalCredit || 0), 0))}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">
                          {formatCurrency(totalPayable)}
                        </td>
                        <td colSpan={2} />
                      </>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
    </div>
  )
}
