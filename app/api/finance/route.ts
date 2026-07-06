import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")
  const skip = (page - 1) * limit

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const [transactions, total, summary] = await Promise.all([
    db.transaction.findMany({
      skip,
      take: limit,
      where: shopFilter,
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true } }, bank: { select: { name: true } } },
    }),
    db.transaction.count({ where: shopFilter }),
    db.transaction.groupBy({
      by: ["type"],
      where: shopFilter,
      _sum: { amount: true },
    }),
  ])

  const income = summary.find((s) => s.type === "CREDIT")?._sum.amount || 0
  const expense = summary.find((s) => s.type === "DEBIT")?._sum.amount || 0

  return NextResponse.json({ transactions, total, income, expense, balance: income - expense })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { type, amount, description, reference, category, bankId, accountId, entryType, transactionDate } = await req.json()

  const transaction = await db.$transaction(async (tx) => {
    const t = await tx.transaction.create({
      data: {
        shopId: session.user.shopId || null,
        type,
        amount,
        description,
        reference,
        category,
        bankId: bankId || null,
        accountId: accountId || null,
        createdById: session.user.id,
        createdAt: transactionDate ? new Date(transactionDate) : new Date(),
      },
    })

    if (accountId) {
      const account = await tx.account.findUnique({ where: { id: accountId }, select: { type: true } })
      if (account) {
        // Use entryType (user's debit/credit choice) if provided, otherwise use type from Income/Expense
        const directionType = entryType || type
        // Debit increases balance, Credit decreases balance
        const shouldIncrement = directionType === "DEBIT"
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { [shouldIncrement ? "increment" : "decrement"]: amount } },
        })
      }
    }

    return t
  })

  await createAuditLog({ userId: session.user.id, action: "CREATE", module: "FINANCE", details: `${type}: PKR ${amount} - ${description}` })

  return NextResponse.json({ transaction }, { status: 201 })
}

