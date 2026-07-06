import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const saleItemDateFilter: any = {}
  if (from || to) {
    saleItemDateFilter.sale = { createdAt: {} }
    if (from) saleItemDateFilter.sale.createdAt.gte = new Date(from)
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      saleItemDateFilter.sale.createdAt.lte = toDate
    }
  }

  const products = await db.product.findMany({
    where: { ...shopFilter, isActive: true },
    include: {
      category: { select: { name: true } },
      saleItems: {
        where: Object.keys(saleItemDateFilter).length ? saleItemDateFilter : undefined,
        select: { quantity: true, total: true, price: true },
      },
    },
    orderBy: { name: "asc" },
  })

  const result = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category?.name || "Uncategorized",
    unit: p.unit,
    currentStock: p.currentStock,
    minStock: p.minStock,
    purchasePrice: p.purchasePrice,
    salePrice: p.salePrice,
    stockValue: p.currentStock * p.purchasePrice,
    totalQtySold: p.saleItems.reduce((s, i) => s + i.quantity, 0),
    totalSaleAmount: p.saleItems.reduce((s, i) => s + i.total, 0),
    salesCount: p.saleItems.length,
    isLowStock: p.currentStock <= p.minStock,
    margin: p.salePrice > 0 ? ((p.salePrice - p.purchasePrice) / p.salePrice) * 100 : 0,
  }))

  const totals = {
    totalProducts: result.length,
    totalStockValue: result.reduce((s, p) => s + p.stockValue, 0),
    totalSaleAmount: result.reduce((s, p) => s + p.totalSaleAmount, 0),
    totalQtySold: result.reduce((s, p) => s + p.totalQtySold, 0),
    lowStockCount: result.filter((p) => p.isLowStock).length,
  }

  return NextResponse.json({ products: result, totals })
}
