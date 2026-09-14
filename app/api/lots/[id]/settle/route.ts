import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

// Settle a SOLD lot: create the commission (Aarthi) record, post the buyer
// receivable, farmer payable, commission income and labour expense in one
// transaction, then link the lot and mark it SETTLED. Mirrors the balance
// conventions in /api/commissions.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const lot = await db.lot.findUnique({
    where: { id },
    include: { commodity: { select: { name: true } } },
  })
  if (!lot) return NextResponse.json({ error: "Lot not found" }, { status: 404 })
  if (session.user.shopId && lot.shopId !== session.user.shopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (lot.commissionId) {
    return NextResponse.json({ error: "This lot is already settled." }, { status: 400 })
  }
  if (lot.status === "CANCELLED") {
    return NextResponse.json({ error: "A cancelled lot cannot be settled." }, { status: 400 })
  }
  if (!lot.buyerId || !lot.saleAmount || lot.saleAmount <= 0) {
    return NextResponse.json({ error: "Mark the lot SOLD with a buyer and amount before settling." }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const commRate = body.commissionRate !== undefined && body.commissionRate !== "" ? parseFloat(body.commissionRate) : 2.5
  const total = lot.saleAmount
  const commAmount = parseFloat(((total * commRate) / 100).toFixed(2))
  const labourAmt = parseFloat(body.labourAmount || "0")
  // Seller (farmer) receives total minus our commission; labour is a cost against commission.
  const sellerPayable = parseFloat((total - commAmount).toFixed(2))
  const shopId = session.user.shopId || null
  const shopFilter = shopId ? { shopId } : {}

  const result = await db.$transaction(async (tx) => {
    const c = await tx.commission.create({
      data: {
        shopId,
        customerId: lot.buyerId,
        farmerId: lot.farmerId,
        commodity: lot.commodity?.name || null,
        bags: lot.bags,
        weight: lot.netWeight,
        rate: lot.saleRate || 0,
        totalValue: total,
        commissionRate: commRate,
        commissionAmount: commAmount,
        labourAmount: labourAmt,
        sellerPayable,
        paidAmount: 0,
        balance: total,
        status: "PENDING",
        notes: body.notes?.trim() || `Settlement for ${lot.lotNo}`,
        createdById: session.user.id,
      },
    })

    // Buyer owes the mandi the full sale value (receivable)
    await tx.customer.update({ where: { id: lot.buyerId! }, data: { balance: { increment: total } } })

    // Mandi owes the farmer the sale value minus commission (payable)
    if (lot.farmerId) {
      await tx.farmer.update({ where: { id: lot.farmerId }, data: { balance: { increment: sellerPayable } } })
    }

    // Commission income
    const commissionAccount = await tx.account.findFirst({
      where: { ...shopFilter, type: "INCOME", name: { contains: "Commission" }, isActive: true },
      orderBy: { code: "asc" },
    })
    await tx.transaction.create({
      data: {
        shopId,
        type: "CREDIT",
        amount: commAmount,
        description: `Commission — ${lot.commodity?.name || "goods"} (${lot.lotNo})`,
        reference: c.id,
        category: "Commission Income",
        accountId: commissionAccount?.id || null,
        createdById: session.user.id,
      },
    })
    if (commissionAccount) {
      await tx.account.update({ where: { id: commissionAccount.id }, data: { balance: { increment: commAmount } } })
    }

    // Labour expense
    if (labourAmt > 0) {
      const labourAccount = await tx.account.findFirst({
        where: { ...shopFilter, type: "EXPENSE", name: { contains: "Labour" }, isActive: true },
        orderBy: { code: "asc" },
      })
      await tx.transaction.create({
        data: {
          shopId,
          type: "DEBIT",
          amount: labourAmt,
          description: `Labour — ${lot.commodity?.name || "goods"} (${lot.lotNo})`,
          reference: c.id,
          category: "Labour",
          accountId: labourAccount?.id || null,
          createdById: session.user.id,
        },
      })
      if (labourAccount) {
        await tx.account.update({ where: { id: labourAccount.id }, data: { balance: { increment: labourAmt } } })
      }
    }

    const updatedLot = await tx.lot.update({
      where: { id: lot.id },
      data: { status: "SETTLED", commissionId: c.id, settledAt: new Date() },
    })

    return { commission: c, lot: updatedLot }
  })

  return NextResponse.json(result, { status: 201 })
}
