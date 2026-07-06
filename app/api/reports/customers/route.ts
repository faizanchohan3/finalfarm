mport { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const customers = await db.customer.findMany({
    where: { isActive: true, ...shopFilter },
    include: {
      sales: { select: { totalAmount: true, paidAmount: true, balance: true } },
    },
    orderBy: { name: "asc" },
  })

  const result = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    address: c.address,
    totalBusiness: c.sales.reduce((s, x) => s + x.totalAmount, 0),
    totalPaid: c.sales.reduce((s, x) => s + x.paidAmount, 0),
    totalBalance: c.sales.reduce((s, x) => s + x.balance, 0),
    saleCount: c.sales.length,
  }))

  return NextResponse.json({ customers: result })
}

