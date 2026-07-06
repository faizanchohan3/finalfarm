import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { cachedJson } from "@/lib/api-cache"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const suppliers = await db.supplier.findMany({ where: { ...shopFilter, isActive: true }, orderBy: { name: "asc" } })

  // Calculate balance from supplier payments (ledger)
  const supplierIds = suppliers.map((s) => s.id)
  const [paidPayments, receivedPayments] = await Promise.all([
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
  ])

  const paidMap = Object.fromEntries(paidPayments.map((r) => [r.supplierId, r._sum.amount || 0]))
  const receivedMap = Object.fromEntries(receivedPayments.map((r) => [r.supplierId, r._sum.amount || 0]))

  const suppliersWithBalance = suppliers.map((s) => ({
    ...s,
    totalDebit: (paidMap[s.id] || 0),
    totalCredit: (receivedMap[s.id] || 0),
    ledgerBalance: (paidMap[s.id] || 0) - (receivedMap[s.id] || 0),
  }))

  return cachedJson({ suppliers: suppliersWithBalance })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { name, phone, address } = await req.json()
  const supplier = await db.supplier.create({ data: { shopId: session.user.shopId || null, name, phone, address } })
  return NextResponse.json({ supplier }, { status: 201 })
}

