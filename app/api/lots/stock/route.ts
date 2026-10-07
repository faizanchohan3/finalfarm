import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

// Potato Store stock to sell from, per product: every stored lot with bags left (bags − soldBags).
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const lots = await db.lot.findMany({
    where: { ...shopFilter, status: { in: ["ARRIVED", "STORED"] }, bags: { gt: 0 } },
    orderBy: { createdAt: "asc" },
    include: {
      category: { select: { id: true, name: true } },
      farmer: { select: { id: true, name: true } },
      warehouse: { select: { id: true, name: true } },
    },
  })

  type Product = { categoryId: string; name: string; lots: any[]; bags: number; left: number; sold: number }
  const byProduct = new Map<string, Product>()
  for (const l of lots) {
    const left = (l.bags || 0) - (l.soldBags || 0)
    if (left <= 0) continue
    const key = l.categoryId || "none"
    const p = byProduct.get(key) ?? { categoryId: key, name: l.category?.name || "Uncategorised", lots: [], bags: 0, left: 0, sold: 0 }
    p.lots.push({
      id: l.id, lotNo: l.lotNo, farmer: l.farmer?.name || null, farmerId: l.farmerId, warehouse: l.warehouse?.name || null,
      markha: [l.markha1, l.markha2].filter(Boolean).join(" / ") || null,
      markhas: [l.markha1, l.markha2].map((m) => (m || "").trim()).filter(Boolean),
      bagType: l.bagType || "bori",
      bags: l.bags, soldBags: l.soldBags, left, netWeight: l.netWeight, createdAt: l.createdAt,
    })
    p.bags += l.bags || 0
    p.sold += l.soldBags || 0
    p.left += left
    byProduct.set(key, p)
  }
  return NextResponse.json({ products: Array.from(byProduct.values()).sort((a, b) => a.name.localeCompare(b.name)) })
}
