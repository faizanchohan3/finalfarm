import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { LOT_SALE_BANK_CATEGORY, reverseSaleCommission } from "@/lib/lot-sale"

// Delete a Potato Store sale: its commissions are reversed (buyer receivable, farmer payable,
// commission income) and the bags go back to their lots.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const { id } = await params
  const sale = await db.lotSale.findUnique({ where: { id }, include: { items: { include: { lot: true } } } })
  if (!sale || (session.user.shopId && sale.shopId !== session.user.shopId)) return NextResponse.json({ error: "Sale not found" }, { status: 404 })

  await db.$transaction(async (tx) => {
    const commissions = await tx.commission.findMany({ where: { lotSaleId: id } })
    for (const c of commissions) await reverseSaleCommission(tx, c, shopFilter)
    for (const i of sale.items) {
      const sold = Math.max((i.lot.soldBags || 0) - i.bags, 0)
      // A lot this sale emptied goes back into stock
      const back = i.lot.status === "SETTLED" && !i.lot.commissionId
      await tx.lot.update({
        where: { id: i.lotId },
        data: { soldBags: sold, ...(back ? { status: "STORED", settledAt: null, soldAt: sold > 0 ? i.lot.soldAt : null } : {}) },
      })
    }
    // Money received into a bank with the sale
    await tx.transaction.deleteMany({ where: { reference: id, category: LOT_SALE_BANK_CATEGORY } })
    await tx.lotSale.delete({ where: { id } })
  })

  await createAuditLog({
    userId: session.user.id, shopId: session.user.shopId, action: "DELETE", module: "LOTS",
    details: `Deleted Potato Store sale ${sale.code || id} — ${sale.totalBags} bags, PKR ${sale.amount.toLocaleString()} (bags returned to lots, balances reversed)`,
  })
  return NextResponse.json({ success: true })
}
