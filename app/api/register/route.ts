import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { z } from "zod"

const schema = z.object({
  shopName: z.string().min(2),
  ownerName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", issues: parsed.error.flatten() }, { status: 400 })
  }

  const { shopName, ownerName, email, password, phone, address, city } = parsed.data

  // Check if email is already taken
  const existingUser = await db.user.findUnique({ where: { email } })
  if (existingUser) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 })
  }

  const existingShop = await db.shop.findUnique({ where: { email } })
  if (existingShop) {
    return NextResponse.json({ error: "A shop with this email is already registered." }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  // Create shop (PENDING) + admin user (inactive) in a transaction
  const { shop } = await db.$transaction(async (tx) => {
    const shop = await tx.shop.create({
      data: {
        name: shopName,
        ownerName,
        email,
        phone: phone || null,
        address: address || null,
        city: city || null,
        status: "PENDING",
        isActive: false,
      },
    })

    await tx.user.create({
      data: {
        shopId: shop.id,
        name: ownerName,
        email,
        password: hashedPassword,
        role: "ADMIN",
        isActive: false,
      },
    })

    return { shop }
  })

  return NextResponse.json(
    { message: "Shop registered successfully. Awaiting admin approval.", shopId: shop.id },
    { status: 201 }
  )
}
