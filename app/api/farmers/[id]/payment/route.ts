import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { paymentId } = await req.json()

  if (!paymentId) return NextResponse.json({ error: "Payment ID required" }, { status: 400 })

  try {
    const payment = await db.farmerPayment.findUnique({ where: { id: paymentId } })
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 })

    // Payment.amount is stored as: negative for RECEIVE, positive for PAY
    const isReceive = payment.amount < 0
    const displayAmt = Math.abs(payment.amount)

    await db.$transaction(async (tx) => {
      await tx.farmerPayment.delete({ where: { id: paymentId } })

      // Reverse the balance update
      // RECEIVE (negative) was increment → now decrement to reverse
      // PAY (positive) was decrement → now increment to reverse
      const balanceChange = isReceive
        ? { decrement: displayAmt }
        : { increment: displayAmt }

      await tx.farmer.update({
        where: { id },
        data: { balance: balanceChange },
      })

      // If payment was tied to a purchase, also reverse that
      if (payment.purchaseId) {
        const purchase = await tx.farmerPurchase.findUnique({ where: { id: payment.purchaseId } })
        if (purchase && !isReceive) {
          const newPaid = Math.max(0, purchase.paidAmount - displayAmt)
          const newBalance = purchase.totalAmount - newPaid
          await tx.farmerPurchase.update({
            where: { id: payment.purchaseId },
            data: {
              paidAmount: newPaid,
              balance: newBalance,
              status: newBalance <= 0 ? "PAID" : newPaid > 0 ? "PARTIAL" : "PENDING",
            },
          })
        }
      }
    })

    await createAuditLog({
      userId: session.user.id,
      action: "DELETE",
      module: "FARMERS",
      details: `Deleted payment from farmer ID: ${id}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete payment" }, { status: 500 })
  }
}
