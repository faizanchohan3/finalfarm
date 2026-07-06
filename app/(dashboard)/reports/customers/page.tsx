"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Printer, Users, ChevronDown, ChevronRight, Search, ExternalLink } from "lucide-react"
import Link from "next/link"

export default function CustomersReportPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, any>>({})
  const [loadingRow, setLoadingRow] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [shop, setShop] = useState<any>(null)
  const today = new Date().toLocaleDateString("en-PK")

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setShop(d.shop || null)).catch(() => {})
    fetch("/api/reports/customers")
      .then((r) => r.json())
      .then((d) => { setCustomers(d.customers || []); setLoading(false) })
  }, [])

  async function toggleExpand(id: string) {
    if (expanded[id]) {
      setExpanded((prev) => { const n = { ...prev }; delete n[id]; return n })
      return
    }
    setLoadingRow(id)
    const data = await fetch(`/api/customers/${id}`).then((r) => r.json())
    setExpanded((prev) => ({ ...prev, [id]: data }))
    setLoadingRow(null)
  }

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").includes(search)
  )

  const totals = filtered.reduce(
    (acc, c) => ({
      totalBusiness: acc.totalBusiness + c.totalBusiness,
      totalPaid: acc.totalPaid + c.totalPaid,
      totalBalance: acc.totalBalance + c.totalBalance,
      saleCount: acc.saleCount + c.saleCount,
    }),
    { totalBusiness: 0, totalPaid: 0, totalBalance: 0, saleCount: 0 }
  )

  return (
    <div className="space-y-6">

      {/* ── Print Header ── */}
      <div className="hidden print:block">
        <div style={{background:"linear-gradient(135deg,#14532d 0%,#166534 60%,#15803d 100%)",color:"#fff",padding:"16px 22px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            {shop?.logo
              ? <img src={shop.logo} style={{width:"52px",height:"52px",borderRadius:"8px",background:"#fff",padding:"3px",objectFit:"contain"}} alt="" />
              : <div style={{width:"52px",height:"52px",borderRadius:"8px",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"26px",fontWeight:900,border:"2px solid rgba(255,255,255,0.3)"}}>{(shop?.name||"G")[0].toUpperCase()}</div>
            }
            <div>
              <div style={{fontSize:"20px",fontWeight:900,letterSpacing:"-0.5px"}}>{shop?.name||"Gala Mandi"}</div>
              {shop?.ownerName && <div style={{fontSize:"11px",opacity:0.8,marginTop:"2px"}}>{shop.ownerName}</div>}
            </div>
          </div>
          <div style={{textAlign:"right",fontSize:"11px",lineHeight:1.9,opacity:0.9}}>
            {shop?.phone && <div>&#9990;&nbsp;{shop.phone}</div>}
            {shop?.address && <div>&#9679;&nbsp;{shop.address}</div>}
            <div style={{fontSize:"10px",opacity:0.75}}>Printed: {today}</div>
          </div>
        </div>
        <div style={{height:"4px",background:"linear-gradient(90deg,#fbbf24 0%,#f59e0b 50%,#d97706 100%)"}}></div>
        <div style={{padding:"10px 22px 8px",background:"#f8fdf8",borderBottom:"1px solid #e5e7eb",marginBottom:"8px"}}>
          <h2 style={{margin:0,fontSize:"16px",fontWeight:800,color:"#14532d"}}>Trader Report</h2>
          <div style={{fontSize:"11px",color:"#6b7280",marginTop:"2px"}}>All active traders — business summary with outstanding balances</div>
          <div style={{display:"flex",gap:"24px",marginTop:"8px",fontSize:"11px"}}>
            <span><strong>{customers.length}</strong> Traders</span>
            <span>Total Business: <strong>{formatCurrency(totals.totalBusiness)}</strong></span>
            <span>Received: <strong style={{color:"#166534"}}>{formatCurrency(totals.totalPaid)}</strong></span>
            <span>Outstanding: <strong style={{color:"#b91c1c"}}>{formatCurrency(totals.totalBalance)}</strong></span>
          </div>
        </div>
      </div>

      {/* ── Screen Header ── */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Trader Report</h2>
          <p className="text-gray-500 text-sm">Click any row to expand sales details</p>
        </div>
        <Button onClick={() => window.print()} variant="outline" className="gap-2">
          <Printer className="w-4 h-4" /> Print Report
        </Button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Traders</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{customers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Business</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totals.totalBusiness)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Received</p>
            <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(totals.totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className={totals.totalBalance > 0 ? "border-red-200" : ""}>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Outstanding (Udhar)</p>
            <p className={`text-xl font-bold mt-1 ${totals.totalBalance > 0 ? "text-red-600" : "text-gray-500"}`}>
              {formatCurrency(totals.totalBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm print:hidden">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* ── Main Table ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Trader-wise Summary
            <span className="text-gray-400 font-normal text-sm">({filtered.length} traders)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-t">
                <tr>
                  <th className="px-4 py-3 w-8 print:hidden" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Trader Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Address</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Sales</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total Business</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Paid</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Balance</th>
                  <th className="px-4 py-3 print:hidden" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
                ) : filtered.map((c, i) => (
                  <>
                    {/* Customer Row */}
                    <tr
                      key={c.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${expanded[c.id] ? "bg-green-50/30" : ""}`}
                      onClick={() => toggleExpand(c.id)}
                    >
                      <td className="px-4 py-3 print:hidden">
                        {loadingRow === c.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                        ) : expanded[c.id] ? (
                          <ChevronDown className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{c.name}</td>
                      <td className="px-4 py-3 text-gray-600">{c.phone || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{c.address || "—"}</td>
                      <td className="px-4 py-3 text-center text-gray-700 font-medium">{c.saleCount}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(c.totalBusiness)}</td>
                      <td className="px-4 py-3 text-right text-green-700 font-medium">{formatCurrency(c.totalPaid)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${c.totalBalance > 0 ? "text-red-600" : "text-gray-400"}`}>
                        {c.totalBalance > 0 ? formatCurrency(c.totalBalance) : "—"}
                      </td>
                      <td className="px-4 py-3 print:hidden" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/reports/customer-ledger?id=${c.id}`}
                          className="text-xs text-green-700 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Ledger
                        </Link>
                      </td>
                    </tr>

                    {/* Expanded: Sales detail rows */}
                    {expanded[c.id] && (
                      <tr key={`${c.id}-detail`} className="bg-green-50/20 border-b border-green-100">
                        <td colSpan={10} className="px-4 py-3">
                          <div className="ml-6">
                            <p className="text-xs font-semibold text-gray-600 mb-2">
                              Sales History ({expanded[c.id].sales?.length || 0} transactions)
                            </p>
                            {expanded[c.id].sales?.length === 0 ? (
                              <p className="text-xs text-gray-400">No sales yet</p>
                            ) : (
                              <table className="w-full text-xs border border-gray-100 rounded">
                                <thead className="bg-white">
                                  <tr className="border-b border-gray-100">
                                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Date</th>
                                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Items</th>
                                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Total</th>
                                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Paid</th>
                                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Balance</th>
                                    <th className="px-3 py-2 text-center text-gray-500 font-medium">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {expanded[c.id].sales.map((s: any) => (
                                    <tr key={s.id} className="border-b border-gray-50 hover:bg-white">
                                      <td className="px-3 py-2 text-gray-500">{formatDate(s.createdAt)}</td>
                                      <td className="px-3 py-2 text-gray-600 max-w-xs truncate">
                                        {s.items.map((it: any) => `${it.quantity} ${it.product?.unit} ${it.product?.name}`).join(", ")}
                                      </td>
                                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(s.totalAmount)}</td>
                                      <td className="px-3 py-2 text-right text-green-700">{formatCurrency(s.paidAmount)}</td>
                                      <td className={`px-3 py-2 text-right font-medium ${s.balance > 0 ? "text-red-600" : "text-gray-400"}`}>
                                        {s.balance > 0 ? formatCurrency(s.balance) : "—"}
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                                          s.status === "PAID" ? "bg-green-100 text-green-700" :
                                          s.status === "PARTIAL" ? "bg-orange-100 text-orange-700" :
                                          s.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                                          "bg-gray-100 text-gray-500"
                                        }`}>
                                          {s.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">No customers found</td></tr>
                )}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={5} className="px-4 py-3 font-bold text-gray-700">
                    Total — {filtered.length} customers, {totals.saleCount} sales
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-gray-700">{totals.saleCount}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totals.totalBusiness)}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">{formatCurrency(totals.totalPaid)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(totals.totalBalance)}</td>
                  <td className="print:hidden" />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
