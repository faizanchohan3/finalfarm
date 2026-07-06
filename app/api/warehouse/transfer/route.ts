import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const transfers = await db.stockTransfer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      fromWarehouse: { select: { name: true } },
      toWarehouse: { select: { name: true } },
      product: { select: { name: true, unit: true } },
      createdBy: { select: { name: true } },
    },
  })

  return NextResponse.json({ transfers })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const transferNo = `TRF-${Date.now()}`

    // Create as PENDING — stock is NOT moved until approved
    const transfer = await db.stockTransfer.create({
      data: {
        transferNo,
        fromWarehouseId: body.fromWarehouseId,
        toWarehouseId: body.toWarehouseId,
        productId: body.productId,
        quantity: body.quantity,
        batchNumber: body.batchNumber || null,
        status: "PENDING",
        notes: body.notes || null,
        createdById: session.user!.id!,
      },
      include: {
        fromWarehouse: { select: { name: true } },
        toWarehouse: { select: { name: true } },
        product: { select: { name: true, unit: true } },
        createdBy: { select: { name: true } },
      },
    })

    return NextResponse.json({ transfer })
  } catch (err: any) {
    console.error("Transfer create error:", err)
    return NextResponse.json({ error: err?.message || "Failed to create transfer" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { transferId } = await req.json()
    if (!transferId) return NextResponse.json({ error: "transferId required" }, { status: 400 })

    const existing = await db.stockTransfer.findUnique({ where: { id: transferId } })
    if (!existing) return NextResponse.json({ error: "Transfer not found" }, { status: 404 })
    if (existing.status !== "PENDING") return NextResponse.json({ error: "Transfer is already approved" }, { status: 400 })

    await db.$transaction(async (tx) => {
      // Mark as approved
      await tx.stockTransfer.update({ where: { id: transferId }, data: { status: "APPROVED" } })

      // Deduct from source warehouse stock
      const fromStock = await tx.warehouseStock.findFirst({
        where: { warehouseId: existing.fromWarehouseId, productId: existing.productId },
      })
      if (fromStock) {
        await tx.warehouseStock.update({
          where: { id: fromStock.id },
          data: { quantity: { decrement: existing.quantity } },
        })
      }

      // Add to destination warehouse stock
      const toStock = await tx.warehouseStock.findFirst({
        where: { warehouseId: existing.toWarehouseId, productId: existing.productId },
      })
      if (toStock) {
        await tx.warehouseStock.update({
          where: { id: toStock.id },
          data: { quantity: { increment: existing.quantity } },
        })
      } else {
        await tx.warehouseStock.create({
          data: {
            warehouseId: existing.toWarehouseId,
            productId: existing.productId,
            quantity: existing.quantity,
            batchNumber: existing.batchNumber || null,
          },
        })
      }

      // Deduct from main product inventory
      await tx.product.update({
        where: { id: existing.productId },
        data: { currentStock: { decrement: existing.quantity } },
      })
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Transfer approve error:", err)
    return NextResponse.json({ error: err?.message || "Failed to approve transfer" }, { status: 500 })
  }
}
