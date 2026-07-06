"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency, formatDateTime, formatDate } from "@/lib/utils"
import {
  Plus, TrendingUp, TrendingDown, Wallet, ArrowUpCircle, ArrowDownCircle,
  Building2, Banknote, CreditCard, ChevronDown, Trash2,
} from "lucide-react"

export default function FinancePage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 })
  const [banks, setBanks] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ type: "CREDIT", amount: "", description: "", reference: "", category: "", bankId: "", accountId: "", entryType: "DEBIT", transactionDate: new Date().toISOString().split('T')[0] })
  const [dateFilter, setDateFilter] = useState({ from: "", to: "" })

  async function loadData() {
    try {
      setLoading(true)
      const [txData, bankData] = await Promise.all([
        fetch("/api/finance").then((r) => r.json()),
        fetch("/api/banks").then((r) => r.json()),
      ])
      setTransactions(txData.transactions || [])
      setSummary({ income: txData.income || 0, expense: txData.expense || 0, balance: txData.balance || 0 })
      setBanks(bankData.banks || [])
    } finally {
      setLoading(false)
    }
    fetch("/api/accounts").then((r) => r.json()).then((d) => setAccounts(d.accounts || [])).catch(() => {})
  }

  useEffect(() => { loadData() }, [])

  async function handleSave() {
    if (!form.amount || parseFloat(form.amount) <= 0) return alert("Enter a valid amount")
    if (!form.description.trim()) return alert("Description is required")
    setSaving(true)
    const res = await fetch("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount), bankId: form.bankId || null, accountId: form.accountId || null }),
    })
    setSaving(false)
    if (res.ok) {
      setShowModal(false)
      setShowMoreCats(false)
      setForm({ type: "CREDIT", amount: "", description: "", reference: "", category: "", bankId: "", accountId: "", entryType: "DEBIT", transactionDate: new Date().toISOString().split('T')[0] })
      loadData()
    }
  }

  function openModal() {
    setShowMoreCats(false)
    setForm({ type: "CREDIT", amount: "", description: "", reference: "", category: "", bankId: "", accountId: "", entryType: "DEBIT", transactionDate: new Date().toISOString().split('T')[0] })
    setShowModal(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/finance/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      setShowDeleteConfirm(false)
      setDeleteTarget(null)
      await loadData()
    } catch (error) {
      alert("Error deleting transaction: " + (error instanceof Error ? error.message : "Unknown error"))
    } finally {
      setDeleting(false)
    }
  }

  function openEdit(t: any) {
    setEditingTransaction(t)
    setEditForm({
      description: t.description,
      amount: t.amount.toString(),
      category: t.category || "",
      reference: t.reference || "",
    })
    setShowEditModal(true)
  }

  async function handleSaveEdit() {
    if (!editingTransaction || !editForm.description.trim()) return alert("Description is required")
    setSaving(true)
    try {
      const res = await fetch(`/api/finance/${editingTransaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editForm.description,
          amount: parseFloat(editForm.amount),
          category: editForm.category,
          reference: editForm.reference,
        }),
      })
      if (!res.ok) throw new Error("Update failed")
      setShowEditModal(false)
      setEditingTransaction(null)
      await loadData()
    } catch (error) {
      alert("Error updating transaction: " + (error instanceof Error ? error.message : "Unknown error"))
    } finally {
      setSaving(false)
    }
  }

  const [saving, setSaving] = useState(false)
  const [showMoreCats, setShowMoreCats] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailType, setDetailType] = useState<"income" | "expense" | "balance" | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description: string; amount: number } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ description: "", amount: "", category: "", reference: "" })

  const INCOME_CATS  = ["Sales", "Commission", "Pesticide Sale", "Rent Received", "Other Income"]
  const EXPENSE_CATS = ["Purchases", "Salary", "Rent", "Utilities", "Transport", "Labour", "Repair", "Miscellaneous"]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Roznamcha</h2>
          <p className="text-gray-500 text-sm">Track income, expenses, and balance</p>
        </div>
        <div className="flex gap-2">
          <Link href="/banks">
            <Button variant="outline" className="gap-2">
              <Building2 className="w-4 h-4" /> Manage Banks
            </Button>
          </Link>
          <Button onClick={openModal} className="gap-2">
            <Plus className="w-4 h-4" /> Add Transaction
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-green-500 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { setDetailType("income"); setShowDetailModal(true); }}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Income</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.income)}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { setDetailType("expense"); setShowDetailModal(true); }}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Expenses</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.expense)}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-full">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { setDetailType("balance"); setShowDetailModal(true); }}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Net Balance</p>
                <p className={`text-2xl font-bold ${summary.balance >= 0 ? "text-blue-600" : "text-red-600"}`}>
                  {formatCurrency(summary.balance)}
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <Wallet className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">Transaction History</CardTitle>
          <div className="flex gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">From Date</label>
              <Input type="date" value={dateFilter.from} onChange={(e) => setDateFilter({ ...dateFilter, from: e.target.value })} className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">To Date</label>
              <Input type="date" value={dateFilter.to} onChange={(e) => setDateFilter({ ...dateFilter, to: e.target.value })} className="w-40" />
            </div>
            {(dateFilter.from || dateFilter.to) && (
              <div className="flex items-end">
                <Button variant="outline" size="sm" onClick={() => setDateFilter({ from: "", to: "" })}>Clear</Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading && !transactions.length ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-200">
                    {["Type", "Description", "Category", "Bank", "Amount", "Reference", "By", "Date", "Action"].map((h) => (
                      <th key={h} className="text-left py-3 px-3 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions
                    .filter((t) => {
                      if (dateFilter.from && new Date(t.createdAt) < new Date(dateFilter.from)) return false
                      if (dateFilter.to) {
                        const toDate = new Date(dateFilter.to)
                        toDate.setHours(23, 59, 59, 999)
                        if (new Date(t.createdAt) > toDate) return false
                      }
                      return true
                    })
                    .map((t) => (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-amber-50">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          {t.type === "CREDIT" ? (
                            <ArrowUpCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <ArrowDownCircle className="w-4 h-4 text-red-500" />
                          )}
                          <span className={`text-xs font-medium ${t.type === "CREDIT" ? "text-green-600" : "text-red-600"}`}>
                            {t.type}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-medium text-gray-800">{t.description}</td>
                      <td className="py-3 px-3 text-gray-500">{t.category || "-"}</td>
                      <td className="py-3 px-3">
                        {t.bank ? (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                            {t.bank.name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Cash</span>
                        )}
                      </td>
                      <td className={`py-3 px-3 font-semibold ${t.type === "CREDIT" ? "text-green-600" : "text-red-600"}`}>
                        {t.type === "CREDIT" ? "+" : "-"}{formatCurrency(t.amount)}
                      </td>
                      <td className="py-3 px-3 text-gray-500">{t.reference || "-"}</td>
                      <td className="py-3 px-3 text-gray-500">{t.createdBy?.name}</td>
                      <td className="py-3 px-3 text-gray-500">{formatDateTime(t.createdAt)}</td>
                      <td className="py-3 px-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(t)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => { setDeleteTarget({ id: t.id, description: t.description, amount: t.amount }); setShowDeleteConfirm(true); }}
                            className="text-red-600 hover:text-red-800 text-xs font-medium hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400">No transactions yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Transaction Modal — Redesigned */}
      <Dialog open={showModal} onOpenChange={(o) => { setShowModal(o); if (!o) setShowMoreCats(false) }}>
        <DialogContent className="w-[95vw] max-w-lg sm:w-full max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${form.type === "CREDIT" ? "bg-green-100" : "bg-red-100"}`}>
                {form.type === "CREDIT"
                  ? <ArrowUpCircle className="w-4 h-4 text-green-600" />
                  : <ArrowDownCircle className="w-4 h-4 text-red-600" />}
              </div>
              Add Transaction
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">

            {/* ── Step 1: Type Toggle ── */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setForm({ ...form, type: "CREDIT", category: "", accountId: "" })}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                  form.type === "CREDIT"
                    ? "border-green-500 bg-green-50 text-green-700 shadow-sm"
                    : "border-amber-200 text-gray-500 hover:border-gray-300 hover:bg-amber-50"
                }`}
              >
                <ArrowUpCircle className="w-4 h-4" />
                Income
              </button>
              <button
                onClick={() => setForm({ ...form, type: "DEBIT", category: "", accountId: "" })}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                  form.type === "DEBIT"
                    ? "border-red-500 bg-red-50 text-red-700 shadow-sm"
                    : "border-amber-200 text-gray-500 hover:border-gray-300 hover:bg-amber-50"
                }`}
              >
                <ArrowDownCircle className="w-4 h-4" />
                Expense
              </button>
            </div>

            {/* ── Step 2: Amount ── */}
            <div>
              <Label className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Amount (PKR) *</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">PKR</span>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className={`pl-12 text-xl font-bold h-12 ${form.type === "CREDIT" ? "focus:border-green-400" : "focus:border-red-400"}`}
                  autoFocus
                />
              </div>
              {form.amount && parseFloat(form.amount) > 0 && (
                <p className={`text-xs mt-1 font-medium ${form.type === "CREDIT" ? "text-green-600" : "text-red-600"}`}>
                  {form.type === "CREDIT" ? "+" : "−"} {formatCurrency(parseFloat(form.amount))}
                </p>
              )}
            </div>

            {/* ── Step 3: Description ── */}
            <div>
              <Label className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Description *</Label>
              <Input
                className="mt-1"
                placeholder={form.type === "CREDIT" ? "e.g. Wheat sales, Commission received..." : "e.g. Rent payment, Staff salary..."}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {/* ── Step 3B: Transaction Date ── */}
            <div>
              <Label className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Transaction Date *</Label>
              <Input
                type="date"
                className="mt-1"
                value={form.transactionDate}
                onChange={(e) => setForm({ ...form, transactionDate: e.target.value })}
              />
            </div>

            {/* ── Step 4: Category Chips ── */}
            <div>
              <Label className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Category</Label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(form.type === "CREDIT" ? INCOME_CATS : EXPENSE_CATS)
                  .slice(0, showMoreCats ? undefined : 4)
                  .map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setForm({ ...form, category: form.category === cat ? "" : cat })}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        form.category === cat
                          ? form.type === "CREDIT"
                            ? "bg-green-600 text-amber-950 border-green-600"
                            : "bg-red-600 text-amber-950 border-red-600"
                          : "bg-amber-50 text-gray-600 border-amber-200 hover:border-gray-400"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                <button
                  onClick={() => setShowMoreCats(!showMoreCats)}
                  className="px-3 py-1 rounded-full text-xs font-medium border border-dashed border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-600 flex items-center gap-1"
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${showMoreCats ? "rotate-180" : ""}`} />
                  {showMoreCats ? "Less" : "More"}
                </button>
              </div>
              {/* Custom category input */}
              {form.category !== "" && ![...INCOME_CATS, ...EXPENSE_CATS].includes(form.category) && (
                <Input className="mt-2 text-xs" placeholder="Custom category..." value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })} />
              )}
              <button
                onClick={() => setForm({ ...form, category: "___custom___" })}
                className="text-xs text-gray-400 hover:text-gray-600 mt-1.5 underline"
              >
                + Custom category
              </button>
              {form.category === "___custom___" && (
                <Input className="mt-1.5 text-sm" autoFocus placeholder="Enter category name..."
                  onChange={(e) => setForm({ ...form, category: e.target.value })} />
              )}
            </div>

            {/* ── Step 5: Payment Method ── */}
            <div>
              <Label className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Payment Method</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={() => setForm({ ...form, bankId: "" })}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    !form.bankId
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-amber-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <Banknote className="w-4 h-4" /> Cash
                </button>
                <button
                  onClick={() => setForm({ ...form, bankId: banks.length > 0 ? banks[0].id : "bank" })}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    form.bankId
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-amber-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <CreditCard className="w-4 h-4" /> Bank
                </button>
              </div>
              {form.bankId && banks.length > 0 && (
                <Select value={form.bankId} onValueChange={(v) => setForm({ ...form, bankId: v })}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {banks.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}{b.accountNumber ? ` — ${b.accountNumber}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {form.bankId && banks.length === 0 && (
                <p className="text-xs text-amber-600 mt-1.5">No banks added yet — <Link href="/banks" className="underline">add a bank</Link></p>
              )}
            </div>

            {/* ── Step 6: Account (collapsed by default) ── */}
            <div>
              <Label className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Chart of Account <span className="font-normal normal-case text-gray-400">(optional)</span></Label>
              {accounts.length === 0 ? (
                <p className="text-xs text-gray-400 mt-1">No accounts — <Link href="/accounts" className="underline text-blue-600">load default accounts</Link></p>
              ) : (
                <Select value={form.accountId || "none"} onValueChange={(v) => setForm({ ...form, accountId: v === "none" ? "" : v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select account..." /></SelectTrigger>
                  <SelectContent position="popper" side="bottom" className="max-h-56 overflow-y-auto">
                    <SelectItem value="none">— No account —</SelectItem>
                    {(() => {
                      const relevantTypes = form.type === "CREDIT"
                        ? ["INCOME", "ASSET", "EQUITY"]
                        : ["EXPENSE", "LIABILITY", "EQUITY"]
                      const allTypes = ["INCOME", "EXPENSE", "ASSET", "LIABILITY", "EQUITY"]
                      const grouped = allTypes
                        .filter((t) => relevantTypes.includes(t))
                        .map((t) => ({ type: t, items: accounts.filter((a: any) => a.type === t) }))
                        .filter((g) => g.items.length > 0)
                      return grouped.map((g) => (
                        <SelectGroup key={g.type}>
                          <SelectLabel>{g.type}</SelectLabel>
                          {g.items.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                          ))}
                        </SelectGroup>
                      ))
                    })()}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* ── Step 6B: Debit/Credit (appears when account is selected) ── */}
            {form.accountId && (
              <div>
                <Label className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Entry Type</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    onClick={() => setForm({ ...form, entryType: "DEBIT" })}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                      form.entryType === "DEBIT"
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-amber-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    Debit (Dr)
                  </button>
                  <button
                    onClick={() => setForm({ ...form, entryType: "CREDIT" })}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                      form.entryType === "CREDIT"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-amber-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    Credit (Cr)
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 7: Reference ── */}
            <div>
              <Label className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Reference <span className="font-normal normal-case text-gray-400">(optional)</span></Label>
              <Input className="mt-1" placeholder="Invoice #, Cheque #, Note..." value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>

            {/* ── Action Buttons ── */}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1" disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className={`flex-1 gap-2 ${form.type === "CREDIT" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
              >
                {form.type === "CREDIT"
                  ? <ArrowUpCircle className="w-4 h-4" />
                  : <ArrowDownCircle className="w-4 h-4" />}
                {saving ? "Saving..." : form.type === "CREDIT" ? "Add Income" : "Add Expense"}
              </Button>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailType === "income" && "All Income Transactions"}
              {detailType === "expense" && "All Expense Transactions"}
              {detailType === "balance" && "Income vs Expenses Summary"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {detailType === "balance" && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-green-600 font-medium">Total Income</p>
                  <p className="text-2xl font-bold text-green-700">{formatCurrency(summary.income)}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <p className="text-sm text-red-600 font-medium">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-700">{formatCurrency(summary.expense)}</p>
                </div>
                <div className={`${summary.balance >= 0 ? "bg-blue-50 border-blue-200" : "bg-orange-50 border-orange-200"} p-4 rounded-lg border`}>
                  <p className={`text-sm ${summary.balance >= 0 ? "text-blue-600" : "text-orange-600"} font-medium`}>Net Balance</p>
                  <p className={`text-2xl font-bold ${summary.balance >= 0 ? "text-blue-700" : "text-orange-700"}`}>{formatCurrency(summary.balance)}</p>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-amber-100">
              <table className="w-full text-sm">
                <thead className="bg-amber-50 sticky top-0">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">Date</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">Description</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">Category</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">Type</th>
                    <th className="text-right py-3 px-4 text-gray-600 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions
                    .filter((t) => {
                      if (detailType === "income") return t.type === "CREDIT"
                      if (detailType === "expense") return t.type === "DEBIT"
                      return true
                    })
                    .map((t, i) => (
                      <tr key={i} className="hover:bg-amber-50">
                        <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">{formatDate(t.createdAt)}</td>
                        <td className="py-3 px-4 text-gray-700">{t.description}</td>
                        <td className="py-3 px-4 text-gray-600 text-xs">{t.category || "—"}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${t.type === "CREDIT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {t.type === "CREDIT" ? "Income" : "Expense"}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-right font-semibold ${t.type === "CREDIT" ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(t.amount)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Description *</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Transaction description"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Amount (PKR) *</Label>
              <Input
                type="number"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Category (Optional)</Label>
              <Input
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                placeholder="e.g., Rent, Salary, Sales"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Reference (Optional)</Label>
              <Input
                value={editForm.reference}
                onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })}
                placeholder="e.g., Invoice #, Cheque #"
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete Transaction
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-900">
                <strong>Description:</strong> {deleteTarget?.description}
              </p>
              <p className="text-sm text-red-900 mt-2">
                <strong>Amount:</strong> {formatCurrency(deleteTarget?.amount || 0)}
              </p>
            </div>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this transaction? This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Delete Transaction"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
