import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

// Gala Mandi report: entries by entry date, optionally for one buyer and / or one seller.
// GET /api/reports/gala?from=YYYY-MM-DD&to=YYYY-MM-DD&customerId=&seller=farmer_<id>|supplier_<id>
// (search by name / entry no / ID / product is done on the page)
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const customerId = searchParams.get("customerId") || ""
  const seller = searchParams.get("seller") || ""

  const entryDate: any = {}
  if (from) entryDate.gte = new Date(from)
  if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); entryDate.lte = d }

  const entries = await db.galaEntry.findMany({
    where: {
      ...(session.user.shopId ? { shopId: session.user.shopId } : {}),
      ...(from || to ? { entryDate } : {}),
      ...(customerId ? { customerId } : {}),
      ...(seller.startsWith("farmer_") ? { farmerId: seller.slice(7) } : {}),
      ...(seller.startsWith("supplier_") ? { supplierId: seller.slice(9) } : {}),
    },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: 5000,
    include: {
      customer: { select: { name: true } },
      farmer: { select: { name: true } },
      supplier: { select: { name: true } },
    },
  })
  return NextResponse.json({ entries })
}
