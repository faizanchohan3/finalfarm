import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const paidAmount = body.paidAmount || 0
  const totalAmount = body.totalAmount || 0
  const balance = totalAmount - paidAmount

  const purchase = await db.$transaction(async (tx) => {
    const p = await tx.farmerPurchase.create({
      data: {
        farmerId: id,
        totalAmount,
        paidAmount,
        balance,
        status: balance <= 0 ? "PAID" : paidAmount > 0 ? "PARTIAL" : "PENDING",
        commodity: body.commodity || null,
        weight: body.weight || null,
        bags: body.bags || null,
        notes: body.notes || null,
        createdById: session.user!.id!,
        items: {
          create: (body.items || []).map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            weight: item.weight || null,
            price: item.price,
            total: item.total,
          })),
        },
      },
    })

    if (paidAmount > 0) {
      await tx.farmerPayment.create({
        data: {
          farmerId: id,
          purchaseId: p.id,
          amount: paidAmount,
          method: body.paymentMethod || "CASH",
          notes: "Initial payment at purchase",
        },
      })
    }

    // Update farmer balance
    await tx.farmer.update({
      where: { id },
      data: { balance: { increment: balance } },
    })

    return p
  })

  return NextResponse.json({ purchase })
}
