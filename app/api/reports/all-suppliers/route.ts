import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { cachedJson } from "@/lib/api-cache"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const suppliers = await db.supplier.findMany({
    where: { ...shopFilter, isActive: true },
    orderBy: { name: "asc" },
  })

  const supplierIds = suppliers.map((s) => s.id)
  if (supplierIds.length === 0) return NextResponse.json({ suppliers: [] })

  const [purchaseTotals, commissionTotals, paymentTotals] = await Promise.all([
    db.purchase.groupBy({
      by: ["supplierId"],
      _sum: { totalAmount: true },
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
  ])

  const ptMap = Object.fromEntries(purchaseTotals.map((r) => [r.supplierId!, r._sum.totalAmount || 0]))
  const cmMap = Object.fromEntries(commissionTotals.map((r) => [r.supplierId!, r._sum.sellerPayable || 0]))
  const pymtMap = Object.fromEntries(paymentTotals.map((r) => [r.supplierId, r._sum.amount || 0]))

  const result = suppliers.map((s) => ({
    ...s,
    totalDebit: (ptMap[s.id] || 0) + (cmMap[s.id] || 0),
    totalCredit: pymtMap[s.id] || 0,
  }))

  return cachedJson({ suppliers: result })
}
