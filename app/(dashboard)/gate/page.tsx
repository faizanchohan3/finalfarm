"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDate } from "@/lib/utils"
import { buildPrintHeader, receiptCSS } from "@/lib/print-utils"
import { Plus, DoorOpen, Scale, FileCheck, LogOut, Clock, Printer } from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-green-100 text-purple-700",
  CLOSED: "bg-blue-100 text-gray-600",
}
const TYPE_COLORS: Record<string, string> = {
  IN: "bg-blue-100 text-blue-700",
  OUT: "bg-orange-100 text-orange-700",
}

export default function GatePage() {
  const [entries, setEntries] = useState<any[]>([])
  const [farmers, setFarmers] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [shop, setShop] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showEntryModal, setShowEntryModal] = useState(false)
  const [showWeighModal, setShowWeighModal] = useState<any>(null)
  const [form, setForm] = useState({ type: "IN", vehicleId: "", vehicleNo: "", driverName: "", farmerId: "", agentId: "", commodity: "", bags: "", purpose: "", notes: "" })
  const [weighForm, setWeighForm] = useState({ grossWeight: "", tareWeight: "", bags: "", notes: "" })
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split("T")[0])

  async function loadData() {
    setLoading(true)
    const [e, f, a, v, sh] = await Promise.all([
      fetch(`/api/gate?date=${filterDate}`).then((r) => r.json()),
      fetch("/api/farmers").then((r) => r.json()),
      fetch("/api/agents").then((r) => r.json()),
      fetch("/api/vehicles").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({ shop: null })),
    ])
    setEntries(e.entries || [])
    setFarmers(f.farmers || [])
    setAgents(a.agents || [])
    setVehicles(v.vehicles || [])
    setShop(sh.shop || null)
    setLoading(false)
  }
  useEffect(() => { loadData() }, [filterDate])

  async function handleCreateEntry() {
    await fetch("/api/gate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        bags: form.bags ? parseInt(form.bags) : null,
        vehicleId: form.vehicleId || null,
        farmerId: form.farmerId || null,
        agentId: form.agentId || null,
      }),
    })
    setShowEntryModal(false); loadData()
  }

  async function handleExit(id: string) {
    await fetch(`/api/gate/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "exit" }),
    })
    loadData()
  }

  async function handleWeigh(id: string) {
    const gross = parseFloat(weighForm.grossWeight) || 0
    const tare = parseFloat(weighForm.tareWeight) || 0
    await fetch(`/api/gate/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "weigh",
        grossWeight: gross,
        tareWeight: tare,
        bags: weighForm.bags ? parseInt(weighForm.bags) : null,
        notes: weighForm.notes,
      }),
    })
    setShowWeighModal(null); loadData()
  }

  async function handleGatePass(id: string) {
    await fetch(`/api/gate/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "gatepass", purpose: "Exit authorization" }),
    })
    loadData()
  }

  const printGatePass = (entry: any) => {
    const pass = entry.gatePass
    const ref = pass?.passNo || entry.entryNo
    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>Gate Pass — ${ref}</title>
<style>${receiptCSS}</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div>
    <div class="doc-title">Gate Pass</div>
    <div class="doc-sub">Pass No: ${pass?.passNo || "—"} &nbsp;|&nbsp; Entry No: ${entry.entryNo}</div>
  </div>
  <div class="doc-meta">
    <div>${new Date(entry.entryTime).toLocaleString("en-PK")}</div>
    <div style="margin-top:3px;padding:2px 8px;background:${entry.type === "IN" ? "#dbeafe" : "#ffedd5"};color:${entry.type === "IN" ? "#1d4ed8" : "#c2410c"};border-radius:99px;font-size:9px;font-weight:700;display:inline-block">${entry.type}</div>
  </div>
</div>
<div class="body-pad">
  <div class="info-grid">
    <div><div class="lbl">Vehicle No</div><div class="val">${entry.vehicle?.vehicleNo || entry.vehicleNo || "—"}</div></div>
    <div><div class="lbl">Driver</div><div class="val">${entry.driverName || entry.vehicle?.driverName || "—"}</div></div>
    <div><div class="lbl">Farmer</div><div class="val">${entry.farmer?.name || "—"}</div></div>
    <div><div class="lbl">Agent</div><div class="val">${entry.agent?.name || "—"}</div></div>
    <div><div class="lbl">Commodity</div><div class="val">${entry.commodity || "—"}</div></div>
    <div><div class="lbl">Bags</div><div class="val">${entry.bags || "—"}</div></div>
    ${entry.weighbridgeEntries?.[0] ? `<div><div class="lbl">Net Weight</div><div class="val">${entry.weighbridgeEntries[0].netWeight} KG</div></div>` : ""}
    ${entry.purpose ? `<div><div class="lbl">Purpose</div><div class="val">${entry.purpose}</div></div>` : ""}
  </div>
  <div class="sig-row" style="margin-top:48px">
    <span>Authorized By: _______________________</span>
    <span>Guard Signature: _______________________</span>
  </div>
</div>
</body></html>`)
    w.print()
  }

  const open = entries.filter((e) => e.status === "OPEN").length
  const closed = entries.filter((e) => e.status === "CLOSED").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gate Entry / Exit</h2>
          <p className="text-gray-500 text-sm">Weighbridge, gate passes & vehicle tracking</p>
        </div>
        <Button onClick={() => { setForm({ type: "IN", vehicleId: "", vehicleNo: "", driverName: "", farmerId: "", agentId: "", commodity: "", bags: "", purpose: "", notes: "" }); setShowEntryModal(true) }}
          className="bg-purple-700 hover:bg-purple-800 gap-2">
          <Plus className="w-4 h-4" /> New Entry
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Today's Entries</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{entries.length}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="p-4">
            <p className="text-xs text-purple-600 uppercase font-medium tracking-wide">Open (Inside)</p>
            <p className="text-2xl font-bold text-purple-700 mt-1">{open}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Exited</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{closed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Gate Passes Issued</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{entries.filter((e) => e.gatePass).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Date Filter */}
      <div className="flex items-center gap-3">
        <Label className="whitespace-nowrap">Filter Date:</Label>
        <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-44" />
        <Button variant="outline" size="sm" onClick={() => setFilterDate(new Date().toISOString().split("T")[0])}>Today</Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DoorOpen className="w-4 h-4" /> Gate Register ({entries.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-blue-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Entry #</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Farmer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Agent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Commodity</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Bags</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Net Weight</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Entry Time</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
                ) : entries.map((e) => {
                  const latestWeigh = e.weighbridgeEntries?.[e.weighbridgeEntries.length - 1]
                  return (
                    <tr key={e.id} className="hover:bg-blue-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{e.entryNo}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[e.type]}`}>{e.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{e.vehicle?.vehicleNo || e.vehicleNo || "—"}</p>
                        <p className="text-xs text-gray-500">{e.driverName || e.vehicle?.driverName}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{e.farmer?.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{e.agent?.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{e.commodity || "—"}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{e.bags || "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-blue-700">
                        {latestWeigh ? `${latestWeigh.netWeight} KG` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(e.entryTime).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[e.status]}`}>{e.status}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {e.status === "OPEN" && !latestWeigh && (
                            <button onClick={() => { setShowWeighModal(e); setWeighForm({ grossWeight: "", tareWeight: "", bags: e.bags ? String(e.bags) : "", notes: "" }) }}
                              title="Weigh" className="p-1 text-gray-400 hover:text-blue-600">
                              <Scale className="w-4 h-4" />
                            </button>
                          )}
                          {e.status === "OPEN" && !e.gatePass && (
                            <button onClick={() => handleGatePass(e.id)} title="Issue Gate Pass"
                              className="p-1 text-gray-400 hover:text-purple-600">
                              <FileCheck className="w-4 h-4" />
                            </button>
                          )}
                          {e.status === "OPEN" && (
                            <button onClick={() => handleExit(e.id)} title="Record Exit"
                              className="p-1 text-gray-400 hover:text-red-600">
                              <LogOut className="w-4 h-4" />
                            </button>
                          )}
                          {e.gatePass && (
                            <button onClick={() => printGatePass(e)} title="Print Gate Pass"
                              className="p-1 text-gray-400 hover:text-teal-600">
                              <Printer className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!loading && entries.length === 0 && <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-400">No entries for this date</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* New Entry Modal */}
      <Dialog open={showEntryModal} onOpenChange={setShowEntryModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Gate Entry</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Entry Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">IN — Vehicle Entering</SelectItem>
                  <SelectItem value="OUT">OUT — Vehicle Exiting</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vehicle</Label>
                <Select value={form.vehicleId} onValueChange={(v) => setForm({ ...form, vehicleId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                  <SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.vehicleNo}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Vehicle No (manual)</Label>
                <Input value={form.vehicleNo} onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })} placeholder="If not registered" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Farmer</Label>
                <Select value={form.farmerId} onValueChange={(v) => setForm({ ...form, farmerId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select farmer" /></SelectTrigger>
                  <SelectContent>{farmers.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Agent (Aadat)</Label>
                <Select value={form.agentId} onValueChange={(v) => setForm({ ...form, agentId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                  <SelectContent>{agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Commodity</Label>
                <Input value={form.commodity} onChange={(e) => setForm({ ...form, commodity: e.target.value })} placeholder="Wheat, Rice..." /></div>
              <div><Label>Bags</Label>
                <Input type="number" value={form.bags} onChange={(e) => setForm({ ...form, bags: e.target.value })} /></div>
            </div>
            <div><Label>Purpose / Notes</Label>
              <Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowEntryModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleCreateEntry} className="flex-1 bg-purple-700 hover:bg-purple-800">Create Entry</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Weighbridge Modal */}
      <Dialog open={!!showWeighModal} onOpenChange={() => setShowWeighModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Scale className="w-5 h-5" /> Weighbridge — {showWeighModal?.entryNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Gross Weight (KG) *</Label>
                <Input type="number" value={weighForm.grossWeight} onChange={(e) => setWeighForm({ ...weighForm, grossWeight: e.target.value })} autoFocus /></div>
              <div><Label>Tare Weight (KG)</Label>
                <Input type="number" value={weighForm.tareWeight} onChange={(e) => setWeighForm({ ...weighForm, tareWeight: e.target.value })} /></div>
            </div>
            {weighForm.grossWeight && (
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600">Net Weight</p>
                <p className="text-2xl font-bold text-blue-700">
                  {(parseFloat(weighForm.grossWeight) - parseFloat(weighForm.tareWeight || "0")).toFixed(1)} KG
                </p>
              </div>
            )}
            <div><Label>Bags</Label>
              <Input type="number" value={weighForm.bags} onChange={(e) => setWeighForm({ ...weighForm, bags: e.target.value })} /></div>
            <div><Label>Notes</Label>
              <Input value={weighForm.notes} onChange={(e) => setWeighForm({ ...weighForm, notes: e.target.value })} /></div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowWeighModal(null)} className="flex-1">Cancel</Button>
              <Button onClick={() => handleWeigh(showWeighModal.id)} className="flex-1">Save Weight</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
