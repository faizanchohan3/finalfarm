import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

// Direct credits/debits recorded from the Banks page. Only these are fully editable (type and amount);
// every other bank entry mirrors a sale, purchase, payment or settlement, so only its date and
// reference can change here without breaking the record it came from.
const MANUAL_CATEGORIES = ["Bank Deposit", "Bank Withdrawal"]
const isManual = (t: { category: string | null; accountId: string | null }) =>
  !t.accountId && MANUAL_CATEGORIES.includes(t.category || "")

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

  const [payments, farmerPayments, driverPayments, transactions] = await Promise.all([
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
    db.driverPayment.findMany({
      where: { ...bankFilter, ...dateWhere },
      include: {
        bank: { select: { name: true } },
        driver: { select: { name: true } },
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
      editable: "meta",
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
      editable: "meta",
    })),
    ...driverPayments.map((dp) => ({
      id: dp.id,
      date: dp.createdAt,
      type: "DRIVER_PAYMENT",
      bank: dp.bank?.name || "-",
      bankId: dp.bankId,
      method: dp.method,
      amount: dp.amount,
      party: dp.driver?.name || "Driver",
      description: `Payment to driver ${dp.driver?.name || ""}`,
      reference: dp.reference || null,
      editable: "meta",
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
      editable: isManual(t) ? "full" : "meta",
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


// Edit one entry shown in a bank ledger. `type` is the entry type from GET, which says which table it lives in.
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, type, txnType, amount, description, reference, date } = await req.json()
  if (!id || !type) return NextResponse.json({ error: "Entry ID and type are required" }, { status: 400 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const shopBankIds = (await db.bank.findMany({ where: shopFilter, select: { id: true } })).map((b) => b.id)

  const createdAt = date ? new Date(date) : undefined
  if (createdAt && isNaN(createdAt.getTime())) return NextResponse.json({ error: "Invalid date" }, { status: 400 })
  const meta = {
    ...(reference !== undefined ? { reference: reference ? String(reference).trim() : null } : {}),
    ...(createdAt ? { createdAt } : {}),
  }

  const notFound = NextResponse.json({ error: "Entry not found" }, { status: 404 })
  const ownBank = (bankId: string | null) => !!bankId && shopBankIds.includes(bankId)

  try {
    if (type === "INCOME" || type === "EXPENSE") {
      const t = await db.transaction.findUnique({ where: { id } })
      if (!t || !ownBank(t.bankId)) return notFound

      const data: any = { ...meta }
      if (isManual(t)) {
        if (amount !== undefined) {
          const amt = parseFloat(amount)
          if (!amt || amt <= 0) return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 })
          data.amount = amt
        }
        if (txnType === "CREDIT" || txnType === "DEBIT") {
          data.type = txnType
          data.category = txnType === "CREDIT" ? "Bank Deposit" : "Bank Withdrawal"
        }
        if (description !== undefined) {
          if (!String(description).trim()) return NextResponse.json({ error: "Enter a description" }, { status: 400 })
          data.description = String(description).trim()
        }
      } else if (amount !== undefined && parseFloat(amount) !== t.amount) {
        return NextResponse.json({ error: "This entry comes from another record. Edit the amount there." }, { status: 400 })
      }

      const updated = await db.transaction.update({ where: { id }, data })
      await createAuditLog({
        userId: session.user.id, shopId: session.user.shopId, action: "UPDATE", module: "FINANCE",
        details: `Edited bank ${updated.type === "CREDIT" ? "credit" : "debit"}: ${updated.description} - PKR ${t.amount} → PKR ${updated.amount}`,
      })
      return NextResponse.json({ success: true })
    }

    // Payments mirror a sale/purchase, farmer or driver balance: only date and reference are editable.
    const model =
      type === "RECEIPT" || type === "PAYMENT" ? db.payment
      : type === "FARMER_PAYMENT" ? db.farmerPayment
      : type === "DRIVER_PAYMENT" ? db.driverPayment
      : null
    if (!model) return NextResponse.json({ error: "Unknown entry type" }, { status: 400 })

    const p = await (model as any).findUnique({ where: { id } })
    if (!p || !ownBank(p.bankId)) return notFound
    if (amount !== undefined && parseFloat(amount) !== p.amount)
      return NextResponse.json({ error: "This entry comes from another record. Edit the amount there." }, { status: 400 })

    await (model as any).update({ where: { id }, data: meta })
    await createAuditLog({
      userId: session.user.id, shopId: session.user.shopId, action: "UPDATE", module: "FINANCE",
      details: `Edited bank entry (${type}) date/reference - PKR ${p.amount}`,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update bank entry error:", error)
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 })
  }
}
