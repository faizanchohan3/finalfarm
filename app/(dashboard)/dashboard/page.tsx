import { db } from "@/lib/db"
import { auth } from "@/auth"
import { formatCurrency } from "@/lib/utils"
import { ShoppingCart, TrendingUp, Users, Wheat, ArrowUpRight, ArrowDownRight, Clock, CheckSquare } from "lucide-react"
import Link from "next/link"

function initials(name?: string | null) {
  if (!name) return "—"
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || name[0].toUpperCase()
}

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
    totalCustomers, totalFarmers, pendingTasks,
    last7, salesAgg, recentSales, taskList,
  ] = await Promise.all([
    db.sale.aggregate({ where: { ...shopFilter, ...active, createdAt: { gte: startOfDay } }, _sum: { totalAmount: true } }),
    db.sale.aggregate({ where: { ...shopFilter, ...active, createdAt: { gte: startYesterday, lt: startOfDay } }, _sum: { totalAmount: true } }),
    db.sale.aggregate({ where: { ...shopFilter, ...active, createdAt: { gte: startOfMonth } }, _sum: { totalAmount: true } }),
    db.sale.aggregate({ where: { ...shopFilter, ...active, createdAt: { gte: startLastMonth, lt: startOfMonth } }, _sum: { totalAmount: true } }),
    db.customer.count({ where: { ...shopFilter, isActive: true } }),
    db.farmer.count({ where: { ...shopFilter, isActive: true } }),
    db.task.count({ where: { ...shopFilter, status: { in: ["PENDING", "IN_PROGRESS"] } } }),
    db.sale.findMany({ where: { ...shopFilter, ...active, createdAt: { gte: sevenDaysAgo } }, select: { createdAt: true, totalAmount: true } }),
    db.sale.aggregate({ where: { ...shopFilter, ...active }, _sum: { totalAmount: true, paidAmount: true } }),
    db.sale.findMany({ take: 6, where: shopFilter, orderBy: { createdAt: "desc" }, include: { customer: { select: { name: true } } } }),
    db.task.findMany({ where: { ...shopFilter, status: { in: ["PENDING", "IN_PROGRESS"] } }, take: 5, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }], include: { assignedTo: { select: { name: true } } } }),
  ])

  // Build 7-day daily sales series
  const days: { label: string; total: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfDay); d.setDate(d.getDate() - i)
    days.push({ label: d.toLocaleDateString("en-US", { weekday: "short" }), total: 0 })
  }
  for (const s of last7) {
    const sd = new Date(s.createdAt)
    const sDay = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate())
    const diff = Math.round((startOfDay.getTime() - sDay.getTime()) / 86400000)
    const idx = 6 - diff
    if (idx >= 0 && idx <= 6) days[idx].total += s.totalAmount
  }

  const totalSales = salesAgg._sum.totalAmount || 0
  const collected = salesAgg._sum.paidAmount || 0

  return {
    today: todayAgg._sum.totalAmount || 0,
    yesterday: yesterdayAgg._sum.totalAmount || 0,
    month: monthAgg._sum.totalAmount || 0,
    lastMonth: lastMonthAgg._sum.totalAmount || 0,
    totalCustomers, totalFarmers, pendingTasks,
    days, totalSales, collected,
    recentSales, taskList,
  }
}

function delta(curr: number, prev: number) {
  if (prev <= 0) return curr > 0 ? 100 : 0
  return ((curr - prev) / prev) * 100
}

const CARD = "rounded-2xl bg-[#1a1a27] border border-white/[0.06] p-5"
const STATUS_DOT: Record<string, string> = {
  PAID: "bg-emerald-400", PARTIAL: "bg-amber-400", PENDING: "bg-slate-500", CANCELLED: "bg-rose-400",
}

function Spark({ series, className = "" }: { series: number[]; className?: string }) {
  const max = Math.max(...series, 1)
  return (
    <div className={`flex items-end gap-[3px] h-9 ${className}`}>
      {series.map((v, i) => (
        <div key={i} className="w-1.5 rounded-sm bg-gradient-to-t from-violet-600/40 to-violet-400" style={{ height: `${Math.max((v / max) * 100, 6)}%` }} />
      ))}
    </div>
  )
}

export default async function DashboardPage() {
  const session = await auth()
  const shopId = session?.user?.shopId ?? null
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"
  const isCashier = session?.user?.role === "CASHIER"
  const d = await getDashboardData(shopId)

  const series = d.days.map((x) => x.total)
  const maxDay = Math.max(...series, 1)
  const todayDelta = delta(d.today, d.yesterday)
  const monthDelta = delta(d.month, d.lastMonth)
  const collectionRate = d.totalSales > 0 ? (d.collected / d.totalSales) * 100 : 0
  const outstanding = d.totalSales - d.collected

  const stats = [
    { title: "Today's Sales", value: formatCurrency(d.today), icon: ShoppingCart, href: "/sales", d: todayDelta, spark: true },
    { title: "This Month", value: formatCurrency(d.month), icon: TrendingUp, href: "/sales", d: monthDelta, spark: true },
    { title: "Total Traders", value: String(d.totalCustomers), icon: Users, href: "/customers", d: null, spark: false },
    { title: "Total Farmers", value: String(d.totalFarmers), icon: Wheat, href: "/farmers", d: null, spark: false },
  ]
  const shown = isCashier ? stats.slice(0, 2) : stats

  // Gauge geometry (donut)
  const R = 46, C = 2 * Math.PI * R
  const dash = (collectionRate / 100) * C

  return (
    <div className="-m-6 p-5 sm:p-6 bg-[#0f0f17] min-h-[calc(100vh-4rem)] text-slate-200">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {session?.user?.name?.split(" ")[0]}
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {isSuperAdmin ? "Platform overview across all shops." : isCashier ? "Sales dashboard — process and track transactions." : `Overview for ${session?.user?.shopName || "your shop"}`}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {shown.map((s) => {
          const up = (s.d ?? 0) >= 0
          return (
            <Link key={s.title} href={s.href} className={`${CARD} block hover:border-violet-500/40 transition-colors`}>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs font-medium">{s.title}</span>
                <span className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
                  <s.icon className="w-4 h-4 text-violet-300" />
                </span>
              </div>
              <div className="mt-3 flex items-end justify-between gap-2">
                <div>
                  <p className="text-2xl font-bold text-white tabular-nums leading-none">{s.value}</p>
                  {s.d !== null && (
                    <span className={`inline-flex items-center gap-0.5 mt-2 text-xs font-semibold ${up ? "text-emerald-400" : "text-rose-400"}`}>
                      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {Math.abs(s.d).toFixed(1)}%
                    </span>
                  )}
                </div>
                {s.spark && <Spark series={series} />}
              </div>
            </Link>
          )
        })}
      </div>

      {!isCashier && (
        <>
          {/* Sales chart + collection gauge */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className={`${CARD} lg:col-span-2`}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-white font-semibold">Sales — Last 7 Days</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Daily total across {d.days.length} days</p>
                </div>
                <span className="text-lg font-bold text-white tabular-nums">{formatCurrency(series.reduce((a, b) => a + b, 0))}</span>
              </div>
              <div className="flex items-end justify-between gap-3 h-40">
                {d.days.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <div className="w-full max-w-[36px] rounded-md bg-gradient-to-t from-violet-600 to-violet-400 transition-all" style={{ height: `${Math.max((day.total / maxDay) * 100, 3)}%` }} title={formatCurrency(day.total)} />
                    <span className="text-[11px] text-slate-500">{day.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Collection gauge */}
            <div className={CARD}>
              <h2 className="text-white font-semibold mb-1">Collections</h2>
              <p className="text-slate-500 text-xs">Paid vs outstanding</p>
              <div className="flex items-center justify-center my-4">
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r={R} fill="none" stroke="#2a2a3a" strokeWidth="12" />
                    <circle cx="60" cy="60" r={R} fill="none" stroke="url(#g)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${dash} ${C}`} />
                    <defs>
                      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" />
                        <stop offset="100%" stopColor="#7c3aed" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-white tabular-nums">{collectionRate.toFixed(0)}%</span>
                    <span className="text-[10px] text-slate-500">collected</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-violet-400" /> Collected</span>
                  <span className="text-white font-medium tabular-nums">{formatCurrency(d.collected)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-[#2a2a3a]" /> Outstanding</span>
                  <span className="text-white font-medium tabular-nums">{formatCurrency(outstanding)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tasks + recent sales */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={CARD}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold flex items-center gap-2"><CheckSquare className="w-4 h-4 text-violet-300" /> Pending Tasks</h2>
                <Link href="/tasks" className="text-xs text-violet-300 hover:text-violet-200">View all</Link>
              </div>
              {d.taskList.length === 0 ? (
                <p className="text-slate-500 text-sm py-6 text-center">No pending tasks 🎉</p>
              ) : (
                <div className="space-y-3">
                  {d.taskList.map((t) => (
                    <div key={t.id} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-violet-500/15 text-violet-200 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {initials(t.assignedTo?.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-100 truncate">{t.title}</p>
                        <p className="text-xs text-slate-500 truncate">{t.assignedTo?.name || "Unassigned"} · {t.priority}</p>
                      </div>
                      <span className="text-xs text-slate-500 flex items-center gap-1 flex-shrink-0">
                        <Clock className="w-3 h-3" />{t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-PK", { day: "numeric", month: "short" }) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={CARD}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold">Recent Sales</h2>
                <Link href="/sales" className="text-xs text-violet-300 hover:text-violet-200">View all</Link>
              </div>
              {d.recentSales.length === 0 ? (
                <p className="text-slate-500 text-sm py-6 text-center">No sales yet.</p>
              ) : (
                <div className="space-y-3">
                  {d.recentSales.map((s: any) => (
                    <div key={s.id} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-700/40 text-slate-200 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {initials(s.customer?.name || "Walk-in")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-100 truncate">{s.customer?.name || "Walk-in customer"}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s.status] || "bg-slate-500"}`} />
                          {s.status} · {new Date(s.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-white tabular-nums flex-shrink-0">{formatCurrency(s.totalAmount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
