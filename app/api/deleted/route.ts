import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

// GET /api/deleted?type=BILL&q=text — deleted records of this shop, newest first
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type") || ""
  const q = (searchParams.get("q") || "").trim()
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const records = await db.deletedRecord.findMany({
    where: {
      ...shopFilter,
      ...(type ? { type } : {}),
      ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] } : {}),
    },
    select: {
      id: true, type: true, recordId: true, code: true, title: true, amount: true, summary: true,
      deletedByName: true, deletedAt: true, restoredAt: true, restoredByName: true,
    },
    orderBy: { deletedAt: "desc" },
    take: 500,
  })
  return NextResponse.json({ records })
}
