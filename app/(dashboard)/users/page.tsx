"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDate, getRoleColor } from "@/lib/utils"
import { Plus, Edit, UserX, Shield, User } from "lucide-react"

const ROLES = ["ADMIN", "MANAGER", "CASHIER", "AUDITOR"]

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "CASHIER", isActive: true })

  async function loadData() {
    try {
      setLoading(true)
      const data = await fetch("/api/users").then((r) => r.json())
      setUsers(data.users || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  function openAdd() {
    setEditing(null)
    setForm({ name: "", email: "", password: "", role: "CASHIER", isActive: true })
    setShowModal(true)
  }

  function openEdit(u: any) {
    setEditing(u)
    setForm({ name: u.name, email: u.email, password: "", role: u.role, isActive: u.isActive })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name || !form.email) return alert("Name and email required")
    if (!editing && !form.password) return alert("Password required for new user")

    const url = editing ? `/api/users/${editing.id}` : "/api/users"
    const method = editing ? "PUT" : "POST"
    const body: any = { name: form.name, role: form.role, isActive: form.isActive }
    if (!editing) { body.email = form.email; body.password = form.password }
    if (editing && form.password) body.password = form.password

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) { setShowModal(false); loadData() }
    else {
      const err = await res.json()
      alert(err.error || "Something went wrong")
    }
  }

  async function toggleActive(u: any) {
    if (!confirm(`${u.isActive ? "Deactivate" : "Activate"} ${u.name}?`)) return
    await fetch(`/api/users/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: u.name, role: u.role, isActive: !u.isActive }),
    })
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-500 text-sm">{users.filter((u) => u.isActive).length} active users</p>
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4" /> Add User</Button>
      </div>

      {/* Role Permission Guide */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
        <p className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-1.5"><Shield className="w-4 h-4" /> Role Permissions</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-blue-700">
          <div><span className="font-semibold">ADMIN</span> — Manage users & all modules</div>
          <div><span className="font-semibold">MANAGER</span> — Inventory, sales, purchases</div>
          <div><span className="font-semibold">CASHIER</span> — Sales only</div>
          <div><span className="font-semibold">AUDITOR</span> — View-only access</div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading && !users.length ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {["User", "Email", "Role", "Status", "Joined", "Actions"].map((h) => (
                      <th key={h} className="text-left py-3 px-3 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className={`border-b border-gray-50 hover:bg-gray-50 ${!u.isActive ? "opacity-50" : ""}`}>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                          <span className="font-medium text-gray-800">{u.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-600">{u.email}</td>
                      <td className="py-3 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRoleColor(u.role)}`}>
                          {u.role.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${u.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-500">{formatDate(u.createdAt)}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(u)} className="p-1 text-gray-400 hover:text-blue-600">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => toggleActive(u)} className="p-1 text-gray-400 hover:text-red-600" title={u.isActive ? "Deactivate" : "Activate"}>
                            <UserX className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User" : "Add New User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Full Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Muhammad Ali" /></div>
            {!editing && <div><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@galamandi.com" /></div>}
            <div>
              <Label>{editing ? "New Password (leave blank to keep)" : "Password *"}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {editing && (
              <div className="flex items-center gap-3">
                <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4" />
                <Label htmlFor="isActive">Active</Label>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} className="flex-1">{editing ? "Update" : "Create User"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
