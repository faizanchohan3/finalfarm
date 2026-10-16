import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { ADMIN_ONLY_DELETE, canDelete } from "@/lib/permissions"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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
        where: { ...shopFilter, status: { notIn: ["SOLD", "DISPATCHED", "SETTLED", "CANCELLED"] } },
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
  const owned = await db.warehouse.findFirst({
    where: { id: body.id, ...(session.user.shopId ? { shopId: session.user.shopId } : {}) },
    select: { id: true },
  })
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


// Admin only (also enforced for every DELETE by proxy.ts). Godowns are hidden, not erased, so old
// transfers, adjustments and lots keep their godown name. Refused while anything is still stored in it.
export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canDelete(session.user.role)) return NextResponse.json({ error: ADMIN_ONLY_DELETE }, { status: 403 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: "Godown id is required" }, { status: 400 })

  const warehouse = await db.warehouse.findFirst({
    where: { id, isActive: true, ...(session.user.shopId ? { shopId: session.user.shopId } : {}) },
    select: { id: true, name: true },
  })
  if (!warehouse) return NextResponse.json({ error: "Godown not found" }, { status: 404 })

  const [lotsStored, stockLeft, pendingTransfers] = await Promise.all([
    db.lot.count({ where: { warehouseId: id, status: { notIn: ["SOLD", "DISPATCHED", "SETTLED", "CANCELLED"] } } }),
    db.warehouseStock.count({ where: { warehouseId: id, quantity: { gt: 0 } } }),
    db.stockTransfer.count({ where: { status: "PENDING", OR: [{ fromWarehouseId: id }, { toWarehouseId: id }] } }),
  ])
  if (lotsStored || stockLeft || pendingTransfers) {
    const parts = [
      lotsStored && `${lotsStored} lot(s) stored`,
      stockLeft && `${stockLeft} item(s) in stock`,
      pendingTransfers && `${pendingTransfers} pending transfer(s)`,
    ].filter(Boolean).join(", ")
    return NextResponse.json({ error: `Cannot delete "${warehouse.name}": it still has ${parts}. Move or clear them first.` }, { status: 400 })
  }

  await db.warehouse.update({ where: { id }, data: { isActive: false } })
  await createAuditLog({
    userId: session.user.id, shopId: session.user.shopId, action: "DELETE", module: "WAREHOUSE",
    details: `Deleted godown: ${warehouse.name}`,
  })
  return NextResponse.json({ success: true })
}
