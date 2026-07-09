import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { cachedJson } from "@/lib/api-cache"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const farmers = await db.farmer.findMany({
    where: { ...shopFilter, isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { purchases: true } },
    },
  })

  return cachedJson({ farmers })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const farmer = await db.farmer.create({
    data: {
      shopId: session.user.shopId || null,
      name: body.name,
      phone: body.phone || null,
      address: body.address || null,
      village: body.village || null,
      cnic: body.cnic || null,
      creditLimit: body.creditLimit || 0,
    },
  })
  return NextResponse.json({ farmer })
}

