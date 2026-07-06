import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const dateWhere: any = {}
  if (from || to) {
    dateWhere.createdAt = {}
    if (from) dateWhere.createdAt.gte = new Date(from)
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      dateWhere.createdAt.lte = toDate
    }
  }

  const account = await db.account.findUnique({ where: { id } })
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const transactions = await db.transaction.findMany({
    where: { accountId: id, ...dateWhere },
    orderBy: { createdAt: "asc" },
    include: { createdBy: { select: { name: true } }, bank: { select: { name: true } } },
  })

  // Rebuild running balance from transactions
  const naturalDebit = ["ASSET", "EXPENSE"]
  let running = 0
  const entries = transactions.map((t) => {
    const isNatural = naturalDebit.includes(account.type) ? t.type === "DEBIT" : t.type === "CREDIT"
    running += isNatural ? t.amount : -t.amount
    return { ...t, runningBalance: running }
  })

  return NextResponse.json({ account, entries, closingBalance: running })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { code, name, type, description } = await req.json()

  const account = await db.account.update({
    where: { id },
    data: { code, name, type, description: description || null },
  })

  await createAuditLog({ userId: session.user.id, action: "UPDATE", module: "ACCOUNTS", details: `Updated account: ${code} - ${name}` })

  return NextResponse.json({ account })
}

// Reset a negative/incorrect balance back to 0
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const account = await db.account.findUnique({ where: { id }, select: { name: true, balance: true } })
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const updated = await db.account.update({ where: { id }, data: { balance: 0 } })
  await createAuditLog({ userId: session.user.id, action: "UPDATE", module: "ACCOUNTS", details: `Balance reset to 0: ${account.name} (was PKR ${account.balance?.toLocaleString()})` })
  return NextResponse.json({ account: updated })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await db.account.update({ where: { id }, data: { isActive: false } })

  await createAuditLog({ userId: session.user.id, action: "DELETE", module: "ACCOUNTS", details: `Deactivated account ID: ${id}` })

  return NextResponse.json({ success: true })
}
