import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const includeInactive = searchParams.get("all") === "1"
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const commodities = await db.commodity.findMany({
    where: { ...shopFilter, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: { name: "asc" },
  })

  return NextResponse.json({ commodities })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "Commodity name is required." }, { status: 400 })
  }

  const commodity = await db.commodity.create({
    data: {
      shopId: session.user.shopId || null,
      name: body.name.trim(),
      unit: body.unit?.trim() || "KG",
      standardWeight: body.standardWeight != null && body.standardWeight !== "" ? parseFloat(body.standardWeight) : null,
      marketRate: parseFloat(body.marketRate) || 0,
      notes: body.notes?.trim() || null,
    },
  })

  return NextResponse.json({ commodity })
}
