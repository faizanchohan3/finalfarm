import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const existing = await db.commodity.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Commodity not found" }, { status: 404 })
  if (session.user.shopId && existing.shopId !== session.user.shopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const data: any = {}
  if (body.name != null) data.name = String(body.name).trim()
  if (body.unit != null) data.unit = String(body.unit).trim() || "KG"
  if ("standardWeight" in body) data.standardWeight = body.standardWeight !== "" && body.standardWeight != null ? parseFloat(body.standardWeight) : null
  if ("marketRate" in body) data.marketRate = parseFloat(body.marketRate) || 0
  if ("notes" in body) data.notes = body.notes?.trim() || null
  if ("isActive" in body) data.isActive = !!body.isActive

  const commodity = await db.commodity.update({ where: { id }, data })
  return NextResponse.json({ commodity })
}

// Soft-delete: deactivate rather than remove, to keep historical references intact.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const existing = await db.commodity.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Commodity not found" }, { status: 404 })
  if (session.user.shopId && existing.shopId !== session.user.shopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await db.commodity.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ success: true })
}
