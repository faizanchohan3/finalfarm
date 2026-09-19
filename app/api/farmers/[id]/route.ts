import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const farmer = await db.farmer.findUnique({
    where: { id },
    include: {
      purchases: {
        orderBy: { createdAt: "asc" },
        include: {
          items: { include: { product: { select: { name: true, unit: true } } } },
          payments: { orderBy: { createdAt: "asc" } },
        },
      },
      payments: { orderBy: { createdAt: "asc" } },
    },
  })
  if (!farmer) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sales, commissions, pesticideSales]: [any[], any[], any[]] = await Promise.all([
    (db.sale as any).findMany({
      where: { farmerId: id },
      orderBy: { createdAt: "asc" },
      include: {
        items: { include: { product: { select: { name: true, unit: true } } } },
      },
    }),
    db.commission.findMany({
      where: { farmerId: id },
      orderBy: { createdAt: "asc" },
    }),
    db.pesticideSale.findMany({
      where: { farmerId: id },
      orderBy: { createdAt: "asc" },
      include: { pesticide: { select: { name: true, unit: true } } },
    }),
  ])

  const events: any[] = []

  // FarmerPurchase records (mandi buys from farmer → debit)
  for (const purchase of farmer.purchases) {
    events.push({
      date: purchase.createdAt,
      type: "PURCHASE",
      description: `Purchase — ${purchase.commodity || purchase.items.map((i) => i.product.name).join(", ")}`,
      debit: purchase.totalAmount,
      credit: 0,
      ref: purchase.id,
    })
    for (const payment of purchase.payments) {
      events.push({
        date: payment.createdAt,
        type: "PAYMENT",
        description: `Payment — ${payment.method}`,
        debit: 0,
        credit: Math.abs(payment.amount),
        ref: payment.id,
      })
    }
  }

  // Standalone FarmerPayments (amount < 0 = received from farmer = Debit)
  for (const payment of farmer.payments) {
    if (!payment.purchaseId) {
      const isReceive = payment.amount < 0
      const displayAmt = Math.abs(payment.amount)
      events.push({
        id: payment.id,
        date: payment.createdAt,
        type: isReceive ? "INCOME" : "PAYMENT",
        description: `${isReceive ? "Received from Farmer" : "Payment"} — ${payment.method}${payment.notes ? ` (${payment.notes})` : ""}`,
        debit: isReceive ? 0 : displayAmt,
        credit: isReceive ? displayAmt : 0,
      })
    }
  }

  // Sales to farmer (mandi sells to farmer → credit)
  for (const sale of sales) {
    const itemDesc = sale.items.map((i: any) => `${i.quantity} ${i.product.unit} ${i.product.name}`).join(", ")
    events.push({
      date: sale.createdAt,
      type: "SALE",
      description: `Sale #${sale.id.slice(-6).toUpperCase()}${itemDesc ? ` — ${itemDesc}` : ""}`,
      debit: 0,
      credit: sale.totalAmount,
      ref: sale.id,
    })
    if (sale.paidAmount > 0) {
      events.push({
        date: sale.createdAt,
        type: "PAYMENT",
        description: `Payment received — Sale #${sale.id.slice(-6).toUpperCase()}`,
        debit: sale.paidAmount,
        credit: 0,
        ref: sale.id,
      })
    }
  }

  // Pesticide sales to farmer — farmer owes mandi (debit their account, credit when paid)
  for (const ps of pesticideSales) {
    events.push({
      date: ps.createdAt,
      type: "PESTICIDE_SALE",
      description: `Pesticide Sale #${ps.id.slice(-6).toUpperCase()} — ${ps.quantity} ${ps.pesticide?.unit || ""} ${ps.pesticide?.name || ""}`,
      debit: 0,
      credit: ps.totalAmount,
      ref: ps.id,
    })
    if (ps.paidAmount > 0) {
      events.push({
        date: ps.createdAt,
        type: "PAYMENT",
        description: `Payment received — Pesticide sale`,
        debit: ps.paidAmount,
        credit: 0,
        ref: ps.id,
      })
    }
  }

  // Commission transactions where farmer is the seller — mandi owes farmer sellerPayable
  for (const comm of commissions) {
    const parts = [comm.commodity, comm.bags ? `${comm.bags} bags` : null, comm.weight ? `${comm.weight} kg` : null].filter(Boolean).join(", ")
    events.push({
      date: comm.createdAt,
      type: "COMMISSION",
      description: `Commission #${comm.id.slice(-6).toUpperCase()}${parts ? ` — ${parts}` : ""}`,
      debit: comm.sellerPayable,
      credit: 0,
      ref: comm.id,
    })
  }

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  let running = 0
  const ledger = events.map((e) => {
    running += e.debit - e.credit
    return { ...e, balance: running }
  })

  return NextResponse.json({ farmer, ledger })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const { amount, method, notes, purchaseId, paymentType = "PAY" } = body

  const amt = parseFloat(amount)
  if (!amt || amt <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 })

  // Store negative amount for RECEIVE (farmer pays mandi), positive for PAY (mandi pays farmer)
  const storedAmount = paymentType === "RECEIVE" ? -amt : amt

  // Balance convention: positive = mandi owes farmer
  // PAY: mandi pays farmer → balance decrements
  // RECEIVE: farmer pays mandi → balance increments
  const balanceChange = paymentType === "RECEIVE"
    ? { increment: amt }
    : { decrement: amt }

  await db.$transaction(async (tx) => {
    await tx.farmerPayment.create({
      data: {
        farmerId: id,
        purchaseId: purchaseId || null,
        amount: storedAmount,
        method: method || "CASH",
        notes: notes || null,
      },
    })

    await tx.farmer.update({
      where: { id },
      data: { balance: balanceChange },
    })

    if (purchaseId && paymentType === "PAY") {
      const purchase = await tx.farmerPurchase.findUnique({ where: { id: purchaseId } })
      if (purchase) {
        const newPaid = purchase.paidAmount + amt
        const newBalance = purchase.totalAmount - newPaid
        await tx.farmerPurchase.update({
          where: { id: purchaseId },
          data: {
            paidAmount: newPaid,
            balance: newBalance,
            status: newBalance <= 0 ? "PAID" : newPaid > 0 ? "PARTIAL" : "PENDING",
          },
        })
      }
    }
  })

  return NextResponse.json({ ok: true })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const farmer = await db.farmer.update({
    where: { id },
    data: {
      name: body.name,
      phone: body.phone || null,
      address: body.address || null,
      village: body.village || null,
      cnic: body.cnic || null,
      creditLimit: body.creditLimit || 0,
    },
  })
  return NextResponse.json({ farmer })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  await db.farmer.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
