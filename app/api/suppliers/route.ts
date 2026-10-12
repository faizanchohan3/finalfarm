import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { cachedJson } from "@/lib/api-cache"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const suppliers = await db.supplier.findMany({ where: { ...shopFilter, isActive: true }, orderBy: { name: "asc" } })

  // Balance from the ledger: purchases + commissions (we owe) − payments to them + payments from them.
  // Same figure as the closing balance in /api/suppliers/[id]; positive (Cr) = we owe the supplier.
  const supplierIds = suppliers.map((s) => s.id)
  const [purchaseTotals, commissionTotals, paidPayments, receivedPayments, galaTotals] = await Promise.all([
    db.purchase.groupBy({
      by: ["supplierId"],
      _sum: { totalAmount: true, paidAmount: true },
      where: { supplierId: { in: supplierIds } },
    }),
    db.commission.groupBy({
      by: ["supplierId"],
      _sum: { sellerPayable: true },
      where: { supplierId: { in: supplierIds } },
    }),
    db.supplierPayment.groupBy({
      by: ["supplierId"],
      _sum: { amount: true },
      where: { supplierId: { in: supplierIds }, direction: "PAY" },
    }),
    db.supplierPayment.groupBy({
      by: ["supplierId"],
      _sum: { amount: true },
      where: { supplierId: { in: supplierIds }, direction: "RECEIVE" },
    }),
    // Gala Mandi entries where the supplier is the seller
    db.galaEntry.groupBy({
      by: ["supplierId"],
      _sum: { totalAmount: true },
      where: { supplierId: { in: supplierIds } },
    }),
  ])
  const galaMap = Object.fromEntries(galaTotals.map((r) => [r.supplierId!, r._sum.totalAmount || 0]))

  const paidMap = Object.fromEntries(paidPayments.map((r) => [r.supplierId, r._sum.amount || 0]))
  const receivedMap = Object.fromEntries(receivedPayments.map((r) => [r.supplierId, r._sum.amount || 0]))

  const purchaseMap = Object.fromEntries(purchaseTotals.map((r) => [r.supplierId!, r._sum.totalAmount || 0]))
  const purchasePaidMap = Object.fromEntries(purchaseTotals.map((r) => [r.supplierId!, r._sum.paidAmount || 0]))
  const commMap = Object.fromEntries(commissionTotals.map((r) => [r.supplierId!, r._sum.sellerPayable || 0]))

  const suppliersWithBalance = suppliers.map((s) => {
    // Credit the Giver (purchases, commissions, Gala Mandi, money received from them), Debit the Receiver (money paid to them)
    const totalCredit = (purchaseMap[s.id] || 0) + (commMap[s.id] || 0) + (galaMap[s.id] || 0) + (receivedMap[s.id] || 0)
    const totalDebit = (purchasePaidMap[s.id] || 0) + (paidMap[s.id] || 0)
    return { ...s, totalDebit, totalCredit, ledgerBalance: totalCredit - totalDebit }
  })

  return cachedJson({ suppliers: suppliersWithBalance })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { name, phone, address } = await req.json()
  const supplier = await db.supplier.create({ data: { shopId: session.user.shopId || null, name, phone, address } })
  return NextResponse.json({ supplier }, { status: 201 })
}

