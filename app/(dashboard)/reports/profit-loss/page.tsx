"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils"
import { Printer, TrendingUp, TrendingDown, DollarSign } from "lucide-react"

export default function ProfitLossPage() {
  const [data, setData] = useState<any>(null)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [shop, setShop] = useState<any>(null)

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setShop(d.shop || null)).catch(() => {})
    loadReport()
  }, [])

  async function loadReport() {
    setLoading(true)
    const params = new URLSearchParams()
    if (dateFrom) params.set("from", dateFrom)
    if (dateTo) params.set("to", dateTo)
    const result = await fetch(`/api/reports/income?${params}`).then((r) => r.json())
    setData(result)
    setLoading(false)
  }

  const dateLabel = dateFrom || dateTo
    ? `${dateFrom ? formatDate(dateFrom) : "Start"} â€” ${dateTo ? formatDate(dateTo) : "Today"}`
    : "All Time"

  return (
    <div className="space-y-6">
      {/* Print header */}
      <div className="hidden print:block mb-4">
        <div style={{background:"linear-gradient(135deg,#14532d 0%,#166534 60%,#15803d 100%)",color:"#fff",padding:"16px 22px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            {shop?.logo
              ? <img src={shop.logo} style={{width:"52px",height:"52px",borderRadius:"8px",background:"#fff",padding:"3px",objectFit:"contain"}} alt="" />
              : <div style={{width:"52px",height:"52px",borderRadius:"8px",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"26px",fontWeight:900,border:"2px solid rgba(255,255,255,0.3)"}}>{(shop?.name||"G")[0].toUpperCase()}</div>
            }
            <div>
              <div style={{fontSize:"20px",fontWeight:900,letterSpacing:"-0.5px"}}>{shop?.name||"Argo-Firn"}</div>
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
          <h2 style={{margin:0,fontSize:"16px",fontWeight:800,color:"#14532d"}}>Profit &amp; Loss Statement</h2>
          <div style={{fontSize:"11px",color:"#6b7280",marginTop:"2px"}}>Period: {dateLabel}</div>
        </div>
      </div>

      {/* Screen header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Profit & Loss</h2>
          <p className="text-gray-500 text-sm">Income, expenses and net profit overview</p>
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
            <Button onClick={loadReport} disabled={loading} className="bg-purple-700 hover:bg-purple-800">
              {loading ? "Loading..." : "Apply Filter"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {data && (
        <>
          {/* P&L Statement */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-purple-700">
                  <TrendingUp className="w-4 h-4" /> Revenue
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <div>
                    <p className="font-medium text-gray-800">Agricultural Sales</p>
                    <p className="text-xs text-gray-500">{data.salesCount} transactions</p>
                  </div>
                  <p className="font-semibold text-gray-900">{formatCurrency(data.salesTotal)}</p>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <p className="text-gray-600 text-sm">Sales Collected</p>
                  <p className="text-purple-700">{formatCurrency(data.salesPaid)}</p>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <p className="text-gray-600 text-sm">Sales Receivable</p>
                  <p className="text-orange-600">{formatCurrency(data.salesBalance)}</p>
                </div>
                {data.pesticideSalesTotal > 0 && (
                  <>
                    <div className="flex justify-between items-center py-2 border-b">
                      <div>
                        <p className="font-medium text-gray-800">Pesticide Sales</p>
                        <p className="text-xs text-gray-500">{data.pesticideSalesCount} transactions</p>
                      </div>
                      <p className="font-semibold text-gray-900">{formatCurrency(data.pesticideSalesTotal)}</p>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <p className="text-gray-600 text-sm">Pesticide Collected</p>
                      <p className="text-purple-700">{formatCurrency(data.pesticideSalesPaid)}</p>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <p className="text-gray-600 text-sm">Pesticide Receivable</p>
                      <p className="text-orange-600">{formatCurrency(data.pesticideSalesBalance)}</p>
                    </div>
                  </>
                )}
                {data.pesticideDiscountFromSupplier > 0 && (
                  <div className="flex justify-between items-center py-2 border-b bg-green-50 px-2">
                    <p className="text-gray-600 text-sm font-medium">Pesticide Discount from Supplier</p>
                    <p className="text-purple-700 font-medium">{formatCurrency(data.pesticideDiscountFromSupplier)}</p>
                  </div>
                )}
                {data.otherIncome > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <p className="text-gray-600 text-sm">Other Income</p>
                    <p className="text-purple-700">{formatCurrency(data.otherIncome)}</p>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 font-bold text-purple-700 bg-green-50 px-2 py-2 rounded">
                  <p>Total Revenue</p>
                  <p>{formatCurrency(data.totalRevenue + data.otherIncome)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Expenses */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-red-600">
                  <TrendingDown className="w-4 h-4" /> Expenses
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <div>
                    <p className="font-medium text-gray-800">Purchases (Cost of Goods)</p>
                    <p className="text-xs text-gray-500">{data.purchasesCount} orders</p>
                  </div>
                  <p className="font-semibold text-gray-900">{formatCurrency(data.purchasesTotal)}</p>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <p className="text-gray-600 text-sm">Purchases Paid</p>
                  <p className="text-red-600">{formatCurrency(data.purchasesPaid)}</p>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <p className="text-gray-600 text-sm">Purchases Payable</p>
                  <p className="text-orange-600">{formatCurrency(data.purchasesBalance)}</p>
                </div>
                {data.otherExpense > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <p className="text-gray-600 text-sm">Other Expenses</p>
                    <p className="text-red-600">{formatCurrency(data.otherExpense)}</p>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 font-bold text-red-600 bg-red-50 px-2 py-2 rounded">
                  <p>Total Expenses</p>
                  <p>{formatCurrency(data.purchasesTotal + data.otherExpense)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Net Summary */}
          <Card className="border-2 border-blue-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-w-md mx-auto">
                <div className="flex justify-between py-2 border-b">
                  <p className="text-gray-600">Agricultural Sales</p>
                  <p className="font-medium">{formatCurrency(data.salesTotal)}</p>
                </div>
                {data.pesticideSalesTotal > 0 && (
                  <div className="flex justify-between py-2 border-b">
                    <p className="text-gray-600">Pesticide Sales</p>
                    <p className="font-medium">{formatCurrency(data.pesticideSalesTotal)}</p>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b font-semibold text-purple-700 bg-green-50 px-2">
                  <p>Total Revenue</p>
                  <p>{formatCurrency(data.totalRevenue)}</p>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <p className="text-gray-600">Cost of Purchases</p>
                  <p className="font-medium text-red-600">âˆ’ {formatCurrency(data.purchasesTotal)}</p>
                </div>
                {data.pesticideIncentive > 0 && (
                  <div className="flex justify-between py-2 border-b">
                    <p className="text-gray-600 text-sm">Pesticide Incentive</p>
                    <p className="font-medium text-blue-600">âˆ’ {formatCurrency(data.pesticideIncentive)}</p>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b font-semibold">
                  <p className="text-gray-800">Gross Profit</p>
                  <p className={data.grossProfit >= 0 ? "text-purple-700" : "text-red-600"}>
                    {formatCurrency(data.grossProfit)}
                  </p>
                </div>
                {data.pesticideDiscountFromSupplier > 0 && (
                  <div className="flex justify-between py-2 border-b">
                    <p className="text-gray-600">Pesticide Discount from Supplier</p>
                    <p className="text-purple-700">+ {formatCurrency(data.pesticideDiscountFromSupplier)}</p>
                  </div>
                )}
                {data.otherIncome > 0 && (
                  <div className="flex justify-between py-2 border-b">
                    <p className="text-gray-600">Other Income</p>
                    <p className="text-purple-700">+ {formatCurrency(data.otherIncome)}</p>
                  </div>
                )}
                {data.otherExpense > 0 && (
                  <div className="flex justify-between py-2 border-b">
                    <p className="text-gray-600">Other Expenses</p>
                    <p className="text-red-600">âˆ’ {formatCurrency(data.otherExpense)}</p>
                  </div>
                )}
                <div className={`flex justify-between py-3 px-3 rounded-lg font-bold text-lg ${data.netIncome >= 0 ? "bg-green-50 text-purple-800" : "bg-red-50 text-red-800"}`}>
                  <p>Net {data.netIncome >= 0 ? "Profit" : "Loss"}</p>
                  <p>{formatCurrency(Math.abs(data.netIncome))}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transactions */}
          {data.transactions?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-600">Other Transactions ({data.transactions.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-blue-50 border-b border-t">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.transactions.map((t: any) => (
                      <tr key={t.id} className="hover:bg-blue-50">
                        <td className="px-4 py-2 text-gray-500 text-xs">{formatDate(t.createdAt)}</td>
                        <td className="px-4 py-2 text-gray-700">{t.description || "â€”"}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${t.type === "CREDIT" ? "bg-green-100 text-purple-700" : "bg-red-100 text-red-700"}`}>
                            {t.type}
                          </span>
                        </td>
                        <td className={`px-4 py-2 text-right font-medium ${t.type === "CREDIT" ? "text-purple-700" : "text-red-600"}`}>
                          {formatCurrency(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {loading && (
        <div className="text-center py-20 text-gray-400">Loading report...</div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-blue-300 text-center text-xs text-blue-600">
        Powered by Softtech
      </div>
    </div>
  )
}

