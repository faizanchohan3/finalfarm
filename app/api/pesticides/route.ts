import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { cachedJson } from "@/lib/api-cache"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const pesticides = await db.pesticide.findMany({
    where: { isActive: true, ...shopFilter },
    include: { category: true },
    orderBy: { name: "asc" },
  })

  return cachedJson({ pesticides })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { name, categoryId, manufacturer, batchNumber, expiryDate, quantity, unit, purchasePrice, salePrice, incentive, minStock } = body

  const incentiveAmt = parseFloat(incentive || "0")

  const pesticide = await db.pesticide.create({
    data: {
      shopId: session.user.shopId || null,
      name, categoryId, manufacturer, batchNumber,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      quantity, unit, purchasePrice, salePrice, incentive: incentiveAmt, minStock: minStock || 0,
    },
  })

  // Post incentive as income to chart of accounts
  if (incentiveAmt > 0) {
    const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
    const incomeAccount = await db.account.findFirst({
      where: { ...shopFilter, type: "INCOME", isActive: true, name: { in: ["Pesticide Incentive Income", "Pesticide Incentive", "Other Income"] } },
      orderBy: { code: "asc" },
    })
    await db.transaction.create({
      data: {
        shopId: session.user.shopId || null,
        type: "CREDIT",
        amount: incentiveAmt,
        description: `Pesticide incentive â€” ${name}`,
        reference: pesticide.id,
        category: "Pesticide Incentive",
        accountId: incomeAccount?.id || null,
        createdById: session.user.id,
      },
    })
    if (incomeAccount) {
      await db.account.update({ where: { id: incomeAccount.id }, data: { balance: { increment: incentiveAmt } } })
    }
  }

  await createAuditLog({ userId: session.user.id, action: "CREATE", module: "PESTICIDES", details: `Added pesticide: ${name}` })

  return NextResponse.json({ pesticide }, { status: 201 })
}

