import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { amount, method, notes } = body

  const amt = parseFloat(amount)
  if (!amt || amt <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 })

  const commission = await db.commission.findUnique({ where: { id } })
  if (!commission) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (commission.balance <= 0) return NextResponse.json({ error: "Already fully paid" }, { status: 400 })

  const newPaid = commission.paidAmount + amt
  const newBalance = commission.totalValue - newPaid
  const status = newBalance <= 0 ? "PAID" : "PARTIAL"

  await db.$transaction(async (tx) => {
    await tx.commissionPayment.create({
      data: { commissionId: id, amount: amt, method: method || "CASH", notes: notes || undefined },
    })
    await tx.commission.update({
      where: { id },
      data: { paidAmount: newPaid, balance: Math.max(0, newBalance), status },
    })
    if (commission.customerId) {
      await tx.customer.update({
        where: { id: commission.customerId },
        data: { balance: { decrement: amt } },
      })
    }
  })

  return NextResponse.json({ ok: true })
}
