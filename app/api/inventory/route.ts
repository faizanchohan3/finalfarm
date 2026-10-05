import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { cachedJson } from "@/lib/api-cache"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const products = await db.product.findMany({
    where: { ...shopFilter, isActive: true },
    include: { category: true, room: true },
    orderBy: { name: "asc" },
  })

  // Total purchase amount per product — every stock-in entry from the stock ledger:
  // opening stock, purchases and manual adds (at the price entered, else the purchase price)
  const ids = products.map((p) => p.id)
  const price = Object.fromEntries(products.map((p) => [p.id, p.purchasePrice || 0]))
  const [openings, purchaseTotals, adds] = await Promise.all([
    db.stockMovement.findMany({ where: { productId: { in: ids }, reference: "Opening Stock" }, select: { productId: true, quantity: true } }),
    db.purchaseItem.groupBy({ by: ["productId"], _sum: { total: true }, where: { productId: { in: ids }, purchase: { status: { not: "CANCELLED" } } } }),
    db.stockAdjustment.findMany({ where: { productId: { in: ids }, type: { not: "DECREASE" } }, select: { productId: true, quantity: true, rate: true } }),
  ])
  const purchaseAmount: Record<string, number> = {}
  const addTo = (id: string, v: number) => { purchaseAmount[id] = (purchaseAmount[id] || 0) + v }
  for (const m of openings) addTo(m.productId, m.quantity * price[m.productId])
  for (const r of purchaseTotals) addTo(r.productId, r._sum.total || 0)
  for (const a of adds) addTo(a.productId, a.quantity * (a.rate ?? price[a.productId]))

  return cachedJson({ products: products.map((p) => ({ ...p, purchaseAmount: purchaseAmount[p.id] || 0 })) })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { name, categoryId, roomId, unit, currentStock, minStock, purchasePrice, salePrice } = body

  const product = await db.product.create({
    data: { shopId: session.user.shopId || null, name, categoryId, roomId: roomId || null, unit, currentStock, minStock, purchasePrice, salePrice },
  })

  if (currentStock > 0) {
    await db.stockMovement.create({
      data: { productId: product.id, type: "IN", quantity: currentStock, reference: "Opening Stock" },
    })
  }

  await createAuditLog({ userId: session.user.id, shopId: session.user.shopId, action: "CREATE", module: "INVENTORY", details: `Created product: ${name}` })

  return NextResponse.json({ product }, { status: 201 })
}

