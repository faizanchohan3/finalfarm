import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "50")
  const skip = (page - 1) * limit

  const [commissions, total] = await Promise.all([
    db.commission.findMany({
      skip,
      take: limit,
      where: shopFilter,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        farmer: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        payments: { orderBy: { createdAt: "desc" } },
      },
    }),
    db.commission.count({ where: shopFilter }),
  ])

  return NextResponse.json({ commissions, total, page, limit })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const {
    customerId,
    walkInCustomer,
    farmerId,
    supplierId,
    walkInSeller,
    commodity,
    bags,
    weight,
    rate,
    totalValue,
    commissionRate,
    labourAmount,
    notes,
    paidAmount: initialPaid,
    paymentMethod,
    commissionDate,
  } = body

  if (!customerId && !walkInCustomer) {
    return NextResponse.json({ error: "Buyer (customer) is required" }, { status: 400 })
  }
  if (!totalValue || parseFloat(totalValue) <= 0) {
    return NextResponse.json({ error: "Total value must be greater than 0" }, { status: 400 })
  }

  const commRate = commissionRate !== undefined && commissionRate !== "" ? parseFloat(commissionRate) : 2.5
  const total = parseFloat(totalValue)
  const commAmount = parseFloat(((total * commRate) / 100).toFixed(2))
  const labourAmt = parseFloat(labourAmount || "0")
  // Seller gets total minus commission only â€” labour is a cost deducted from commission, not from seller
  const sellerPayable = parseFloat((total - commAmount).toFixed(2))
  const paid = parseFloat(initialPaid || "0")
  const balance = total - paid
  const status = balance <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING"

  const sellerName = walkInSeller ||
    (farmerId ? "Farmer" : supplierId ? "Supplier" : null)
  const buyerName = walkInCustomer || "Customer"

  const commission = await db.$transaction(async (tx) => {
    const c = await tx.commission.create({
      data: {
        shopId: session.user.shopId || null,
        customerId: customerId || null,
        walkInCustomer: walkInCustomer || null,
        createdAt: commissionDate ? new Date(commissionDate) : new Date(),
        farmerId: farmerId || null,
        supplierId: supplierId || null,
        walkInSeller: walkInSeller || null,
        commodity: commodity || null,
        bags: bags ? parseInt(bags) : null,
        weight: weight ? parseFloat(weight) : null,
        rate: parseFloat(rate || "0"),
        totalValue: total,
        commissionRate: commRate,
        commissionAmount: commAmount,
        labourAmount: labourAmt,
        sellerPayable,
        paidAmount: paid,
        balance,
        status,
        notes: notes || null,
        createdById: session.user.id,
      },
    })

    // Debit customer for full transaction value (they owe us totalValue)
    if (customerId) {
      await tx.customer.update({
        where: { id: customerId },
        data: { balance: { increment: total } },
      })
    }

    // Credit farmer with what we owe them (totalValue - our commission)
    if (farmerId) {
      await tx.farmer.update({
        where: { id: farmerId },
        data: { balance: { increment: sellerPayable } },
      })
    }

    // Credit supplier with what we owe them (totalValue - our commission)
    if (supplierId) {
      await tx.supplier.update({
        where: { id: supplierId },
        data: { balance: { increment: sellerPayable } },
      })
    }

    // Record commission as income in finance/transactions
    const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
    const commissionAccount = await tx.account.findFirst({
      where: { ...shopFilter, type: "INCOME", name: { contains: "Commission" }, isActive: true },
      orderBy: { code: "asc" },
    })
    await tx.transaction.create({
      data: {
        shopId: session.user.shopId || null,
        type: "CREDIT",
        amount: commAmount,
        description: `Commission â€” ${commodity || "goods"}${sellerName ? ` from ${sellerName}` : ""} to ${buyerName}`,
        reference: c.id,
        category: "Commission Income",
        accountId: commissionAccount?.id || null,
        createdById: session.user.id,
      },
    })
    if (commissionAccount) {
      await tx.account.update({ where: { id: commissionAccount.id }, data: { balance: { increment: commAmount } } })
    }

    // Post labour as expense to Labour account
    if (labourAmt > 0) {
      const labourAccount = await tx.account.findFirst({
        where: { ...shopFilter, type: "EXPENSE", name: { contains: "Labour" }, isActive: true },
        orderBy: { code: "asc" },
      })
      await tx.transaction.create({
        data: {
          shopId: session.user.shopId || null,
          type: "DEBIT",
          amount: labourAmt,
          description: `Labour â€” ${commodity || "goods"} (${buyerName})`,
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

    // Record initial payment if any
    if (paid > 0) {
      await tx.commissionPayment.create({
        data: { commissionId: c.id, amount: paid, method: paymentMethod || "CASH", notes: "Initial payment" },
      })
      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: { balance: { decrement: paid } },
        })
      }
    }

    return c
  })

  return NextResponse.json({ commission }, { status: 201 })
}

