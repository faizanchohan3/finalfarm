import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")
  const skip = (page - 1) * limit
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const [sales, total] = await Promise.all([
    db.sale.findMany({
      skip,
      take: limit,
      where: shopFilter,
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        farmer: { select: { id: true, name: true, phone: true } },
        createdBy: { select: { name: true } },
        items: { include: { product: true } },
      },
    }),
    db.sale.count({ where: shopFilter }),
  ])

  return NextResponse.json({ sales, total, page, limit })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { customerId, farmerId, items, paidAmount, notes, saleDate } = body

  const totalAmount = items.reduce((s: number, i: any) => s + i.quantity * i.price, 0)
  const balance = totalAmount - (paidAmount || 0)
  const status = balance <= 0 ? "PAID" : paidAmount > 0 ? "PARTIAL" : "PENDING"

  // Credit limit check
  if (customerId) {
    const customer = await db.customer.findUnique({ where: { id: customerId }, select: { creditLimit: true, balance: true, name: true } })
    if (customer && customer.creditLimit > 0) {
      const newBalance = (customer.balance || 0) + balance
      if (newBalance > customer.creditLimit) {
        return NextResponse.json(
          { error: `Credit limit exceeded for ${customer.name}. Limit: PKR ${customer.creditLimit.toLocaleString()}, Current outstanding: PKR ${(customer.balance || 0).toLocaleString()}, This sale balance: PKR ${balance.toLocaleString()}` },
          { status: 422 }
        )
      }
    }
  }

  // Stock check before transaction
  const productIds = items.map((i: any) => i.productId)
  const products = await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, currentStock: true } })
  for (const item of items) {
    const prod = products.find((p) => p.id === item.productId)
    if (!prod) return NextResponse.json({ error: `Product not found` }, { status: 400 })
    if (prod.currentStock < item.quantity) {
      return NextResponse.json(
        { error: `Insufficient stock for "${prod.name}". Available: ${prod.currentStock}, Requested: ${item.quantity}` },
        { status: 422 }
      )
    }
  }

  const sale = await db.$transaction(async (tx) => {
    const s = await tx.sale.create({
      data: {
        shopId: session.user.shopId || null,
        customerId: customerId || null,
        farmerId: farmerId || null,
        totalAmount,
        paidAmount: paidAmount || 0,
        balance,
        status,
        notes,
        createdById: session.user.id,
        createdAt: saleDate ? new Date(saleDate) : new Date(),
        items: {
          create: items.map((i: any) => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price,
            total: i.quantity * i.price,
          })),
        },
      },
      include: { items: true },
    })

    if (paidAmount && paidAmount > 0) {
      await tx.payment.create({
        data: { saleId: s.id, amount: paidAmount, method: body.paymentMethod || "CASH", notes: "Initial payment at sale" },
      })
    }

    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { currentStock: { decrement: item.quantity } },
      })
      await tx.stockMovement.create({
        data: { productId: item.productId, type: "OUT", quantity: item.quantity, reference: `Sale #${s.id}` },
      })
    }

    return s
  })

  await createAuditLog({ userId: session.user.id, shopId: session.user.shopId, action: "CREATE", module: "SALES", details: `Created sale: PKR ${totalAmount.toLocaleString()}` })

  return NextResponse.json({ sale }, { status: 201 })
}
