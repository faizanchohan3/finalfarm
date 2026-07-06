import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const sales = await db.pesticideSale.findMany({
    where: shopFilter,
    orderBy: { createdAt: "desc" },
    include: {
      pesticide: true,
      customer: { select: { id: true, name: true, phone: true } },
      farmer: { select: { id: true, name: true, phone: true } },
      soldBy: { select: { name: true } },
    },
  })

  return NextResponse.json({ sales })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { pesticideId, quantity, unitPrice, customerId, farmerId, customerName, paidAmount, incentive, notes, saleDate } = await req.json()

    if (!pesticideId) return NextResponse.json({ error: "Pesticide is required" }, { status: 400 })
    if (!quantity || quantity <= 0) return NextResponse.json({ error: "Invalid quantity" }, { status: 400 })
    if (!unitPrice || unitPrice <= 0) return NextResponse.json({ error: "Invalid unit price" }, { status: 400 })

    const totalAmount = quantity * unitPrice
    const paid = parseFloat(paidAmount) || 0
    const balance = totalAmount - paid

    const sale = await db.$transaction(async (tx) => {
      // Verify pesticide exists and has enough stock
      const pesticide = await tx.pesticide.findUnique({ where: { id: pesticideId } })
      if (!pesticide) throw new Error("Pesticide not found")
      if (pesticide.quantity < quantity) throw new Error(`Insufficient stock. Available: ${pesticide.quantity} ${pesticide.unit}`)

      const s = await tx.pesticideSale.create({
        data: {
          shopId: session.user.shopId || null,
          pesticideId,
          customerId: customerId || null,
          farmerId: farmerId || null,
          quantity,
          unitPrice,
          totalAmount,
          customerName: customerName || null,
          paidAmount: paid,
          balance,
          incentive: parseFloat(incentive) || 0,
          soldById: session.user.id,
          notes: notes || null,
          createdAt: saleDate ? new Date(saleDate) : new Date(),
        },
        include: {
          pesticide: true,
          customer: { select: { id: true, name: true, phone: true } },
          farmer: { select: { id: true, name: true, phone: true } },
          soldBy: { select: { name: true } },
        },
      })

      await tx.pesticide.update({
        where: { id: pesticideId },
        data: { quantity: { decrement: quantity } },
      })

      if (customerId && balance > 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: { balance: { increment: balance } },
        })
      }

      if (farmerId && balance > 0) {
        await tx.farmer.update({
          where: { id: farmerId },
          data: { balance: { decrement: balance } },
        })
      }

      return s
    })

    await createAuditLog({
      userId: session.user.id,
      action: "CREATE",
      module: "PESTICIDES",
      details: `Sold pesticide, amount: PKR ${totalAmount}${customerId ? ` to customer ${customerId}` : ""}`,
    })

    return NextResponse.json({ sale }, { status: 201 })
  } catch (err: any) {
    console.error("Pesticide sale error:", err)
    return NextResponse.json({ error: err?.message || "Failed to create pesticide sale" }, { status: 500 })
  }
}
