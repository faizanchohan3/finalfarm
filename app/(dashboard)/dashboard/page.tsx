import { db } from "@/lib/db"
import { auth } from "@/auth"
import { formatCurrency } from "@/lib/utils"
import { ShoppingCart, TrendingUp, Users, Wheat, ArrowUpRight, ArrowDownRight, Clock, CheckSquare, Sparkles } from "lucide-react"
import Link from "next/link"

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

// Sample dataset shown for a brand-new shop that has no activity yet.
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

const CARD = "rounded-2xl bg-[#1a1a27] border border-white/[0.06] p-5"
const STATUS_DOT: Record<string, string> = {
  PAID: "bg-emerald-400", PARTIAL: "bg-amber-400", PENDING: "bg-slate-500", CANCELLED: "bg-rose-400",
}

function Spark({ series }: { series: number[] }) {
  const max = Math.max(...series, 1)
  return (
    <div className="flex items-end gap-[3px] h-9">
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

  // No real activity yet → show a full sample dashboard (clearly badged).
  const demo = d.totalSales === 0 && d.recentSales.length === 0 && d.taskList.length === 0

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
    { title: "Today's Sales", value: formatCurrency(today), icon: ShoppingCart, href: "/sales", d: todayDelta, spark: true },
    { title: "This Month", value: formatCurrency(month), icon: TrendingUp, href: "/sales", d: monthDelta, spark: true },
    { title: "Total Traders", value: String(traders), icon: Users, href: "/customers", d: null, spark: false },
    { title: "Total Farmers", value: String(farmers), icon: Wheat, href: "/farmers", d: null, spark: false },
  ]
  const shown = isCashier ? stats.slice(0, 2) : stats

  const R = 46, C = 2 * Math.PI * R
  const dash = (collectionRate / 100) * C

  return (
    <div className="-m-6 p-5 sm:p-6 bg-[#0f0f17] min-h-[calc(100vh-4rem)] text-slate-200">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {session?.user?.name?.split(" ")[0]}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isSuperAdmin ? "Platform overview across all shops." : isCashier ? "Sales dashboard — process and track transactions." : `Overview for ${session?.user?.shopName || "your shop"}`}
          </p>
        </div>
        {demo && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-200 bg-violet-500/15 border border-violet-500/30 rounded-full px-3 py-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Sample data — your figures appear here as you record sales
          </span>
        )}
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
                  <p className="text-slate-500 text-xs mt-0.5">Daily total</p>
                </div>
                <span className="text-lg font-bold text-white tabular-nums">{formatCurrency(series.reduce((a, b) => a + b, 0))}</span>
              </div>
              <div className="flex items-end justify-between gap-3 h-40">
                {daysVM.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <div className="w-full max-w-[36px] rounded-md bg-gradient-to-t from-violet-600 to-violet-400" style={{ height: `${Math.max((day.total / maxDay) * 100, 3)}%` }} title={formatCurrency(day.total)} />
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
                  <span className="text-white font-medium tabular-nums">{formatCurrency(collected)}</span>
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
              <div className="space-y-3">
                {tasksVM.map((t, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-violet-500/15 text-violet-200 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {initials(t.who)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-100 truncate">{t.title}</p>
                      <p className="text-xs text-slate-500 truncate">{t.who} · {t.priority}</p>
                    </div>
                    <span className="text-xs text-slate-500 flex items-center gap-1 flex-shrink-0">
                      <Clock className="w-3 h-3" />{t.due}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className={CARD}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold">Recent Sales</h2>
                <Link href="/sales" className="text-xs text-violet-300 hover:text-violet-200">View all</Link>
              </div>
              <div className="space-y-3">
                {salesVM.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-700/40 text-slate-200 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {initials(s.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-100 truncate">{s.name}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s.status] || "bg-slate-500"}`} />
                        {s.status} · {s.date}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-white tabular-nums flex-shrink-0">{formatCurrency(s.amount)}</span>
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
