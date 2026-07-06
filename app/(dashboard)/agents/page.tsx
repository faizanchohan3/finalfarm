"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Plus, Search, UserCog, Edit, ChevronDown, ChevronRight, DollarSign } from "lucide-react"

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState<any>(null)
  const [editing, setEditing] = useState<any>(null)
  const [expanded, setExpanded] = useState<Record<string, any>>({})
  const [loadingRow, setLoadingRow] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", phone: "", address: "", cnic: "", commissionRate: "2.5" })
  const [payForm, setPayForm] = useState({ type: "CREDIT", amount: "", rate: "", saleValue: "", notes: "" })

  async function loadData() {
    try {
      setLoading(true)
      const d = await fetch("/api/agents").then((r) => r.json())
      setAgents(d.agents || [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { loadData() }, [])

  async function toggleExpand(id: string) {
    if (expanded[id]) { setExpanded((p) => { const n = { ...p }; delete n[id]; return n }); return }
    setLoadingRow(id)
    const d = await fetch(`/api/agents/${id}`).then((r) => r.json())
    setExpanded((p) => ({ ...p, [id]: d }))
    setLoadingRow(null)
  }

  async function handleSave() {
    if (!form.name.trim()) return alert("Name is required")
    const url = editing ? `/api/agents/${editing.id}` : "/api/agents"
    const method = editing ? "PUT" : "POST"
    await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, commissionRate: parseFloat(form.commissionRate) || 2.5 }),
    })
    setShowModal(false); loadData()
  }

  async function handleAddCommission() {
    if (!payForm.amount) return alert("Amount is required")
    await fetch(`/api/agents/${showPayModal.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: payForm.type,
        amount: parseFloat(payForm.amount),
        rate: parseFloat(payForm.rate) || null,
        saleValue: parseFloat(payForm.saleValue) || null,
        notes: payForm.notes,
      }),
    })
    setShowPayModal(null)
    setPayForm({ type: "CREDIT", amount: "", rate: "", saleValue: "", notes: "" })
    loadData()
  }

  const filtered = agents.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.phone || "").includes(search)
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Commission Agents (Aadat)</h2>
          <p className="text-gray-500 text-sm">Manage aadat agents, commissions & ledgers</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ name: "", phone: "", address: "", cnic: "", commissionRate: "2.5" }); setShowModal(true) }}
          className="bg-orange-600 hover:bg-orange-700 gap-2">
          <Plus className="w-4 h-4" /> Add Agent
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Total Agents</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{agents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Total Earned</p>
            <p className="text-xl font-bold text-green-700 mt-1">
              {formatCurrency(agents.reduce((s, a) => s + (a.totalEarned || 0), 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Total Paid Out</p>
            <p className="text-xl font-bold text-red-600 mt-1">
              {formatCurrency(agents.reduce((s, a) => s + (a.totalPaid || 0), 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Payable Balance</p>
            <p className="text-xl font-bold text-orange-600 mt-1">
              {formatCurrency(agents.reduce((s, a) => s + (a.totalEarned || 0) - (a.totalPaid || 0), 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search name or phone..." value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCog className="w-4 h-4" /> Agents ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-t">
                <tr>
                  <th className="px-4 py-3 w-8" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Agent Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Phone</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Rate %</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total Earned</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Paid Out</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Balance</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && !agents.length ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
                ) : filtered.map((a, i) => (
                  <>
                    <tr key={a.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${expanded[a.id] ? "bg-orange-50/30" : ""}`}
                      onClick={() => toggleExpand(a.id)}
                    >
                      <td className="px-4 py-3">
                        {loadingRow === a.id
                          ? <div className="w-3.5 h-3.5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                          : expanded[a.id] ? <ChevronDown className="w-3.5 h-3.5 text-orange-600" />
                          : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{a.name}</td>
                      <td className="px-4 py-3 text-gray-600">{a.phone || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full font-medium">{a.commissionRate}%</span>
                      </td>
                      <td className="px-4 py-3 text-right text-green-700 font-medium">{formatCurrency(a.totalEarned || 0)}</td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium">{formatCurrency(a.totalPaid || 0)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${((a.totalEarned || 0) - (a.totalPaid || 0)) > 0 ? "text-orange-600" : "text-gray-400"}`}>
                        {formatCurrency((a.totalEarned || 0) - (a.totalPaid || 0))}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setEditing(a); setForm({ name: a.name, phone: a.phone || "", address: a.address || "", cnic: a.cnic || "", commissionRate: String(a.commissionRate) }); setShowModal(true) }}
                            className="p-1 text-gray-400 hover:text-blue-600"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => setShowPayModal(a)}
                            className="p-1 text-gray-400 hover:text-green-600" title="Add commission"><DollarSign className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                    {expanded[a.id] && (
                      <tr key={`${a.id}-ledger`} className="bg-orange-50/20 border-b border-orange-100">
                        <td colSpan={9} className="px-4 py-4">
                          <div className="ml-6">
                            <p className="text-xs font-semibold text-gray-600 mb-2">Commission Ledger</p>
                            {!expanded[a.id].ledger?.length ? (
                              <p className="text-xs text-gray-400">No transactions yet</p>
                            ) : (
                              <table className="w-full text-xs border border-gray-100 rounded">
                                <thead className="bg-white">
                                  <tr className="border-b border-gray-100">
                                    <th className="px-3 py-2 text-left text-gray-500">Date</th>
                                    <th className="px-3 py-2 text-left text-gray-500">Notes</th>
                                    <th className="px-3 py-2 text-right text-green-700">Earned (Cr)</th>
                                    <th className="px-3 py-2 text-right text-red-600">Paid (Dr)</th>
                                    <th className="px-3 py-2 text-right text-gray-700">Balance</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {expanded[a.id].ledger.map((e: any, li: number) => (
                                    <tr key={li} className="border-b border-gray-50">
                                      <td className="px-3 py-2 text-gray-500">{formatDate(e.createdAt)}</td>
                                      <td className="px-3 py-2 text-gray-600">{e.notes || (e.type === "CREDIT" ? "Commission earned" : "Commission paid")}</td>
                                      <td className="px-3 py-2 text-right text-green-700">{e.type === "CREDIT" ? formatCurrency(e.amount) : "—"}</td>
                                      <td className="px-3 py-2 text-right text-red-600">{e.type === "DEBIT" ? formatCurrency(e.amount) : "—"}</td>
                                      <td className="px-3 py-2 text-right font-semibold">{formatCurrency(Math.abs(e.balance))} {e.balance > 0 ? "Dr" : "Cr"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No agents found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Agent" : "Add Agent"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Agent Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Commission Rate %</Label>
                <Input type="number" step="0.1" value={form.commissionRate}
                  onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} /></div>
            </div>
            <div><Label>CNIC</Label>
              <Input value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} /></div>
            <div><Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} className="flex-1 bg-orange-600 hover:bg-orange-700">{editing ? "Update" : "Add Agent"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Commission Entry Modal */}
      <Dialog open={!!showPayModal} onOpenChange={() => setShowPayModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Commission Entry — {showPayModal?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Type</Label>
              <Select value={payForm.type} onValueChange={(v) => setPayForm({ ...payForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CREDIT">Commission Earned (Cr)</SelectItem>
                  <SelectItem value="DEBIT">Payment Made (Dr)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount (PKR) *</Label>
                <Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></div>
              {payForm.type === "CREDIT" && (
                <div><Label>Sale Value</Label>
                  <Input type="number" value={payForm.saleValue} onChange={(e) => setPayForm({ ...payForm, saleValue: e.target.value })} /></div>
              )}
            </div>
            <div><Label>Notes</Label>
              <Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} /></div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowPayModal(null)} className="flex-1">Cancel</Button>
              <Button onClick={handleAddCommission} className="flex-1 bg-orange-600 hover:bg-orange-700">Save Entry</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
