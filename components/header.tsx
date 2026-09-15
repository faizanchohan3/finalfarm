"use client"

import { signOut } from "next-auth/react"
import { useSession } from "next-auth/react"
import { Bell, LogOut, User, Store, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getRoleColor } from "@/lib/utils"
import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { useLang } from "@/lib/i18n"

export function Header({ title }: { title: string }) {
  const { data: session } = useSession()
  const { t } = useLang()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"
  const [pendingShops, setPendingShops] = useState(0)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    if (!isSuperAdmin) return
    fetch("/api/shops?status=PENDING")
      .then((r) => r.json())
      .then((d) => setPendingShops(d.shops?.length || 0))
      .catch(() => {})
  }, [isSuperAdmin])

  return (
    <header className="h-16 bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600 flex items-center justify-between px-6 flex-shrink-0 shadow-md">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        {!isSuperAdmin && session?.user?.shopName && (
          <span className="hidden sm:inline text-xs bg-white/15 text-white px-2.5 py-1 rounded-full font-medium border border-white/25">
            <Store className="w-3 h-3 inline mr-1" />
            {session.user.shopName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Pending shops bell for super admin */}
        {isSuperAdmin ? (
          <Link href="/shops" className="relative p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <Bell className="w-5 h-5" />
            {pendingShops > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {pendingShops}
              </span>
            )}
          </Link>
        ) : (
          <button className="relative p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <Bell className="w-5 h-5" />
          </button>
        )}

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-3 hover:bg-white/10 rounded-lg px-2 py-1.5 transition-colors"
          >
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-white leading-tight">{session?.user?.name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRoleColor(session?.user?.role || "")}`}>
                {session?.user?.role?.replace("_", " ")}
              </span>
            </div>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-blue-50 border border-blue-300 rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-blue-300 bg-blue-50">
                <p className="text-xs text-gray-500">{t("Signed in as")}</p>
                <p className="text-sm font-semibold text-gray-800 truncate">{session?.user?.email}</p>
              </div>
              <div className="py-1">
                <Link
                  href="/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                  {t("My Profile & Password")}
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  {t("Sign Out")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

