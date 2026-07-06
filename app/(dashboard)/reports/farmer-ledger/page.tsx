"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatDate } from "@/lib/utils"
import { buildPrintHeader, reportCSS } from "@/lib/print-utils"
import { Printer, BookOpen, Tractor, Search, ArrowRight, X } from "lucide-react"

export default function FarmerLedgerPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-400">Loading...</div>}>
      <FarmerLedgerContent />
    </Suspense>
  )
}

function FarmerLedgerContent() {
  const searchParams = useSearchParams()
  const [farmers, setFarmers] = useState<any[]>([])
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [farmerId, setFarmerId] = useState("")
  const [ledger, setLedger] = useState<any>(null)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [printingAll, setPrintingAll] = useState(false)
  const [shop, setShop] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/reports/all-farmers").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({ shop: null })),
    ]).then(([fd, sd]) => {
      setFarmers(fd.farmers || [])
      setShop(sd.shop || null)
      setSummaryLoading(false)
      const preselect = searchParams.get("id")
      if (preselect) setFarmerId(preselect)
    })
  }, [])

  useEffect(() => {
    if (farmerId) loadLedger()
  }, [farmerId])

  async function loadLedger() {
    if (!farmerId) return
    setLoading(true)
    const params = new URLSearchParams()
    if (dateFrom) params.set("from", dateFrom)
    if (dateTo) params.set("to", dateTo)
    const data = await fetch(`/api/reports/farmer-ledger/${farmerId}?${params}`).then((r) => r.json())
    setLedger(data)
    setLoading(false)
  }

  function clearLedger() {
    setFarmerId("")
    setLedger(null)
    setDateFrom("")
    setDateTo("")
  }

  const dateLabel = dateFrom || dateTo
    ? `${dateFrom ? formatDate(dateFrom) : "Start"} — ${dateTo ? formatDate(dateTo) : "Today"}`
    : "All Time"

  const filtered = farmers.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      (f.village || "").toLowerCase().includes(search.toLowerCase()) ||
      (f.phone || "").includes(search)
  )

  const selectedFarmer = farmers.find((f) => f.id === farmerId)

  const totalPayable = farmers.filter((f) => f.balance > 0).reduce((s, f) => s + f.balance, 0)
  const totalAdvance = farmers.filter((f) => f.balance < 0).reduce((s, f) => s + Math.abs(f.balance), 0)

  async function printAll() {
    setPrintingAll(true)
    const date = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
    const ledgers = await Promise.all(
      filtered.map((f) => fetch(`/api/reports/farmer-ledger/${f.id}`).then((r) => r.json()))
    )
    setPrintingAll(false)
    const sections = ledgers.map((data, idx) => {
      const f = filtered[idx]
      const bal = data.closingBalance || 0
      const balColor = bal > 0 ? "#b91c1c" : "#15803d"
      const balLabel = bal > 0 ? "Payable to Farmer" : bal < 0 ? "Advance Paid" : "Settled"
      const txRows = (data.entries || []).map((e: any, i: number) => `
        <tr style="${i%2===0?"background:#f9fdf9":""}">
          <td>${i+1}</td>
          <td style="white-space:nowrap">${new Date(e.date).toLocaleDateString("en-PK")}</td>
          <td><span style="font-size:8px;padding:1px 6px;border-radius:99px;background:${e.type==="PAYMENT"?"#dcfce7":"#fef3c7"};color:${e.type==="PAYMENT"?"#166534":"#92400e"};font-weight:700">${e.type}</span></td>
          <td style="font-size:9px">${e.description}</td>
          <td style="text-align:right">${e.debit>0?"PKR "+e.debit.toLocaleString():"—"}</td>
          <td style="text-align:right;color:#15803d">${e.credit>0?"PKR "+e.credit.toLocaleString():"—"}</td>
          <td style="text-align:right;font-weight:600;color:${e.balance>0?"#b91c1c":"#15803d"}">PKR ${Math.abs(e.balance).toLocaleString()} ${e.balance>0?"Cr":e.balance<0?"Dr":""}</td>
        </tr>`).join("")
      return `<div style="margin-bottom:28px">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:13px;font-weight:800;color:#14532d">${f.name}</div>
            <div style="font-size:10px;color:#6b7280;margin-top:2px">${[f.village,f.phone,f.cnic].filter(Boolean).join(" · ")||"No contact info"}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:15px;font-weight:900;color:${balColor}">PKR ${Math.abs(bal).toLocaleString()}</div>
            <div style="font-size:9px;color:${balColor};font-weight:700">${balLabel}</div>
          </div>
        </div>
        ${(data.entries||[]).length>0?`<table>
          <thead><tr><th>#</th><th>Date</th><th>Type</th><th>Description</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th></tr></thead>
          <tbody>${txRows}</tbody>
          <tfoot><tr><td colspan="4"><strong>Closing — ${(data.entries||[]).length} entries</strong></td>
            <td style="text-align:right"><strong>PKR ${(data.totalDebit||0).toLocaleString()}</strong></td>
            <td style="text-align:right;color:#15803d"><strong>PKR ${(data.totalCredit||0).toLocaleString()}</strong></td>
            <td style="text-align:right;color:${balColor}"><strong>PKR ${Math.abs(bal).toLocaleString()} ${bal>0?"Cr":bal<0?"Dr":""}</strong></td>
          </tr></tfoot>
        </table>`:`<p style="text-align:center;color:#9ca3af;font-size:10px;padding:8px 0">No transactions</p>`}
      </div>`
    }).join('<div style="border-top:2px dashed #d1fae5;margin:20px 0"></div>')
    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>All Farmers — Full Ledger</title>
<style>${reportCSS} body{max-width:960px;margin:0 auto}</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div><div class="doc-title">All Farmers — Full Ledger</div><div class="doc-sub">${filtered.length} farmers · ${date}</div></div>
  <div class="doc-meta"><div>Payable: PKR ${totalPayable.toLocaleString()}</div><div>Advance: PKR ${totalAdvance.toLocaleString()}</div></div>
</div>
<div class="body-pad">${sections}</div>
<div class="sig-row" style="margin:0 20px 20px"><span>Generated: ${date}</span><span>${shop?.name||""}</span></div>
<script>window.onload=()=>{window.print()}<\/script></body></html>`)
    w.document.close()
  }

  return (
    <div className="space-y-5">
      {/* Print header (for individual ledger print) */}
      <div className="hidden print:block mb-4">
        <div style={{background:"linear-gradient(135deg,#14532d 0%,#166534 60%,#15803d 100%)",color:"#fff",padding:"16px 22px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            {shop?.logo ? <img src={shop.logo} style={{width:"52px",height:"52px",borderRadius:"8px",background:"#fff",padding:"3px",objectFit:"contain"}} alt="" />
              : <div style={{width:"52px",height:"52px",borderRadius:"8px",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"26px",fontWeight:900,border:"2px solid rgba(255,255,255,0.3)"}}>{(shop?.name||"G")[0].toUpperCase()}</div>}
            <div>
              <div style={{fontSize:"20px",fontWeight:900}}>{shop?.name||"Gala Mandi"}</div>
              {shop?.ownerName && <div style={{fontSize:"11px",opacity:0.8}}>{shop.ownerName}</div>}
            </div>
          </div>
          <div style={{textAlign:"right",fontSize:"11px",lineHeight:1.9,opacity:0.9}}>
            {shop?.phone && <div>&#9990;&nbsp;{shop.phone}</div>}
            {shop?.address && <div>&#9679;&nbsp;{shop.address}</div>}
          </div>
        </div>
        <div style={{height:"4px",background:"linear-gradient(90deg,#fbbf24,#d97706)"}}></div>
        <div style={{padding:"10px 22px 8px",background:"#f8fdf8",borderBottom:"1px solid #e5e7eb"}}>
          <h2 style={{margin:0,fontSize:"16px",fontWeight:800,color:"#14532d"}}>Farmer Ledger — {selectedFarmer?.name}</h2>
          <div style={{fontSize:"11px",color:"#6b7280",marginTop:"2px"}}>Period: {dateLabel}</div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Farmer Ledger</h2>
          <p className="text-gray-500 text-sm">{farmers.length} farmers · Payable: {formatCurrency(totalPayable)}</p>
        </div>
        <div className="flex gap-2">
          {ledger && <Button onClick={() => window.print()} variant="outline" className="gap-2"><Printer className="w-4 h-4" /> Print Ledger</Button>}
          <Button onClick={printAll} disabled={printingAll} variant="outline" className="gap-2"><Printer className="w-4 h-4" />{printingAll ? "Preparing..." : "Print All Ledgers"}</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 print:hidden">
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Total Farmers</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{farmers.length}</p>
        </CardContent></Card>
        <Card className="border-red-200 bg-red-50/40"><CardContent className="p-4">
          <p className="text-xs text-red-500 uppercase font-medium">Payable to Farmers</p>
          <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(totalPayable)}</p>
        </CardContent></Card>
        <Card className="border-green-200 bg-green-50/40"><CardContent className="p-4">
          <p className="text-xs text-green-600 uppercase font-medium">Advance Paid</p>
          <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(totalAdvance)}</p>
        </CardContent></Card>
      </div>

      {/* All Farmers Summary Table */}
      <Card className="print:hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search farmers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <p className="text-xs text-gray-400">{filtered.length} farmers — click a row to view ledger</p>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 border-b sticky top-0">
                <tr>
                  {["#","Name","Village","Phone","Total Dr","Total Cr","Balance","Status",""].map((h) => (
                    <th key={h} className={`px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase ${["Total Dr","Total Cr","Balance"].includes(h)?"text-right":"text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summaryLoading ? (
                  <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">Loading...</td></tr>
                ) : filtered.map((f, i) => {
                  const bal = f.balance || 0
                  const isSelected = f.id === farmerId
                  return (
                    <tr key={f.id}
                      onClick={() => setFarmerId(isSelected ? "" : f.id)}
                      className={`cursor-pointer transition-colors ${isSelected ? "bg-green-50 border-l-4 border-green-600" : "hover:bg-amber-50"}`}>
                      <td className="px-3 py-2 text-gray-400 text-xs">{i+1}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{f.name}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{f.village || "—"}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{f.phone || "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-700 text-xs">{formatCurrency(f.totalDebit||0)}</td>
                      <td className="px-3 py-2 text-right text-green-700 text-xs">{formatCurrency(f.totalCredit||0)}</td>
                      <td className={`px-3 py-2 text-right font-bold text-xs ${bal>0?"text-red-600":bal<0?"text-green-700":"text-gray-400"}`}>
                        {formatCurrency(Math.abs(bal))}{bal!==0&&<span className="font-normal ml-0.5">{bal>0?"Cr":"Dr"}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bal>0?"bg-red-100 text-red-700":bal<0?"bg-green-100 text-green-700":"bg-amber-100 text-gray-500"}`}>
                          {bal>0?"Payable":bal<0?"Advance":"Settled"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-green-600"><ArrowRight className="w-3.5 h-3.5" /></td>
                    </tr>
                  )
                })}
                {!summaryLoading && filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400"><Tractor className="w-6 h-6 mx-auto mb-1 opacity-30" />No farmers found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Individual Ledger Section */}
      {farmerId && (
        <>
          {/* Ledger filter bar */}
          <Card className="print:hidden">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium">Farmer</label>
                  <Select value={farmerId} onValueChange={(v) => { setFarmerId(v); setLedger(null) }}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {farmers.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}{f.village?` — ${f.village}`:""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium">From Date</label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium">To Date</label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
                </div>
                <Button onClick={loadLedger} disabled={loading} className="bg-green-700 hover:bg-green-800">
                  {loading ? "Loading..." : "Apply Filter"}
                </Button>
                <Button variant="outline" onClick={clearLedger} className="gap-1"><X className="w-4 h-4" /> Clear</Button>
              </div>
            </CardContent>
          </Card>

          {loading && <div className="text-center py-10 text-gray-400">Loading ledger...</div>}

          {ledger && !loading && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="md:col-span-2 bg-green-50">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 font-medium uppercase">Farmer</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">{ledger.farmer?.name}</p>
                    {ledger.farmer?.village && <p className="text-sm text-gray-600">Village: {ledger.farmer.village}</p>}
                    {ledger.farmer?.phone && <p className="text-sm text-gray-600">{ledger.farmer.phone}</p>}
                    {ledger.farmer?.cnic && <p className="text-xs text-gray-500">CNIC: {ledger.farmer.cnic}</p>}
                  </CardContent>
                </Card>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-gray-500 font-medium uppercase">Total Dr</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(ledger.totalDebit)}</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-gray-500 font-medium uppercase">Total Cr</p>
                  <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(ledger.totalCredit)}</p>
                </CardContent></Card>
              </div>

              <div className={`rounded-lg px-5 py-4 flex items-center justify-between ${ledger.closingBalance > 0 ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
                <div>
                  <p className="text-sm font-medium text-gray-700">Closing Balance</p>
                  <p className="text-xs text-gray-500">{ledger.entries?.length || 0} transactions · {dateLabel}</p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${ledger.closingBalance > 0 ? "text-red-700" : "text-green-700"}`}>{formatCurrency(Math.abs(ledger.closingBalance))}</p>
                  <p className={`text-sm font-semibold ${ledger.closingBalance > 0 ? "text-red-600" : "text-green-600"}`}>
                    {ledger.closingBalance > 0 ? "Payable to Farmer" : ledger.closingBalance < 0 ? "Advance Paid" : "Settled"}
                  </p>
                </div>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="w-4 h-4" /> {ledger.farmer?.name} — Account Statement
                    <span className="text-gray-400 font-normal text-sm">({ledger.entries?.length || 0} entries)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-amber-50 border-b border-t">
                        <tr>
                          {["#","Date","Type","Description","Debit (Dr)","Credit (Cr)","Balance"].map((h) => (
                            <th key={h} className={`px-4 py-3 font-semibold text-gray-600 text-xs uppercase ${["Debit (Dr)","Credit (Cr)","Balance"].includes(h)?"text-right":"text-left"}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {ledger.entries?.map((entry: any, i: number) => (
                          <tr key={i} className={entry.type === "PAYMENT" ? "bg-green-50/40" : ""}>
                            <td className="px-4 py-3 text-gray-400 text-xs">{i+1}</td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(entry.date)}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${entry.type==="PAYMENT"?"bg-green-100 text-green-700":entry.type==="INCOME"?"bg-blue-100 text-blue-700":entry.type==="SALE"?"bg-purple-100 text-purple-700":"bg-amber-100 text-amber-700"}`}>
                                {entry.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700 text-xs">{entry.description}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{entry.debit > 0 ? formatCurrency(entry.debit) : "—"}</td>
                            <td className="px-4 py-3 text-right text-green-700">{entry.credit > 0 ? formatCurrency(entry.credit) : "—"}</td>
                            <td className={`px-4 py-3 text-right font-medium ${entry.balance > 0 ? "text-red-600" : "text-green-700"}`}>
                              {formatCurrency(Math.abs(entry.balance))}
                              {entry.balance !== 0 && <span className="text-xs ml-1 font-normal">{entry.balance > 0 ? "Cr" : "Dr"}</span>}
                            </td>
                          </tr>
                        ))}
                        {ledger.entries?.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No transactions found</td></tr>}
                      </tbody>
                      <tfoot className="bg-amber-50 border-t-2 border-amber-200">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 font-bold text-gray-700">Closing Balance</td>
                          <td className="px-4 py-3 text-right font-bold">{formatCurrency(ledger.totalDebit)}</td>
                          <td className="px-4 py-3 text-right font-bold text-green-700">{formatCurrency(ledger.totalCredit)}</td>
                          <td className={`px-4 py-3 text-right font-bold text-lg ${ledger.closingBalance > 0 ? "text-red-600" : "text-green-700"}`}>
                            {formatCurrency(Math.abs(ledger.closingBalance))}
                            <span className="text-sm ml-1 font-normal">{ledger.closingBalance > 0 ? "Cr" : "Dr"}</span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-amber-200 text-center text-xs text-amber-700">
        Powered by Softtech
      </div>
    </div>
  )
}
