import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

const lotInclude = {
  farmer: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  warehouse: { select: { id: true, name: true } },
  buyer: { select: { id: true, name: true } },
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const existing = await db.lot.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Lot not found" }, { status: 404 })
  if (session.user.shopId && existing.shopId !== session.user.shopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const data: any = {}

  if (body.status) data.status = body.status
  if ("warehouseId" in body) data.warehouseId = body.warehouseId || null
  if ("farmerId" in body) data.farmerId = body.farmerId || null
  if ("grade" in body) data.grade = body.grade?.trim() || null
  if ("notes" in body) data.notes = body.notes?.trim() || null
  if ("bags" in body) data.bags = body.bags !== "" && body.bags != null ? parseInt(body.bags) : null

  // Recompute net weight if gross/tare edited
  const gross = "grossWeight" in body ? (body.grossWeight !== "" && body.grossWeight != null ? parseFloat(body.grossWeight) : null) : existing.grossWeight
  const tare = "tareWeight" in body ? (body.tareWeight !== "" && body.tareWeight != null ? parseFloat(body.tareWeight) : null) : existing.tareWeight
  if ("grossWeight" in body || "tareWeight" in body) {
    data.grossWeight = gross
    data.tareWeight = tare
    data.netWeight = gross != null ? gross - (tare || 0) : existing.netWeight
  }

  // Sale details (typically when marking SOLD)
  if ("buyerId" in body) data.buyerId = body.buyerId || null
  if ("saleRate" in body) data.saleRate = body.saleRate !== "" && body.saleRate != null ? parseFloat(body.saleRate) : null
  if ("paymentStatus" in body) data.paymentStatus = body.paymentStatus

  if ("saleAmount" in body && body.saleAmount !== "" && body.saleAmount != null) {
    data.saleAmount = parseFloat(body.saleAmount)
  } else if (data.saleRate != null) {
    // Derive amount from rate × net weight when an explicit amount isn't given
    const netForCalc = data.netWeight ?? existing.netWeight
    if (netForCalc != null) data.saleAmount = data.saleRate * netForCalc
  }

  if (body.status === "SOLD" && !existing.soldAt) data.soldAt = new Date()

  const lot = await db.lot.update({ where: { id }, data, include: lotInclude })
  return NextResponse.json({ lot })
}

// Cancel rather than hard-delete, preserving the record.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const existing = await db.lot.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Lot not found" }, { status: 404 })
  if (session.user.shopId && existing.shopId !== session.user.shopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await db.lot.update({ where: { id }, data: { status: "CANCELLED" } })
  return NextResponse.json({ success: true })
}
