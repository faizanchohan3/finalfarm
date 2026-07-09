"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Plus, Search, Tractor, Edit, Trash2, ChevronDown, ChevronRight, BookOpen, Banknote, Printer, Check, Upload, Eye, ExternalLink, ShoppingBag } from "lucide-react"

export default function FarmersPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [farmers, setFarmers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [expanded, setExpanded] = useState<Record<string, any>>({})
  const [loadingRow, setLoadingRow] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "", phone: "", otherPhone: "", address: "", village: "", cnic: "", picture: "", creditLimit: "0",
  })
  const [photoPreview, setPhotoPreview] = useState<string>("")

  // Restrict CASHIER from accessing this page
  useEffect(() => {
    if (session && session.user?.role === "CASHIER") {
      router.push("/dashboard")
    }
  }, [session, router])

  // Payment state
  const [showPayModal, setShowPayModal] = useState(false)
  const [payingFarmer, setPayingFarmer] = useState<any>(null)
  const [payForm, setPayForm] = useState({ amount: "", method: "CASH", notes: "", paymentType: "PAY" })
  const [payLoading, setPayLoading] = useState(false)
  const [lastPayment, setLastPayment] = useState<{ amount: number; method: string; notes: string; name: string; phone?: string; paymentType: string; balance: number } | null>(null)
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set())
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedFarmer, setSelectedFarmer] = useState<any>(null)
  const [farmerDetail, setFarmerDetail] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [deletingPayments, setDeletingPayments] = useState(false)

  async function loadData() {
    try {
      setLoading(true)
      const d = await fetch("/api/farmers").then((r) => r.json())
      setFarmers(d.farmers || [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { loadData() }, [])

  function openAdd() {
    setEditing(null)
    setForm({ name: "", phone: "", otherPhone: "", address: "", village: "", cnic: "", picture: "", creditLimit: "0" })
    setShowModal(true)
  }
  function openEdit(f: any) {
    setEditing(f)
    setForm({ name: f.name, phone: f.phone || "", otherPhone: f.otherPhone || "", address: f.address || "", village: f.village || "", cnic: f.cnic || "", picture: f.picture || "", creditLimit: String(f.creditLimit) })
    setShowModal(true)
  }

  function openPayment(f: any) {
    setPayingFarmer(f)
    setPayForm({ amount: "", method: "CASH", notes: "", paymentType: "PAY" })
    setLastPayment(null)
    setShowPayModal(true)
  }

  async function openDetail(f: any) {
    setSelectedFarmer(f)
    setShowDetailModal(true)
    setLoadingRow(f.id)
    try {
      const res = await fetch(`/api/farmers/${f.id}`)
      const data = await res.json()
      setFarmerDetail(data)
    } catch (error) {
      console.error("Failed to load farmer details", error)
    } finally {
      setLoadingRow(null)
    }
  }

  async function handleSave() {
    if (!form.name.trim()) return alert("Name is required")
    const url = editing ? `/api/farmers/${editing.id}` : "/api/farmers"
    const method = editing ? "PUT" : "POST"
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, creditLimit: parseFloat(form.creditLimit) || 0 }),
    })
    if (res.ok) { setShowModal(false); loadData() }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Deactivate farmer: "${name}"?`)) return
    await fetch(`/api/farmers/${id}`, { method: "DELETE" })
    loadData()
  }

  async function handlePayment() {
    if (!payingFarmer) return
    const amt = parseFloat(payForm.amount)
    if (!amt || amt <= 0) return alert("Enter a valid amount")
    setPayLoading(true)
    const res = await fetch(`/api/farmers/${payingFarmer.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amt, method: payForm.method, notes: payForm.notes, paymentType: payForm.paymentType }),
    })
    setPayLoading(false)
    if (res.ok) {
      const balanceChange = payForm.paymentType === "RECEIVE" ? amt : -amt
      const newBalance = (payingFarmer.balance || 0) + balanceChange
      setLastPayment({ amount: amt, method: payForm.method, notes: payForm.notes, paymentType: payForm.paymentType, name: payingFarmer.name, phone: payingFarmer.phone, balance: newBalance })
      await loadData()
      if (expanded[payingFarmer.id]) {
        const d = await fetch(`/api/farmers/${payingFarmer.id}`).then((r) => r.json())
        setExpanded((p) => ({ ...p, [payingFarmer.id]: d }))
      }
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data?.error || "Failed to record payment")
    }
  }

  function showDeleteConfirmModal(farmerId: string) {
    if (selectedPayments.size === 0) return
    setShowDeleteConfirm(farmerId)
  }

  async function confirmDelete(farmerId: string) {
    if (selectedPayments.size === 0) return
    setShowDeleteConfirm(null)
    setDeletingPayments(true)

    try {
      for (const paymentId of selectedPayments) {
        const res = await fetch(`/api/farmers/${farmerId}/payment`, {
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

      // Reload both the list and expanded detail if open
      await loadData()
      if (expanded[farmerId]) {
        setLoadingRow(farmerId)
        try {
          const res = await fetch(`/api/farmers/${farmerId}`)
          const data = await res.json()
          setExpanded(prev => ({
            ...prev,
            [farmerId]: data
          }))
        } finally {
          setLoadingRow(null)
        }
      }
    } catch (error) {
      alert(`Error deleting payments: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setDeletingPayments(false)
    }
  }

  async function toggleExpand(id: string) {
    if (expanded[id]) { setExpanded((p) => { const n = { ...p }; delete n[id]; return n }); return }
    setLoadingRow(id)
    const d = await fetch(`/api/farmers/${id}`).then((r) => r.json())
    setExpanded((p) => ({ ...p, [id]: d }))
    setLoadingRow(null)
  }

  const filtered = farmers.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.village || "").toLowerCase().includes(search.toLowerCase()) ||
    (f.phone || "").includes(search)
  )

  const totals = filtered.reduce((acc, f) => ({
    totalBalance: acc.totalBalance + (f.balance || 0),
  }), { totalBalance: 0 })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Farmer Management</h2>
          <p className="text-gray-500 text-sm">Manage farmer records, ledgers & payments</p>
        </div>
        <Button onClick={openAdd} className="bg-white hover:bg-gray-100 text-gray-900 border border-gray-300 gap-2">
          <Plus className="w-4 h-4" /> Add Farmer
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Total Farmers</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{farmers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Outstanding Payable</p>
            <p className={`text-xl font-bold mt-1 ${totals.totalBalance > 0 ? "text-red-600" : "text-gray-500"}`}>
              {formatCurrency(totals.totalBalance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Showing</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{filtered.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search name, village, phone..." value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Tractor className="w-4 h-4" /> Farmers ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-blue-50 border-b border-t">
                <tr>
                  <th className="px-4 py-3 w-8" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Farmer Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Village</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">CNIC</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Credit Limit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Balance</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Purchases</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && !farmers.length ? (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
                ) : filtered.map((f, i) => (
                  <>
                    <tr key={f.id}
                      className={`border-b border-blue-300 hover:bg-blue-50 cursor-pointer ${expanded[f.id] ? "bg-green-50/30" : ""}`}
                      onClick={() => toggleExpand(f.id)}
                    >
                      <td className="px-4 py-3">
                        {loadingRow === f.id
                          ? <div className="w-3.5 h-3.5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                          : expanded[f.id] ? <ChevronDown className="w-3.5 h-3.5 text-purple-600" />
                          : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{f.name}</td>
                      <td className="px-4 py-3 text-gray-600">{f.village || "â€”"}</td>
                      <td className="px-4 py-3 text-gray-600">{f.phone || "â€”"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{f.cnic || "â€”"}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(f.creditLimit)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${(f.balance || 0) > 0 ? "text-purple-600" : (f.balance || 0) < 0 ? "text-red-600" : "text-gray-600"}`}>
                        {formatCurrency(f.balance || 0)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">{f._count?.purchases || 0}</td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openDetail(f)}
                            className="p-1 text-gray-400 hover:text-blue-600"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openPayment(f)}
                            className="p-1 text-gray-400 hover:text-purple-700"
                            title="Record Payment"
                          >
                            <Banknote className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEdit(f)} className="p-1 text-gray-400 hover:text-blue-600">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(f.id, f.name)} className="p-1 text-gray-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Ledger */}
                    {expanded[f.id] && (
                      <tr key={`${f.id}-ledger`} className="bg-green-50/20 border-b border-green-100">
                        <td colSpan={10} className="px-4 py-4">
                          <div className="ml-6">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                                <BookOpen className="w-3.5 h-3.5" /> Farmer Ledger
                              </p>
                              <button
                                onClick={() => openPayment(f)}
                                className="flex items-center gap-1 text-xs text-purple-700 hover:text-purple-900 font-medium border border-green-200 rounded px-2 py-1 hover:bg-green-50"
                              >
                                <Banknote className="w-3 h-3" /> Record Payment
                              </button>
                            </div>
                            {expanded[f.id].ledger?.length === 0 ? (
                              <p className="text-xs text-gray-400">No transactions yet</p>
                            ) : (
                              <div className="space-y-2">
                                {selectedPayments.size > 0 && (
                                  <div className="flex items-center gap-2 bg-blue-50 p-2 rounded border border-blue-200">
                                    <span className="text-xs font-medium text-blue-900">{selectedPayments.size} payment(s) selected</span>
                                    <button onClick={() => showDeleteConfirmModal(f.id)} className="ml-auto px-2 py-1 bg-red-600 text-blue-900 text-xs rounded hover:bg-red-700">
                                      Delete Selected
                                    </button>
                                  </div>
                                )}
                                <table className="w-full text-xs border border-blue-300 rounded">
                                  <thead className="bg-blue-50">
                                    <tr className="border-b border-blue-300">
                                      <th className="px-2 py-2 text-center w-6"></th>
                                      <th className="px-3 py-2 text-left text-gray-500">Date</th>
                                      <th className="px-3 py-2 text-left text-gray-500">Description</th>
                                      <th className="px-3 py-2 text-right text-red-600">Debit (Dr)</th>
                                      <th className="px-3 py-2 text-right text-purple-700">Credit (Cr)</th>
                                      <th className="px-3 py-2 text-right text-gray-700">Balance</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {expanded[f.id].ledger.map((e: any, li: number) => {
                                      const isDeletable = e.type === "PAYMENT" || e.type === "INCOME"
                                      const isSelected = isDeletable && selectedPayments.has(e.id || li)
                                      return (
                                        <tr key={li} className="border-b border-gray-50">
                                          <td className="px-2 py-2 text-center">
                                            {isDeletable && (
                                              <input type="checkbox" checked={isSelected} onChange={(evt) => {
                                                const newSet = new Set(selectedPayments)
                                                if (evt.target.checked) newSet.add(e.id || li)
                                                else newSet.delete(e.id || li)
                                                setSelectedPayments(newSet)
                                              }} className="w-3 h-3" />
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-gray-500">{formatDate(e.date)}</td>
                                          <td className="px-3 py-2 text-gray-600">{e.description}</td>
                                          <td className="px-3 py-2 text-right text-red-600">{e.debit > 0 ? formatCurrency(e.debit) : "â€”"}</td>
                                          <td className="px-3 py-2 text-right text-purple-700">{e.credit > 0 ? formatCurrency(e.credit) : "â€”"}</td>
                                          <td className={`px-3 py-2 text-right font-semibold ${e.balance > 0 ? "text-red-600" : "text-gray-500"}`}>
                                            {formatCurrency(Math.abs(e.balance))} {e.balance > 0 ? "Dr" : e.balance < 0 ? "Cr" : ""}
                                          </td>
                                        </tr>
                                      )
                                    })}
                                    <tr className="bg-blue-50 border-t-2 border-blue-300">
                                      <td colSpan={3} className="px-3 py-2 font-bold text-gray-700 text-xs">Closing Balance</td>
                                      <td className="px-3 py-2 text-right font-bold text-gray-900 text-xs">{formatCurrency((expanded[f.id].ledger || []).reduce((s: number, e: any) => s + e.debit, 0))}</td>
                                      <td className="px-3 py-2 text-right font-bold text-purple-700 text-xs">{formatCurrency((expanded[f.id].ledger || []).reduce((s: number, e: any) => s + e.credit, 0))}</td>
                                      <td className="px-3 py-2 text-right font-bold text-gray-700 text-xs">{formatCurrency(Math.abs((expanded[f.id].ledger || [])[expanded[f.id].ledger?.length - 1]?.balance || 0))} {((expanded[f.id].ledger || [])[expanded[f.id].ledger?.length - 1]?.balance || 0) > 0 ? "Dr" : "Cr"}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">No farmers found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Farmer Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Farmer" : "Add Farmer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div><Label>Full Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Farmer name" autoFocus /></div>
            <div>
              <Label>Profile Picture (Optional)</Label>
              {photoPreview && (
                <div className="mb-2 relative">
                  <img src={photoPreview} alt="Preview" className="w-20 h-20 rounded-lg object-cover" />
                  <button onClick={() => { setPhotoPreview(""); setForm({ ...form, picture: "" }); }} className="absolute -top-2 -right-2 bg-red-500 text-blue-900 rounded-full w-6 h-6 flex items-center justify-center text-xs">âœ•</button>
                </div>
              )}
              <div className="flex gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-green-400 rounded-lg cursor-pointer hover:bg-green-50 transition">
                  <Upload className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-700">Upload Photo</span>
                  <input type="file" accept="image/*" hidden onChange={(e) => {
                    const file = e.target.files?.[0]; if (file) {
                      const reader = new FileReader(); reader.onload = (ev) => {
                        const base64 = ev.target?.result as string; setPhotoPreview(base64); setForm({ ...form, picture: base64 });
                      }; reader.readAsDataURL(file);
                    }
                  }} />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="03001234567" /></div>
              <div><Label>Other Number (Optional)</Label>
                <Input value={form.otherPhone} onChange={(e) => setForm({ ...form, otherPhone: e.target.value })} placeholder="03009876543" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Village / Area</Label>
                <Input value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} placeholder="Village name" /></div>
              <div><Label>CNIC (Optional)</Label>
                <Input value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} placeholder="35202-..." /></div>
            </div>
            <div><Label>Address (Optional)</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full address" /></div>
            <div><Label>Credit Limit (PKR)</Label>
              <Input type="number" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} /></div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} className="flex-1 bg-purple-700 hover:bg-purple-800">
                {editing ? "Update" : "Add Farmer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Receipt Print Template */}
      {lastPayment && showPayModal && (
        <div className="hidden print:block fixed inset-0 bg-blue-50 z-[9999] p-10">
          <div className="max-w-xs mx-auto">
            <div className="text-center border-b-2 border-gray-800 pb-4 mb-5">
              <h1 className="text-2xl font-bold text-gray-900">Argo-Firn</h1>
              <p className="text-sm text-gray-500">{lastPayment.paymentType === "RECEIVE" ? "Payment Receipt (Received)" : "Payment Receipt"}</p>
              <p className="text-xs text-gray-400 mt-1">{new Date().toLocaleString("en-PK")}</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Farmer:</span><span className="font-semibold">{lastPayment.name}</span></div>
              {lastPayment.phone && <div className="flex justify-between"><span className="text-gray-500">Phone:</span><span>{lastPayment.phone}</span></div>}
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">{lastPayment.paymentType === "RECEIVE" ? "Amount Received:" : "Amount Paid:"}</span>
                  <span className="text-lg font-bold text-purple-700">{formatCurrency(lastPayment.amount)}</span>
                </div>
                <div className="flex justify-between mt-1"><span className="text-gray-500">Method:</span><span>{lastPayment.method.replace("_", " ")}</span></div>
                {lastPayment.notes && <div className="flex justify-between mt-1"><span className="text-gray-500">Notes:</span><span>{lastPayment.notes}</span></div>}
              </div>
              <div className="border-t-2 border-gray-800 pt-2 flex justify-between font-bold text-base">
                <span>Balance:</span>
                <span className={lastPayment.balance > 0 ? "text-red-700" : lastPayment.balance < 0 ? "text-blue-700" : "text-purple-700"}>
                  {formatCurrency(Math.abs(lastPayment.balance))} {lastPayment.balance > 0 ? "Payable" : lastPayment.balance < 0 ? "Advance" : "Settled"}
                </span>
              </div>
            </div>
            <p className="mt-8 text-center text-xs text-gray-400 border-t pt-4">Argo-Firn â€” Farmer Account</p>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <Dialog open={showPayModal} onOpenChange={(open) => { setShowPayModal(open); if (!open) setLastPayment(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {lastPayment ? <Check className="w-5 h-5 text-purple-600" /> : <Banknote className="w-5 h-5 text-purple-700" />}
              {lastPayment ? "Payment Recorded" : "Record Payment"}
            </DialogTitle>
          </DialogHeader>

          {lastPayment ? (
            <div className="space-y-4">
              <div className={`rounded-lg p-4 text-center ${lastPayment.paymentType === "RECEIVE" ? "bg-blue-50" : "bg-green-50"}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${lastPayment.paymentType === "RECEIVE" ? "bg-blue-100" : "bg-green-100"}`}>
                  <Check className={`w-5 h-5 ${lastPayment.paymentType === "RECEIVE" ? "text-blue-700" : "text-purple-700"}`} />
                </div>
                <p className="font-semibold text-gray-900">{lastPayment.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{lastPayment.paymentType === "RECEIVE" ? "Received from Farmer" : "Paid to Farmer"}</p>
              </div>
              <div className="border border-blue-300 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-bold text-purple-700">{formatCurrency(lastPayment.amount)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Method</span><span>{lastPayment.method.replace("_", " ")}</span></div>
                {lastPayment.notes && <div className="flex justify-between"><span className="text-gray-500">Notes</span><span className="text-xs">{lastPayment.notes}</span></div>}
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span className="text-gray-600">New Balance</span>
                  <span className={lastPayment.balance > 0 ? "text-red-600" : lastPayment.balance < 0 ? "text-blue-600" : "text-purple-700"}>
                    {formatCurrency(Math.abs(lastPayment.balance))} {lastPayment.balance > 0 ? "Payable" : lastPayment.balance < 0 ? "Advance" : ""}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setShowPayModal(false); setLastPayment(null) }} className="flex-1">Close</Button>
                <Button onClick={() => window.print()} className="flex-1 bg-purple-700 hover:bg-purple-800 gap-2">
                  <Printer className="w-4 h-4" /> Print Receipt
                </Button>
              </div>
            </div>
          ) : payingFarmer && (
            <div className="space-y-4">
              <div className="bg-green-50 rounded-lg px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">{payingFarmer.name}</p>
                {payingFarmer.phone && <p className="text-xs text-gray-500">{payingFarmer.phone}</p>}
                {(payingFarmer.balance || 0) > 0 && (
                  <p className="text-xs text-red-600 mt-1">Outstanding: {formatCurrency(payingFarmer.balance)}</p>
                )}
              </div>

              <div>
                <Label className="mb-2 block">Payment Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setPayForm({ ...payForm, paymentType: "PAY" })}
                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${payForm.paymentType === "PAY" ? "bg-purple-700 text-blue-900 border-purple-700" : "bg-blue-50 text-gray-600 border-blue-300 hover:border-green-300"}`}>
                    Paid to Farmer
                    <p className="text-xs font-normal opacity-75 mt-0.5">Paying farmer (Cr)</p>
                  </button>
                  <button type="button" onClick={() => setPayForm({ ...payForm, paymentType: "RECEIVE" })}
                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${payForm.paymentType === "RECEIVE" ? "bg-blue-600 text-blue-900 border-blue-600" : "bg-blue-50 text-gray-600 border-blue-300 hover:border-blue-300"}`}>
                    Received
                    <p className="text-xs font-normal opacity-75 mt-0.5">Income received (Dr)</p>
                  </button>
                </div>
              </div>

              <div>
                <Label>Amount (PKR) *</Label>
                <Input type="number" placeholder="0" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} autoFocus />
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea rows={2} placeholder="Optional notes..." value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowPayModal(false)} className="flex-1">Cancel</Button>
                <Button onClick={handlePayment} disabled={payLoading} className="flex-1 bg-purple-700 hover:bg-purple-800">
                  {payLoading ? "Saving..." : "Record Payment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
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
                âš ï¸ <strong>Warning:</strong> This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)} disabled={deletingPayments}>
              Cancel
            </Button>
            <Button
              onClick={() => showDeleteConfirm && confirmDelete(showDeleteConfirm)}
              disabled={deletingPayments}
              className="bg-white hover:bg-gray-100 text-gray-900 border border-gray-300"
            >
              {deletingPayments ? "Deleting..." : "Delete Transactions"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle>Farmer Details</DialogTitle>
              <p className="text-xs text-gray-500 mt-1">View farmer account, purchases & sales</p>
            </div>
            <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">âœ•</button>
          </DialogHeader>

          {farmerDetail && selectedFarmer && (
            <div className="space-y-6">
              {/* Farmer Info */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-blue-300">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Name</p>
                  <p className="font-semibold text-gray-900">{selectedFarmer.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Village</p>
                  <p className="font-semibold text-gray-900">{selectedFarmer.village || "â€”"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Phone</p>
                  <p className="font-semibold text-gray-900">{selectedFarmer.phone || "â€”"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">CNIC</p>
                  <p className="font-semibold text-gray-900">{selectedFarmer.cnic || "â€”"}</p>
                </div>
              </div>

              {/* Balance Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-xs text-blue-600 font-semibold mb-1">Total Purchased</p>
                  <p className="text-lg font-bold text-blue-900">{formatCurrency(farmerDetail.ledger?.reduce((s: number, e: any) => s + (e.type === "PURCHASE" ? e.debit : 0), 0) || 0)}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-xs text-purple-600 font-semibold mb-1">Total Paid</p>
                  <p className="text-lg font-bold text-purple-900">{formatCurrency(farmerDetail.ledger?.reduce((s: number, e: any) => s + (e.type === "PAYMENT" ? e.debit : 0), 0) || 0)}</p>
                </div>
                <div className={`border-2 rounded-lg p-4 ${selectedFarmer.balance > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                  <p className={`text-xs font-semibold mb-1 ${selectedFarmer.balance > 0 ? "text-red-600" : "text-purple-600"}`}>Balance</p>
                  <p className={`text-lg font-bold ${selectedFarmer.balance > 0 ? "text-red-900" : "text-purple-900"}`}>
                    {formatCurrency(Math.abs(selectedFarmer.balance))} {selectedFarmer.balance > 0 ? "Dr" : "Cr"}
                  </p>
                </div>
              </div>

              {/* Purchases Section */}
              {farmerDetail.purchases && farmerDetail.purchases.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4" /> Purchases ({farmerDetail.purchases.length})
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {farmerDetail.purchases.map((p: any) => (
                      <div key={p.id} className="bg-blue-50 rounded p-3 text-sm border border-blue-300">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">{p.items.map((i: any) => i.product?.name || "Item").join(", ")}</p>
                            <p className="text-xs text-gray-500 mt-1">{formatDate(p.createdAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">{formatCurrency(p.totalAmount)}</p>
                            <p className={`text-xs ${p.status === "PAID" ? "text-purple-600" : p.status === "PARTIAL" ? "text-blue-600" : "text-gray-600"}`}>
                              {p.status}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sales Section */}
              {farmerDetail.sales && farmerDetail.sales.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" /> Sales to Farmer ({farmerDetail.sales.length})
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {farmerDetail.sales.map((s: any) => (
                      <div key={s.id} className="bg-blue-50 rounded p-3 text-sm border border-blue-300">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">{s.items.map((i: any) => i.product?.name || "Item").join(", ")}</p>
                            <p className="text-xs text-gray-500 mt-1">{formatDate(s.createdAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">{formatCurrency(s.totalAmount)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ledger Section */}
              {farmerDetail.ledger && farmerDetail.ledger.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" /> Account Ledger ({farmerDetail.ledger.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-blue-50">
                        <tr>
                          <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Date</th>
                          <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Description</th>
                          <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs">Debit (Dr)</th>
                          <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs">Credit (Cr)</th>
                          <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {farmerDetail.ledger.map((e: any, i: number) => (
                          <tr key={i}>
                            <td className="py-2 px-3 text-gray-500 whitespace-nowrap text-xs">{formatDate(e.date)}</td>
                            <td className="py-2 px-3 text-gray-700 text-xs">{e.description}</td>
                            <td className="py-2 px-3 text-right font-medium text-gray-900">{e.debit > 0 ? formatCurrency(e.debit) : "â€”"}</td>
                            <td className="py-2 px-3 text-right text-purple-700">{e.credit > 0 ? formatCurrency(e.credit) : "â€”"}</td>
                            <td className={`py-2 px-3 text-right font-semibold ${e.balance > 0 ? "text-red-600" : "text-purple-700"}`}>
                              {formatCurrency(Math.abs(e.balance))} {e.balance > 0 ? "Dr" : e.balance < 0 ? "Cr" : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

