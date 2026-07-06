import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { cachedJson } from "@/lib/api-cache"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const categories = await db.category.findMany({ where: shopFilter, orderBy: { name: "asc" } })
  return cachedJson({ categories })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, description } = await req.json()
  const category = await db.category.create({ data: { shopId: session.user.shopId || null, name, description } })
  return NextResponse.json({ category }, { status: 201 })
}

