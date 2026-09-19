import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const [supplier, purchases, supplierPayments] = await Promise.all([
    db.supplier.findUnique({ where: { id } }),
    db.purchase.findMany({
      where: { supplierId: id },
      orderBy: { createdAt: "asc" },
      include: {
        items: { include: { product: true } },
        payments: { orderBy: { createdAt: "asc" } },
        createdBy: { select: { name: true } },
      },
    }),
    db.supplierPayment.findMany({
      where: { supplierId: id },
      orderBy: { createdAt: "asc" },
    }),
  ])

  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const totalBusiness = purchases.reduce((s, p) => s + p.totalAmount, 0)
  const purchasePaid = purchases.reduce((s, p) => s + p.paidAmount, 0)
  const spTotal = supplierPayments.reduce((s, p) => p.direction === "PAY" ? s + p.amount : s - p.amount, 0)
  const totalPaid = purchasePaid + spTotal
  const totalBalance = totalBusiness - totalPaid

  // Build ledger entries
  const ledgerEvents: { id?: string; date: Date; type: string; description: string; debit: number; credit: number }[] = []

  for (const p of purchases) {
    ledgerEvents.push({
      date: p.createdAt,
      type: "PURCHASE",
      description: `Purchase — ${p.items.map((i) => i.product?.name || "Item").join(", ")}`,
      debit: p.totalAmount,
      credit: 0,
    })
    if (p.payments.length > 0) {
      for (const payment of p.payments) {
        ledgerEvents.push({
          date: payment.createdAt,
          type: "PAYMENT",
          description: `Payment — ${payment.method}${payment.notes ? ` (${payment.notes})` : ""}`,
          debit: 0,
          credit: payment.amount,
        })
      }
    } else if (p.paidAmount > 0) {
      ledgerEvents.push({
        date: p.createdAt,
        type: "PAYMENT",
        description: `Payment — CASH (at purchase)`,
        debit: 0,
        credit: p.paidAmount,
      })
    }
  }

  for (const sp of supplierPayments) {
    const isPay = sp.direction === "PAY"
    ledgerEvents.push({
      id: sp.id,
      date: sp.createdAt,
      type: "PAYMENT",
      description: isPay
        ? `Paid to Supplier — ${sp.method}${sp.notes ? ` (${sp.notes})` : ""}`
        : `Received from Supplier — ${sp.method}${sp.notes ? ` (${sp.notes})` : ""}`,
      debit: isPay ? sp.amount : 0,
      credit: isPay ? 0 : sp.amount,
    })
  }

  ledgerEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  let running = 0
  const ledger = ledgerEvents.map((e) => {
    running += e.debit - e.credit
    return { ...e, balance: running }
  })

  const purchasesDesc = [...purchases].reverse()
  return NextResponse.json({ supplier, purchases: purchasesDesc, totalBusiness, totalPaid, totalBalance, ledger })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { name, phone, address } = await req.json()

  const supplier = await db.supplier.update({ where: { id }, data: { name, phone, address } })
  await createAuditLog({ userId: session.user.id, action: "UPDATE", module: "SUPPLIERS", details: `Updated supplier: ${name}` })

  return NextResponse.json({ supplier })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await db.supplier.update({ where: { id }, data: { isActive: false } })
  await createAuditLog({ userId: session.user.id, action: "DELETE", module: "SUPPLIERS", details: `Deactivated supplier ID: ${id}` })

  return NextResponse.json({ success: true })
}
