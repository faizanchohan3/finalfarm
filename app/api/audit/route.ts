import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["SUPER_ADMIN", "ADMIN", "AUDITOR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "50")
  const module = searchParams.get("module")
  const skip = (page - 1) * limit
  // Older log rows have no shopId, so also match on the shop of the user who made them
  const shopId = session.user.shopId
  const where: any = {
    ...(module ? { module } : {}),
    ...(shopId ? { OR: [{ shopId }, { shopId: null, user: { shopId } }] } : {}),
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      skip,
      take: limit,
      where,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, email: true } } },
    }),
    db.auditLog.count({ where }),
  ])

  return NextResponse.json({ logs, total, page, limit })
}

