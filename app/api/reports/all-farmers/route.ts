import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { cachedJson } from "@/lib/api-cache"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const farmers = await db.farmer.findMany({
    where: { ...shopFilter, isActive: true },
    orderBy: { name: "asc" },
  })

  const farmerIds = farmers.map((f) => f.id)
  if (farmerIds.length === 0) return NextResponse.json({ farmers: [] })

  const [farmerPurchaseTotals, productPurchaseTotals, commissionTotals, paymentTotals] = await Promise.all([
    db.farmerPurchase.groupBy({
      by: ["farmerId"],
      _sum: { totalAmount: true },
      where: { farmerId: { in: farmerIds } },
    }),
    db.purchase.groupBy({
      by: ["farmerId"],
      _sum: { totalAmount: true },
      where: { farmerId: { in: farmerIds } },
    }),
    db.commission.groupBy({
      by: ["farmerId"],
      _sum: { sellerPayable: true },
      where: { farmerId: { in: farmerIds } },
    }),
    db.farmerPayment.groupBy({
      by: ["farmerId"],
      _sum: { amount: true },
      where: { farmerId: { in: farmerIds } },
    }),
  ])

  const fpMap = Object.fromEntries(farmerPurchaseTotals.map((r) => [r.farmerId, r._sum.totalAmount || 0]))
  const ppMap = Object.fromEntries(productPurchaseTotals.map((r) => [r.farmerId!, r._sum.totalAmount || 0]))
  const cmMap = Object.fromEntries(commissionTotals.map((r) => [r.farmerId!, r._sum.sellerPayable || 0]))
  const pymtMap = Object.fromEntries(paymentTotals.map((r) => [r.farmerId, r._sum.amount || 0]))

  const result = farmers.map((f) => ({
    ...f,
    totalDebit: (fpMap[f.id] || 0) + (ppMap[f.id] || 0) + (cmMap[f.id] || 0),
    totalCredit: pymtMap[f.id] || 0,
  }))

  return cachedJson({ farmers: result })
}

