"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Store, Mail, Phone, MapPin, Users, ShoppingCart, Package,
  Edit2, Lock, Check, X, Eye, EyeOff, UserCheck, UserX, Shield,
  CheckCircle, RefreshCw, Ban,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getRoleColor } from "@/lib/utils"

type User = {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
}

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
  users: User[]
  _count: { sales: number; customers: number; products: number }
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-300",
  APPROVED: "bg-green-100 text-green-800 border-green-300",
  REJECTED: "bg-red-100 text-red-800 border-red-300",
}

type EditState = {
  userId: string
  field: "name" | "password"
  value: string
  confirm?: string
  showPw?: boolean
}

export default function ShopDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string; userId?: string } | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function fetchShop() {
    setLoading(true)
    const res = await fetch(`/api/shops/${id}`)
    const data = await res.json()
    setShop(data.shop)
    setLoading(false)
  }

  useEffect(() => { fetchShop() }, [id])

  async function saveEdit() {
    if (!edit) return
    setSaving(true)
    setMsg(null)

    if (edit.field === "password") {
      if (!edit.value || edit.value.length < 6) {
        setMsg({ type: "error", text: "Password must be at least 6 characters.", userId: edit.userId })
        setSaving(false)
        return
      }
      if (edit.value !== edit.confirm) {
        setMsg({ type: "error", text: "Passwords do not match.", userId: edit.userId })
        setSaving(false)
        return
      }
    }

    const body: any = {}
    if (edit.field === "name") body.name = edit.value
    if (edit.field === "password") body.password = edit.value

    // Preserve existing values
    const existing = shop?.users.find((u) => u.id === edit.userId)
    if (existing) {
      body.name = body.name ?? existing.name
      body.role = existing.role
      body.isActive = existing.isActive
    }

    const res = await fetch(`/api/users/${edit.userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSaving(false)

    if (res.ok) {
      const label = edit.field === "name" ? "Name" : "Password"
      setMsg({ type: "success", text: `${label} updated successfully.`, userId: edit.userId })
      setEdit(null)
      // Update local state
      setShop((s) => s ? {
        ...s,
        users: s.users.map((u) => u.id === edit.userId ? { ...u, ...data.user } : u),
      } : s)
    } else {
      setMsg({ type: "error", text: data.error || "Failed to update.", userId: edit.userId })
    }
  }

  async function toggleActive(user: User) {
    setActionLoading(user.id + "toggle")
    const body = { name: user.name, role: user.role, isActive: !user.isActive }
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setActionLoading(null)
    if (res.ok) {
      setShop((s) => s ? {
        ...s,
        users: s.users.map((u) => u.id === user.id ? { ...u, isActive: !user.isActive } : u),
      } : s)
    }
  }

  async function doShopAction(action: string) {
    setActionLoading("shop" + action)
    await fetch(`/api/shops/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    setActionLoading(null)
    fetchShop()
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
  if (!shop) return <div className="text-center py-12 text-gray-400">Shop not found.</div>

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/shops")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Shops
        </button>
      </div>

      {/* Shop Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
              <Store className="w-7 h-7 text-green-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{shop.name}</h1>
              <p className="text-gray-500 text-sm">Owner: {shop.ownerName}</p>
              <span className={`mt-1 inline-block text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[shop.status]}`}>
                {shop.status}
              </span>
            </div>
          </div>

          {/* Shop actions */}
          <div className="flex gap-2 flex-wrap">
            {shop.status === "PENDING" && (
              <>
                <Button size="sm" className="bg-green-700 hover:bg-green-800 gap-1 text-xs" disabled={!!actionLoading} onClick={() => doShopAction("approve")}>
                  <CheckCircle className="w-3.5 h-3.5" /> {actionLoading === "shopapprove" ? "..." : "Approve"}
                </Button>
                <Button size="sm" variant="destructive" className="gap-1 text-xs" disabled={!!actionLoading} onClick={() => doShopAction("reject")}>
                  <X className="w-3.5 h-3.5" /> {actionLoading === "shopreject" ? "..." : "Reject"}
                </Button>
              </>
            )}
            {shop.status === "APPROVED" && shop.isActive && (
              <Button size="sm" variant="outline" className="gap-1 text-xs text-orange-600 border-orange-300" disabled={!!actionLoading} onClick={() => doShopAction("suspend")}>
                <Ban className="w-3.5 h-3.5" /> {actionLoading === "shopsuspend" ? "..." : "Suspend"}
              </Button>
            )}
            {(!shop.isActive && shop.status !== "PENDING") && (
              <Button size="sm" variant="outline" className="gap-1 text-xs text-green-700 border-green-300" disabled={!!actionLoading} onClick={() => doShopAction("reactivate")}>
                <RefreshCw className="w-3.5 h-3.5" /> {actionLoading === "shopreactivate" ? "..." : "Reactivate"}
              </Button>
            )}
          </div>
        </div>

        {/* Shop details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm text-gray-600 mb-5">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="truncate">{shop.email}</span>
          </div>
          {shop.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <span>{shop.phone}</span>
            </div>
          )}
          {shop.city && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span>{shop.city}</span>
            </div>
          )}
          <div className="text-xs text-gray-400">
            Registered: {new Date(shop.createdAt).toLocaleDateString("en-PK")}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-2">
            <ShoppingCart className="w-4 h-4 text-green-500" />
            <span><strong>{shop._count.sales}</strong> Sales</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-2">
            <Users className="w-4 h-4 text-blue-500" />
            <span><strong>{shop._count.customers}</strong> Customers</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-2">
            <Package className="w-4 h-4 text-purple-500" />
            <span><strong>{shop._count.products}</strong> Products</span>
          </div>
        </div>
      </div>

      {/* Users Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-600" />
          <h2 className="font-semibold text-gray-800">Shop Users ({shop.users.length})</h2>
        </div>

        {shop.users.length === 0 ? (
          <div className="text-center py-10 text-gray-400">No users found for this shop.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {shop.users.map((user) => (
              <div key={user.id} className="px-6 py-5">
                {/* User header row */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-green-800 font-bold text-sm">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getRoleColor(user.role)}`}>
                      {user.role}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${user.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* Success/error message for this user */}
                {msg?.userId === user.id && (
                  <div className={`mb-3 flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg ${
                    msg.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                  }`}>
                    {msg.type === "success" && <Check className="w-4 h-4 flex-shrink-0" />}
                    {msg.text}
                  </div>
                )}

                {/* Edit name form */}
                {edit?.userId === user.id && edit.field === "name" && (
                  <div className="mb-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <Label className="text-xs font-semibold text-blue-700 mb-2 block">Edit Display Name</Label>
                    <div className="flex gap-2">
                      <Input
                        value={edit.value}
                        onChange={(e) => setEdit({ ...edit, value: e.target.value })}
                        className="flex-1 bg-white text-sm"
                        placeholder="Enter new name"
                        autoFocus
                      />
                      <Button size="sm" onClick={saveEdit} disabled={saving} className="bg-blue-600 hover:bg-blue-700 gap-1">
                        <Check className="w-3.5 h-3.5" /> {saving ? "..." : "Save"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEdit(null); setMsg(null) }}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Reset password form */}
                {edit?.userId === user.id && edit.field === "password" && (
                  <div className="mb-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <Label className="text-xs font-semibold text-orange-700 mb-2 block">
                      Set New Password for {user.name}
                    </Label>
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          type={edit.showPw ? "text" : "password"}
                          value={edit.value}
                          onChange={(e) => setEdit({ ...edit, value: e.target.value })}
                          className="bg-white text-sm pr-10"
                          placeholder="New password (min 6 chars)"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setEdit({ ...edit, showPw: !edit.showPw })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {edit.showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <Input
                        type="password"
                        value={edit.confirm || ""}
                        onChange={(e) => setEdit({ ...edit, confirm: e.target.value })}
                        className="bg-white text-sm"
                        placeholder="Confirm new password"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit} disabled={saving} className="bg-orange-600 hover:bg-orange-700 gap-1">
                          <Lock className="w-3.5 h-3.5" /> {saving ? "..." : "Set Password"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEdit(null); setMsg(null) }}>
                          <X className="w-3.5 h-3.5" /> Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                {edit?.userId !== user.id && (
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => { setEdit({ userId: user.id, field: "name", value: user.name }); setMsg(null) }}
                    >
                      <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                      Edit Name
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => { setEdit({ userId: user.id, field: "password", value: "", confirm: "" }); setMsg(null) }}
                    >
                      <Lock className="w-3.5 h-3.5 text-orange-500" />
                      Reset Password
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`gap-1.5 text-xs ${user.isActive ? "text-red-600 border-red-200 hover:bg-red-50" : "text-green-700 border-green-200 hover:bg-green-50"}`}
                      disabled={actionLoading === user.id + "toggle"}
                      onClick={() => toggleActive(user)}
                    >
                      {user.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                      {actionLoading === user.id + "toggle" ? "..." : user.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
