import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const bankId = searchParams.get("bankId") || undefined
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  // Get all bank IDs for this shop (for "all banks" view)
  const shopBanks = await db.bank.findMany({
    where: { ...shopFilter, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  const shopBankIds = shopBanks.map((b) => b.id)

  const bankFilter = bankId ? { bankId } : { bankId: { in: shopBankIds } }

  const dateFilter: any = {}
  if (from) dateFilter.gte = new Date(from)
  if (to) {
    const toDate = new Date(to)
    toDate.setHours(23, 59, 59, 999)
    dateFilter.lte = toDate
  }
  const dateWhere = from || to ? { createdAt: dateFilter } : {}

  const [payments, farmerPayments, transactions] = await Promise.all([
    db.payment.findMany({
      where: { ...bankFilter, ...dateWhere },
      include: {
        bank: { select: { name: true } },
        sale: { select: { customer: { select: { name: true } } } },
        purchase: { select: { supplier: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.farmerPayment.findMany({
      where: { ...bankFilter, ...dateWhere },
      include: {
        bank: { select: { name: true } },
        farmer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.transaction.findMany({
      where: { ...shopFilter, ...bankFilter, ...dateWhere },
      include: {
        bank: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const entries = [
    ...payments.map((p) => ({
      id: p.id,
      date: p.createdAt,
      type: p.saleId ? "RECEIPT" : "PAYMENT",
      bank: p.bank?.name || "-",
      bankId: p.bankId,
      method: p.method,
      amount: p.amount,
      party: p.saleId
        ? (p.sale?.customer?.name || "Customer")
        : (p.purchase?.supplier?.name || "Supplier"),
      description: p.saleId
        ? `Receipt from ${p.sale?.customer?.name || "Customer"}`
        : `Payment to ${p.purchase?.supplier?.name || "Supplier"}`,
      reference: p.reference || null,
    })),
    ...farmerPayments.map((fp) => ({
      id: fp.id,
      date: fp.createdAt,
      type: "FARMER_PAYMENT",
      bank: fp.bank?.name || "-",
      bankId: fp.bankId,
      method: fp.method,
      amount: fp.amount,
      party: fp.farmer?.name || "Farmer",
      description: `Payment to farmer ${fp.farmer?.name || ""}`,
      reference: fp.reference || null,
    })),
    ...transactions.map((t) => ({
      id: t.id,
      date: t.createdAt,
      type: t.type === "CREDIT" ? "INCOME" : "EXPENSE",
      bank: t.bank?.name || "-",
      bankId: t.bankId,
      method: "BANK_TRANSFER",
      amount: t.amount,
      party: t.createdBy?.name || "-",
      description: t.description,
      reference: t.reference || null,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalIn = entries
    .filter((e) => e.type === "RECEIPT" || e.type === "INCOME")
    .reduce((s, e) => s + e.amount, 0)
  const totalOut = entries
    .filter((e) => e.type !== "RECEIPT" && e.type !== "INCOME")
    .reduce((s, e) => s + e.amount, 0)

  return NextResponse.json({ entries, totalIn, totalOut, count: entries.length, banks: shopBanks })
}
