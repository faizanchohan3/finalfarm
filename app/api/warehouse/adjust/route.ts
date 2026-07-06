import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const adjustments = await db.stockAdjustment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { name: true, unit: true } },
      warehouse: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  })

  return NextResponse.json({ adjustments })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const adjustNo = `ADJ-${Date.now()}`

  const adjustment = await db.$transaction(async (tx) => {
    const adj = await tx.stockAdjustment.create({
      data: {
        adjustNo,
        warehouseId: body.warehouseId || null,
        productId: body.productId,
        type: body.type,
        quantity: body.quantity,
        reason: body.reason || null,
        createdById: session.user!.id!,
      },
    })

    // Apply to main product stock
    const delta = body.type === "DECREASE" ? -body.quantity : body.quantity
    await tx.product.update({
      where: { id: body.productId },
      data: { currentStock: { increment: delta } },
    })

    // Apply to warehouse stock if specified
    if (body.warehouseId) {
      const ws = await tx.warehouseStock.findFirst({
        where: { warehouseId: body.warehouseId, productId: body.productId },
      })
      if (ws) {
        await tx.warehouseStock.update({
          where: { id: ws.id },
          data: { quantity: { increment: delta } },
        })
      }
    }

    return adj
  })

  return NextResponse.json({ adjustment })
}
