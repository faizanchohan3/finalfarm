mport { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { cachedJson } from "@/lib/api-cache"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const banks = await db.bank.findMany({
    where: { ...shopFilter, isActive: true },
    orderBy: { name: "asc" },
  })
  return cachedJson({ banks })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { name, accountNumber } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: "Bank name is required" }, { status: 400 })

    const bank = await db.bank.create({
      data: {
        shopId: session.user.shopId ?? null,
        name: name.trim(),
        accountNumber: accountNumber?.trim() || null,
      },
    })
    return NextResponse.json({ bank }, { status: 201 })
  } catch (err: any) {
    console.error("Bank create error:", err)
    return NextResponse.json({ error: err?.message || "Failed to create bank" }, { status: 500 })
  }
}

