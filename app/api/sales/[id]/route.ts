import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const sale = await db.sale.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 })

  await db.$transaction(async (tx) => {
    // Restore stock for every item in this sale
    for (const item of sale.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { currentStock: { increment: item.quantity } },
      })
    }
    // Delete stock movements linked to this sale
    await tx.stockMovement.deleteMany({ where: { reference: { contains: `Sale #${id}` } } })
    // Delete payments linked to this sale
    await tx.payment.deleteMany({ where: { saleId: id } })
    // Delete sale items
    await tx.saleItem.deleteMany({ where: { saleId: id } })
    // Delete the sale
    await tx.sale.delete({ where: { id } })
  })

  await createAuditLog({
    userId: session.user.id,
    action: "DELETE",
    module: "SALES",
    details: `Deleted sale #${id.slice(-6).toUpperCase()} — PKR ${sale.totalAmount.toLocaleString()} (stock restored)`,
  })

  return NextResponse.json({ success: true })
}
