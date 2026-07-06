import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const agents = await db.commissionAgent.findMany({
    where: { ...shopFilter, isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { commissions: true } },
      commissions: { select: { amount: true, type: true } },
    },
  })

  const result = agents.map((a) => ({
    ...a,
    totalEarned: a.commissions.filter((c) => c.type === "CREDIT").reduce((s, c) => s + c.amount, 0),
    totalPaid: a.commissions.filter((c) => c.type === "DEBIT").reduce((s, c) => s + c.amount, 0),
  }))

  return NextResponse.json({ agents: result })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const agent = await db.commissionAgent.create({
    data: {
      shopId: session.user.shopId || null,
      name: body.name,
      phone: body.phone || null,
      address: body.address || null,
      cnic: body.cnic || null,
      commissionRate: body.commissionRate || 2.5,
    },
  })
  return NextResponse.json({ agent })
}
