"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Building2, Plus, PencilLine, Trash2 } from "lucide-react"

const DEFAULT_FORM = { name: "", accountNumber: "" }

export default function BanksPage() {
  const [banks, setBanks] = useState<any[]>([])
  const [firstLoad, setFirstLoad] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  async function loadData() {
    try {
      const data = await fetch("/api/banks").then((r) => r.json())
      setBanks(data.banks || [])
    } catch {
      // silent — keep existing data
    } finally {
      setFirstLoad(false)
    }
  }

  useEffect(() => { loadData() }, [])

  function openAdd() {
    setEditing(null)
    setForm(DEFAULT_FORM)
    setShowModal(true)
  }

  function openEdit(bank: any) {
    setEditing(bank)
    setForm({ name: bank.name, accountNumber: bank.accountNumber || "" })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return alert("Bank name is required")
    setSaving(true)

    if (editing) {
      // Optimistic update
      setBanks((prev) => prev.map((b) => b.id === editing.id ? { ...b, ...form } : b))
      setShowModal(false)
      setSaving(false)
      await fetch(`/api/banks/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
    } else {
      // Optimistic add — show immediately in list
      const tempId = `temp-${Date.now()}`
      const tempBank = { id: tempId, ...form, createdAt: new Date().toISOString() }
      setBanks((prev) => [...prev, tempBank])
      setShowModal(false)
      setSaving(false)

      const res = await fetch("/api/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const { bank } = await res.json()
        // Replace temp entry with real one from server
        setBanks((prev) => prev.map((b) => b.id === tempId ? bank : b))
      } else {
        // Revert optimistic add on failure
        setBanks((prev) => prev.filter((b) => b.id !== tempId))
        const data = await res.json().catch(() => ({}))
        alert(data?.error || "Failed to add bank. Please try again.")
      }
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove bank "${name}"? Existing transactions linked to this bank will not be affected.`)) return
    // Optimistic remove
    setBanks((prev) => prev.filter((b) => b.id !== id))
    await fetch(`/api/banks/${id}`, { method: "DELETE" })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bank Accounts</h2>
          <p className="text-gray-500 text-sm">Manage your bank accounts used in transactions</p>
        </div>
        <Button onClick={openAdd} className="bg-green-700 hover:bg-green-800 gap-2">
          <Plus className="w-4 h-4" /> Add Bank
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" /> All Banks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {firstLoad ? (
            <div className="text-center py-10 text-gray-400">Loading...</div>
          ) : banks.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No banks added yet</p>
              <p className="text-sm mt-1">Click "Add Bank" to add your first bank account</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">#</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Bank Name</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Account Number</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Added On</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {banks.map((bank, i) => (
                    <tr key={bank.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-400 text-xs">{i + 1}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="font-semibold text-gray-900">{bank.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {bank.accountNumber || <span className="text-gray-400 italic">Not provided</span>}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {bank.id.startsWith("temp-") ? "Saving…" : new Date(bank.createdAt).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(bank)}
                            disabled={bank.id.startsWith("temp-")}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-40"
                          >
                            <PencilLine className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => handleDelete(bank.id, bank.name)}
                            disabled={bank.id.startsWith("temp-")}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
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
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              {editing ? "Edit Bank" : "Add Bank Account"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Bank Name *</Label>
              <Input
                placeholder="e.g. HBL Main Account, MCB Current"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            <div>
              <Label>Account Number (optional)</Label>
              <Input
                placeholder="e.g. 0001-2345678-01"
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-green-700 hover:bg-green-800">
                {saving ? "Saving..." : editing ? "Update Bank" : "Add Bank"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
