import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const [customer, sales, commissions, pesticideSales, customerPayments, traderPurchases] = await Promise.all([
    db.customer.findUnique({ where: { id } }),
    db.sale.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "asc" },
      include: {
        items: { include: { product: { select: { name: true, unit: true } } } },
        payments: { orderBy: { createdAt: "asc" } },
        createdBy: { select: { name: true } },
      },
    }),
    db.commission.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "asc" },
      include: { payments: { orderBy: { createdAt: "asc" } } },
    }),
    db.pesticideSale.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "asc" },
      include: { pesticide: { select: { name: true, unit: true } } },
    }),
    db.customerPayment.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "asc" },
    }),
    db.purchase.findMany({
      where: { sellerCustomerId: id },
      orderBy: { createdAt: "asc" },
      include: { items: { include: { product: { select: { name: true, unit: true } } } } },
    }),
  ])

  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const totalBusiness =
    sales.reduce((s, sale) => s + sale.totalAmount, 0) +
    commissions.reduce((s, c) => s + c.totalValue, 0) +
    pesticideSales.reduce((s, ps) => s + ps.totalAmount, 0)

  // Initial paid at sale/commission creation + standalone CustomerPayment records
  const initialPaid =
    sales.reduce((s, sale) => s + sale.paidAmount, 0) +
    commissions.reduce((s, c) => s + c.paidAmount, 0) +
    pesticideSales.reduce((s, ps) => s + ps.paidAmount, 0)
  // Only RECEIVE payments count as "paid" — PAY entries are advances (they owe us more)
  const cpReceived = customerPayments.reduce((s, p) => p.direction === "RECEIVE" ? s + p.amount : s, 0)
  const cpAdvances = customerPayments.reduce((s, p) => p.direction === "PAY" ? s + p.amount : s, 0)
  const totalPaid = initialPaid + cpReceived

  // Balance = Business (sales + advances) - Paid (received)
  const totalBalance = totalBusiness + cpAdvances - totalPaid

  // Build ledger entries from all sources, sorted by date
  const ledgerEvents: {
    id?: string
    date: Date
    type: "SALE" | "COMMISSION" | "PESTICIDE" | "PAYMENT" | "TRADER_PURCHASE"
    description: string
    debit: number
    credit: number
  }[] = []

  for (const sale of sales) {
    ledgerEvents.push({
      date: sale.createdAt,
      type: "SALE",
      description: `Sale #${sale.id.slice(-6).toUpperCase()} — ${sale.items.map((i) => `${i.quantity} ${i.product.unit} ${i.product.name}`).join(", ")}`,
      debit: sale.totalAmount,
      credit: 0,
    })
    if (sale.payments.length > 0) {
      for (const payment of sale.payments) {
        ledgerEvents.push({
          date: payment.createdAt,
          type: "PAYMENT",
          description: `Payment — ${payment.method}${payment.notes ? ` (${payment.notes})` : ""}`,
          debit: 0,
          credit: payment.amount,
        })
      }
    } else if (sale.paidAmount > 0) {
      ledgerEvents.push({
        date: sale.createdAt,
        type: "PAYMENT",
        description: `Payment — CASH (at sale)`,
        debit: 0,
        credit: sale.paidAmount,
      })
    }
  }

  for (const c of commissions) {
    ledgerEvents.push({
      date: c.createdAt,
      type: "COMMISSION",
      description: `Commission — ${c.commodity || "goods"}${c.bags ? ` (${c.bags} bags)` : ""}`,
      debit: c.totalValue,
      credit: 0,
    })
    if (c.payments.length > 0) {
      for (const payment of c.payments) {
        ledgerEvents.push({
          date: payment.createdAt,
          type: "PAYMENT",
          description: `Payment — ${payment.method}${payment.notes ? ` (${payment.notes})` : ""}`,
          debit: 0,
          credit: payment.amount,
        })
      }
    } else if (c.paidAmount > 0) {
      ledgerEvents.push({
        date: c.createdAt,
        type: "PAYMENT",
        description: `Payment — CASH (at commission)`,
        debit: 0,
        credit: c.paidAmount,
      })
    }
  }

  for (const ps of pesticideSales) {
    ledgerEvents.push({
      date: ps.createdAt,
      type: "PESTICIDE",
      description: `Pesticide — ${ps.pesticide?.name || "Item"} ×${ps.quantity}`,
      debit: ps.totalAmount,
      credit: 0,
    })
    if (ps.paidAmount > 0) {
      ledgerEvents.push({
        date: ps.createdAt,
        type: "PAYMENT",
        description: `Payment — CASH (at sale)`,
        debit: 0,
        credit: ps.paidAmount,
      })
    }
  }

  for (const purchase of traderPurchases) {
    const itemDesc = purchase.items.map((i: any) => `${i.quantity} ${i.product?.unit || ""} ${i.product?.name || ""}`).join(", ")
    ledgerEvents.push({
      date: purchase.createdAt,
      type: "TRADER_PURCHASE",
      description: `Goods sold to us #${purchase.id.slice(-6).toUpperCase()}${itemDesc ? ` — ${itemDesc}` : ""}`,
      debit: 0,
      credit: purchase.totalAmount,
    })
    if (purchase.paidAmount > 0) {
      ledgerEvents.push({
        date: purchase.createdAt,
        type: "PAYMENT",
        description: `Paid to trader at purchase — CASH`,
        debit: purchase.paidAmount,
        credit: 0,
      })
    }
  }

  for (const cp of customerPayments) {
    const isPay = cp.direction === "PAY"
    ledgerEvents.push({
      id: cp.id,
      date: cp.createdAt,
      type: "PAYMENT",
      description: isPay
        ? `Paid to Customer — ${cp.method}${cp.notes ? ` (${cp.notes})` : ""}`
        : `Received from Customer — ${cp.method}${cp.notes ? ` (${cp.notes})` : ""}`,
      // PAY = Debit (we gave them money, they owe us)
      // RECEIVE = Credit (they paid us, reduces their balance)
      debit: isPay ? cp.amount : 0,
      credit: isPay ? 0 : cp.amount,
    })
  }

  ledgerEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  let running = 0
  const ledger = ledgerEvents.map((e) => {
    running += e.debit - e.credit
    return { ...e, balance: running }
  })

  return NextResponse.json({ customer, sales, commissions, pesticideSales, totalBusiness, totalPaid, totalAdvances: cpAdvances, totalBalance, ledger })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { name, phone, address, image, referenceName, referencePhone, creditLimit } = await req.json()

  const customer = await db.customer.update({
    where: { id },
    data: { name, phone, address, image: image || null, referenceName: referenceName || null, referencePhone: referencePhone || null, creditLimit: creditLimit || 0 },
  })
  await createAuditLog({ userId: session.user.id, action: "UPDATE", module: "CUSTOMERS", details: `Updated customer: ${name}` })

  return NextResponse.json({ customer })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { isActive } = await req.json()
  const customer = await db.customer.update({ where: { id }, data: { isActive } })
  await createAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    module: "CUSTOMERS",
    details: `${isActive ? "Activated" : "Deactivated"} customer ID: ${id}`,
  })
  return NextResponse.json({ customer })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const permanent = searchParams.get("permanent") === "true"

  if (permanent) {
    const customer = await db.customer.findUnique({ where: { id }, select: { name: true, isActive: true } })
    if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (customer.isActive) return NextResponse.json({ error: "Cannot delete an active trader. Deactivate first." }, { status: 400 })

    // Unlink customer from all records that allow null (financial data preserved)
    // CustomerPayment has non-nullable FK so those records are deleted
    await db.$transaction([
      db.sale.updateMany({ where: { customerId: id }, data: { customerId: null } }),
      db.commission.updateMany({ where: { customerId: id }, data: { customerId: null } }),
      db.pesticideSale.updateMany({ where: { customerId: id }, data: { customerId: null } }),
      db.purchase.updateMany({ where: { sellerCustomerId: id }, data: { sellerCustomerId: null } }),
      db.customerPayment.deleteMany({ where: { customerId: id } }),
      db.customer.delete({ where: { id } }),
    ])

    await createAuditLog({ userId: session.user.id, action: "DELETE", module: "CUSTOMERS", details: `Deleted trader profile: ${customer.name} (transaction records preserved)` })
    return NextResponse.json({ success: true })
  }

  // Default: just deactivate
  await db.customer.update({ where: { id }, data: { isActive: false } })
  await createAuditLog({ userId: session.user.id, action: "DELETE", module: "CUSTOMERS", details: `Deactivated customer ID: ${id}` })
  return NextResponse.json({ success: true })
}
