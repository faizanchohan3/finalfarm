import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const purchase = await db.farmerPurchase.findUnique({
    where: { id },
    include: {
      farmer: true,
      items: { include: { product: { select: { name: true, unit: true } } } },
      payments: { orderBy: { createdAt: "asc" } },
      createdBy: { select: { name: true } },
    },
  })

  if (!purchase) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ purchase })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const payAmount = parseFloat(body.amount)
  if (!payAmount || payAmount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 })

  const purchase = await db.farmerPurchase.findUnique({ where: { id } })
  if (!purchase) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const newPaid = purchase.paidAmount + payAmount
  const newBalance = Math.max(0, purchase.totalAmount - newPaid)
  const newStatus = newBalance <= 0 ? "PAID" : "PARTIAL"

  await db.$transaction(async (tx) => {
    await tx.farmerPayment.create({
      data: {
        farmerId: purchase.farmerId,
        purchaseId: id,
        amount: payAmount,
        method: body.method || "CASH",
        notes: body.notes || null,
      },
    })

    await tx.farmerPurchase.update({
      where: { id },
      data: { paidAmount: newPaid, balance: newBalance, status: newStatus },
    })

    await tx.farmer.update({
      where: { id: purchase.farmerId },
      data: { balance: { decrement: payAmount } },
    })
  })

  return NextResponse.json({ ok: true })
}
