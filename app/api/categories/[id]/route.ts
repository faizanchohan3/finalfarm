import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const category = await db.category.findFirst({ where: { id, ...shopFilter } })
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await db.category.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const category = await db.category.findFirst({ where: { id, ...shopFilter } })
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { name, description } = await req.json()
  const updated = await db.category.update({ where: { id }, data: { name, description } })
  return NextResponse.json({ category: updated })
}
