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
    include: { category: true },
    orderBy: { name: "asc" },
  })

  return cachedJson({ products })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { name, categoryId, unit, currentStock, minStock, purchasePrice, salePrice } = body

  const product = await db.product.create({
    data: { shopId: session.user.shopId || null, name, categoryId, unit, currentStock, minStock, purchasePrice, salePrice },
  })

  if (currentStock > 0) {
    await db.stockMovement.create({
      data: { productId: product.id, type: "IN", quantity: currentStock, reference: "Opening Stock" },
    })
  }

  await createAuditLog({ userId: session.user.id, shopId: session.user.shopId, action: "CREATE", module: "INVENTORY", details: `Created product: ${name}` })

  return NextResponse.json({ product }, { status: 201 })
}

