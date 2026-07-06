"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Printer, Sprout } from "lucide-react"

export default function PesticideSalesReportPage() {
  const [sales, setSales] = useState<any[]>([])
  const [pesticides, setPesticides] = useState<any[]>([])
  const [totals, setTotals] = useState({ totalAmount: 0, totalPaid: 0, totalBalance: 0 })
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [pesticideId, setPesticideId] = useState("all")
  const [loading, setLoading] = useState(false)
  const [shop, setShop] = useState<any>(null)

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setShop(d.shop || null)).catch(() => {})
    fetch("/api/pesticides").then((r) => r.json()).then((d) => setPesticides(d.pesticides || []))
    loadReport()
  }, [])

  async function loadReport() {
    setLoading(true)
    const params = new URLSearchParams()
    if (dateFrom) params.set("from", dateFrom)
    if (dateTo) params.set("to", dateTo)
    if (pesticideId !== "all") params.set("pesticideId", pesticideId)
    const data = await fetch(`/api/reports/pesticide-sales?${params}`).then((r) => r.json())
    setSales(data.sales || [])
    setTotals({ totalAmount: data.totalAmount || 0, totalPaid: data.totalPaid || 0, totalBalance: data.totalBalance || 0 })
    setLoading(false)
  }

  const dateLabel = dateFrom || dateTo
    ? `${dateFrom ? formatDate(dateFrom) : "Start"} — ${dateTo ? formatDate(dateTo) : "Today"}`
    : "All Time"

  const today = new Date().toLocaleDateString("en-PK")

  return (
    <div className="space-y-6">
      {/* Print Header */}
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
        <div style={{padding:"10px 22px 8px",background:"#f8fdf8",borderBottom:"1px solid #e5e7eb",marginBottom:"10px"}}>
          <h2 style={{margin:0,fontSize:"16px",fontWeight:800,color:"#14532d"}}>Pesticide Sales Report</h2>
          <div style={{display:"flex",gap:"24px",marginTop:"6px",fontSize:"11px"}}>
            <span>Period: <strong>{dateLabel}</strong></span>
            <span>Total Sales: <strong>{sales.length}</strong></span>
            <span>Total Amount: <strong>{formatCurrency(totals.totalAmount)}</strong></span>
            <span>Collected: <strong style={{color:"#166534"}}>{formatCurrency(totals.totalPaid)}</strong></span>
            <span>Outstanding: <strong style={{color:"#b91c1c"}}>{formatCurrency(totals.totalBalance)}</strong></span>
          </div>
        </div>
      </div>

      {/* Screen Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pesticide Sales Report</h2>
          <p className="text-gray-500 text-sm">All pesticide sales with buyer and payment details</p>
        </div>
        <Button onClick={() => window.print()} variant="outline" className="gap-2">
          <Printer className="w-4 h-4" /> Print Report
        </Button>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">From Date</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">To Date</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Pesticide</label>
              <Select value={pesticideId} onValueChange={setPesticideId}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="All Pesticides" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pesticides</SelectItem>
                  {pesticides.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={loadReport} disabled={loading} className="bg-purple-700 hover:bg-purple-800">
              {loading ? "Loading..." : "Apply Filter"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Total Sales</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{sales.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Total Amount</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totals.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Total Collected</p>
            <p className="text-xl font-bold text-purple-700 mt-1">{formatCurrency(totals.totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className={totals.totalBalance > 0 ? "border-red-200" : ""}>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Outstanding</p>
            <p className={`text-xl font-bold mt-1 ${totals.totalBalance > 0 ? "text-red-600" : "text-gray-500"}`}>
              {formatCurrency(totals.totalBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sprout className="w-4 h-4 text-purple-700" />
            Pesticide Sales
            <span className="text-gray-400 font-normal text-sm">({sales.length} records)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-blue-50 border-b border-t">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Pesticide</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Buyer</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Paid</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Balance</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase print:hidden">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
                ) : sales.map((s, i) => {
                  const buyer = s.farmer?.name || s.customer?.name || s.customerName || "Walk-in"
                  const buyerType = s.farmer ? "farmer" : s.customer ? "customer" : null
                  const status = s.balance <= 0 ? "PAID" : s.paidAmount > 0 ? "PARTIAL" : "PENDING"
                  return (
                    <tr key={s.id} className="hover:bg-blue-50">
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(s.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{s.pesticide?.name}</div>
                        <div className="text-xs text-gray-400">{s.pesticide?.unit}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{buyer}</div>
                        {buyerType && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${buyerType === "farmer" ? "bg-green-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                            {buyerType === "farmer" ? "Farmer" : "Customer"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{s.quantity} {s.pesticide?.unit}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(s.unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(s.totalAmount)}</td>
                      <td className="px-4 py-3 text-right text-purple-700">{formatCurrency(s.paidAmount)}</td>
                      <td className="px-4 py-3 text-right text-red-600">{s.balance > 0 ? formatCurrency(s.balance) : "—"}</td>
                      <td className="px-4 py-3 text-center print:hidden">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          status === "PAID" ? "bg-green-100 text-purple-700"
                          : status === "PARTIAL" ? "bg-blue-100 text-blue-700"
                          : "bg-red-100 text-red-700"
                        }`}>{status}</span>
                      </td>
                    </tr>
                  )
                })}
                {!loading && sales.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-gray-400">
                      <Sprout className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No pesticide sales found
                    </td>
                  </tr>
                )}
              </tbody>
              {!loading && sales.length > 0 && (
                <tfoot className="bg-blue-50 border-t-2 border-blue-300">
                  <tr>
                    <td colSpan={6} className="px-4 py-3 font-bold text-gray-700">Total — {sales.length} sales</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totals.totalAmount)}</td>
                    <td className="px-4 py-3 text-right font-bold text-purple-700">{formatCurrency(totals.totalPaid)}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">{totals.totalBalance > 0 ? formatCurrency(totals.totalBalance) : "—"}</td>
                    <td className="print:hidden" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-blue-300 text-center text-xs text-blue-600">
        Powered by Softtech
      </div>
    </div>
  )
}
