mport { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const supplierId = searchParams.get("supplierId")

  const where: any = {}

  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      where.createdAt.lte = toDate
    }
  }

  if (supplierId && supplierId !== "all") where.supplierId = supplierId
  if (session.user.shopId) where.shopId = session.user.shopId

  const purchases = await db.purchase.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      supplier: { select: { name: true, phone: true } },
      items: { include: { product: { select: { name: true, unit: true } } } },
      createdBy: { select: { name: true } },
    },
  })

  const totalAmount = purchases.reduce((s, x) => s + x.totalAmount, 0)
  const totalPaid = purchases.reduce((s, x) => s + x.paidAmount, 0)
  const totalBalance = purchases.reduce((s, x) => s + x.balance, 0)

  return NextResponse.json({ purchases, totalAmount, totalPaid, totalBalance })
}

