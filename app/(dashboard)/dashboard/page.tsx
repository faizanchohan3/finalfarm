mport { db } from "@/lib/db"
import { auth } from "@/auth"
import { formatCurrency } from "@/lib/utils"
import { TrendingUp, ShoppingCart, Package, Users, CheckSquare, Sprout, AlertTriangle, Store, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { RecentSales } from "@/components/dashboard/recent-sales"
import { SalesChart } from "@/components/dashboard/sales-chart"
import { TasksSummary } from "@/components/dashboard/tasks-summary"
import { StatsSlider } from "@/components/dashboard/stats-slider"
import Link from "next/link"

async function getDashboardData(shopId: string | null) {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // SUPER_ADMIN sees all data; shop users see only their shop's data
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
      // Only for super admin
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

  // CASHIER: Only show Sales, Month Sales (for reports), and Traders (for transactions)
  // ADMIN: Show all stats
  const allStats = [
    { title: "Today's Sales", value: formatCurrency(data.todaySales), icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50", href: "/sales", role: "all" },
    { title: "Month Sales", value: formatCurrency(data.monthSales), icon: TrendingUp, color: "text-purple-600", bg: "bg-green-50", href: "/sales", role: "all" },
    { title: "Total Products", value: data.totalProducts.toString(), icon: Package, color: "text-purple-600", bg: "bg-purple-50", href: "/inventory", role: "admin" },
    { title: "Total Traders", value: data.totalCustomers.toString(), icon: Users, color: "text-orange-600", bg: "bg-orange-50", href: "/customers", role: "admin" },
    { title: "Pending Notes", value: data.pendingTasks.toString(), icon: CheckSquare, color: "text-blue-600", bg: "bg-blue-50", href: "/tasks", role: "admin" },
    {
      title: "Pesticide Alerts",
      value: data.expiredPesticides.toString(),
      icon: Sprout,
      color: data.expiredPesticides > 0 ? "text-red-600" : "text-teal-600",
      bg: data.expiredPesticides > 0 ? "bg-red-50" : "bg-teal-50",
      href: "/pesticides",
      role: "admin",
    },
  ]

  // Filter stats based on role
  const stats = isCashier
    ? allStats.filter(s => s.role === "all")
    : allStats

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome back, {session?.user?.name?.split(" ")[0]}
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          {isSuperAdmin
            ? "Platform overview â€” all shops combined."
            : isCashier
            ? "Sales & Transaction Dashboard â€” Process transactions and view quick reports."
            : `Here's what's happening at ${session?.user?.shopName || "your shop"} today.`}
        </p>
      </div>

      {/* Super Admin: pending shops alert */}
      {isSuperAdmin && data.pendingShops > 0 && (
        <Link href="/shops">
          <div className="bg-blue-50 border border-blue-300 rounded-xl px-5 py-4 flex items-center gap-3 hover:bg-blue-100 transition-colors cursor-pointer">
            <Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-blue-800 font-semibold text-sm">
                {data.pendingShops} shop{data.pendingShops > 1 ? "s" : ""} pending approval
              </p>
              <p className="text-blue-700 text-xs mt-0.5">Click to review and approve shop registrations</p>
            </div>
            <span className="bg-blue-500 text-blue-900 text-sm font-bold px-3 py-1 rounded-full">
              {data.pendingShops}
            </span>
          </div>
        </Link>
      )}

      {/* Super Admin: total shops stat */}
      {isSuperAdmin && (
        <Link href="/shops">
          <div className="bg-purple-700 text-blue-900 rounded-xl px-5 py-4 flex items-center gap-4 hover:bg-purple-800 transition-colors cursor-pointer">
            <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Store className="w-6 h-6 text-blue-900" />
            </div>
            <div className="flex-1">
              <p className="text-purple-200 text-xs font-medium uppercase tracking-wider">Platform Head</p>
              <p className="text-blue-900 font-bold text-lg">Manage All Shops</p>
              <p className="text-purple-300 text-xs">Approve registrations, suspend or reactivate shops</p>
            </div>
            <span className="text-purple-300 text-sm">View â†’</span>
          </div>
        </Link>
      )}

      {/* Critical Stock Alert - Admin only */}
      {!isCashier && data.criticalStockProducts.length > 0 && (
        <Link href="/inventory">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 hover:bg-red-100 transition-colors cursor-pointer">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-semibold text-sm">
                Critical Stock Alert â€” {data.criticalStockProducts.length} product{data.criticalStockProducts.length > 1 ? "s" : ""} almost out of stock!
              </p>
              <p className="text-red-600 text-xs mt-0.5">
                {data.criticalStockProducts.map((p) => `${p.name} (${p.currentStock} ${p.unit})`).join(" Â· ")}
              </p>
            </div>
          </div>
        </Link>
      )}

      {/* Stats Slider */}
      <StatsSlider
        todaySales={data.todaySales}
        monthSales={data.monthSales}
        totalProducts={data.totalProducts}
        pendingTasks={data.pendingTasks}
        totalCustomers={data.totalCustomers}
        expiredPesticides={data.expiredPesticides}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer hover:border-gray-300">
              <CardContent className="p-4">
                <div className={`inline-flex p-2 rounded-lg ${stat.bg} mb-3`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.title}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Charts and Summaries - Admin only */}
      {!isCashier && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SalesChart />
            </div>
            <div>
              <TasksSummary />
            </div>
          </div>

          <RecentSales sales={data.recentSales} />
        </>
      )}
    </div>
  )
}

