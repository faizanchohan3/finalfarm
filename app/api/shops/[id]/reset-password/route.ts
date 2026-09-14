import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { z } from "zod"

const schema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters."),
})

// Super Admin resets the password of a shop's owner (ADMIN) account.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid data" },
      { status: 400 }
    )
  }

  const shop = await db.shop.findUnique({ where: { id } })
  if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 })

  // The owner is the ADMIN account created at registration (email matches the shop).
  const owner =
    (await db.user.findFirst({
      where: { shopId: id, email: shop.email, role: "ADMIN" },
    })) ??
    (await db.user.findFirst({
      where: { shopId: id, role: "ADMIN" },
      orderBy: { createdAt: "asc" },
    }))

  if (!owner) {
    return NextResponse.json(
      { error: "No owner account found for this shop." },
      { status: 404 }
    )
  }

  const hashed = await bcrypt.hash(parsed.data.newPassword, 12)
  await db.user.update({ where: { id: owner.id }, data: { password: hashed } })

  return NextResponse.json({
    message: "Password reset successfully.",
    email: owner.email,
  })
}
