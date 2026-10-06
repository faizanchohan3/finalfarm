import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

// Bill Maker report: bills by bill date, optionally for one trader.
// GET /api/reports/bills?from=YYYY-MM-DD&to=YYYY-MM-DD&customerId=
// (search by name / bill no / ID / product is done on the page)
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const customerId = searchParams.get("customerId") || ""

  const billDate: any = {}
  if (from) billDate.gte = new Date(from)
  if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); billDate.lte = d }

  const bills = await db.bill.findMany({
    where: {
      ...(session.user.shopId ? { shopId: session.user.shopId } : {}),
      ...(from || to ? { billDate } : {}),
      ...(customerId ? { customerId } : {}),
    },
    orderBy: [{ billDate: "desc" }, { createdAt: "desc" }],
    take: 5000,
    select: {
      id: true, code: true, billNo: true, billDate: true, name: true, product: true, customerId: true,
      totalWeight: true, safiWeight: true, amount: true,
      customer: { select: { name: true, phone: true } },
    },
  })
  return NextResponse.json({ bills })
}
