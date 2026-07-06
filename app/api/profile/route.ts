import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, createdAt: true, shopId: true },
  })

  return NextResponse.json({ user })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, currentPassword, newPassword } = await req.json()

  // If changing password, verify current password first
  if (newPassword) {
    const user = await db.user.findUnique({ where: { id: session.user.id } })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const valid = await bcrypt.compare(currentPassword || "", user.password)
    if (!valid) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 })

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters." }, { status: 400 })
    }

    const hashed = await bcrypt.hash(newPassword, 12)
    const updated = await db.user.update({
      where: { id: session.user.id },
      data: { name: name || undefined, password: hashed },
      select: { id: true, name: true, email: true, role: true },
    })
    return NextResponse.json({ user: updated, message: "Profile and password updated." })
  }

  // Name-only update
  const updated = await db.user.update({
    where: { id: session.user.id },
    data: { name },
    select: { id: true, name: true, email: true, role: true },
  })
  return NextResponse.json({ user: updated, message: "Profile updated." })
}
