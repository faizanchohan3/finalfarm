use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Printer, TrendingUp, TrendingDown, Wallet, AlertCircle } from "lucide-react"
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts"

export default function BalanceSheetPage() {
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
    const result = await fetch(`/api/reports/balance-sheet?${params}`).then((r) => r.json())
    setData(result)
    setLoading(false)
  }

  const dateLabel = dateFrom || dateTo
    ? `${dateFrom ? formatDate(dateFrom) : "Start"} â€” ${dateTo ? formatDate(dateTo) : "Today"}`
    : "All Time"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Balance Sheet & P&L</h2>
          <p className="text-gray-500 text-sm">Complete financial statement with assets, liabilities, equity</p>
        </div>
        <Button onClick={() => window.print()} variant="outline" className="gap-2">
          <Printer className="w-4 h-4" /> Print
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
          {/* P&L STATEMENT */}
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardHeader className="pb-2 border-b-2 border-blue-200">
              <CardTitle className="text-lg text-blue-900">ðŸ“Š INCOME STATEMENT (P&L)</CardTitle>
              <p className="text-xs text-blue-700 mt-1">Period: {dateLabel}</p>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Side */}
                <div className="space-y-3">
                  <h3 className="font-bold text-purple-800 text-sm uppercase bg-green-100 px-3 py-2 rounded">Revenue</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">Agricultural Sales</span>
                      <span className="font-semibold">{formatCurrency(data.salesTotal)}</span>
                    </div>
                    {data.pesticideSalesTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">Pesticide Sales</span>
                        <span className="font-semibold">{formatCurrency(data.pesticideSalesTotal)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex justify-between text-sm font-bold text-purple-700">
                      <span>Total Revenue</span>
                      <span>{formatCurrency(data.totalRevenue)}</span>
                    </div>
                  </div>

                  <h3 className="font-bold text-purple-800 text-sm uppercase bg-green-100 px-3 py-2 rounded mt-4">Income</h3>
                  <div className="space-y-2">
                    {data.pesticideDiscountFromSupplier > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">Pesticide Discount from Supplier</span>
                        <span className="text-purple-700">+ {formatCurrency(data.pesticideDiscountFromSupplier)}</span>
                      </div>
                    )}
                    {data.otherIncome > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">Other Income</span>
                        <span className="text-purple-700">+ {formatCurrency(data.otherIncome)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex justify-between text-sm font-bold text-purple-700">
                      <span>Total Income</span>
                      <span>+ {formatCurrency(data.totalIncome)}</span>
                    </div>
                  </div>
                </div>

                {/* Expense Side */}
                <div className="space-y-3">
                  <h3 className="font-bold text-red-800 text-sm uppercase bg-red-100 px-3 py-2 rounded">Expenses</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">Cost of Purchases</span>
                      <span className="font-semibold text-red-600">âˆ’ {formatCurrency(data.purchasesTotal)}</span>
                    </div>
                    {data.otherExpense > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">Other Expenses</span>
                        <span className="text-red-600">âˆ’ {formatCurrency(data.otherExpense)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex justify-between text-sm font-bold text-red-600">
                      <span>Total Expenses</span>
                      <span>âˆ’ {formatCurrency(data.purchasesTotal + data.otherExpense)}</span>
                    </div>
                  </div>

                  <h3 className="font-bold text-blue-800 text-sm uppercase bg-blue-100 px-3 py-2 rounded mt-4">Profit/Loss</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">Gross Profit</span>
                      <span className={`font-bold ${data.grossProfit >= 0 ? "text-purple-700" : "text-red-600"}`}>
                        {formatCurrency(data.grossProfit)}
                      </span>
                    </div>
                    <div className="border-t-2 pt-2 flex justify-between text-base font-bold rounded px-2 py-2"
                      style={{background: data.netIncome >= 0 ? "#dcfce7" : "#fee2e2", color: data.netIncome >= 0 ? "#15803d" : "#991b1b"}}>
                      <span>Net {data.netIncome >= 0 ? "Profit" : "Loss"}</span>
                      <span>{formatCurrency(Math.abs(data.netIncome))}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* BALANCE SHEET */}
          <Card className="border-2 border-purple-200 bg-purple-50">
            <CardHeader className="pb-2 border-b-2 border-purple-200">
              <CardTitle className="text-lg text-purple-900">ðŸ’° BALANCE SHEET (Assets = Liabilities + Equity)</CardTitle>
              <p className="text-xs text-purple-700 mt-1">As of {new Date().toLocaleDateString("en-PK")}</p>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ASSETS */}
                <div>
                  <h3 className="font-bold text-blue-900 text-sm uppercase bg-blue-100 px-3 py-2 rounded mb-3">ASSETS</h3>
                  <div className="space-y-3">
                    <div className="border-l-4 border-blue-500 pl-3">
                      <p className="text-xs text-gray-600 font-medium">Current Assets</p>
                      <div className="space-y-2 mt-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-700">Customer Receivables</span>
                          <span className="font-semibold">{formatCurrency(data.customerReceivables)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Farmer Receivables</span>
                          <span className="font-semibold">{formatCurrency(data.farmerReceivables)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-gray-700">Stock Value</span>
                          <span className="font-semibold">{formatCurrency(data.totalStockValue)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-blue-100 rounded px-3 py-2 flex justify-between font-bold text-blue-900 border-2 border-blue-300">
                      <span>TOTAL ASSETS</span>
                      <span>{formatCurrency(data.totalAssets)}</span>
                    </div>
                  </div>
                </div>

                {/* LIABILITIES */}
                <div>
                  <h3 className="font-bold text-red-900 text-sm uppercase bg-red-100 px-3 py-2 rounded mb-3">LIABILITIES</h3>
                  <div className="space-y-3">
                    <div className="border-l-4 border-red-500 pl-3">
                      <p className="text-xs text-gray-600 font-medium">Current Liabilities</p>
                      <div className="space-y-2 mt-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-700">Supplier Payables</span>
                          <span className="font-semibold text-red-600">{formatCurrency(data.supplierPayables)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-red-100 rounded px-3 py-2 flex justify-between font-bold text-red-900 border-2 border-red-300">
                      <span>TOTAL LIABILITIES</span>
                      <span>{formatCurrency(data.totalLiabilities)}</span>
                    </div>
                  </div>
                </div>

                {/* EQUITY */}
                <div>
                  <h3 className="font-bold text-purple-900 text-sm uppercase bg-green-100 px-3 py-2 rounded mb-3">EQUITY</h3>
                  <div className="space-y-3">
                    <div className="border-l-4 border-green-500 pl-3">
                      <p className="text-xs text-gray-600 font-medium">Owner's Capital</p>
                      <div className="space-y-2 mt-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-700">Net Income/(Loss)</span>
                          <span className={`font-semibold ${data.netIncome >= 0 ? "text-purple-700" : "text-red-600"}`}>
                            {formatCurrency(data.netIncome)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-100 rounded px-3 py-2 flex justify-between font-bold text-purple-900 border-2 border-green-300">
                      <span>TOTAL EQUITY</span>
                      <span>{formatCurrency(data.equity)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Accounting Equation Verification */}
              <div className={`mt-6 p-4 rounded-lg border-2 ${data.accountingEquation ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {data.accountingEquation ? (
                    <div className="text-purple-700 text-sm font-bold">âœ“ Accounting Equation Balanced</div>
                  ) : (
                    <div className="text-red-700 text-sm font-bold flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Equation Imbalanced</div>
                  )}
                </div>
                <div className="text-xs text-gray-700 space-y-1">
                  <div className="flex justify-between">
                    <span>Assets:</span>
                    <span className="font-semibold">{formatCurrency(data.totalAssets)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Liabilities + Equity:</span>
                    <span className="font-semibold">{formatCurrency(data.totalLiabilities + data.equity)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* VISUAL DIAGRAMS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Accounting Equation Diagram */}
            <Card className="border-2 border-indigo-200 bg-indigo-50">
              <CardHeader className="pb-2 border-b-2 border-indigo-200">
                <CardTitle className="text-base text-indigo-900">ðŸ“ Accounting Equation</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center justify-center gap-4 mb-6">
                  <div className="text-center flex-1">
                    <div className="bg-blue-100 border-2 border-blue-500 rounded-lg p-4">
                      <p className="text-xs text-gray-600 font-medium">ASSETS</p>
                      <p className="text-2xl font-bold text-blue-700">{formatCurrency(data.totalAssets)}</p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-600">=</div>
                  <div className="text-center flex-1">
                    <div className="bg-red-100 border-2 border-red-500 rounded-lg p-4">
                      <p className="text-xs text-gray-600 font-medium">LIABILITIES</p>
                      <p className="text-xl font-bold text-red-700">{formatCurrency(data.totalLiabilities)}</p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-600">+</div>
                  <div className="text-center flex-1">
                    <div className="bg-green-100 border-2 border-green-500 rounded-lg p-4">
                      <p className="text-xs text-gray-600 font-medium">EQUITY</p>
                      <p className="text-xl font-bold text-purple-700">{formatCurrency(data.equity)}</p>
                    </div>
                  </div>
                </div>
                <div className={`p-3 rounded-lg text-center font-bold ${data.accountingEquation ? "bg-green-100 text-purple-800 border-2 border-green-500" : "bg-red-100 text-red-800 border-2 border-red-500"}`}>
                  {data.accountingEquation ? "âœ“ EQUATION BALANCED" : "âš  EQUATION IMBALANCED"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pie Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Revenue vs Expenses Pie Chart */}
            <Card className="border-2 border-emerald-200 bg-emerald-50 print:hidden">
              <CardHeader className="pb-2 border-b-2 border-emerald-200">
                <CardTitle className="text-base text-emerald-900">ðŸ’° Revenue vs Expenses</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Revenue", value: data.totalRevenue, fill: "#10b981" },
                        { name: "Expenses", value: data.purchasesTotal + data.otherExpense, fill: "#ef4444" },
                      ].filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, value, percent }) => `${name}: ${(percent != null ? (percent * 100).toFixed(1) : 0)}%`}
                      outerRadius={90}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip formatter={(value: any) => typeof value === 'number' ? formatCurrency(value) : value} contentStyle={{ backgroundColor: "#f9fafb", border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px" }} />
                    <Legend wrapperStyle={{ paddingTop: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Assets Breakdown Pie Chart */}
            {data.totalAssets > 0 && (
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardHeader className="pb-2 border-b-2 border-blue-200">
                  <CardTitle className="text-base text-blue-900">ðŸ¦ Assets Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Receivables", value: Math.max(0, data.totalReceivables), fill: "#3b82f6" },
                          { name: "Stock Value", value: Math.max(0, data.totalStockValue), fill: "#06b6d4" },
                        ].filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }) => `${name}: ${(percent != null ? (percent * 100).toFixed(1) : 0)}%`}
                        outerRadius={90}
                        dataKey="value"
                      >
                        <Cell fill="#3b82f6" />
                        <Cell fill="#06b6d4" />
                      </Pie>
                      <Tooltip formatter={(value: any) => typeof value === 'number' ? formatCurrency(value) : value} contentStyle={{ backgroundColor: "#f9fafb", border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px" }} />
                      <Legend wrapperStyle={{ paddingTop: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Financial Summary Bar Chart */}
          <Card className="border-2 border-violet-200 bg-violet-50 print:hidden">
            <CardHeader className="pb-2 border-b-2 border-violet-200">
              <CardTitle className="text-base text-violet-900">ðŸ“Š Financial Summary Comparison</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={[
                    { category: "Revenue", amount: data.totalRevenue, fill: "#10b981" },
                    { category: "Purchases", amount: data.purchasesTotal, fill: "#f59e0b" },
                    { category: "Other Exp.", amount: data.otherExpense, fill: "#ef4444" },
                    { category: "Net Profit", amount: Math.max(0, data.netIncome), fill: data.netIncome >= 0 ? "#3b82f6" : "#f97316" },
                    { category: "Total Assets", amount: data.totalAssets, fill: "#8b5cf6" },
                  ]}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" vertical={false} />
                  <XAxis
                    dataKey="category"
                    stroke="#6b7280"
                    style={{ fontSize: "12px", fontWeight: "500" }}
                    tick={{ fill: "#6b7280" }}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    style={{ fontSize: "12px" }}
                    tick={{ fill: "#6b7280" }}
                  />
                  <Tooltip
                    formatter={(value: any) => typeof value === 'number' ? formatCurrency(value) : value}
                    contentStyle={{ backgroundColor: "#f9fafb", border: "2px solid #d1d5db", borderRadius: "8px", padding: "12px" }}
                    labelStyle={{ color: "#1f2937", fontWeight: "600" }}
                  />
                  <Bar
                    dataKey="amount"
                    radius={[8, 8, 0, 0]}
                    fill="#3b82f6"
                  >
                    {[
                      { category: "Revenue", fill: "#10b981" },
                      { category: "Purchases", fill: "#f59e0b" },
                      { category: "Other Exp.", fill: "#ef4444" },
                      { category: "Net Profit", fill: data.netIncome >= 0 ? "#3b82f6" : "#f97316" },
                      { category: "Total Assets", fill: "#8b5cf6" },
                    ].map((item, index) => (
                      <Cell key={`cell-${index}`} fill={item.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* SUMMARY METRICS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 uppercase font-medium">Total Sales Volume</p>
                <p className="text-xl font-bold text-blue-700 mt-1">{formatCurrency(data.totalRevenue)}</p>
                <p className="text-xs text-gray-400 mt-1">{data.salesCount + data.pesticideSalesCount} transactions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 uppercase font-medium">Total Purchases</p>
                <p className="text-xl font-bold text-red-700 mt-1">{formatCurrency(data.purchasesTotal)}</p>
                <p className="text-xs text-gray-400 mt-1">{data.purchasesCount} orders</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 uppercase font-medium">Total Receivables</p>
                <p className="text-xl font-bold text-orange-700 mt-1">{formatCurrency(data.totalReceivables)}</p>
                <p className="text-xs text-gray-400 mt-1">From customers & farmers</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 uppercase font-medium">Total Payables</p>
                <p className="text-xl font-bold text-blue-600 mt-1">{formatCurrency(data.supplierPayables)}</p>
                <p className="text-xs text-gray-400 mt-1">To suppliers</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-blue-300 text-center text-xs text-blue-600">
        Powered by Softtech
      </div>
    </div>
  )
}

