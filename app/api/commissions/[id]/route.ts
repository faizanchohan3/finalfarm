import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { archiveDeleted, day, pkr } from "@/lib/recycle-bin"
import { recordCode } from "@/lib/record-code"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const commission = await db.commission.findUnique({
    where: { id },
    include: { payments: true },
  })
  if (!commission) return NextResponse.json({ error: "Commission not found" }, { status: 404 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  await db.$transaction(async (tx) => {
    // Keep a full copy for the Deleted Records page; account changes are recorded below as they happen
    const { payments, ...commissionRow } = commission
    const transactions = await tx.transaction.findMany({ where: { reference: id } })
    const accounts: { id: string; delta: number }[] = []
    const c = commission
    // Reverse customer balance (remove their outstanding)
    if (commission.customerId) {
      await tx.customer.update({
        where: { id: commission.customerId },
        data: { balance: { decrement: commission.balance } },
      })
    }

    // Reverse farmer balance (remove what we owed them)
    if (commission.farmerId) {
      await tx.farmer.update({
        where: { id: commission.farmerId },
        data: { balance: { decrement: commission.sellerPayable } },
      })
    }

    // Reverse supplier balance (remove what we owed them)
    if (commission.supplierId) {
      await tx.supplier.update({
        where: { id: commission.supplierId },
        data: { balance: { decrement: commission.sellerPayable } },
      })
    }

    // Delete finance transactions linked to this commission
    await tx.transaction.deleteMany({ where: { reference: id } })

    // Reverse the commission account it was posted to (INCOME when received, EXPENSE when paid) — never go below 0
    if (commission.commissionAmount > 0) {
      const commAccount = await tx.account.findFirst({
        where: { ...shopFilter, type: commission.commissionDirection === "PAY" ? "EXPENSE" : "INCOME", name: { contains: "Commission" }, isActive: true },
        orderBy: { code: "asc" },
      })
      if (commAccount) {
        const newBal = Math.max(0, (commAccount.balance || 0) - commission.commissionAmount)
        await tx.account.update({ where: { id: commAccount.id }, data: { balance: newBal } })
        accounts.push({ id: commAccount.id, delta: (commAccount.balance || 0) - newBal })
      }
    }

    // Reverse labour expense account balance — never go below 0
    if (commission.labourAmount > 0) {
      const labourAccount = await tx.account.findFirst({
        where: { ...shopFilter, type: "EXPENSE", name: { contains: "Labour" }, isActive: true },
        orderBy: { code: "asc" },
      })
      if (labourAccount) {
        const newBal = Math.max(0, (labourAccount.balance || 0) - commission.labourAmount)
        await tx.account.update({ where: { id: labourAccount.id }, data: { balance: newBal } })
        accounts.push({ id: labourAccount.id, delta: (labourAccount.balance || 0) - newBal })
      }
    }

    await archiveDeleted(tx, session, {
      type: "COMMISSION", recordId: id, code: recordCode("commission", id),
      title: `${c.commodity || "Commission"} — ${c.walkInCustomer || "Trader"}`, amount: c.totalValue,
      summary: [
        ["Date", day(c.createdAt)], ["Commodity", c.commodity || "—"], ["Vehicle No", c.vehicleNo || "—"],
        ["Bags", c.bags != null ? String(c.bags) : "—"], ["Net weight", c.weight != null ? `${c.weight} KG` : "—"],
        ["Commission", `${pkr(c.commissionAmount)} (${c.commissionRate}%)`], ["Labour", pkr(c.labourAmount)],
        ["Total amount", pkr(c.totalValue)], ["Seller payable", pkr(c.sellerPayable)], ["Paid", pkr(c.paidAmount)],
        ["Balance", pkr(c.balance)], ["Status", c.status],
      ],
      snapshot: { commission: commissionRow, payments, transactions, accounts },
    })

    // Delete commission payments and the commission itself
    await tx.commissionPayment.deleteMany({ where: { commissionId: id } })
    await tx.commission.delete({ where: { id } })
  })

  await createAuditLog({
    userId: session.user.id,
    action: "DELETE",
    module: "COMMISSIONS",
    details: `Deleted commission #${id.slice(-6).toUpperCase()} — PKR ${commission.totalValue.toLocaleString()} (all ledger entries reversed)`,
  })

  return NextResponse.json({ success: true })
}
