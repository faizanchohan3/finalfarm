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
  Scale, UserCircle, Building2, BookOpen,
} from "lucide-react"
import { useState, useEffect } from "react"

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  hasChildren?: true
}

const allReportSubItems = [
  { href: "/reports", label: "Overview" },
  { href: "/reports/balance-sheet", label: "Balance Sheet & P&L" },
  { href: "/reports/sales", label: "Sales Report" },
  { href: "/reports/pesticide-sales", label: "Pesticide Sales" },
  { href: "/reports/customers", label: "Trader Report" },
  { href: "/reports/products", label: "Product Report" },
  { href: "/reports/customer-ledger", label: "Trader Ledger" },
  { href: "/reports/all-farmers", label: "All Farmers" },
  { href: "/reports/farmer-ledger", label: "Farmer Ledger" },
  { href: "/reports/all-suppliers", label: "All Suppliers" },
  { href: "/reports/supplier-ledger", label: "Supplier Ledger" },
  { href: "/reports/all-traders", label: "All Traders" },
  { href: "/reports/bank-transactions", label: "Bank Transactions" },
]

const cashierReportSubItems = [
  { href: "/reports/sales", label: "Sales Report" },
  { href: "/reports/purchases", label: "Purchase Report" },
  { href: "/reports/all-farmers", label: "All Farmers" },
  { href: "/reports/all-traders", label: "All Traders" },
  { href: "/reports/all-suppliers", label: "All Suppliers" },
]

const shopNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Store", icon: Package },
  { href: "/customers", label: "Traders", icon: UserCheck },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/purchases", label: "Purchases", icon: ShoppingBag },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
  { href: "/finance", label: "Roznamcha", icon: Wallet },
  { href: "/banks", label: "Banks", icon: Building2 },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/warehouse", label: "Godowns", icon: Warehouse },
  { href: "/gate", label: "Gate / Weighbridge", icon: Scale },
  { href: "/tasks", label: "Notes", icon: CheckSquare },
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
  const [collapsed, setCollapsed] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [shopLogo, setShopLogo] = useState<string | null>(null)
  const [liveShopName, setLiveShopName] = useState<string | null>(null)
  const [shopModules, setShopModules] = useState({
    moduleGodown: false, moduleGate: false, moduleTransport: false,
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

    // Module-based filtering
    if (item.href === "/warehouse")  return shopModules.moduleGodown
    if (item.href === "/gate")       return shopModules.moduleGate
    if (item.href === "/transport")  return shopModules.moduleTransport
    return true
  })

  useEffect(() => {
    if (pathname.startsWith("/reports")) setReportsOpen(true)
  }, [pathname])

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
            })
          }
        })
        .catch(() => {})
    }
  }, [isSuperAdmin, session?.user?.shopId])

  return (
    <aside
      className={cn(
        "relative flex flex-col bg-blue-900 text-white transition-all duration-300 h-screen overflow-hidden border-r border-blue-400",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-blue-400 flex-shrink-0">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-blue-400">
          {shopLogo ? (
            <img src={shopLogo} alt="Shop Logo" className="w-full h-full object-cover" />
          ) : (
            <Store className="w-5 h-5 text-blue-900" />
          )}
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-bold text-sm leading-tight truncate">
              {isSuperAdmin ? "Argo-Firn" : (shopName || "Argo-Firn")}
            </p>
            <p className="text-white text-xs">
              {isSuperAdmin ? "Platform Head" : "Shop Management"}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const { href, label, icon: Icon, hasChildren } = item
          const active =
            pathname === href ||
            (href !== "/dashboard" && href !== "/" && pathname.startsWith(href))

          if (hasChildren) {
            return (
              <div key={href}>
                <div
                  className={cn(
                    "flex items-center rounded-lg transition-colors",
                    active ? "bg-yellow-400" : "hover:bg-white"
                  )}
                >
                  <Link
                    href={href}
                    className="flex items-center gap-3 px-3 py-2.5 flex-1 text-sm font-medium"
                  >
                    <Icon className={cn("w-5 h-5 flex-shrink-0", active ? "text-white" : "text-gray-900")} />
                    {!collapsed && <span className={active ? "text-white" : "text-gray-900"}>{label}</span>}
                  </Link>
                  {!collapsed && (
                    <button
                      onClick={() => setReportsOpen((o) => !o)}
                      className={cn("pr-3 py-2.5 transition-colors", active ? "text-white" : "text-gray-900")}
                      aria-label="Toggle reports menu"
                    >
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-300",
                          reportsOpen ? "rotate-180" : "rotate-0"
                        )}
                      />
                    </button>
                  )}
                </div>

                {!collapsed && (
                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-300 ease-in-out",
                      reportsOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    )}
                  >
                    <div className="ml-4 mt-1 border-l-2 border-blue-300 pl-3 pb-1 space-y-0.5">
                      {reportSubItems.map((sub) => {
                        const subActive = pathname === sub.href
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={cn(
                              "flex items-center py-1.5 px-2 rounded text-xs font-medium transition-colors",
                              subActive
                                ? "bg-blue-100 text-blue-300"
                                : "text-white hover:bg-blue-100 hover:text-blue-900"
                            )}
                          >
                            {sub.label}
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
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active ? "bg-yellow-400 text-white" : "text-green-100 hover:bg-white hover:text-gray-900"
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-blue-100 border border-blue-300 rounded-full flex items-center justify-center hover:bg-blue-100 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3 text-blue-900" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-blue-900" />
        )}
      </button>
    </aside>
  )
}

