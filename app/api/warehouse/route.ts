import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Only this shop's godowns — without it every shop saw the other shops' godowns
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const warehouses = await db.warehouse.findMany({
    where: { ...shopFilter, isActive: true },
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
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const owned = await db.warehouse.findFirst({ where: { id: body.id, ...shopFilter }, select: { id: true } })
  if (!owned) return NextResponse.json({ error: "Godown not found" }, { status: 404 })
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

// Soft delete (isActive = false) so past lots, transfers and adjustments keep their godown.
// Admin-only: proxy.ts refuses DELETE for other roles.
export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "Godown id is required" }, { status: 400 })
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const owned = await db.warehouse.findFirst({ where: { id, ...shopFilter }, select: { id: true } })
  if (!owned) return NextResponse.json({ error: "Godown not found" }, { status: 404 })

  const [activeLots, stockedItems] = await Promise.all([
    db.lot.count({ where: { warehouseId: id, status: { notIn: ["SOLD", "DISPATCHED", "SETTLED", "CANCELLED"] } } }),
    db.warehouseStock.count({ where: { warehouseId: id, quantity: { gt: 0 } } }),
  ])
  if (activeLots || stockedItems) {
    return NextResponse.json({
      error: `This godown still holds ${activeLots} lot(s) and ${stockedItems} stocked item(s). Move or clear them before deleting.`,
    }, { status: 400 })
  }

  await db.warehouse.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}

