import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { cachedJson } from "@/lib/api-cache"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const categories = await db.pesticideCategory.findMany({ where: shopFilter, orderBy: { name: "asc" } })
  return cachedJson({ categories })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { name } = await req.json()
  const category = await db.pesticideCategory.create({ data: { name, shopId: session.user.shopId || null } })
  return NextResponse.json({ category }, { status: 201 })
}
