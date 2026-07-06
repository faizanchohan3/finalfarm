"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils"
import { Printer, ShoppingBag } from "lucide-react"

export default function PurchasesReportPage() {
  const [purchases, setPurchases] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [totals, setTotals] = useState({ totalAmount: 0, totalPaid: 0, totalBalance: 0 })
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [supplierId, setSupplierId] = useState("all")
  const [loading, setLoading] = useState(false)
  const [shop, setShop] = useState<any>(null)

  useEffect(() => {
    fetch("/api/suppliers").then((r) => r.json()).then((d) => setSuppliers(d.suppliers || []))
    fetch("/api/settings").then((r) => r.json()).then((d) => setShop(d.shop || null)).catch(() => {})
    loadReport()
  }, [])

  async function loadReport() {
    setLoading(true)
    const params = new URLSearchParams()
    if (dateFrom) params.set("from", dateFrom)
    if (dateTo) params.set("to", dateTo)
    if (supplierId !== "all") params.set("supplierId", supplierId)
    const data = await fetch(`/api/reports/purchases?${params}`).then((r) => r.json())
    setPurchases(data.purchases || [])
    setTotals({ totalAmount: data.totalAmount || 0, totalPaid: data.totalPaid || 0, totalBalance: data.totalBalance || 0 })
    setLoading(false)
  }

  const dateLabel = dateFrom || dateTo
    ? `${dateFrom ? formatDate(dateFrom) : "Start"} — ${dateTo ? formatDate(dateTo) : "Today"}`
    : "All Time"

  return (
    <div className="space-y-6">
      {/* Print header (hidden on screen) */}
      <div className="hidden print:block mb-4">
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
            <div style={{fontSize:"10px",opacity:0.75}}>Generated: {new Date().toLocaleDateString("en-PK")}</div>
          </div>
        </div>
        <div style={{height:"4px",background:"linear-gradient(90deg,#fbbf24 0%,#f59e0b 50%,#d97706 100%)"}}></div>
        <div style={{padding:"10px 22px 8px",background:"#f8fdf8",borderBottom:"1px solid #e5e7eb"}}>
          <h2 style={{margin:0,fontSize:"16px",fontWeight:800,color:"#14532d"}}>Purchase Report</h2>
          <div style={{fontSize:"11px",color:"#6b7280",marginTop:"2px"}}>Period: {dateLabel}</div>
        </div>
      </div>

      {/* Screen header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Purchase Report</h2>
          <p className="text-gray-500 text-sm">Detailed purchase transactions</p>
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
              <label className="text-xs text-gray-500 font-medium">Supplier</label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={loadReport} disabled={loading} className="bg-green-700 hover:bg-green-800">
              {loading ? "Loading..." : "Apply Filter"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Amount</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totals.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Paid</p>
            <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(totals.totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Outstanding Balance</p>
            <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(totals.totalBalance)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" /> Purchase Transactions
            <span className="text-gray-400 font-normal text-sm">({purchases.length} records)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 border-b border-t">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase">Items</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 text-xs uppercase">Total</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 text-xs uppercase">Paid</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 text-xs uppercase">Balance</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 text-xs uppercase print:hidden">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-amber-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(purchase.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{purchase.supplier?.name || "Unknown"}</div>
                      {purchase.supplier?.phone && (
                        <div className="text-xs text-gray-400 mt-0.5">{purchase.supplier.phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                      {purchase.items?.map((item: any) => `${item.quantity} ${item.product?.unit} ${item.product?.name}`).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(purchase.totalAmount)}</td>
                    <td className="px-4 py-3 text-right text-green-700">{formatCurrency(purchase.paidAmount)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatCurrency(purchase.balance)}</td>
                    <td className="px-4 py-3 text-center print:hidden">
                      <Badge className={`text-xs ${getStatusColor(purchase.status)}`}>{purchase.status}</Badge>
                    </td>
                  </tr>
                ))}
                {purchases.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400">No purchases found for selected filters</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-amber-50 border-t-2 border-amber-200">
                <tr>
                  <td colSpan={3} className="px-4 py-3 font-bold text-gray-700">Total — {purchases.length} purchases</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totals.totalAmount)}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">{formatCurrency(totals.totalPaid)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(totals.totalBalance)}</td>
                  <td />
                </tr>
              </tfoot>
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
