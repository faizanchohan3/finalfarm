import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { amount, method, notes, direction } = await req.json()

  if (!amount || parseFloat(amount) <= 0)
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 })

  const amt = parseFloat(amount)
  const dir = direction === "PAY" ? "PAY" : "RECEIVE"

  let paymentId = ""
  await db.$transaction(async (tx) => {
    const payment = await tx.customerPayment.create({
      data: {
        customerId: id,
        amount: amt,
        direction: dir,
        method: method || "CASH",
        notes: notes || null,
      },
    })
    paymentId = payment.id

    // RECEIVE = customer pays us → balance decreases (they owe us less)
    // PAY     = we pay customer (advance) → balance increases (they owe us more)
    await tx.customer.update({
      where: { id },
      data: { balance: dir === "PAY" ? { increment: amt } : { decrement: amt } },
    })
  })

  await createAuditLog({
    userId: session.user.id,
    action: "CREATE",
    module: "CUSTOMERS",
    details: `${dir === "PAY" ? "Paid to" : "Received from"} customer PKR ${amt} — ID: ${id}`,
  })

  return NextResponse.json({ success: true, id: paymentId })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { paymentId } = await req.json()

  if (!paymentId) return NextResponse.json({ error: "Payment ID required" }, { status: 400 })

  try {
    const payment = await db.customerPayment.findUnique({ where: { id: paymentId } })
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 })

    await db.$transaction(async (tx) => {
      await tx.customerPayment.delete({ where: { id: paymentId } })

      // Reverse the balance update
      // RECEIVE was decrement → now increment to reverse
      // PAY was increment → now decrement to reverse
      await tx.customer.update({
        where: { id },
        data: { balance: payment.direction === "PAY" ? { decrement: payment.amount } : { increment: payment.amount } },
      })
    })

    await createAuditLog({
      userId: session.user.id,
      action: "DELETE",
      module: "CUSTOMERS",
      details: `Deleted payment from customer ID: ${id}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete payment" }, { status: 500 })
  }
}
