"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils"
import {
  Plus, Search, Edit, Phone, MapPin, Wallet,
  TrendingUp, ArrowDownCircle, Eye, Users, X,
  BookOpen, ShoppingCart, ExternalLink, Camera, UserCheck,
  CreditCard, Shield, Printer, Check, Trash2,
} from "lucide-react"
import Link from "next/link"

type Tab = "sales" | "ledger"
type StatusTab = "active" | "inactive"

const DEFAULT_FORM = {
  name: "", phone: "", address: "",
  image: "", referenceName: "", referencePhone: "", creditLimit: "0",
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [detail, setDetail] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<Tab>("ledger")
  const [form, setForm] = useState(DEFAULT_FORM)
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "CASH", notes: "", bankId: "", direction: "RECEIVE" })
  const [banks, setBanks] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [statusTab, setStatusTab] = useState<StatusTab>("active")
  const [lastPayment, setLastPayment] = useState<{ id: string; amount: number; method: string; notes: string; name: string; phone?: string; balance: number; direction?: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; phone?: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadData() {
    try {
      setLoading(true)
      const data = await fetch("/api/customers?all=true").then((r) => r.json())
      setCustomers(data.customers || [])
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(id: string) {
    const data = await fetch(`/api/customers/${id}`).then((r) => r.json())
    setDetail(data)
  }

  useEffect(() => {
    loadData()
    fetch("/api/banks").then((r) => r.json()).then((d) => setBanks(d.banks || []))
  }, [])

  function openAdd() {
    setEditing(null)
    setForm(DEFAULT_FORM)
    setShowModal(true)
  }

  function openEdit(c: any) {
    setEditing(c)
    setForm({
      name: c.name,
      phone: c.phone || "",
      address: c.address || "",
      image: c.image || "",
      referenceName: c.referenceName || "",
      referencePhone: c.referencePhone || "",
      creditLimit: String(c.creditLimit || 0),
    })
    setShowModal(true)
  }

  async function openDetail(c: any) {
    setSelected(c)
    setDetail(null)
    setActiveTab("ledger")
    setShowDetailModal(true)
    await loadDetail(c.id)
  }

  function openPayment(c: any) {
    setSelected(c)
    setPaymentForm({ amount: "", method: "CASH", notes: "", bankId: "", direction: "RECEIVE" })
    setLastPayment(null)
    setShowPaymentModal(true)
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return alert("Image must be under 2 MB")
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, image: reader.result as string }))
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (!form.name.trim()) return alert("Name is required")
    setSaving(true)
    const url = editing ? `/api/customers/${editing.id}` : "/api/customers"
    const method = editing ? "PUT" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, creditLimit: parseFloat(form.creditLimit) || 0 }),
    })
    setSaving(false)
    if (res.ok) { setShowModal(false); loadData() }
  }

  async function handlePayment() {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) return alert("Enter a valid amount")
    setSaving(true)
    const amt = parseFloat(paymentForm.amount)
    const res = await fetch(`/api/customers/${selected.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...paymentForm, amount: amt }),
    })
    setSaving(false)
    if (res.ok) {
      const data = await res.json()
      const newBalance = (selected.balance || 0) - amt
      setLastPayment({ id: data.id, amount: amt, method: paymentForm.method, notes: paymentForm.notes, name: selected.name, phone: selected.phone, balance: newBalance, direction: paymentForm.direction })
      loadData()
      if (showDetailModal) loadDetail(selected.id)
    } else {
      alert("Payment failed")
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove customer "${name}"?`)) return
    await fetch(`/api/customers/${id}`, { method: "DELETE" })
    loadData()
  }

  function handlePermanentDelete(id: string, name: string, phone?: string) {
    setDeleteTarget({ id, name, phone })
  }

  async function confirmPermanentDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch(`/api/customers/${deleteTarget.id}?permanent=true`, { method: "DELETE" })
    setDeleting(false)
    if (!res.ok) {
      const data = await res.json()
      alert(data.error || "Delete failed")
      return
    }
    setDeleteTarget(null)
    loadData()
  }

  async function handleDeletePayment(paymentId: string, amount: number) {
    if (!selected || !detail) return
    if (!confirm(`Delete payment of Rs ${amount.toLocaleString()}?`)) return

    try {
      const res = await fetch(`/api/customers/${selected.id}/payment`, {
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
        const res = await fetch(`/api/customers/${selected.id}/payment`, {
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

  async function handleToggleActive(c: any) {
    const action = c.isActive ? "deactivate" : "activate"
    if (!confirm(`${c.isActive ? "Deactivate" : "Activate"} customer "${c.name}"?`)) return
    await fetch(`/api/customers/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !c.isActive }),
    })
    loadData()
  }

  const activeCustomers = customers.filter((c) => c.isActive)
  const inactiveCustomers = customers.filter((c) => !c.isActive)
  const visibleCustomers = statusTab === "active" ? activeCustomers : inactiveCustomers
  const totalReceived = customers.reduce((s, c) => s + (c.totalCredit || 0), 0)
  const totalPaid = customers.reduce((s, c) => s + (c.totalDebit || 0), 0)

  const filtered = visibleCustomers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || "").includes(search) ||
    (c.referenceName || "").toLowerCase().includes(search.toLowerCase())
  )

  const totalOutstanding = activeCustomers.filter((c) => (c.ledgerBalance || 0) > 0).reduce((s, c) => s + (c.ledgerBalance || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Traders</h2>
          <p className="text-gray-500 text-sm">{activeCustomers.length} active · {inactiveCustomers.length} inactive</p>
        </div>
        <Button onClick={openAdd} className="bg-purple-700 hover:bg-purple-800 gap-2">
          <Plus className="w-4 h-4" /> Add Traders
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><Users className="w-5 h-5 text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
              <p className="text-sm text-gray-500">Total Registered</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><TrendingUp className="w-5 h-5 text-purple-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{activeCustomers.length}</p>
              <p className="text-sm text-gray-500">Active Traders</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg"><ArrowDownCircle className="w-5 h-5 text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalReceived)}</p>
              <p className="text-sm text-gray-500">Total Received</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg"><TrendingUp className="w-5 h-5 text-orange-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPaid)}</p>
              <p className="text-sm text-gray-500">Total Paid</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active / Inactive Tabs */}
      <div className="flex gap-1 border-b">
        {([["active", "Active", activeCustomers.length], ["inactive", "Inactive", inactiveCustomers.length]] as const).map(([key, label, count]) => (
          <button key={key} onClick={() => { setStatusTab(key); setSearch("") }}
            className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 ${statusTab === key ? "border-purple-700 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {label} <span className="text-xs text-gray-400 ml-1">({count})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search name, phone, reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !customers.length ? (
            <div className="text-center py-10 text-gray-400">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-blue-300 bg-blue-50">
                    {["#", "Trader", "Phone", "Reference", "Credit Limit", "Balance", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left py-3 px-3 text-gray-500 font-semibold text-xs uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-blue-50 transition-colors">
                      <td className="py-3 px-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          {/* Avatar */}
                          {c.image ? (
                            <img src={c.image} alt={c.name}
                              className="w-8 h-8 rounded-full object-cover border border-blue-300 flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-purple-700 font-bold text-xs">{c.name.charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                          <button onClick={() => openDetail(c)}
                            className="font-semibold text-purple-700 hover:underline text-left">
                            {c.name}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {c.phone ? <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span> : "—"}
                      </td>
                      <td className="py-3 px-3">
                        {c.referenceName ? (
                          <div>
                            <p className="text-gray-700 text-xs font-medium">{c.referenceName}</p>
                            {c.referencePhone && <p className="text-gray-400 text-xs">{c.referencePhone}</p>}
                          </div>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-3 px-3">
                        {(c.creditLimit || 0) > 0 ? (
                          <span className="flex items-center gap-1 text-blue-700 text-xs font-medium">
                            <Shield className="w-3 h-3" />{formatCurrency(c.creditLimit)}
                          </span>
                        ) : <span className="text-gray-400 text-xs">No limit</span>}
                      </td>
                      <td className="py-3 px-3">
                        {(c.ledgerBalance || 0) !== 0 ? (
                          <span className={`font-bold ${(c.ledgerBalance || 0) > 0 ? "text-red-600" : "text-purple-700"}`}>
                            {formatCurrency(Math.abs(c.ledgerBalance || 0))}
                            {(c.ledgerBalance || 0) !== 0 && <span className="text-xs ml-1 font-normal">{(c.ledgerBalance || 0) > 0 ? "Dr" : "Cr"}</span>}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${c.isActive ? "bg-green-100 text-purple-700" : "bg-blue-100 text-gray-500"}`}>
                          {c.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openDetail(c)} className="p-1.5 text-gray-400 hover:text-purple-700 hover:bg-green-50 rounded" title="View ledger">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => openPayment(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Record payment">
                            <ArrowDownCircle className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded" title="Edit">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(c)}
                            className={`p-1.5 rounded text-xs font-medium px-2 ${c.isActive ? "text-red-500 hover:text-red-700 hover:bg-red-50" : "text-purple-600 hover:text-purple-800 hover:bg-green-50"}`}
                            title={c.isActive ? "Deactivate" : "Activate"}
                          >
                            {c.isActive ? "Deactivate" : "Activate"}
                          </button>
                          {!c.isActive && (
                            <button
                              onClick={() => handlePermanentDelete(c.id, c.name, c.phone)}
                              className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded"
                              title="Delete trader profile"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-10 text-gray-400">No customers found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add/Edit Modal ─────────────────────────────────────── */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Customer" : "Add Customer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">

            {/* Photo Upload */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {form.image ? (
                  <img src={form.image} alt="Preview"
                    className="w-20 h-20 rounded-full object-cover border-2 border-green-200" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-blue-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <Camera className="w-7 h-7 text-gray-400" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-purple-700 text-blue-900 rounded-full flex items-center justify-center hover:bg-purple-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Customer Photo</p>
                <p className="text-xs text-gray-400 mt-0.5">JPG, PNG — max 2 MB. Shown in table & detail view.</p>
                {form.image && (
                  <button type="button" onClick={() => setForm({ ...form, image: "" })}
                    className="text-xs text-red-500 hover:underline mt-1">Remove photo</button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Full Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Muhammad Tariq" autoFocus />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0300-1234567" />
              </div>
              <div>
                <Label>Credit Limit (PKR)</Label>
                <Input type="number" value={form.creditLimit}
                  onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                  placeholder="0 = no limit" />
              </div>
            </div>

            <div>
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Village / City / Area" />
            </div>

            {/* Reference */}
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Reference / Guarantor</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Reference Name</Label>
                  <Input value={form.referenceName} onChange={(e) => setForm({ ...form, referenceName: e.target.value })}
                    placeholder="e.g. Ali Hassan" />
                </div>
                <div>
                  <Label>Reference Phone</Label>
                  <Input value={form.referencePhone} onChange={(e) => setForm({ ...form, referencePhone: e.target.value })}
                    placeholder="0300-0000000" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-purple-700 hover:bg-purple-800">
                {saving ? "Saving..." : editing ? "Update Customer" : "Add Customer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Customer Detail Modal ──────────────────────────────── */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selected?.image ? (
                <img src={selected.image} alt={selected?.name}
                  className="w-9 h-9 rounded-full object-cover border border-blue-300 flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-700 font-bold text-sm">{selected?.name?.charAt(0)}</span>
                </div>
              )}
              <span>{selected?.name}</span>
              {selected && (
                <Link
                  href={`/reports/customer-ledger?id=${selected.id}`}
                  className="ml-auto flex items-center gap-1 text-xs font-normal text-purple-600 hover:underline"
                  onClick={() => { setShowDetailModal(false); setSelectedPayments(new Set()) }}
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Full Ledger Report
                </Link>
              )}
            </DialogTitle>
          </DialogHeader>

          {!detail ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : (
            <div className="space-y-4">
              {/* Profile + Balance row */}
              <div className="flex gap-4">
                {/* Photo card */}
                <div className="flex-shrink-0 text-center w-32">
                  {selected?.image ? (
                    <img src={selected.image} alt={selected.name}
                      className="w-24 h-24 rounded-xl object-cover border border-blue-300 mx-auto" />
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-green-100 flex items-center justify-center mx-auto">
                      <span className="text-purple-700 font-bold text-3xl">{selected?.name?.charAt(0)}</span>
                    </div>
                  )}
                  <p className="mt-2 text-xs font-semibold text-gray-700 truncate">{selected?.name}</p>
                  {selected?.phone && <p className="text-xs text-gray-500">{selected.phone}</p>}
                </div>

                {/* Info + Stats */}
                <div className="flex-1 space-y-3">
                  {/* Contact & Reference Info */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {selected?.address && (
                      <div className="flex items-start gap-1.5 text-gray-600">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <span>{selected.address}</span>
                      </div>
                    )}
                    {(selected?.creditLimit || 0) > 0 && (
                      <div className="flex items-center gap-1.5 text-blue-700">
                        <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Credit Limit: <strong>{formatCurrency(selected.creditLimit)}</strong></span>
                      </div>
                    )}
                    {selected?.referenceName && (
                      <div className="flex items-start gap-1.5 text-gray-600 col-span-2">
                        <UserCheck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <span>
                          Reference: <strong>{selected.referenceName}</strong>
                          {selected.referencePhone && <span className="text-gray-400 ml-1">({selected.referencePhone})</span>}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Balance Cards */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-purple-700">{formatCurrency(detail.totalBusiness)}</p>
                      <p className="text-xs text-purple-600 mt-0.5">Total Business</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-orange-700">{formatCurrency(detail.totalAdvances || 0)}</p>
                      <p className="text-xs text-orange-600 mt-0.5">Total Pay</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-blue-700">{formatCurrency(detail.totalPaid)}</p>
                      <p className="text-xs text-blue-600 mt-0.5">Total Received</p>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${detail.totalBalance > 0 ? "bg-red-50" : "bg-blue-50"}`}>
                      <p className={`text-lg font-bold ${detail.totalBalance > 0 ? "text-red-700" : "text-gray-700"}`}>
                        {formatCurrency(detail.totalBalance)}
                      </p>
                      <p className={`text-xs mt-0.5 ${detail.totalBalance > 0 ? "text-red-600" : "text-gray-500"}`}>
                        {detail.totalBalance > 0 ? "Outstanding" : "Settled"}
                      </p>
                    </div>
                  </div>

                  {/* Credit limit usage bar */}
                  {(selected?.creditLimit || 0) > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Credit Used</span>
                        <span>{formatCurrency(detail.totalBalance)} / {formatCurrency(selected.creditLimit)}</span>
                      </div>
                      <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            detail.totalBalance / selected.creditLimit > 0.9 ? "bg-red-500" :
                            detail.totalBalance / selected.creditLimit > 0.6 ? "bg-orange-400" : "bg-purple-500"
                          }`}
                          style={{ width: `${Math.min((detail.totalBalance / selected.creditLimit) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <Button size="sm" className="bg-purple-700 hover:bg-purple-800"
                  onClick={() => { setShowDetailModal(false); setSelectedPayments(new Set()); openPayment(selected) }}>
                  <ArrowDownCircle className="w-4 h-4" /> Record Payment
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowDetailModal(false); setSelectedPayments(new Set()); openEdit(selected) }}>
                  <Edit className="w-4 h-4" /> Edit
                </Button>
              </div>

              {/* Tabs */}
              <div className="border-b border-blue-300">
                <div className="flex gap-0">
                  {(["ledger", "sales"] as Tab[]).map((t) => (
                    <button key={t} onClick={() => setActiveTab(t)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === t ? "border-purple-700 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}>
                      {t === "ledger" ? <BookOpen className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
                      {t === "ledger" ? "Account Ledger" : "Sales History"}
                      <span className="text-xs bg-blue-100 text-gray-500 px-1.5 py-0.5 rounded">
                        {t === "ledger" ? detail.ledger?.length || 0 : detail.sales?.length || 0}
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
                  <div className="overflow-x-auto rounded-lg border border-blue-300">
                    {selectedPayments.size > 0 && (
                      <div className="mb-3 flex items-center gap-2 bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <span className="text-sm font-medium text-blue-900">{selectedPayments.size} payment(s) selected</span>
                        <button onClick={showDeleteConfirmModal} className="ml-auto px-3 py-1 bg-red-600 text-blue-900 text-sm rounded hover:bg-red-700">
                          Delete Selected
                        </button>
                      </div>
                    )}
                    <table className="w-full text-sm">
                      <thead className="bg-blue-50">
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
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                  entry.type === "PAYMENT" ? "bg-green-100 text-purple-700"
                                  : entry.type === "COMMISSION" ? "bg-purple-100 text-purple-700"
                                  : entry.type === "PESTICIDE" ? "bg-orange-100 text-orange-700"
                                  : "bg-blue-100 text-blue-700"
                                }`}>
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
                      <tfoot className="bg-blue-50 border-t-2 border-blue-300">
                        <tr>
                          <td colSpan={4} className="py-2 px-3 font-bold text-gray-700 text-xs">Closing Balance</td>
                          <td className="py-2 px-3 text-right font-bold text-gray-900">{formatCurrency((detail.ledger || []).reduce((s: number, e: any) => s + e.debit, 0))}</td>
                          <td className="py-2 px-3 text-right font-bold text-purple-700">{formatCurrency((detail.ledger || []).reduce((s: number, e: any) => s + e.credit, 0))}</td>
                          <td className={`py-2 px-3 text-right font-bold ${detail.totalBalance > 0 ? "text-red-600" : "text-purple-700"}`}>
                            {formatCurrency(detail.totalBalance)}
                            <span className="text-xs ml-1 font-normal">{detail.totalBalance > 0 ? "Dr" : "Cr"}</span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              )}

              {/* Sales Tab */}
              {activeTab === "sales" && (
                detail.sales?.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-6">No sales yet</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-blue-300">
                    <table className="w-full text-sm">
                      <thead className="bg-blue-50">
                        <tr>
                          {["Date", "Items", "Total", "Paid", "Balance", "Status"].map((h) => (
                            <th key={h} className="text-left py-2 px-3 text-gray-500 font-medium text-xs">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detail.sales.map((sale: any) => (
                          <tr key={sale.id} className="hover:bg-blue-50">
                            <td className="py-2 px-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(sale.createdAt)}</td>
                            <td className="py-2 px-3 text-gray-600 text-xs max-w-xs truncate">
                              {sale.items.map((i: any) => `${i.quantity} ${i.product?.unit} ${i.product?.name}`).join(", ")}
                            </td>
                            <td className="py-2 px-3 font-medium">{formatCurrency(sale.totalAmount)}</td>
                            <td className="py-2 px-3 text-purple-700">{formatCurrency(sale.paidAmount)}</td>
                            <td className="py-2 px-3 text-red-600 font-medium">{formatCurrency(sale.balance)}</td>
                            <td className="py-2 px-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(sale.status)}`}>{sale.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-blue-50 border-t border-blue-300">
                        <tr>
                          <td colSpan={2} className="py-2 px-3 font-semibold text-gray-600 text-xs">Total ({detail.sales.length} sales)</td>
                          <td className="py-2 px-3 font-bold">{formatCurrency(detail.totalBusiness)}</td>
                          <td className="py-2 px-3 font-bold text-purple-700">{formatCurrency(detail.totalPaid)}</td>
                          <td className="py-2 px-3 font-bold text-red-600">{formatCurrency(detail.totalBalance)}</td>
                          <td />
                        </tr>
                      </tfoot>
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
        <div className="hidden print:block fixed inset-0 bg-blue-50 z-[9999] p-10">
          <div className="max-w-xs mx-auto">
            <div className="text-center border-b-2 border-gray-800 pb-4 mb-5">
              <h1 className="text-2xl font-bold text-gray-900">Gala Mandi</h1>
              <p className="text-sm text-gray-500">Payment Receipt</p>
              <p className="text-xs text-gray-400 mt-1">{new Date().toLocaleString("en-PK")}</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Customer:</span><span className="font-semibold">{lastPayment.name}</span></div>
              {lastPayment.phone && <div className="flex justify-between"><span className="text-gray-500">Phone:</span><span>{lastPayment.phone}</span></div>}
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between"><span className="text-gray-500">Amount Received:</span><span className="text-lg font-bold text-purple-700">{formatCurrency(lastPayment.amount)}</span></div>
                <div className="flex justify-between mt-1"><span className="text-gray-500">Method:</span><span>{lastPayment.method.replace("_", " ")}</span></div>
                {lastPayment.notes && <div className="flex justify-between mt-1"><span className="text-gray-500">Reference:</span><span>{lastPayment.notes}</span></div>}
              </div>
              <div className="border-t-2 border-gray-800 pt-2 flex justify-between font-bold text-base">
                <span>Remaining Balance:</span>
                <span className={lastPayment.balance > 0 ? "text-red-700" : "text-purple-700"}>{formatCurrency(lastPayment.balance)}</span>
              </div>
            </div>
            <p className="mt-8 text-center text-xs text-gray-400 border-t pt-4">Thank you for your payment</p>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              Delete Trader
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Trader info */}
            <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-4 border border-blue-300">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <span className="text-purple-700 font-bold text-sm">
                  {deleteTarget?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{deleteTarget?.name}</p>
                {deleteTarget?.phone && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" />{deleteTarget.phone}
                  </p>
                )}
              </div>
            </div>

            {/* Warning message */}
            <div className="bg-blue-50 border border-blue-300 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-blue-800">What happens when you delete?</p>
              <ul className="text-xs text-blue-600 space-y-1">
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-500 mt-0.5">✓</span>
                  <span>Trader profile (name, phone, address) will be <strong>removed</strong></span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-purple-600 mt-0.5">✓</span>
                  <span>All sales, commissions & ledger records are <strong>kept safe</strong></span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-purple-600 mt-0.5">✓</span>
                  <span>Your financial totals and reports <strong>remain accurate</strong></span>
                </li>
              </ul>
            </div>

            <p className="text-xs text-gray-400 text-center">This action cannot be undone.</p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 gap-2"
                onClick={confirmPermanentDelete}
                disabled={deleting}
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? "Deleting..." : "Yes, Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Payment Modal ──────────────────────────────────────── */}
      <Dialog open={showPaymentModal} onOpenChange={(open) => { setShowPaymentModal(open); if (!open) setLastPayment(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {lastPayment ? <Check className="w-5 h-5 text-purple-600" /> : <ArrowDownCircle className="w-5 h-5 text-purple-600" />}
              {lastPayment ? "Payment Recorded" : "Record Payment"}
            </DialogTitle>
          </DialogHeader>

          {lastPayment ? (
            /* Receipt view */
            <div className="space-y-4">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Check className="w-5 h-5 text-purple-700" />
                </div>
                <p className="font-semibold text-purple-800">{lastPayment.name}</p>
                {lastPayment.phone && <p className="text-xs text-purple-600">{lastPayment.phone}</p>}
              </div>
              <div className="border border-blue-300 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{(lastPayment as any).direction === "PAY" ? "Paid to Customer" : "Amount Received"}</span>
                  <span className="font-bold text-purple-700">{formatCurrency(lastPayment.amount)}</span>
                </div>
                <div className="flex justify-between"><span className="text-gray-500">Method</span><span>{lastPayment.method.replace("_", " ")}</span></div>
                {lastPayment.notes && <div className="flex justify-between"><span className="text-gray-500">Reference</span><span className="text-xs">{lastPayment.notes}</span></div>}
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span className="text-gray-600">Updated Balance</span>
                  <span className={lastPayment.balance > 0 ? "text-red-600" : lastPayment.balance < 0 ? "text-blue-600" : "text-purple-700"}>
                    {formatCurrency(Math.abs(lastPayment.balance))}
                    {lastPayment.balance < 0 && <span className="text-xs ml-1 font-normal">(Credit)</span>}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    if (confirm("Delete this payment?")) {
                      try {
                        const res = await fetch(`/api/customers/${selected.id}/payment`, {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ paymentId: lastPayment.id }),
                        })
                        if (res.ok) {
                          setShowPaymentModal(false)
                          setLastPayment(null)
                          loadData()
                        }
                      } catch (e) {
                        alert("Failed to delete payment")
                      }
                    }
                  }}
                  className="gap-1"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
                <Button variant="outline" onClick={() => { setShowPaymentModal(false); setLastPayment(null) }} className="flex-1">Close</Button>
                <Button onClick={() => window.print()} className="flex-1 bg-purple-700 hover:bg-purple-800 gap-2">
                  <Printer className="w-4 h-4" /> Print Receipt
                </Button>
              </div>
            </div>
          ) : (
            /* Payment form */
            <div className="space-y-4">
              <div className="bg-green-50 rounded-lg p-3 flex items-center gap-3">
                {selected?.image ? (
                  <img src={selected.image} alt={selected?.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center">
                    <span className="text-purple-800 font-bold text-xs">{selected?.name?.charAt(0)}</span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-purple-800 text-sm">{selected?.name}</p>
                  {selected?.phone && <p className="text-xs text-purple-600">{selected.phone}</p>}
                </div>
              </div>
              {/* Direction toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentForm({ ...paymentForm, direction: "RECEIVE" })}
                  className={`py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                    paymentForm.direction === "RECEIVE"
                      ? "border-purple-600 bg-green-50 text-purple-700"
                      : "border-blue-300 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  Received
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentForm({ ...paymentForm, direction: "PAY" })}
                  className={`py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                    paymentForm.direction === "PAY"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-blue-300 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  Paid to Customer
                </button>
              </div>
              <div>
                <Label>Amount (PKR) *</Label>
                <Input type="number" placeholder="Enter amount"
                  value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} autoFocus />
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
                <Input placeholder="Cheque no., reference..."
                  value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowPaymentModal(false)} className="flex-1">Cancel</Button>
                <Button onClick={handlePayment} disabled={saving} className="flex-1 bg-purple-700 hover:bg-purple-800">
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-900">
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
