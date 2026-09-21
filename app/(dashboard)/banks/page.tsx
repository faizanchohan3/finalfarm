"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Building2, Plus, PencilLine, Trash2, ArrowDownCircle, ArrowUpCircle, Check, BookOpen } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

const DEFAULT_FORM = { name: "", accountNumber: "" }
const todayStr = () => new Date().toISOString().slice(0, 10)
const DEFAULT_TXN = { type: "CREDIT", amount: "", description: "", reference: "", date: todayStr() }
// Entry types from /api/reports/bank-transactions that bring money into the bank.
const isInflow = (type: string) => type === "RECEIPT" || type === "INCOME"
const ENTRY_LABELS: Record<string, string> = {
  RECEIPT: "Receipt", PAYMENT: "Payment", FARMER_PAYMENT: "Farmer Pay",
  DRIVER_PAYMENT: "Driver Pay", INCOME: "Credit", EXPENSE: "Debit",
}

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

  // Ledger / transaction history
  const [ledgerBank, setLedgerBank] = useState<any>(null)
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerFrom, setLedgerFrom] = useState("")
  const [ledgerTo, setLedgerTo] = useState("")

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

  async function openLedger(bank: any) {
    setLedgerBank(bank)
    setLedgerFrom(""); setLedgerTo("")
    setLedgerEntries([])
    setLedgerLoading(true)
    try {
      const data = await fetch(`/api/reports/bank-transactions?bankId=${bank.id}`).then((r) => r.json())
      setLedgerEntries(data.entries || [])
    } catch {
      setLedgerEntries([])
    } finally {
      setLedgerLoading(false)
    }
  }

  // Oldest first with running balance; entries before "from" roll into the opening balance.
  const ledger = (() => {
    const fromTs = ledgerFrom ? new Date(ledgerFrom).getTime() : -Infinity
    const toTs = ledgerTo ? new Date(`${ledgerTo}T23:59:59.999`).getTime() : Infinity
    const sorted = [...ledgerEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    let opening = 0
    let balance = 0
    let totalIn = 0
    let totalOut = 0
    const rows: any[] = []
    for (const e of sorted) {
      const ts = new Date(e.date).getTime()
      const signed = isInflow(e.type) ? e.amount : -e.amount
      if (ts < fromTs) { opening += signed; continue }
      if (ts > toTs) continue
      if (rows.length === 0) balance = opening
      balance += signed
      if (signed >= 0) totalIn += e.amount; else totalOut += e.amount
      rows.push({ ...e, balance })
    }
    return { opening, rows, totalIn, totalOut, closing: rows.length ? balance : opening }
  })()

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
      <div className="flex items-center justify-between gap-2 flex-wrap">
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
                        <div className="flex items-center gap-2 flex-wrap">
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => openLedger(bank)}
                            disabled={bank.id.startsWith("temp-")}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors disabled:opacity-40"
                          >
                            <BookOpen className="w-3.5 h-3.5" /> Ledger
                          </button>
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
            <DialogTitle className="flex items-center gap-2 flex-wrap">
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

      {/* Ledger / Transaction History Modal */}
      <Dialog open={!!ledgerBank} onOpenChange={(open) => { if (!open) setLedgerBank(null) }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <BookOpen className="w-5 h-5 text-purple-600" />
              Ledger — {ledgerBank?.name}
              {ledgerBank?.accountNumber && <span className="text-sm font-normal text-gray-500">({ledgerBank.accountNumber})</span>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap items-end">
              <div>
                <Label>From</Label>
                <Input type="date" value={ledgerFrom} onChange={(e) => setLedgerFrom(e.target.value)} />
              </div>
              <div>
                <Label>To</Label>
                <Input type="date" value={ledgerTo} onChange={(e) => setLedgerTo(e.target.value)} />
              </div>
              {(ledgerFrom || ledgerTo) && (
                <Button variant="outline" onClick={() => { setLedgerFrom(""); setLedgerTo("") }}>Clear</Button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Opening</p>
                <p className="font-semibold text-gray-900">{formatCurrency(ledger.opening)}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">Total In</p>
                <p className="font-semibold text-emerald-700">{formatCurrency(ledger.totalIn)}</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3">
                <p className="text-xs text-red-700">Total Out</p>
                <p className="font-semibold text-red-700">{formatCurrency(ledger.totalOut)}</p>
              </div>
              <div className="rounded-lg bg-purple-50 p-3">
                <p className="text-xs text-purple-700">Balance</p>
                <p className="font-semibold text-purple-700">{formatCurrency(ledger.closing)}</p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[50vh] overflow-y-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Type</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Description</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Ref</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">In</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Out</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerLoading ? (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>
                  ) : ledger.rows.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">No transactions</td></tr>
                  ) : ledger.rows.map((e) => (
                    <tr key={`${e.type}-${e.id}`} className="border-b border-gray-50">
                      <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{formatDate(e.date)}</td>
                      <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{ENTRY_LABELS[e.type] || e.type}</td>
                      <td className="py-2 px-3 text-gray-900">{e.description}</td>
                      <td className="py-2 px-3 text-gray-500">{e.reference || "—"}</td>
                      <td className="py-2 px-3 text-right text-emerald-700 whitespace-nowrap">{isInflow(e.type) ? formatCurrency(e.amount) : ""}</td>
                      <td className="py-2 px-3 text-right text-red-600 whitespace-nowrap">{isInflow(e.type) ? "" : formatCurrency(e.amount)}</td>
                      <td className={`py-2 px-3 text-right font-medium whitespace-nowrap ${e.balance < 0 ? "text-red-600" : "text-gray-900"}`}>{formatCurrency(e.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Credit / Debit Modal */}
      <Dialog open={showTxnModal} onOpenChange={(open) => { setShowTxnModal(open); if (!open) setTxnDone(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
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
              <div className="flex gap-3 flex-wrap">
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

