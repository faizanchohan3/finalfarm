"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/utils"
import { Printer, Package, AlertTriangle, Search, TrendingUp } from "lucide-react"

export default function ProductReportPage() {
  const [products, setProducts] = useState<any[]>([])
  const [totals, setTotals] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "low">("all")
  const [shop, setShop] = useState<any>(null)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  function loadReport(fromDate = from, toDate = to) {
    setLoading(true)
    const params = new URLSearchParams()
    if (fromDate) params.set("from", fromDate)
    if (toDate) params.set("to", toDate)
    fetch(`/api/reports/products?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setProducts(d.products || [])
        setTotals(d.totals || {})
        setLoading(false)
      })
  }

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setShop(d.shop || null)).catch(() => {})
    loadReport()
  }, [])

  const filtered = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === "all" || (filter === "low" && p.isLowStock)
    return matchSearch && matchFilter
  })

  const today = new Date().toLocaleDateString("en-PK")

  return (
    <div className="space-y-6">
      {/* ── Print Header ── */}
      <div className="hidden print:block">
        <style>{`@media print { @page { size: A4 landscape; } }`}</style>
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
          <h2 style={{margin:0,fontSize:"16px",fontWeight:800,color:"#14532d"}}>Store Product Report</h2>
          <div style={{fontSize:"11px",color:"#6b7280",marginTop:"2px"}}>All active products — stock levels, valuations and sales performance</div>
          <div style={{display:"flex",gap:"24px",marginTop:"8px",fontSize:"11px"}}>
            <span><strong>{totals.totalProducts}</strong> Products</span>
            <span>Stock Value: <strong>{formatCurrency(totals.totalStockValue)}</strong></span>
            <span>Total Sold: <strong>{formatCurrency(totals.totalSaleAmount)}</strong></span>
            <span style={{color:"#b91c1c"}}>Low Stock: <strong>{totals.lowStockCount}</strong></span>
          </div>
        </div>
      </div>

      {/* ── Screen Header ── */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Product Report</h2>
          <p className="text-gray-500 text-sm">Stock levels, valuations & sales performance</p>
        </div>
        <Button onClick={() => window.print()} variant="outline" className="gap-2">
          <Printer className="w-4 h-4" /> Print Report
        </Button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 print:hidden">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Total Products</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totals.totalProducts ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Stock Value</p>
            <p className="text-xl font-bold text-blue-700 mt-1">{formatCurrency(totals.totalStockValue || 0)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Remaining stock at cost</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Qty Sold</p>
            <p className="text-2xl font-bold text-purple-700 mt-1">{totals.totalQtySold ?? 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">{from || to ? "In selected period" : "All time"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Sale Amount</p>
            <p className="text-xl font-bold text-purple-700 mt-1">{formatCurrency(totals.totalSaleAmount || 0)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{from || to ? "In selected period" : "All time"}</p>
          </CardContent>
        </Card>
        <Card className={totals.lowStockCount > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardContent className="p-4">
            <p className={`text-xs uppercase font-medium tracking-wide ${totals.lowStockCount > 0 ? "text-red-600" : "text-gray-500"}`}>
              Low Stock Items
            </p>
            <p className={`text-2xl font-bold mt-1 ${totals.lowStockCount > 0 ? "text-red-600" : "text-gray-900"}`}>
              {totals.lowStockCount ?? "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Date Range Filter ── */}
      <div className="flex flex-wrap gap-3 items-end print:hidden bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">From Date</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">To Date</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
        <Button size="sm" className="bg-purple-700 hover:bg-purple-800" onClick={() => loadReport()}>
          Apply
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setFrom(""); setTo(""); loadReport("", "") }}>
          Clear (All Time)
        </Button>
        {(from || to) && (
          <span className="text-xs text-purple-700 font-medium bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
            Sales filtered: {from || "start"} → {to || "today"}
          </span>
        )}
      </div>

      {/* ── Stock / Search Filters ── */}
      <div className="flex gap-3 items-center print:hidden">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search product or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
          className={filter === "all" ? "bg-purple-700 hover:bg-purple-800" : ""}
        >
          All Products
        </Button>
        <Button
          variant={filter === "low" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("low")}
          className={filter === "low" ? "bg-red-600 hover:bg-red-700" : ""}
        >
          <AlertTriangle className="w-3.5 h-3.5 mr-1" />
          Low Stock ({totals.lowStockCount ?? 0})
        </Button>
      </div>

      {/* ── Table ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4" />
            Store Products
            <span className="text-gray-400 font-normal text-sm">({filtered.length} products)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 border-b border-t">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Unit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Min Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Buy Price</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Sale Price</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Margin</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Stock Value</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Qty Sold</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Sale Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={12} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
                ) : filtered.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-amber-50 ${p.isLowStock ? "bg-red-50/40" : ""}`}
                  >
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{p.name}</span>
                        {p.isLowStock && (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-gray-700 rounded-full">
                        {p.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 text-xs">{p.unit}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${p.isLowStock ? "text-red-600" : "text-gray-900"}`}>
                      {p.currentStock}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{p.minStock}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(p.purchasePrice)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(p.salePrice)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-medium ${p.margin > 20 ? "text-purple-700" : p.margin > 0 ? "text-orange-600" : "text-gray-400"}`}>
                        {p.margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-blue-700">{formatCurrency(p.stockValue)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{p.totalQtySold} {p.unit}</td>
                    <td className="px-4 py-3 text-right text-purple-700">{formatCurrency(p.totalSaleAmount)}</td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={12} className="px-4 py-10 text-center text-gray-400">No products found</td></tr>
                )}
              </tbody>
              <tfoot className="bg-amber-50 border-t-2 border-amber-200">
                <tr>
                  <td colSpan={9} className="px-4 py-3 font-bold text-gray-700">
                    Total — {filtered.length} products
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700">
                    {formatCurrency(filtered.reduce((s, p) => s + p.stockValue, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-700">
                    {filtered.reduce((s, p) => s + p.totalQtySold, 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-purple-700">
                    {formatCurrency(filtered.reduce((s, p) => s + p.totalSaleAmount, 0))}
                  </td>
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
