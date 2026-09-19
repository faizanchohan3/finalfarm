import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { name, categoryId, manufacturer, batchNumber, expiryDate, quantity, unit, purchasePrice, salePrice, incentive, minStock } = body

  const pesticide = await db.pesticide.update({
    where: { id },
    data: {
      name, categoryId, manufacturer, batchNumber,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      quantity, unit, purchasePrice, salePrice, incentive: incentive || 0, minStock,
    },
  })

  await createAuditLog({ userId: session.user.id, action: "UPDATE", module: "PESTICIDES", details: `Updated pesticide: ${name}` })

  return NextResponse.json({ pesticide })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await db.pesticide.update({ where: { id }, data: { isActive: false } })
  await createAuditLog({ userId: session.user.id, action: "DELETE", module: "PESTICIDES", details: `Deleted pesticide ID: ${id}` })

  return NextResponse.json({ success: true })
}
