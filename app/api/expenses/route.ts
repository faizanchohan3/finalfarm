import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const where: any = { type: "DEBIT", ...shopFilter }
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      where.createdAt.lte = toDate
    }
  }

  const [expenses, summary] = await Promise.all([
    db.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
        account: { select: { name: true, code: true } },
      },
    }),
    db.transaction.groupBy({
      by: ["category"],
      where,
      _sum: { amount: true },
      _count: true,
    }),
  ])

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  return NextResponse.json({ expenses, total, summary })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { amount, description, category, reference, accountId } = await req.json()
  if (!amount || amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
  if (!description?.trim()) return NextResponse.json({ error: "Description required" }, { status: 400 })

  const amt = parseFloat(amount)

  const expense = await db.$transaction(async (tx) => {
    const t = await tx.transaction.create({
      data: {
        shopId: session.user.shopId || null,
        type: "DEBIT",
        amount: amt,
        description,
        category: category || "General",
        reference: reference || null,
        accountId: accountId || null,
        createdById: session.user.id,
      },
    })

    if (accountId) {
      const account = await tx.account.findUnique({ where: { id: accountId }, select: { type: true } })
      if (account) {
        const naturalDebit = ["ASSET", "EXPENSE"]
        const isNatural = naturalDebit.includes(account.type)
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { [isNatural ? "increment" : "decrement"]: amt } },
        })
      }
    }

    return t
  })

  await createAuditLog({
    userId: session.user.id,
    action: "CREATE",
    module: "EXPENSES",
    details: `Expense: PKR ${amount} — ${description}`,
  })

  return NextResponse.json({ expense }, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await req.json()
  await db.transaction.delete({ where: { id } })

  await createAuditLog({
    userId: session.user.id,
    action: "DELETE",
    module: "EXPENSES",
    details: `Deleted expense ID: ${id}`,
  })

  return NextResponse.json({ success: true })
}
