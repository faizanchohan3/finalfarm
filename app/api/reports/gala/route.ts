import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { galaPartyInclude } from "@/lib/gala"

// Gala Mandi report: entries by entry date, optionally for one buyer and / or one seller.
// GET /api/reports/gala?from=YYYY-MM-DD&to=YYYY-MM-DD&buyer=supplier_<id>|customer_<id>&seller=customer_<id>|farmer_<id>|supplier_<id>
// (search by name / entry no / ID / product is done on the page)
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const buyer = searchParams.get("buyer") || ""
  const seller = searchParams.get("seller") || ""

  const entryDate: any = {}
  if (from) entryDate.gte = new Date(from)
  if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); entryDate.lte = d }

  const entries = await db.galaEntry.findMany({
    where: {
      ...(session.user.shopId ? { shopId: session.user.shopId } : {}),
      ...(from || to ? { entryDate } : {}),
      ...(buyer.startsWith("customer_") ? { customerId: buyer.slice(9) } : {}),
      ...(buyer.startsWith("supplier_") ? { buyerSupplierId: buyer.slice(9) } : {}),
      ...(seller.startsWith("customer_") ? { sellerCustomerId: seller.slice(9) } : {}),
      ...(seller.startsWith("farmer_") ? { farmerId: seller.slice(7) } : {}),
      ...(seller.startsWith("supplier_") ? { supplierId: seller.slice(9) } : {}),
    },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: 5000,
    include: galaPartyInclude,
  })
  return NextResponse.json({ entries })
}
