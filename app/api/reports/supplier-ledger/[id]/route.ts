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

  const supplier = await db.supplier.findUnique({ where: { id } })
  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [purchases, commissions, supplierPayments] = await Promise.all([
    db.purchase.findMany({
      where: { supplierId: id, ...dateWhere },
      orderBy: { createdAt: "asc" },
      include: {
        items: { include: { product: { select: { name: true, unit: true } } } },
        payments: { orderBy: { createdAt: "asc" } },
      },
    }),
    db.commission.findMany({ where: { supplierId: id, ...dateWhere }, orderBy: { createdAt: "asc" } }),
    db.supplierPayment.findMany({ where: { supplierId: id, ...dateWhere }, orderBy: { createdAt: "asc" } }),
  ])

  const events: any[] = []

  // Supplier gives you goods → Credit supplier (Credit the Giver)
  for (const purchase of purchases) {
    events.push({
      date: purchase.createdAt,
      type: "PURCHASE",
      description: `Purchase #${purchase.id.slice(-6).toUpperCase()} — ${purchase.items.map((i) => `${i.quantity} ${i.product.unit} ${i.product.name}`).join(", ")}`,
      debit: 0,
      credit: purchase.totalAmount,
    })

    if (purchase.payments.length > 0) {
      // You give payment → Debit supplier (Debit the Receiver)
      for (const payment of purchase.payments) {
        events.push({
          date: payment.createdAt,
          type: "PAYMENT",
          description: `Payment made — ${payment.method}${payment.notes ? ` (${payment.notes})` : ""}`,
          debit: payment.amount,
          credit: 0,
        })
      }
    } else if (purchase.paidAmount > 0) {
      events.push({
        date: purchase.createdAt,
        type: "PAYMENT",
        description: `Payment made — CASH (recorded at purchase)`,
        debit: purchase.paidAmount,
        credit: 0,
      })
    }
  }

  // Commission: supplier gave goods through mandi → Credit supplier (Credit the Giver)
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

  for (const sp of supplierPayments) {
    const isPay = sp.direction === "PAY"
    events.push({
      date: sp.createdAt,
      type: "PAYMENT",
      description: isPay
        ? `Paid to Supplier — ${sp.method}${sp.notes ? ` (${sp.notes})` : ""}`
        : `Received from Supplier — ${sp.method}${sp.notes ? ` (${sp.notes})` : ""}`,
      // Pay to supplier → Debit supplier (they receive). Receive from supplier → Credit supplier (they give)
      debit: isPay ? sp.amount : 0,
      credit: isPay ? 0 : sp.amount,
    })
  }

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Standard: running = credit - debit
  // Positive (Cr) = you owe supplier | Negative (Dr) = supplier owes you / advance paid
  let running = 0
  const entries = events.map((e) => {
    running += e.credit - e.debit
    return { ...e, balance: running }
  })

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0)
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0)

  return NextResponse.json({ supplier, entries, totalDebit, totalCredit, closingBalance: running })
}
