"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PencilLine } from "lucide-react"

// Local YYYY-MM-DD of a date, for <input type="date">
const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

type LedgerPayment = {
  id: string
  date: string
  payment: { amount: number; direction: string; method: string; notes: string | null; galaEntryId: string | null }
}

type Props = {
  entry: LedgerPayment | null
  partyPath: string // e.g. /api/customers/<id>
  directions: { value: string; label: string }[]
  onClose: () => void
  onSaved: () => void
}

// Edit one trader / supplier payment from a ledger row (an entry with `id`, `date` and `payment`).
export function EditPaymentDialog(props: Props) {
  return (
    <Dialog open={!!props.entry} onOpenChange={(open) => { if (!open) props.onClose() }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PencilLine className="w-5 h-5 text-blue-600" /> Edit Transaction
          </DialogTitle>
        </DialogHeader>
        {props.entry && <EditPaymentForm key={props.entry.id} {...props} entry={props.entry} />}
      </DialogContent>
    </Dialog>
  )
}

function EditPaymentForm({ entry, partyPath, directions, onClose, onSaved }: Props & { entry: LedgerPayment }) {
  const p = entry.payment
  const [form, setForm] = useState({
    amount: String(p.amount), direction: p.direction, method: p.method, notes: p.notes || "", date: localDay(new Date(entry.date)),
  })
  const [saving, setSaving] = useState(false)
  const isGala = !!p.galaEntryId

  async function handleSave() {
    const amt = parseFloat(form.amount)
    if (!amt || amt <= 0) return alert("Enter a valid amount")
    // Keep the original time of day; only the calendar day changes
    const when = new Date(entry.date)
    const [y, m, d] = form.date.split("-").map(Number)
    if (y && m && d) when.setFullYear(y, m - 1, d)

    setSaving(true)
    const res = await fetch(`${partyPath}/payment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: entry.id, amount: amt, direction: form.direction, method: form.method, notes: form.notes, date: when.toISOString() }),
    })
    setSaving(false)
    if (res.status === 403) return // role message already shown
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return alert(data.error || "Update failed")
    }
    onSaved()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {directions.map((d) => (
          <button
            key={d.value}
            type="button"
            disabled={isGala && d.value !== form.direction}
            onClick={() => setForm({ ...form, direction: d.value })}
            className={`py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-colors disabled:opacity-40 ${
              form.direction === d.value ? "border-blue-600 bg-blue-50 text-blue-700" : "border-blue-300 text-gray-500 hover:border-gray-300"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
      {isGala && <p className="text-xs text-gray-500">Gala Mandi payment: its entry and bank transfer are updated too.</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Amount (PKR) *</Label>
          <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Payment Method</Label>
        <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="CASH">Cash</SelectItem>
            <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
            <SelectItem value="CHEQUE">Cheque</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Notes (optional)</Label>
        <Input placeholder="Cheque no., reference..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">
          {saving ? "Saving..." : "Update Transaction"}
        </Button>
      </div>
    </div>
  )
}
