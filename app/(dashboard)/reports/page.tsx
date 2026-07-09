"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts"
import {
  BarChart3, TrendingUp, Users, ShoppingCart, ShoppingBag, DollarSign, BookOpen,
  ArrowRight, Package, TrendingDown, AlertTriangle, Wallet, Tractor, Store, UserCheck,
} from "lucide-react"
import Link from "next/link"
import { useSession } from "next-auth/react"

const reportCards = [
  {
    href: "/reports/sales",
    title: "Sales Report",
    description: "Detailed sales transactions with date & customer filters",
    icon: ShoppingCart,
    color: "from-green-700 to-green-800",
  },
  {
    href: "/reports/purchases",
    title: "Purchase Report",
    description: "Detailed purchase transactions with date & supplier filters",
    icon: ShoppingBag,
    color: "from-amber-600 to-amber-700",
  },
  {
    href: "/reports/customers",
    title: "Trader Report",
    description: "Trader-wise summary with expandable sales details",
    icon: Users,
    color: "from-blue-600 to-blue-700",
  },
  {
    href: "/reports/products",
    title: "Product Report",
    description: "Stock levels, valuations, margins & sales performance",
    icon: Package,
    color: "from-violet-600 to-violet-700",
  },
  {
    href: "/reports/balance-sheet",
    title: "Balance Sheet & P&L",
    description: "Complete financial statement with assets, liabilities, equity & profit/loss",
    icon: Wallet,
    color: "from-indigo-600 to-indigo-700",
  },
  {
    href: "/reports/profit-loss",
    title: "Profit & Loss",
    description: "Revenue vs expenses, gross profit and net income",
    icon: TrendingUp,
    color: "from-purple-600 to-purple-700",
  },
  {
    href: "/reports/customer-ledger",
    title: "Trader Ledger",
    description: "Full debit/credit transaction ledger per trader",
    icon: BookOpen,
    color: "from-orange-500 to-orange-600",
  },
  {
    href: "/reports/supplier-ledger",
    title: "Supplier Ledger",
    description: "Full purchase & payment ledger per supplier",
    icon: DollarSign,
    color: "from-teal-600 to-teal-700",
  },
  {
    href: "/reports/bank-transactions",
    title: "Bank Transactions",
    description: "All bank payments & receipts filtered by bank and date",
    icon: Wallet,
    color: "from-blue-600 to-blue-700",
  },
  {
    href: "/reports/all-farmers",
    title: "All Farmers Report",
    description: "Balance summary for all farmers â€” payable, advance, and settled",
    icon: Tractor,
    color: "from-green-600 to-green-700",
  },
  {
    href: "/reports/all-suppliers",
    title: "All Suppliers Report",
    description: "Balance summary for all suppliers â€” payable, advance, and settled",
    icon: Store,
    color: "from-cyan-600 to-cyan-700",
  },
  {
    href: "/reports/all-traders",
    title: "All Traders Report",
    description: "Balance summary for all traders (buyers/sellers) â€” receivable, payable, and settled",
    icon: UserCheck,
    color: "from-indigo-600 to-indigo-700",
  },
]

export default function ReportsPage() {
  const { data: session } = useSession()
  const [monthlySales, setMonthlySales] = useState<any[]>([])
  const [financeData, setFinanceData] = useState({ income: 0, expense: 0, balance: 0 })
  const [customerData, setCustomerData] = useState({ count: 0, outstanding: 0, totalBusiness: 0 })
  const [productData, setProductData] = useState({ totalProducts: 0, stockValue: 0, totalSaleAmount: 0, lowStockCount: 0 })
  const [expenseData, setExpenseData] = useState({ total: 0, topCategories: [] as any[] })
  const [loading, setLoading] = useState(true)

  const isCashier = session?.user?.role === "CASHIER"

  // Filter reports based on role
  const visibleReportCards = isCashier ? reportCards.filter(card => [
    "/reports/sales",
    "/reports/purchases",
    "/reports/all-farmers",
    "/reports/all-traders",
    "/reports/all-suppliers",
  ].includes(card.href)) : reportCards

  useEffect(() => {
    Promise.all([
      fetch("/api/reports/monthly-sales").then((r) => r.json()),
      fetch("/api/finance").then((r) => r.json()),
      fetch("/api/reports/customers").then((r) => r.json()),
      fetch("/api/reports/products").then((r) => r.json()),
      fetch("/api/expenses").then((r) => r.json()),
    ]).then(([ms, fi, cu, pr, ex]) => {
      setMonthlySales(ms.data || [])
      setFinanceData({ income: fi.income || 0, expense: fi.expense || 0, balance: fi.balance || 0 })

      const customers = cu.customers || []
      setCustomerData({
        count: customers.length,
        outstanding: customers.reduce((s: number, c: any) => s + (c.totalBalance || 0), 0),
        totalBusiness: customers.reduce((s: number, c: any) => s + (c.totalBusiness || 0), 0),
      })

      const t = pr.totals || {}
      setProductData({
        totalProducts: t.totalProducts || 0,
        stockValue: t.totalStockValue || 0,
        totalSaleAmount: t.totalSaleAmount || 0,
        lowStockCount: t.lowStockCount || 0,
      })

      const summary = (ex.summary || []).filter((s: any) => s._sum?.amount)
      setExpenseData({
        total: ex.total || 0,
        topCategories: summary.sort((a: any, b: any) => b._sum.amount - a._sum.amount).slice(0, 4),
      })

      setLoading(false)
    })
  }, [])

  const financeChartData = [
    { name: "Income", value: financeData.income, color: "#15803d" },
    { name: "Expenses", value: financeData.expense, color: "#ef4444" },
  ]

  const CATEGORY_COLORS = ["#ef4444", "#f97316", "#eab308", "#8b5cf6"]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
        <p className="text-gray-500 text-sm">Business performance overview â€” select a report below</p>
      </div>

      {/* â”€â”€ Key Metrics â€” Colorful Gradient Cards â”€â”€ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/reports/sales">
          <div
            className="rounded-xl p-5 text-blue-900 cursor-pointer hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg, #15803d 0%, #166534 100%)" }}
          >
            <ShoppingCart className="w-6 h-6 mb-3 opacity-80" />
            <p className="text-2xl font-bold">{loading ? "â€”" : formatCurrency(financeData.income)}</p>
            <p className="text-purple-200 text-sm mt-1">Total Revenue</p>
            <p className="text-purple-300 text-xs mt-2 flex items-center gap-1">View Sales Report <ArrowRight className="w-3 h-3" /></p>
          </div>
        </Link>

        <Link href="/reports/customers">
          <div
            className="rounded-xl p-5 text-blue-900 cursor-pointer hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}
          >
            <Users className="w-6 h-6 mb-3 opacity-80" />
            <p className="text-2xl font-bold">{loading ? "â€”" : customerData.count}</p>
            <p className="text-blue-200 text-sm mt-1">Total Traders</p>
            <p className="text-blue-300 text-xs mt-2 flex items-center gap-1">
              Udhar: {loading ? "â€”" : formatCurrency(customerData.outstanding)} <ArrowRight className="w-3 h-3" />
            </p>
          </div>
        </Link>

        <Link href="/reports/products">
          <div
            className="rounded-xl p-5 text-blue-900 cursor-pointer hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" }}
          >
            <Package className="w-6 h-6 mb-3 opacity-80" />
            <p className="text-2xl font-bold">{loading ? "â€”" : formatCurrency(productData.stockValue)}</p>
            <p className="text-violet-200 text-sm mt-1">Store Value</p>
            <p className="text-violet-300 text-xs mt-2 flex items-center gap-1">
              {loading ? "â€”" : productData.totalProducts} products Â· {loading ? "â€”" : productData.lowStockCount} low stock <ArrowRight className="w-3 h-3" />
            </p>
          </div>
        </Link>

        <Link href="/expenses">
          <div
            className="rounded-xl p-5 text-blue-900 cursor-pointer hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)" }}
          >
            <TrendingDown className="w-6 h-6 mb-3 opacity-80" />
            <p className="text-2xl font-bold">{loading ? "â€”" : formatCurrency(expenseData.total)}</p>
            <p className="text-red-200 text-sm mt-1">Total Expenses</p>
            <p className="text-red-300 text-xs mt-2 flex items-center gap-1">View Expenses <ArrowRight className="w-3 h-3" /></p>
          </div>
        </Link>
      </div>

      {/* â”€â”€ Secondary Metric Cards â”€â”€ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-green-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Net Balance</p>
              <Wallet className="w-4 h-4 text-purple-600" />
            </div>
            <p className={`text-xl font-bold ${financeData.balance >= 0 ? "text-purple-700" : "text-red-600"}`}>
              {loading ? "â€”" : formatCurrency(financeData.balance)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Income minus expenses</p>
          </CardContent>
        </Card>

        <Card className="border-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Trader Udhar</p>
              <BookOpen className="w-4 h-4 text-orange-500" />
            </div>
            <p className={`text-xl font-bold ${customerData.outstanding > 0 ? "text-orange-600" : "text-gray-500"}`}>
              {loading ? "â€”" : formatCurrency(customerData.outstanding)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Total outstanding balance</p>
          </CardContent>
        </Card>

        <Card className="border-violet-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Products Sold</p>
              <TrendingUp className="w-4 h-4 text-violet-600" />
            </div>
            <p className="text-xl font-bold text-violet-700">
              {loading ? "â€”" : formatCurrency(productData.totalSaleAmount)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Total sale amount (all time)</p>
          </CardContent>
        </Card>

        <Card className={productData.lowStockCount > 0 ? "border-red-200 bg-red-50/30" : "border-blue-300"}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className={`text-xs font-medium uppercase tracking-wide ${productData.lowStockCount > 0 ? "text-red-500" : "text-gray-500"}`}>
                Low Stock
              </p>
              <AlertTriangle className={`w-4 h-4 ${productData.lowStockCount > 0 ? "text-red-500" : "text-gray-400"}`} />
            </div>
            <p className={`text-xl font-bold ${productData.lowStockCount > 0 ? "text-red-600" : "text-gray-500"}`}>
              {loading ? "â€”" : productData.lowStockCount} items
            </p>
            <Link href="/reports/products" className="text-xs text-red-500 hover:underline mt-1 block">
              View product report â†’
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* â”€â”€ Charts Row â”€â”€ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Monthly Sales Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `â‚¨${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                <Bar dataKey="sales" fill="#15803d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={financeChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  dataKey="value"
                  label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {financeChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {financeChartData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                  <span className="text-gray-600">{d.name}</span>
                </div>
              ))}
            </div>

            {/* Expense category breakdown */}
            {expenseData.topCategories.length > 0 && (
              <div className="mt-4 space-y-2 border-t pt-4">
                <p className="text-xs font-semibold text-gray-600 mb-2">Top Expense Categories</p>
                {expenseData.topCategories.map((cat: any, i: number) => {
                  const pct = expenseData.total > 0 ? (cat._sum.amount / expenseData.total) * 100 : 0
                  return (
                    <div key={cat.category} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[i] }} />
                      <p className="text-xs text-gray-500 w-20 truncate">{cat.category}</p>
                      <div className="flex-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CATEGORY_COLORS[i] }} />
                      </div>
                      <p className="text-xs font-medium text-gray-700 w-20 text-right">{formatCurrency(cat._sum.amount)}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* â”€â”€ Report Navigation Cards â”€â”€ */}
      <div>
        <h3 className="text-base font-semibold text-gray-700 mb-3">Detailed Reports</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleReportCards.map(({ href, title, description, icon: Icon, color }) => (
            <Link key={href} href={href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer border border-blue-300 group">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-blue-900" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm group-hover:text-purple-700 transition-colors">{title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-purple-600 transition-colors flex-shrink-0 mt-0.5" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

