import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const purchase = await db.purchase.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 })

  await db.$transaction(async (tx) => {
    // Reverse stock for every item (undo what the purchase added)
    for (const item of purchase.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { currentStock: { decrement: item.quantity } },
      })
    }
    // Delete stock movements linked to this purchase
    await tx.stockMovement.deleteMany({ where: { reference: { contains: `Purchase #${id}` } } })
    // Delete payments linked to this purchase
    await tx.payment.deleteMany({ where: { purchaseId: id } })
    // Delete purchase items
    await tx.purchaseItem.deleteMany({ where: { purchaseId: id } })
    // Delete the purchase
    await tx.purchase.delete({ where: { id } })
  })

  await createAuditLog({
    userId: session.user.id,
    action: "DELETE",
    module: "PURCHASES",
    details: `Deleted purchase #${id.slice(-6).toUpperCase()} — PKR ${purchase.totalAmount.toLocaleString()} (stock reversed)`,
  })

  return NextResponse.json({ success: true })
}
