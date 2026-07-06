import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const pesticideId = searchParams.get("pesticideId")

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

  if (pesticideId) where.pesticideId = pesticideId
  if (session.user.shopId) where.shopId = session.user.shopId

  const sales = await db.pesticideSale.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      pesticide: { select: { id: true, name: true, unit: true } },
      customer: { select: { id: true, name: true, phone: true } },
      farmer: { select: { id: true, name: true, phone: true } },
      soldBy: { select: { name: true } },
    },
  })

  const totalAmount = sales.reduce((s, r) => s + r.totalAmount, 0)
  const totalPaid = sales.reduce((s, r) => s + r.paidAmount, 0)
  const totalBalance = sales.reduce((s, r) => s + r.balance, 0)

  return NextResponse.json({ sales, totalAmount, totalPaid, totalBalance })
}

