import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { createAuditLog } from "@/lib/audit"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const { name, role, isActive, password } = await req.json()

  const data: any = { name, role, isActive }
  if (password) data.password = await bcrypt.hash(password, 12)

  const user = await db.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, isActive: true },
  })

  await createAuditLog({ userId: session.user.id, action: "UPDATE", module: "USERS", details: `Updated user: ${user.email}` })

  return NextResponse.json({ user })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  if (id === session.user.id) return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 })

  await db.user.update({ where: { id }, data: { isActive: false } })
  await createAuditLog({ userId: session.user.id, action: "DELETE", module: "USERS", details: `Deactivated user ID: ${id}` })

  return NextResponse.json({ success: true })
}
