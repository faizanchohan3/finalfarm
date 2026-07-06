"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatDateDMY, formatDateSlash } from "@/lib/utils"
import { buildPrintHeader, receiptCSS, reportCSS } from "@/lib/print-utils"
import { Plus, Truck, Printer, Search, User, BookOpen, ArrowDownCircle, Edit } from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  IN_TRANSIT: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
}

const BLANK_FORM = {
  driverId: "", walkInDriverName: "", vehicleId: "", walkInVehicleName: "", customerId: "",
  fromLocation: "", toLocation: "", commodity: "",
  builtyNo: "", rate: "", weighbridge: "", loadingDate: "", bags: "",
  mill: "", netWeight: "", netAmount: "",
  rent: "", deduction: "", labour: "", referenceNo: "", unloadDate: "", notes: "",
}

export default function TransportPage() {
  const [slips, setSlips] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [banks, setBanks] = useState<any[]>([])
  const [shop, setShop] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [tab, setTab] = useState<"slips" | "drivers" | "vehicles">("slips")

  // Slip modal
  const [showSlipModal, setShowSlipModal] = useState(false)
  const [form, setForm] = useState({ ...BLANK_FORM })

  // Vehicle modal
  const [showVehicleModal, setShowVehicleModal] = useState(false)
  const [vForm, setVForm] = useState({ vehicleNo: "", vehicleType: "Truck", driverName: "", driverPhone: "" })

  // Driver modal
  const [showDriverModal, setShowDriverModal] = useState(false)
  const [editingDriver, setEditingDriver] = useState<any>(null)
  const [dForm, setDForm] = useState({ name: "", phone: "", cnic: "", address: "", license: "" })

  // Driver ledger modal
  const [showDriverLedger, setShowDriverLedger] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<any>(null)
  const [driverDetail, setDriverDetail] = useState<any>(null)
  const [driverDetailError, setDriverDetailError] = useState<string | null>(null)

  // Driver payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [payForm, setPayForm] = useState({ amount: "", method: "CASH", notes: "", bankId: "" })

  // Dispatch modal
  const [showDispatchModal, setShowDispatchModal] = useState<any>(null)
  const [dispForm, setDispForm] = useState({ items: "", totalWeight: "", totalBags: "", receivedBy: "" })

  async function loadData() {
    setLoading(true)
    try {
      const [sr, vr, cr, dr, br, shr] = await Promise.allSettled([
        fetch("/api/freight").then((r) => r.json()),
        fetch("/api/vehicles").then((r) => r.json()),
        fetch("/api/customers").then((r) => r.json()),
        fetch("/api/drivers").then((r) => r.json()),
        fetch("/api/banks").then((r) => r.json()),
        fetch("/api/settings").then((r) => r.json()),
      ])
      if (sr.status === "fulfilled") setSlips(sr.value.slips || [])
      if (vr.status === "fulfilled") setVehicles(vr.value.vehicles || [])
      if (cr.status === "fulfilled") setCustomers(cr.value.customers || [])
      if (dr.status === "fulfilled") setDrivers(dr.value.drivers || [])
      if (shr.status === "fulfilled") setShop(shr.value.shop || null)
      if (br.status === "fulfilled") setBanks(br.value.banks || [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { loadData() }, [])

  async function loadDriverDetail(id: string) {
    setDriverDetailError(null)
    setDriverDetail(null)
    try {
      const res = await fetch(`/api/drivers/${id}`)
      const data = await res.json()
      if (!res.ok || data.error) {
        setDriverDetailError(data?.error || "Failed to load driver ledger")
        return
      }
      setDriverDetail(data)
    } catch {
      setDriverDetailError("Network error. Please try again.")
    }
  }

  function openDriverLedger(d: any) {
    setSelectedDriver(d)
    setDriverDetail(null)
    setDriverDetailError(null)
    setShowDriverLedger(true)
    loadDriverDetail(d.id)
  }

  // Auto-calculate net amount when rate/bags/netWeight changes
  function updateForm(field: string, val: string) {
    const next = { ...form, [field]: val }
    const rate = parseFloat(next.rate) || 0
    const bags = parseFloat(next.bags) || 0
    const nw = parseFloat(next.netWeight) || 0
    if (["rate", "bags", "netWeight"].includes(field)) {
      next.netAmount = String(rate * (nw || bags))
    }
    setForm(next)
  }

  async function handleCreateSlip() {
    if (!form.fromLocation || !form.toLocation) return alert("From & To locations required")
    try {
      const payload = {
        ...form,
        driverId: form.driverId === "walkin" ? null : form.driverId,
        walkInDriver: form.driverId === "walkin" ? form.walkInDriverName : null,
        vehicleId: form.vehicleId === "walkin" ? null : form.vehicleId,
        walkInVehicle: form.vehicleId === "walkin" ? form.walkInVehicleName : null,
      }
      const res = await fetch("/api/freight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        return alert(d?.error || "Failed to create freight slip")
      }
      setShowSlipModal(false)
      setForm({ ...BLANK_FORM })
      loadData()
    } catch {
      alert("Network error. Please try again.")
    }
  }

  async function handleDispatch(slipId: string) {
    try {
      const res = await fetch(`/api/freight/${slipId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "IN_TRANSIT",
          items: dispForm.items,
          totalWeight: dispForm.totalWeight ? parseFloat(dispForm.totalWeight) : null,
          totalBags: dispForm.totalBags ? parseInt(dispForm.totalBags) : null,
          receivedBy: dispForm.receivedBy,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        return alert(d?.error || "Failed to dispatch")
      }
      setShowDispatchModal(null)
      loadData()
    } catch {
      alert("Network error. Please try again.")
    }
  }

  async function handleDeliver(slipId: string) {
    try {
      const res = await fetch(`/api/freight/${slipId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DELIVERED" }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        return alert(d?.error || "Failed to mark as delivered")
      }
      loadData()
    } catch {
      alert("Network error. Please try again.")
    }
  }

  async function handleSaveVehicle() {
    if (!vForm.vehicleNo.trim()) return alert("Vehicle number required")
    try {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vForm),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        return alert(d?.error || "Failed to add vehicle")
      }
      setShowVehicleModal(false)
      loadData()
    } catch {
      alert("Network error. Please try again.")
    }
  }

  async function handleSaveDriver() {
    if (!dForm.name.trim()) return alert("Driver name required")
    try {
      const url = editingDriver ? `/api/drivers/${editingDriver.id}` : "/api/drivers"
      const method = editingDriver ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dForm),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        return alert(d?.error || "Failed to save driver")
      }
      setShowDriverModal(false)
      loadData()
    } catch {
      alert("Network error. Please try again.")
    }
  }

  async function handleDriverPayment() {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) return alert("Enter valid amount")
    try {
      const res = await fetch(`/api/drivers/${selectedDriver.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payForm, amount: parseFloat(payForm.amount) }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        return alert(d?.error || "Failed to record payment")
      }
      setShowPaymentModal(false)
      setPayForm({ amount: "", method: "CASH", notes: "", bankId: "" })
      loadDriverDetail(selectedDriver.id)
      loadData()
    } catch {
      alert("Network error. Please try again.")
    }
  }

  function printAllSlips(slipList: any[]) {
    const sorted = [...slipList].sort((a, b) => {
      const da = new Date(a.unloadDate || a.createdAt).getTime()
      const db2 = new Date(b.unloadDate || b.createdAt).getTime()
      return da - db2
    })
    const rows = sorted.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${s.driver?.name || s.walkInDriver || "—"}</td>
        <td>${s.builtyNo || s.slipNo}</td>
        <td>${s.rate > 0 ? s.rate : "—"}</td>
        <td>${s.vehicle?.vehicleNo || s.walkInVehicle || "—"}</td>
        <td>${s.weighbridge ? s.weighbridge + " KG" : "—"}</td>
        <td>${s.loadingDate ? formatDateSlash(s.loadingDate) : "—"}</td>
        <td>${s.bags || "—"}</td>
        <td>${s.mill || "—"}</td>
        <td>${s.netWeight ? s.netWeight + " KG" : "—"}</td>
        <td>${s.unloadDate ? formatDateSlash(s.unloadDate) : "—"}</td>
        <td style="text-align:right">${s.deduction > 0 ? s.deduction.toLocaleString() : "—"}</td>
        <td style="text-align:right">${s.netAmount > 0 ? "PKR " + s.netAmount.toLocaleString() : "—"}</td>
        <td style="text-align:right">${s.rent > 0 ? "PKR " + s.rent.toLocaleString() : "—"}</td>
        <td style="text-align:right">${s.labour > 0 ? "PKR " + s.labour.toLocaleString() : "—"}</td>
        <td>${s.referenceNo || "—"}</td>
      </tr>`).join("")
    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>All FeedMills</title>
<style>${reportCSS} th,td{white-space:nowrap;}</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div>
    <div class="doc-title">FeedMill Slips</div>
    <div class="doc-sub">Printed on ${new Date().toLocaleDateString("en-PK")} &nbsp;|&nbsp; ${sorted.length} slips</div>
  </div>
  <div class="doc-meta"><div>${new Date().toLocaleString("en-PK")}</div></div>
</div>
<div class="body-pad">
<table>
  <thead><tr>
    <th>#</th><th>Driver</th><th>Builty</th><th>Rate</th><th>Vehicle</th>
    <th>Weighbridge</th><th>Loading Date</th><th>Bags</th><th>Mill</th><th>Net Wt</th>
    <th>Unload Date</th><th style="text-align:right">Deduction</th><th style="text-align:right">Net Amt</th><th style="text-align:right">Rent</th><th style="text-align:right">Labour</th><th>Ref No</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</div>
</body></html>`)
    w.print()
  }

  function printAllDrivers() {
    const rows = drivers.map((d, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${d.name}</td>
        <td>${d.phone || "—"}</td>
        <td>${d.cnic || "—"}</td>
        <td>${d.license || "—"}</td>
        <td style="text-align:center">${d._count?.freightSlips || 0}</td>
        <td style="text-align:right">${(d.balance || 0) > 0 ? "PKR " + (d.balance).toLocaleString() : "—"}</td>
      </tr>`).join("")
    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>Drivers List</title>
<style>${reportCSS}</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div>
    <div class="doc-title">Drivers List</div>
    <div class="doc-sub">Printed on ${new Date().toLocaleDateString("en-PK")} &nbsp;|&nbsp; ${drivers.length} drivers</div>
  </div>
  <div class="doc-meta"><div>${new Date().toLocaleString("en-PK")}</div></div>
</div>
<div class="body-pad">
<table>
  <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>CNIC</th><th>License</th><th style="text-align:center">Trips</th><th style="text-align:right">Balance Payable</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</div>
</body></html>`)
    w.print()
  }

  function printDriverLedger() {
    if (!driverDetail || !selectedDriver) return
    const rows = (driverDetail.ledger || []).map((e: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${new Date(e.date).toLocaleDateString("en-PK")}</td>
        <td>${e.description}</td>
        <td style="text-align:right">${e.debit > 0 ? "PKR " + e.debit.toLocaleString() : "—"}</td>
        <td style="text-align:right">${e.credit > 0 ? "PKR " + e.credit.toLocaleString() : "—"}</td>
        <td style="text-align:right;font-weight:bold;color:${e.balance > 0 ? "#dc2626" : "#16a34a"}">
          PKR ${Math.abs(e.balance).toLocaleString()} ${e.balance > 0 ? "Cr" : e.balance < 0 ? "Dr" : ""}
        </td>
      </tr>`).join("")
    const bal = driverDetail.balance || 0
    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>Driver Ledger — ${selectedDriver.name}</title>
<style>${reportCSS}</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div>
    <div class="doc-title">Driver Ledger</div>
    <div class="doc-sub">${selectedDriver.name}${selectedDriver.phone ? " &nbsp;|&nbsp; " + selectedDriver.phone : ""}${selectedDriver.cnic ? " &nbsp;|&nbsp; CNIC: " + selectedDriver.cnic : ""}</div>
  </div>
  <div class="doc-meta"><div>Printed: ${new Date().toLocaleDateString("en-PK")}</div></div>
</div>
<div class="body-pad">
  <div style="display:flex;gap:14px;margin-bottom:14px;">
    <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;">
      <div style="font-size:9px;text-transform:uppercase;color:#6b7280;font-weight:700">Total Earned (Cr)</div>
      <div style="font-size:15px;font-weight:900;color:#15803d;margin-top:3px">PKR ${(driverDetail.totalEarned || 0).toLocaleString()}</div>
    </div>
    <div style="flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;">
      <div style="font-size:9px;text-transform:uppercase;color:#6b7280;font-weight:700">Total Paid (Dr)</div>
      <div style="font-size:15px;font-weight:900;color:#dc2626;margin-top:3px">PKR ${(driverDetail.totalPaid || 0).toLocaleString()}</div>
    </div>
    <div style="flex:1;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:10px 14px;">
      <div style="font-size:9px;text-transform:uppercase;color:#6b7280;font-weight:700">Balance Payable</div>
      <div style="font-size:15px;font-weight:900;color:${bal > 0 ? "#dc2626" : "#16a34a"};margin-top:3px">PKR ${Math.abs(bal).toLocaleString()} ${bal > 0 ? "Cr" : bal < 0 ? "Dr" : ""}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Date</th><th>Description</th><th style="text-align:right">Paid (Dr)</th><th style="text-align:right">Earned (Cr)</th><th style="text-align:right">Balance</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="3">Closing Balance</td>
      <td style="text-align:right">PKR ${(driverDetail.totalPaid || 0).toLocaleString()}</td>
      <td style="text-align:right">PKR ${(driverDetail.totalEarned || 0).toLocaleString()}</td>
      <td style="text-align:right;color:${bal > 0 ? "#dc2626" : "#16a34a"}">PKR ${Math.abs(bal).toLocaleString()} ${bal > 0 ? "Cr" : bal < 0 ? "Dr" : ""}</td>
    </tr></tfoot>
  </table>
</div>
</body></html>`)
    w.print()
  }

  const printChallan = (slip: any) => {
    const challan = slip.deliveryChallan
    const ref = challan?.challanNo || slip.builtyNo || slip.slipNo || "—"
    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>Delivery Challan — ${ref}</title>
<style>${receiptCSS}</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div>
    <div class="doc-title">Delivery Challan</div>
    <div class="doc-sub">Challan No: ${challan?.challanNo || "—"} &nbsp;|&nbsp; Builty No: ${slip.builtyNo || "—"}</div>
  </div>
  <div class="doc-meta"><div>${new Date().toLocaleDateString("en-PK")}</div></div>
</div>
<div class="body-pad">
  <div class="info-grid">
    <div><div class="lbl">Driver</div><div class="val">${slip.driver?.name || "—"}</div></div>
    <div><div class="lbl">Vehicle</div><div class="val">${slip.vehicle?.vehicleNo || "—"}</div></div>
    <div><div class="lbl">From</div><div class="val">${slip.fromLocation || "—"}</div></div>
    <div><div class="lbl">To</div><div class="val">${slip.toLocation || "—"}</div></div>
    <div><div class="lbl">Mill</div><div class="val">${slip.mill || "—"}</div></div>
    <div><div class="lbl">Commodity</div><div class="val">${slip.commodity || "—"}</div></div>
    <div><div class="lbl">Bags</div><div class="val">${slip.bags || "—"}</div></div>
    <div><div class="lbl">Weighbridge</div><div class="val">${slip.weighbridge ? slip.weighbridge + " KG" : "—"}</div></div>
    <div><div class="lbl">Net Weight</div><div class="val">${slip.netWeight ? slip.netWeight + " KG" : "—"}</div></div>
    <div><div class="lbl">Rate</div><div class="val">${slip.rate || "—"}</div></div>
    <div><div class="lbl">Net Amount</div><div class="val">PKR ${slip.netAmount ? slip.netAmount.toLocaleString() : "—"}</div></div>
    <div><div class="lbl">Rent</div><div class="val">PKR ${slip.rent ? slip.rent.toLocaleString() : "—"}</div></div>
    <div><div class="lbl">Ref No</div><div class="val">${slip.referenceNo || "—"}</div></div>
    ${slip.unloadDate ? `<div><div class="lbl">Unload Date</div><div class="val">${new Date(slip.unloadDate).toLocaleDateString("en-PK")}</div></div>` : ""}
  </div>
  <div class="sig-row">
    <span>Received By: _______________________</span>
    <span>Guard Signature: _______________________</span>
    <span>Authorized By: _______________________</span>
  </div>
</div>
</body></html>`)
    w.print()
  }

  const filtered = slips.filter((s) => {
    const matchSearch = !search ||
      (s.driver?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.vehicle?.vehicleNo || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.builtyNo || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.commodity || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.mill || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.referenceNo || "").toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === "all" || s.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">FeedMills</h2>
          <p className="text-gray-500 text-sm">Manage drivers, vehicles, freight slips & ledgers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setEditingDriver(null); setDForm({ name: "", phone: "", cnic: "", address: "", license: "" }); setShowDriverModal(true) }} className="gap-2">
            <User className="w-4 h-4" /> Add Driver
          </Button>
          <Button variant="outline" onClick={() => setShowVehicleModal(true)} className="gap-2">
            <Truck className="w-4 h-4" /> Add Vehicle
          </Button>
          <Button onClick={() => { setForm({ ...BLANK_FORM }); setShowSlipModal(true) }} className="bg-teal-700 hover:bg-teal-800 gap-2">
            <Plus className="w-4 h-4" /> New FeedMills
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Slips", value: slips.length, color: "text-gray-900" },
          { label: "Pending", value: slips.filter((s) => s.status === "PENDING").length, color: "text-yellow-600" },
          { label: "In Transit", value: slips.filter((s) => s.status === "IN_TRANSIT").length, color: "text-blue-600" },
          { label: "Delivered", value: slips.filter((s) => s.status === "DELIVERED").length, color: "text-green-700" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {([
          ["slips", `Freight Slips (${slips.length})`],
          ["drivers", `Drivers (${drivers.length})`],
          ["vehicles", `Vehicles (${vehicles.length})`],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 ${tab === key ? "border-teal-700 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Freight Slips Tab ── */}
      {tab === "slips" && (
        <>
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search driver, builty, vehicle, mill..." value={search}
                onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button variant="outline" className="gap-2 shrink-0" onClick={() => printAllSlips(filtered)}>
              <Printer className="w-4 h-4" /> Print All
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Driver</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Builty</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Rate</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Vehicle</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Weighbridge</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Loading Date</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Bags</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Mill</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Net Wt</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Unload Date</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Deduction</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Net Amt</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Rent</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Labour</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ref No</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr><td colSpan={17} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
                    ) : filtered.map((s, i) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-gray-800">{s.driver?.name || s.walkInDriver || "—"}</p>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{s.builtyNo || s.slipNo}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{s.rate > 0 ? s.rate : "—"}</td>
                        <td className="px-3 py-2.5 text-gray-700">{s.vehicle?.vehicleNo || s.walkInVehicle || "—"}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{s.weighbridge ? `${s.weighbridge} KG` : "—"}</td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs">{s.loadingDate ? formatDateSlash(s.loadingDate) : "—"}</td>
                        <td className="px-3 py-2.5 text-center text-gray-700">{s.bags || "—"}</td>
                        <td className="px-3 py-2.5 text-gray-700">{s.mill || "—"}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{s.netWeight ? `${s.netWeight} KG` : "—"}</td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs">{s.unloadDate ? formatDateSlash(s.unloadDate) : "—"}</td>
                        <td className="px-3 py-2.5 text-right text-red-500">{s.deduction > 0 ? formatCurrency(s.deduction) : "—"}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{s.netAmount > 0 ? formatCurrency(s.netAmount) : "—"}</td>
                        <td className="px-3 py-2.5 text-right text-orange-600 font-medium">{s.rent > 0 ? formatCurrency(s.rent) : "—"}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{s.labour > 0 ? formatCurrency(s.labour) : "—"}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500">{s.referenceNo || "—"}</td>
                        <td className="px-3 py-2.5 text-center">
                          <button onClick={() => printChallan(s)} className="p-1 text-gray-400 hover:text-teal-600" title="Print Challan">
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!loading && filtered.length === 0 && (
                      <tr><td colSpan={17} className="px-4 py-10 text-center text-gray-400">No freight slips found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Drivers Tab ── */}
      {tab === "drivers" && (
        <>
          <div className="flex justify-end">
            <Button variant="outline" className="gap-2" onClick={printAllDrivers}>
              <Printer className="w-4 h-4" /> Print All Drivers
            </Button>
          </div>
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">CNIC</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">License</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Trips</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Balance (Payable)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {drivers.map((d, i) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{d.name}</td>
                    <td className="px-4 py-3 text-gray-600">{d.phone || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{d.cnic || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{d.license || "—"}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{d._count?.freightSlips || 0}</td>
                    <td className="px-4 py-3 text-right">
                      {(d.balance || 0) > 0 ? (
                        <span className="font-bold text-red-600">{formatCurrency(d.balance)}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openDriverLedger(d)} className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded" title="View Ledger">
                          <BookOpen className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setSelectedDriver(d); setPayForm({ amount: "", method: "CASH", notes: "", bankId: "" }); setShowPaymentModal(true) }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Pay Driver">
                          <ArrowDownCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setEditingDriver(d); setDForm({ name: d.name, phone: d.phone || "", cnic: d.cnic || "", address: d.address || "", license: d.license || "" }); setShowDriverModal(true) }}
                          className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded" title="Edit">
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {drivers.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No drivers yet</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
        </>
      )}

      {/* ── Vehicles Tab ── */}
      {tab === "vehicles" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((v) => (
            <Card key={v.id}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-5 h-5 text-teal-700" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{v.vehicleNo}</p>
                    <p className="text-xs text-gray-500">{v.vehicleType}</p>
                    <p className="text-sm text-gray-700 mt-1">{v.driverName || "No driver assigned"}</p>
                    {v.driverPhone && <p className="text-xs text-gray-500">{v.driverPhone}</p>}
                    <p className="text-xs text-gray-400 mt-2">{v._count?.freightSlips || 0} trips</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {vehicles.length === 0 && (
            <div className="col-span-3 text-center py-12 text-gray-400">
              <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No vehicles yet.</p>
            </div>
          )}
        </div>
      )}

      {/* ── New Freight Slip Modal ── */}
      <Dialog open={showSlipModal} onOpenChange={setShowSlipModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New FeedMill</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Driver</Label>
              <Select value={form.driverId || "none"} onValueChange={(v) => setForm({ ...form, driverId: v === "none" ? "" : v, walkInDriverName: "" })}>
                <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No driver</SelectItem>
                  <SelectItem value="walkin">Walk-in / Manual Entry</SelectItem>
                  {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}{d.phone ? ` — ${d.phone}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.driverId === "walkin" && (
                <Input className="mt-2" placeholder="Enter driver name..." value={form.walkInDriverName}
                  onChange={(e) => setForm({ ...form, walkInDriverName: e.target.value })} autoFocus />
              )}
            </div>
            <div>
              <Label>Builty No</Label>
              <Input value={form.builtyNo} onChange={(e) => setForm({ ...form, builtyNo: e.target.value })} placeholder="Bill of Lading #" />
            </div>
            <div>
              <Label>Rate (per unit)</Label>
              <Input type="number" value={form.rate} onChange={(e) => updateForm("rate", e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Vehicle</Label>
              <Select value={form.vehicleId || "none"} onValueChange={(v) => setForm({ ...form, vehicleId: v === "none" ? "" : v, walkInVehicleName: "" })}>
                <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No vehicle</SelectItem>
                  <SelectItem value="walkin">Walk-in / Manual Entry</SelectItem>
                  {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.vehicleNo} — {v.vehicleType}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.vehicleId === "walkin" && (
                <Input className="mt-2" placeholder="Enter vehicle number..." value={form.walkInVehicleName}
                  onChange={(e) => setForm({ ...form, walkInVehicleName: e.target.value })} />
              )}
            </div>
            <div>
              <Label>Weighbridge (KG)</Label>
              <Input type="number" value={form.weighbridge} onChange={(e) => setForm({ ...form, weighbridge: e.target.value })} />
            </div>
            <div>
              <Label>Loading Date</Label>
              <Input type="date" value={form.loadingDate} onChange={(e) => setForm({ ...form, loadingDate: e.target.value })} />
            </div>
            <div>
              <Label>Bags</Label>
              <Input type="number" value={form.bags} onChange={(e) => updateForm("bags", e.target.value)} />
            </div>
            <div>
              <Label>Mill</Label>
              <Input value={form.mill} onChange={(e) => setForm({ ...form, mill: e.target.value })} placeholder="Mill name" />
            </div>
            <div>
              <Label>Net Weight (KG)</Label>
              <Input type="number" value={form.netWeight} onChange={(e) => updateForm("netWeight", e.target.value)} />
            </div>
            <div>
              <Label>Unload Date</Label>
              <Input type="date" value={form.unloadDate} onChange={(e) => setForm({ ...form, unloadDate: e.target.value })} />
            </div>
            <div>
              <Label>Deduction (PKR)</Label>
              <Input type="number" value={form.deduction} onChange={(e) => setForm({ ...form, deduction: e.target.value })} placeholder="0" />
            </div>
            <div>
              <Label>Net Amount (PKR)</Label>
              <Input type="number" value={form.netAmount} onChange={(e) => setForm({ ...form, netAmount: e.target.value })} placeholder="Auto-calculated" />
            </div>
            <div>
              <Label>Rent (PKR) <span className="text-xs text-gray-400">— paid to driver</span></Label>
              <Input type="number" value={form.rent} onChange={(e) => setForm({ ...form, rent: e.target.value })} placeholder="0" />
            </div>
            <div>
              <Label>Labour (PKR)</Label>
              <Input type="number" value={form.labour} onChange={(e) => setForm({ ...form, labour: e.target.value })} placeholder="0" />
            </div>
            <div>
              <Label>Reference No</Label>
              <Input value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} />
            </div>
            <div>
              <Label>Customer</Label>
              <Select value={form.customerId || "none"} onValueChange={(v) => setForm({ ...form, customerId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No customer</SelectItem>
                  {customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>From Location *</Label>
              <Input value={form.fromLocation} onChange={(e) => setForm({ ...form, fromLocation: e.target.value })} placeholder="Origin" />
            </div>
            <div>
              <Label>To Location *</Label>
              <Input value={form.toLocation} onChange={(e) => setForm({ ...form, toLocation: e.target.value })} placeholder="Destination" />
            </div>
            <div>
              <Label>Commodity</Label>
              <Input value={form.commodity} onChange={(e) => setForm({ ...form, commodity: e.target.value })} placeholder="e.g. Wheat, Rice..." />
            </div>
          </div>
          <div className="flex gap-3 pt-2 mt-1">
            <Button variant="outline" onClick={() => setShowSlipModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleCreateSlip} className="flex-1 bg-teal-700 hover:bg-teal-800">Create Slip</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Driver Modal ── */}
      <Dialog open={showDriverModal} onOpenChange={setShowDriverModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingDriver ? "Edit Driver" : "Add Driver"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Full Name *</Label>
              <Input value={dForm.name} onChange={(e) => setDForm({ ...dForm, name: e.target.value })} autoFocus /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label>
                <Input value={dForm.phone} onChange={(e) => setDForm({ ...dForm, phone: e.target.value })} /></div>
              <div><Label>CNIC</Label>
                <Input value={dForm.cnic} onChange={(e) => setDForm({ ...dForm, cnic: e.target.value })} /></div>
            </div>
            <div><Label>License No</Label>
              <Input value={dForm.license} onChange={(e) => setDForm({ ...dForm, license: e.target.value })} /></div>
            <div><Label>Address</Label>
              <Input value={dForm.address} onChange={(e) => setDForm({ ...dForm, address: e.target.value })} /></div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowDriverModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSaveDriver} className="flex-1 bg-teal-700 hover:bg-teal-800">
                {editingDriver ? "Update" : "Add Driver"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Driver Payment Modal ── */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Pay Driver — {selectedDriver?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Amount (PKR) *</Label>
              <Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} autoFocus /></div>
            <div><Label>Method</Label>
              <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {banks.length > 0 && (
              <div><Label>Bank (optional)</Label>
                <Select value={payForm.bankId || "none"} onValueChange={(v) => setPayForm({ ...payForm, bankId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No bank</SelectItem>
                    {banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Notes</Label>
              <Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} /></div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowPaymentModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleDriverPayment} className="flex-1 bg-teal-700 hover:bg-teal-800">Pay Driver</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Driver Ledger Modal ── */}
      <Dialog open={showDriverLedger} onOpenChange={setShowDriverLedger}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-teal-600" />
                {selectedDriver?.name} — Driver Ledger
              </DialogTitle>
              <div className="flex gap-2 mr-6">
                <Button size="sm" variant="outline" className="gap-2"
                  onClick={printDriverLedger} disabled={!driverDetail}>
                  <Printer className="w-4 h-4" /> Print
                </Button>
                <Button size="sm" variant="outline" className="gap-2"
                  onClick={() => { setShowDriverLedger(false); setShowPaymentModal(true) }}>
                  <ArrowDownCircle className="w-4 h-4" /> Pay Driver
                </Button>
              </div>
            </div>
          </DialogHeader>
          {driverDetailError ? (
            <div className="py-10 text-center">
              <p className="text-red-500 mb-3">{driverDetailError}</p>
              <Button size="sm" variant="outline" onClick={() => loadDriverDetail(selectedDriver?.id)}>Retry</Button>
            </div>
          ) : !driverDetail ? (
            <div className="py-10 text-center text-gray-400">Loading...</div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 uppercase font-medium">Total Earned (Cr)</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(driverDetail.totalEarned || 0)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 uppercase font-medium">Total Paid (Dr)</p>
                    <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(driverDetail.totalPaid || 0)}</p>
                  </CardContent>
                </Card>
                <Card className={(driverDetail.balance || 0) > 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 uppercase font-medium">Balance Payable</p>
                    <p className={`text-xl font-bold mt-1 ${(driverDetail.balance || 0) > 0 ? "text-red-600" : "text-green-700"}`}>
                      {formatCurrency(Math.abs(driverDetail.balance || 0))}
                      <span className="text-sm font-normal ml-1">{(driverDetail.balance || 0) > 0 ? "Cr" : (driverDetail.balance || 0) < 0 ? "Dr" : ""}</span>
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Ledger Table */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Paid (Dr)</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Earned (Cr)</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {driverDetail.ledger?.map((entry: any, i: number) => (
                      <tr key={i} className={entry.type === "PAYMENT" ? "bg-green-50/40" : ""}>
                        <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDateDMY(entry.date)}</td>
                        <td className="px-4 py-3 text-gray-700 text-xs">{entry.description}</td>
                        <td className="px-4 py-3 text-right text-green-700">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : "—"}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${entry.balance > 0 ? "text-red-600" : "text-green-700"}`}>
                          {formatCurrency(Math.abs(entry.balance))}
                          {entry.balance !== 0 && <span className="text-xs ml-1 font-normal">{entry.balance > 0 ? "Cr" : "Dr"}</span>}
                        </td>
                      </tr>
                    ))}
                    {driverDetail.ledger?.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No transactions yet</td></tr>
                    )}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 font-bold text-gray-700">Closing Balance</td>
                      <td className="px-4 py-3 text-right font-bold text-green-700">{formatCurrency(driverDetail.totalPaid || 0)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(driverDetail.totalEarned || 0)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${(driverDetail.balance || 0) > 0 ? "text-red-600" : "text-green-700"}`}>
                        {formatCurrency(Math.abs(driverDetail.balance || 0))}
                        <span className="text-sm ml-1 font-normal">{(driverDetail.balance || 0) > 0 ? "Cr" : (driverDetail.balance || 0) < 0 ? "Dr" : ""}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dispatch Modal ── */}
      <Dialog open={!!showDispatchModal} onOpenChange={() => setShowDispatchModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Dispatch & Create Delivery Challan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Items / Description *</Label>
              <Input value={dispForm.items} onChange={(e) => setDispForm({ ...dispForm, items: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Total Bags</Label>
                <Input type="number" value={dispForm.totalBags} onChange={(e) => setDispForm({ ...dispForm, totalBags: e.target.value })} /></div>
              <div><Label>Total Weight (KG)</Label>
                <Input type="number" value={dispForm.totalWeight} onChange={(e) => setDispForm({ ...dispForm, totalWeight: e.target.value })} /></div>
            </div>
            <div><Label>Received By</Label>
              <Input value={dispForm.receivedBy} onChange={(e) => setDispForm({ ...dispForm, receivedBy: e.target.value })} /></div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowDispatchModal(null)} className="flex-1">Cancel</Button>
              <Button onClick={() => handleDispatch(showDispatchModal.id)} className="flex-1">Dispatch & Create Challan</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Vehicle Modal ── */}
      <Dialog open={showVehicleModal} onOpenChange={setShowVehicleModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Vehicle</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Vehicle Number *</Label>
              <Input value={vForm.vehicleNo} onChange={(e) => setVForm({ ...vForm, vehicleNo: e.target.value })} placeholder="e.g. LHR-1234" autoFocus /></div>
            <div><Label>Vehicle Type</Label>
              <Select value={vForm.vehicleType} onValueChange={(v) => setVForm({ ...vForm, vehicleType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Truck", "Pickup", "Trailer", "Rickshaw", "Van", "Container"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Driver Name</Label>
                <Input value={vForm.driverName} onChange={(e) => setVForm({ ...vForm, driverName: e.target.value })} /></div>
              <div><Label>Driver Phone</Label>
                <Input value={vForm.driverPhone} onChange={(e) => setVForm({ ...vForm, driverPhone: e.target.value })} /></div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowVehicleModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSaveVehicle} className="flex-1">Add Vehicle</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
