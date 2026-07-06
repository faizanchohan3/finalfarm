import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { createAuditLog } from "@/lib/audit"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Shop admin sees only their shop's users; super admin sees all
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const users = await db.user.findMany({
    where: shopFilter,
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, shopId: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json({ users })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { name, email, password, role } = await req.json()

  // Shop admin can't create SUPER_ADMIN accounts
  if (session.user.shopId && role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden: Cannot create super admin" }, { status: 403 })
  }

  const exists = await db.user.findUnique({ where: { email } })
  if (exists) return NextResponse.json({ error: "Email already exists" }, { status: 400 })

  const hashed = await bcrypt.hash(password, 12)
  const user = await db.user.create({
    data: {
      shopId: session.user.shopId || null,
      name, email,
      password: hashed,
      role,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  })

  await createAuditLog({ userId: session.user.id, shopId: session.user.shopId, action: "CREATE", module: "USERS", details: `Created user: ${email}` })

  return NextResponse.json({ user }, { status: 201 })
}
