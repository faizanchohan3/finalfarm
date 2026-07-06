import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { cachedJson } from "@/lib/api-cache"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const customers = await db.customer.findMany({
    where: { ...shopFilter, isActive: true },
    orderBy: { name: "asc" },
  })

  const customerIds = customers.map((c) => c.id)
  if (customerIds.length === 0) return NextResponse.json({ customers: [] })

  const [saleTotals, commissionTotals, pesticideSaleTotals, receivedPayments, paidPayments] = await Promise.all([
    db.sale.groupBy({ by: ["customerId"], _sum: { totalAmount: true }, where: { customerId: { in: customerIds } } }),
    db.commission.groupBy({ by: ["customerId"], _sum: { totalValue: true }, where: { customerId: { in: customerIds } } }),
    db.pesticideSale.groupBy({ by: ["customerId"], _sum: { totalAmount: true }, where: { customerId: { in: customerIds } } }),
    db.customerPayment.groupBy({ by: ["customerId"], _sum: { amount: true }, where: { customerId: { in: customerIds }, direction: "RECEIVE" } }),
    db.customerPayment.groupBy({ by: ["customerId"], _sum: { amount: true }, where: { customerId: { in: customerIds }, direction: "PAY" } }),
  ])

  const saleMap = Object.fromEntries(saleTotals.map((r) => [r.customerId!, r._sum.totalAmount || 0]))
  const commMap = Object.fromEntries(commissionTotals.map((r) => [r.customerId!, r._sum.totalValue || 0]))
  const pestMap = Object.fromEntries(pesticideSaleTotals.map((r) => [r.customerId!, r._sum.totalAmount || 0]))
  const receivedMap = Object.fromEntries(receivedPayments.map((r) => [r.customerId, r._sum.amount || 0]))
  const paidMap = Object.fromEntries(paidPayments.map((r) => [r.customerId, r._sum.amount || 0]))

  const result = customers.map((c) => ({
    ...c,
    totalDebit: (saleMap[c.id] || 0) + (commMap[c.id] || 0) + (pestMap[c.id] || 0) + (paidMap[c.id] || 0),
    totalCredit: (receivedMap[c.id] || 0),
  }))

  return cachedJson({ customers: result })
}
