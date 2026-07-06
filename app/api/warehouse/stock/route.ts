import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const warehouseId = searchParams.get("warehouseId")

  const stock = await db.warehouseStock.findMany({
    where: warehouseId ? { warehouseId } : undefined,
    include: {
      product: { select: { name: true, unit: true, purchasePrice: true } },
      warehouse: { select: { name: true } },
    },
    orderBy: { receivedAt: "desc" },
  })

  return NextResponse.json({ stock })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const stock = await db.warehouseStock.create({
    data: {
      warehouseId: body.warehouseId,
      productId: body.productId,
      batchNumber: body.batchNumber || null,
      lotNumber: body.lotNumber || null,
      quantity: body.quantity,
      purchasePrice: body.purchasePrice || null,
    },
  })
  return NextResponse.json({ stock })
}
