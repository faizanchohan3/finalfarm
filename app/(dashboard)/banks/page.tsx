"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Building2, Plus, PencilLine, Trash2, ArrowDownCircle, ArrowUpCircle, Check } from "lucide-react"

const DEFAULT_FORM = { name: "", accountNumber: "" }
const todayStr = () => new Date().toISOString().slice(0, 10)
const DEFAULT_TXN = { type: "CREDIT", amount: "", description: "", reference: "", date: todayStr() }

export default function BanksPage() {
  const [banks, setBanks] = useState<any[]>([])
  const [firstLoad, setFirstLoad] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  // Direct credit/debit recording
  const [showTxnModal, setShowTxnModal] = useState(false)
  const [txnBank, setTxnBank] = useState<any>(null)
  const [txnForm, setTxnForm] = useState(DEFAULT_TXN)
  const [txnSaving, setTxnSaving] = useState(false)
  const [txnDone, setTxnDone] = useState(false)

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

  function openTxn(bank: any) {
    setTxnBank(bank)
    setTxnForm(DEFAULT_TXN)
    setTxnDone(false)
    setShowTxnModal(true)
  }

  async function handleSaveTxn() {
    const amt = parseFloat(txnForm.amount)
    if (!amt || amt <= 0) return alert("Enter a valid amount")
    if (!txnForm.description.trim()) return alert("Enter a description")
    setTxnSaving(true)
    const res = await fetch("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: txnForm.type, // CREDIT = money in, DEBIT = money out
        amount: amt,
        description: txnForm.description.trim(),
        reference: txnForm.reference.trim() || null,
        category: txnForm.type === "CREDIT" ? "Bank Deposit" : "Bank Withdrawal",
        bankId: txnBank.id,
        transactionDate: txnForm.date || undefined,
      }),
    })
    setTxnSaving(false)
    if (res.ok) {
      setTxnDone(true)
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data?.error || "Failed to record transaction. Please try again.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bank Accounts</h2>
          <p className="text-gray-500 text-sm">Manage your bank accounts used in transactions</p>
        </div>
        <Button onClick={openAdd} className="bg-white hover:bg-gray-100 text-gray-900 border border-gray-300 gap-2">
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
                  <tr className="border-b border-blue-300">
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">#</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Bank Name</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Account Number</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Added On</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {banks.map((bank, i) => (
                    <tr key={bank.id} className="border-b border-gray-50 hover:bg-blue-50">
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
                            onClick={() => openTxn(bank)}
                            disabled={bank.id.startsWith("temp-")}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors disabled:opacity-40"
                          >
                            <ArrowDownCircle className="w-3.5 h-3.5" /> Record
                          </button>
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
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-purple-700 hover:bg-purple-800">
                {saving ? "Saving..." : editing ? "Update Bank" : "Add Bank"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Credit / Debit Modal */}
      <Dialog open={showTxnModal} onOpenChange={(open) => { setShowTxnModal(open); if (!open) setTxnDone(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {txnDone ? <Check className="w-5 h-5 text-emerald-600" /> : <Building2 className="w-5 h-5 text-blue-600" />}
              {txnDone ? "Transaction Recorded" : "Record Bank Transaction"}
            </DialogTitle>
          </DialogHeader>

          {txnDone ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 rounded-lg p-4 text-center">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Check className="w-5 h-5 text-emerald-700" />
                </div>
                <p className="font-semibold text-gray-900">
                  {txnForm.type === "CREDIT" ? "Credit (Money In)" : "Debit (Money Out)"} recorded
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Rs {parseFloat(txnForm.amount || "0").toLocaleString()} · {txnBank?.name}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  This entry now appears in the Bank Transactions report.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowTxnModal(false)} className="flex-1">Close</Button>
                <Button
                  onClick={() => { setTxnForm({ ...DEFAULT_TXN }); setTxnDone(false) }}
                  className="flex-1 bg-purple-700 hover:bg-purple-800"
                >
                  Record Another
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{txnBank?.name}</p>
                  {txnBank?.accountNumber && <p className="text-xs text-gray-500">{txnBank.accountNumber}</p>}
                </div>
              </div>

              {/* Credit / Debit toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTxnForm({ ...txnForm, type: "CREDIT" })}
                  className={`py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    txnForm.type === "CREDIT"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <ArrowDownCircle className="w-4 h-4" /> Credit (In)
                </button>
                <button
                  type="button"
                  onClick={() => setTxnForm({ ...txnForm, type: "DEBIT" })}
                  className={`py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    txnForm.type === "DEBIT"
                      ? "border-red-600 bg-red-50 text-red-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <ArrowUpCircle className="w-4 h-4" /> Debit (Out)
                </button>
              </div>
              <p className="text-xs text-gray-400 -mt-2">
                {txnForm.type === "CREDIT"
                  ? "Money deposited into this bank account (inflow)."
                  : "Money paid out / withdrawn from this bank account (outflow)."}
              </p>

              <div>
                <Label>Amount (PKR) *</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={txnForm.amount}
                  onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <Label>Description *</Label>
                <Input
                  placeholder="e.g. Cash deposit, Utility bill payment"
                  value={txnForm.description}
                  onChange={(e) => setTxnForm({ ...txnForm, description: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveTxn()}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={txnForm.date}
                    onChange={(e) => setTxnForm({ ...txnForm, date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Reference (optional)</Label>
                  <Input
                    placeholder="Cheque no., slip #"
                    value={txnForm.reference}
                    onChange={(e) => setTxnForm({ ...txnForm, reference: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setShowTxnModal(false)} className="flex-1">Cancel</Button>
                <Button
                  onClick={handleSaveTxn}
                  disabled={txnSaving}
                  className={`flex-1 ${txnForm.type === "CREDIT" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
                >
                  {txnSaving ? "Recording..." : txnForm.type === "CREDIT" ? "Record Credit" : "Record Debit"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

