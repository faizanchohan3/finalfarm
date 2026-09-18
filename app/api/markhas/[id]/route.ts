import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const existing = await db.markha.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (session.user.shopId && existing.shopId !== session.user.shopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Soft-delete so existing lots keep their markha name.
  await db.markha.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ success: true })
}
