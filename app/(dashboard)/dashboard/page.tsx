import { db } from "@/lib/db"
import { auth } from "@/auth"
import { formatCurrency } from "@/lib/utils"
import { TrendingUp, ShoppingCart, Package, Users, CheckSquare, ArrowUpRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RecentSales } from "@/components/dashboard/recent-sales"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { ProductDistribution } from "@/components/dashboard/product-distribution"
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


      {/* Charts and Summaries */}
      {!isCashier && (
        <>
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