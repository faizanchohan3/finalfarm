"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { User, Mail, Shield, Lock, Save, Eye, EyeOff, CheckCircle, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getRoleColor } from "@/lib/utils"

type Profile = {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  shopId: string | null
}

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Profile form
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Password form
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        setProfile(d.user)
        setName(d.user?.name || "")
      })
      .finally(() => setLoading(false))
  }, [])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setProfileMsg(null)
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setProfileMsg({ type: "success", text: "Name updated successfully." })
      setProfile((p) => p ? { ...p, name: data.user.name } : p)
      // Refresh session so header reflects new name
      await update({ name: data.user.name })
    } else {
      setProfileMsg({ type: "error", text: data.error || "Failed to update." })
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg(null)
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: "error", text: "New passwords do not match." })
      return
    }
    if (newPassword.length < 6) {
      setPwMsg({ type: "error", text: "Password must be at least 6 characters." })
      return
    }
    setPwSaving(true)
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, currentPassword, newPassword }),
    })
    const data = await res.json()
    setPwSaving(false)
    if (res.ok) {
      setPwMsg({ type: "success", text: "Password changed successfully." })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } else {
      setPwMsg({ type: "error", text: data.error || "Failed to change password." })
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
        <p className="text-sm text-gray-500 mt-1">View and update your account details</p>
      </div>

      {/* Account Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-green-700 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{profile?.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getRoleColor(profile?.role || "")}`}>
                {profile?.role?.replace("_", " ")}
              </span>
              {profile?.shopId === null && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-purple-100 text-purple-800">
                  Platform Head
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 mb-6 bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-500 w-20">Email</span>
            <span className="font-medium text-gray-800">{profile?.email}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Shield className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-500 w-20">Role</span>
            <span className="font-medium text-gray-800">{profile?.role?.replace("_", " ")}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-500 w-20">Joined</span>
            <span className="font-medium text-gray-800">
              {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" }) : "—"}
            </span>
          </div>
        </div>

        {/* Edit Name */}
        <form onSubmit={saveProfile} className="space-y-4">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wider text-gray-500">Edit Name</h3>
          <div className="space-y-1">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>

          {profileMsg && (
            <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg ${
              profileMsg.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {profileMsg.type === "success" && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
              {profileMsg.text}
            </div>
          )}

          <Button type="submit" disabled={saving} className="bg-green-700 hover:bg-green-800 gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Name"}
          </Button>
        </form>
      </div>

      {/* Change Password Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Lock className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-800">Change Password</h3>
        </div>

        <form onSubmit={savePassword} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="currentPw">Current Password</Label>
            <div className="relative">
              <Input
                id="currentPw"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="newPw">New Password</Label>
            <div className="relative">
              <Input
                id="newPw"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirmPw">Confirm New Password</Label>
            <Input
              id="confirmPw"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              required
            />
          </div>

          {pwMsg && (
            <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg ${
              pwMsg.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {pwMsg.type === "success" && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
              {pwMsg.text}
            </div>
          )}

          <Button type="submit" disabled={pwSaving} variant="outline" className="gap-2 border-green-300 text-green-700 hover:bg-green-50">
            <Lock className="w-4 h-4" />
            {pwSaving ? "Updating..." : "Change Password"}
          </Button>
        </form>
      </div>
    </div>
  )
}
