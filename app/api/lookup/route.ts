import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { RECORD_PREFIX, recordCode } from "@/lib/record-code"
import { galaItemsText } from "@/lib/gala"

type Result = { type: string; code: string; title: string; href: string; fields: [string, string][] }

const num = (v: number | null | undefined, unit = "") => (v != null ? `${Number(v).toLocaleString("en-PK", { maximumFractionDigits: 2 })}${unit}` : "—")
const pkr = (v: number | null | undefined) => `PKR ${Number(v || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`
const day = (v: Date | string | null | undefined) => (v ? new Date(v).toLocaleDateString("en-PK") : "—")
const lotStatus = (s: string) => (s === "CANCELLED" ? "Cancelled" : ["SOLD", "DISPATCHED", "SETTLED"].includes(s) ? "Sold" : "Stored")

// GET /api/lookup?code=SRM-12 | LOT-2026-00012 | old short IDs: CM-7K2Q9X | BL-… | ST-… | GM-… | 7K2Q9X (any type)
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const raw = (new URL(req.url).searchParams.get("code") || "").trim().toUpperCase().replace(/^#/, "")
  if (!raw) return NextResponse.json({ error: "Enter an ID" }, { status: 400 })
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const results: Result[] = []

  if (raw.startsWith("LOT-")) {
    const lots = await db.lot.findMany({
      where: { ...shopFilter, lotNo: { equals: raw, mode: "insensitive" } },
      include: { category: true, farmer: true, warehouse: true, buyer: true },
      take: 5,
    })
    for (const l of lots) results.push(lotResult(l))
    return NextResponse.json({ results })
  }

  // Record ID "SRM-12" → the record with that code, whatever its type.
  // Old short IDs still work: "CM-XXXXXX" → only commissions; a bare "XXXXXX" → every type.
  const byCode = /^[A-Z0-9]{1,8}-\d+$/.test(raw) ? { code: { equals: raw, mode: "insensitive" as const } } : null
  const m = raw.match(/^(CM|BL|ST|GM)-?([A-Z0-9]{6})$/) || raw.match(/^()([A-Z0-9]{6})$/)
  if (!byCode && !m) return NextResponse.json({ results })
  const prefix = m?.[1]
  const byId = m ? { id: { endsWith: m[2].toLowerCase() } } : null
  // Where clause for one record type, or null when this ID can't be one
  const whereFor = (typePrefix: string) => {
    const conds: any[] = []
    if (byCode) conds.push(byCode)
    if (byId && (!prefix || prefix === typePrefix)) conds.push(byId)
    return conds.length ? { ...shopFilter, OR: conds } : null
  }

  const commissionWhere = whereFor(RECORD_PREFIX.commission)
  if (commissionWhere) {
    const rows = await db.commission.findMany({
      where: commissionWhere,
      include: { customer: true, farmer: true, supplier: true },
      take: 5,
    })
    for (const c of rows) {
      results.push({
        type: "Commission", code: recordCode("commission", c), href: "/commission",
        title: `${c.commodity || "Commission"} — ${c.customer?.name || c.walkInCustomer || "Buyer"}`,
        fields: [
          ["Date", day(c.createdAt)],
          ["Seller", c.farmer?.name || c.supplier?.name || c.walkInSeller || "—"],
          ["Buyer", c.customer?.name || c.walkInCustomer || "—"],
          ["Commodity", c.commodity || "—"],
          ["Vehicle No", c.vehicleNo || "—"],
          ["Bags", c.bags != null ? String(c.bags) : "—"],
          ["Net weight", num(c.weight, " KG")],
          ["Rate", c.rate ? `PKR ${c.rate} / ${c.rateUnit === "mound" ? "mound" : "kg"}` : "—"],
          ["Commission", `${pkr(c.commissionAmount)} (${c.commissionRate}%)`],
          ["Labour", pkr(c.labourAmount)],
          ["Total amount", pkr(c.totalValue)],
          ["Seller payable", pkr(c.sellerPayable)],
          ["Paid", pkr(c.paidAmount)],
          ["Balance", pkr(c.balance)],
          ["Status", c.status],
        ],
      })
    }
  }

  const billWhere = whereFor(RECORD_PREFIX.bill)
  if (billWhere) {
    const rows = await db.bill.findMany({ where: billWhere, take: 5 })
    for (const b of rows) {
      const data = (b.data || {}) as any
      results.push({
        type: "Bill", code: recordCode("bill", b), href: "/bill-maker",
        title: `Bill #${b.billNo} — ${b.name}`,
        fields: [
          ["Bill No", b.billNo],
          ["Date", day(b.billDate)],
          ["Name", b.name],
          ["Product", b.product || "—"],
          ["Entries", String(Array.isArray(data.rows) ? data.rows.length : 0)],
          ["Total weight", num(b.totalWeight, " KG")],
          ["Cut", num(data.cut, " KG")],
          ["Vehicle cut", num(Number(data.vehicleCut) || 0, " KG")],
          ["Safi weight", num(b.safiWeight, " KG")],
          ["Rate", data.rate ? `PKR ${data.rate} / ${data.rateUnit === "mound" ? "mound (40 kg)" : "kg"}` : "—"],
          ["Total amount", pkr(b.amount)],
        ],
      })
    }
  }

  const galaWhere = whereFor(RECORD_PREFIX.gala)
  if (galaWhere) {
    const rows = await db.galaEntry.findMany({
      where: galaWhere,
      include: { customer: true, farmer: true, supplier: true },
      take: 5,
    })
    for (const g of rows) {
      results.push({
        type: "Gala Mandi", code: recordCode("gala", g), href: "/gala-mandi",
        title: `Gala Mandi #${g.entryNo} — ${g.customer?.name || g.walkInBuyer || "Buyer"}`,
        fields: [
          ["Entry No", g.entryNo],
          ["Date", day(g.entryDate)],
          ["Seller", g.farmer?.name || g.supplier?.name || g.walkInSeller || "—"],
          ["Buyer", g.customer?.name || g.walkInBuyer || "—"],
          ["Products", galaItemsText(g.items) || "—"],
          ["Total weight", num(g.totalWeight, " KG")],
          ["Total amount", pkr(g.totalAmount)],
          ["Received from buyer", pkr(g.receivedAmount)],
          ["Paid to seller", pkr(g.paidAmount)],
        ],
      })
    }
  }

  const productWhere = whereFor(RECORD_PREFIX.product)
  if (productWhere) {
    const rows = await db.product.findMany({
      where: productWhere,
      include: { category: true, room: true },
      take: 5,
    })
    for (const p of rows) {
      results.push({
        type: "Store", code: recordCode("product", p), href: "/inventory",
        title: p.name,
        fields: [
          ["Product", p.name],
          ["Category", p.category?.name || "—"],
          ["Room", p.room?.name || "Unassigned"],
          ["Stock", num(p.currentStock, ` ${p.unit}`)],
          ["Min stock", num(p.minStock, ` ${p.unit}`)],
          ["Purchase price", pkr(p.purchasePrice)],
          ["Sale price", pkr(p.salePrice)],
          ["Stock value", pkr(p.currentStock * p.purchasePrice)],
          ["Active", p.isActive ? "Yes" : "Deleted"],
        ],
      })
    }
  }

  return NextResponse.json({ results })
}

function lotResult(l: any): Result {
  const sold = lotStatus(l.status) === "Sold"
  const fields: [string, string][] = [
    ["Lot No", l.lotNo],
    ["Date", day(l.createdAt)],
    ["Status", lotStatus(l.status)],
    ["Category", l.category?.name || "—"],
    ["Farmer", l.farmer?.name || "—"],
    ["Godown", l.warehouse?.name || "—"],
    ["Vehicle No", l.vehicleNo || "—"],
    ["Bill No", l.billNo || "—"],
    ["Markha", [l.markha1, l.markha2].filter(Boolean).join(", ") || "—"],
    ["Bags", l.bags != null ? `${l.bags} ${l.bagType || ""}`.trim() : "—"],
    ["Gross / Tare / Net", `${num(l.grossWeight)} / ${num(l.tareWeight)} / ${num(l.netWeight)} KG`],
  ]
  if (sold) fields.push(["Buyer", l.buyer?.name || "—"], ["Sale rate", num(l.saleRate)], ["Sale amount", pkr(l.saleAmount)], ["Payment", l.paymentStatus || "—"])
  return { type: "Potato Store", code: l.lotNo, href: "/lots", title: `${l.lotNo} — ${l.category?.name || "Lot"}`, fields }
}
