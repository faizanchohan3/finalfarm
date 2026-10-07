import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { archiveDeleted, day, pkr } from "@/lib/recycle-bin"
import { recordCode } from "@/lib/record-code"

// Edit a commission: undo its old effect on buyer, seller and finance, then apply the new values.
// Payments already recorded are kept; the balance is recalculated against them.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const old = await db.commission.findUnique({ where: { id }, include: { lot: { select: { lotNo: true } } } })
  if (!old) return NextResponse.json({ error: "Commission not found" }, { status: 404 })
  if (session.user.shopId && old.shopId !== session.user.shopId) return NextResponse.json({ error: "Commission not found" }, { status: 404 })
  if (old.lot) return NextResponse.json({ error: `This commission was created by settling lot ${old.lot.lotNo} and can't be edited here` }, { status: 400 })
  if (old.lotSaleId) return NextResponse.json({ error: "This commission was created by a Potato Store sale — change or delete the sale on the Potato Store page" }, { status: 400 })

  const body = await req.json()
  const {
    customerId, walkInCustomer, farmerId, supplierId, walkInSeller, commodity, vehicleNo, bags, bagType,
    weight, grossWeight, tareWeight, bardanaWeight, rate, rateUnit, totalValue, commissionRate, labourAmount, labourMode, notes,
  } = body

  if (!customerId && !walkInCustomer) return NextResponse.json({ error: "Buyer (customer) is required" }, { status: 400 })
  if (!totalValue || parseFloat(totalValue) <= 0) return NextResponse.json({ error: "Total value must be greater than 0" }, { status: 400 })

  // Same calculation as creating a commission
  const num = (v: any) => (v !== "" && v != null ? parseFloat(v) : null)
  const isPay = old.commissionDirection === "PAY"
  const isAddLabour = labourMode !== "DEDUCT"
  const commRate = commissionRate !== undefined && commissionRate !== "" ? parseFloat(commissionRate) || 0 : 0
  const goods = parseFloat(totalValue)
  const commAmount = parseFloat(((goods * commRate) / 100).toFixed(2))
  const labourAmt = parseFloat(labourAmount || "0") || 0
  const total = Math.max(goods - commAmount + (isAddLabour ? labourAmt : -labourAmt), 0)
  const sellerPayable = total
  const paid = old.paidAmount
  const balance = total - paid
  const status = balance <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING"

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const findAccount = (tx: any, type: string, name: string) =>
    tx.account.findFirst({ where: { ...shopFilter, type, name: { contains: name }, isActive: true }, orderBy: { code: "asc" } })

  const commission = await db.$transaction(async (tx) => {
    // ── Undo the old entry ──
    // Buyer was charged the total and credited each payment
    if (old.customerId) await tx.customer.update({ where: { id: old.customerId }, data: { balance: { decrement: old.totalValue - old.paidAmount } } })
    if (old.farmerId) await tx.farmer.update({ where: { id: old.farmerId }, data: { balance: { decrement: old.sellerPayable } } })
    if (old.supplierId) await tx.supplier.update({ where: { id: old.supplierId }, data: { balance: { decrement: old.sellerPayable } } })
    await tx.transaction.deleteMany({ where: { reference: id } })
    if (old.commissionAmount > 0) {
      const acc = await findAccount(tx, isPay ? "EXPENSE" : "INCOME", "Commission")
      if (acc) await tx.account.update({ where: { id: acc.id }, data: { balance: { decrement: old.commissionAmount } } })
    }
    if (old.labourAmount > 0) {
      const acc = await findAccount(tx, "EXPENSE", "Labour")
      if (acc) await tx.account.update({ where: { id: acc.id }, data: { balance: { decrement: old.labourAmount } } })
    }

    // ── Apply the new values ──
    const c = await tx.commission.update({
      where: { id },
      data: {
        customerId: customerId || null,
        walkInCustomer: walkInCustomer || null,
        farmerId: farmerId || null,
        supplierId: supplierId || null,
        walkInSeller: walkInSeller || null,
        commodity: commodity || null,
        vehicleNo: vehicleNo?.trim() || null,
        bags: bags ? parseInt(bags) : null,
        bagType: bagType || "bag",
        weight: num(weight),
        grossWeight: num(grossWeight),
        tareWeight: num(tareWeight),
        bardanaWeight: num(bardanaWeight),
        rate: parseFloat(rate || "0") || 0,
        rateUnit: rateUnit === "mound" ? "mound" : "kg",
        totalValue: total,
        commissionRate: commRate,
        commissionAmount: commAmount,
        labourAmount: labourAmt,
        labourMode: isAddLabour ? "ADD" : "DEDUCT",
        sellerPayable,
        balance,
        status,
        notes: notes || null,
      },
    })

    if (customerId) await tx.customer.update({ where: { id: customerId }, data: { balance: { increment: total - paid } } })
    if (farmerId) await tx.farmer.update({ where: { id: farmerId }, data: { balance: { increment: sellerPayable } } })
    if (supplierId) await tx.supplier.update({ where: { id: supplierId }, data: { balance: { increment: sellerPayable } } })

    const sellerName = walkInSeller || (farmerId ? "Farmer" : supplierId ? "Supplier" : null)
    const buyerName = walkInCustomer || "Customer"
    if (commAmount > 0) {
      const acc = await findAccount(tx, isPay ? "EXPENSE" : "INCOME", "Commission")
      await tx.transaction.create({
        data: {
          shopId: old.shopId,
          type: isPay ? "DEBIT" : "CREDIT",
          amount: commAmount,
          description: `Commission ${isPay ? "paid" : "earned"} — ${commodity || "goods"}${sellerName ? ` from ${sellerName}` : ""} to ${buyerName}`,
          reference: id,
          category: isPay ? "Commission Paid" : "Commission Income",
          accountId: acc?.id || null,
          createdById: session.user.id,
          createdAt: old.createdAt,
        },
      })
      if (acc) await tx.account.update({ where: { id: acc.id }, data: { balance: { increment: commAmount } } })
    }
    if (labourAmt > 0) {
      const acc = await findAccount(tx, "EXPENSE", "Labour")
      await tx.transaction.create({
        data: {
          shopId: old.shopId,
          type: "DEBIT",
          amount: labourAmt,
          description: `Labour — ${commodity || "goods"} (${buyerName})`,
          reference: id,
          category: "Labour",
          accountId: acc?.id || null,
          createdById: session.user.id,
          createdAt: old.createdAt,
        },
      })
      if (acc) await tx.account.update({ where: { id: acc.id }, data: { balance: { increment: labourAmt } } })
    }

    return c
  })

  await createAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    module: "COMMISSIONS",
    details: `Edited commission #${id.slice(-6).toUpperCase()} — total PKR ${old.totalValue.toLocaleString()} → ${total.toLocaleString()}`,
  })

  return NextResponse.json({ commission })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const commission = await db.commission.findUnique({
    where: { id },
    include: { payments: true },
  })
  if (!commission) return NextResponse.json({ error: "Commission not found" }, { status: 404 })
  if (commission.lotSaleId) return NextResponse.json({ error: "This commission was created by a Potato Store sale — delete the sale on the Potato Store page" }, { status: 400 })

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
      type: "COMMISSION", recordId: id, code: recordCode("commission", c),
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
