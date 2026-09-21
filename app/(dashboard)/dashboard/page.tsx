import { db } from "@/lib/db"
import { auth } from "@/auth"
import { formatCurrency } from "@/lib/utils"
import { ShoppingCart, TrendingUp, Users, Wheat, ArrowUpRight, ArrowDownRight, Clock, CheckSquare, Sparkles, Database } from "lucide-react"
import Link from "next/link"
import { ShopDataActions } from "@/components/shop-data-actions"
import { getT } from "@/lib/i18n-server"

function initials(name?: string | null) {
  if (!name) return "—"
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || name[0].toUpperCase()
}

const shortDate = (dt: string | Date) =>
  new Date(dt).toLocaleDateString("en-PK", { day: "numeric", month: "short" })

async function getDashboardData(shopId: string | null) {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startYesterday = new Date(startOfDay); startYesterday.setDate(startYesterday.getDate() - 1)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const sevenDaysAgo = new Date(startOfDay); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const shopFilter = shopId ? { shopId } : {}
  const active = { status: { not: "CANCELLED" as const } }

  const [
    todayAgg, yesterdayAgg, monthAgg, lastMonthAgg,
    totalCustomers, totalFarmers,
    last7, salesAgg, recentSales, taskList,
  ] = await Promise.all([
    db.sale.aggregate({ where: { ...shopFilter, ...active, createdAt: { gte: startOfDay } }, _sum: { totalAmount: true } }),
    db.sale.aggregate({ where: { ...shopFilter, ...active, createdAt: { gte: startYesterday, lt: startOfDay } }, _sum: { totalAmount: true } }),
    db.sale.aggregate({ where: { ...shopFilter, ...active, createdAt: { gte: startOfMonth } }, _sum: { totalAmount: true } }),
    db.sale.aggregate({ where: { ...shopFilter, ...active, createdAt: { gte: startLastMonth, lt: startOfMonth } }, _sum: { totalAmount: true } }),
    db.customer.count({ where: { ...shopFilter, isActive: true } }),
    db.farmer.count({ where: { ...shopFilter, isActive: true } }),
    db.sale.findMany({ where: { ...shopFilter, ...active, createdAt: { gte: sevenDaysAgo } }, select: { createdAt: true, totalAmount: true } }),
    db.sale.aggregate({ where: { ...shopFilter, ...active }, _sum: { totalAmount: true, paidAmount: true } }),
    db.sale.findMany({ take: 6, where: shopFilter, orderBy: { createdAt: "desc" }, include: { customer: { select: { name: true } } } }),
    db.task.findMany({ where: { ...shopFilter, status: { in: ["PENDING", "IN_PROGRESS"] } }, take: 5, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }], include: { assignedTo: { select: { name: true } } } }),
  ])

  const days: { label: string; total: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const dd = new Date(startOfDay); dd.setDate(dd.getDate() - i)
    days.push({ label: dd.toLocaleDateString("en-US", { weekday: "short" }), total: 0 })
  }
  for (const s of last7) {
    const sd = new Date(s.createdAt)
    const sDay = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate())
    const diff = Math.round((startOfDay.getTime() - sDay.getTime()) / 86400000)
    const idx = 6 - diff
    if (idx >= 0 && idx <= 6) days[idx].total += s.totalAmount
  }

  return {
    today: todayAgg._sum.totalAmount || 0,
    yesterday: yesterdayAgg._sum.totalAmount || 0,
    month: monthAgg._sum.totalAmount || 0,
    lastMonth: lastMonthAgg._sum.totalAmount || 0,
    totalCustomers, totalFarmers,
    days,
    totalSales: salesAgg._sum.totalAmount || 0,
    collected: salesAgg._sum.paidAmount || 0,
    recentSales, taskList,
  }
}

function delta(curr: number, prev: number) {
  if (prev <= 0) return curr > 0 ? 100 : 0
  return ((curr - prev) / prev) * 100
}

// Sample dataset shown by default so the dashboard looks populated.
// Owners flip to their real figures with the header toggle (?data=real).
const DEMO = {
  today: 45200, todayDelta: 12.5,
  month: 842000, monthDelta: 8.3,
  traders: 128, farmers: 84,
  days: [
    { label: "Mon", total: 32000 }, { label: "Tue", total: 41000 }, { label: "Wed", total: 38500 },
    { label: "Thu", total: 52000 }, { label: "Fri", total: 47000 }, { label: "Sat", total: 61000 }, { label: "Sun", total: 45200 },
  ],
  collected: 681000, total: 842000,
  tasks: [
    { title: "Weigh incoming wheat lot", who: "Weighing Operator", priority: "HIGH", due: "Today" },
    { title: "Settle payment to farmer Bashir", who: "Cashier", priority: "URGENT", due: "Today" },
    { title: "Verify godown stock count", who: "Godown Manager", priority: "MEDIUM", due: "Tomorrow" },
    { title: "Follow up trader Khan balance", who: "Manager", priority: "MEDIUM", due: "14 Sep" },
    { title: "Update today's market rates", who: "Admin", priority: "LOW", due: "15 Sep" },
  ],
  sales: [
    { name: "Trader Khan", status: "PAID", date: "Today", amount: 52250 },
    { name: "Al-Karam Traders", status: "PARTIAL", date: "Today", amount: 18400 },
    { name: "Sindh Flour Mills", status: "PAID", date: "Yesterday", amount: 96300 },
    { name: "Rehman & Sons", status: "PENDING", date: "Yesterday", amount: 12750 },
    { name: "Punjab Grains", status: "PAID", date: "11 Sep", amount: 41000 },
    { name: "Walk-in customer", status: "PAID", date: "11 Sep", amount: 7600 },
  ],
}

const CARD = "rounded-2xl bg-white border border-gray-200 p-5"
const STATUS_STYLE: Record<string, string> = {
  PAID: "bg-brand-50 text-brand-700",
  PARTIAL: "bg-amber-50 text-amber-700",
  PENDING: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-50 text-red-700",
}
const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-red-500", HIGH: "bg-amber-500", MEDIUM: "bg-brand-500", LOW: "bg-gray-300",
}

function Spark({ series }: { series: number[] }) {
  const max = Math.max(...series, 1)
  return (
    <div className="flex items-end gap-[3px] h-8">
      {series.map((v, i) => (
        <div
          key={i}
          className="w-1.5 rounded-sm bg-brand-500/70 origin-bottom animate-grow-y"
          style={{ height: `${Math.max((v / max) * 100, 6)}%`, animationDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  )
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const session = await auth()
  const shopId = session?.user?.shopId ?? null
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"
  const isCashier = session?.user?.role === "CASHIER"
  const d = await getDashboardData(shopId)

  // Sample data is shown by default; ?data=real reveals this shop's real figures.
  const sp = await searchParams
  const showReal = sp?.data === "real"
  const demo = !showReal
  const { t } = await getT()

  const daysVM = demo ? DEMO.days : d.days
  const series = daysVM.map((x) => x.total)
  const maxDay = Math.max(...series, 1)
  const today = demo ? DEMO.today : d.today
  const month = demo ? DEMO.month : d.month
  const traders = demo ? DEMO.traders : d.totalCustomers
  const farmers = demo ? DEMO.farmers : d.totalFarmers
  const todayDelta = demo ? DEMO.todayDelta : delta(d.today, d.yesterday)
  const monthDelta = demo ? DEMO.monthDelta : delta(d.month, d.lastMonth)
  const collected = demo ? DEMO.collected : d.collected
  const totalSales = demo ? DEMO.total : d.totalSales
  const collectionRate = totalSales > 0 ? (collected / totalSales) * 100 : 0
  const outstanding = totalSales - collected

  const tasksVM = demo ? DEMO.tasks : d.taskList.map((t) => ({ title: t.title, who: t.assignedTo?.name || "Unassigned", priority: t.priority, due: t.dueDate ? shortDate(t.dueDate) : "—" }))
  const salesVM = demo ? DEMO.sales : d.recentSales.map((s: any) => ({ name: s.customer?.name || "Walk-in customer", status: s.status, date: shortDate(s.createdAt), amount: s.totalAmount }))

  const stats = [
    { title: t("Today's Sales"), value: formatCurrency(today), icon: ShoppingCart, href: "/sales", d: todayDelta, spark: true },
    { title: t("This Month"), value: formatCurrency(month), icon: TrendingUp, href: "/sales", d: monthDelta, spark: true },
    { title: t("Total Traders"), value: String(traders), icon: Users, href: "/customers", d: null, spark: false },
    { title: t("Total Farmers"), value: String(farmers), icon: Wheat, href: "/farmers", d: null, spark: false },
  ]
  const shown = isCashier ? stats.slice(0, 2) : stats

  const R = 46, C = 2 * Math.PI * R
  const dash = (collectionRate / 100) * C

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap animate-fade-up">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            {t("Welcome back")}, {session?.user?.name?.split(" ")[0]}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isSuperAdmin ? t("Platform overview across all shops.") : isCashier ? t("Sales dashboard — process and track transactions.") : `${t("Overview for")} ${session?.user?.shopName || t("your shop")}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ShopDataActions />
          {demo ? (
            <Link
              href="/dashboard?data=real"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Database className="w-3.5 h-3.5" />
              {t("Show Original Shop Data")}
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t("Show Sample Data")}
            </Link>
          )}
        </div>
      </div>
      {demo && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-800 animate-fade-up">
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
          {t("Showing sample data — click \"Show Original Shop Data\" to see your real figures.")}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {shown.map((s, i) => {
          const up = (s.d ?? 0) >= 0
          return (
            <Link
              key={s.title}
              href={s.href}
              className={`${CARD} group block hover:border-gray-300 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200 animate-fade-up`}
              style={{ animationDelay: `${60 + i * 50}ms` }}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-gray-500 text-xs font-medium">{s.title}</span>
                {s.spark ? (
                  <Spark series={series} />
                ) : (
                  <span className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-brand-50 flex items-center justify-center transition-colors">
                    <s.icon className="w-4 h-4 text-gray-500 group-hover:text-brand-600 transition-colors" />
                  </span>
                )}
              </div>
              <div className="mt-3">
                <div>
                  <p className="text-2xl font-semibold text-gray-900 tabular-nums leading-tight break-words">{s.value}</p>
                  {s.d !== null && (
                    <span className={`inline-flex items-center gap-0.5 mt-2 text-xs font-medium rounded-md px-1.5 py-0.5 ${up ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-700"}`}>
                      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {Math.abs(s.d).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {!isCashier && (
        <>
          {/* Sales chart + collection gauge */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={`${CARD} lg:col-span-2 animate-fade-up`} style={{ animationDelay: "260ms" }}>
              <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">{t("Sales — Last 7 Days")}</h2>
                  <p className="text-gray-500 text-xs mt-0.5">{t("Daily total")}</p>
                </div>
                <span className="text-lg font-semibold text-gray-900 tabular-nums">{formatCurrency(series.reduce((a, b) => a + b, 0))}</span>
              </div>
              <div className="flex items-end justify-between gap-2 sm:gap-3 h-44 flex-wrap">
                {daysVM.map((day, i) => (
                  <div key={i} className="group flex-1 flex flex-col items-center gap-2 h-full justify-end min-w-0">
                    <span className="text-[10px] font-medium text-gray-500 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {formatCurrency(day.total)}
                    </span>
                    <div
                      className={`w-full max-w-[40px] rounded-lg origin-bottom animate-grow-y transition-colors ${i === daysVM.length - 1 ? "bg-brand-500" : "bg-brand-100 group-hover:bg-brand-300"}`}
                      style={{ height: `${Math.max((day.total / maxDay) * 80, 3)}%`, animationDelay: `${300 + i * 50}ms` }}
                      title={formatCurrency(day.total)}
                    />
                    <span className="text-[11px] text-gray-500">{day.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Collection gauge */}
            <div className={`${CARD} animate-fade-up`} style={{ animationDelay: "320ms" }}>
              <h2 className="text-sm font-semibold text-gray-900">{t("Collections")}</h2>
              <p className="text-gray-500 text-xs mt-0.5">{t("Paid vs outstanding")}</p>
              <div className="flex items-center justify-center my-5">
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-gray-100)" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r={R} fill="none" stroke="var(--color-brand-500)" strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={`${dash} ${C}`}
                      className="animate-draw-ring"
                      style={{ ["--ring-len" as string]: `${C}` }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-semibold text-gray-900 tabular-nums">{collectionRate.toFixed(0)}%</span>
                    <span className="text-[10px] text-gray-500">{t("collected")}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-sm flex-wrap">
                  <span className="flex items-center gap-2 text-gray-500"><span className="w-2 h-2 rounded-full bg-brand-500" /> {t("Collected")}</span>
                  <span className="text-gray-900 font-medium tabular-nums">{formatCurrency(collected)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm flex-wrap">
                  <span className="flex items-center gap-2 text-gray-500"><span className="w-2 h-2 rounded-full bg-gray-200" /> {t("Outstanding")}</span>
                  <span className="text-gray-900 font-medium tabular-nums">{formatCurrency(outstanding)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tasks + recent sales */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={`${CARD} animate-fade-up`} style={{ animationDelay: "380ms" }}>
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><CheckSquare className="w-4 h-4 text-gray-400" /> {t("Pending Tasks")}</h2>
                <Link href="/tasks" className="text-xs font-medium text-brand-700 hover:text-brand-800">{t("View all")}</Link>
              </div>
              <div className="divide-y divide-gray-100">
                {tasksVM.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">{t("No pending tasks.")}</p>
                ) : tasksVM.map((task, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] || "bg-gray-300"}`} title={task.priority} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 truncate">{task.title}</p>
                      <p className="text-xs text-gray-500 truncate">{task.who}</p>
                    </div>
                    <span className="text-xs text-gray-500 flex items-center gap-1 flex-shrink-0">
                      <Clock className="w-3 h-3" />{task.due}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${CARD} animate-fade-up`} style={{ animationDelay: "430ms" }}>
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-gray-900">{t("Recent Sales")}</h2>
                <Link href="/sales" className="text-xs font-medium text-brand-700 hover:text-brand-800">{t("View all")}</Link>
              </div>
              <div className="divide-y divide-gray-100">
                {salesVM.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">{t("No sales recorded yet.")}</p>
                ) : salesVM.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
                      {initials(s.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 truncate">{s.name}</p>
                      <p className="text-xs text-gray-500">{s.date}</p>
                    </div>
                    <span className={`hidden sm:inline text-[10px] font-medium rounded-md px-1.5 py-0.5 ${STATUS_STYLE[s.status] || "bg-gray-100 text-gray-600"}`}>{s.status}</span>
                    <span className="text-sm font-medium text-gray-900 tabular-nums flex-shrink-0">{formatCurrency(s.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
