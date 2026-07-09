"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Plus, Trash2, Receipt, TrendingDown, Search } from "lucide-react"

const CATEGORIES = [
  "Rent", "Utilities", "Salaries", "Transport", "Repairs",
  "Supplies", "Marketing", "Miscellaneous", "General",
]

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [summary, setSummary] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [accounts, setAccounts] = useState<any[]>([])
  const [form, setForm] = useState({
    amount: "", description: "", category: "General", reference: "", accountId: "",
  })

  async function loadData() {
    try {
      setLoading(true)
      const data = await fetch("/api/expenses").then((r) => r.json())
      setExpenses(data.expenses || [])
      setSummary(data.summary || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d) => {
        const expAccounts = (d.accounts || []).filter((a: any) => a.type === "EXPENSE")
        setAccounts(expAccounts)
        if (expAccounts.length > 0) {
          setForm((f) => ({ ...f, accountId: expAccounts[0].id }))
        }
      })
      .catch(() => {})
  }, [])

  async function handleAdd() {
    if (!form.amount || parseFloat(form.amount) <= 0) return alert("Enter a valid amount")
    if (!form.description.trim()) return alert("Description is required")
    setSaving(true)
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount: parseFloat(form.amount),
        accountId: form.accountId || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setShowModal(false)
      setForm({ amount: "", description: "", category: "General", reference: "", accountId: "" })
      loadData()
    }
  }

  async function handleDelete(id: string, desc: string) {
    if (!confirm(`Delete expense: "${desc}"?`)) return
    await fetch("/api/expenses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    loadData()
  }

  const filtered = expenses.filter(
    (e) =>
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      (e.category || "").toLowerCase().includes(search.toLowerCase())
  )

  const categoryTotals = summary
    .filter((s) => s._sum.amount)
    .sort((a, b) => b._sum.amount - a._sum.amount)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Expenses</h2>
          <p className="text-gray-500 text-sm">Track all business expenditures</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="bg-white hover:bg-gray-100 text-gray-900 border border-gray-300 gap-2">
          <Plus className="w-4 h-4" /> Add Expense
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="md:col-span-2">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-red-50 rounded-xl">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(total)}</p>
              <p className="text-sm text-gray-500">Total Expenses ({expenses.length} entries)</p>
            </div>
          </CardContent>
        </Card>
        {categoryTotals.slice(0, 2).map((cat) => (
          <Card key={cat.category}>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide truncate">
                {cat.category || "General"}
              </p>
              <p className="text-lg font-bold text-gray-800 mt-1">{formatCurrency(cat._sum.amount)}</p>
              <p className="text-xs text-gray-400">{cat._count} entries</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category breakdown */}
      {categoryTotals.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm font-semibold text-gray-700">Expenses by Category</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {categoryTotals.map((cat) => {
                const pct = total > 0 ? (cat._sum.amount / total) * 100 : 0
                return (
                  <div key={cat.category} className="flex items-center gap-3">
                    <p className="text-xs text-gray-600 w-28 truncate">{cat.category || "General"}</p>
                    <div className="flex-1 h-2 bg-blue-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs font-medium text-gray-700 w-24 text-right">
                      {formatCurrency(cat._sum.amount)}
                    </p>
                    <p className="text-xs text-gray-400 w-10 text-right">{pct.toFixed(0)}%</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expenses table */}
      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-blue-50 border-b border-t">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Account</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reference</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">By</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && !expenses.length ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
                ) : filtered.map((e, i) => (
                  <tr key={e.id} className="hover:bg-red-50/30">
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(e.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{e.description}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 bg-red-50 text-red-700 rounded-full font-medium">
                        {e.category || "General"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {e.account ? (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                          {e.account.code} â€” {e.account.name}
                        </span>
                      ) : "â€”"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{e.reference || "â€”"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">
                      {formatCurrency(e.amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{e.createdBy?.name || "â€”"}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(e.id, e.description)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No expenses found</td></tr>
                )}
              </tbody>
              {!loading && filtered.length > 0 && (
                <tfoot className="bg-blue-50 border-t-2 border-blue-300">
                  <tr>
                    <td colSpan={6} className="px-4 py-3 font-bold text-gray-700">
                      Total â€” {filtered.length} entries
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">
                      {formatCurrency(filtered.reduce((s, e) => s + e.amount, 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Expense Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-red-600" /> Add Expense
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount (PKR) *</Label>
              <Input
                type="number"
                placeholder="e.g. 5000"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <Label>Description *</Label>
              <Input
                placeholder="e.g. Monthly rent payment"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Chart of Account</Label>
              <Select
                value={form.accountId || "none"}
                onValueChange={(v) => setForm({ ...form, accountId: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">â€” No account â€”</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} â€” {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {accounts.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">No expense accounts found â€” load default accounts first.</p>
              )}
            </div>
            <div>
              <Label>Reference (optional)</Label>
              <Input
                placeholder="Invoice no., receipt no..."
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
              <Button
                onClick={handleAdd}
                disabled={saving}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {saving ? "Saving..." : "Add Expense"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

