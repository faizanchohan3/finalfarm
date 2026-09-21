import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { cachedJson } from "@/lib/api-cache"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const rooms = await db.room.findMany({ where: shopFilter, orderBy: { name: "asc" } })
  return cachedJson({ rooms })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name } = await req.json()
  const room = await db.room.create({ data: { shopId: session.user.shopId || null, name } })
  return NextResponse.json({ room }, { status: 201 })
}
