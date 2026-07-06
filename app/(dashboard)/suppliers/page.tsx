"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils"
import {
  Plus, Search, Edit, Phone, MapPin, ArrowUpCircle,
  Eye, Truck, X, TrendingDown, Printer, Check, BookOpen, ShoppingBag, Upload, Trash2,
} from "lucide-react"

export default function SuppliersPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [activeTab, setActiveTab] = useState<"ledger" | "purchases">("ledger")
  const [editing, setEditing] = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [detail, setDetail] = useState<any>(null)
  const [form, setForm] = useState({ name: "", phone: "", otherPhone: "", address: "", picture: "" })
  const [photoPreview, setPhotoPreview] = useState<string>("")

  // Restrict CASHIER from accessing this page
  useEffect(() => {
    if (session && session.user?.role === "CASHIER") {
      router.push("/dashboard")
    }
  }, [session, router])
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "CASH", notes: "", bankId: "", direction: "PAY" })
  const [banks, setBanks] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [lastPayment, setLastPayment] = useState<{ amount: number; method: string; notes: string; name: string; phone?: string; balance: number; direction?: string } | null>(null)
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function loadData() {
    try {
      setLoading(true)
      const data = await fetch("/api/suppliers").then((r) => r.json())
      setSuppliers(data.suppliers || [])
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(id: string) {
    const data = await fetch(`/api/suppliers/${id}`).then((r) => r.json())
    setDetail(data)
  }

  useEffect(() => {
    loadData()
    fetch("/api/banks").then((r) => r.json()).then((d) => setBanks(d.banks || []))
  }, [])

  function openAdd() {
    setEditing(null)
    setForm({ name: "", phone: "", otherPhone: "", address: "", picture: "" })
    setPhotoPreview("")
    setShowModal(true)
  }

  function openEdit(s: any) {
    setEditing(s)
    setForm({ name: s.name, phone: s.phone || "", otherPhone: s.otherPhone || "", address: s.address || "", picture: s.picture || "" })
    setPhotoPreview(s.picture || "")
    setShowModal(true)
  }

  async function openDetail(s: any) {
    setSelected(s)
    setDetail(null)
    setActiveTab("ledger")
    setShowDetailModal(true)
    await loadDetail(s.id)
  }

  function openPayment(s: any) {
    setSelected(s)
    setPaymentForm({ amount: "", method: "CASH", notes: "", bankId: "", direction: "PAY" })
    setLastPayment(null)
    setShowPaymentModal(true)
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string
      setPhotoPreview(base64)
      setForm({ ...form, picture: base64 })
    }
    reader.readAsDataURL(file)
  }

  function deletePhoto() {
    setPhotoPreview("")
    setForm({ ...form, picture: "" })
  }

  async function handleSave() {
    if (!form.name.trim()) return alert("Name is required")
    setSaving(true)
    const url = editing ? `/api/suppliers/${editing.id}` : "/api/suppliers"
    const method = editing ? "PUT" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) { setShowModal(false); loadData() }
  }

  async function handlePayment() {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) return alert("Enter a valid amount")
    setSaving(true)
    const amt = parseFloat(paymentForm.amount)
    const res = await fetch(`/api/suppliers/${selected.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...paymentForm, amount: amt }),
    })
    setSaving(false)
    if (res.ok) {
      const isPay = paymentForm.direction === "PAY"
      const newBalance = isPay ? (selected.balance || 0) - amt : (selected.balance || 0) + amt
      setLastPayment({ amount: amt, method: paymentForm.method, notes: paymentForm.notes, name: selected.name, phone: selected.phone, balance: newBalance, direction: paymentForm.direction })
      loadData()
      if (showDetailModal) loadDetail(selected.id)
    } else {
      alert("Payment failed")
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove supplier "${name}"?`)) return
    await fetch(`/api/suppliers/${id}`, { method: "DELETE" })
    loadData()
  }

  async function handleDeletePayment(paymentId: string, amount: number) {
    if (!selected || !detail) return
    if (!confirm(`Delete payment of Rs ${amount.toLocaleString()}?`)) return

    try {
      const res = await fetch(`/api/suppliers/${selected.id}/payment`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId })
      })
      if (!res.ok) throw new Error("Delete failed")

      setSelectedPayments(prev => {
        const updated = new Set(prev)
        updated.delete(paymentId)
        return updated
      })
      await loadDetail(selected.id)
    } catch (error) {
      alert("Error deleting payment")
    }
  }

  function showDeleteConfirmModal() {
    if (!selected || selectedPayments.size === 0) return
    setShowDeleteConfirm(true)
  }

  async function confirmDelete() {
    if (!selected || selectedPayments.size === 0) return
    setShowDeleteConfirm(false)
    setDeleting(true)

    try {
      for (const paymentId of selectedPayments) {
        const res = await fetch(`/api/suppliers/${selected.id}/payment`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId })
        })
        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || "Delete failed")
        }
      }
      setSelectedPayments(new Set())
      await loadDetail(selected.id)
    } catch (error) {
      alert(`Error deleting payments: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone || "").includes(search)
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Suppliers</h2>
          <p className="text-gray-500 text-sm">{suppliers.length} suppliers registered</p>
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4" /> Add Supplier</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg"><Truck className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{suppliers.length}</p>
                <p className="text-sm text-gray-500">Total Suppliers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg"><TrendingDown className="w-5 h-5 text-purple-600" /></div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{suppliers.filter(s => s.isActive).length}</p>
                <p className="text-sm text-gray-500">Active Suppliers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-50 rounded-lg"><ArrowUpCircle className="w-5 h-5 text-orange-600" /></div>
              <div>
                <p className="text-2xl font-bold text-gray-900">View Detail</p>
                <p className="text-sm text-gray-500">Click supplier for balance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading && !suppliers.length ? (
            <div className="text-center py-10 text-gray-400">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-yellow-300">
                    {["#", "Name", "Phone", "Address", "Balance", "Status", "Actions"].map((h) => (
                      <th key={h} className={`py-3 px-3 text-gray-500 font-medium ${h === "Balance" ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-slate-50">
                      <td className="py-3 px-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => openDetail(s)}
                          className="font-semibold text-purple-700 hover:underline text-left"
                        >
                          {s.name}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {s.phone ? (
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</span>
                        ) : "—"}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {s.address ? (
                          <span className="flex items-center gap-1 max-w-xs truncate">
                            <MapPin className="w-3 h-3 flex-shrink-0" />{s.address}
                          </span>
                        ) : "—"}
                      </td>
                      <td className={`py-3 px-3 text-right font-semibold ${(s.ledgerBalance || 0) > 0 ? "text-purple-600" : (s.ledgerBalance || 0) < 0 ? "text-red-600" : "text-gray-600"}`}>
                        {formatCurrency(s.ledgerBalance || 0)}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${s.isActive ? "bg-green-100 text-purple-700" : "bg-yellow-100 text-gray-500"}`}>
                          {s.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openDetail(s)} className="p-1.5 text-gray-400 hover:text-purple-700 hover:bg-green-50 rounded" title="View details">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => openPayment(s)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Record payment">
                            <ArrowUpCircle className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded" title="Edit">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(s.id, s.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Remove">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400">No suppliers found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <Label>Business Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Punjab Agri Traders" />
            </div>
            <div>
              <Label>Picture (Optional)</Label>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <div className="relative border-2 border-yellow-300 rounded-lg p-3 text-center hover:border-green-500 transition-colors">
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                      <Upload className="w-4 h-4" />
                      <span>Click to upload photo</span>
                    </div>
                  </div>
                </div>
                {(photoPreview || form.picture) && !photoPreview && form.picture && (
                  <img src={form.picture} alt="Preview" className="w-12 h-12 rounded object-cover border" />
                )}
                {photoPreview && (
                  <div className="flex gap-2 items-center">
                    <img src={photoPreview} alt="Preview" className="w-12 h-12 rounded object-cover border" />
                    <button type="button" onClick={deletePhoto} className="p-1.5 rounded hover:bg-red-100">
                      <X className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone Number</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="042-12345678" />
              </div>
              <div>
                <Label>Other Number (Optional)</Label>
                <Input value={form.otherPhone} onChange={(e) => setForm({ ...form, otherPhone: e.target.value })} placeholder="03001234567" />
              </div>
            </div>
            <div>
              <Label>Address (Optional)</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="City / Area" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? "Saving..." : editing ? "Update" : "Add Supplier"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Supplier Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              {selected?.name}
            </DialogTitle>
          </DialogHeader>

          {!detail ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : (
            <div className="space-y-5">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-xl font-bold text-blue-700">{formatCurrency(detail.totalBusiness)}</p>
                  <p className="text-xs text-blue-600 mt-1">Total Purchased</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-xl font-bold text-purple-700">{formatCurrency(detail.totalPaid)}</p>
                  <p className="text-xs text-purple-600 mt-1">Total Paid</p>
                </div>
                <div className={`rounded-lg p-4 text-center ${detail.totalBalance > 0 ? "bg-red-50" : "bg-slate-50"}`}>
                  <p className={`text-xl font-bold ${detail.totalBalance > 0 ? "text-red-700" : "text-gray-700"}`}>
                    {formatCurrency(detail.totalBalance)}
                  </p>
                  <p className={`text-xs mt-1 ${detail.totalBalance > 0 ? "text-red-600" : "text-gray-500"}`}>
                    Amount Owed
                  </p>
                </div>
              </div>

              {/* Contact */}
              <div className="flex gap-4 text-sm text-gray-600 bg-slate-50 rounded-lg p-3">
                {selected?.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{selected.phone}</span>}
                {selected?.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{selected.address}</span>}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => { setShowDetailModal(false); setSelectedPayments(new Set()); openPayment(selected) }}
                >
                  <ArrowUpCircle className="w-4 h-4" /> Record Payment
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowDetailModal(false); setSelectedPayments(new Set()); openEdit(selected) }}>
                  <Edit className="w-4 h-4" /> Edit
                </Button>
              </div>

              {/* Tabs */}
              <div className="border-b border-yellow-300">
                <div className="flex gap-0">
                  {([["ledger", "Account Ledger", <BookOpen key="b" className="w-4 h-4" />], ["purchases", "Purchase History", <ShoppingBag key="s" className="w-4 h-4" />]] as const).map(([key, label, icon]) => (
                    <button key={key} onClick={() => setActiveTab(key as any)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === key ? "border-purple-700 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}>
                      {icon}{label}
                      <span className="text-xs bg-yellow-100 text-gray-500 px-1.5 py-0.5 rounded">
                        {key === "ledger" ? detail.ledger?.length || 0 : detail.purchases?.length || 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ledger Tab */}
              {activeTab === "ledger" && (
                detail.ledger?.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-6">No transactions yet</p>
                ) : (
                  <div className="space-y-3">
                    {selectedPayments.size > 0 && (
                      <div className="flex items-center gap-2 bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <span className="text-sm font-medium text-blue-900">{selectedPayments.size} payment(s) selected</span>
                        <button onClick={showDeleteConfirmModal} className="ml-auto px-3 py-1 bg-red-600 text-slate-900 text-sm rounded hover:bg-red-700">
                          Delete Selected
                        </button>
                      </div>
                    )}
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-center py-2 px-3 w-10"></th>
                            <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Date</th>
                            <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Type</th>
                            <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Description</th>
                            <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs">Debit (Dr)</th>
                            <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs">Credit (Cr)</th>
                            <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {detail.ledger.map((entry: any, i: number) => {
                            const isPayment = entry.type === "PAYMENT"
                            const isSelected = isPayment && selectedPayments.has(entry.id || i)
                            return (
                              <tr key={i} className={isPayment ? "bg-green-50/50" : ""}>
                                <td className="py-2 px-3 text-center">
                                  {isPayment && (
                                    <input type="checkbox" checked={isSelected} onChange={(e) => {
                                      const newSet = new Set(selectedPayments)
                                      if (e.target.checked) newSet.add(entry.id || i)
                                      else newSet.delete(entry.id || i)
                                      setSelectedPayments(newSet)
                                    }} className="w-4 h-4" />
                                  )}
                                </td>
                                <td className="py-2 px-3 text-gray-500 whitespace-nowrap text-xs">{formatDate(entry.date)}</td>
                                <td className="py-2 px-3">
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${entry.type === "PAYMENT" ? "bg-green-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                                    {entry.type}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-gray-700 text-xs max-w-xs truncate">{entry.description}</td>
                                <td className="py-2 px-3 text-right font-medium text-gray-900">{entry.debit > 0 ? formatCurrency(entry.debit) : "—"}</td>
                                <td className="py-2 px-3 text-right text-purple-700">{entry.credit > 0 ? formatCurrency(entry.credit) : "—"}</td>
                                <td className={`py-2 px-3 text-right font-semibold ${entry.balance > 0 ? "text-red-600" : "text-purple-700"}`}>
                                  {formatCurrency(Math.abs(entry.balance))}
                                  {entry.balance !== 0 && <span className="text-xs ml-1 font-normal">{entry.balance > 0 ? "Dr" : "Cr"}</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t-2 border-yellow-300">
                          <tr>
                            <td colSpan={4} className="py-2 px-3 font-bold text-gray-700 text-xs">Closing Balance</td>
                            <td className="py-2 px-3 text-right font-bold text-gray-900">{formatCurrency((detail.ledger || []).reduce((s: number, e: any) => s + e.debit, 0))}</td>
                            <td className="py-2 px-3 text-right font-bold text-purple-700">{formatCurrency((detail.ledger || []).reduce((s: number, e: any) => s + e.credit, 0))}</td>
                            <td className={`py-2 px-3 text-right font-bold ${detail.totalBalance > 0 ? "text-red-600" : "text-purple-700"}`}>
                              {formatCurrency(detail.totalBalance)}
                              <span className="text-xs ml-1 font-normal">{detail.totalBalance > 0 ? "Dr" : "Cr"}</span>
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )
              )}

              {/* Purchases Tab */}
              {activeTab === "purchases" && (
                detail.purchases?.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-6">No purchases yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-yellow-300">
                          {["Date", "Items", "Total", "Paid", "Balance", "Status"].map((h) => (
                            <th key={h} className="text-left py-2 px-3 text-gray-500 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.purchases.map((p: any) => (
                          <tr key={p.id} className="border-b border-gray-50 hover:bg-slate-50">
                            <td className="py-2 px-3 text-gray-500">{formatDate(p.createdAt)}</td>
                            <td className="py-2 px-3 text-gray-600 text-xs">
                              {p.items.map((i: any) => `${i.product?.name} ×${i.quantity}`).join(", ")}
                            </td>
                            <td className="py-2 px-3 font-medium">{formatCurrency(p.totalAmount)}</td>
                            <td className="py-2 px-3 text-purple-600">{formatCurrency(p.paidAmount)}</td>
                            <td className="py-2 px-3 text-red-600">{formatCurrency(p.balance)}</td>
                            <td className="py-2 px-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(p.status)}`}>
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Receipt Print Template */}
      {lastPayment && showPaymentModal && (
        <div className="hidden print:block fixed inset-0 bg-slate-50 z-[9999] p-10">
          <div className="max-w-xs mx-auto">
            <div className="text-center border-b-2 border-gray-800 pb-4 mb-5">
              <h1 className="text-2xl font-bold text-gray-900">Gala Mandi</h1>
              <p className="text-sm text-gray-500">Payment Receipt</p>
              <p className="text-xs text-gray-400 mt-1">{new Date().toLocaleString("en-PK")}</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Supplier:</span><span className="font-semibold">{lastPayment.name}</span></div>
              {lastPayment.phone && <div className="flex justify-between"><span className="text-gray-500">Phone:</span><span>{lastPayment.phone}</span></div>}
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between"><span className="text-gray-500">{lastPayment.direction === "RECEIVE" ? "Received from Supplier:" : "Amount Paid:"}</span><span className="text-lg font-bold text-blue-700">{formatCurrency(lastPayment.amount)}</span></div>
                <div className="flex justify-between mt-1"><span className="text-gray-500">Method:</span><span>{lastPayment.method.replace("_", " ")}</span></div>
                {lastPayment.notes && <div className="flex justify-between mt-1"><span className="text-gray-500">Reference:</span><span>{lastPayment.notes}</span></div>}
              </div>
              <div className="border-t-2 border-gray-800 pt-2 flex justify-between font-bold text-base">
                <span>Balance:</span>
                <span className={lastPayment.balance > 0 ? "text-red-700" : "text-purple-700"}>{formatCurrency(Math.abs(lastPayment.balance))}</span>
              </div>
            </div>
            <p className="mt-8 text-center text-xs text-gray-400 border-t pt-4">Payment receipt — Gala Mandi</p>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={(open) => { setShowPaymentModal(open); if (!open) setLastPayment(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {lastPayment ? <Check className="w-5 h-5 text-purple-600" /> : <ArrowUpCircle className="w-5 h-5 text-blue-600" />}
              {lastPayment ? "Payment Recorded" : "Pay Supplier"}
            </DialogTitle>
          </DialogHeader>

          {lastPayment ? (
            <div className="space-y-4">
              <div className={`rounded-lg p-4 text-center ${lastPayment.direction === "RECEIVE" ? "bg-orange-50" : "bg-blue-50"}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${lastPayment.direction === "RECEIVE" ? "bg-orange-100" : "bg-blue-100"}`}>
                  <Check className={`w-5 h-5 ${lastPayment.direction === "RECEIVE" ? "text-orange-700" : "text-blue-700"}`} />
                </div>
                <p className={`font-semibold ${lastPayment.direction === "RECEIVE" ? "text-orange-800" : "text-blue-800"}`}>{lastPayment.name}</p>
                {lastPayment.phone && <p className={`text-xs ${lastPayment.direction === "RECEIVE" ? "text-orange-600" : "text-blue-600"}`}>{lastPayment.phone}</p>}
              </div>
              <div className="border border-slate-200 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{lastPayment.direction === "RECEIVE" ? "Received from Supplier" : "Paid to Supplier"}</span>
                  <span className={`font-bold ${lastPayment.direction === "RECEIVE" ? "text-orange-700" : "text-blue-700"}`}>{formatCurrency(lastPayment.amount)}</span>
                </div>
                <div className="flex justify-between"><span className="text-gray-500">Method</span><span>{lastPayment.method.replace("_", " ")}</span></div>
                {lastPayment.notes && <div className="flex justify-between"><span className="text-gray-500">Reference</span><span className="text-xs">{lastPayment.notes}</span></div>}
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span className="text-gray-600">Balance</span>
                  <span className={lastPayment.balance > 0 ? "text-red-600" : "text-purple-700"}>{formatCurrency(Math.abs(lastPayment.balance))}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setShowPaymentModal(false); setLastPayment(null) }} className="flex-1">Close</Button>
                <Button onClick={() => window.print()} className="flex-1 gap-2">
                  <Printer className="w-4 h-4" /> Print Receipt
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Direction Toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentForm({ ...paymentForm, direction: "PAY" })}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                    paymentForm.direction === "PAY"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-yellow-300 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  Paid to Supplier
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentForm({ ...paymentForm, direction: "RECEIVE" })}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                    paymentForm.direction === "RECEIVE"
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-yellow-300 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  Received
                </button>
              </div>
              <div className={`rounded-lg p-3 text-sm ${paymentForm.direction === "RECEIVE" ? "bg-orange-50 text-orange-800" : "bg-blue-50 text-blue-800"}`}>
                Supplier: <strong>{selected?.name}</strong>
              </div>
              <div>
                <Label>Amount (PKR) *</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm({ ...paymentForm, method: v, bankId: v === "CASH" ? "" : paymentForm.bankId })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {paymentForm.method !== "CASH" && banks.length > 0 && (
                <div>
                  <Label>Bank Account</Label>
                  <Select value={paymentForm.bankId || "none"} onValueChange={(v) => setPaymentForm({ ...paymentForm, bankId: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select bank..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Not specified —</SelectItem>
                      {banks.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}{b.accountNumber ? ` (${b.accountNumber})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Notes (optional)</Label>
                <Input
                  placeholder="Cheque no., reference..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowPaymentModal(false)} className="flex-1">Cancel</Button>
                <Button onClick={handlePayment} disabled={saving} className="flex-1">
                  {saving ? "Processing..." : "Confirm Payment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Delete Transactions
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-900">
                You are about to delete <strong>{selectedPayments.size} payment transaction(s)</strong>.
              </p>
              <p className="text-sm text-red-800 mt-2">
                This action will remove the transactions from the ledger and reverse the balance calculations.
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-900">
                ⚠️ <strong>Warning:</strong> This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Delete Transactions"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
