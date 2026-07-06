"use client"

import { signOut } from "next-auth/react"
import { useSession } from "next-auth/react"
import { Bell, LogOut, User, Store, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getRoleColor } from "@/lib/utils"
import { useEffect, useState, useRef } from "react"
import Link from "next/link"

export function Header({ title }: { title: string }) {
  const { data: session } = useSession()
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
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
        {!isSuperAdmin && session?.user?.shopName && (
          <span className="hidden sm:inline text-xs bg-green-100 text-green-800 px-2.5 py-1 rounded-full font-medium border border-green-200">
            <Store className="w-3 h-3 inline mr-1" />
            {session.user.shopName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Pending shops bell for super admin */}
        {isSuperAdmin ? (
          <Link href="/shops" className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <Bell className="w-5 h-5" />
            {pendingShops > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {pendingShops}
              </span>
            )}
          </Link>
        ) : (
          <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <Bell className="w-5 h-5" />
          </button>
        )}

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-3 hover:bg-gray-100 rounded-lg px-2 py-1.5 transition-colors"
          >
            <div className="w-8 h-8 bg-green-700 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-gray-800 leading-tight">{session?.user?.name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRoleColor(session?.user?.role || "")}`}>
                {session?.user?.role?.replace("_", " ")}
              </span>
            </div>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500">Signed in as</p>
                <p className="text-sm font-semibold text-gray-800 truncate">{session?.user?.email}</p>
              </div>
              <div className="py-1">
                <Link
                  href="/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                  My Profile & Password
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
