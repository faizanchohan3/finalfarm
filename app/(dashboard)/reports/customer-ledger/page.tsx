"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatDate } from "@/lib/utils"
import { buildPrintHeader, reportCSS } from "@/lib/print-utils"
import { Printer, BookOpen, Search, ArrowRight, X, Users } from "lucide-react"
import { Suspense } from "react"

export default function CustomerLedgerPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-400">Loading...</div>}>
      <CustomerLedgerContent />
    </Suspense>
  )
}

function CustomerLedgerContent() {
  const searchParams = useSearchParams()
  const [customers, setCustomers] = useState<any[]>([])
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [ledger, setLedger] = useState<any>(null)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [printingAll, setPrintingAll] = useState(false)
  const [shop, setShop] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/reports/all-traders").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({ shop: null })),
    ]).then(([cd, sd]) => {
      setCustomers(cd.customers || [])
      setShop(sd.shop || null)
      setSummaryLoading(false)
      const preselect = searchParams.get("id")
      if (preselect) setCustomerId(preselect)
    })
  }, [])

  useEffect(() => {
    if (customerId) loadLedger()
  }, [customerId])

  async function loadLedger() {
    if (!customerId) return
    setLoading(true)
    const params = new URLSearchParams()
    if (dateFrom) params.set("from", dateFrom)
    if (dateTo) params.set("to", dateTo)
    const data = await fetch(`/api/reports/customer-ledger/${customerId}?${params}`).then((r) => r.json())
    setLedger(data)
    setLoading(false)
  }

  function clearLedger() {
    setCustomerId("")
    setLedger(null)
    setDateFrom("")
    setDateTo("")
  }

  const dateLabel = dateFrom || dateTo
    ? `${dateFrom ? formatDate(dateFrom) : "Start"} â€” ${dateTo ? formatDate(dateTo) : "Today"}`
    : "All Time"

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").includes(search) ||
      (c.address || "").toLowerCase().includes(search.toLowerCase())
  )

  const selectedCustomer = customers.find((c) => c.id === customerId)
  const totalOutstanding = customers.filter((c) => c.balance > 0).reduce((s, c) => s + c.balance, 0)
  const totalCredit = customers.filter((c) => c.balance < 0).reduce((s, c) => s + Math.abs(c.balance), 0)

  async function printAll() {
    setPrintingAll(true)
    const date = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
    const ledgers = await Promise.all(
      filtered.map((c) => fetch(`/api/reports/customer-ledger/${c.id}`).then((r) => r.json()))
    )
    setPrintingAll(false)
    const sections = ledgers.map((data, idx) => {
      const c = filtered[idx]
      const bal = data.closingBalance || 0
      const balColor = bal > 0 ? "#b91c1c" : "#15803d"
      const balLabel = bal > 0 ? "Outstanding (Owes)" : bal < 0 ? "Overpaid (Credit)" : "Settled"
      const txRows = (data.entries || []).map((e: any, i: number) => `
        <tr style="${i%2===0?"background:#f9fdf9":""}">
          <td>${i+1}</td>
          <td style="white-space:nowrap">${new Date(e.date).toLocaleDateString("en-PK")}</td>
          <td><span style="font-size:8px;padding:1px 6px;border-radius:99px;background:${e.type==="PAYMENT"?"#dcfce7":"#fef3c7"};color:${e.type==="PAYMENT"?"#166534":"#92400e"};font-weight:700">${e.type==="PESTICIDE_SALE"?"PESTICIDE":e.type}</span></td>
          <td style="font-size:9px">${e.description}</td>
          <td style="text-align:right">${e.debit>0?"PKR "+e.debit.toLocaleString():"â€”"}</td>
          <td style="text-align:right;color:#15803d">${e.credit>0?"PKR "+e.credit.toLocaleString():"â€”"}</td>
          <td style="text-align:right;font-weight:600;color:${e.balance>0?"#b91c1c":"#15803d"}">PKR ${Math.abs(e.balance).toLocaleString()} ${e.balance>0?"Dr":e.balance<0?"Cr":""}</td>
        </tr>`).join("")
      return `<div style="margin-bottom:28px">
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px 14px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:13px;font-weight:800;color:#7c2d12">${c.name}</div>
            <div style="font-size:10px;color:#6b7280;margin-top:2px">${[c.phone,c.address].filter(Boolean).join(" Â· ")||"No contact info"}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:15px;font-weight:900;color:${balColor}">PKR ${Math.abs(bal).toLocaleString()}</div>
            <div style="font-size:9px;color:${balColor};font-weight:700">${balLabel}</div>
          </div>
        </div>
        ${(data.entries||[]).length>0?`<table>
          <thead><tr><th>#</th><th>Date</th><th>Type</th><th>Description</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th></tr></thead>
          <tbody>${txRows}</tbody>
          <tfoot><tr><td colspan="4"><strong>Closing â€” ${(data.entries||[]).length} entries</strong></td>
            <td style="text-align:right"><strong>PKR ${(data.totalDebit||0).toLocaleString()}</strong></td>
            <td style="text-align:right;color:#15803d"><strong>PKR ${(data.totalCredit||0).toLocaleString()}</strong></td>
            <td style="text-align:right;color:${balColor}"><strong>PKR ${Math.abs(bal).toLocaleString()} ${bal>0?"Dr":bal<0?"Cr":""}</strong></td>
          </tr></tfoot>
        </table>`:`<p style="text-align:center;color:#9ca3af;font-size:10px;padding:8px 0">No transactions</p>`}
      </div>`
    }).join('<div style="border-top:2px dashed #fed7aa;margin:20px 0"></div>')
    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>All Traders â€” Full Ledger</title>
<style>${reportCSS} body{max-width:960px;margin:0 auto}</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div><div class="doc-title">All Traders â€” Full Ledger</div><div class="doc-sub">${filtered.length} traders Â· ${date}</div></div>
  <div class="doc-meta"><div>Outstanding: PKR ${totalOutstanding.toLocaleString()}</div><div>Credit: PKR ${totalCredit.toLocaleString()}</div></div>
</div>
<div class="body-pad">${sections}</div>
<div class="sig-row" style="margin:0 20px 20px"><span>Generated: ${date}</span><span>${shop?.name||""}</span></div>
<script>window.onload=()=>{window.print()}<\/script></body></html>`)
    w.document.close()
  }

  return (
    <div className="space-y-5">
      <div className="hidden print:block mb-4">
        <div style={{background:"linear-gradient(135deg,#14532d 0%,#166534 60%,#15803d 100%)",color:"#fff",padding:"16px 22px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            {shop?.logo ? <img src={shop.logo} style={{width:"52px",height:"52px",borderRadius:"8px",background:"#fff",padding:"3px",objectFit:"contain"}} alt="" />
              : <div style={{width:"52px",height:"52px",borderRadius:"8px",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"26px",fontWeight:900}}>{(shop?.name||"G")[0].toUpperCase()}</div>}
            <div>
              <div style={{fontSize:"20px",fontWeight:900}}>{shop?.name||"Argo-Firn"}</div>
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
          <h2 style={{margin:0,fontSize:"16px",fontWeight:800,color:"#14532d"}}>Trader Ledger â€” {selectedCustomer?.name}</h2>
          <div style={{fontSize:"11px",color:"#6b7280",marginTop:"2px"}}>Period: {dateLabel}</div>
        </div>
      </div>

      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Trader Ledger</h2>
          <p className="text-gray-500 text-sm">{customers.length} traders Â· Outstanding: {formatCurrency(totalOutstanding)}</p>
        </div>
        <div className="flex gap-2">
          {ledger && <Button onClick={() => window.print()} variant="outline" className="gap-2"><Printer className="w-4 h-4" /> Print Ledger</Button>}
          <Button onClick={printAll} disabled={printingAll} variant="outline" className="gap-2"><Printer className="w-4 h-4" />{printingAll ? "Preparing..." : "Print All Ledgers"}</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 print:hidden">
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Total Traders</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{customers.length}</p>
        </CardContent></Card>
        <Card className="border-red-200 bg-red-50/40"><CardContent className="p-4">
          <p className="text-xs text-red-500 uppercase font-medium">Outstanding (Udhar)</p>
          <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(totalOutstanding)}</p>
        </CardContent></Card>
        <Card className="border-green-200 bg-green-50/40"><CardContent className="p-4">
          <p className="text-xs text-purple-600 uppercase font-medium">Overpaid / Credit</p>
          <p className="text-xl font-bold text-purple-700 mt-1">{formatCurrency(totalCredit)}</p>
        </CardContent></Card>
      </div>

      <Card className="print:hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search traders..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <p className="text-xs text-gray-400">{filtered.length} traders â€” click a row to view ledger</p>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-blue-50 border-b sticky top-0">
                <tr>
                  {["#","Name","Phone","Address","Total Dr","Total Cr","Balance","Status",""].map((h) => (
                    <th key={h} className={`px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase ${["Total Dr","Total Cr","Balance"].includes(h)?"text-right":"text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summaryLoading ? (
                  <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">Loading...</td></tr>
                ) : filtered.map((c, i) => {
                  const bal = c.balance || 0
                  const isSelected = c.id === customerId
                  return (
                    <tr key={c.id} onClick={() => setCustomerId(isSelected ? "" : c.id)}
                      className={`cursor-pointer transition-colors ${isSelected ? "bg-orange-50 border-l-4 border-orange-500" : "hover:bg-blue-50"}`}>
                      <td className="px-3 py-2 text-gray-400 text-xs">{i+1}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{c.name}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{c.phone||"â€”"}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{c.address||"â€”"}</td>
                      <td className="px-3 py-2 text-right text-gray-700 text-xs">{formatCurrency(c.totalDebit||0)}</td>
                      <td className="px-3 py-2 text-right text-purple-700 text-xs">{formatCurrency(c.totalCredit||0)}</td>
                      <td className={`px-3 py-2 text-right font-bold text-xs ${bal>0?"text-red-600":bal<0?"text-purple-700":"text-gray-400"}`}>
                        {formatCurrency(Math.abs(bal))}{bal!==0&&<span className="font-normal ml-0.5">{bal>0?"Dr":"Cr"}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bal>0?"bg-red-100 text-red-700":bal<0?"bg-green-100 text-purple-700":"bg-blue-100 text-gray-500"}`}>
                          {bal>0?"Outstanding":bal<0?"Overpaid":"Settled"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-orange-500"><ArrowRight className="w-3.5 h-3.5" /></td>
                    </tr>
                  )
                })}
                {!summaryLoading && filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400"><Users className="w-6 h-6 mx-auto mb-1 opacity-30" />No traders found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {customerId && (
        <>
          <Card className="print:hidden">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium">Trader</label>
                  <Select value={customerId} onValueChange={(v) => { setCustomerId(v); setLedger(null) }}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
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
                <Button onClick={loadLedger} disabled={loading} className="bg-white hover:bg-gray-100 text-gray-900 border border-gray-300">{loading ? "Loading..." : "Apply Filter"}</Button>
                <Button variant="outline" onClick={clearLedger} className="gap-1"><X className="w-4 h-4" /> Clear</Button>
              </div>
            </CardContent>
          </Card>

          {loading && <div className="text-center py-10 text-gray-400">Loading ledger...</div>}

          {ledger && !loading && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="md:col-span-2 bg-orange-50"><CardContent className="p-4">
                  <p className="text-xs text-gray-500 font-medium uppercase">Trader</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{ledger.customer?.name}</p>
                  {ledger.customer?.phone && <p className="text-sm text-gray-600">{ledger.customer.phone}</p>}
                  {ledger.customer?.address && <p className="text-xs text-gray-500">{ledger.customer.address}</p>}
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-gray-500 font-medium uppercase">Total Dr</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(ledger.totalDebit)}</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-gray-500 font-medium uppercase">Total Cr</p>
                  <p className="text-xl font-bold text-purple-700 mt-1">{formatCurrency(ledger.totalCredit)}</p>
                </CardContent></Card>
              </div>

              <div className={`rounded-lg px-5 py-4 flex items-center justify-between ${ledger.closingBalance > 0 ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
                <div>
                  <p className="text-sm font-medium text-gray-700">Closing Balance (Udhar)</p>
                  <p className="text-xs text-gray-500">{ledger.entries?.length || 0} transactions Â· {dateLabel}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Sales: {formatCurrency(ledger.totalDebit)} â€” Payments Received: {formatCurrency(ledger.totalCredit)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${ledger.closingBalance > 0 ? "text-red-700" : "text-purple-700"}`}>{formatCurrency(Math.abs(ledger.closingBalance))}</p>
                  <p className={`text-sm font-semibold ${ledger.closingBalance > 0 ? "text-red-600" : "text-purple-600"}`}>
                    {ledger.closingBalance > 0 ? `Outstanding (Udhar) â€” Trader Owes ${formatCurrency(ledger.closingBalance)}` : ledger.closingBalance < 0 ? `Overpaid (Credit) â€” We Owe ${formatCurrency(Math.abs(ledger.closingBalance))}` : "Settled â€” No Balance"}
                  </p>
                </div>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="w-4 h-4" /> {ledger.customer?.name} â€” Account Statement
                    <span className="text-gray-400 font-normal text-sm">({ledger.entries?.length || 0} entries)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-blue-50 border-b border-t">
                        <tr>
                          {["#","Date","Type","Description","Debit (Dr)","Credit (Cr)","Running Balance"].map((h) => (
                            <th key={h} className={`px-4 py-3 font-semibold text-gray-600 text-xs uppercase ${["Debit (Dr)","Credit (Cr)","Running Balance"].includes(h)?"text-right":"text-left"}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {ledger.entries?.map((entry: any, i: number) => (
                          <tr key={i} className={entry.type === "PAYMENT" ? "bg-green-50/40" : ""}>
                            <td className="px-4 py-3 text-gray-400 text-xs">{i+1}</td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(entry.date)}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${entry.type==="PAYMENT"?"bg-green-100 text-purple-700":entry.type==="PESTICIDE_SALE"?"bg-orange-100 text-orange-700":"bg-blue-100 text-blue-700"}`}>
                                {entry.type === "PESTICIDE_SALE" ? "PESTICIDE" : entry.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700 text-xs">{entry.description}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{entry.debit > 0 ? formatCurrency(entry.debit) : "â€”"}</td>
                            <td className="px-4 py-3 text-right text-purple-700">{entry.credit > 0 ? formatCurrency(entry.credit) : "â€”"}</td>
                            <td className={`px-4 py-3 text-right font-medium ${entry.balance > 0 ? "text-red-600" : "text-purple-700"}`}>
                              {formatCurrency(Math.abs(entry.balance))}
                              {entry.balance !== 0 && <span className="text-xs ml-1 font-normal">{entry.balance > 0 ? "Dr" : "Cr"}</span>}
                            </td>
                          </tr>
                        ))}
                        {ledger.entries?.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No transactions found</td></tr>}
                      </tbody>
                      <tfoot className="bg-blue-50 border-t-2 border-blue-300">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 font-bold text-gray-700">Closing Balance</td>
                          <td className="px-4 py-3 text-right font-bold">{formatCurrency((ledger.entries || []).reduce((s: number, e: any) => s + e.debit, 0))}</td>
                          <td className="px-4 py-3 text-right font-bold text-purple-700">{formatCurrency((ledger.entries || []).reduce((s: number, e: any) => s + e.credit, 0))}</td>
                          <td className={`px-4 py-3 text-right font-bold text-lg ${ledger.closingBalance > 0 ? "text-red-600" : "text-purple-700"}`}>
                            {formatCurrency(Math.abs(ledger.closingBalance))}
                            <span className="text-sm ml-1 font-normal">{ledger.closingBalance > 0 ? "Dr" : "Cr"}</span>
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
      <div className="mt-8 pt-4 border-t border-blue-300 text-center text-xs text-blue-600">
        Powered by Softtech
      </div>
    </div>
  )
}

