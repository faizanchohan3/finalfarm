"use client"

import { useEffect, useState } from "react"
import { Store, CheckCircle, XCircle, Clock, Users, ShoppingCart, Package, Phone, MapPin, Mail, RefreshCw, Ban, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-300",
  APPROVED: "bg-green-100 text-green-800 border-green-300",
  REJECTED: "bg-red-100 text-red-800 border-red-300",
}

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("ALL")
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selected, setSelected] = useState<Shop | null>(null)

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

  const pending = shops.filter((s) => s.status === "PENDING").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-5 py-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-yellow-800 font-medium">
            {pending} shop{pending > 1 ? "s" : ""} pending approval — review and approve below.
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {["ALL", "PENDING", "APPROVED", "REJECTED"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              filter === f
                ? "border-green-700 text-green-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {f === "ALL" ? "All Shops" : f.charAt(0) + f.slice(1).toLowerCase()}
            {f === "PENDING" && pending > 0 && (
              <span className="ml-2 bg-yellow-500 text-white text-xs rounded-full px-1.5 py-0.5">{pending}</span>
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
            <div key={shop.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Store className="w-5 h-5 text-green-700" />
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

              <div className="flex gap-3 text-xs text-gray-600 mb-4 bg-gray-50 rounded-lg p-3">
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

              <div className="flex gap-2">
                {shop.status === "PENDING" && (
                  <>
                    <Button
                      size="sm"
                      className="flex-1 bg-green-700 hover:bg-green-800 text-xs gap-1"
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
                    className="flex-1 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                    disabled={!!actionLoading}
                    onClick={() => doAction(shop.id, "reactivate")}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {actionLoading === shop.id + "reactivate" ? "..." : "Reactivate"}
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-gray-400">
                  Registered: {new Date(shop.createdAt).toLocaleDateString("en-PK")}
                </p>
                <Link
                  href={`/shops/${shop.id}`}
                  className="flex items-center gap-1 text-xs text-green-700 font-medium hover:text-green-900 hover:underline"
                >
                  <Users className="w-3.5 h-3.5" />
                  Manage Users
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
