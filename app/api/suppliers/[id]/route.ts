import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { archiveDeleted, day, pkr } from "@/lib/recycle-bin"
import { galaLedgerText } from "@/lib/gala"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const [supplier, purchases, supplierPayments, commissions, galaEntries] = await Promise.all([
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
    // Commissions where this supplier is the seller
    db.commission.findMany({ where: { supplierId: id }, orderBy: { createdAt: "asc" } }),
    // Gala Mandi entries where this supplier is the seller (their Paid payments are supplier payments)
    db.galaEntry.findMany({ where: { supplierId: id }, orderBy: { entryDate: "asc" } }),
  ])

  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const totalBusiness =
    purchases.reduce((s, p) => s + p.totalAmount, 0) +
    commissions.reduce((s, c) => s + c.sellerPayable, 0) +
    galaEntries.reduce((s, g) => s + g.totalAmount, 0)
  const purchasePaid = purchases.reduce((s, p) => s + p.paidAmount, 0)
  const spTotal = supplierPayments.reduce((s, p) => p.direction === "PAY" ? s + p.amount : s - p.amount, 0)
  const totalPaid = purchasePaid + spTotal
  const totalBalance = totalBusiness - totalPaid

  // Build ledger entries — Credit the Giver, Debit the Receiver (same as the supplier ledger report)
  const ledgerEvents: { id?: string; date: Date; type: string; description: string; debit: number; credit: number }[] = []

  // Supplier gives goods → Credit supplier
  for (const p of purchases) {
    ledgerEvents.push({
      date: p.createdAt,
      type: "PURCHASE",
      description: `Purchase — ${p.items.map((i) => i.product?.name || "Item").join(", ")}`,
      debit: 0,
      credit: p.totalAmount,
    })
    // We pay the supplier → Debit supplier
    if (p.payments.length > 0) {
      for (const payment of p.payments) {
        ledgerEvents.push({
          date: payment.createdAt,
          type: "PAYMENT",
          description: `Payment — ${payment.method}${payment.notes ? ` (${payment.notes})` : ""}`,
          debit: payment.amount,
          credit: 0,
        })
      }
    } else if (p.paidAmount > 0) {
      ledgerEvents.push({
        date: p.createdAt,
        type: "PAYMENT",
        description: `Payment — CASH (at purchase)`,
        debit: p.paidAmount,
        credit: 0,
      })
    }
  }

  // Commission: supplier sold goods through us → Credit supplier with the seller payable
  for (const c of commissions) {
    const parts = [c.commodity, c.bags ? `${c.bags} bags` : null, c.weight ? `${c.weight} kg` : null].filter(Boolean).join(", ")
    ledgerEvents.push({
      date: c.createdAt,
      type: "COMMISSION",
      description: `Commission #${c.id.slice(-6).toUpperCase()}${parts ? ` — ${parts}` : ""}`,
      debit: 0,
      credit: c.sellerPayable,
    })
  }

  // Gala Mandi: supplier sold through the mandi → Credit supplier with the total; unpaid part in the description
  for (const g of galaEntries) {
    ledgerEvents.push({
      date: g.entryDate,
      type: "GALA",
      description: galaLedgerText(g, "seller"),
      debit: 0,
      credit: g.totalAmount,
    })
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
  // running = credit − debit: positive (Cr) = we owe the supplier, negative (Dr) = supplier owes us / advance
  let running = 0
  const ledger = ledgerEvents.map((e) => {
    running += e.credit - e.debit
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
  const supplier = await db.supplier.findUnique({ where: { id } })
  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await db.$transaction(async (tx) => {
    // Keep a copy for the Deleted Records page (supplier is only deactivated, restore re-activates)
    await archiveDeleted(tx, session, {
      type: "SUPPLIER", recordId: id, code: `SP-${id.slice(-6).toUpperCase()}`, title: supplier.name, amount: supplier.balance,
      summary: [["Name", supplier.name], ["Phone", supplier.phone || "—"], ["Balance", pkr(supplier.balance)], ["Added on", day(supplier.createdAt)]],
      snapshot: { supplier },
    })
    await tx.supplier.update({ where: { id }, data: { isActive: false } })
  })
  await createAuditLog({ userId: session.user.id, action: "DELETE", module: "SUPPLIERS", details: `Deactivated supplier ID: ${id}` })

  return NextResponse.json({ success: true })
}
