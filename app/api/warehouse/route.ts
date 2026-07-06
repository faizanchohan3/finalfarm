import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const warehouses = await db.warehouse.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      stock: {
        include: { product: { select: { name: true, unit: true, purchasePrice: true } } },
      },
    },
  })

  const result = warehouses.map((w) => ({
    ...w,
    totalItems: w.stock.length,
    totalValue: w.stock.reduce((s, i) => s + i.quantity * (i.purchasePrice || i.product.purchasePrice), 0),
  }))

  return NextResponse.json({ warehouses: result })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const warehouse = await db.warehouse.create({
    data: {
      name: body.name,
      location: body.location || null,
      capacity: body.capacity || null,
      manager: body.manager || null,
    },
  })
  return NextResponse.json({ warehouse })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const warehouse = await db.warehouse.update({
    where: { id: body.id },
    data: {
      name: body.name,
      location: body.location || null,
      capacity: body.capacity || null,
      manager: body.manager || null,
    },
  })
  return NextResponse.json({ warehouse })
}
