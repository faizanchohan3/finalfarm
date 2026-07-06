"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils"
import { buildPrintHeader, receiptCSS } from "@/lib/print-utils"
import { Plus, Search, Trash2, ShoppingCart, Eye, Printer, Sprout } from "lucide-react"

export default function SalesPage() {
  const { data: session } = useSession()
  const [sales, setSales] = useState<any[]>([])
  const [pesticideSales, setPesticideSales] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [shop, setShop] = useState<any>(null)
  const [pesticides, setPesticides] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [farmers, setFarmers] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"products" | "pesticides">("products")
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showPesticideSaleModal, setShowPesticideSaleModal] = useState(false)
  const [showPesticideDetailModal, setShowPesticideDetailModal] = useState(false)
  const [selectedSale, setSelectedSale] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedPesticideSaleDetail, setSelectedPesticideSaleDetail] = useState<any>(null)
  const [customerId, setCustomerId] = useState("")
  const [paidAmount, setPaidAmount] = useState("0")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState([{ productId: "", quantity: "1", price: "0" }])
  const [pesticideSaleForm, setPesticideSaleForm] = useState({ pesticideId: "", quantity: "1", customerId: "", customerName: "", paidAmount: "0" })
  const [isPreviousRecord, setIsPreviousRecord] = useState(false)
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0])
  const [isPreviousRecordPesticide, setIsPreviousRecordPesticide] = useState(false)
  const [pesticideSaleDate, setPesticideSaleDate] = useState(new Date().toISOString().split('T')[0])

  async function loadData() {
    setLoading(true)
    try {
      const [sr, pr, cr, psr, pestr, fr, shr] = await Promise.allSettled([
        fetch("/api/sales").then((r) => r.json()),
        fetch("/api/inventory").then((r) => r.json()),
        fetch("/api/customers").then((r) => r.json()),
        fetch("/api/pesticides/sales").then((r) => r.json()),
        fetch("/api/pesticides").then((r) => r.json()),
        fetch("/api/farmers").then((r) => r.json()),
        fetch("/api/settings").then((r) => r.json()),
      ])
      const loadedSales = sr.status === "fulfilled" ? (sr.value.sales || []) : []
      const loadedPesticideSales = psr.status === "fulfilled" ? (psr.value.sales || []) : []
      if (sr.status === "fulfilled") setSales(loadedSales)
      if (pr.status === "fulfilled") setProducts(pr.value.products || [])
      if (cr.status === "fulfilled") setCustomers(cr.value.customers || [])
      if (psr.status === "fulfilled") setPesticideSales(loadedPesticideSales)
      if (pestr.status === "fulfilled") setPesticides(pestr.value.pesticides || [])
      if (fr.status === "fulfilled") setFarmers(fr.value.farmers || [])
      if (shr.status === "fulfilled") setShop(shr.value.shop || null)
      return { sales: loadedSales, pesticideSales: loadedPesticideSales }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  function addItem() {
    setItems([...items, { productId: "", quantity: "1", price: "0" }])
  }

  function removeItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i))
  }

  function updateItem(i: number, field: string, val: string) {
    const updated = [...items]
    updated[i] = { ...updated[i], [field]: val }
    if (field === "productId") {
      const prod = products.find((p) => p.id === val)
      if (prod) updated[i].price = String(prod.salePrice)
    }
    setItems(updated)
  }

  const total = items.reduce((s, i) => s + parseFloat(i.quantity || "0") * parseFloat(i.price || "0"), 0)
  const balance = total - parseFloat(paidAmount || "0")

  async function handleSave() {
    if (!items[0].productId) return alert("Please add at least one item")
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: (customerId && customerId !== "walk-in" && !customerId.startsWith("farmer_")) ? customerId : null,
        farmerId: customerId?.startsWith("farmer_") ? customerId.replace("farmer_", "") : null,
        items: items.filter((i) => i.productId).map((i) => ({
          productId: i.productId,
          quantity: parseFloat(i.quantity),
          price: parseFloat(i.price),
        })),
        paidAmount: parseFloat(paidAmount),
        notes,
        saleDate: isPreviousRecord ? saleDate : undefined,
      }),
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      const newSaleId = data.sale?.id
      setShowModal(false)
      setItems([{ productId: "", quantity: "1", price: "0" }])
      setCustomerId(""); setPaidAmount("0"); setNotes("")
      setIsPreviousRecord(false); setSaleDate(new Date().toISOString().split('T')[0])
      const loaded = await loadData()
      if (newSaleId && loaded?.sales) {
        const newSale = loaded.sales.find((s: any) => s.id === newSaleId)
        if (newSale) { setSelectedSale(newSale); setShowDetailModal(true) }
      }
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data?.error || "Failed to create sale")
    }
  }

  const selectedPesticide = pesticides.find((p) => p.id === pesticideSaleForm.pesticideId)
  const pesticideSaleTotal = parseFloat(pesticideSaleForm.quantity || "0") * (selectedPesticide?.salePrice || 0)

  async function handlePesticideSale() {
    if (!pesticideSaleForm.pesticideId) return alert("Please select a pesticide")
    if (!selectedPesticide) return alert("Selected pesticide not found. Please refresh and try again.")
    const qty = parseFloat(pesticideSaleForm.quantity)
    if (!qty || qty <= 0) return alert("Please enter a valid quantity")
    if (qty > selectedPesticide.quantity) return alert(`Insufficient stock. Available: ${selectedPesticide.quantity} ${selectedPesticide.unit}`)
    const isFarmerSelected = pesticideSaleForm.customerId?.startsWith("farmer_")
    const realCustomerId = isFarmerSelected ? null : (pesticideSaleForm.customerId || null)
    const chosenCustomer = customers.find((c: any) => c.id === realCustomerId)
    const chosenFarmer = isFarmerSelected ? farmers.find((f: any) => `farmer_${f.id}` === pesticideSaleForm.customerId) : null
    const customerName = chosenCustomer ? chosenCustomer.name : (chosenFarmer ? chosenFarmer.name : pesticideSaleForm.customerName)
    try {
      const res = await fetch("/api/pesticides/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pesticideId: pesticideSaleForm.pesticideId,
          quantity: qty,
          unitPrice: selectedPesticide.salePrice,
          customerId: realCustomerId,
          farmerId: chosenFarmer ? chosenFarmer.id : null,
          customerName,
          paidAmount: parseFloat(pesticideSaleForm.paidAmount) || 0,
        }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        const newSaleId = data.sale?.id
        setShowPesticideSaleModal(false)
        setPesticideSaleForm({ pesticideId: "", quantity: "1", customerId: "", customerName: "", paidAmount: "0" })
        const loaded = await loadData()
        if (newSaleId && loaded?.pesticideSales) {
          const newSale = loaded.pesticideSales.find((s: any) => s.id === newSaleId)
          if (newSale) { setSelectedPesticideSaleDetail(newSale); setShowPesticideDetailModal(true) }
        }
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data?.error || "Failed to create pesticide sale")
      }
    } catch (err) {
      alert("Network error. Please try again.")
    }
  }

  function openDetail(sale: any) {
    setSelectedSale(sale)
    setShowDetailModal(true)
  }

  async function confirmDeleteSale() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch(`/api/sales/${deleteTarget.id}`, { method: "DELETE" })
    setDeleting(false)
    if (!res.ok) { alert("Failed to delete sale"); return }
    setDeleteTarget(null)
    loadData()
  }

  function handlePrint() {
    window.print()
  }

  function printProductSale(s: any) {
    const buyer = s.customer?.name || s.farmer?.name || "Walk-in"
    const phone = s.customer?.phone || s.farmer?.phone || ""
    const ref = s.id.slice(-8).toUpperCase()
    const date = new Date(s.createdAt).toLocaleDateString("en-PK")
    const bal = s.balance ?? (s.totalAmount - s.paidAmount)
    const statusCls = bal <= 0 ? "PAID" : s.paidAmount > 0 ? "PARTIAL" : "PENDING"
    const rows = (s.items || []).map((item: any, i: number) =>
      `<tr style="background:${i%2===0?"#f9fafb":"#fff"}">
        <td>${i+1}</td>
        <td>${item.product?.name || "—"}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:center">${item.product?.unit || ""}</td>
        <td style="text-align:right">PKR ${(item.price || 0).toLocaleString()}</td>
        <td style="text-align:right">PKR ${(item.total || 0).toLocaleString()}</td>
      </tr>`
    ).join("")
    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>Sale Invoice — ${ref}</title>
<style>${receiptCSS}</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div>
    <div class="doc-title">Sales Invoice</div>
    <div class="doc-sub">Invoice #: ${ref} &nbsp;|&nbsp; By: ${s.createdBy?.name || "—"}</div>
  </div>
  <div class="doc-meta"><div>${date}</div><span class="badge badge-${statusCls}">${statusCls}</span></div>
</div>
<div class="body-pad">
  <div class="info-grid">
    <div><div class="lbl">Bill To</div><div class="val">${buyer}</div>${phone ? `<div style="color:#6b7280;font-size:10px;margin-top:2px">${phone}</div>` : ""}</div>
    <div><div class="lbl">Type</div><div class="val">${s.farmer ? "Farmer" : s.customer ? "Trader" : "Walk-in"}</div></div>
    <div><div class="lbl">Date</div><div class="val">${date}</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Product</th><th style="text-align:center">Qty</th><th style="text-align:center">Unit</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals-box">
    <table>
      <tbody>
        <tr><td>Sub Total</td><td style="text-align:right">PKR ${(s.totalAmount || 0).toLocaleString()}</td></tr>
        <tr><td>Paid</td><td style="text-align:right;color:#15803d">PKR ${(s.paidAmount || 0).toLocaleString()}</td></tr>
      </tbody>
      <tfoot><tr class="grand"><td>Balance Due</td><td style="text-align:right;color:${bal > 0 ? "#b91c1c" : "#15803d"}">PKR ${bal.toLocaleString()}</td></tr></tfoot>
    </table>
  </div>
  ${s.notes ? `<p style="font-size:11px;color:#555;margin-top:12px"><strong>Notes:</strong> ${s.notes}</p>` : ""}
  <div class="sig-row">
    <span>Customer Signature: _______________________</span>
    <span>Authorized By: _______________________</span>
  </div>
</div>
</body></html>`)
    w.document.close()
    w.print()
  }

  function printPesticideSale(s: any) {
    const buyer = s.customer?.name || s.farmer?.name || s.customerName || "Walk-in"
    const phone = s.customer?.phone || s.farmer?.phone || ""
    const ref = s.id.slice(-6).toUpperCase()
    const date = new Date(s.createdAt).toLocaleDateString("en-PK")
    const bal = s.balance ?? (s.totalAmount - s.paidAmount)
    const statusCls = bal <= 0 ? "PAID" : s.paidAmount > 0 ? "PARTIAL" : "PENDING"
    const w = window.open("", "_blank")!
    w.document.write(`<html><head><title>Pesticide Sale — ${ref}</title>
<style>${receiptCSS}</style></head><body>
${buildPrintHeader(shop)}
<div class="doc-header">
  <div>
    <div class="doc-title">Pesticide Sale Receipt</div>
    <div class="doc-sub">Ref: #${ref} &nbsp;|&nbsp; By: ${s.soldBy?.name || "—"}</div>
  </div>
  <div class="doc-meta"><div>${date}</div><span class="badge badge-${statusCls}">${statusCls}</span></div>
</div>
<div class="body-pad">
  <div class="info-grid">
    <div><div class="lbl">Bill To</div><div class="val">${buyer}</div>${phone ? `<div style="color:#6b7280;font-size:10px;margin-top:2px">${phone}</div>` : ""}</div>
    <div><div class="lbl">Type</div><div class="val">${s.farmer ? "Farmer" : s.customer ? "Customer" : "Walk-in"}</div></div>
    <div><div class="lbl">Date</div><div class="val">${date}</div></div>
  </div>
  <table>
    <thead><tr><th>Pesticide</th><th style="text-align:center">Qty</th><th style="text-align:center">Unit</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>
      <tr>
        <td>${s.pesticide?.name || "—"}</td>
        <td style="text-align:center">${s.quantity}</td>
        <td style="text-align:center">${s.pesticide?.unit || ""}</td>
        <td style="text-align:right">PKR ${(s.unitPrice || 0).toLocaleString()}</td>
        <td style="text-align:right">PKR ${(s.totalAmount || 0).toLocaleString()}</td>
      </tr>
    </tbody>
  </table>
  <div class="totals-box">
    <table>
      <tbody>
        <tr><td>Sub Total</td><td style="text-align:right">PKR ${(s.totalAmount || 0).toLocaleString()}</td></tr>
        <tr><td>Paid</td><td style="text-align:right;color:#15803d">PKR ${(s.paidAmount || 0).toLocaleString()}</td></tr>
      </tbody>
      <tfoot><tr class="grand"><td>Balance Due</td><td style="text-align:right;color:${bal > 0 ? "#b91c1c" : "#15803d"}">PKR ${bal.toLocaleString()}</td></tr></tfoot>
    </table>
  </div>
  ${s.notes ? `<p style="font-size:11px;color:#555;margin-top:12px"><strong>Notes:</strong> ${s.notes}</p>` : ""}
  <div class="sig-row">
    <span>Customer Signature: _______________________</span>
    <span>Authorized By: _______________________</span>
  </div>
</div>
</body></html>`)
    w.print()
  }

  const filtered = sales.filter((s) =>
    (s.customer?.name || s.farmer?.name || "")?.toLowerCase().includes(search.toLowerCase()) ||
    s.status.toLowerCase().includes(search.toLowerCase())
  )

  const filteredPesticideSales = pesticideSales.filter((s) =>
    s.pesticide?.name?.toLowerCase().includes(search.toLowerCase()) ||
    (s.customerName || "").toLowerCase().includes(search.toLowerCase())
  )

  const todayTotal = sales
    .filter((s) => new Date(s.createdAt).toDateString() === new Date().toDateString() && s.status !== "CANCELLED")
    .reduce((sum, s) => sum + s.totalAmount, 0)

  const shopName = (session?.user as any)?.shopName || "Gala Mandi"

  return (
    <>
      {/* ── Pesticide Sale Print Invoice (branded format) ── */}
      {selectedPesticideSaleDetail && (
        <div className="hidden print:block fixed inset-0 bg-white z-50">
          <style>{`@media print { @page { size: A4 portrait; margin: 0; } }`}</style>
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
              <div style={{fontSize:"10px",opacity:0.75}}>Printed: {new Date().toLocaleDateString("en-PK")}</div>
            </div>
          </div>
          <div style={{height:"4px",background:"linear-gradient(90deg,#fbbf24 0%,#f59e0b 50%,#d97706 100%)"}}></div>
          <div style={{padding:"10px 22px",background:"#f8fdf8",borderBottom:"1px solid #e5e7eb",display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:"16px",fontWeight:800,color:"#14532d"}}>Pesticide Sale Invoice</div>
              <div style={{fontSize:"11px",color:"#6b7280",marginTop:"2px"}}>Invoice #: {selectedPesticideSaleDetail.id.slice(-8).toUpperCase()}</div>
            </div>
            <div style={{textAlign:"right",fontSize:"11px",color:"#6b7280",lineHeight:1.8}}>
              <div>Date: {formatDate(selectedPesticideSaleDetail.createdAt)}</div>
              <div>By: {selectedPesticideSaleDetail.soldBy?.name}</div>
            </div>
          </div>
          <div style={{padding:"16px 22px"}}>
            <div style={{marginBottom:"14px"}}>
              <div style={{fontSize:"10px",fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>Bill To</div>
              <div style={{fontWeight:700,fontSize:"14px",color:"#111827"}}>{selectedPesticideSaleDetail.customer?.name || selectedPesticideSaleDetail.farmer?.name || selectedPesticideSaleDetail.customerName || "Walk-in Customer"}</div>
              {(selectedPesticideSaleDetail.customer?.phone || selectedPesticideSaleDetail.farmer?.phone) && <div style={{fontSize:"11px",color:"#6b7280",marginTop:"2px"}}>Ph: {selectedPesticideSaleDetail.customer?.phone || selectedPesticideSaleDetail.farmer?.phone}</div>}
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px",marginBottom:"14px"}}>
              <thead>
                <tr style={{background:"#14532d",color:"#fff"}}>
                  <th style={{padding:"7px 10px",textAlign:"left",fontWeight:700}}>#</th>
                  <th style={{padding:"7px 10px",textAlign:"left",fontWeight:700}}>Pesticide</th>
                  <th style={{padding:"7px 10px",textAlign:"center",fontWeight:700}}>Qty</th>
                  <th style={{padding:"7px 10px",textAlign:"center",fontWeight:700}}>Unit</th>
                  <th style={{padding:"7px 10px",textAlign:"right",fontWeight:700}}>Unit Price</th>
                  <th style={{padding:"7px 10px",textAlign:"right",fontWeight:700}}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{background:"#f9fafb",borderBottom:"1px solid #e5e7eb"}}>
                  <td style={{padding:"6px 10px",color:"#9ca3af"}}>1</td>
                  <td style={{padding:"6px 10px",fontWeight:600,color:"#111827"}}>{selectedPesticideSaleDetail.pesticide?.name}</td>
                  <td style={{padding:"6px 10px",textAlign:"center"}}>{selectedPesticideSaleDetail.quantity}</td>
                  <td style={{padding:"6px 10px",textAlign:"center",color:"#6b7280"}}>{selectedPesticideSaleDetail.pesticide?.unit}</td>
                  <td style={{padding:"6px 10px",textAlign:"right"}}>PKR {(selectedPesticideSaleDetail.unitPrice||0).toLocaleString()}</td>
                  <td style={{padding:"6px 10px",textAlign:"right",fontWeight:700}}>PKR {(selectedPesticideSaleDetail.totalAmount||0).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"16px"}}>
              <div style={{width:"230px"}}>
                <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:"12px",borderBottom:"1px solid #e5e7eb"}}>
                  <span style={{color:"#6b7280"}}>Sub Total</span>
                  <span style={{fontWeight:600}}>PKR {(selectedPesticideSaleDetail.totalAmount||0).toLocaleString()}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:"12px",color:"#15803d"}}>
                  <span>Amount Paid</span>
                  <span style={{fontWeight:600}}>PKR {(selectedPesticideSaleDetail.paidAmount||0).toLocaleString()}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:"13px",fontWeight:700,borderTop:"2px solid #e5e7eb",marginTop:"4px",color:(selectedPesticideSaleDetail.balance??0)>0?"#b91c1c":"#15803d"}}>
                  <span>Balance Due</span>
                  <span>PKR {Math.abs(selectedPesticideSaleDetail.balance??0).toLocaleString()}</span>
                </div>
              </div>
            </div>
            {selectedPesticideSaleDetail.notes && <p style={{fontSize:"11px",color:"#555",marginBottom:"12px"}}><strong>Notes:</strong> {selectedPesticideSaleDetail.notes}</p>}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:"24px",paddingTop:"14px",borderTop:"1px solid #e5e7eb",fontSize:"11px",color:"#6b7280"}}>
              <span>Customer Signature: _______________________</span>
              <span>Authorized By: _______________________</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Product Sale Print Invoice (branded format) ── */}
      {selectedSale && (
        <div className="hidden print:block fixed inset-0 bg-white z-50">
          <style>{`@media print { @page { size: A4 portrait; margin: 0; } }`}</style>
          {/* Green gradient header */}
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
              <div style={{fontSize:"10px",opacity:0.75}}>Printed: {new Date().toLocaleDateString("en-PK")}</div>
            </div>
          </div>
          {/* Gold stripe */}
          <div style={{height:"4px",background:"linear-gradient(90deg,#fbbf24 0%,#f59e0b 50%,#d97706 100%)"}}></div>
          {/* Document sub-header */}
          <div style={{padding:"10px 22px",background:"#f8fdf8",borderBottom:"1px solid #e5e7eb",display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:"16px",fontWeight:800,color:"#14532d"}}>Sales Invoice</div>
              <div style={{fontSize:"11px",color:"#6b7280",marginTop:"2px"}}>Invoice #: {selectedSale.id.slice(-8).toUpperCase()}</div>
            </div>
            <div style={{textAlign:"right",fontSize:"11px",color:"#6b7280",lineHeight:1.8}}>
              <div>Date: {formatDate(selectedSale.createdAt)}</div>
              <div>Time: {new Date(selectedSale.createdAt).toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit"})}</div>
              <div>By: {selectedSale.createdBy?.name}</div>
              <span style={{background: selectedSale.status==="PAID"?"#dcfce7":selectedSale.status==="PARTIAL"?"#fed7aa":"#fef9c3",color:selectedSale.status==="PAID"?"#166534":selectedSale.status==="PARTIAL"?"#c2410c":"#854d0e",padding:"1px 8px",borderRadius:"12px",fontSize:"10px",fontWeight:700}}>{selectedSale.status}</span>
            </div>
          </div>
          {/* Body */}
          <div style={{padding:"16px 22px"}}>
            {/* Bill To */}
            <div style={{marginBottom:"14px"}}>
              <div style={{fontSize:"10px",fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>Bill To</div>
              <div style={{fontWeight:700,fontSize:"14px",color:"#111827"}}>{selectedSale.customer?.name || selectedSale.farmer?.name || "Walk-in Customer"}</div>
              {(selectedSale.customer?.phone || selectedSale.farmer?.phone) && <div style={{fontSize:"11px",color:"#6b7280",marginTop:"2px"}}>Ph: {selectedSale.customer?.phone || selectedSale.farmer?.phone}</div>}
              {selectedSale.customer?.address && <div style={{fontSize:"11px",color:"#6b7280"}}>{selectedSale.customer.address}</div>}
              <div style={{fontSize:"10px",color:"#9ca3af",marginTop:"2px"}}>{selectedSale.farmer ? "Farmer" : selectedSale.customer ? "Trader" : "Walk-in"}</div>
            </div>
            {/* Items table */}
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px",marginBottom:"14px"}}>
              <thead>
                <tr style={{background:"#14532d",color:"#fff"}}>
                  <th style={{padding:"7px 10px",textAlign:"left",fontWeight:700}}>#</th>
                  <th style={{padding:"7px 10px",textAlign:"left",fontWeight:700}}>Product</th>
                  <th style={{padding:"7px 10px",textAlign:"center",fontWeight:700}}>Qty</th>
                  <th style={{padding:"7px 10px",textAlign:"center",fontWeight:700}}>Unit</th>
                  <th style={{padding:"7px 10px",textAlign:"right",fontWeight:700}}>Unit Price</th>
                  <th style={{padding:"7px 10px",textAlign:"right",fontWeight:700}}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {selectedSale.items?.map((item: any, i: number) => (
                  <tr key={item.id} style={{background: i%2===0?"#f9fafb":"#fff",borderBottom:"1px solid #e5e7eb"}}>
                    <td style={{padding:"6px 10px",color:"#9ca3af"}}>{i+1}</td>
                    <td style={{padding:"6px 10px",fontWeight:600,color:"#111827"}}>{item.product?.name}</td>
                    <td style={{padding:"6px 10px",textAlign:"center"}}>{item.quantity}</td>
                    <td style={{padding:"6px 10px",textAlign:"center",color:"#6b7280"}}>{item.product?.unit||"KG"}</td>
                    <td style={{padding:"6px 10px",textAlign:"right"}}>PKR {(item.price||0).toLocaleString()}</td>
                    <td style={{padding:"6px 10px",textAlign:"right",fontWeight:700}}>PKR {(item.total||0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Totals */}
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"16px"}}>
              <div style={{width:"230px"}}>
                <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:"12px",borderBottom:"1px solid #e5e7eb"}}>
                  <span style={{color:"#6b7280"}}>Sub Total</span>
                  <span style={{fontWeight:600}}>PKR {(selectedSale.totalAmount||0).toLocaleString()}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:"12px",color:"#15803d"}}>
                  <span>Amount Paid</span>
                  <span style={{fontWeight:600}}>PKR {(selectedSale.paidAmount||0).toLocaleString()}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:"13px",fontWeight:700,borderTop:"2px solid #e5e7eb",marginTop:"4px",color:selectedSale.balance>0?"#b91c1c":"#15803d"}}>
                  <span>Balance Due</span>
                  <span>PKR {Math.abs(selectedSale.balance||0).toLocaleString()}</span>
                </div>
              </div>
            </div>
            {selectedSale.notes && <p style={{fontSize:"11px",color:"#555",marginBottom:"12px"}}><strong>Notes:</strong> {selectedSale.notes}</p>}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:"24px",paddingTop:"14px",borderTop:"1px solid #e5e7eb",fontSize:"11px",color:"#6b7280"}}>
              <span>Customer Signature: _______________________</span>
              <span>Authorized By: _______________________</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Page (hidden on print) ── */}
      <div className="space-y-6 print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Sales</h2>
            <p className="text-gray-500 text-sm">Today: {formatCurrency(todayTotal)}</p>
          </div>
          <div className="flex gap-2">
            {activeTab === "products" ? (
              <Button onClick={() => setShowModal(true)}>
                <Plus className="w-4 h-4" /> New Sale
              </Button>
            ) : (
              <Button onClick={() => { setPesticideSaleForm({ pesticideId: "", quantity: "1", customerId: "", customerName: "", paidAmount: "0" }); setShowPesticideSaleModal(true) }} className="gap-2">
                <Plus className="w-4 h-4" /> New Pesticide Sale
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("products")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "products" ? "border-green-700 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <ShoppingCart className="w-4 h-4" /> Product Sales
          </button>
          <button
            onClick={() => setActiveTab("pesticides")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "pesticides" ? "border-green-700 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <Sprout className="w-4 h-4" /> Pesticide Sales
          </button>
        </div>

        {/* Product Sales Table */}
        {activeTab === "products" && (
          <Card>
            <CardHeader>
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Search sales..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            </CardHeader>
            <CardContent>
              {loading && !sales.length ? (
                <div className="text-center py-8 text-gray-400">Loading...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {["#", "Customer", "Total", "Paid", "Balance", "Status", "Date", "By", ""].map((h) => (
                          <th key={h} className="text-left py-3 px-3 text-gray-500 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s, i) => (
                        <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-3 px-3 text-gray-400 text-xs">{i + 1}</td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-gray-800">
                              {s.customer?.name || s.farmer?.name || "Walk-in"}
                            </div>
                            {(s.customer || s.farmer) && (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${s.farmer ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                                  {s.farmer ? "Farmer" : "Customer"}
                                </span>
                                {(s.customer?.phone || s.farmer?.phone) && (
                                  <span className="text-xs text-gray-400">{s.customer?.phone || s.farmer?.phone}</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-gray-700">{formatCurrency(s.totalAmount)}</td>
                          <td className="py-3 px-3 text-green-600">{formatCurrency(s.paidAmount)}</td>
                          <td className="py-3 px-3 text-red-600">{formatCurrency(s.balance)}</td>
                          <td className="py-3 px-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(s.status)}`}>{s.status}</span>
                          </td>
                          <td className="py-3 px-3 text-gray-500">{formatDate(s.createdAt)}</td>
                          <td className="py-3 px-3 text-gray-500">{s.createdBy?.name}</td>
                          <td className="py-3 px-3">
                            <div className="flex gap-1">
                              <button
                                onClick={() => openDetail(s)}
                                className="p-1.5 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => printProductSale(s)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Print Invoice"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(s)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete Sale"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={9} className="text-center py-8 text-gray-400">No sales found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pesticide Sales Table */}
        {activeTab === "pesticides" && (
          <Card>
            <CardHeader>
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Search pesticide sales..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            </CardHeader>
            <CardContent>
              {loading && !pesticideSales.length ? (
                <div className="text-center py-8 text-gray-400">Loading...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {["#", "Pesticide", "Qty", "Unit Price", "Total", "Customer", "Paid", "Balance", "Date", "By", ""].map((h) => (
                          <th key={h} className="text-left py-3 px-3 text-gray-500 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPesticideSales.map((s, i) => {
                        const bal = s.balance ?? (s.totalAmount - s.paidAmount)
                        const displayName = s.customer?.name || s.customerName
                        return (
                          <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-3 px-3 text-gray-400 text-xs">{i + 1}</td>
                            <td className="py-3 px-3 font-medium text-gray-800">{s.pesticide?.name}</td>
                            <td className="py-3 px-3 text-gray-700">{s.quantity} {s.pesticide?.unit}</td>
                            <td className="py-3 px-3 text-gray-700">{formatCurrency(s.unitPrice)}</td>
                            <td className="py-3 px-3 font-semibold text-gray-900">{formatCurrency(s.totalAmount)}</td>
                            <td className="py-3 px-3">
                              {displayName ? (
                                <span className="text-gray-800">{displayName}</span>
                              ) : (
                                <span className="text-gray-400 text-xs">Walk-in</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-green-600">{formatCurrency(s.paidAmount)}</td>
                            <td className="py-3 px-3 text-red-600">{formatCurrency(bal)}</td>
                            <td className="py-3 px-3 text-gray-500">{formatDate(s.createdAt)}</td>
                            <td className="py-3 px-3 text-gray-500">{s.soldBy?.name}</td>
                            <td className="py-3 px-3">
                              <div className="flex gap-1">
                                <button
                                  onClick={() => { setSelectedPesticideSaleDetail(s); setShowPesticideDetailModal(true) }}
                                  className="p-1.5 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                                  title="View Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => printPesticideSale(s)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Print Invoice"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {filteredPesticideSales.length === 0 && (
                        <tr><td colSpan={11} className="text-center py-8 text-gray-400">No pesticide sales found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* New Product Sale Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" /> New Sale
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Previous Record Toggle */}
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <input
                  type="checkbox"
                  checked={isPreviousRecord}
                  onChange={(e) => setIsPreviousRecord(e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                  id="isPreviousRecord"
                />
                <label htmlFor="isPreviousRecord" className="text-sm font-medium text-blue-900 cursor-pointer">
                  Previous Record? (Backdated Entry)
                </label>
              </div>

              {/* Date Picker (Only shows if Previous Record is checked) */}
              {isPreviousRecord && (
                <div>
                  <Label>Sale Date *</Label>
                  <Input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}

              <div>
                <Label>Customer (optional)</Label>
                <SearchableSelect
                  value={customerId}
                  onValueChange={setCustomerId}
                  placeholder="Walk-in customer"
                  options={[{ value: "walk-in", label: "Walk-in" }]}
                  groups={[
                    {
                      label: "Customers",
                      options: customers.map((c: any) => ({ value: c.id, label: c.name, sub: c.phone || undefined })),
                    },
                    {
                      label: "Farmers",
                      options: farmers.map((f: any) => ({ value: `farmer_${f.id}`, label: f.name, sub: f.phone || undefined })),
                    },
                  ]}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Items</Label>
                  <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-3 h-3" /> Add Row</Button>
                </div>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <SearchableSelect
                          value={item.productId}
                          onValueChange={(v) => updateItem(i, "productId", v)}
                          placeholder="Select product"
                          options={products.map((p: any) => ({
                            value: p.id,
                            label: p.name,
                            sub: p.currentStock <= 0 ? "Out of Stock" : `${p.currentStock} ${p.unit}`,
                          }))}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} />
                      </div>
                      <div className="col-span-3">
                        <Input type="number" placeholder="Price" value={item.price} onChange={(e) => updateItem(i, "price", e.target.value)} />
                      </div>
                      <div className="col-span-1 text-xs text-gray-500 text-right">
                        {formatCurrency(parseFloat(item.quantity || "0") * parseFloat(item.price || "0"))}
                      </div>
                      <div className="col-span-1">
                        <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Amount:</span>
                  <span className="font-bold text-gray-900">{formatCurrency(total)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="whitespace-nowrap">Amount Paid:</Label>
                  <Input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="max-w-[150px]" />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Balance:</span>
                  <span className={`font-bold ${balance > 0 ? "text-red-600" : "text-green-600"}`}>{formatCurrency(balance)}</span>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleSave} className="flex-1">Create Sale</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* New Pesticide Sale Modal */}
        <Dialog open={showPesticideSaleModal} onOpenChange={setShowPesticideSaleModal}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sprout className="w-5 h-5 text-green-600" /> New Pesticide Sale
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Pesticide</Label>
                <Select value={pesticideSaleForm.pesticideId} onValueChange={(v) => setPesticideSaleForm({ ...pesticideSaleForm, pesticideId: v, quantity: "1" })}>
                  <SelectTrigger><SelectValue placeholder="Select pesticide" /></SelectTrigger>
                  <SelectContent>
                    {pesticides.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — {p.quantity} {p.unit} available</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedPesticide && (
                <div className="bg-green-50 rounded-lg p-3 text-sm space-y-0.5">
                  <p className="text-gray-600">Sale Price: <strong className="text-gray-900">{formatCurrency(selectedPesticide.salePrice)} / {selectedPesticide.unit}</strong></p>
                  <p className="text-gray-600">In Stock: <strong className="text-gray-900">{selectedPesticide.quantity} {selectedPesticide.unit}</strong></p>
                </div>
              )}
              <div>
                <Label>Quantity</Label>
                <Input type="number" value={pesticideSaleForm.quantity} onChange={(e) => setPesticideSaleForm({ ...pesticideSaleForm, quantity: e.target.value })} />
              </div>
              {selectedPesticide && (
                <div className="flex justify-between items-center bg-gray-50 rounded px-3 py-2">
                  <span className="text-sm text-gray-600">Total Amount:</span>
                  <span className="text-lg font-bold text-green-700">{formatCurrency(pesticideSaleTotal)}</span>
                </div>
              )}
              <div>
                <Label>Customer (optional)</Label>
                <SearchableSelect
                  value={pesticideSaleForm.customerId || "walk-in"}
                  onValueChange={(v) => setPesticideSaleForm({ ...pesticideSaleForm, customerId: v === "walk-in" ? "" : v, customerName: "" })}
                  placeholder="Walk-in / select customer"
                  options={[{ value: "walk-in", label: "Walk-in" }]}
                  groups={[
                    {
                      label: "Customers",
                      options: customers.map((c: any) => ({ value: c.id, label: c.name, sub: c.phone || undefined })),
                    },
                    {
                      label: "Farmers",
                      options: farmers.map((f: any) => ({ value: `farmer_${f.id}`, label: f.name, sub: f.phone || undefined })),
                    },
                  ]}
                />
              </div>
              {!pesticideSaleForm.customerId && (
                <div>
                  <Label>Walk-in Name (optional)</Label>
                  <Input placeholder="Enter customer name" value={pesticideSaleForm.customerName} onChange={(e) => setPesticideSaleForm({ ...pesticideSaleForm, customerName: e.target.value })} />
                </div>
              )}
              <div>
                <Label>Amount Paid</Label>
                <Input type="number" value={pesticideSaleForm.paidAmount} onChange={(e) => setPesticideSaleForm({ ...pesticideSaleForm, paidAmount: e.target.value })} />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowPesticideSaleModal(false)} className="flex-1">Cancel</Button>
                <Button onClick={handlePesticideSale} className="flex-1">Sell</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Sale Detail Modal */}
        {selectedSale && (
          <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-green-600" />
                    Sale Details
                    <span className="text-sm font-normal text-gray-400">#{selectedSale.id.slice(-8).toUpperCase()}</span>
                  </DialogTitle>
                  <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2 mr-6">
                    <Printer className="w-4 h-4" /> Print Invoice
                  </Button>
                </div>
              </DialogHeader>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 font-medium uppercase mb-1">Customer</p>
                    <p className="font-bold text-gray-900">{selectedSale.customer?.name || selectedSale.farmer?.name || "Walk-in"}</p>
                    {selectedSale.customer?.phone && (
                      <p className="text-sm text-gray-600">{selectedSale.customer.phone}</p>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 font-medium uppercase mb-1">Sale Info</p>
                    <p className="text-sm text-gray-700">Date: <span className="font-medium">{formatDate(selectedSale.createdAt)}</span></p>
                    <p className="text-sm text-gray-700">By: <span className="font-medium">{selectedSale.createdBy?.name}</span></p>
                    <p className="text-sm text-gray-700">Status:
                      <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${getStatusColor(selectedSale.status)}`}>
                        {selectedSale.status}
                      </span>
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Items</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">#</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Product</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Qty</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Unit</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Unit Price</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedSale.items?.map((item: any, i: number) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                            <td className="px-3 py-2.5 font-medium text-gray-900">{item.product?.name}</td>
                            <td className="px-3 py-2.5 text-center text-gray-700">{item.quantity}</td>
                            <td className="px-3 py-2.5 text-center text-gray-500 text-xs">{item.product?.unit || "KG"}</td>
                            <td className="px-3 py-2.5 text-right text-gray-700">{formatCurrency(item.price)}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{formatCurrency(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-end">
                    <div className="w-56 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Amount:</span>
                        <span className="font-bold text-gray-900">{formatCurrency(selectedSale.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between text-green-700">
                        <span>Amount Paid:</span>
                        <span className="font-semibold">{formatCurrency(selectedSale.paidAmount)}</span>
                      </div>
                      <div className={`flex justify-between border-t border-gray-200 pt-2 font-bold ${selectedSale.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                        <span>{selectedSale.balance > 0 ? "Balance Due:" : "Change:"}</span>
                        <span>{formatCurrency(Math.abs(selectedSale.balance))}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {selectedSale.notes && (
                  <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Notes</p>
                    <p className="text-sm text-gray-700">{selectedSale.notes}</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Pesticide Sale Detail Modal */}
        {selectedPesticideSaleDetail && (
          <Dialog open={showPesticideDetailModal} onOpenChange={setShowPesticideDetailModal}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-2">
                    <Sprout className="w-5 h-5 text-green-600" />
                    Pesticide Sale
                    <span className="text-sm font-normal text-gray-400">#{selectedPesticideSaleDetail.id.slice(-8).toUpperCase()}</span>
                  </DialogTitle>
                  <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-2 mr-6">
                    <Printer className="w-4 h-4" /> Print
                  </Button>
                </div>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 font-medium uppercase mb-1">Customer</p>
                    <p className="font-bold text-gray-900">
                      {selectedPesticideSaleDetail.customer?.name || selectedPesticideSaleDetail.customerName || "Walk-in"}
                    </p>
                    {selectedPesticideSaleDetail.customer?.phone && (
                      <p className="text-sm text-gray-600">{selectedPesticideSaleDetail.customer.phone}</p>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 font-medium uppercase mb-1">Sale Info</p>
                    <p className="text-sm text-gray-700">Date: <span className="font-medium">{formatDate(selectedPesticideSaleDetail.createdAt)}</span></p>
                    <p className="text-sm text-gray-700">By: <span className="font-medium">{selectedPesticideSaleDetail.soldBy?.name}</span></p>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Pesticide</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Qty</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Unit</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Unit Price</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-2.5 font-medium text-gray-900">{selectedPesticideSaleDetail.pesticide?.name}</td>
                        <td className="px-3 py-2.5 text-center text-gray-700">{selectedPesticideSaleDetail.quantity}</td>
                        <td className="px-3 py-2.5 text-center text-gray-500 text-xs">{selectedPesticideSaleDetail.pesticide?.unit}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{formatCurrency(selectedPesticideSaleDetail.unitPrice)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{formatCurrency(selectedPesticideSaleDetail.totalAmount)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-end">
                    <div className="w-56 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Amount:</span>
                        <span className="font-bold text-gray-900">{formatCurrency(selectedPesticideSaleDetail.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between text-green-700">
                        <span>Amount Paid:</span>
                        <span className="font-semibold">{formatCurrency(selectedPesticideSaleDetail.paidAmount)}</span>
                      </div>
                      <div className={`flex justify-between border-t border-gray-200 pt-2 font-bold ${(selectedPesticideSaleDetail.balance ?? 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                        <span>{(selectedPesticideSaleDetail.balance ?? 0) > 0 ? "Balance Due:" : "Paid"}</span>
                        <span>{formatCurrency(Math.abs(selectedPesticideSaleDetail.balance ?? 0))}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {selectedPesticideSaleDetail.notes && (
                  <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Notes</p>
                    <p className="text-sm text-gray-700">{selectedPesticideSaleDetail.notes}</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      {/* Delete Sale Confirmation Modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              Delete Sale Entry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Invoice</span>
                <span className="font-semibold">#{deleteTarget?.id?.slice(-8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Customer</span>
                <span className="font-semibold">{deleteTarget?.customer?.name || deleteTarget?.farmer?.name || "Walk-in"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount</span>
                <span className="font-bold text-red-600">{formatCurrency(deleteTarget?.totalAmount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span>{deleteTarget ? formatDate(deleteTarget.createdAt) : ""}</span>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">What happens when deleted:</p>
              <p>✓ Sale removed from customer ledger</p>
              <p>✓ Stock quantities restored</p>
              <p>✗ This cannot be undone</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 gap-2" onClick={confirmDeleteSale} disabled={deleting}>
                <Trash2 className="w-4 h-4" />{deleting ? "Deleting..." : "Delete Sale"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      </div>
    </>
  )
}
