import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const room = await db.room.findFirst({ where: { id, ...shopFilter } })
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await db.room.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const room = await db.room.findFirst({ where: { id, ...shopFilter } })
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { name } = await req.json()
  const updated = await db.room.update({ where: { id }, data: { name } })
  return NextResponse.json({ room: updated })
}
