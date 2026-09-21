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
      // Lots currently stored in this godown (not yet sold/dispatched/settled/cancelled)
      lots: {
        where: { status: { notIn: ["SOLD", "DISPATCHED", "SETTLED", "CANCELLED"] } },
        orderBy: { createdAt: "desc" },
        include: {
          category: { select: { name: true } },
          farmer: { select: { name: true } },
        },
      },
    },
  })

  const result = warehouses.map((w) => ({
    ...w,
    totalItems: w.stock.length,
    totalValue: w.stock.reduce((s, i) => s + i.quantity * (i.purchasePrice || i.product.purchasePrice), 0),
    lotCount: w.lots.length,
    lotBags: w.lots.reduce((s, l) => s + (l.bags || 0), 0),
  }))

  return NextResponse.json({ warehouses: result })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: "Godown name is required" }, { status: 400 })
  try {
    const warehouse = await db.warehouse.create({
      data: {
        shopId: session.user.shopId || null,
        name: body.name.trim(),
        location: body.location || null,
        capacity: body.capacity || null,
        manager: body.manager || null,
        isPotato: !!body.isPotato,
      },
    })
    return NextResponse.json({ warehouse })
  } catch (err: any) {
    console.error("Godown create error:", err)
    return NextResponse.json({ error: err?.message || "Failed to create godown" }, { status: 500 })
  }
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
      isPotato: !!body.isPotato,
    },
  })
  return NextResponse.json({ warehouse })
}

