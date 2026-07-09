import { db } from "@/lib/db"
import { auth } from "@/auth"
import { formatCurrency } from "@/lib/utils"
import { TrendingUp, ShoppingCart, Package, Users, CheckSquare, AlertTriangle, Store, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RecentSales } from "@/components/dashboard/recent-sales"
import { SalesChart } from "@/components/dashboard/sales-chart"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { ProductDistribution } from "@/components/dashboard/product-distribution"
import { TasksSummary } from "@/components/dashboard/tasks-summary"
import { StatsSlider } from "@/components/dashboard/stats-slider"
import Link from "next/link"

async function getDashboardData(shopId: string | null) {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const shopFilter = shopId ? { shopId } : {}

  const [todaySales, monthSales, totalProducts, pendingTasks, totalCustomers, recentSales, expiredPesticides, criticalStockProducts, pendingShops] =
    await Promise.all([
      db.sale.aggregate({
        where: { ...shopFilter, createdAt: { gte: startOfDay }, status: { not: "CANCELLED" } },
        _sum: { totalAmount: true },
      }),
      db.sale.aggregate({
        where: { ...shopFilter, createdAt: { gte: startOfMonth }, status: { not: "CANCELLED" } },
        _sum: { totalAmount: true },
      }),
      db.product.count({ where: { ...shopFilter, isActive: true } }),
      db.task.count({ where: { ...shopFilter, status: { in: ["PENDING", "IN_PROGRESS"] } } }),
      db.customer.count({ where: { ...shopFilter, isActive: true } }),
      db.sale.findMany({
        take: 5,
        where: shopFilter,
        orderBy: { createdAt: "desc" },
        include: { customer: true, createdBy: { select: { name: true } } },
      }),
      db.pesticide.count({
        where: {
          ...shopFilter,
          expiryDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
          isActive: true,
        },
      }),
      db.product.findMany({
        where: { ...shopFilter, isActive: true, currentStock: { lte: 2 } },
        select: { name: true, currentStock: true, unit: true },
        orderBy: { currentStock: "asc" },
      }),
      shopId === null
        ? db.shop.count({ where: { status: "PENDING" } })
        : Promise.resolve(0),
    ])

  return {
    todaySales: todaySales._sum.totalAmount || 0,
    monthSales: monthSales._sum.totalAmount || 0,
    totalProducts,
    pendingTasks,
    totalCustomers,
    recentSales,
    expiredPesticides,
    criticalStockProducts,
    pendingShops: pendingShops as number,
  }
}

export default async function DashboardPage() {
  const session = await auth()
  const shopId = session?.user?.shopId ?? null
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"
  const isCashier = session?.user?.role === "CASHIER"
  const data = await getDashboardData(shopId)

  const allStats = [
    { title: "Today's Sales", value: formatCurrency(data.todaySales), icon: ShoppingCart, color: "from-blue-600 to-blue-700", trend: "+12%", href: "/sales", role: "all" },
    { title: "Month Sales", value: formatCurrency(data.monthSales), icon: TrendingUp, color: "from-purple-600 to-purple-700", trend: "+8%", href: "/sales", role: "all" },
    { title: "Total Products", value: data.totalProducts.toString(), icon: Package, color: "from-emerald-600 to-emerald-700", trend: "+5%", href: "/inventory", role: "admin" },
    { title: "Total Traders", value: data.totalCustomers.toString(), icon: Users, color: "from-orange-600 to-orange-700", trend: "+3%", href: "/customers", role: "admin" },
    { title: "Pending Notes", value: data.pendingTasks.toString(), icon: CheckSquare, color: "from-rose-600 to-rose-700", trend: "2", href: "/tasks", role: "admin" },
  ]

  const stats = isCashier ? allStats.filter(s => s.role === "all") : allStats

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Welcome back, {session?.user?.name?.split(" ")[0]}
            </h1>
            <p className="text-gray-600 text-sm mt-2">
              {isSuperAdmin
                ? "Platform overview – manage all shops and operations."
                : isCashier
                ? "Sales Dashboard – Process transactions and view analytics."
                : `Dashboard for ${session?.user?.shopName || "your shop"}`}
            </p>
          </div>
        </div>
      </div>

      {/* Alert Sections */}
      {isSuperAdmin && data.pendingShops > 0 && (
        <Link href="/shops">
          <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100 hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-200 rounded-lg">
                  <Clock className="w-6 h-6 text-blue-700" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900">
                    {data.pendingShops} shop{data.pendingShops > 1 ? "s" : ""} pending approval
                  </h3>
                  <p className="text-sm text-blue-700 mt-1">Click to review and approve registrations</p>
                </div>
                <span className="bg-blue-600 text-white px-4 py-2 rounded-full font-semibold text-sm">
                  {data.pendingShops}
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {isSuperAdmin && (
        <Link href="/shops">
          <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-purple-100 hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-200 rounded-lg">
                  <Store className="w-6 h-6 text-purple-700" />
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Platform Head</h4>
                  <h3 className="font-semibold text-purple-900 text-lg">Manage All Shops</h3>
                  <p className="text-sm text-purple-700 mt-1">Approve registrations and manage operations</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {!isCashier && data.criticalStockProducts.length > 0 && (
        <Link href="/inventory">
          <Card className="border-red-200 bg-gradient-to-r from-red-50 to-red-100 hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-200 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-700" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900">
                    Critical Stock Alert – {data.criticalStockProducts.length} product{data.criticalStockProducts.length > 1 ? "s" : ""} low on stock
                  </h3>
                  <p className="text-sm text-red-700 mt-1">
                    {data.criticalStockProducts.slice(0, 3).map((p) => `${p.name}`).join(" • ")}
                    {data.criticalStockProducts.length > 3 && ` and ${data.criticalStockProducts.length - 3} more`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer h-full border-0">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 bg-gradient-to-br ${stat.color} rounded-lg`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-green-600">
                    <ArrowUpRight className="w-3 h-3" />
                    {stat.trend}
                  </div>
                </div>
                <h3 className="text-gray-600 text-sm font-medium mb-2">{stat.title}</h3>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Stats Slider */}
      <StatsSlider
        todaySales={data.todaySales}
        monthSales={data.monthSales}
        totalProducts={data.totalProducts}
        pendingTasks={data.pendingTasks}
        totalCustomers={data.totalCustomers}
        expiredPesticides={data.expiredPesticides}
      />

      {/* Charts and Summaries */}
      {!isCashier && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Sales Trend (Last 6 Months)</CardTitle>
                </CardHeader>
                <CardContent>
                  <SalesChart />
                </CardContent>
              </Card>
            </div>
            <div>
              <TasksSummary />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Revenue vs Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <RevenueChart />
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Product Distribution</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ProductDistribution />
              </CardContent>
            </Card>
          </div>

          <div>
            <RecentSales sales={data.recentSales} />
          </div>
        </>
      )}
    </div>
  )
}