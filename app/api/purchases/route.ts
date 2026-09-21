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
  const [purchases, total] = await Promise.all([
    db.purchase.findMany({
      skip,
      take: limit,
      where: shopFilter,
      orderBy: { createdAt: "desc" },
      include: {
        supplier: true,
        farmer: { select: { id: true, name: true, phone: true } },
        sellerCustomer: { select: { id: true, name: true, phone: true } },
        room: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        items: { include: { product: true } },
      },
    }),
    db.purchase.count({ where: shopFilter }),
  ])

  return NextResponse.json({ purchases, total })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { supplierId, farmerId, sellerCustomerId, walkinSeller, items, paidAmount, notes, purchaseDate, roomId, roomName } = body

  const totalAmount = items.reduce((s: number, i: any) => s + i.quantity * i.price, 0)
  const balance = totalAmount - (paidAmount || 0)
  const status = balance <= 0 ? "PAID" : paidAmount > 0 ? "PARTIAL" : "PENDING"

  const purchase = await db.$transaction(async (tx) => {
    // Room: pick an existing one by id, or a typed name (reused if it exists, otherwise created).
    const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
    let resolvedRoomId: string | null = null
    if (roomId) {
      const room = await tx.room.findFirst({ where: { id: roomId, ...shopFilter } })
      if (!room) throw new Error("Room not found")
      resolvedRoomId = room.id
    } else if (typeof roomName === "string" && roomName.trim()) {
      const name = roomName.trim()
      const room =
        (await tx.room.findFirst({ where: { ...shopFilter, name: { equals: name, mode: "insensitive" } } })) ??
        (await tx.room.create({ data: { shopId: session.user.shopId || null, name } }))
      resolvedRoomId = room.id
    }

    // Resolve custom product names to real productIds
    const resolvedItems = await Promise.all(items.map(async (i: any) => {
      if (i.productId) return i
      if (!i.customName) throw new Error("Product name is required")
      const shopId = session.user.shopId || null

      // Find or create a "General" category
      let category = await tx.category.findFirst({ where: { shopId, name: "General" } })
      if (!category) {
        category = await tx.category.create({ data: { shopId, name: "General" } })
      }

      // Find or create the product by name
      let product = await tx.product.findFirst({ where: { shopId, name: i.customName } })
      if (!product) {
        product = await tx.product.create({
          data: { shopId, name: i.customName, categoryId: category.id, purchasePrice: i.price, salePrice: i.price },
        })
      }
      return { ...i, productId: product.id }
    }))

    const p = await tx.purchase.create({
      data: {
        shopId: session.user.shopId || null,
        supplierId: supplierId || null,
        farmerId: farmerId || null,
        sellerCustomerId: sellerCustomerId || null,
        walkinSeller: walkinSeller || null,
        roomId: resolvedRoomId,
        totalAmount,
        paidAmount: paidAmount || 0,
        balance,
        status,
        notes,
        createdById: session.user.id,
        createdAt: purchaseDate ? new Date(purchaseDate) : new Date(),
        items: {
          create: resolvedItems.map((i: any) => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price,
            total: i.quantity * i.price,
          })),
        },
      },
    })

    // Record initial payment so the supplier ledger shows a credit entry
    if (paidAmount && paidAmount > 0) {
      await tx.payment.create({
        data: { purchaseId: p.id, amount: paidAmount, method: body.paymentMethod || "CASH", notes: "Initial payment at purchase" },
      })
    }

    // Update trader/customer ledger — we owe them the unpaid balance
    if (sellerCustomerId && balance > 0) {
      await tx.customer.update({
        where: { id: sellerCustomerId },
        data: { balance: { decrement: balance } },
      })
    }

    // Add stock
    for (const item of resolvedItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: { currentStock: { increment: item.quantity } },
      })
      // Products with no room yet get placed in this purchase's room. A room holds any
      // number of products; products already assigned elsewhere keep their room.
      if (resolvedRoomId) {
        await tx.product.updateMany({
          where: { id: item.productId, roomId: null },
          data: { roomId: resolvedRoomId },
        })
      }
      await tx.stockMovement.create({
        data: { productId: item.productId, type: "IN", quantity: item.quantity, reference: `Purchase #${p.id}` },
      })
    }

    return p
  })

  await createAuditLog({ userId: session.user.id, action: "CREATE", module: "PURCHASES", details: `Created purchase worth PKR ${totalAmount}` })

  return NextResponse.json({ purchase }, { status: 201 })
}

