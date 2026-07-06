"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Plus, Edit, X, BookOpen, TrendingUp, TrendingDown, Landmark,
  Loader2, Printer,
} from "lucide-react"

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const
type AccountType = (typeof ACCOUNT_TYPES)[number]

const TYPE_META: Record<AccountType, { label: string; color: string; bg: string; border: string }> = {
  ASSET:     { label: "Assets",      color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
  LIABILITY: { label: "Liabilities", color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
  EQUITY:    { label: "Equity",      color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
  INCOME:    { label: "Income",      color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200" },
  EXPENSE:   { label: "Expenses",    color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
}

const BLANK_FORM = { code: "", name: "", type: "EXPENSE" as AccountType, description: "" }

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [detail, setDetail] = useState<any>(null)
  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [typeFilter, setTypeFilter] = useState<"ALL" | AccountType>("ALL")
  const [search, setSearch] = useState("")
  const [shop, setShop] = useState<any>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ amount: "", description: "", type: "DEBIT" })
  const [paymentLoading, setPaymentLoading] = useState(false)

  async function loadAccounts() {
    setLoading(true)
    const [accData, settingsData] = await Promise.all([
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({ shop: null })),
    ])
    setAccounts(accData.accounts || [])
    setShop(settingsData.shop || null)
    setLoading(false)
  }

  useEffect(() => { loadAccounts() }, [])

  async function handleSeed() {
    if (!confirm("This will create 25 default accounts (Assets, Liabilities, Income, Expenses). Continue?")) return
    setSeeding(true)
    const res = await fetch("/api/accounts/seed", { method: "POST" })
    const data = await res.json()
    setSeeding(false)
    if (data.skipped) alert("Accounts already exist — seed skipped.")
    else { loadAccounts() }
  }

  async function resetBalance(a: any) {
    if (!confirm(`Reset balance of "${a.name}" from PKR ${(a.balance || 0).toLocaleString()} to 0?`)) return
    await fetch(`/api/accounts/${a.id}`, { method: "PATCH" })
    loadAccounts()
  }

  function openAdd() {
    setEditing(null)
    setForm(BLANK_FORM)
    setShowModal(true)
  }

  function openEdit(a: any) {
    setEditing(a)
    setForm({ code: a.code, name: a.name, type: a.type, description: a.description || "" })
    setShowModal(true)
  }

  async function openDetail(a: any) {
    setSelected(a)
    setDetail(null)
    setShowDetail(true)
    setPaymentForm({ amount: "", description: "", type: "DEBIT" })
    const data = await fetch(`/api/accounts/${a.id}`).then((r) => r.json())
    setDetail(data)
  }

  async function handleRecordPayment() {
    if (!selected || !paymentForm.amount) return alert("Please enter an amount")
    const amt = parseFloat(paymentForm.amount)
    if (amt <= 0) return alert("Amount must be greater than 0")

    setPaymentLoading(true)
    try {
      const res = await fetch(`/api/accounts/${selected.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          description: paymentForm.description,
          type: paymentForm.type
        })
      })
      if (!res.ok) throw new Error("Entry recording failed")

      setPaymentForm({ amount: "", description: "", type: "DEBIT" })
      setShowPaymentModal(false)
      await openDetail(selected)
    } catch (error) {
      alert("Error recording entry: " + (error instanceof Error ? error.message : "Unknown error"))
    } finally {
      setPaymentLoading(false)
    }
  }

  async function handleSave() {
    if (!form.code.trim() || !form.name.trim()) return alert("Code and name are required")
    setSaving(true)
    const url = editing ? `/api/accounts/${editing.id}` : "/api/accounts"
    const method = editing ? "PUT" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) { setShowModal(false); loadAccounts() }
    else { const d = await res.json(); alert(d.error || "Failed to save") }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Deactivate account "${name}"?`)) return
    await fetch(`/api/accounts/${id}`, { method: "DELETE" })
    loadAccounts()
  }

  const filteredAccounts = accounts.filter((a) => {
    const matchType = typeFilter === "ALL" || a.type === typeFilter
    const matchSearch = search === "" ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.code.includes(search)
    return matchType && matchSearch
  })

  const grouped = ACCOUNT_TYPES.reduce((acc, type) => {
    acc[type] = filteredAccounts.filter((a) => a.type === type)
    return acc
  }, {} as Record<AccountType, any[]>)

  const allGrouped = ACCOUNT_TYPES.reduce((acc, type) => {
    acc[type] = accounts.filter((a) => a.type === type)
    return acc
  }, {} as Record<AccountType, any[]>)

  const totalIncome  = allGrouped.INCOME.reduce((s, a) => s + a.balance, 0)
  const totalExpense = allGrouped.EXPENSE.reduce((s, a) => s + a.balance, 0)
  const totalAsset   = allGrouped.ASSET.reduce((s, a) => s + a.balance, 0)
  const today = new Date().toLocaleDateString("en-PK")

  return (
    <div className="space-y-6">

      {/* ── Print Header ── */}
      <div className="hidden print:block">
        <style>{`@media print { @page { size: A4 portrait; } }`}</style>
        <div style={{background:"linear-gradient(135deg,#14532d 0%,#166534 60%,#15803d 100%)",color:"#fff",padding:"16px 22px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            {shop?.logo
              ? <img src={shop.logo} style={{width:"52px",height:"52px",borderRadius:"8px",background:"#fff",padding:"3px",objectFit:"contain"}} alt="" />
              : <div style={{width:"52px",height:"52px",borderRadius:"8px",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"26px",fontWeight:900,border:"2px solid rgba(255,255,255,0.3)"}}>{(shop?.name||"G")[0].toUpperCase()}</div>
            }
            <div>
              <div style={{fontSize:"20px",fontWeight:900,letterSpacing:"-0.5px"}}>{shop?.name||"Gala Mandi"}</div>
              {shop?.ownerName && <div style={{fontSize:"11px",opacity:0.8,marginTop:"2px"}}>{shop.ownerName}</div>}
            </div>
          </div>
          <div style={{textAlign:"right",fontSize:"11px",lineHeight:1.9,opacity:0.9}}>
            {shop?.phone && <div>&#9990;&nbsp;{shop.phone}</div>}
            {shop?.address && <div>&#9679;&nbsp;{shop.address}</div>}
            <div style={{fontSize:"10px",opacity:0.75}}>Printed: {today}</div>
          </div>
        </div>
        <div style={{height:"4px",background:"linear-gradient(90deg,#fbbf24 0%,#f59e0b 50%,#d97706 100%)"}}></div>
        <div style={{padding:"10px 22px 8px",background:"#f8fdf8",borderBottom:"1px solid #e5e7eb",marginBottom:"8px"}}>
          <h2 style={{margin:0,fontSize:"16px",fontWeight:800,color:"#14532d"}}>Chart of Accounts</h2>
          <div style={{fontSize:"11px",color:"#6b7280",marginTop:"2px"}}>
            {typeFilter === "ALL" ? "All account types" : `Filtered: ${TYPE_META[typeFilter as AccountType]?.label}`}
          </div>
          <div style={{display:"flex",gap:"24px",marginTop:"8px",fontSize:"11px"}}>
            <span>Income: <strong style={{color:"#166534"}}>{formatCurrency(totalIncome)}</strong></span>
            <span>Expenses: <strong style={{color:"#c2410c"}}>{formatCurrency(totalExpense)}</strong></span>
            <span>Assets: <strong style={{color:"#1d4ed8"}}>{formatCurrency(totalAsset)}</strong></span>
            <span>Net: <strong style={{color: totalIncome - totalExpense >= 0 ? "#166534" : "#b91c1c"}}>{formatCurrency(totalIncome - totalExpense)}</strong></span>
          </div>
        </div>
      </div>

      {/* ── Screen Header ── */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Chart of Accounts</h2>
          <p className="text-gray-500 text-sm">{accounts.length} accounts</p>
        </div>
        <div className="flex gap-2">
          {accounts.length === 0 && (
            <Button variant="outline" onClick={handleSeed} disabled={seeding}>
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
              Load Default Accounts
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button onClick={openAdd}><Plus className="w-4 h-4" /> Add Account</Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Income</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-200" />
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Expenses</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalExpense)}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-orange-200" />
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Assets</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalAsset)}</p>
            </div>
            <Landmark className="w-8 h-8 text-blue-200" />
          </CardContent>
        </Card>
      </div>

      {/* ── Filters ── */}
      {accounts.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center print:hidden">
          <div className="relative">
            <input
              type="text"
              placeholder="Search account name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(["ALL", ...ACCOUNT_TYPES] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  typeFilter === t
                    ? t === "ALL"
                      ? "bg-gray-800 text-white border-gray-800"
                      : `${TYPE_META[t as AccountType].bg} ${TYPE_META[t as AccountType].color} ${TYPE_META[t as AccountType].border}`
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
              >
                {t === "ALL" ? "All Types" : TYPE_META[t as AccountType].label}
                <span className="ml-1 opacity-70">
                  ({t === "ALL" ? accounts.length : allGrouped[t as AccountType].length})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading accounts...</div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium mb-2">No accounts yet</p>
            <p className="text-gray-400 text-sm mb-5">Click "Load Default Accounts" to set up a standard chart of accounts for a grain mandi</p>
            <Button onClick={handleSeed} disabled={seeding}>
              {seeding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BookOpen className="w-4 h-4 mr-2" />}
              Load Default Accounts
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {ACCOUNT_TYPES.map((type) => {
            const group = grouped[type]
            if (group.length === 0) return null
            const meta = TYPE_META[type]
            const groupTotal = group.reduce((s, a) => s + a.balance, 0)
            return (
              <Card key={type} className={`border ${meta.border}`}>
                <CardHeader className={`${meta.bg} rounded-t-lg py-3 px-5`}>
                  <div className="flex items-center justify-between">
                    <CardTitle className={`text-sm font-bold uppercase tracking-wide ${meta.color}`}>
                      {meta.label}
                    </CardTitle>
                    <span className={`text-sm font-bold ${meta.color}`}>{formatCurrency(groupTotal)}</span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-4 text-gray-400 font-medium text-xs w-20">Code</th>
                        <th className="text-left py-2 px-4 text-gray-400 font-medium text-xs">Account Name</th>
                        <th className="text-left py-2 px-4 text-gray-400 font-medium text-xs hidden md:table-cell">Description</th>
                        <th className="text-right py-2 px-4 text-gray-400 font-medium text-xs">Balance</th>
                        <th className="text-right py-2 px-4 text-gray-400 font-medium text-xs w-24 print:hidden">Txns</th>
                        <th className="py-2 px-4 w-20 print:hidden"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {group.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="py-2.5 px-4 font-mono text-xs text-gray-500">{a.code}</td>
                          <td className="py-2.5 px-4">
                            <button
                              onClick={() => openDetail(a)}
                              className={`font-semibold hover:underline ${meta.color} print:pointer-events-none`}
                            >
                              {a.name}
                            </button>
                          </td>
                          <td className="py-2.5 px-4 text-gray-400 text-xs hidden md:table-cell">{a.description || "—"}</td>
                          <td className={`py-2.5 px-4 text-right font-semibold ${(a.balance || 0) < 0 ? "text-red-600" : a.balance > 0 ? meta.color : "text-gray-400"}`}>
                            <div className="flex items-center justify-end gap-1.5">
                              {formatCurrency(a.balance)}
                              {(a.balance || 0) < 0 && (
                                <button
                                  onClick={() => resetBalance(a)}
                                  className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200 font-medium"
                                  title="Balance is negative — click to reset to 0"
                                >
                                  Fix
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-right print:hidden">
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                              {a._count?.transactions || 0}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 print:hidden">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => openEdit(a)} className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded" title="Edit">
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(a.id, a.name)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Deactivate">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-100">
                      <tr>
                        <td colSpan={3} className="py-2 px-4 font-bold text-gray-600 text-xs">
                          {group.length} account{group.length !== 1 ? "s" : ""}
                        </td>
                        <td className={`py-2 px-4 text-right font-bold text-sm ${meta.color}`}>
                          {formatCurrency(groupTotal)}
                        </td>
                        <td colSpan={2} className="print:hidden" />
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>
            )
          })}

          {/* Print summary footer */}
          <div className="hidden print:block mt-6 border-t-2 border-gray-300 pt-4">
            <table className="w-full text-sm">
              <tbody>
                <tr className="font-bold text-green-800">
                  <td className="py-1">Total Income</td>
                  <td className="text-right">{formatCurrency(totalIncome)}</td>
                </tr>
                <tr className="font-bold text-orange-700">
                  <td className="py-1">Total Expenses</td>
                  <td className="text-right">{formatCurrency(totalExpense)}</td>
                </tr>
                <tr className="font-bold text-lg border-t border-gray-300">
                  <td className="py-2">Net Profit / Loss</td>
                  <td className={`text-right ${totalIncome - totalExpense >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {formatCurrency(Math.abs(totalIncome - totalExpense))}
                    <span className="text-sm ml-1 font-normal">
                      {totalIncome - totalExpense >= 0 ? "Profit" : "Loss"}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Account" : "Add Account"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Account Code *</Label>
                <Input
                  placeholder="e.g. 5002"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div>
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as AccountType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_META[t].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Account Name *</Label>
              <Input
                placeholder="e.g. Transport / Freight"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                placeholder="Optional description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? "Saving..." : editing ? "Update" : "Add Account"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Account Detail / Ledger Modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              {selected?.code} — {selected?.name}
              {selected && (
                <span className={`text-xs px-2 py-0.5 rounded-full ml-1 ${TYPE_META[selected.type as AccountType]?.bg} ${TYPE_META[selected.type as AccountType]?.color}`}>
                  {TYPE_META[selected.type as AccountType]?.label}
                </span>
              )}
            </DialogTitle>
            <Button
              onClick={() => setShowPaymentModal(true)}
              className="bg-green-600 hover:bg-green-700 text-sm"
            >
              + Add Entry
            </Button>
          </DialogHeader>

          {!detail ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(detail.account.balance)}</p>
                  <p className="text-xs text-gray-500 mt-1">Running Balance</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{detail.entries.length}</p>
                  <p className="text-xs text-gray-500 mt-1">Total Transactions</p>
                </div>
              </div>

              {detail.entries.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No transactions posted to this account yet</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Date</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Description</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs">Debit</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs">Credit</th>
                        <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs">Balance</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {detail.entries.map((e: any, i: number) => (
                        <tr key={i} className={e.type === "CREDIT" ? "bg-green-50/30" : ""}>
                          <td className="py-2 px-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(e.createdAt)}</td>
                          <td className="py-2 px-3 text-gray-700 text-xs max-w-xs">
                            <p className="truncate">{e.description}</p>
                            {e.reference && <p className="text-gray-400 text-xs">{e.reference}</p>}
                          </td>
                          <td className="py-2 px-3 text-right text-red-600 font-medium">
                            {e.type === "DEBIT" ? formatCurrency(e.amount) : "—"}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 font-medium">
                            {e.type === "CREDIT" ? formatCurrency(e.amount) : "—"}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-gray-800">
                            {formatCurrency(e.runningBalance)}
                          </td>
                          <td className="py-2 px-3 text-gray-400 text-xs">{e.createdBy?.name}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                      <tr>
                        <td colSpan={4} className="py-2 px-3 font-bold text-gray-700 text-xs">Closing Balance</td>
                        <td className="py-2 px-3 text-right font-bold text-gray-900">{formatCurrency(detail.closingBalance)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Entry Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Add Journal Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Account: <strong>{selected?.name}</strong></p>
              <p className="text-sm text-gray-600">Type: <strong>{selected?.type}</strong> | Current Balance: <strong>{formatCurrency(selected?.balance || 0)}</strong></p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium mb-2 block">Entry Type *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentForm({ ...paymentForm, type: "DEBIT" })}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                      paymentForm.type === "DEBIT"
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    Debit (Dr)
                  </button>
                  <button
                    onClick={() => setPaymentForm({ ...paymentForm, type: "CREDIT" })}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                      paymentForm.type === "CREDIT"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    Credit (Cr)
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="amount" className="text-sm font-medium">
                  Amount (PKR) *
                </Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description" className="text-sm font-medium">
                Description (Optional)
              </Label>
              <Input
                id="description"
                placeholder="e.g., Car installment payment"
                value={paymentForm.description}
                onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
                className="mt-1"
              />
            </div>

            <div className={`rounded-lg p-3 ${paymentForm.type === "DEBIT" ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
              <p className={`text-xs ${paymentForm.type === "DEBIT" ? "text-red-900" : "text-green-900"}`}>
                {paymentForm.type === "DEBIT"
                  ? `Debit of PKR ${(parseFloat(paymentForm.amount) || 0).toLocaleString()} will INCREASE balance to PKR ${((selected?.balance || 0) + (parseFloat(paymentForm.amount) || 0)).toLocaleString()}`
                  : `Credit of PKR ${(parseFloat(paymentForm.amount) || 0).toLocaleString()} will DECREASE balance to PKR ${((selected?.balance || 0) - (parseFloat(paymentForm.amount) || 0)).toLocaleString()}`
                }
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowPaymentModal(false)}
              disabled={paymentLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={paymentLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {paymentLoading ? "Recording..." : "Add Entry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
