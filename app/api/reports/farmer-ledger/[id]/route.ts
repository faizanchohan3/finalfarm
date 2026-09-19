import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const dateWhere: any = {}
  if (from || to) {
    dateWhere.createdAt = {}
    if (from) dateWhere.createdAt.gte = new Date(from)
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      dateWhere.createdAt.lte = toDate
    }
  }

  const farmer = await db.farmer.findUnique({ where: { id } })
  if (!farmer) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [farmerPurchases, productPurchases, payments, farmerSales, commissions, pesticideSales] = await Promise.all([
    db.farmerPurchase.findMany({
      where: { farmerId: id, ...dateWhere },
      orderBy: { createdAt: "asc" },
      include: { items: { include: { product: { select: { name: true, unit: true } } } } },
    }),
    db.purchase.findMany({
      where: { farmerId: id, ...dateWhere },
      orderBy: { createdAt: "asc" },
      include: {
        items: { include: { product: { select: { name: true, unit: true } } } },
        payments: { orderBy: { createdAt: "asc" } },
      },
    }),
    db.farmerPayment.findMany({ where: { farmerId: id, ...dateWhere }, orderBy: { createdAt: "asc" } }),
    db.sale.findMany({
      where: { farmerId: id, ...dateWhere },
      orderBy: { createdAt: "asc" },
      include: { items: { include: { product: { select: { name: true, unit: true } } } } },
    }),
    db.commission.findMany({ where: { farmerId: id, ...dateWhere }, orderBy: { createdAt: "asc" } }),
    db.pesticideSale.findMany({
      where: { farmerId: id, ...dateWhere },
      orderBy: { createdAt: "asc" },
      include: { pesticide: { select: { name: true, unit: true } } },
    }),
  ])

  const events: any[] = []

  // Farmer gives you goods → Credit farmer (Credit the Giver)
  for (const purchase of farmerPurchases) {
    const parts: string[] = []
    if (purchase.commodity) parts.push(purchase.commodity)
    if (purchase.bags) parts.push(`${purchase.bags} Bags`)
    if (purchase.weight) parts.push(`${purchase.weight} KG`)
    if (!parts.length && purchase.items.length)
      parts.push(purchase.items.map((i) => `${i.quantity} ${i.product.unit} ${i.product.name}`).join(", "))
    events.push({
      date: purchase.createdAt,
      type: "PURCHASE",
      description: `Purchase #${purchase.id.slice(-6).toUpperCase()}${parts.length ? ` — ${parts.join(", ")}` : ""}`,
      debit: 0,
      credit: purchase.totalAmount,
    })
  }

  for (const purchase of productPurchases) {
    const desc = purchase.items.map((i: any) => `${i.quantity} ${i.product.unit} ${i.product.name}`).join(", ")
    events.push({
      date: purchase.createdAt,
      type: "PURCHASE",
      description: `Purchase #${purchase.id.slice(-6).toUpperCase()}${desc ? ` — ${desc}` : ""}`,
      debit: 0,
      credit: purchase.totalAmount,
    })
    // You give payment → Debit farmer (Debit the Receiver)
    for (const payment of purchase.payments) {
      events.push({
        date: payment.createdAt,
        type: "PAYMENT",
        description: `Payment — ${payment.method}${payment.notes ? ` (${payment.notes})` : ""}`,
        debit: payment.amount,
        credit: 0,
      })
    }
  }

  for (const payment of payments) {
    const isReceive = payment.amount < 0 // Farmer gives you cash (unusual)
    const displayAmt = Math.abs(payment.amount)
    events.push({
      date: payment.createdAt,
      type: isReceive ? "INCOME" : "PAYMENT",
      description: `${isReceive ? "Received from Farmer" : "Payment to Farmer"} — ${payment.method}${payment.notes ? ` (${payment.notes})` : ""}`,
      // Pay to farmer → Dr farmer. Receive from farmer → Cr farmer (farmer is giver)
      debit: isReceive ? 0 : displayAmt,
      credit: isReceive ? displayAmt : 0,
    })
  }

  // You sell to farmer → Debit farmer (Debit the Receiver)
  for (const sale of farmerSales) {
    const itemDesc = sale.items.map((i: any) => `${i.quantity} ${i.product.unit} ${i.product.name}`).join(", ")
    events.push({
      date: sale.createdAt,
      type: "SALE",
      description: `Sale #${sale.id.slice(-6).toUpperCase()}${itemDesc ? ` — ${itemDesc}` : ""}`,
      debit: sale.totalAmount,
      credit: 0,
    })
    if (sale.paidAmount > 0) {
      events.push({
        date: sale.createdAt,
        type: "PAYMENT",
        description: `Payment received — Sale #${sale.id.slice(-6).toUpperCase()}`,
        debit: 0,
        credit: sale.paidAmount,
      })
    }
  }

  // You sell pesticide to farmer → Debit farmer (Debit the Receiver)
  for (const ps of pesticideSales) {
    events.push({
      date: ps.createdAt,
      type: "PESTICIDE_SALE",
      description: `Pesticide Sale #${ps.id.slice(-6).toUpperCase()} — ${ps.quantity} ${ps.pesticide?.unit || ""} ${ps.pesticide?.name || ""}`,
      debit: ps.totalAmount,
      credit: 0,
    })
    if (ps.paidAmount > 0) {
      // Farmer pays you → Credit farmer (Credit the Giver)
      events.push({
        date: ps.createdAt,
        type: "PAYMENT",
        description: `Payment received — Pesticide sale`,
        debit: 0,
        credit: ps.paidAmount,
      })
    }
  }

  // Commission: farmer gave goods through mandi → Credit farmer (Credit the Giver)
  for (const comm of commissions) {
    const parts = [comm.commodity, comm.bags ? `${comm.bags} bags` : null, comm.weight ? `${comm.weight} kg` : null].filter(Boolean).join(", ")
    events.push({
      date: comm.createdAt,
      type: "COMMISSION",
      description: `Commission #${comm.id.slice(-6).toUpperCase()}${parts ? ` — ${parts}` : ""}`,
      debit: 0,
      credit: comm.sellerPayable,
    })
  }

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Standard: running = credit - debit
  // Positive (Cr) = you owe farmer | Negative (Dr) = farmer owes you / advance paid
  let running = 0
  const entries = events.map((e) => {
    running += e.credit - e.debit
    return { ...e, balance: running }
  })

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0)
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0)

  return NextResponse.json({ farmer, entries, totalDebit, totalCredit, closingBalance: running })
}
