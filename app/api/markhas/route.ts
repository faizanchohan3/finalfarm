import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const markhas = await db.markha.findMany({
    where: { ...shopFilter, isActive: true },
    orderBy: { name: "asc" },
  })
  return NextResponse.json({ markhas })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { name, slot } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: "Markha name is required" }, { status: 400 })
    const markhaSlot = Number(slot) === 2 ? 2 : 1

    // A name may live in only one list: Markha 1 items can't be in Markha 2 and vice versa.
    const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
    const existing = await db.markha.findFirst({
      where: { ...shopFilter, isActive: true, name: { equals: name.trim(), mode: "insensitive" } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `"${existing.name}" already exists in Markha ${existing.slot}` },
        { status: 409 },
      )
    }

    const markha = await db.markha.create({
      data: { shopId: session.user.shopId ?? null, name: name.trim(), slot: markhaSlot },
    })
    return NextResponse.json({ markha }, { status: 201 })
  } catch (err: any) {
    console.error("Markha create error:", err)
    return NextResponse.json({ error: err?.message || "Failed to create markha" }, { status: 500 })
  }
}
