import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { archiveDeleted, day, pkr } from "@/lib/recycle-bin"
import { syncGalaPayment } from "@/lib/gala"

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
      // Keep a copy (and the linked purchase as it was) for the Deleted Records page
      const farmer = await tx.farmer.findUnique({ where: { id }, select: { name: true } })
      const purchaseBefore = payment.purchaseId && !isReceive ? await tx.farmerPurchase.findUnique({ where: { id: payment.purchaseId } }) : null
      await archiveDeleted(tx, session, {
        type: "FARMER_PAYMENT", recordId: paymentId, code: `PY-${paymentId.slice(-6).toUpperCase()}`,
        title: `${isReceive ? "Received from" : "Paid to"} ${farmer?.name || "farmer"}`, amount: displayAmt,
        summary: [
          ["Farmer", farmer?.name || "—"], ["Date", day(payment.createdAt)],
          ["Type", isReceive ? "Received from farmer" : "Paid to farmer"], ["Amount", pkr(displayAmt)],
        ],
        snapshot: { payment, purchaseBefore },
      })
      await tx.farmerPayment.delete({ where: { id: paymentId } })
      // Paid against a Gala Mandi entry → that entry has paid less
      await syncGalaPayment(tx, payment.galaEntryId, "paidAmount", -displayAmt)

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
