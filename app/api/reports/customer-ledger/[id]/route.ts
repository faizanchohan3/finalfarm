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

  const customer = await db.customer.findUnique({ where: { id } })
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [sales, pesticideSales, customerCommissions, customerPayments, traderPurchases] = await Promise.all([
    db.sale.findMany({
      where: { customerId: id, ...dateWhere },
      orderBy: { createdAt: "asc" },
      include: {
        items: { include: { product: { select: { name: true, unit: true } } } },
        payments: { orderBy: { createdAt: "asc" } },
      },
    }),
    db.pesticideSale.findMany({
      where: { customerId: id, ...dateWhere },
      orderBy: { createdAt: "asc" },
      include: { pesticide: { select: { name: true, unit: true } } },
    }),
    db.commission.findMany({
      where: { customerId: id, ...dateWhere },
      orderBy: { createdAt: "asc" },
      include: { payments: { orderBy: { createdAt: "asc" } } },
    }),
    db.customerPayment.findMany({
      where: { customerId: id, ...dateWhere },
      orderBy: { createdAt: "asc" },
    }),
    db.purchase.findMany({
      where: { sellerCustomerId: id, ...dateWhere },
      orderBy: { createdAt: "asc" },
      include: { items: { include: { product: { select: { name: true, unit: true } } } } },
    }),
  ])

  const events: any[] = []

  // Regular product sales
  for (const sale of sales) {
    events.push({
      date: sale.createdAt,
      type: "SALE",
      description: `Sale #${sale.id.slice(-6).toUpperCase()} — ${sale.items.map((i) => `${i.quantity} ${i.product.unit} ${i.product.name}`).join(", ")}`,
      debit: sale.totalAmount,
      credit: 0,
    })

    if (sale.payments.length > 0) {
      for (const payment of sale.payments) {
        events.push({
          date: payment.createdAt,
          type: "PAYMENT",
          description: `Payment received — ${payment.method}${payment.notes ? ` (${payment.notes})` : ""}`,
          debit: 0,
          credit: payment.amount,
        })
      }
    } else if (sale.paidAmount > 0) {
      events.push({
        date: sale.createdAt,
        type: "PAYMENT",
        description: `Payment received — CASH (recorded at sale)`,
        debit: 0,
        credit: sale.paidAmount,
      })
    }
  }

  // Commission transactions (customer is buyer)
  for (const comm of customerCommissions) {
    const desc = [comm.commodity, comm.bags ? `${comm.bags} bags` : null, comm.weight ? `${comm.weight} kg` : null].filter(Boolean).join(", ")
    events.push({
      date: comm.createdAt,
      type: "COMMISSION",
      description: `Commission #${comm.id.slice(-6).toUpperCase()}${desc ? ` — ${desc}` : ""}`,
      debit: comm.totalValue,
      credit: 0,
    })
    for (const payment of comm.payments) {
      events.push({
        date: payment.createdAt,
        type: "PAYMENT",
        description: `Payment received — ${payment.method}${payment.notes ? ` (${payment.notes})` : ""}`,
        debit: 0,
        credit: payment.amount,
      })
    }
  }

  // Pesticide sales
  for (const ps of pesticideSales) {
    events.push({
      date: ps.createdAt,
      type: "PESTICIDE_SALE",
      description: `Pesticide Sale #${ps.id.slice(-6).toUpperCase()} — ${ps.quantity} ${ps.pesticide?.unit} ${ps.pesticide?.name}`,
      debit: ps.totalAmount,
      credit: 0,
    })
    if (ps.paidAmount > 0) {
      events.push({
        date: ps.createdAt,
        type: "PAYMENT",
        description: `Payment received — Pesticide sale`,
        debit: 0,
        credit: ps.paidAmount,
      })
    }
  }

  // Purchases FROM this customer/trader (we bought goods from them)
  for (const purchase of traderPurchases) {
    const itemDesc = purchase.items.map((i: any) => `${i.quantity} ${i.product?.unit || ""} ${i.product?.name || ""}`).join(", ")
    events.push({
      date: purchase.createdAt,
      type: "TRADER_PURCHASE",
      description: `Goods purchased from trader #${purchase.id.slice(-6).toUpperCase()}${itemDesc ? ` — ${itemDesc}` : ""}`,
      debit: 0,
      credit: purchase.totalAmount,
    })
    if (purchase.paidAmount > 0) {
      events.push({
        date: purchase.createdAt,
        type: "PAYMENT",
        description: `Payment made to trader at purchase — CASH`,
        debit: purchase.paidAmount,
        credit: 0,
      })
    }
  }

  for (const cp of customerPayments) {
    const isPay = cp.direction === "PAY"
    events.push({
      date: cp.createdAt,
      type: "PAYMENT",
      description: isPay
        ? `Paid to Customer — ${cp.method}${cp.notes ? ` (${cp.notes})` : ""}`
        : `Received from Customer — ${cp.method}${cp.notes ? ` (${cp.notes})` : ""}`,
      debit: isPay ? cp.amount : 0,
      credit: isPay ? 0 : cp.amount,
    })
  }

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  let running = 0
  const entries = events.map((e) => {
    running += e.debit - e.credit
    return { ...e, balance: running }
  })

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0)
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0)

  return NextResponse.json({ customer, entries, totalDebit, totalCredit, closingBalance: running })
}
