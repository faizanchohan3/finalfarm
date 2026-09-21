"use client"

import { useEffect, useState } from "react"
import { Store, CheckCircle, XCircle, Clock, Users, ShoppingCart, Package, Phone, MapPin, Mail, RefreshCw, Ban, ChevronRight, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import Link from "next/link"

type Shop = {
  id: string
  name: string
  ownerName: string
  phone: string | null
  address: string | null
  city: string | null
  email: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  isActive: boolean
  createdAt: string
  _count: { users: number; sales: number; customers: number }
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-blue-100 text-blue-800 border-blue-300",
  APPROVED: "bg-green-100 text-purple-800 border-green-300",
  REJECTED: "bg-red-100 text-red-800 border-red-300",
}

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("ALL")
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selected, setSelected] = useState<Shop | null>(null)

  // Reset-password dialog state
  const [resetShop, setResetShop] = useState<Shop | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetDone, setResetDone] = useState<string | null>(null)

  async function fetchShops() {
    setLoading(true)
    const url = filter !== "ALL" ? `/api/shops?status=${filter}` : "/api/shops"
    const res = await fetch(url)
    const data = await res.json()
    setShops(data.shops || [])
    setLoading(false)
  }

  useEffect(() => { fetchShops() }, [filter])

  async function doAction(shopId: string, action: string) {
    setActionLoading(shopId + action)
    await fetch(`/api/shops/${shopId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    setActionLoading(null)
    setSelected(null)
    fetchShops()
  }

  function openReset(shop: Shop) {
    setResetShop(shop)
    setNewPassword("")
    setResetError(null)
    setResetDone(null)
  }

  async function submitReset() {
    if (!resetShop) return
    setResetLoading(true)
    setResetError(null)
    try {
      const res = await fetch(`/api/shops/${resetShop.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResetError(data.error || "Failed to reset password.")
      } else {
        setResetDone(data.email || resetShop.email)
      }
    } catch {
      setResetError("Network error. Please try again.")
    }
    setResetLoading(false)
  }

  const pending = shops.filter((s) => s.status === "PENDING").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shop Management</h1>
          <p className="text-sm text-gray-500 mt-1">Approve, manage and monitor all registered shops</p>
        </div>
        <Button variant="outline" onClick={fetchShops} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Pending alert */}
      {pending > 0 && (
        <div className="bg-blue-50 border border-blue-300 rounded-xl px-5 py-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <p className="text-blue-800 font-medium">
            {pending} shop{pending > 1 ? "s" : ""} pending approval — review and approve below.
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex overflow-x-auto overflow-y-hidden [scrollbar-width:none] whitespace-nowrap gap-2 border-b border-blue-300 pb-0">
        {["ALL", "PENDING", "APPROVED", "REJECTED"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              filter === f
                ? "border-purple-700 text-purple-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {f === "ALL" ? "All Shops" : f.charAt(0) + f.slice(1).toLowerCase()}
            {f === "PENDING" && pending > 0 && (
              <span className="ml-2 bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5">{pending}</span>
            )}
          </button>
        ))}
      </div>

      {/* Shop list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading shops...</div>
      ) : shops.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No shops found.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shops.map((shop) => (
            <div key={shop.id} className="bg-blue-50 rounded-xl border border-blue-300 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Store className="w-5 h-5 text-purple-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 leading-tight">{shop.name}</h3>
                    <p className="text-xs text-gray-500">{shop.ownerName}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full border ${STATUS_COLORS[shop.status]}`}>
                  {shop.status}
                </span>
              </div>

              <div className="space-y-1 mb-4 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  <span>{shop.email}</span>
                </div>
                {shop.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{shop.phone}</span>
                  </div>
                )}
                {shop.city && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{shop.city}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 text-xs text-gray-600 mb-4 bg-blue-50 rounded-lg p-3">
                <div className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-blue-500" />
                  <span>{shop._count.users} users</span>
                </div>
                <div className="flex items-center gap-1">
                  <ShoppingCart className="w-3.5 h-3.5 text-green-500" />
                  <span>{shop._count.sales} sales</span>
                </div>
                <div className="flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-purple-500" />
                  <span>{shop._count.customers} customers</span>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {shop.status === "PENDING" && (
                  <>
                    <Button
                      size="sm"
                      className="flex-1 bg-purple-700 hover:bg-purple-800 text-xs gap-1"
                      disabled={!!actionLoading}
                      onClick={() => doAction(shop.id, "approve")}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {actionLoading === shop.id + "approve" ? "..." : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 text-xs gap-1"
                      disabled={!!actionLoading}
                      onClick={() => doAction(shop.id, "reject")}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {actionLoading === shop.id + "reject" ? "..." : "Reject"}
                    </Button>
                  </>
                )}
                {shop.status === "APPROVED" && shop.isActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs gap-1 text-orange-600 border-orange-300 hover:bg-orange-50"
                    disabled={!!actionLoading}
                    onClick={() => doAction(shop.id, "suspend")}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    {actionLoading === shop.id + "suspend" ? "..." : "Suspend"}
                  </Button>
                )}
                {(shop.status === "REJECTED" || !shop.isActive) && shop.status !== "PENDING" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs gap-1 text-purple-700 border-green-300 hover:bg-green-50"
                    disabled={!!actionLoading}
                    onClick={() => doAction(shop.id, "reactivate")}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {actionLoading === shop.id + "reactivate" ? "..." : "Reactivate"}
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
                <button
                  onClick={() => openReset(shop)}
                  className="flex items-center gap-1 text-xs text-orange-600 font-medium hover:text-orange-800 hover:underline"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Reset Password
                </button>
                <Link
                  href={`/shops/${shop.id}`}
                  className="flex items-center gap-1 text-xs text-purple-700 font-medium hover:text-purple-900 hover:underline"
                >
                  <Users className="w-3.5 h-3.5" />
                  Manage Users
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Registered: {new Date(shop.createdAt).toLocaleDateString("en-PK")}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Reset password dialog */}
      <Dialog open={!!resetShop} onOpenChange={(o) => !o && setResetShop(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <KeyRound className="w-5 h-5 text-orange-600" />
              Reset Owner Password
            </DialogTitle>
            <DialogDescription>
              {resetShop && (
                <>Set a new login password for <b>{resetShop.name}</b>&apos;s owner account
                (<span className="text-gray-700">{resetShop.email}</span>).</>
              )}
            </DialogDescription>
          </DialogHeader>

          {resetDone ? (
            <div className="rounded-lg bg-green-50 border border-green-300 px-4 py-3 text-sm text-green-800">
              <CheckCircle className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              Password updated. The owner (<b>{resetDone}</b>) can now log in with the new password.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">New password</label>
                <Input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoFocus
                />
              </div>
              {resetError && (
                <p className="text-sm text-red-600">{resetError}</p>
              )}
              <p className="text-xs text-gray-400">
                Share the new password with the shop owner. They can change it later from their profile.
              </p>
            </div>
          )}

          <DialogFooter>
            {resetDone ? (
              <Button onClick={() => setResetShop(null)}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setResetShop(null)} disabled={resetLoading}>
                  Cancel
                </Button>
                <Button
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={submitReset}
                  disabled={resetLoading || newPassword.length < 6}
                >
                  {resetLoading ? "Resetting..." : "Reset Password"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

