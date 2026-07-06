import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const accounts = await db.account.findMany({
    where: { ...shopFilter, isActive: true },
    orderBy: [{ type: "asc" }, { code: "asc" }],
    include: { _count: { select: { transactions: true } } },
  })

  return NextResponse.json({ accounts })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { code, name, type, description } = await req.json()
  if (!code || !name || !type) return NextResponse.json({ error: "Code, name and type required" }, { status: 400 })

  const account = await db.account.create({
    data: {
      shopId: session.user.shopId || null,
      code,
      name,
      type,
      description: description || null,
    },
  })

  await createAuditLog({ userId: session.user.id, action: "CREATE", module: "ACCOUNTS", details: `Created account: ${code} - ${name}` })

  return NextResponse.json({ account }, { status: 201 })
}
