"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, Package, ShoppingCart, ShoppingBag,
  Wallet, BarChart3, ClipboardList, Users, Settings,
  ChevronLeft, ChevronRight, Store, CheckSquare, UserCheck,
  Truck, ChevronDown, Receipt, Warehouse,
  Scale, UserCircle, Building2, BookOpen, Zap, Boxes,
  TrendingUp, PieChart, DollarSign, ShoppingCart as CartIcon, FileText,
  CreditCard, Building, Banknote, Tag, ImageUp,
} from "lucide-react"
import { useState, useEffect } from "react"
import { useLang } from "@/lib/i18n"
import { LanguageToggle } from "@/components/language-toggle"

const MillIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5 text-white">
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.3" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    <line x1="12" y1="4" x2="12" y2="7" />
    <line x1="12" y1="17" x2="12" y2="20" />
    <line x1="4" y1="12" x2="7" y2="12" />
    <line x1="17" y1="12" x2="20" y2="12" />
  </svg>
)

type ModuleKey = "moduleGodown" | "moduleGate" | "moduleTransport" | "moduleFarmers" | "moduleCommission" | "modulePesticides" | "moduleLots" | "moduleAgents"

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  hasChildren?: true
  module?: ModuleKey
}

const allReportSubItems = [
  { href: "/reports", label: "Overview", icon: BarChart3, color: "text-blue-600", bgColor: "bg-blue-50" },
  { href: "/reports/balance-sheet", label: "Balance Sheet & P&L", icon: FileText, color: "text-purple-600", bgColor: "bg-purple-50" },
  { href: "/reports/sales", label: "Sales Report", icon: TrendingUp, color: "text-green-600", bgColor: "bg-green-50" },
  { href: "/reports/customers", label: "Trader Report", icon: Users, color: "text-orange-600", bgColor: "bg-orange-50" },
  { href: "/reports/products", label: "Product Report", icon: Package, color: "text-pink-600", bgColor: "bg-pink-50" },
  { href: "/reports/customer-ledger", label: "Trader Ledger", icon: CreditCard, color: "text-red-600", bgColor: "bg-red-50" },
  { href: "/reports/all-suppliers", label: "All Suppliers", icon: Truck, color: "text-cyan-600", bgColor: "bg-cyan-50" },
  { href: "/reports/supplier-ledger", label: "Supplier Ledger", icon: ClipboardList, color: "text-indigo-600", bgColor: "bg-indigo-50" },
  { href: "/reports/all-traders", label: "All Traders", icon: Store, color: "text-amber-600", bgColor: "bg-amber-50" },
  { href: "/reports/bank-transactions", label: "Bank Transactions", icon: Banknote, color: "text-teal-600", bgColor: "bg-teal-50" },
  { href: "/markha-report", label: "Markha Report", icon: Tag, color: "text-purple-600", bgColor: "bg-purple-50" },
]

const cashierReportSubItems = [
  { href: "/reports/sales", label: "Sales Report", icon: TrendingUp, color: "text-green-600", bgColor: "bg-green-50" },
  { href: "/reports/purchases", label: "Purchase Report", icon: ShoppingBag, color: "text-blue-600", bgColor: "bg-blue-50" },
  { href: "/reports/all-traders", label: "All Traders", icon: Store, color: "text-amber-600", bgColor: "bg-amber-50" },
  { href: "/reports/all-suppliers", label: "All Suppliers", icon: Truck, color: "text-cyan-600", bgColor: "bg-cyan-50" },
]

const shopNavItems: NavItem[] = [
  { href: "/bill-maker", label: "Bill Maker", icon: FileText },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Store", icon: Package },
  { href: "/lots", label: "Potato Store", icon: Boxes, module: "moduleLots" },
  { href: "/markha", label: "Markha", icon: Tag, module: "moduleLots" },
  { href: "/customers", label: "Traders", icon: UserCheck },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/farmers", label: "Farmers", icon: UserCheck, module: "moduleFarmers" },
  { href: "/commission", label: "Commission (Aadat)", icon: DollarSign, module: "moduleCommission" },
  { href: "/agents", label: "Agents", icon: UserCircle, module: "moduleAgents" },
  { href: "/purchases", label: "Purchases", icon: ShoppingBag },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
  { href: "/pesticides", label: "Pesticides", icon: Zap, module: "modulePesticides" },
  { href: "/finance", label: "Roznamcha", icon: Wallet },
  { href: "/banks", label: "Banks", icon: Building2 },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/warehouse", label: "Godowns", icon: Warehouse, module: "moduleGodown" },
  { href: "/gate", label: "Gate / Weighbridge", icon: Scale, module: "moduleGate" },
  { href: "/transport", label: "Transport", icon: Truck, module: "moduleTransport" },
  { href: "/tasks", label: "Notes", icon: CheckSquare },
  { href: "/upload", label: "Upload Data", icon: ImageUp },
  { href: "/reports", label: "Reports", icon: BarChart3, hasChildren: true },
  { href: "/audit", label: "Audit Log", icon: ClipboardList },
  { href: "/users", label: "Users", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
]

// Super admin only sees shops management + their profile
const superAdminNavItems: NavItem[] = [
  { href: "/shops", label: "All Shops", icon: Store },
  { href: "/profile", label: "My Profile", icon: UserCircle },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { t } = useLang()
  const [collapsed, setCollapsed] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [shopLogo, setShopLogo] = useState<string | null>(null)
  const [liveShopName, setLiveShopName] = useState<string | null>(null)
  const [shopModules, setShopModules] = useState<Record<ModuleKey, boolean>>({
    moduleGodown: false, moduleGate: false, moduleTransport: false,
    moduleFarmers: true, moduleCommission: true, modulePesticides: false,
    moduleLots: true, moduleAgents: true,
  })

  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"
  const isCashier = session?.user?.role === "CASHIER"
  const shopName = liveShopName ?? session?.user?.shopName

  const reportSubItems = isCashier ? cashierReportSubItems : allReportSubItems

  const navItems = isSuperAdmin ? superAdminNavItems : shopNavItems.filter((item) => {
    // CASHIER role restrictions
    if (isCashier) {
      const allowedPaths = ["/dashboard", "/sales", "/purchases", "/transport", "/reports"]
      if (!allowedPaths.includes(item.href)) return false
    }

    // Module-based filtering — hide any item whose module toggle is off
    if (item.module && !shopModules[item.module]) return false
    return true
  })

  useEffect(() => {
    if (pathname.startsWith("/reports")) setReportsOpen(true)
  }, [pathname])

  // Start collapsed on narrow screens so content keeps the room
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const apply = () => { if (mq.matches) setCollapsed(true) }
    queueMicrotask(apply)
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  // Warm up Neon DB connection so the first click isn't slow
  useEffect(() => { fetch("/api/ping").catch(() => {}) }, [])

  useEffect(() => {
    if (!isSuperAdmin && session?.user?.shopId) {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((d) => {
          if (d.shop?.logo) setShopLogo(d.shop.logo)
          if (d.shop?.name) setLiveShopName(d.shop.name)
          if (d.shop) {
            setShopModules({
              moduleGodown:     !!d.shop.moduleGodown,
              moduleGate:       !!d.shop.moduleGate,
              moduleTransport:  !!d.shop.moduleTransport,
              moduleFarmers:    d.shop.moduleFarmers !== false,
              moduleCommission: d.shop.moduleCommission !== false,
              modulePesticides: !!d.shop.modulePesticides,
              moduleLots:       d.shop.moduleLots !== false,
              moduleAgents:     d.shop.moduleAgents !== false,
            })
          }
        })
        .catch(() => {})
    }
  }, [isSuperAdmin, session?.user?.shopId])

  return (
    <aside
      className={cn(
        "relative flex flex-col bg-gray-50 border-r border-gray-200 text-gray-700 transition-[width] duration-300 ease-out h-screen overflow-hidden",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 flex-shrink-0 border-b border-gray-200">
        <div className={cn("flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center", !shopLogo && "bg-brand-600")}>
          {shopLogo ? (
            <img src={shopLogo} alt="Shop Logo" className="w-full h-full object-cover" />
          ) : (
            <MillIcon />
          )}
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-semibold text-sm leading-tight truncate text-gray-900">
              {isSuperAdmin ? "Argo-Firn" : (shopName || "Argo-Firn")}
            </p>
            <p className="text-gray-500 text-xs">
              {isSuperAdmin ? t("Platform Head") : t("Shop Management")}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const { href, label, icon: Icon, hasChildren } = item
          const active =
            pathname === href ||
            (href !== "/dashboard" && href !== "/" && pathname.startsWith(href))

          if (hasChildren) {
            return (
              <div
                key={href}
                onMouseEnter={() => setReportsOpen(true)}
                onMouseLeave={() => setReportsOpen(false)}
              >
                <div
                  className={cn(
                    "flex items-center rounded-md transition-colors group",
                    active ? "bg-white shadow-sm ring-1 ring-gray-200" : "hover:bg-gray-100"
                  )}
                >
                  <Link
                    href={href}
                    className="flex items-center gap-3 px-3 py-2 flex-1 text-sm font-medium"
                  >
                    <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-brand-600" : "text-gray-400 group-hover:text-gray-600")} />
                    {!collapsed && <span className={active ? "text-gray-900" : "text-gray-600 group-hover:text-gray-900"}>{t(label)}</span>}
                  </Link>
                  {!collapsed && (
                    <div
                      className="pr-3 py-2 text-gray-400"
                    >
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-300",
                          reportsOpen ? "rotate-180" : "rotate-0"
                        )}
                      />
                    </div>
                  )}
                </div>

                {!collapsed && (
                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-300 ease-in-out",
                      reportsOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    )}
                  >
                    <div className="ml-4 rtl:ml-0 rtl:mr-4 mt-1 border-l rtl:border-l-0 rtl:border-r border-gray-200 pl-3 rtl:pl-0 rtl:pr-3 pb-1 space-y-0.5">
                      {reportSubItems.map((sub: any) => {
                        const subActive = pathname === sub.href
                        const Icon = sub.icon
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={cn(
                              "flex items-center gap-2 py-1.5 px-2 rounded-md text-[13px] transition-colors",
                              subActive
                                ? "bg-white text-gray-900 font-medium shadow-sm ring-1 ring-gray-200"
                                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                            )}
                          >
                            {Icon && <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", subActive ? "text-brand-600" : "text-gray-400")} />}
                            {t(sub.label)}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          }

          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? t(label) : undefined}
              className={cn(
                "group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-brand-600" : "text-gray-400 group-hover:text-gray-600")} />
              {!collapsed && <span className="truncate">{t(label)}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer: language + collapse */}
      <div className={cn("px-2 py-3 border-t border-gray-200 flex-shrink-0 flex gap-2", collapsed ? "flex-col items-center" : "items-center")}>
        <div className={collapsed ? "" : "flex-1 min-w-0"}>
          <LanguageToggle collapsed={collapsed} />
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="w-10 h-10 flex-shrink-0 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4 rtl:rotate-180" /> : <ChevronLeft className="w-4 h-4 rtl:rotate-180" />}
        </button>
      </div>

    </aside>
  )
}

