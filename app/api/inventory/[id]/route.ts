import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { archiveDeleted, pkr } from "@/lib/recycle-bin"
import { recordCode } from "@/lib/record-code"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { name, categoryId, roomId, unit, minStock, purchasePrice, salePrice } = body

  const product = await db.product.update({
    where: { id },
    data: { name, categoryId, roomId: roomId || null, unit, minStock, purchasePrice, salePrice },
  })

  await createAuditLog({ userId: session.user.id, action: "UPDATE", module: "INVENTORY", details: `Updated product: ${name}` })

  return NextResponse.json({ product })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const p = await db.product.findUnique({ where: { id }, include: { category: true, room: true } })
  if (!p) return NextResponse.json({ error: "Product not found" }, { status: 404 })

  await db.$transaction(async (tx) => {
    // Keep a copy for the Deleted Records page (the product is only hidden, so restore just shows it again)
    const { category, room, ...row } = p
    await archiveDeleted(tx, session, {
      type: "PRODUCT", recordId: id, code: recordCode("product", p), title: p.name,
      amount: p.currentStock * p.purchasePrice,
      summary: [
        ["Product", p.name], ["Category", category?.name || "—"], ["Room", room?.name || "Unassigned"],
        ["Stock", `${p.currentStock} ${p.unit}`], ["Purchase price", pkr(p.purchasePrice)], ["Sale price", pkr(p.salePrice)],
        ["Stock value", pkr(p.currentStock * p.purchasePrice)],
      ],
      snapshot: { product: row },
    })
    await tx.product.update({ where: { id }, data: { isActive: false } })
  })
  await createAuditLog({ userId: session.user.id, action: "DELETE", module: "INVENTORY", details: `Deleted product ID: ${id}` })

  return NextResponse.json({ success: true })
}
