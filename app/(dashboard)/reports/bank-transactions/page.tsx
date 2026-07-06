"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Building2, Printer, ArrowDownCircle, ArrowUpCircle, TrendingDown, TrendingUp, Wallet } from "lucide-react"

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  RECEIPT:        { label: "Receipt",       color: "bg-green-100 text-green-700" },
  PAYMENT:        { label: "Payment",       color: "bg-blue-100 text-blue-700" },
  FARMER_PAYMENT: { label: "Farmer Pay",    color: "bg-orange-100 text-orange-700" },
  INCOME:         { label: "Income",        color: "bg-emerald-100 text-emerald-700" },
  EXPENSE:        { label: "Expense",       color: "bg-red-100 text-red-700" },
}

const isInflow = (type: string) => type === "RECEIPT" || type === "INCOME"

export default function BankTransactionsPage() {
  const [banks, setBanks] = useState<any[]>([])
  const [entries, setEntries] = useState<any[]>([])
  const [summary, setSummary] = useState({ totalIn: 0, totalOut: 0, count: 0 })
  const [bankId, setBankId] = useState("ALL")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [shop, setShop] = useState<any>(null)
  const [bankSearch, setBankSearch] = useState("")

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setShop(d.shop || null)).catch(() => {})
    fetch("/api/banks").then((r) => r.json()).then((d) => setBanks(d.banks || []))
  }, [])

  async function loadReport() {
    setLoading(true)
    const params = new URLSearchParams()
    if (bankId && bankId !== "ALL") params.set("bankId", bankId)
    if (dateFrom) params.set("from", dateFrom)
    if (dateTo) params.set("to", dateTo)
    const data = await fetch(`/api/reports/bank-transactions?${params}`).then((r) => r.json())
    setEntries(data.entries || [])
    setSummary({ totalIn: data.totalIn || 0, totalOut: data.totalOut || 0, count: data.count || 0 })
    setLoaded(true)
    setLoading(false)
  }

  const selectedBankName = bankId === "ALL" ? "All Banks" : (banks.find((b) => b.id === bankId)?.name || "")
  const dateLabel =
    dateFrom || dateTo
      ? `${dateFrom ? formatDate(dateFrom) : "Start"} — ${dateTo ? formatDate(dateTo) : "Today"}`
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
          <h2 style={{margin:0,fontSize:"16px",fontWeight:800,color:"#14532d"}}>Bank Transactions Report</h2>
          <div style={{fontSize:"13px",fontWeight:600,color:"#374151",marginTop:"4px"}}>{selectedBankName}</div>
          <div style={{fontSize:"11px",color:"#6b7280",marginTop:"2px"}}>Period: {dateLabel}</div>
        </div>
      </div>

      {/* Screen header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bank Transactions</h2>
          <p className="text-gray-500 text-sm">Filter by bank and date range</p>
        </div>
        {loaded && (
          <Button onClick={() => window.print()} variant="outline" className="gap-2">
            <Printer className="w-4 h-4" /> Print Report
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Bank</label>
              <div className="flex gap-2">
                <Select value={bankId} onValueChange={(val) => { setBankId(val); setBankSearch(""); }}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="All Banks" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 overflow-y-auto">
                    <div className="sticky top-0 bg-amber-50 p-2 border-b">
                      <Input
                        placeholder="Search banks..."
                        value={bankSearch}
                        onChange={(e) => setBankSearch(e.target.value)}
                        className="mb-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <SelectItem value="ALL">All Banks</SelectItem>
                    {banks
                      .filter((b) =>
                        b.name.toLowerCase().includes(bankSearch.toLowerCase()) ||
                        (b.accountNumber && b.accountNumber.includes(bankSearch))
                      )
                      .map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}{b.accountNumber ? ` (${b.accountNumber})` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">From Date</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">To Date</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
            </div>
            <Button onClick={loadReport} disabled={loading} className="bg-green-700 hover:bg-green-800">
              {loading ? "Loading..." : "View Report"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!loaded && !loading && (
        <div className="text-center py-20 text-gray-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Select a bank and date range, then click View Report</p>
        </div>
      )}

      {loading && <div className="text-center py-20 text-gray-400">Loading...</div>}

      {loaded && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Inflow</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalIn)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Receipts + Income</p>
                </div>
                <div className="p-3 bg-green-50 rounded-full">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Outflow</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalOut)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Payments + Expenses</p>
                </div>
                <div className="p-3 bg-red-50 rounded-full">
                  <TrendingDown className="w-6 h-6 text-red-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Net Balance</p>
                  <p className={`text-2xl font-bold ${summary.totalIn - summary.totalOut >= 0 ? "text-blue-600" : "text-red-600"}`}>
                    {formatCurrency(Math.abs(summary.totalIn - summary.totalOut))}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{summary.count} transactions</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-full">
                  <Wallet className="w-6 h-6 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transactions Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                {selectedBankName} — {dateLabel}
                <span className="text-gray-400 font-normal text-sm">({summary.count} entries)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-amber-50 border-b border-t">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Bank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Party</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Method</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-green-700 uppercase">In (Dr)</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-red-700 uppercase">Out (Cr)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {entries.map((e, i) => (
                      <tr key={e.id} className={isInflow(e.type) ? "bg-green-50/30" : ""}>
                        <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(e.date)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${TYPE_LABELS[e.type]?.color || "bg-amber-100 text-gray-600"}`}>
                            {TYPE_LABELS[e.type]?.label || e.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">{e.bank}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-medium text-xs">{e.party}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{e.description}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs capitalize">{e.method?.replace("_", " ") || "-"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-700">
                          {isInflow(e.type) ? formatCurrency(e.amount) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">
                          {!isInflow(e.type) ? formatCurrency(e.amount) : "—"}
                        </td>
                      </tr>
                    ))}
                    {entries.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                          No bank transactions found for the selected filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {entries.length > 0 && (
                    <tfoot className="bg-amber-50 border-t-2 border-amber-200">
                      <tr>
                        <td colSpan={7} className="px-4 py-3 font-bold text-gray-700">Total</td>
                        <td className="px-4 py-3 text-right font-bold text-green-700">{formatCurrency(summary.totalIn)}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(summary.totalOut)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
    </div>
  )
}
